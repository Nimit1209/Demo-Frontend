import axios from 'axios';

const ImageSegmentHandler = ({
  projectId,
  sessionId,
  videoLayers,
  audioLayers,
  setVideoLayers,
  saveHistory,
  autoSave,
  loadProjectTimeline,
  API_BASE_URL,
  timelineRef,
  roundToThreeDecimals, // Destructure roundToThreeDecimals
}) => {
  const generateImageThumbnail = async (imagePath, isElement = false) => {
    const filename = imagePath.split('/').pop();
    const fullImagePath = `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(filename)}`;
    console.log(`Generating thumbnail for: ${fullImagePath}`);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = fullImagePath;
      img.onload = () => {
        console.log(`Image loaded successfully: ${fullImagePath}`);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 120;
        const maxHeight = 80;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const thumbnail = canvas.toDataURL('image/jpeg');
        console.log(`Thumbnail generated: ${thumbnail.substring(0, 50)}...`);
        resolve(thumbnail);
      };
      img.onerror = () => {
        console.error(`Failed to load image for thumbnail: ${fullImagePath}`);
        resolve(null);
      };
    });
  };

  const addImageToTimeline = async (imageFileName, layer, timelineStartTime, timelineEndTime, isElement = false) => {
    if (!sessionId || !projectId) {
      console.error('Missing sessionId or projectId');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const roundedStartTime = roundToThreeDecimals(timelineStartTime);
      const roundedEndTime = roundToThreeDecimals(timelineEndTime);
      console.log('Adding image to timeline:', { imageFileName, layer, timelineStartTime: roundedStartTime, timelineEndTime: roundedEndTime, isElement });
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-project-image-to-timeline`,
        {
          imageFileName,
          layer,
          timelineStartTime: roundedStartTime,
          timelineEndTime: roundedEndTime,
          positionX: 0,
          positionY: 0,
          scale: 1,
          isElement,
        },
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const segment = response.data;
      console.log('addImageToTimeline response:', JSON.stringify(segment, null, 2));

      const effectiveIsElement = segment.element !== undefined ? segment.element : isElement;
      const thumbnail = await generateImageThumbnail(imageFileName, effectiveIsElement);
      const newSegment = {
        id: segment.id,
        type: 'image',
        fileName: imageFileName,
        filePath: `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(imageFileName)}`,
        thumbnail,
        startTime: timelineStartTime,
        duration: timelineEndTime - timelineStartTime,
        layer,
        positionX: segment.positionX || 0,
        positionY: segment.positionY || 0,
        scale: segment.scale || 1,
        opacity: segment.opacity || 1.0,
        width: segment.width,
        height: segment.height,
        effectiveWidth: segment.effectiveWidth,
        effectiveHeight: segment.effectiveHeight,
        maintainAspectRatio: segment.maintainAspectRatio,
        isElement: effectiveIsElement,
        timelineStartTime: roundedStartTime,
        timelineEndTime: roundedEndTime,
      };

      setVideoLayers((prev) => {
        const newLayers = [...prev];
        while (newLayers.length <= layer) newLayers.push([]);

        // Check if a segment with the same ID already exists in any layer
        let existingLayerIndex = -1;
        let existingSegment = null;
        for (let i = 0; i < newLayers.length; i++) {
          const found = newLayers[i].find((s) => s.id === newSegment.id);
          if (found) {
            existingSegment = found;
            existingLayerIndex = i;
            break;
          }
        }

        if (existingSegment) {
          console.warn(`Segment with ID ${newSegment.id} already exists in layer ${existingLayerIndex}. Updating instead.`);
          // Update existing segment
          newLayers[existingLayerIndex] = newLayers[existingLayerIndex].map((s) =>
            s.id === newSegment.id ? { ...s, ...newSegment, layer } : s
          );
        } else {
          // Add new segment
          newLayers[layer].push(newSegment);
        }

        return newLayers;
      });

      saveHistory(videoLayers, audioLayers);
      autoSave(videoLayers, audioLayers);
      return newSegment;
    } catch (error) {
      console.error('Error in addImageToTimeline:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        imageFileName,
        isElement,
        timelineStartTime,
        timelineEndTime,
        layer,
      });
      // Avoid calling loadProjectTimeline unless critical
      if (error.response?.status >= 500) {
        await loadProjectTimeline();
      }
      throw error;
    }
  };

  const updateImageSegment = async (segmentId, newStartTime, newLayer, newDuration, updatedSettings = {}) => {
    if (!sessionId || !projectId) return;
    try {
      const token = localStorage.getItem('token');
      let item;
      for (const layer of videoLayers) {
        item = layer.find((i) => i.id === segmentId);
        if (item) break;
      }
      if (!item) {
        console.error(`Image segment with ID ${segmentId} not found`);
        return;
      }
      const duration = newDuration || item.duration;
      const isElement = updatedSettings.isElement !== undefined
        ? updatedSettings.isElement
        : item.isElement !== undefined
        ? item.isElement
        : item.filePath.includes('elements/');
      const requestBody = {
        segmentId,
        timelineStartTime: roundToThreeDecimals(newStartTime), // Round
        timelineEndTime: roundToThreeDecimals(newStartTime + duration), // Round
        layer: newLayer,
        positionX: updatedSettings.positionX || item.positionX || 0,
        positionY: updatedSettings.positionY || item.positionY || 0,
        scale: updatedSettings.scale || item.scale || 1,
        opacity: updatedSettings.opacity || item.opacity || 1.0,
        width: updatedSettings.width || item.width,
        height: updatedSettings.height || item.height,
        effectiveWidth: updatedSettings.effectiveWidth || item.effectiveWidth,
        effectiveHeight: updatedSettings.effectiveHeight || item.effectiveHeight,
        maintainAspectRatio:
          updatedSettings.maintainAspectRatio !== undefined
            ? updatedSettings.maintainAspectRatio
            : item.maintainAspectRatio,
        isElement,
      };
      await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-image`,
        requestBody,
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log(`Updated image segment ${segmentId}`);
    } catch (error) {
      console.error('Error updating image segment:', error.response?.data || error.message);
      await loadProjectTimeline();
    }
  };

  const handleImageDrop = async (
    e,
    draggingItem,
    dragLayer,
    mouseX,
    mouseY,
    timeScale,
    dragOffset,
    snapIndicators,
    isElement = false
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sessionId || !timelineRef.current) {
      console.error('Session ID or timeline ref is not available');
      return;
    }

    const timelineRect = timelineRef.current.getBoundingClientRect();
    const layerHeight = 40;
    const relativeMouseY = mouseY - timelineRect.top;
    const totalVideoLayers = videoLayers.length;

    const reversedIndex = Math.floor(relativeMouseY / layerHeight);
    let targetLayer = totalVideoLayers - reversedIndex;
    targetLayer = Math.max(0, reversedIndex < 0 ? totalVideoLayers : targetLayer);

    if (!draggingItem) {
      const dataString = e.dataTransfer.getData('application/json');
      if (dataString) {
        const data = JSON.parse(dataString);
        if (data.type === 'photo' || data.type === 'element') {
          const item = data.photo || data.element;
          const isElementDrop = data.type === 'element';
          let dropTimePosition = (mouseX - timelineRect.left) / timeScale;
          let adjustedStartTime = Math.max(0, dropTimePosition);
          const duration = item.duration || 5;

          let newVideoLayers = [...videoLayers];
          while (newVideoLayers.length <= targetLayer) newVideoLayers.push([]);
          const targetLayerItems = newVideoLayers[targetLayer];

          while (true) {
            let hasOverlap = false;
            let overlappingItem = null;
            for (const existingItem of targetLayerItems) {
              const existingStart = existingItem.startTime;
              const existingEnd = existingStart + existingItem.duration;
              const newEnd = adjustedStartTime + duration;
              if (adjustedStartTime < existingEnd && newEnd > existingStart) {
                hasOverlap = true;
                overlappingItem = existingItem;
                break;
              }
            }
            if (!hasOverlap) break;
            adjustedStartTime = overlappingItem.startTime + overlappingItem.duration;
          }

          const imageFileName = item.fileName;
          console.log('Dropping new item:', {
            imageFileName,
            targetLayer,
            adjustedStartTime,
            isElement: isElementDrop,
          });
          await addImageToTimeline(
            imageFileName,
            targetLayer,
            roundToThreeDecimals(adjustedStartTime), // Round
            roundToThreeDecimals(adjustedStartTime + duration), // Round
            isElementDrop
          );
          saveHistory(videoLayers, audioLayers);
          autoSave(videoLayers, audioLayers);
        }
      }
      return;
    }

    if (draggingItem.type !== 'image') {
      console.log('Only image segments can be moved');
      return;
    }

    const newStartTime =
      snapIndicators.length > 0
        ? snapIndicators[0].time - (snapIndicators[0].edge === 'end' ? draggingItem.duration : 0)
        : (mouseX - timelineRect.left) / timeScale - dragOffset;
    const adjustedStartTime = Math.max(0, newStartTime);

    let newVideoLayers = [...videoLayers];
    while (newVideoLayers.length <= targetLayer) newVideoLayers.push([]);

    const hasOverlap = newVideoLayers[targetLayer].some((item) => {
      if (item.id === draggingItem.id) return false;
      const itemStart = item.startTime;
      const itemEnd = itemStart + item.duration;
      const newEnd = adjustedStartTime + draggingItem.duration;
      return adjustedStartTime < itemEnd && newEnd > itemStart;
    });

    if (hasOverlap) {
      console.log('Cannot move image: Overlap detected in target layer');
      return;
    }

    newVideoLayers[dragLayer] = newVideoLayers[dragLayer].filter((v) => v.id !== draggingItem.id);
    const isElementSegment = draggingItem.isElement !== undefined ? draggingItem.isElement : draggingItem.filePath.includes('elements/');
    const updatedItem = {
      ...draggingItem,
      startTime: adjustedStartTime,
      layer: targetLayer,
      timelineStartTime: roundToThreeDecimals(adjustedStartTime), // Round
      timelineEndTime: roundToThreeDecimals(adjustedStartTime + draggingItem.duration), // Round
    };
    newVideoLayers[targetLayer].push(updatedItem);

    setVideoLayers(newVideoLayers);
    saveHistory(videoLayers, audioLayers);
    autoSave(videoLayers, audioLayers);

    await updateImageSegment(draggingItem.id, roundToThreeDecimals(adjustedStartTime), targetLayer, draggingItem.duration, { // Round
      positionX: draggingItem.positionX,
      positionY: draggingItem.positionY,
      scale: draggingItem.scale,
      opacity: draggingItem.opacity,
      width: draggingItem.width,
      height: draggingItem.height,
      effectiveWidth: draggingItem.effectiveWidth,
      effectiveHeight: draggingItem.effectiveHeight,
      maintainAspectRatio: draggingItem.maintainAspectRatio,
      isElement: isElementSegment,
    });
  };

  const handleImageSplit = async (item, clickTime, layerIndex) => {
    console.log('handleImageSplit item:', JSON.stringify(item, null, 2));
    console.log('videoLayers state:', JSON.stringify(videoLayers, null, 2));

    const splitTime = clickTime - item.startTime;
    if (splitTime <= 0.1 || splitTime >= item.duration - 0.1) {
      console.warn('Split time is too close to segment boundaries:', { splitTime, duration: item.duration });
      return;
    }

    const firstPartDuration = splitTime;
    const secondPartDuration = item.duration - splitTime;

    const isElement = item.isElement !== undefined
      ? item.isElement
      : item.filePath.includes('elements/');
    console.log('Splitting item:', {
      imageFileName: item.fileName,
      isElement,
      startTime: item.startTime,
      splitTime,
      firstPartDuration,
      secondPartDuration,
      itemId: item.id,
    });

    let newVideoLayers = [...videoLayers];
    const layer = newVideoLayers[layerIndex];
    const itemIndex = layer.findIndex((i) => i.id === item.id);

    if (itemIndex === -1) {
      console.error('Item not found in layer:', item.id);
      return;
    }

    const firstPart = {
      ...item,
      duration: firstPartDuration,
      timelineEndTime: roundToThreeDecimals(item.startTime + firstPartDuration),
      isElement,
    };
    layer[itemIndex] = firstPart;

    const temporarySecondPartId = `${item.id}-split-${Date.now()}`;
    const secondPart = {
      ...item,
      id: temporarySecondPartId,
      startTime: item.startTime + splitTime,
      duration: secondPartDuration,
      timelineStartTime: roundToThreeDecimals(item.startTime + splitTime),
      timelineEndTime: roundToThreeDecimals(item.startTime + item.duration),
      isElement,
    };
    layer.push(secondPart);

    newVideoLayers[layerIndex] = layer;
    setVideoLayers(newVideoLayers);
    saveHistory(newVideoLayers, audioLayers);

    try {
      await updateImageSegment(item.id, roundToThreeDecimals(item.startTime), layerIndex, firstPartDuration, {
        isElement,
        positionX: item.positionX,
        positionY: item.positionY,
        scale: item.scale,
        opacity: item.opacity,
        width: item.width,
        height: item.height,
        effectiveWidth: item.effectiveWidth,
        effectiveHeight: item.effectiveHeight,
        maintainAspectRatio: item.maintainAspectRatio,
      });
      console.log(`Successfully updated first part: ${item.id}`);
    } catch (error) {
      console.error('Error updating first part of split:', error.response?.data || error.message);
      if (error.response?.status >= 500) {
        await loadProjectTimeline();
      }
      return;
    }

    const imageFileName = item.fileName;
    try {
      // Remove the temporary second part before adding the new segment
      setVideoLayers((prev) => {
        const newLayers = [...prev];
        newLayers[layerIndex] = newLayers[layerIndex].filter((s) => s.id !== temporarySecondPartId);
        return newLayers;
      });

      const newSegment = await addImageToTimeline(
        imageFileName,
        layerIndex,
        roundToThreeDecimals(secondPart.startTime),
        roundToThreeDecimals(secondPart.startTime + secondPartDuration),
        isElement
      );
      console.log('Successfully added second part to timeline:', newSegment);

      // The addImageToTimeline function already handles duplicate IDs, so no further replacement is needed
      saveHistory(videoLayers, []);
    } catch (error) {
      console.error('Error adding second part of split:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        imageFileName,
        isElement,
      });
      if (error.response?.status >= 500) {
        await loadProjectTimeline();
      }
      return;
    }

    autoSave(videoLayers, []);
  };

  return { addImageToTimeline, updateImageSegment, handleImageDrop, handleImageSplit };
};

export default ImageSegmentHandler;