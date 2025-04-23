import React from 'react';
import axios from 'axios';

const VideoSegmentHandler = ({
  projectId,
  sessionId,
  videoLayers,
  setVideoLayers,
  audioLayers,
  setAudioLayers,
  addVideoToTimeline,
  saveHistory,
  autoSave,
  loadProjectTimeline,
  API_BASE_URL,
  timelineRef,
  roundToThreeDecimals, // Destructure roundToThreeDecimals
}) => {
  const updateSegmentPosition = async (
    segmentId,
    newStartTime,
    newLayer,
    newDuration,
    startTimeWithinVideo,
    endTimeWithinVideo,
    layers = videoLayers
  ) => {
    if (!projectId || !sessionId) return;
    try {
      const token = localStorage.getItem('token');
      const layer = layers[newLayer];
      if (!layer) {
        console.error(`Layer ${newLayer} does not exist in provided layers`, layers);
        return;
      }
      const item = layer.find((i) => i.id === segmentId);
      if (!item) {
        console.error(`Segment ${segmentId} not found in layer ${newLayer}`);
        return;
      }
      const timelineEndTime = newStartTime + newDuration;
      const requestBody = {
        segmentId,
        timelineStartTime: roundToThreeDecimals(newStartTime), // Round
        timelineEndTime: roundToThreeDecimals(timelineEndTime), // Round
        layer: newLayer,
        startTime: startTimeWithinVideo !== undefined
          ? roundToThreeDecimals(startTimeWithinVideo) // Round
          : roundToThreeDecimals(item.startTimeWithinVideo || 0), // Round
        endTime: endTimeWithinVideo !== undefined
          ? roundToThreeDecimals(endTimeWithinVideo) // Round
          : roundToThreeDecimals(item.endTimeWithinVideo || newDuration), // Round
      };
      await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-segment`,
        requestBody,
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log(
        `Updated segment ${segmentId} to start at ${requestBody.timelineStartTime}s, end at ${requestBody.timelineEndTime}s, layer ${newLayer}, startTimeWithinVideo: ${requestBody.startTime}, endTimeWithinVideo: ${requestBody.endTime}`
      );
    } catch (error) {
      console.error('Error updating segment position:', error);
    }
  };

  const handleVideoDrop = async (e, draggingItem, dragLayer, mouseX, mouseY, timeScale, dragOffset, snapIndicators) => {
    if (!sessionId || draggingItem?.type === 'text' || draggingItem?.type === 'audio') return;

    if (!timelineRef.current) {
      console.error('Timeline ref is not available');
      return;
    }

    const timelineRect = timelineRef.current.getBoundingClientRect();
    const layerHeight = 40;
    const relativeMouseY = mouseY - timelineRect.top;

    const timelineLayers = timelineRef.current.querySelectorAll('.timeline-layer');
    if (!timelineLayers) {
      console.error('Timeline layers not found');
      return;
    }

    const totalVideoLayers = videoLayers.length;
    const reversedIndex = Math.floor(relativeMouseY / layerHeight);
    let targetLayer;

    if (reversedIndex <= totalVideoLayers) {
      targetLayer = totalVideoLayers - reversedIndex;
    } else {
      console.log('Cannot drop video in audio layers');
      return;
    }

    targetLayer = Math.max(0, reversedIndex < 0 ? totalVideoLayers : targetLayer);

    if (!draggingItem) {
      const dataString = e.dataTransfer.getData('application/json');
      if (dataString) {
        const data = JSON.parse(dataString);
        if (data.type === 'media') {
          const video = data.video;
          let dropTimePosition = (mouseX - timelineRect.left) / timeScale;
          let newVideoLayers = [...videoLayers];
          while (newVideoLayers.length <= targetLayer) newVideoLayers.push([]);
          const targetLayerVideos = newVideoLayers[targetLayer];
          let adjustedStartTime = Math.max(0, dropTimePosition);
          let hasOverlap = true;
          while (hasOverlap) {
            hasOverlap = targetLayerVideos.some((existingVideo) => {
              const existingStart = existingVideo.startTime;
              const existingEnd = existingStart + existingVideo.duration;
              const newVideoEnd = adjustedStartTime + video.duration;
              return adjustedStartTime < existingEnd && newVideoEnd > existingStart;
            });
            if (hasOverlap) {
              const overlappingVideo = targetLayerVideos.find((existingVideo) => {
                const existingStart = existingVideo.startTime;
                const existingEnd = existingVideo.duration;
                const newVideoEnd = adjustedStartTime + video.duration;
                return adjustedStartTime < existingEnd && newVideoEnd > existingStart;
              });
              if (overlappingVideo) {
                adjustedStartTime = overlappingVideo.startTime + overlappingVideo.duration;
              } else break;
            }
          }

          // Call addVideoToTimeline with rounded startTime
          const newSegment = await addVideoToTimeline(
            video.filePath,
            targetLayer,
            roundToThreeDecimals(adjustedStartTime), // Round
            null
          );

          // Update videoLayers with the new segment, rounding time properties
          newVideoLayers[targetLayer].push({
            ...newSegment,
            startTime: roundToThreeDecimals(newSegment.startTime), // Round
            timelineStartTime: roundToThreeDecimals(newSegment.timelineStartTime), // Round
            timelineEndTime: roundToThreeDecimals(newSegment.timelineEndTime), // Round
            startTimeWithinVideo: roundToThreeDecimals(newSegment.startTimeWithinVideo || 0), // Round
            endTimeWithinVideo: roundToThreeDecimals(newSegment.endTimeWithinVideo || newSegment.duration), // Round
          });
          setVideoLayers(newVideoLayers);
          saveHistory(newVideoLayers, audioLayers);
          autoSave(newVideoLayers, audioLayers);
        }
      }
      return;
    }

    if (draggingItem.type !== 'video') return;

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
      return;
    }

    if (actualLayerIndex === dragLayer) {
      newVideoLayers[actualLayerIndex] = newVideoLayers[actualLayerIndex].filter((v) => v.id !== draggingItem.id);
    } else {
      newVideoLayers[dragLayer] = newVideoLayers[dragLayer].filter((v) => v.id !== draggingItem.id);
    }
    const updatedItem = {
      ...draggingItem,
      startTime: roundToThreeDecimals(adjustedStartTime), // Round
      layer: actualLayerIndex,
      timelineStartTime: roundToThreeDecimals(adjustedStartTime), // Round
      timelineEndTime: roundToThreeDecimals(adjustedStartTime + draggingItem.duration), // Round
      startTimeWithinVideo: roundToThreeDecimals(draggingItem.startTimeWithinVideo), // Round
      endTimeWithinVideo: roundToThreeDecimals(draggingItem.endTimeWithinVideo), // Round
    };
    newVideoLayers[actualLayerIndex].push(updatedItem);

    setVideoLayers(newVideoLayers);
    saveHistory(newVideoLayers, []);
    autoSave(newVideoLayers, []);

    await updateSegmentPosition(
      draggingItem.id,
      roundToThreeDecimals(adjustedStartTime), // Round
      actualLayerIndex,
      draggingItem.duration,
      roundToThreeDecimals(updatedItem.startTimeWithinVideo), // Round
      roundToThreeDecimals(updatedItem.endTimeWithinVideo), // Round
      newVideoLayers
    );
  };

  const handleVideoSplit = async (item, clickTime, layerIndex) => {
    const splitTime = clickTime - item.startTime;
    if (splitTime <= 0.1 || splitTime >= item.duration - 0.1) return;

    try {
      const token = localStorage.getItem('token');

      // Step 1: Fetch the original VideoSegment and its AudioSegment
      const response = await axios.get(
        `${API_BASE_URL}/projects/${projectId}/get-segment`,
        {
          params: { sessionId, segmentId: item.id },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const { videoSegment, audioSegment } = response.data;
      if (!videoSegment) {
        throw new Error(`Video segment ${item.id} not found`);
      }

      // Preserve original audio timings, rounding time properties
      const originalAudioTimings = audioSegment
        ? {
            id: audioSegment.id,
            timelineStartTime: roundToThreeDecimals(audioSegment.timelineStartTime), // Round
            timelineEndTime: roundToThreeDecimals(audioSegment.timelineEndTime), // Round
            startTime: roundToThreeDecimals(audioSegment.startTime), // Round
            endTime: roundToThreeDecimals(audioSegment.endTime), // Round
            layer: audioSegment.layer,
            audioPath: audioSegment.audioPath || audioSegment.audioFileName,
            displayName: audioSegment.audioPath
              ? audioSegment.audioPath.split('/').pop()
              : audioSegment.audioFileName,
          }
        : null;

      // Step 2: Calculate split parameters
      const firstPartDuration = splitTime;
      const secondPartDuration = item.duration - splitTime;
      let newVideoLayers = [...videoLayers];
      const layer = newVideoLayers[layerIndex];
      const itemIndex = layer.findIndex((i) => i.id === item.id);

      const originalVideoStartTime = roundToThreeDecimals(item.startTimeWithinVideo || 0); // Round
      const originalVideoEndTime = roundToThreeDecimals(item.endTimeWithinVideo || item.duration); // Round

      // Update first part (video segment)
      const firstPart = {
        ...item,
        duration: firstPartDuration,
        timelineEndTime: roundToThreeDecimals(item.startTime + firstPartDuration), // Round
        startTime: roundToThreeDecimals(item.startTime), // Round
        endTimeWithinVideo: roundToThreeDecimals(originalVideoStartTime + firstPartDuration), // Round
        audioSegmentId: audioSegment ? audioSegment.id : null,
      };
      layer[itemIndex] = firstPart;

      // Create second part (video segment)
      const secondPart = {
        ...item,
        id: `${item.id}-split-${Date.now()}`, // Temporary ID
        startTime: roundToThreeDecimals(item.startTime + splitTime), // Round
        duration: secondPartDuration,
        timelineStartTime: roundToThreeDecimals(item.startTime + splitTime), // Round
        timelineEndTime: roundToThreeDecimals(item.startTime + splitTime + secondPartDuration), // Round
        startTimeWithinVideo: roundToThreeDecimals(originalVideoStartTime + firstPartDuration), // Round
        endTimeWithinVideo: originalVideoEndTime,
        audioSegmentId: audioSegment ? audioSegment.id : null,
      };
      layer.push(secondPart);

      // Update video layers
      newVideoLayers[layerIndex] = layer;
      setVideoLayers(newVideoLayers);

      // Step 3: Update first video segment
      await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-segment`,
        {
          segmentId: item.id,
          timelineStartTime: roundToThreeDecimals(item.startTime), // Round
          timelineEndTime: roundToThreeDecimals(item.startTime + firstPartDuration), // Round
          layer: layerIndex,
          startTime: originalVideoStartTime,
          endTime: roundToThreeDecimals(originalVideoStartTime + firstPartDuration), // Round
        },
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Step 4: Restore original AudioSegment timings if it exists
      if (audioSegment && originalAudioTimings) {
        await axios.put(
          `${API_BASE_URL}/projects/${projectId}/update-audio`,
          {
            audioSegmentId: audioSegment.id,
            timelineStartTime: originalAudioTimings.timelineStartTime,
            timelineEndTime: originalAudioTimings.timelineEndTime,
            layer: originalAudioTimings.layer,
            startTime: originalAudioTimings.startTime,
            endTime: originalAudioTimings.endTime,
          },
          {
            params: { sessionId },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log(`Restored audio segment ${audioSegment.id} to original timings`);
      }

      // Step 5: Add second video segment without creating a new AudioSegment
      const addResponse = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-to-timeline`,
        {
          videoPath: item.filePath || videoSegment.filename,
          layer: layerIndex,
          timelineStartTime: roundToThreeDecimals(secondPart.startTime), // Round
          timelineEndTime: roundToThreeDecimals(secondPart.startTime + secondPartDuration), // Round
          startTime: roundToThreeDecimals(secondPart.startTimeWithinVideo), // Round
          endTime: roundToThreeDecimals(secondPart.endTimeWithinVideo), // Round
          createAudioSegment: false,
        },
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const { videoSegmentId, audioSegmentId } = addResponse.data;

      // Step 6: Fetch the newly created video segment to ensure correct data
      const newSegmentResponse = await axios.get(
        `${API_BASE_URL}/projects/${projectId}/get-segment`,
        {
          params: { sessionId, segmentId: videoSegmentId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const newVideoSegment = newSegmentResponse.data.videoSegment;
      if (!newVideoSegment) {
        throw new Error(`Newly created video segment ${videoSegmentId} not found`);
      }

      // Update second part with backend videoSegmentId and verified data
      newVideoLayers = [...newVideoLayers];
      newVideoLayers[layerIndex] = newVideoLayers[layerIndex].map((v) =>
        v.id === secondPart.id
          ? {
              ...v,
              id: videoSegmentId,
              startTime: roundToThreeDecimals(newVideoSegment.timelineStartTime), // Round
              duration: newVideoSegment.timelineEndTime - newVideoSegment.timelineStartTime,
              timelineStartTime: roundToThreeDecimals(newVideoSegment.timelineStartTime), // Round
              timelineEndTime: roundToThreeDecimals(newVideoSegment.timelineEndTime), // Round
              startTimeWithinVideo: roundToThreeDecimals(newVideoSegment.startTime), // Round
              endTimeWithinVideo: roundToThreeDecimals(newVideoSegment.endTime), // Round
              audioSegmentId: audioSegment ? audioSegment.id : null,
              filePath: newVideoSegment.filename || item.filePath,
            }
          : v
      );
      setVideoLayers(newVideoLayers);

      // Step 7: Rebuild audioLayers based on all video segments
      let newAudioLayers = [...audioLayers];
      const validAudioSegments = new Map();

      // Collect all valid audio segments from video segments
      newVideoLayers.forEach((layer) => {
        layer.forEach((video) => {
          if (video.audioSegmentId) {
            validAudioSegments.set(video.audioSegmentId, {
              videoLayer: video.layer,
              videoStartTime: video.startTime,
              videoDuration: video.duration,
            });
          }
        });
      });

      // Rebuild audioLayers
      if (audioSegment && originalAudioTimings) {
        const audioLayerIndex = Math.abs(originalAudioTimings.layer) - 1;
        while (newAudioLayers.length <= audioLayerIndex) newAudioLayers.push([]);
        newAudioLayers[audioLayerIndex] = newAudioLayers[audioLayerIndex].filter((a) => a.id !== audioSegment.id);
        newAudioLayers[audioLayerIndex].push({
          id: audioSegment.id,
          type: 'audio',
          fileName: originalAudioTimings.audioPath,
          startTime: originalAudioTimings.timelineStartTime,
          duration: originalAudioTimings.timelineEndTime - originalAudioTimings.timelineStartTime,
          timelineStartTime: originalAudioTimings.timelineStartTime,
          timelineEndTime: originalAudioTimings.timelineEndTime,
          startTimeWithinAudio: originalAudioTimings.startTime,
          endTimeWithinAudio: originalAudioTimings.endTime,
          layer: originalAudioTimings.layer,
          displayName: originalAudioTimings.displayName,
          waveformImage: '/images/audio.jpeg',
        });
      }

      // Filter audioLayers to only include audio segments linked to video segments
      newAudioLayers = newAudioLayers.map((layer) =>
        layer.filter((a) => validAudioSegments.has(a.id))
      );

      setAudioLayers(newAudioLayers);
      console.log('Updated audioLayers:', newAudioLayers);

      // Step 8: Save history and auto-save
      saveHistory(newVideoLayers, newAudioLayers);
      autoSave(newVideoLayers, newAudioLayers);

      // Step 9: Reload timeline to ensure consistency
      await loadProjectTimeline();

      // Step 10: Final auto-save to ensure all changes are persisted
      autoSave(newVideoLayers, newAudioLayers);
    } catch (error) {
      console.error('Error splitting video:', error.response?.data || error.message);
    }
  };

  const fetchVideoDuration = async (filePath) => {
    try {
      const token = localStorage.getItem('token');
      const filename = filePath.split('/').pop();
      const response = await axios.get(`${API_BASE_URL}/videos/duration/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data; // Duration is not rounded as it is not one of the specified properties
    } catch (error) {
      console.error('Error fetching video duration:', error);
      return null;
    }
  };

  return { handleVideoDrop, updateSegmentPosition, handleVideoSplit, fetchVideoDuration };
};

export default VideoSegmentHandler;