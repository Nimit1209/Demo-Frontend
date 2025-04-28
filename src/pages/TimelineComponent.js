import React, { useRef, useEffect, useState, useCallback } from 'react';
import '../CSS/Timeline.css';
import axios from 'axios';
import TimelineControls from './TimelineControls';
import TimelineRuler from './TimelineRuler';
import TimelineLayer from './TimelineLayer';
import SnapIndicators from './SnapIndicators';
import DraggingGhost from './DraggingGhost';
import VideoSegmentHandler from './VideoSegmentHandler';
import TextSegmentHandler from './TextSegmentHandler';
import ImageSegmentHandler from './ImageSegmentHandler';
import AudioSegmentHandler from './AudioSegmentHandler';
import GeneralSegmentHandler from './GeneralSegmentHandler';

const TimelineComponent = ({
  videos,
  audios,
  sessionId,
  projectId,
  totalDuration,
  setTotalDuration,
  onVideoSelect,
  canvasDimensions,
  addVideoToTimeline,
  onTimeUpdate,
  onSegmentSelect,
  videoLayers,
  audioLayers,
  setVideoLayers,
  setAudioLayers,
  thumbnailsGenerated,
  openTextTool,
  timeScale,
  setTimeScale,
  setPlayheadFromParent,
  transitions,
  setTransitions,
  handleTransitionDrop,
  onTransitionSelect,
  isPlaying,
  setIsPlaying,
  fps = 25,
  saveHistory,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  currentTime, // Added prop to receive currentTime from ProjectEditor
}) => {
  // Removed local playhead and currentTime states
  const [timelineVideos, setTimelineVideos] = useState([]);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragLayer, setDragLayer] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [snapIndicators, setSnapIndicators] = useState([]);
  const [resizingItem, setResizingItem] = useState(null);
  const [resizeEdge, setResizeEdge] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isSplitMode, setIsSplitMode] = useState(false);

  const SNAP_THRESHOLD = 0.1;
  const API_BASE_URL = 'http://localhost:8080';
  const MIN_TIME_SCALE = 0.1;
  const MAX_TIME_SCALE = 200;

  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const playIntervalRef = useRef(null);

  // Removed localIsPlaying state and sync logic
  const autoSave = useCallback(
    (newVideoLayers, newAudioLayers) => {
      const autoSaveTimeout = setTimeout(async () => {
        if (!projectId || !sessionId) return;
        try {
          setIsSaving(true);
          const token = localStorage.getItem('token');
          const segments = flattenLayersToSegments([...newVideoLayers, ...newAudioLayers]);
          await axios.post(
            `${API_BASE_URL}/projects/${projectId}/save`,
            { timelineState: { segments } },
            {
              params: { sessionId },
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          console.log('Project auto-saved');
        } catch (error) {
          console.error('Error during auto-save:', error);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
      return () => clearTimeout(autoSaveTimeout);
    },
    [projectId, sessionId]
  );

  // Modified to use currentTime prop instead of local playhead
  useEffect(() => {
    if (setPlayheadFromParent) {
      setPlayheadFromParent((newTime, shouldUpdateParent = true) => {
        if (shouldUpdateParent && onTimeUpdate) {
          onTimeUpdate(newTime);
        }
      });
    }
  }, [setPlayheadFromParent, onTimeUpdate]);

  const generateVideoThumbnail = async (videoPath) => {
    const fullVideoPath = `${API_BASE_URL}/videos/${encodeURIComponent(videoPath.split('/').pop())}`;
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = fullVideoPath;
      video.muted = true;
      video.preload = 'metadata';

      video.onloadeddata = () => {
        video.currentTime = 1;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 120;
        const maxHeight = 80;
        let width = video.videoWidth;
        let height = video.videoHeight;

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
        ctx.drawImage(video, 0, 0, width, height);
        const thumbnail = canvas.toDataURL('image/jpeg');
        resolve(thumbnail);
      };

      video.onerror = () => {
        console.error(`Failed to load video for thumbnail: ${fullVideoPath}`);
        resolve(null);
      };
    });
  };

  const generateImageThumbnail = async (imagePath, isElement = false) => {
    const filename = imagePath.split('/').pop();
    const fullImagePath = `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(filename)}`;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = fullImagePath;
      img.onload = () => {
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
        resolve(thumbnail);
      };
      img.onerror = () => {
        console.error(`Failed to load image for thumbnail: ${fullImagePath}`);
        resolve(null);
      };
    });
  };

  const loadProjectTimeline = async () => {
      if (!projectId || !sessionId) return;
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const project = response.data;
        console.log('Backend timelineState:', JSON.stringify(project.timelineState, null, 2));

        if (project && project.timelineState) {
          const timelineState = typeof project.timelineState === 'string' ? JSON.parse(project.timelineState) : project.timelineState;
          const newVideoLayers = [[], [], []];
          const newAudioLayers = [[], [], []];

          // Map filters to segments
          const filterMap = {};
          (timelineState.filters || []).forEach((filter) => {
            if (!filterMap[filter.segmentId]) {
              filterMap[filter.segmentId] = [];
            }
            filterMap[filter.segmentId].push(filter);
          });

          if (timelineState.segments && timelineState.segments.length > 0) {
            for (const segment of timelineState.segments) {
              const layerIndex = segment.layer || 0;
              if (layerIndex < 0) continue;
              if (segment.sourceVideoPath) {
                while (newVideoLayers.length <= layerIndex) newVideoLayers.push([]);
                let videoFileName = segment.sourceVideoPath;
                const normalizedVideoPath = videoFileName.startsWith('videos/') ? videoFileName.substring(7) : videoFileName;
                let video = videos.find((v) => {
                  const vPath = v.filePath || v.filename;
                  const normalizedVPath = vPath.startsWith('videos/') ? vPath.substring(7) : vPath;
                  return normalizedVPath === normalizedVideoPath;
                });
                if (video) {
                  const thumbnail = await generateVideoThumbnail(normalizedVideoPath);
                  const filters = filterMap[segment.id] || [];
                  console.log(`Video segment ID ${segment.id}: filters=`, JSON.stringify(filters, null, 2));
                  newVideoLayers[layerIndex].push({
                    ...video,
                    type: 'video',
                    id: segment.id,
                    startTime: segment.timelineStartTime,
                    duration: segment.timelineEndTime - segment.timelineStartTime,
                    layer: layerIndex,
                    filePath: normalizedVideoPath,
                    positionX: segment.positionX ?? 0,
                    positionY: segment.positionY ?? 0,
                    scale: segment.scale ?? 1,
                    startTimeWithinVideo: segment.startTime,
                    endTimeWithinVideo: segment.endTime,
                    thumbnail,
                    keyframes: segment.keyframes || {},
                    filters,
                    cropL: segment.cropL ?? 0, // Add crop values
                    cropR: segment.cropR ?? 0,
                    cropT: segment.cropT ?? 0,
                    cropB: segment.cropB ?? 0,
                    opacity: segment.opacity ?? 1,
                  });
                }
              }
            }
          }

          if (timelineState.imageSegments && timelineState.imageSegments.length > 0) {
            for (const imageSegment of timelineState.imageSegments) {
              const layerIndex = imageSegment.layer || 0;
              if (layerIndex < 0) continue;
              while (newVideoLayers.length <= layerIndex) newVideoLayers.push([]);
              const filename = imageSegment.imagePath.split('/').pop();
              const filePath = `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(filename)}`;
              const thumbnail = await generateImageThumbnail(imageSegment.imagePath, imageSegment.element);
              const filters = filterMap[imageSegment.id] || [];
              console.log(`Image segment ID ${imageSegment.id}: filters=`, JSON.stringify(filters, null, 2));
              newVideoLayers[layerIndex].push({
                id: imageSegment.id,
                type: 'image',
                fileName: filename,
                filePath,
                thumbnail,
                startTime: imageSegment.timelineStartTime,
                duration: imageSegment.timelineEndTime - imageSegment.timelineStartTime,
                layer: layerIndex,
                positionX: imageSegment.positionX || 0,
                positionY: imageSegment.positionY || 0,
                scale: imageSegment.scale || 1,
                opacity: imageSegment.opacity || 1.0,
                width: imageSegment.width,
                height: imageSegment.height,
                effectiveWidth: imageSegment.effectiveWidth,
                effectiveHeight: imageSegment.effectiveHeight,
                maintainAspectRatio: imageSegment.maintainAspectRatio,
                isElement: imageSegment.element !== undefined ? imageSegment.element : false,
                keyframes: imageSegment.keyframes || {},
                filters,
                cropL: imageSegment.cropL ?? 0, // Add crop values
                cropR: imageSegment.cropR ?? 0,
                cropT: imageSegment.cropT ?? 0,
                cropB: imageSegment.cropB ?? 0,
              });
            }
          }

          if (timelineState.textSegments && timelineState.textSegments.length > 0) {
            for (const textSegment of timelineState.textSegments) {
              const layerIndex = textSegment.layer || 0;
              if (layerIndex < 0) continue;
              while (newVideoLayers.length <= layerIndex) newVideoLayers.push([]);
              console.log(`Text segment ID ${textSegment.id}: no filters applied`);
              newVideoLayers[layerIndex].push({
                id: textSegment.id,
                type: 'text',
                text: textSegment.text,
                startTime: textSegment.timelineStartTime || 0,
                duration: (textSegment.timelineEndTime - textSegment.timelineStartTime) || 0,
                layer: layerIndex,
                fontFamily: textSegment.fontFamily || 'Arial',
                scale: textSegment.scale || 1.0,
                fontColor: textSegment.fontColor || '#FFFFFF',
                backgroundColor: textSegment.backgroundColor || 'transparent',
                positionX: textSegment.positionX || 0,
                positionY: textSegment.positionY || 0,
                alignment: textSegment.alignment || 'center',
                backgroundOpacity: textSegment.backgroundOpacity ?? 1.0,
                backgroundBorderWidth: textSegment.backgroundBorderWidth ?? 0,
                backgroundBorderColor: textSegment.backgroundBorderColor || '#000000',
                backgroundPadding: textSegment.backgroundPadding ?? 0,
                backgroundBorderRadius: textSegment.backgroundBorderRadius ?? 0,
                keyframes: textSegment.keyframes || {},
                opacity: textSegment.opacity || 1,
              });
            }
          }

          if (timelineState.audioSegments && timelineState.audioSegments.length > 0) {
            console.log('Processing audioSegments:', timelineState.audioSegments);
            for (const audioSegment of timelineState.audioSegments) {
              const backendLayer = audioSegment.layer || -1;
              const layerIndex = Math.abs(backendLayer) - 1;
              while (newAudioLayers.length <= layerIndex) newAudioLayers.push([]);
              const filename = audioSegment.audioFileName || audioSegment.audioPath.split('/').pop();
              const audioUrl = `${API_BASE_URL}/projects/${projectId}/audio/${encodeURIComponent(filename)}`;
              console.log(`Audio segment ID ${audioSegment.id}: no filters applied`);
              const newSegment = {
                id: audioSegment.id,
                type: 'audio',
                fileName: filename,
                url: audioUrl,
                startTime: audioSegment.timelineStartTime || 0,
                duration: (audioSegment.timelineEndTime - audioSegment.timelineStartTime) || 0,
                timelineStartTime: audioSegment.timelineStartTime || 0,
                timelineEndTime: audioSegment.timelineEndTime || 0,
                layer: backendLayer,
                startTimeWithinAudio: audioSegment.startTime || 0,
                endTimeWithinAudio: audioSegment.endTime || (audioSegment.timelineEndTime - audioSegment.timelineStartTime) || 0,
                displayName: filename,
                waveformImage: '/images/audio.jpeg',
                volume: audioSegment.volume || 1.0,
                keyframes: audioSegment.keyframes || {},
              };
              console.log(`Created audio segment, ${audioSegment.id} with URL: ${audioUrl}`, newSegment);
              newAudioLayers[layerIndex].push(newSegment);
            }
          } else {
            console.warn('No audioSegments found in timelineState');
          }

          // Fetch transitions
          const transitionsResponse = await axios.get(
            `${API_BASE_URL}/projects/${projectId}/transitions`,
            { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
          );

          console.log('Loaded videoLayers:', JSON.stringify(newVideoLayers, null, 2));
          console.log('Loaded audioLayers:', JSON.stringify(newAudioLayers, null, 2));
          setVideoLayers(newVideoLayers);
          setAudioLayers(newAudioLayers);
          setTransitions(transitionsResponse.data || []);
          let maxEndTime = 0;
          [...newVideoLayers, ...newAudioLayers].forEach((layer) => {
            layer.forEach((item) => {
              const endTime = item.startTime + item.duration;
              if (endTime > maxEndTime) maxEndTime = endTime;
            });
          });
          setTotalDuration(maxEndTime > 0 ? maxEndTime : 0);

          // Force state refresh and notify parent
          console.log('Setting videoLayers and triggering state refresh');
          if (onSegmentSelect) {
            console.log('Calling onSegmentSelect with null to refresh state');
            onSegmentSelect(null); // Trigger state refresh
          }
        }
      } catch (error) {
        console.error('Error loading project timeline:', error);
      }
    };

  useEffect(() => {
    if (projectId && sessionId && videos.length > 0 && thumbnailsGenerated) {
      loadProjectTimeline().then(() => {
        setVideoLayers((prev) => [...prev]);
        if (onSegmentSelect) {
          onSegmentSelect(null);
        }
      });
    }
  }, [projectId, sessionId, videos, thumbnailsGenerated]);

  const roundToThreeDecimals = (value) => {
    if (value == null || isNaN(value)) return 0;
    return Math.round(value * 1000) / 1000;
  };

  const videoHandler = VideoSegmentHandler({
    projectId,
    sessionId,
    videoLayers,
    setVideoLayers,
    addVideoToTimeline,
    saveHistory,
    autoSave,
    loadProjectTimeline,
    API_BASE_URL,
    timelineRef,
    roundToThreeDecimals,
  });

  const textHandler = TextSegmentHandler({
    projectId,
    sessionId,
    videoLayers,
    setVideoLayers,
    saveHistory,
    autoSave,
    loadProjectTimeline,
    API_BASE_URL,
    timelineRef,
    roundToThreeDecimals
  });

  const imageHandler = ImageSegmentHandler({
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
    roundToThreeDecimals
  });

  const audioHandler = AudioSegmentHandler({
    projectId,
    sessionId,
    audioLayers,
    setAudioLayers,
    saveHistory,
    autoSave,
    loadProjectTimeline,
    API_BASE_URL,
    timelineRef,
    roundToThreeDecimals
  });

  const generalHandler = GeneralSegmentHandler({
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
    updateSegmentPosition: videoHandler.updateSegmentPosition,
    updateTextSegment: textHandler.updateTextSegment,
    updateImageSegment: imageHandler.updateImageSegment,
    updateAudioSegment: audioHandler.updateAudioSegment,
    fetchVideoDuration: videoHandler.fetchVideoDuration,
    roundToThreeDecimals
  });

  useEffect(() => {
    const calculateDuration = () => {
      let maxDuration = 0;
      [...videoLayers, ...audioLayers].forEach((layer) => {
        layer.forEach((item) => {
          const endTime = item.startTime + item.duration;
          if (endTime > maxDuration) maxDuration = endTime;
        });
      });
      setTotalDuration(maxDuration > 0 ? maxDuration : 0);
    };
    calculateDuration();
  }, [videoLayers, audioLayers, setTotalDuration]);

  const findAdjacentSegments = (timelinePosition, layerIndex, videoLayers) => {
    if (layerIndex < 0 || layerIndex >= videoLayers.length) {
      return { segment: null, start: false, end: false };
    }

    const layer = videoLayers[layerIndex];
    let segment = null;
    let start = false;
    let end = false;
    const SNAP_THRESHOLD = 0.1; // Time in seconds to consider a transition near start/end

    for (const seg of layer) {
      const segmentStart = seg.startTime;
      const segmentEnd = seg.startTime + seg.duration;

      // Check if the drop position is near the start of the segment
      if (Math.abs(timelinePosition - segmentStart) <= SNAP_THRESHOLD) {
        segment = seg;
        start = true;
        break;
      }
      // Check if the drop position is near the end of the segment
      else if (Math.abs(timelinePosition - segmentEnd) <= SNAP_THRESHOLD) {
        segment = seg;
        end = true;
        break;
      }
      // Check if the drop position is within the segment
      else if (timelinePosition > segmentStart && timelinePosition < segmentEnd) {
        segment = seg;
        // Decide whether to apply at start or end based on proximity
        const distToStart = timelinePosition - segmentStart;
        const distToEnd = segmentEnd - timelinePosition;
        if (distToStart < distToEnd) {
          start = true;
        } else {
          end = true;
        }
        break;
      }
    }

    return { segment, start, end };
  };

  const handleDrop = async (e) => {
    if (isSplitMode) return;
    e.preventDefault();
    e.stopPropagation();
    const dragElements = document.querySelectorAll('.dragging');
    dragElements.forEach((el) => el.classList.remove('dragging'));
    if (timelineRef.current) timelineRef.current.classList.remove('showing-new-layer');

    setDraggingItem(null);
    setDragLayer(null);
    setDragOffset(0);
    setSnapIndicators([]);

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const dataString = e.dataTransfer.getData('application/json');
    let dragData = null;
    if (dataString) {
      try {
        dragData = JSON.parse(dataString);
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    }

    if (dragData?.type === 'transition') {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = mouseX - rect.left;
      const timelinePosition = clickX / timeScale;
      const layerHeight = 40;
      const totalVideoLayers = videoLayers.length;
      const totalAudioLayers = audioLayers.length;
      const totalLayers = totalVideoLayers + totalAudioLayers + 2;
      const reversedIndex = Math.floor((mouseY - rect.top) / layerHeight);
      let layerIndex;
      let isAudioLayer = false;

      if (reversedIndex <= totalVideoLayers) {
        layerIndex = totalVideoLayers - reversedIndex;
      } else if (reversedIndex >= totalVideoLayers + 1 && reversedIndex < totalLayers - 1) {
        layerIndex = totalLayers - 2 - reversedIndex;
        isAudioLayer = true;
      } else {
        layerIndex = 0;
      }

      if (!isAudioLayer && layerIndex >= 0 && layerIndex < videoLayers.length) {
        const { segment, start, end } = findAdjacentSegments(timelinePosition, layerIndex, videoLayers);
        if (segment && (start || end)) {
          await handleTransitionDrop(
            segment.id,
            start,
            end,
            layerIndex,
            timelinePosition,
            dragData.transition.type
          );
          saveHistory();
        } else {
          console.warn('No valid segment found for transition drop');
        }
      } else {
        console.warn('Transition drop ignored: Invalid layer or audio layer');
      }

      setDraggingItem(null);
      setDragLayer(null);
      setDragOffset(0);
      setSnapIndicators([]);
      return;
    }

    // Rest of the method remains unchanged
    if (dragData?.type === 'audio' || (draggingItem && draggingItem.type === 'audio')) {
      const audioDropResult = await audioHandler.handleAudioDrop(
        e,
        draggingItem,
        dragLayer,
        mouseX,
        mouseY,
        timeScale,
        dragOffset,
        snapIndicators
      );
      if (audioDropResult === undefined) {
        setDraggingItem(null);
        setDragLayer(null);
        setDragOffset(0);
        setSnapIndicators([]);
        saveHistory();
        return;
      }
    }

    if (dragData?.type === 'media' || (draggingItem && draggingItem.type === 'video')) {
      await videoHandler.handleVideoDrop(
        e,
        draggingItem,
        dragLayer,
        mouseX,
        mouseY,
        timeScale,
        dragOffset,
        snapIndicators
      );
      setDraggingItem(null);
      setDragLayer(null);
      setDragOffset(0);
      setSnapIndicators([]);
      return;
    }

    if (
      dragData?.type === 'photo' ||
      dragData?.type === 'element' ||
      (draggingItem && draggingItem.type === 'image')
    ) {
      const isElement = dragData?.type === 'element';
      const imageDropResult = await imageHandler.handleImageDrop(
        e,
        draggingItem,
        dragLayer,
        mouseX,
        mouseY,
        timeScale,
        dragOffset,
        snapIndicators,
        isElement
      );
      if (imageDropResult === undefined) {
        setDraggingItem(null);
        setDragLayer(null);
        setDragOffset(0);
        setSnapIndicators([]);
        return;
      }
      saveHistory();
    }

    if (dragData?.type === 'textStyle') {
      const style = dragData.textStyle;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = mouseX - rect.left;
      const timelinePosition = clickX / timeScale;
      const layerHeight = 40;
      const totalVideoLayers = videoLayers.length;
      const totalAudioLayers = audioLayers.length;
      const totalLayers = totalVideoLayers + totalAudioLayers + 2;
      const reversedIndex = Math.floor((mouseY - rect.top) / layerHeight);
      let layerIndex;

      if (reversedIndex <= totalVideoLayers) {
        layerIndex = totalVideoLayers - reversedIndex;
      } else {
        layerIndex = 0;
      }

      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        while (newLayers.length <= layerIndex) newLayers.push([]);
        return newLayers;
      });

      try {
        const token = localStorage.getItem('token');
        const duration = style.duration || 5;
        const response = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/add-text`,
          {
            text: style.text,
            layer: layerIndex,
            timelineStartTime: roundToThreeDecimals(timelinePosition),
            timelineEndTime: roundToThreeDecimals(timelinePosition + duration),
            fontFamily: style.fontFamily || 'Arial',
            scale: style.scale || 1.0,
            fontColor: style.fontColor || '#FFFFFF',
            backgroundColor: style.backgroundColor || 'transparent',
            positionX: style.positionX || 0,
            positionY: style.positionY || 0,
            alignment: style.alignment || 'center',
            backgroundOpacity: style.backgroundOpacity ?? 1.0,
            backgroundBorderWidth: style.backgroundBorderWidth ?? 0,
            backgroundBorderColor: style.backgroundBorderColor || '#000000',
            backgroundPadding: style.backgroundPadding ?? 0,
            backgroundBorderRadius: style.backgroundBorderRadius ?? 0,
          },
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );
        const newTextSegment = response.data;
        const newSegment = {
          id: newTextSegment.id,
          type: 'text',
          text: style.text,
          startTime: roundToThreeDecimals(timelinePosition),
          duration: duration,
          layer: layerIndex,
          fontFamily: style.fontFamily || 'Arial',
          scale: style.scale || 1.0,
          fontColor: style.fontColor || '#FFFFFF',
          backgroundColor: style.backgroundColor || 'transparent',
          positionX: style.positionX || 0,
          positionY: style.positionY || 0,
          alignment: style.alignment || 'center',
          backgroundOpacity: style.backgroundOpacity ?? 1.0,
          backgroundBorderWidth: style.backgroundBorderWidth ?? 0,
          backgroundBorderColor: style.backgroundBorderColor || '#000000',
          backgroundPadding: style.backgroundPadding ?? 0,
          backgroundBorderRadius: style.backgroundBorderRadius ?? 0,
          keyframes: {},
        };

        setVideoLayers((prevLayers) => {
          const newLayers = [...prevLayers];
          newLayers[layerIndex].push(newSegment);
          return newLayers;
        });

        setTotalDuration((prev) => Math.max(prev, timelinePosition + duration));
        if (onSegmentSelect) {
          onSegmentSelect(newSegment);
        }
        saveHistory();
        autoSave(videoLayers, audioLayers);
      } catch (error) {
        console.error('Error adding text style to timeline:', error);
      }

      setDraggingItem(null);
      setDragLayer(null);
      setDragOffset(0);
      setSnapIndicators([]);
      return;
    }

    const textDropResult = await textHandler.handleTextDrop(
      e,
      draggingItem,
      dragLayer,
      mouseX,
      mouseY,
      timeScale,
      dragOffset,
      snapIndicators
    );
    if (textDropResult) {
      setDraggingItem(null);
      setDragLayer(null);
      setDragOffset(0);
      setSnapIndicators([]);
      saveHistory();
      return;
    }

    setDraggingItem(null);
    setDragLayer(null);
    setDragOffset(0);
    setSnapIndicators([]);
  };

  const handleTimelineClick = async (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const clickTime = clickX / timeScale;
    const layerHeight = 40;
    const totalVideoLayers = videoLayers.length;
    const totalAudioLayers = audioLayers.length;
    const totalLayers = totalVideoLayers + totalAudioLayers + 2;
    const reversedIndex = Math.floor(clickY / layerHeight);
    let clickedLayerIndex;
    let isAudioLayer = false;

    console.log('handleTimelineClick: isSplitMode=', isSplitMode, 'clickTime=', clickTime, 'reversedIndex=', reversedIndex, 'totalVideoLayers=', totalVideoLayers, 'totalAudioLayers=', totalAudioLayers, 'clickX=', clickX, 'timeScale=', timeScale);

    if (reversedIndex <= totalVideoLayers) {
      clickedLayerIndex = totalVideoLayers - reversedIndex;
    } else if (reversedIndex >= totalVideoLayers + 1 && reversedIndex < totalLayers - 1) {
      clickedLayerIndex = totalLayers - 2 - reversedIndex;
      isAudioLayer = true;
    } else {
      clickedLayerIndex = -1;
    }

    if (!isSplitMode) {
      onTimeUpdate(clickTime); // Update time in ProjectEditor
      setPlayingVideoId(null);
      setSelectedSegment(null);
      if (onSegmentSelect) onSegmentSelect(null);
    }

    let foundItem = null;
    let adjustedLayerIndex = isAudioLayer ? clickedLayerIndex : clickedLayerIndex >= 0 ? clickedLayerIndex : 0;
    const targetLayers = isAudioLayer ? audioLayers : videoLayers;

    console.log('targetLayers=', isAudioLayer ? 'audio' : 'video', 'adjustedLayerIndex=', adjustedLayerIndex);

    if (adjustedLayerIndex >= 0 && adjustedLayerIndex < targetLayers.length) {
      const layerItems = targetLayers[adjustedLayerIndex];
      console.log('layerItems=', layerItems.map(item => ({
        id: item.id,
        type: item.type,
        startTime: item.startTime,
        duration: item.duration,
        endTime: item.startTime + item.duration,
        fileName: item.fileName
      })));

      foundItem = layerItems.find((item) => {
        const itemStart = item.startTime;
        const itemEnd = itemStart + item.duration;
        const tolerance = 0.05;
        return clickTime >= itemStart - tolerance && clickTime <= itemEnd + tolerance;
      });
    }

    if (!foundItem && isAudioLayer) {
      console.log('No segment in layer', adjustedLayerIndex, ', searching all audio layers');
      for (let i = 0; i < audioLayers.length; i++) {
        const layerItems = audioLayers[i];
        foundItem = layerItems.find((item) => {
          const itemStart = item.startTime;
          const itemEnd = itemStart + item.duration;
          const tolerance = 0.05;
          return clickTime >= itemStart - tolerance && clickTime <= itemEnd + tolerance;
        });
        if (foundItem) {
          adjustedLayerIndex = i;
          console.log('Found segment in audioLayers[', i, ']');
          break;
        }
      }
    }

    if (foundItem) {
      console.log('foundItem=', foundItem.type, 'id=', foundItem.id, 'fileName=', foundItem.fileName, 'startTime=', foundItem.startTime, 'duration=', foundItem.duration, 'layerIndex=', adjustedLayerIndex);
      if (isSplitMode) {
        if (foundItem.type === 'video') {
          console.log('Splitting video:', foundItem.id);
          await videoHandler.handleVideoSplit(foundItem, clickTime, adjustedLayerIndex);
          saveHistory();
        } else if (foundItem.type === 'audio') {
          const isExtracted = foundItem.fileName.includes('extracted_') || foundItem.fileName.includes('extracted/');
          console.log('Audio split: isExtracted=', isExtracted, 'fileName=', foundItem.fileName);
          if (isExtracted) {
            console.log('Calling handleExtractedAudioSplit for:', foundItem.id);
            await audioHandler.handleExtractedAudioSplit(foundItem, clickTime, adjustedLayerIndex);
            saveHistory();
          } else {
            console.log('Calling handleAudioSplit for:', foundItem.id);
            await audioHandler.handleAudioSplit(foundItem, clickTime, adjustedLayerIndex);
          }
        } else if (foundItem.type === 'text') {
          console.log('Splitting text:', foundItem.id);
          await textHandler.handleTextSplit(foundItem, clickTime, adjustedLayerIndex);
          saveHistory();
        } else if (foundItem.type === 'image') {
          console.log('Splitting image:', foundItem.id);
          await imageHandler.handleImageSplit(foundItem, clickTime, adjustedLayerIndex);
          saveHistory();
        }
        setIsSplitMode(false);
        setSelectedSegment(null);
        setPlayingVideoId(null);
        return;
      } else {
        if (foundItem.type === 'text') {
          handleVideoSelect(foundItem.id);
        } else {
          setPlayingVideoId(foundItem.id);
          if (onVideoSelect) onVideoSelect(clickTime, foundItem);
        }
        return;
      }
    } else {
      console.log('No item found at clickTime=', clickTime);
      console.log('All audioLayers=', audioLayers.map((layer, index) => ({
        layerIndex: index,
        items: layer.map(item => ({
          id: item.id,
          type: item.type,
          startTime: item.startTime,
          duration: item.duration,
          endTime: item.startTime + item.duration,
          fileName: item.fileName
        }))
      })));
      if (!isAudioLayer) {
        console.log('All videoLayers=', videoLayers.map((layer, index) => ({
          layerIndex: index,
          items: layer.map(item => ({
            id: item.id,
            type: item.type,
            startTime: item.startTime,
            duration: item.duration,
            endTime: item.startTime + item.duration,
            fileName: item.fileName
          }))
        })));
      }
    }

    if (!isSplitMode && onVideoSelect) onVideoSelect(clickTime);
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying); // Update isPlaying in ProjectEditor
  };

  useEffect(() => {
    return () => {
      clearInterval(playIntervalRef.current);
      cancelAnimationFrame(playIntervalRef.current);
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleVideoSelect = (videoId) => {
    if (isSplitMode) return;
    setPlayingVideoId(videoId);
    let selected = null;
    for (let i = 0; i < videoLayers.length; i++) {
      const item = videoLayers[i].find((v) => v.id === videoId);
      if (item) {
        selected = { ...item, layerIndex: i };
        setSelectedSegment(selected);
        break;
      }
    }
    if (!selected) {
      for (let i = 0; i < audioLayers.length; i++) {
        const item = audioLayers[i].find((v) => v.id === videoId);
        if (item) {
          selected = { ...item, layerIndex: i };
          setSelectedSegment(selected);
          break;
        }
      }
    }
    if (onSegmentSelect) onSegmentSelect(selected);
  };

  const flattenLayersToSegments = (layers) => {
      const segments = [];
      layers.forEach((layer, layerIndex) => {
        layer.forEach((item) => {
          if (item.type === 'text') {
            segments.push({
              id: item.id,
              type: 'text',
              text: item.text,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              fontFamily: item.fontFamily,
              scale: item.scale,
              fontColor: item.fontColor,
              backgroundColor: item.backgroundColor,
              positionX: item.positionX,
              positionY: item.positionY,
              alignment: item.alignment,
              backgroundOpacity: item.backgroundOpacity,
              backgroundBorderWidth: item.backgroundBorderWidth,
              backgroundBorderColor: item.backgroundBorderColor,
              backgroundPadding: item.backgroundPadding,
              backgroundBorderRadius: item.backgroundBorderRadius,
              keyframes: item.keyframes || {},
              opacity: item.opacity,
            });
          } else if (item.type === 'video') {
            segments.push({
              id: item.id,
              type: 'video',
              sourceVideoPath: item.filePath || item.filename,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              startTime: item.startTimeWithinVideo || 0,
              endTime: item.endTimeWithinVideo || item.duration,
              positionX: item.positionX,
              positionY: item.positionY,
              scale: item.scale,
              opacity: item.opacity,
              keyframes: item.keyframes || {},
              cropL: item.cropL ?? 0, // Add crop values
              cropR: item.cropR ?? 0,
              cropT: item.cropT ?? 0,
              cropB: item.cropB ?? 0,
            });
          } else if (item.type === 'image') {
            segments.push({
              id: item.id,
              type: 'image',
              imageFileName: item.fileName,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              positionX: item.positionX,
              positionY: item.positionY,
              scale: item.scale,
              opacity: item.opacity,
              width: item.width,
              height: item.height,
              effectiveWidth: item.effectiveWidth,
              effectiveHeight: item.effectiveHeight,
              maintainAspectRatio: item.maintainAspectRatio,
              isElement: item.isElement,
              keyframes: item.keyframes || {},
              cropL: item.cropL ?? 0, // Add crop values
              cropR: item.cropR ?? 0,
              cropT: item.cropT ?? 0,
              cropB: item.cropB ?? 0,
            });
          } else if (item.type === 'audio') {
            segments.push({
              id: item.id,
              type: 'audio',
              audioFileName: item.fileName,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              startTime: item.startTimeWithinAudio || 0,
              endTime: item.endTimeWithinAudio || item.duration,
              keyframes: item.keyframes || {},
            });
          }
        });
      });
      return segments;
    };

  const toggleSplitMode = () => {
    setIsSplitMode((prev) => !prev);
    setDraggingItem(null);
    setResizingItem(null);
  };

  return (
    <div className="timeline-container">
      <TimelineControls
        isPlaying={isPlaying}
        togglePlayback={togglePlayback}
        currentTime={currentTime} // Use currentTime from ProjectEditor
        totalDuration={totalDuration}
        formatTime={formatTime}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        onAddTextClick={openTextTool}
        toggleSplitMode={toggleSplitMode}
        isSplitMode={isSplitMode}
      />
      <div className="timeline-scroll-container">
        <TimelineRuler totalDuration={totalDuration} timeScale={timeScale} formatTime={formatTime} />
        <div
          className={`timeline ${isSplitMode ? 'split-mode' : ''}`}
          ref={timelineRef}
          onClick={handleTimelineClick}
          style={{ width: `${totalDuration * timeScale}px` }}
          onDragOver={generalHandler.handleDragOver}
          onDrop={handleDrop}
        >
          <div className="playhead" ref={playheadRef} style={{ left: `${currentTime * timeScale}px` }}></div> {/* Use currentTime for playhead position */}
          <div className="timeline-layer new-layer-drop-area" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            <div className="layer-label">Drop to create new layer</div>
          </div>
          {[...videoLayers].reverse().map((layer, reversedIndex) => {
            const layerIndex = videoLayers.length - 1 - reversedIndex;
            return (
              <div key={`video-layer-${layerIndex}`} className="timeline-layer" onDragOver={generalHandler.handleDragOver} onDrop={handleDrop}>
                <TimelineLayer
                  layer={layer}
                  layerIndex={layerIndex}
                  timeScale={timeScale}
                  handleDragStart={generalHandler.handleDragStart}
                  handleResizeStart={generalHandler.handleResizeStart}
                  playingVideoId={playingVideoId}
                  handleVideoSelect={handleVideoSelect}
                  handleEditTextSegment={(item) => {
                    setSelectedSegment({ ...item, layerIndex: item.layer });
                    if (onSegmentSelect) onSegmentSelect({ ...item, layerIndex: item.layer });
                  }}
                  selectedSegmentId={selectedSegment ? selectedSegment.id : null}
                  showResizeHandles={(item) => item.id === (selectedSegment ? selectedSegment.id : null)}
                  transitions={transitions.filter((t) => t.layer === layerIndex)}
                  onTransitionSelect={onTransitionSelect}
                />
              </div>
            );
          })}
          <div className="timeline-layer audio-section-label">
            <div className="layer-label">Audio</div>
          </div>
          {[...audioLayers].map((layer, index) => (
            <div key={`audio-layer-${-(index + 1)}`} className="timeline-layer" onDragOver={generalHandler.handleDragOver} onDrop={handleDrop}>
              <TimelineLayer
                layer={layer}
                layerIndex={index}
                timeScale={timeScale}
                handleDragStart={generalHandler.handleDragStart}
                handleResizeStart={generalHandler.handleResizeStart}
                playingVideoId={playingVideoId}
                handleVideoSelect={handleVideoSelect}
                handleEditTextSegment={() => {}}
                selectedSegmentId={selectedSegment ? selectedSegment.id : null}
                showResizeHandles={(item) => item.id === (selectedSegment ? selectedSegment.id : null)}
                transitions={[]}
                onTransitionSelect={onTransitionSelect}
              />
            </div>
          ))}
          <div className="timeline-layer new-layer-drop-area" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            <div className="layer-label">Drop to create new layer</div>
          </div>
          <SnapIndicators snapIndicators={snapIndicators} timeScale={timeScale} layers={[...videoLayers, ...audioLayers]} />
          <DraggingGhost
            draggingItem={draggingItem}
            snapIndicators={snapIndicators}
            timeScale={timeScale}
            dragLayer={dragLayer}
            layers={[...videoLayers, ...audioLayers]}
          />
        </div>
      </div>
    </div>
  );
};

export default TimelineComponent;