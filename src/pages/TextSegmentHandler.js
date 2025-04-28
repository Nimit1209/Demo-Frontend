import React from 'react';
import axios from 'axios';

const TextSegmentHandler = ({
  projectId,
  sessionId,
  videoLayers,
  setVideoLayers,
  saveHistory,
  autoSave,
  loadProjectTimeline,
  API_BASE_URL,
  timelineRef,
  roundToThreeDecimals, // Destructure roundToThreeDecimals
}) => {
  const addTextToTimeline = async (targetLayer = 0, startTime = 0, updatedTextSettings) => {
    if (!sessionId || !projectId) return;
    try {
      const token = localStorage.getItem('token');
      const duration = updatedTextSettings.duration || 5;
      const timelineStartTime = roundToThreeDecimals(startTime);
      const timelineEndTime = roundToThreeDecimals(startTime + duration);
      await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-text`,
        {
          text: updatedTextSettings.text,
          layer: targetLayer,
          timelineStartTime,
          timelineEndTime,
          fontFamily: updatedTextSettings.fontFamily,
          scale: updatedTextSettings.scale || 1.0,
          fontColor: updatedTextSettings.fontColor,
          backgroundColor: updatedTextSettings.backgroundColor,
          positionX: updatedTextSettings.positionX,
          positionY: updatedTextSettings.positionY,
          alignment: updatedTextSettings.alignment || 'center',
          backgroundOpacity: updatedTextSettings.backgroundOpacity ?? 1.0,
          backgroundBorderWidth: updatedTextSettings.backgroundBorderWidth ?? 0,
          backgroundBorderColor: updatedTextSettings.backgroundBorderColor || '#000000',
          backgroundPadding: updatedTextSettings.backgroundPadding ?? 0,
          backgroundBorderRadius: updatedTextSettings.backgroundBorderRadius ?? 0, // New
        },
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      loadProjectTimeline();
    } catch (error) {
      console.error('Error adding text to timeline:', error);
    }
  };

  const updateTextSegment = async (segmentId, updatedTextSettings, newStartTime = null, newLayer = null) => {
    if (!sessionId || !projectId) return;
    try {
      const token = localStorage.getItem('token');
      const requestBody = {
        segmentId,
        text: updatedTextSettings.text,
        fontFamily: updatedTextSettings.fontFamily,
        scale: updatedTextSettings.scale || 1.0,
        fontColor: updatedTextSettings.fontColor,
        backgroundColor: updatedTextSettings.backgroundColor,
        positionX: updatedTextSettings.positionX,
        positionY: updatedTextSettings.positionY,
        alignment: updatedTextSettings.alignment || 'center',
        backgroundOpacity: updatedTextSettings.backgroundOpacity ?? 1.0,
        backgroundBorderWidth: updatedTextSettings.backgroundBorderWidth ?? 0,
        backgroundBorderColor: updatedTextSettings.backgroundBorderColor || '#000000',
        backgroundPadding: updatedTextSettings.backgroundPadding ?? 0,
        backgroundBorderRadius: updatedTextSettings.backgroundBorderRadius ?? 0, // New
      };
      // Only include keyframes if explicitly provided (e.g., from Transform panel)
      if (updatedTextSettings.keyframes) {
        requestBody.keyframes = updatedTextSettings.keyframes;
      }
      if (newStartTime !== null) {
        const duration = updatedTextSettings.duration || 5;
        requestBody.timelineStartTime = roundToThreeDecimals(newStartTime);
        requestBody.timelineEndTime = roundToThreeDecimals(newStartTime + duration);
      }
      if (newLayer !== null) requestBody.layer = newLayer;
      await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-text`,
        requestBody,
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log(`Updated text segment ${segmentId}`);
    } catch (error) {
      console.error('Error updating text segment:', error);
    }
  };

  const handleTextDrop = async (e, draggingItem, dragLayer, mouseX, mouseY, timeScale, dragOffset, snapIndicators) => {
    if (!sessionId || !timelineRef.current) return null;
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const layerHeight = 40;
    const reversedIndex = Math.floor((mouseY - timelineRect.top) / layerHeight);
    let targetLayer = videoLayers.length - reversedIndex;
    if (reversedIndex < 0) targetLayer = videoLayers.length;
    targetLayer = Math.max(0, Math.min(targetLayer, videoLayers.length));

    if (!draggingItem) {
      const dataString = e.dataTransfer.getData('application/json');
      if (dataString) {
        const data = JSON.parse(dataString);
        if (data.type === 'text') {
          const dropTimePosition = (mouseX - timelineRect.left) / timeScale;
          return {
            layer: targetLayer,
            startTime: dropTimePosition,
            isNew: true,
            scale: 1.0,
            alignment: 'center',
            backgroundOpacity: 1.0,
            backgroundBorderWidth: 0,
            backgroundBorderColor: '#000000',
            backgroundPadding: 0,
            backgroundBorderRadius: 0, // New
          };
        }
      }
      return null;
    }

    if (draggingItem.type !== 'text') return null;

    let actualLayerIndex = targetLayer;
    const newStartTime = snapIndicators.length > 0
      ? snapIndicators[0].time - (snapIndicators[0].edge === 'end' ? draggingItem.duration : 0)
      : (mouseX - timelineRect.left) / timeScale - dragOffset;
    const adjustedStartTime = Math.max(0, newStartTime);
    let newVideoLayers = [...videoLayers];
    while (newVideoLayers.length <= actualLayerIndex) newVideoLayers.push([]);

    const hasOverlap = newVideoLayers[actualLayerIndex].some((video) => {
      if (draggingItem && video.id === draggingItem.id) return false;
      const videoStart = video.startTime;
      const videoEnd = videoStart + video.duration;
      const newVideoEnd = adjustedStartTime + draggingItem.duration;
      return adjustedStartTime < videoEnd && newVideoEnd > videoStart;
    });

    if (hasOverlap) {
      console.log('Overlap detected. Cannot place item here.');
      return null;
    }

    if (actualLayerIndex === dragLayer) {
      newVideoLayers[actualLayerIndex] = newVideoLayers[actualLayerIndex].filter((v) => v.id !== draggingItem.id);
    } else {
      newVideoLayers[dragLayer] = newVideoLayers[dragLayer].filter((v) => v.id !== draggingItem.id);
    }
    const updatedItem = {
      ...draggingItem,
      startTime: adjustedStartTime,
      layer: actualLayerIndex,
      timelineStartTime: roundToThreeDecimals(adjustedStartTime),
      timelineEndTime: roundToThreeDecimals(adjustedStartTime + draggingItem.duration),
      alignment: draggingItem.alignment || 'center',
      backgroundOpacity: draggingItem.backgroundOpacity ?? 1.0,
      backgroundBorderWidth: draggingItem.backgroundBorderWidth ?? 0,
      backgroundBorderColor: draggingItem.backgroundBorderColor || '#000000',
      backgroundPadding: draggingItem.backgroundPadding ?? 0,
      backgroundBorderRadius: draggingItem.backgroundBorderRadius ?? 0, // New
    };
    newVideoLayers[actualLayerIndex].push(updatedItem);
    setVideoLayers(newVideoLayers);
    saveHistory(newVideoLayers, []);
    autoSave(newVideoLayers, []);
    await updateTextSegment(draggingItem.id, updatedItem, roundToThreeDecimals(adjustedStartTime), actualLayerIndex);
    return null;
  };

  const handleSaveTextSegment = async (updatedTextSettings, editingTextSegment) => {
    if (!editingTextSegment) {
      console.error('editingTextSegment is undefined');
      return;
    }
    if (editingTextSegment.isNew) {
      await addTextToTimeline(editingTextSegment.layer, editingTextSegment.startTime, updatedTextSettings);
      const tempId = `text-temp-${Date.now()}`;
      const startTime = editingTextSegment.startTime;
      const duration = updatedTextSettings.duration || 5;
      const newTextSegment = {
        id: tempId,
        type: 'text',
        text: updatedTextSettings.text,
        startTime,
        duration,
        layer: editingTextSegment.layer,
        fontFamily: updatedTextSettings.fontFamily,
        scale: updatedTextSettings.scale || 1.0,
        fontColor: updatedTextSettings.fontColor,
        backgroundColor: updatedTextSettings.backgroundColor,
        positionX: updatedTextSettings.positionX,
        positionY: updatedTextSettings.positionY,
        alignment: updatedTextSettings.alignment || 'center',
        backgroundOpacity: updatedTextSettings.backgroundOpacity ?? 1.0,
        backgroundBorderWidth: updatedTextSettings.backgroundBorderWidth ?? 0,
        backgroundBorderColor: updatedTextSettings.backgroundBorderColor || '#000000',
        backgroundPadding: updatedTextSettings.backgroundPadding ?? 0,
        backgroundBorderRadius: updatedTextSettings.backgroundBorderRadius ?? 0, // New
        timelineStartTime: roundToThreeDecimals(startTime),
        timelineEndTime: roundToThreeDecimals(startTime + duration),
      };
      const newVideoLayers = [...videoLayers];
      while (newVideoLayers.length <= editingTextSegment.layer) newVideoLayers.push([]);
      newVideoLayers[editingTextSegment.layer].push(newTextSegment);
      setVideoLayers(newVideoLayers);
      saveHistory(newVideoLayers, []);
      autoSave(newVideoLayers, []);
      await loadProjectTimeline();
    } else {
      if (!editingTextSegment.id) {
        console.error('Editing text segment has no ID');
        return;
      }
      await updateTextSegment(editingTextSegment.id, updatedTextSettings);
      const duration = updatedTextSettings.duration || editingTextSegment.duration;
      const newVideoLayers = videoLayers.map((layer) =>
        layer.map((item) =>
          item.id === editingTextSegment.id && item.type === 'text'
            ? {
                ...item,
                text: updatedTextSettings.text,
                fontFamily: updatedTextSettings.fontFamily,
                scale: updatedTextSettings.scale || item.scale || 1.0,
                fontColor: updatedTextSettings.fontColor,
                backgroundColor: updatedTextSettings.backgroundColor,
                positionX: updatedTextSettings.positionX,
                positionY: updatedTextSettings.positionY,
                alignment: updatedTextSettings.alignment || 'center',
                backgroundOpacity: updatedTextSettings.backgroundOpacity ?? 1.0,
                backgroundBorderWidth: updatedTextSettings.backgroundBorderWidth ?? 0,
                backgroundBorderColor: updatedTextSettings.backgroundBorderColor || '#000000',
                backgroundPadding: updatedTextSettings.backgroundPadding ?? 0,
                backgroundBorderRadius: updatedTextSettings.backgroundBorderRadius ?? 0, // New
                duration,
                timelineEndTime: roundToThreeDecimals(item.startTime + duration),
              }
            : item
        )
      );
      setVideoLayers(newVideoLayers);
      saveHistory(newVideoLayers, []);
      autoSave(newVideoLayers, []);
      await loadProjectTimeline();
    }
  };

  const handleTextSplit = async (item, clickTime, layerIndex) => {
    const splitTime = clickTime - item.startTime;
    if (splitTime <= 0.1 || splitTime >= item.duration - 0.1) return;

    const firstPartDuration = splitTime;
    const secondPartDuration = item.duration - splitTime;
    let newVideoLayers = [...videoLayers];
    const layer = newVideoLayers[layerIndex];
    const itemIndex = layer.findIndex((i) => i.id === item.id);

    const firstPart = {
      ...item,
      duration: firstPartDuration,
      timelineEndTime: roundToThreeDecimals(item.startTime + firstPartDuration),
      alignment: item.alignment || 'center',
      backgroundOpacity: item.backgroundOpacity ?? 1.0,
      backgroundBorderWidth: item.backgroundBorderWidth ?? 0,
      backgroundBorderColor: item.backgroundBorderColor || '#000000',
      backgroundPadding: item.backgroundPadding ?? 0,
      backgroundBorderRadius: item.backgroundBorderRadius ?? 0, // New
    };
    layer[itemIndex] = firstPart;

    const secondPart = {
      ...item,
      id: `${item.id}-split-${Date.now()}`,
      startTime: item.startTime + splitTime,
      duration: secondPartDuration,
      timelineStartTime: roundToThreeDecimals(item.startTime + splitTime),
      timelineEndTime: roundToThreeDecimals(item.startTime + item.duration),
      scale: item.scale || 1.0,
      alignment: item.alignment || 'center',
      backgroundOpacity: item.backgroundOpacity ?? 1.0,
      backgroundBorderWidth: item.backgroundBorderWidth ?? 0,
      backgroundBorderColor: item.backgroundBorderColor || '#000000',
      backgroundPadding: item.backgroundPadding ?? 0,
      backgroundBorderRadius: item.backgroundBorderRadius ?? 0, // New
    };
    layer.push(secondPart);

    newVideoLayers[layerIndex] = layer;
    setVideoLayers(newVideoLayers);
    saveHistory(newVideoLayers, []);

    await updateTextSegment(item.id, firstPart, item.startTime, layerIndex);
    await addTextToTimeline(layerIndex, secondPart.startTime, {
      ...secondPart,
      duration: secondPartDuration,
      alignment: secondPart.alignment,
      scale: secondPart.scale,
      backgroundOpacity: secondPart.backgroundOpacity,
      backgroundBorderWidth: secondPart.backgroundBorderWidth,
      backgroundBorderColor: secondPart.backgroundBorderColor,
      backgroundPadding: secondPart.backgroundPadding,
      backgroundBorderRadius: secondPart.backgroundBorderRadius, // New
    });
    autoSave(newVideoLayers, []);
    await loadProjectTimeline();
  };

  return { addTextToTimeline, updateTextSegment, handleTextDrop, handleSaveTextSegment, handleTextSplit };
};

export default TextSegmentHandler;