import React, { useCallback, useEffect, useRef } from 'react';

const GeneralSegmentHandler = ({
  videoLayers,
  audioLayers,
  setVideoLayers,
  setAudioLayers,
  timeScale,
  setSnapIndicators,
  draggingItem,
  setDraggingItem,
  dragLayer,
  setDragLayer,
  dragOffset,
  setDragOffset,
  resizingItem,
  setResizingItem,
  resizeEdge,
  setResizeEdge,
  timelineRef,
  isSplitMode,
  saveHistory,
  autoSave,
  SNAP_THRESHOLD,
  updateSegmentPosition,
  updateTextSegment,
  updateImageSegment,
  updateAudioSegment,
  fetchVideoDuration,
  currentTime,
}) => {
  const durationCache = useRef(new Map());

  const handleDragStart = (e, item, layerIndex) => {
    if (isSplitMode) return;
    // Store original startTime to revert if needed
    const itemWithOriginal = {
      ...item,
      originalStartTime: item.startTime,
      isValidPosition: true, // Track if the current drag position is valid
    };
    setDraggingItem(itemWithOriginal);
    setDragLayer(item.layer);
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    setDragOffset(offsetX / timeScale);
    e.currentTarget.classList.add('dragging');
  };

  useEffect(() => {
    const handleDragHover = (e) => {
      if (!draggingItem || !timelineRef.current) return;
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const mouseY = e.clientY - timelineRect.top;
      if (mouseY < 0) {
        timelineRef.current.classList.add('showing-new-layer-top');
      } else {
        timelineRef.current.classList.remove('showing-new-layer-top');
      }
    };
    document.addEventListener('dragover', handleDragHover);
    return () => document.removeEventListener('dragover', handleDragHover);
  }, [draggingItem]);

  const handleDragOver = (e) => {
    if (isSplitMode) return;
    e.preventDefault();
    if (!draggingItem || !timelineRef.current) return;

    const timelineRect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - timelineRect.left;
    let potentialStartTime = (mouseX / timeScale) - dragOffset;
    potentialStartTime = Math.max(0, potentialStartTime);

    const newSnapIndicators = [];
    const snapPoints = [];
    const isAudioLayer = draggingItem.layer < 0;
    const currentLayerIndex = isAudioLayer
      ? Math.abs(draggingItem.layer) - 1
      : draggingItem.layer;
    const currentLayer = isAudioLayer
      ? audioLayers[currentLayerIndex]
      : videoLayers[currentLayerIndex];

    // Collect snap points from all layers
    [...videoLayers, ...audioLayers].forEach((layer, layerIdx) => {
      const isAudio = layerIdx >= videoLayers.length;
      const adjustedLayerIdx = isAudio ? -(layerIdx - videoLayers.length + 1) : layerIdx;
      layer.forEach(item => {
        if (item.id === draggingItem.id) return;
        snapPoints.push({ time: item.startTime, layerIdx: adjustedLayerIdx, type: 'start' });
        snapPoints.push({ time: item.startTime + item.duration, layerIdx: adjustedLayerIdx, type: 'end' });
      });
    });

    // Add timeline start and playhead as snap points
    snapPoints.push({ time: 0, layerIdx: dragLayer, type: 'timelineStart' });
    if (currentTime !== undefined && !isNaN(currentTime)) {
      snapPoints.push({ time: currentTime, layerIdx: dragLayer, type: 'playhead' });
    }

    // Check for overlaps within the same layer
    let isValidPosition = true;
    if (currentLayer) {
      for (const item of currentLayer) {
        if (item.id === draggingItem.id) continue;
        const itemStart = item.startTime;
        const itemEnd = item.startTime + item.duration;
        const segmentStart = potentialStartTime;
        const segmentEnd = potentialStartTime + draggingItem.duration;

        // Check if the dragged segment overlaps with this item
        if (segmentStart < itemEnd && segmentEnd > itemStart) {
          isValidPosition = false;
          break;
        }
      }
    }

    // If position is invalid, revert to original startTime
    if (!isValidPosition) {
      potentialStartTime = draggingItem.originalStartTime;
    } else {
      // Apply collision boundaries only if valid
      let maxLeftBound = -Infinity;
      let minRightBound = Infinity;
      if (currentLayer) {
        currentLayer.forEach(item => {
          if (item.id === draggingItem.id) return;
          const itemStart = item.startTime;
          const itemEnd = item.startTime + item.duration;
          if (itemEnd <= potentialStartTime && itemEnd > maxLeftBound) {
            maxLeftBound = itemEnd;
          }
          if (itemStart >= potentialStartTime + draggingItem.duration && itemStart < minRightBound) {
            minRightBound = itemStart;
          }
        });
      }

      if (potentialStartTime < maxLeftBound) {
        potentialStartTime = maxLeftBound;
      }
      if (potentialStartTime + draggingItem.duration > minRightBound) {
        potentialStartTime = minRightBound - draggingItem.duration;
      }
      potentialStartTime = Math.max(0, potentialStartTime);

      // Snapping logic
      let closestSnapPoint = null;
      let minDistance = SNAP_THRESHOLD;

      snapPoints.forEach(point => {
        const currentThreshold = point.type === 'timelineStart' || point.type === 'playhead' ? SNAP_THRESHOLD * 2 : SNAP_THRESHOLD;

        const distanceToStart = Math.abs(point.time - potentialStartTime);
        if (distanceToStart < currentThreshold && distanceToStart < minDistance) {
          minDistance = distanceToStart;
          closestSnapPoint = { time: point.time, layerIdx: point.layerIdx, type: point.type, edge: 'start' };
        }

        const itemEndTime = potentialStartTime + draggingItem.duration;
        const distanceToEnd = Math.abs(point.time - itemEndTime);
        if (distanceToEnd < currentThreshold && distanceToEnd < minDistance) {
          minDistance = distanceToEnd;
          closestSnapPoint = { time: point.time - draggingItem.duration, layerIdx: point.layerIdx, type: point.type, edge: 'end' };
        }
      });

      if (closestSnapPoint) {
        let snappedStartTime = closestSnapPoint.time;
        if (snappedStartTime < maxLeftBound) {
          snappedStartTime = maxLeftBound;
        }
        if (snappedStartTime + draggingItem.duration > minRightBound) {
          snappedStartTime = minRightBound - draggingItem.duration;
        }
        potentialStartTime = Math.max(0, snappedStartTime);
        newSnapIndicators.push({
          time: closestSnapPoint.edge === 'start' ? potentialStartTime : potentialStartTime + draggingItem.duration,
          layerIdx: dragLayer,
          edge: closestSnapPoint.edge,
          type: closestSnapPoint.type, // Include type for SnapIndicators
        });
      }
    }

    setSnapIndicators(newSnapIndicators);

    // Update the dragged element's position
    const draggedElement = document.querySelector('.timeline-item.dragging');
    if (draggedElement) {
      draggedElement.style.left = `${potentialStartTime * timeScale}px`;
      draggedElement.classList.toggle('snapping', newSnapIndicators.length > 0 && isValidPosition);
      draggedElement.classList.toggle('invalid', !isValidPosition);
    }

    // Store the position and validity
    draggingItem.tempStartTime = potentialStartTime;
    draggingItem.isValidPosition = isValidPosition;
  };

  const handleDragEnd = () => {
    if (!draggingItem) return;
    setSnapIndicators([]);
    const dragElements = document.querySelectorAll('.dragging');
    dragElements.forEach(el => el.classList.remove('dragging', 'invalid'));
    if (timelineRef.current) {
      timelineRef.current.classList.remove('showing-new-layer');
    }
    setDraggingItem(null);
    setDragLayer(null);
    setDragOffset(0);
  };

  useEffect(() => {
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, [draggingItem]);

  const handleResizeStart = (e, item, layerIndex, edge) => {
    if (isSplitMode) return;
    e.stopPropagation();
    setResizingItem({
      ...item,
      layerIndex,
      originalStartTime: item.startTime,
      originalStartWithinAudio: item.startTimeWithinAudio,
      originalEndWithinAudio: item.endTimeWithinAudio,
    });
    setResizeEdge(edge);
    e.preventDefault();
  };

  const handleResizeMove = useCallback(
    (e) => {
      if (!resizingItem || !timelineRef.current) return;
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const mouseX = e.clientX - timelineRect.left;
      let newTime = Math.max(0, mouseX / timeScale);
      const isAudioLayer = resizingItem.layer < 0;
      const layerArray = isAudioLayer ? audioLayers : videoLayers;
      const layerIndex = isAudioLayer ? Math.abs(resizingItem.layer) - 1 : resizingItem.layerIndex;
      let newVideoLayers = [...videoLayers];
      let newAudioLayers = [...audioLayers];
      const layer = isAudioLayer ? newAudioLayers[layerIndex] : newVideoLayers[layerIndex];
      const itemIndex = layer.findIndex((i) => i.id === resizingItem.id);
      if (itemIndex === -1) {
        console.error('Item not found during resize:', resizingItem);
        return;
      }
      const item = { ...layer[itemIndex] };

      const originalStartTime = item.startTime ?? resizingItem.startTime ?? 0;
      const originalStartWithin = item.type === 'video'
        ? (item.startTimeWithinVideo ?? 0)
        : (item.startTimeWithinAudio ?? 0);
      const originalEndWithin = item.type === 'video'
        ? (item.endTimeWithinVideo ?? item.duration)
        : (item.endTimeWithinAudio ?? item.duration);

      let newStartTime = originalStartTime;
      let newDuration = item.duration;
      let newStartWithin = originalStartWithin;
      let newEndWithin = originalEndWithin;

      // Collect snap points from all layers
      const snapPoints = [];
      [...videoLayers, ...audioLayers].forEach((layer, layerIdx) => {
        const isAudio = layerIdx >= videoLayers.length;
        const adjustedLayerIdx = isAudio ? -(layerIdx - videoLayers.length + 1) : layerIdx;
        layer.forEach((otherItem) => {
          if (otherItem.id === resizingItem.id) return;
          snapPoints.push({ time: otherItem.startTime, layerIdx: adjustedLayerIdx, type: 'start' });
          snapPoints.push({ time: otherItem.startTime + otherItem.duration, layerIdx: adjustedLayerIdx, type: 'end' });
        });
      });
      snapPoints.push({ time: 0, layerIdx: resizingItem.layer, type: 'timelineStart' });
      if (currentTime !== undefined && !isNaN(currentTime)) {
        snapPoints.push({ time: currentTime, layerIdx: resizingItem.layer, type: 'playhead' });
      }

      // Check for collisions with other segments in the same layer
      const otherItems = layer.filter((i) => i.id !== resizingItem.id);
      let maxLeftBound = -Infinity;
      let minRightBound = Infinity;

      otherItems.forEach((otherItem) => {
        const otherStart = otherItem.startTime;
        const otherEnd = otherItem.startTime + otherItem.duration;
        if (otherEnd <= originalStartTime && otherEnd > maxLeftBound) {
          maxLeftBound = otherEnd;
        }
        if (otherStart >= originalStartTime + item.duration && otherStart < minRightBound) {
          minRightBound = otherStart;
        }
      });

      // Snapping logic
      let closestSnapPoint = null;
      let minDistance = SNAP_THRESHOLD;
      let isSnapping = false;

      if (resizeEdge === 'left') {
        const originalEndTime = originalStartTime + item.duration;
        newStartTime = Math.min(newTime, originalEndTime - 0.1);
        if (maxLeftBound !== -Infinity) {
          newStartTime = Math.max(newStartTime, maxLeftBound);
        }

        // Check snapping for left edge
        snapPoints.forEach((point) => {
          const distance = Math.abs(point.time - newStartTime);
          const currentThreshold = point.type === 'timelineStart' || point.type === 'playhead' ? SNAP_THRESHOLD * 2 : SNAP_THRESHOLD;
          if (distance < currentThreshold && distance < minDistance) {
            minDistance = distance;
            closestSnapPoint = { time: point.time, layerIdx: point.layerIdx, type: point.type, edge: 'start' };
          }
        });

        if (closestSnapPoint) {
          newStartTime = Math.max(maxLeftBound, closestSnapPoint.time);
          isSnapping = true;
          // Add snap indicator
          setSnapIndicators([{
            time: newStartTime,
            layerIdx: resizingItem.layer,
            edge: 'start',
            type: closestSnapPoint.type,
          }]);
        } else {
          setSnapIndicators([]);
        }

        newDuration = originalEndTime - newStartTime;
        if (item.type === 'video' || item.type === 'audio') {
          const timeShift = newStartTime - originalStartTime;
          newStartWithin = originalStartWithin + timeShift;
          if (item.type === 'video' && newStartWithin < 0) {
            newStartWithin = 0;
            newStartTime = originalStartTime - (originalStartWithin - newStartWithin);
            newDuration = originalEndTime - newStartTime;
          }
          newStartWithin = Math.max(0, newStartWithin);
          newEndWithin = originalEndWithin;
        }
      } else if (resizeEdge === 'right') {
        const newEndTime = Math.max(newTime, originalStartTime + 0.1);
        let clampedEndTime = newEndTime;
        if (minRightBound !== Infinity) {
          clampedEndTime = Math.min(newEndTime, minRightBound);
        }

        // Check snapping for right edge
        snapPoints.forEach((point) => {
          const distance = Math.abs(point.time - clampedEndTime);
          const currentThreshold = point.type === 'timelineStart' || point.type === 'playhead' ? SNAP_THRESHOLD * 2 : SNAP_THRESHOLD;
          if (distance < currentThreshold && distance < minDistance) {
            minDistance = distance;
            closestSnapPoint = { time: point.time, layerIdx: point.layerIdx, type: point.type, edge: 'end' };
          }
        });

        if (closestSnapPoint) {
          clampedEndTime = Math.min(minRightBound, closestSnapPoint.time);
          isSnapping = true;
          // Add snap indicator
          setSnapIndicators([{
            time: clampedEndTime,
            layerIdx: resizingItem.layer,
            edge: 'end',
            type: closestSnapPoint.type,
          }]);
        } else {
          setSnapIndicators([]);
        }

        newDuration = clampedEndTime - originalStartTime;
        if (item.type === 'video' || item.type === 'audio') {
          newStartWithin = originalStartWithin;
          newEndWithin = originalStartWithin + newDuration;
          if (item.type === 'video') {
            let sourceDuration = durationCache.current.get(item.filePath);
            if (sourceDuration === undefined) {
              fetchVideoDuration(item.filePath).then((duration) => {
                if (duration !== null) {
                  durationCache.current.set(item.filePath, duration);
                }
              });
              sourceDuration = item.duration;
            }
            if (newEndWithin > sourceDuration) {
              newEndWithin = sourceDuration;
              newDuration = newEndWithin - originalStartWithin;
              clampedEndTime = originalStartTime + newDuration;
            }
          }
        }
      }

      // Apply .snapping class to the resizing element
      const resizingElement = document.querySelector(`.timeline-item[data-id="${resizingItem.id}"]`);
      if (resizingElement) {
        resizingElement.classList.toggle('snapping', isSnapping);
      }

      // Update item properties
      item.startTime = newStartTime;
      item.duration = newDuration;
      item.timelineStartTime = newStartTime;
      item.timelineEndTime = newStartTime + newDuration;
      if (item.type === 'video') {
        item.startTimeWithinVideo = newStartWithin;
        item.endTimeWithinVideo = newEndWithin;
      } else if (item.type === 'audio') {
        item.startTimeWithinAudio = newStartWithin;
        item.endTimeWithinAudio = newEndWithin;
      }
      layer[itemIndex] = item;

      if (isAudioLayer) {
        newAudioLayers[layerIndex] = layer;
        setAudioLayers(newAudioLayers);
      } else {
        newVideoLayers[layerIndex] = layer;
        setVideoLayers(newVideoLayers);
      }
    },
    [
      resizingItem,
      resizeEdge,
      videoLayers,
      audioLayers,
      timeScale,
      setVideoLayers,
      setAudioLayers,
      SNAP_THRESHOLD,
      fetchVideoDuration,
      currentTime, // Add currentTime to dependencies
      setSnapIndicators,
    ]
  );

  const handleResizeEnd = async () => {
    if (!resizingItem) return;

    const isAudioLayer = resizingItem.layer < 0;
    const layerArray = isAudioLayer ? audioLayers : videoLayers;
    const layerIndex = isAudioLayer ? Math.abs(resizingItem.layer) - 1 : resizingItem.layerIndex;
    const layer = layerArray[layerIndex];
    const item = layer.find(i => i.id === resizingItem.id);

    if (item) {
      saveHistory(videoLayers, audioLayers);
      autoSave(videoLayers, audioLayers);

      const newStartTime = item.startTime;
      const newDuration = item.duration;

      if (item.type === 'video') {
        await updateSegmentPosition(
          item.id,
          newStartTime,
          item.layer,
          newDuration,
          item.startTimeWithinVideo,
          item.endTimeWithinVideo
        );
      } else if (item.type === 'text') {
        const updatedTextSettings = { ...item, duration: newDuration };
        await updateTextSegment(item.id, updatedTextSettings, newStartTime, item.layer);
      } else if (item.type === 'image') {
        const updatedSettings = {
          positionX: item.positionX,
          positionY: item.positionY,
          scale: item.scale,
          opacity: item.opacity,
          width: item.width,
          height: item.height,
          effectiveWidth: item.effectiveWidth,
          effectiveHeight: item.effectiveHeight,
          maintainAspectRatio: item.maintainAspectRatio,
        };
        await updateImageSegment(item.id, newStartTime, item.layer, newDuration, updatedSettings);
      } else if (item.type === 'audio') {
        await updateAudioSegment(
          item.id,
          newStartTime,
          item.layer,
          newDuration,
          item.startTimeWithinAudio,
          item.endTimeWithinAudio
        );
      }
    }

    setResizingItem(null);
    setResizeEdge(null);
  };

  useEffect(() => {
    if (resizingItem) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingItem, handleResizeMove, handleResizeEnd]);

  return {
    handleDragStart,
    handleDragOver,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
};

export default GeneralSegmentHandler;