import React from 'react';
import axios from 'axios';

const ImageSegmentHandler = ({
  projectId,
  sessionId,
  videoLayers,
  setVideoLayers,
  saveHistory,
  autoSave,
  loadProjectTimeline,
  API_BASE_URL,
  timelineRef,
}) => {
  const generateImageThumbnail = async (imagePath, isElement = false) => {
    const filename = imagePath.split('/').pop();
    const fullImagePath = isElement
      ? `${API_BASE_URL}/elements/${encodeURIComponent(filename)}`
      : `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(filename)}`;
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
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-project-image-to-timeline`,
        {
          imageFileName,
          layer,
          timelineStartTime,
          timelineEndTime,
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
      console.log('addImageToTimeline response:', segment);

      const thumbnail = await generateImageThumbnail(imageFileName, isElement);
      const newSegment = {
        id: segment.id,
        type: 'image',
        fileName: imageFileName,
        filePath: isElement
          ? `${API_BASE_URL}/elements/${encodeURIComponent(imageFileName)}`
          : `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(imageFileName)}`,
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
      };
      setVideoLayers((prev) => {
        const newLayers = [...prev];
        while (newLayers.length <= layer) newLayers.push([]);
        newLayers[layer].push(newSegment);
        return newLayers;
      });
      saveHistory([...videoLayers, newSegment], []);
      autoSave([...videoLayers, newSegment], []);
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
      await loadProjectTimeline();
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
      const isElement = updatedSettings.isElement || item.filePath.includes('/elements/');
      const requestBody = {
        segmentId,
        timelineStartTime: newStartTime,
        timelineEndTime: newStartTime + duration,
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

          let hasOverlap = true;
          while (hasOverlap) {
            hasOverlap = targetLayerItems.some((existingItem) => {
              const existingStart = existingItem.startTime;
              const existingEnd = existingStart + existingItem.duration;
              const newEnd = adjustedStartTime + duration;
              return adjustedStartTime < existingEnd && newEnd > existingStart;
            });
            if (hasOverlap) {
              const overlappingItem = targetLayerItems.find((existingItem) => {
                const existingStart = existingItem.startTime;
                const existingEnd = existingItem.startTime + existingItem.duration;
                const newEnd = adjustedStartTime + duration;
                return adjustedStartTime < existingEnd && newEnd > existingStart;
              });
              if (overlappingItem) {
                adjustedStartTime = overlappingItem.startTime + overlappingItem.duration;
              } else {
                break;
              }
            }
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
            adjustedStartTime,
            adjustedStartTime + duration,
            isElementDrop
          );
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
    const isElementSegment = draggingItem.filePath.includes('/elements/');
    const updatedItem = { ...draggingItem, startTime: adjustedStartTime, layer: targetLayer };
    newVideoLayers[targetLayer].push(updatedItem);

    setVideoLayers(newVideoLayers);
    saveHistory(newVideoLayers, []);
    autoSave(newVideoLayers, []);

    await updateImageSegment(draggingItem.id, adjustedStartTime, targetLayer, draggingItem.duration, {
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
    const splitTime = clickTime - item.startTime;
    if (splitTime <= 0.1 || splitTime >= item.duration - 0.1) return;

    const firstPartDuration = splitTime;
    const secondPartDuration = item.duration - splitTime;
    let newVideoLayers = [...videoLayers];
    const layer = newVideoLayers[layerIndex];
    const itemIndex = layer.findIndex((i) => i.id === item.id);

    const isElement = item.filePath.includes('/elements/');
    const firstPart = {
      ...item,
      duration: firstPartDuration,
      timelineEndTime: item.startTime + firstPartDuration,
    };
    layer[itemIndex] = firstPart;

    const secondPart = {
      ...item,
      id: `${item.id}-split-${Date.now()}`,
      startTime: item.startTime + splitTime,
      duration: secondPartDuration,
      timelineStartTime: item.startTime + splitTime,
      timelineEndTime: item.startTime + item.duration,
    };
    layer.push(secondPart);

    newVideoLayers[layerIndex] = layer;
    setVideoLayers(newVideoLayers);
    saveHistory(newVideoLayers, []);

    try {
      await updateImageSegment(item.id, item.startTime, layerIndex, firstPartDuration, {
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
    } catch (error) {
      console.error('Error updating first part of split:', error.response?.data || error.message);
      await loadProjectTimeline();
      return;
    }

    const imageFileName = item.fileName;
    console.log('Splitting item:', { imageFileName, isElement, startTime: secondPart.startTime, duration: secondPartDuration });

    try {
      const newSegment = await addImageToTimeline(
        imageFileName,
        layerIndex,
        secondPart.startTime,
        secondPart.startTime + secondPartDuration,
        isElement
      );
      console.log('Successfully added second part to timeline:', newSegment);

      if (newSegment && newSegment.id !== secondPart.id) {
        newVideoLayers = [...newVideoLayers];
        const updatedLayer = newVideoLayers[layerIndex];
        const secondPartIndex = updatedLayer.findIndex((i) => i.id === secondPart.id);
        if (secondPartIndex !== -1) {
          updatedLayer[secondPartIndex] = { ...updatedLayer[secondPartIndex], id: newSegment.id };
          newVideoLayers[layerIndex] = updatedLayer;
          setVideoLayers(newVideoLayers);
          saveHistory(newVideoLayers, []);
        } else {
          console.error('Second part not found in layer after adding to timeline');
        }
      }
    } catch (error) {
      console.error('Error adding second part of split:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        imageFileName,
        isElement,
      });
      await loadProjectTimeline();
      return;
    }

    autoSave(newVideoLayers, []);
  };

  return { addImageToTimeline, updateImageSegment, handleImageDrop, handleImageSplit };
};

export default ImageSegmentHandler;