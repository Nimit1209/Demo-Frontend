import React from 'react';
import axios from 'axios';

const AudioSegmentHandler = ({
  projectId,
  sessionId,
  audioLayers,
  setAudioLayers,
  saveHistory,
  autoSave,
  loadProjectTimeline,
  API_BASE_URL,
  timelineRef,
  roundToThreeDecimals, // Destructure roundToThreeDecimals
}) => {
  const updateAudioSegment = async (audioSegmentId, newStartTime, newLayer, newDuration, startTimeWithinAudio, endTimeWithinAudio, draggingItem) => {
    if (!projectId || !sessionId) return;

    try {
      const token = localStorage.getItem('token');
      let item = draggingItem;
      if (!item) {
        const layer = audioLayers[Math.abs(newLayer) - 1];
        item = layer.find((i) => i.id === audioSegmentId);
      }
      if (!item) {
        throw new Error(`Audio segment with ID ${audioSegmentId} not found in layer ${newLayer}`);
      }

      const originalDuration = item.duration;
      const timelineEndTime = newStartTime + (newDuration || originalDuration);

      const maxAudioDuration = item.maxDuration || 3600;

      const clampedStartTimeWithinAudio = Math.max(0, Math.min(
        startTimeWithinAudio !== undefined ? startTimeWithinAudio : item.startTimeWithinAudio || 0,
        maxAudioDuration - (newDuration || originalDuration)
      ));
      const clampedEndTimeWithinAudio = Math.max(
        clampedStartTimeWithinAudio + 0.001,
        Math.min(
          endTimeWithinAudio !== undefined ? endTimeWithinAudio : (item.endTimeWithinAudio || clampedStartTimeWithinAudio + originalDuration),
          maxAudioDuration
        )
      );

      const adjustedDuration = clampedEndTimeWithinAudio - clampedStartTimeWithinAudio;
      const adjustedTimelineEndTime = newStartTime + adjustedDuration;

      const requestBody = {
        audioSegmentId,
        timelineStartTime: roundToThreeDecimals(newStartTime), // Round
        timelineEndTime: roundToThreeDecimals(adjustedTimelineEndTime), // Round
        layer: newLayer,
        startTime: roundToThreeDecimals(clampedStartTimeWithinAudio), // Round
        endTime: roundToThreeDecimals(clampedEndTimeWithinAudio), // Round
        ...(item.volume !== undefined && { volume: item.volume })
      };

      const response = await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-audio`,
        requestBody,
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const updatedItem = {
        ...item,
        startTime: roundToThreeDecimals(newStartTime), // Round
        duration: adjustedDuration,
        timelineStartTime: roundToThreeDecimals(newStartTime), // Round
        timelineEndTime: roundToThreeDecimals(adjustedTimelineEndTime), // Round
        startTimeWithinAudio: roundToThreeDecimals(clampedStartTimeWithinAudio), // Round
        endTimeWithinAudio: roundToThreeDecimals(clampedEndTimeWithinAudio), // Round
      };
      const layerIndex = Math.abs(newLayer) - 1;
      setAudioLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[layerIndex] = newLayers[layerIndex].map((i) => (i.id === audioSegmentId ? updatedItem : i));
        return newLayers;
      });

      console.log(
        `Updated audio segment ${audioSegmentId} to start at ${requestBody.timelineStartTime}s, end at ${requestBody.timelineEndTime}s, layer ${newLayer}, startTimeWithinAudio at ${requestBody.startTime}s, endTimeWithinAudio at ${requestBody.endTime}s`
      );
    } catch (error) {
      console.error('Error updating audio segment:', error.response?.data || error.message);
      throw error;
    }
  };

  const handleAudioDrop = async (e, draggingItem, dragLayer, mouseX, mouseY, timeScale, dragOffset, snapIndicators) => {
    if (!sessionId || !timelineRef.current) {
      console.error('Session ID or timeline ref missing');
      return undefined;
    }

    const timelineRect = timelineRef.current.getBoundingClientRect();
    const layerHeight = 40;
    const relativeMouseY = mouseY - timelineRect.top;
    const totalVideoLayers = timelineRef.current.querySelectorAll('.timeline-layer').length - audioLayers.length - 2;
    const reversedIndex = Math.floor(relativeMouseY / layerHeight);

    const audioLayerStartIndex = totalVideoLayers + 1;
    const audioLayerEndIndex = totalVideoLayers + 1 + audioLayers.length;

    let targetLayerIndex;
    if (reversedIndex < audioLayerStartIndex) {
      console.log('Cannot drop audio in video layers or top drop area');
      return undefined;
    } else if (reversedIndex >= audioLayerStartIndex && reversedIndex < audioLayerEndIndex) {
      targetLayerIndex = reversedIndex - audioLayerStartIndex;
    } else {
      targetLayerIndex = audioLayers.length;
    }

    targetLayerIndex = Math.max(0, targetLayerIndex);
    const backendLayer = -(targetLayerIndex + 1);

    let newAudioLayers = audioLayers.map((layer) => [...layer]);

    if (!draggingItem) {
      const dataString = e.dataTransfer.getData('application/json');
      if (dataString) {
        const data = JSON.parse(dataString);
        if (data.type === 'audio') {
          const audio = data.audio;
          let adjustedStartTime = Math.max(0, (mouseX - timelineRect.left) / timeScale);
          while (newAudioLayers.length <= targetLayerIndex) newAudioLayers.push([]);
          const targetLayerAudios = newAudioLayers[targetLayerIndex];
          let hasOverlap = true;

          while (hasOverlap) {
            hasOverlap = targetLayerAudios.some((existing) => {
              const start = existing.startTime;
              const end = start + existing.duration;
              const newEnd = adjustedStartTime + audio.duration;
              return adjustedStartTime < end && newEnd > start;
            });
            if (hasOverlap) {
              const overlapping = targetLayerAudios.find((existing) => {
                const start = existing.startTime;
                const end = start + existing.duration;
                const newEnd = adjustedStartTime + audio.duration;
                return adjustedStartTime < end && newEnd > start;
              });
              adjustedStartTime = overlapping.startTime + overlapping.duration;
            }
          }

          console.log('Dropping audio with fileName:', audio.fileName);
          await axios.post(
            `${API_BASE_URL}/projects/${projectId}/add-project-audio-to-timeline`,
            {
              audioFileName: audio.fileName,
              layer: backendLayer,
              timelineStartTime: roundToThreeDecimals(adjustedStartTime), // Round
              timelineEndTime: roundToThreeDecimals(adjustedStartTime + audio.duration), // Round
              startTime: roundToThreeDecimals(0), // Round
              endTime: roundToThreeDecimals(audio.duration), // Round
            },
            {
              params: { sessionId },
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            }
          );
          await loadProjectTimeline();
          return undefined;
        }
      }
      return undefined;
    }

    if (draggingItem.type !== 'audio') return undefined;

    const newStartTime = snapIndicators.length > 0
      ? snapIndicators[0].time - (snapIndicators[0].edge === 'end' ? draggingItem.duration : 0)
      : Math.max(0, (mouseX - timelineRect.left) / timeScale - dragOffset);

    console.log('Calculated newStartTime:', newStartTime);

    while (newAudioLayers.length <= targetLayerIndex) newAudioLayers.push([]);

    const hasOverlap = newAudioLayers[targetLayerIndex].some((audio) => {
      if (audio.id === draggingItem.id) return false;
      const start = audio.startTime;
      const end = start + audio.duration;
      const newEnd = newStartTime + draggingItem.duration;
      return newStartTime < end && newEnd > start;
    });

    if (hasOverlap) {
      console.log('Overlap detected. Cannot move audio here.');
      return undefined;
    }

    const sourceLayerIndex = draggingItem.layer ? Math.abs(draggingItem.layer) - 1 : -1;
    const isSameLayer = sourceLayerIndex === targetLayerIndex;

    const updatedItem = {
      ...draggingItem,
      startTime: roundToThreeDecimals(newStartTime), // Round
      layer: backendLayer,
      timelineStartTime: roundToThreeDecimals(newStartTime), // Round
      timelineEndTime: roundToThreeDecimals(newStartTime + draggingItem.duration), // Round
      startTimeWithinAudio: roundToThreeDecimals(draggingItem.startTimeWithinAudio), // Round
      endTimeWithinAudio: roundToThreeDecimals(draggingItem.endTimeWithinAudio), // Round
    };

    if (isSameLayer) {
      const layer = newAudioLayers[targetLayerIndex];
      const itemIndex = layer.findIndex((a) => a.id === draggingItem.id);
      layer[itemIndex] = updatedItem;
    } else {
      if (sourceLayerIndex !== -1) {
        newAudioLayers[sourceLayerIndex] = newAudioLayers[sourceLayerIndex].filter((a) => a.id !== draggingItem.id);
      }
      newAudioLayers[targetLayerIndex].push(updatedItem);
    }

    setAudioLayers(newAudioLayers);
    saveHistory([], newAudioLayers);
    autoSave([], newAudioLayers);
    await updateAudioSegment(
      draggingItem.id,
      roundToThreeDecimals(newStartTime), // Round
      backendLayer,
      draggingItem.duration,
      roundToThreeDecimals(updatedItem.startTimeWithinAudio), // Round
      roundToThreeDecimals(updatedItem.endTimeWithinAudio), // Round
      updatedItem
    );

    return updatedItem;
  };

  const handleAudioSplit = async (item, clickTime, layerIndex) => {
    const splitTime = clickTime - item.startTime;
    if (splitTime <= 0.1 || splitTime >= item.duration - 0.1) return;

    const firstPartDuration = splitTime;
    const secondPartDuration = item.duration - splitTime;
    let newAudioLayers = [...audioLayers];
    const layer = newAudioLayers[layerIndex];
    const itemIndex = layer.findIndex((i) => i.id === item.id);

    const startWithinAudio = item.startTimeWithinAudio || 0;
    const firstPart = {
      ...item,
      duration: firstPartDuration,
      timelineStartTime: roundToThreeDecimals(item.startTime), // Round
      timelineEndTime: roundToThreeDecimals(item.startTime + firstPartDuration), // Round
      startTime: roundToThreeDecimals(item.startTime), // Round
      endTimeWithinAudio: roundToThreeDecimals(startWithinAudio + firstPartDuration), // Round
    };
    layer[itemIndex] = firstPart;

    const secondPart = {
      ...item,
      id: `${item.id}-split-${Date.now()}`,
      startTime: roundToThreeDecimals(item.startTime + splitTime), // Round
      timelineStartTime: roundToThreeDecimals(item.startTime + splitTime), // Round
      duration: secondPartDuration,
      timelineEndTime: roundToThreeDecimals(item.startTime + item.duration), // Round
      startTimeWithinAudio: roundToThreeDecimals(startWithinAudio + firstPartDuration), // Round
      endTimeWithinAudio: roundToThreeDecimals(startWithinAudio + item.duration), // Round
    };
    layer.push(secondPart);

    newAudioLayers[layerIndex] = layer;
    setAudioLayers(newAudioLayers);
    saveHistory([], newAudioLayers);

    await updateAudioSegment(
      item.id,
      roundToThreeDecimals(item.startTime), // Round
      item.layer,
      firstPartDuration,
      roundToThreeDecimals(firstPart.startTimeWithinAudio), // Round
      roundToThreeDecimals(firstPart.endTimeWithinAudio), // Round
      firstPart
    );

    const audioFileNames = [
      item.fileName,
      item.fileName.split('/').pop()
    ];
    console.log('Original item.fileName:', item.fileName);
    console.log('Trying audioFileNames for second part:', audioFileNames);

    let success = false;
    let lastError = null;
    for (const audioFileName of audioFileNames) {
      try {
        const response = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/add-project-audio-to-timeline`,
          {
            audioFileName,
            layer: item.layer,
            timelineStartTime: roundToThreeDecimals(secondPart.startTime), // Round
            timelineEndTime: roundToThreeDecimals(secondPart.timelineEndTime), // Round
            startTime: roundToThreeDecimals(secondPart.startTimeWithinAudio), // Round
            endTime: roundToThreeDecimals(secondPart.endTimeWithinAudio), // Round
          },
          {
            params: { sessionId },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }
        );
        console.log('Successfully added split audio to timeline:', response.data);
        success = true;
        break;
      } catch (error) {
        console.error(`Error adding split audio with fileName ${audioFileName}:`, error.response?.data || error.message);
        lastError = error;
      }
    }

    if (!success) {
      console.error('Failed to add second segment after trying all fileNames');
      newAudioLayers = [...audioLayers];
      newAudioLayers[layerIndex] = audioLayers[layerIndex].map((a) =>
        a.id === item.id ? { ...item } : a
      );
      setAudioLayers(newAudioLayers);
      throw new Error(`Failed to add split audio: ${lastError.response?.data?.message || lastError.message}`);
    }

    autoSave([], newAudioLayers);
    await loadProjectTimeline();
  };

  const handleExtractedAudioSplit = async (item, clickTime, layerIndex) => {
    console.log('handleExtractedAudioSplit: item=', item, 'clickTime=', clickTime, 'layerIndex=', layerIndex);
    const splitTime = clickTime - item.startTime;
    console.log('Calculated splitTime=', splitTime, 'item.startTime=', item.startTime, 'item.duration=', item.duration);
    if (splitTime <= 0.1 || splitTime >= item.duration - 0.1) {
      console.log('Split time too close to start or end: splitTime=', splitTime);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token missing');
      }

      let projectData, extractedAudios;
      try {
        const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { sessionId },
        });
        projectData = response.data;
        extractedAudios = projectData.extractedAudioJson
          ? typeof projectData.extractedAudioJson === 'string'
            ? JSON.parse(projectData.extractedAudioJson)
            : projectData.extractedAudioJson
          : [];
        console.log('Extracted audios:', extractedAudios);
      } catch (error) {
        console.error('Error fetching project:', error.response?.data || error.message);
        throw new Error('Failed to fetch project data');
      }

      const basename = item.fileName.split('/').pop();
      const audioEntry = extractedAudios.find((a) =>
        a.audioFileName === item.fileName ||
        a.audioFileName === basename ||
        a.audioPath === item.fileName ||
        a.audioPath === `audio/projects/${projectId}/extracted/${basename}`
      );
      if (!audioEntry) {
        console.error('No matching extracted audio found for fileName:', item.fileName, 'basename:', basename);
        throw new Error('Extracted audio not found in project');
      }
      const audioFileName = audioEntry.audioFileName;
      console.log('Using audioFileName:', audioFileName);

      const firstPartDuration = splitTime;
      const secondPartDuration = item.duration - splitTime;
      const startWithinAudio = item.startTimeWithinAudio || 0;
      console.log('firstPartDuration=', firstPartDuration, 'secondPartDuration=', secondPartDuration, 'startWithinAudio=', startWithinAudio);

      const firstPart = {
        ...item,
        duration: firstPartDuration,
        timelineStartTime: roundToThreeDecimals(item.startTime), // Round
        timelineEndTime: roundToThreeDecimals(item.startTime + firstPartDuration), // Round
        startTime: roundToThreeDecimals(item.startTime), // Round
        endTimeWithinAudio: roundToThreeDecimals(startWithinAudio + firstPartDuration), // Round
      };
      const secondPartId = `${item.id}-split-${Date.now()}`;
      const secondPart = {
        ...item,
        id: secondPartId,
        startTime: roundToThreeDecimals(item.startTime + splitTime), // Round
        timelineStartTime: roundToThreeDecimals(item.startTime + splitTime), // Round
        duration: secondPartDuration,
        timelineEndTime: roundToThreeDecimals(item.startTime + item.duration), // Round
        startTimeWithinAudio: roundToThreeDecimals(startWithinAudio + firstPartDuration), // Round
        endTimeWithinAudio: roundToThreeDecimals(startWithinAudio + item.duration), // Round
        fileName: audioFileName,
      };
      console.log('firstPart=', firstPart);
      console.log('secondPart=', secondPart);

      console.log('Calling updateAudioSegment for firstPart:', firstPart.id);
      await updateAudioSegment(
        item.id,
        roundToThreeDecimals(item.startTime), // Round
        item.layer,
        firstPartDuration,
        roundToThreeDecimals(firstPart.startTimeWithinAudio), // Round
        roundToThreeDecimals(firstPart.endTimeWithinAudio), // Round
        firstPart
      );

      try {
        const response = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/add-project-audio-to-timeline`,
          {
            audioFileName: audioFileName,
            layer: item.layer,
            timelineStartTime: roundToThreeDecimals(secondPart.startTime), // Round
            timelineEndTime: roundToThreeDecimals(secondPart.timelineEndTime), // Round
            startTime: roundToThreeDecimals(secondPart.startTimeWithinAudio), // Round
            endTime: roundToThreeDecimals(secondPart.endTimeWithinAudio), // Round
            volume: item.volume || 1.0,
          },
          {
            params: { sessionId },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('Successfully added second segment:', response.data);
      } catch (error) {
        console.error('Failed to add second segment:', error.response?.data || error.message);
        throw new Error('Failed to add second audio segment');
      }

      let newAudioLayers = [...audioLayers];
      const layer = [...newAudioLayers[layerIndex]];
      const itemIndex = layer.findIndex((i) => i.id === item.id);
      layer[itemIndex] = firstPart;
      layer.push(secondPart);
      newAudioLayers[layerIndex] = layer;
      setAudioLayers(newAudioLayers);

      saveHistory([], newAudioLayers);
      autoSave([], newAudioLayers);

      await loadProjectTimeline();

      console.log('Successfully split extracted audio');
    } catch (error) {
      console.error('Error splitting extracted audio:', error.message);
      setAudioLayers([...audioLayers]);
      alert('Failed to split audio. Please try again.');
    }
  };

  return { handleAudioDrop, updateAudioSegment, handleAudioSplit, handleExtractedAudioSplit };
};

export default AudioSegmentHandler;