import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../CSS/ProjectEditor.css';
import TimelineComponent from './TimelineComponent.js';
import VideoPreview from './VideoPreview';
import { debounce } from 'lodash';
import ImageSegmentHandler from './ImageSegmentHandler';
import AudioSegmentHandler from './AudioSegmentHandler';
import KeyframeControls from './KeyframeControls';
import FilterControls from './FilterControls';
import TransitionsPanel from './TransitionsPanel';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = 'http://localhost:8080';
  const defaultTextStyles = [
    {
      text: "Text Style 1",
      fontFamily: "Arial",
      scale: 2.0,
      fontColor: "#f1ffbd",
      backgroundColor: "#36380f",
      positionX: 0,
      positionY: 0,
      opacity: 1.0,
      alignment: "center",
      backgroundOpacity: 1.0,
      backgroundBorderWidth: 0,
      backgroundBorderColor: "#f1ffbd",
      backgroundH: 20, // Add this
      backgroundW: 100, // Add this
      backgroundBorderRadius: 9,
      duration: 5,
      textBorderColor: 'transparent', // Added
      textBorderWidth: 0, // Added
      textBorderOpacity: 1.0, // Added
    },
    {
      text: "Text Style 2",
      fontFamily: "Times New Roman",
      scale: 2.0,
      fontColor: "#c2f0ff",
      backgroundColor: "#ffffff",
      positionX: 0,
      positionY: 0,
      opacity: 1.0,
      alignment: "center",
      backgroundOpacity: 0.21,
      backgroundBorderWidth: 0,
      backgroundBorderColor: "#000000",
      backgroundH: 20, // Add this
      backgroundW: 100, // Add this
      backgroundBorderRadius: 10,
      duration: 5,
      textBorderColor: 'transparent', // Added
      textBorderWidth: 0, // Added
      textBorderOpacity: 1.0, // Added
    },
    {
      text: "Text Style 3",
      fontFamily: "Arial",
      scale: 2.0,
      fontColor: "#f0fff3",
      backgroundColor: "#657c6a",
      positionX: 0,
      positionY: 0,
      opacity: 1.0,
      alignment: "center",
      backgroundOpacity: 1.0,
      backgroundBorderWidth: 0,
      backgroundBorderColor: "#000000",
      backgroundH: 20, // Add this
      backgroundW: 100, // Add this
      backgroundBorderRadius: 10,
      duration: 5,
      textBorderColor: 'transparent', // Added
      textBorderWidth: 0, // Added
      textBorderOpacity: 1.0, // Added
    },
  ];

const ProjectEditor = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1080, height: 1920 });
  const [currentTime, setCurrentTime] = useState(0);
  const [videoLayers, setVideoLayers] = useState([[], [], []]);
  const [audioLayers, setAudioLayers] = useState([[], [], []]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(30);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [tempSegmentValues, setTempSegmentValues] = useState({});
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [thumbnailsGenerated, setThumbnailsGenerated] = useState(false);
  const [isMediaPanelOpen, setIsMediaPanelOpen] = useState(true);
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(true);
  const [previewHeight, setPreviewHeight] = useState('auto');
  const [isTextToolOpen, setIsTextToolOpen] = useState(false);
  const [editingTextSegment, setEditingTextSegment] = useState(null);
  const [textSettings, setTextSettings] = useState({
    text: 'New Text',
    fontFamily: 'Arial',
    scale: 1.0,
    fontColor: '#FFFFFF',
    backgroundColor: 'transparent',
    duration: 5,
    alignment: 'center',
    backgroundOpacity: 1.0,
    backgroundBorderWidth: 0,
    backgroundBorderColor: '#000000',
    backgroundH: 0, // Add this
    backgroundW: 0, // Add this
    backgroundBorderRadius: 0,
    textBorderColor: 'transparent', // Added for text border
    textBorderWidth: 0, // Added for text border
    textBorderOpacity: 1.0, // Added for text border
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterParams, setFilterParams] = useState({});
  const [appliedFilters, setAppliedFilters] = useState([]);
  const [timeScale, setTimeScale] = useState(20);
  const [keyframes, setKeyframes] = useState({});
  const [currentTimeInSegment, setCurrentTimeInSegment] = useState(0);
  const [editingProperty, setEditingProperty] = useState(null);
  const [isTransitionsOpen, setIsTransitionsOpen] = useState(false);
  const [transitions, setTransitions] = useState([]);
  const [availableTransitions] = useState([
    { type: 'Slide', label: 'Slide', icon: '/icons/slide.png' },
    { type: 'Zoom', label: 'Zoom', icon: '/icons/zoom.png' },
    { type: 'Rotate', label: 'Rotate', icon: '/icons/rotate.png' },
  ]);
  const [selectedTransition, setSelectedTransition] = useState(null);
  const [projectFps, setProjectFps] = useState(25);
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loadedAudioSegments, setLoadedAudioSegments] = useState(new Set()); // Track loaded audio segments
  // Add this to the existing state declarations at the top of ProjectEditor
  const [elementSearchQuery, setElementSearchQuery] = useState('');

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const navigate = useNavigate();
  const { projectId } = useParams();
  const updateTimeoutRef = useRef(null);
  const filterUpdateTimeoutRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastUpdateTimeRef = useRef(performance.now());
  const transitionSaveTimeoutRef = useRef(null); // New ref for debouncing transition saves

  const MIN_TIME_SCALE = 0.1;
  const MAX_TIME_SCALE = 250;
  const baseFontSize = 24;
  let timelineSetPlayhead = null;

  // Playback animation
  useEffect(() => {
    if (isPlaying) {
      const updatePlayback = (now) => {
        const deltaTime = (now - lastUpdateTimeRef.current) / 1000; // Convert to seconds
        lastUpdateTimeRef.current = now;

        setCurrentTime((prevTime) => {
          const newTime = prevTime + deltaTime;
          if (newTime >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return newTime;
        });

        animationFrameRef.current = requestAnimationFrame(updatePlayback);
      };

      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updatePlayback);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration]);

  // Update loaded audio segments
  const handleLoadedAudioSegmentsUpdate = (newLoadedAudioSegments) => {
    setLoadedAudioSegments(newLoadedAudioSegments);
  };

  const getProjectState = () => ({
    videoLayers,
    audioLayers,
    transitions,
    keyframes,
    filterParams,
    appliedFilters,
    textSettings,
    selectedSegment,
  });

  const saveHistory = () => {
    const newState = getProjectState();
    const newHistory = [...history.slice(0, historyIndex + 1), newState];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const autoSaveUndoRedo = async (projectState, retries = 3) => {
    if (!projectId || !sessionId) {
      console.warn('Cannot auto-save undo/redo: Missing projectId or sessionId');
      return;
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const token = localStorage.getItem('token');
        const videoLayersToSave = projectState.videoLayers;
        const audioLayersToSave = projectState.audioLayers;
        const transitionsToSave = projectState.transitions;

        const seenSegmentIds = new Set();
        const segments = [];

        videoLayersToSave.forEach((layer, layerIndex) => {
          if (!Array.isArray(layer)) {
            console.warn(`Skipping invalid video layer at index ${layerIndex}:`, layer);
            return;
          }
          layer.forEach((item) => {
            if (seenSegmentIds.has(item.id)) {
              console.warn(`Duplicate segment ID ${item.id} found in video layer ${layerIndex}`);
              return;
            }
            seenSegmentIds.add(item.id);
            if (item.type === 'video') {
              segments.push({
                id: item.id,
                type: 'video',
                sourceVideoPath: item.filePath,
                layer: item.layer,
                timelineStartTime: item.startTime,
                timelineEndTime: item.startTime + item.duration,
                startTime: item.startTimeWithinVideo || 0,
                endTime: item.endTimeWithinVideo || item.duration,
                positionX: item.positionX,
                positionY: item.positionY,
                scale: item.scale,
                opacity: item.opacity,
                filters: item.filters || [],
                keyframes: item.keyframes || {},
              });
            } else if (item.type === 'image') {
              segments.push({
                id: item.id,
                type: 'image',
                imagePath: item.fileName,
                layer: item.layer,
                timelineStartTime: item.startTime,
                timelineEndTime: item.startTime + item.duration,
                positionX: item.positionX,
                positionY: item.positionY,
                scale: item.scale,
                opacity: item.opacity,
                filters: item.filters || [],
                keyframes: item.keyframes || {},
              });
            } else if (item.type === 'text') {
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
                opacity: item.opacity,
                alignment: item.alignment,
                backgroundOpacity: item.backgroundOpacity,
                backgroundBorderWidth: item.backgroundBorderWidth,
                backgroundBorderColor: item.backgroundBorderColor,
                backgroundPadding: item.backgroundPadding,
                keyframes: item.keyframes || {},
              });
            }
          });
        });

        audioLayersToSave.forEach((layer, layerIndex) => {
          if (!Array.isArray(layer)) {
            console.warn(`Skipping invalid audio layer at index ${layerIndex}:`, layer);
            return;
          }
          layer.forEach((item) => {
            if (seenSegmentIds.has(item.id)) {
              console.warn(`Duplicate segment ID ${item.id} found in audio layer ${layerIndex}`);
              return;
            }
            seenSegmentIds.add(item.id);
            segments.push({
              id: item.id,
              type: 'audio',
              audioPath: item.fileName,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              startTime: item.startTimeWithinAudio || 0,
              endTime: item.endTimeWithinAudio || item.duration,
              volume: item.volume,
              keyframes: item.keyframes || {},
            });
          });
        });

        const timelineState = {
          segments,
          textSegments: segments.filter((s) => s.type === 'text'),
          imageSegments: segments.filter((s) => s.type === 'image'),
          audioSegments: segments.filter((s) => s.type === 'audio'),
          transitions: transitionsToSave || [],
        };

        await axios.post(
          `${API_BASE_URL}/projects/${projectId}/saveForUndoRedo`,
          { timelineState },
          {
            params: { sessionId },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('Undo/Redo state saved successfully');
        return;
      } catch (error) {
        console.error(`Error during undo/redo auto-save (attempt ${attempt}):`, error);
        if (attempt === retries) {
          alert('Failed to save changes after undo/redo. Please try again.');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  const handleUndo = async () => {
    if (!canUndo) {
      console.log('Cannot undo: No previous state');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];

      setVideoLayers(previousState.videoLayers.map((layer) => [...layer]));
      setAudioLayers(previousState.audioLayers.map((layer) => [...layer]));
      setTransitions([...previousState.transitions]);
      setKeyframes({ ...previousState.keyframes });
      setFilterParams({ ...previousState.filterParams });
      setAppliedFilters([...previousState.appliedFilters]);
      setTextSettings({ ...previousState.textSettings });
      setSelectedSegment(previousState.selectedSegment ? { ...previousState.selectedSegment } : null);
      setHistoryIndex(newIndex);

      await autoSaveUndoRedo(previousState);
      console.log('Undo performed and state saved successfully');
    } catch (error) {
      console.error('Failed to perform undo:', error);
      alert('Failed to perform undo. Please try again.');
    }
  };

  const handleRedo = async () => {
    if (!canRedo) {
      console.log('Cannot redo: No next state');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];

      setVideoLayers(nextState.videoLayers.map((layer) => [...layer]));
      setAudioLayers(nextState.audioLayers.map((layer) => [...layer]));
      setTransitions([...nextState.transitions]);
      setKeyframes({ ...nextState.keyframes });
      setFilterParams({ ...nextState.filterParams });
      setAppliedFilters([...nextState.appliedFilters]);
      setTextSettings({ ...nextState.textSettings });
      setSelectedSegment(nextState.selectedSegment ? { ...nextState.selectedSegment } : null);
      setHistoryIndex(newIndex);

      await autoSaveUndoRedo(nextState);
      console.log('Redo performed and state saved successfully');
    } catch (error) {
      console.error('Failed to perform redo:', error);
      alert('Failed to perform redo. Please try again.');
    }
  };

  const autoSaveProject = async (updatedVideoLayers = videoLayers, updatedAudioLayers = audioLayers) => {
    if (!projectId || !sessionId) {
      console.warn('Cannot auto-save: Missing projectId or sessionId');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const segments = [];
      updatedVideoLayers.forEach((layer, layerIndex) => {
        layer.forEach((item) => {
          if (item.type === 'video') {
            segments.push({
              id: item.id,
              type: 'video',
              sourceVideoPath: item.filePath,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              startTime: item.startTimeWithinVideo || 0,
              endTime: item.endTimeWithinVideo || item.duration,
              positionX: item.positionX,
              positionY: item.positionY,
              scale: item.scale,
              opacity: item.opacity,
              filters: item.filters || [],
              keyframes: item.keyframes || {},
            });
          } else if (item.type === 'image') {
            segments.push({
              id: item.id,
              type: 'image',
              imagePath: item.fileName,
              layer: item.layer,
              timelineStartTime: item.startTime,
              timelineEndTime: item.startTime + item.duration,
              positionX: item.positionX,
              positionY: item.positionY,
              scale: item.scale,
              opacity: item.opacity,
              filters: item.filters || [],
              keyframes: item.keyframes || {},
            });
          } else if (item.type === 'text') {
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
              opacity: item.opacity,
              alignment: item.alignment,
              backgroundOpacity: item.backgroundOpacity,
              backgroundBorderWidth: item.backgroundBorderWidth,
              backgroundBorderColor: item.backgroundBorderColor,
              backgroundH: item.backgroundH,
              backgroundW: item.backgroundW,
              backgroundBorderRadius: item.backgroundBorderRadius,
              textBorderColor: item.textBorderColor, // Added
              textBorderWidth: item.textBorderWidth, // Added
              textBorderOpacity: item.textBorderOpacity, // Added
              keyframes: item.keyframes || {},
            });
          }
        });
      });
      updatedAudioLayers.forEach((layer, layerIndex) => {
        layer.forEach((item) => {
          segments.push({
            id: item.id,
            type: 'audio',
            audioPath: item.fileName,
            layer: item.layer,
            timelineStartTime: item.startTime,
            timelineEndTime: item.startTime + item.duration,
            startTime: item.startTimeWithinAudio || 0,
            endTime: item.endTimeWithinAudio || item.duration,
            volume: item.volume,
            keyframes: item.keyframes || {},
          });
        });
      });

      await axios.post(
        `${API_BASE_URL}/projects/${projectId}/save`,
        {
          timelineState: {
            segments,
            textSegments: segments.filter((s) => s.type === 'text'),
            imageSegments: segments.filter((s) => s.type === 'image'),
            audioSegments: segments.filter((s) => s.type === 'audio'),
          },
        },
        {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log('Project auto-saved successfully');
    } catch (error) {
      console.error('Error during auto-save:', error);
    }
  };

  const roundToThreeDecimals = (num) => {
    return Math.round(num * 1000) / 1000;
  };

  const findAvailableLayer = (startTime, endTime, layers) => {
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const hasOverlap = layer.some(
        (segment) =>
          startTime < segment.startTime + segment.duration &&
          endTime > segment.startTime
      );
      if (!hasOverlap) {
        return layerIndex;
      }
    }
    return layers.length;
  };

  const handleElementClick = async (element, isDragEvent = false) => {
    if (uploading || isDragEvent) return;
    try {
      let endTime = 0;
      videoLayers.forEach((layer) => {
        layer.forEach((segment) => {
          const segmentEndTime = segment.startTime + segment.duration;
          if (segmentEndTime > endTime) endTime = segmentEndTime;
        });
      });
      const timelineStartTime = endTime;
      const duration = 5;
      const selectedLayer = findAvailableLayer(timelineStartTime, timelineStartTime + duration, videoLayers);

      const newSegment = await addImageToTimeline(
        element.fileName,
        selectedLayer,
        roundToThreeDecimals(timelineStartTime),
        roundToThreeDecimals(timelineStartTime + duration),
        true // isElement
      );

      // Explicitly add the segment to videoLayers with isElement: true
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        while (newLayers.length <= selectedLayer) newLayers.push([]);
        const exists = newLayers[selectedLayer].some((segment) => segment.id === newSegment.id);
        if (!exists) {
          newLayers[selectedLayer].push({ ...newSegment, isElement: true }); // Ensure isElement is set
        } else {
          console.warn(`Segment with id ${newSegment.id} already exists in layer ${selectedLayer}`);
        }
        return newLayers;
      });

      setTotalDuration((prev) => Math.max(prev, timelineStartTime + duration));
      preloadMedia();
      saveHistory();

      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        autoSaveProject(videoLayers, audioLayers);
      }, 1000);
    } catch (error) {
      console.error('Error adding element to timeline:', error);
      alert('Failed to add element to timeline. Please try again.');
    }
  };

  const handleAudioClick = debounce(async (audio, isDragEvent = false) => {
      if (uploading || isDragEvent) return;
      try {
        const token = localStorage.getItem('token');
        if (!sessionId || !projectId || !token) {
          throw new Error('Missing sessionId, projectId, or token');
        }

        const duration = audio.duration || 5;
        let timelineStartTime = roundToThreeDecimals(currentTime);

        const findAvailableLayer = (start, end, layers) => {
          for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            const hasOverlap = layers[layerIndex].some((segment) => {
              const segmentStart = segment.startTime;
              const segmentEnd = segmentStart + segment.duration;
              return start < segmentEnd && end > segmentStart;
            });
            if (!hasOverlap) return layerIndex;
          }
          return layers.length;
        };

        const proposedEndTime = timelineStartTime + duration;
        let selectedLayerIndex = findAvailableLayer(timelineStartTime, proposedEndTime, audioLayers);

        if (selectedLayerIndex >= audioLayers.length) {
          let earliestStartTime = timelineStartTime;
          let foundLayer = -1;

          for (let layerIndex = 0; layerIndex < audioLayers.length; layerIndex++) {
            const layer = audioLayers[layerIndex];
            let layerEndTime = 0;
            layer.forEach((segment) => {
              const segmentEnd = segment.startTime + segment.duration;
              if (segmentEnd > layerEndTime) layerEndTime = segmentEnd;
            });
            if (layerEndTime < earliestStartTime) {
              earliestStartTime = layerEndTime;
              foundLayer = layerIndex;
            }
          }

          if (foundLayer >= 0) {
            selectedLayerIndex = foundLayer;
            timelineStartTime = roundToThreeDecimals(earliestStartTime);
          } else {
            selectedLayerIndex = audioLayers.length;
          }
        }

        const backendLayer = -(selectedLayerIndex + 1);

        // Generate unique temporary ID
        const doesIdExist = (id) => {
          return audioLayers.some((layer) => layer.some((segment) => segment.id === id));
        };
        let tempId = `temp-${uuidv4()}`;
        while (doesIdExist(tempId)) {
          tempId = `temp-${uuidv4()}`;
        }

        const newSegment = {
          id: tempId,
          type: 'audio',
          fileName: audio.fileName,
          audioPath: `${API_BASE_URL}/projects/${projectId}/audio/${encodeURIComponent(audio.fileName)}`,
          displayName: audio.displayName || audio.fileName.split('/').pop(),
          waveformImage: audio.waveformImage || '/images/audio.jpeg',
          startTime: timelineStartTime,
          duration: duration,
          layer: backendLayer,
          volume: 1.0,
          startTimeWithinAudio: 0,
          endTimeWithinAudio: duration,
          timelineStartTime: timelineStartTime,
          timelineEndTime: timelineStartTime + duration,
          keyframes: {},
        };

        let updatedAudioLayers = audioLayers;
        setAudioLayers((prevLayers) => {
          const newLayers = [...prevLayers];
          while (newLayers.length <= selectedLayerIndex) newLayers.push([]);

          // Check for existing segment with the same ID
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
            newLayers[existingLayerIndex] = newLayers[existingLayerIndex].map((s) =>
              s.id === newSegment.id ? { ...s, ...newSegment, layer: backendLayer } : s
            );
          } else {
            newLayers[selectedLayerIndex].push(newSegment);
          }

          updatedAudioLayers = newLayers;
          return newLayers;
        });

        setTotalDuration((prev) => Math.max(prev, timelineStartTime + duration));
        preloadMedia();
        saveHistory();

        const response = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/add-project-audio-to-timeline`,
          {
            audioFileName: audio.fileName,
            layer: backendLayer,
            timelineStartTime: roundToThreeDecimals(timelineStartTime),
            timelineEndTime: roundToThreeDecimals(timelineStartTime + duration),
            startTime: roundToThreeDecimals(0),
            endTime: roundToThreeDecimals(duration),
            volume: 1.0,
          },
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );

        const newAudioSegment = response.data;

        if (!newAudioSegment.audioSegmentId) {
          throw new Error('Backend did not return audioSegmentId');
        }

        // Ensure backend ID is unique
        let finalSegmentId = newAudioSegment.audioSegmentId;
        if (doesIdExist(finalSegmentId)) {
          console.warn(`Backend returned duplicate audioSegmentId ${finalSegmentId}. Generating new ID.`);
          finalSegmentId = `${finalSegmentId}-${uuidv4()}`;
        }

        setAudioLayers((prevLayers) => {
          const newLayers = prevLayers.map((layer, index) => {
            if (index === selectedLayerIndex) {
              return layer.map((item) =>
                item.id === tempId
                  ? {
                      ...item,
                      id: finalSegmentId,
                      volume: newAudioSegment.volume || 1.0,
                      keyframes: newAudioSegment.keyframes || {},
                      startTimeWithinAudio: roundToThreeDecimals(newAudioSegment.startTime || 0),
                      endTimeWithinAudio: roundToThreeDecimals(newAudioSegment.endTime || duration),
                      duration: roundToThreeDecimals(
                        newAudioSegment.timelineEndTime - newAudioSegment.timelineStartTime
                      ),
                      timelineStartTime: roundToThreeDecimals(newAudioSegment.timelineStartTime),
                      timelineEndTime: roundToThreeDecimals(newAudioSegment.timelineEndTime),
                      layer: newAudioSegment.layer || backendLayer,
                    }
                  : item
              );
            }
            return layer;
          });
          updatedAudioLayers = newLayers;
          return newLayers;
        });

        autoSaveProject(videoLayers, updatedAudioLayers);
      } catch (error) {
        console.error('Error adding audio to timeline:', error.response?.data || error.message);
        setAudioLayers((prevLayers) => {
          const newLayers = [...prevLayers];
          newLayers.forEach((layer, index) => {
            newLayers[index] = layer.filter((item) => !item.id.startsWith('temp-'));
          });
          return newLayers;
        });
        let maxEndTime = 0;
        [...videoLayers, ...audioLayers].forEach((layer) => {
          layer.forEach((item) => {
            const endTime = item.startTime + item.duration;
            if (endTime > maxEndTime) maxEndTime = endTime;
          });
        });
        setTotalDuration(maxEndTime);
        alert('Failed to add audio to timeline. Please try again.');
      }
    }, 300);

  const toggleTransitionsPanel = () => {
    setIsTransitionsOpen((prev) => !prev);
    setIsTransformOpen(false);
    setIsFiltersOpen(false);
    setIsTextToolOpen(false);
  };

  const handleTransitionSelect = (transition) => {
    setSelectedTransition(transition);
    setIsTransitionsOpen(true);
    setIsTransformOpen(false);
    setIsFiltersOpen(false);
    setIsTextToolOpen(false);
  };

  const handleTransitionDurationChange = async (newDuration) => {
    if (!selectedTransition || !sessionId || !projectId) return;
    if (newDuration <= 0) {
      alert('Duration must be positive');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-transition`,
        {
          transitionId: selectedTransition.id,
          type: selectedTransition.type,
          duration: newDuration,
          segmentId: selectedTransition.segmentId,
          start: selectedTransition.start,
          end: selectedTransition.end,
          layer: selectedTransition.layer,
          parameters: selectedTransition.parameters || {},
        },
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedTransition = response.data;
      setTransitions((prev) =>
        prev.map((t) =>
          t.id === selectedTransition.id ? { ...t, duration: newDuration } : t
        )
      );
      setSelectedTransition((prev) => ({ ...prev, duration: newDuration }));
    } catch (error) {
      console.error('Error updating transition duration:', error);
      alert('Failed to update transition duration');
    }
  };

  const handleTransitionDirectionChange = async (direction) => {
    if (!selectedTransition || !sessionId || !projectId) return;
    try {
      const token = localStorage.getItem('token');
      const updatedParameters = { ...selectedTransition.parameters, direction };
      const response = await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-transition`,
        {
          transitionId: selectedTransition.id,
          type: selectedTransition.type,
          duration: selectedTransition.duration,
          segmentId: selectedTransition.segmentId,
          start: selectedTransition.start,
          end: selectedTransition.end,
          layer: selectedTransition.layer,
          parameters: updatedParameters,
        },
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedTransition = response.data;
      setTransitions((prev) =>
        prev.map((t) =>
          t.id === selectedTransition.id ? { ...t, parameters: updatedParameters } : t
        )
      );
      setSelectedTransition((prev) => ({ ...prev, parameters: updatedParameters }));
    } catch (error) {
      console.error('Error updating transition direction:', error);
      alert('Failed to update transition direction');
    }
  };

    const handleTransitionDelete = async () => {
      if (!selectedTransition || !sessionId || !projectId) return;
      try {
        const token = localStorage.getItem('token');
        await axios.delete(
          `${API_BASE_URL}/projects/${projectId}/remove-transition`,
          {
            params: { sessionId, transitionId: selectedTransition.id },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        let updatedTransitions = transitions;
        setTransitions((prev) => {
          updatedTransitions = prev.filter((t) => t.id !== selectedTransition.id);
          return updatedTransitions;
        });
        setSelectedTransition(null);
        saveHistory();

        // Schedule auto-save with updated transitions
        if (transitionSaveTimeoutRef.current) clearTimeout(transitionSaveTimeoutRef.current);
        transitionSaveTimeoutRef.current = setTimeout(() => {
          autoSaveProject(videoLayers, audioLayers);
          console.log('Auto-saved project after transition delete:', selectedTransition.id);
        }, 1000);
      } catch (error) {
        console.error('Error deleting transition:', error);
        alert('Failed to delete transition');
      }
    };

  const fetchTransitions = async () => {
    if (!sessionId || !projectId || !localStorage.getItem('token')) {
      console.warn('Cannot fetch transitions: Missing sessionId, projectId, or token');
      setTransitions([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/transitions`, {
        params: { sessionId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransitions(response.data || []);
    } catch (error) {
      console.error('Error fetching transitions:', error);
      if (error.response?.status === 403) {
        try {
          const token = localStorage.getItem('token');
          const sessionResponse = await axios.post(
            `${API_BASE_URL}/projects/${projectId}/session`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSessionId(sessionResponse.data);
          const retryResponse = await axios.get(`${API_BASE_URL}/projects/${projectId}/transitions`, {
            params: { sessionId: sessionResponse.data },
            headers: { Authorization: `Bearer ${token}` },
          });
          setTransitions(retryResponse.data || []);
        } catch (retryError) {
          console.error('Error retrying transitions fetch:', retryError);
          setTransitions([]);
        }
      } else if (error.response?.status === 401) {
        navigate('/login');
      } else {
        setTransitions([]);
      }
    }
  };

  const areTimesEqual = (time1, time2, epsilon = 0.0001) => Math.abs(time1 - time2) < epsilon;

  const toggleTransformPanel = () => {
    setIsTransformOpen((prev) => !prev);
    setIsFiltersOpen(false);
    setIsTextToolOpen(false);
  };

  const toggleMediaPanel = () => setIsMediaPanelOpen((prev) => !prev);
  const toggleToolsPanel = () => setIsToolsPanelOpen((prev) => !prev);

  const toggleFiltersPanel = () => {
    setIsFiltersOpen((prev) => !prev);
    setIsTransformOpen(false);
    setIsTextToolOpen(false);
  };

  const toggleTextTool = () => {
    if (selectedSegment && selectedSegment.type === 'text') {
      setIsTextToolOpen((prev) => !prev);
      setIsFiltersOpen(false);
    } else {
      setIsTextToolOpen(false);
    }
  };

  const handleTextSegmentSelect = (segment) => {
    setEditingTextSegment(segment);
    if (segment && segment.type === 'text') {
      setTextSettings({
        text: segment.text || 'New Text',
        fontFamily: segment.fontFamily || 'Arial',
        scale: segment.scale || 1.0,
        fontColor: segment.fontColor || '#FFFFFF',
        backgroundColor: segment.backgroundColor || 'transparent',
        duration: segment.duration || 5,
        alignment: segment.alignment || 'center',
        backgroundOpacity: segment.backgroundOpacity ?? 1.0,
        backgroundBorderWidth: segment.backgroundBorderWidth ?? 0,
        backgroundBorderColor: segment.backgroundBorderColor || '#000000',
        backgroundH: segment.backgroundH ?? 0, // Ensure this is included
        backgroundW: segment.backgroundW ?? 0, // Ensure this is included
        backgroundPadding: segment.backgroundPadding ?? 0,
        backgroundBorderRadius: segment.backgroundBorderRadius ?? 0,
        textBorderColor: segment.textBorderColor || 'transparent', // Added
        textBorderWidth: segment.textBorderWidth ?? 0, // Added
        textBorderOpacity: segment.textBorderOpacity ?? 1.0, // Added
      });
      setIsTextToolOpen(true);
    } else {
      setIsTextToolOpen(false);
    }
  };

  const updateTextSettings = (newSettings) => {
    setTextSettings(newSettings);
    if (editingTextSegment) {
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[editingTextSegment.layer] = newLayers[editingTextSegment.layer].map((item) =>
          item.id === editingTextSegment.id
            ? {
                ...item,
                text: newSettings.text,
                fontFamily: newSettings.fontFamily,
                scale: newSettings.scale,
                fontColor: newSettings.fontColor,
                backgroundColor: newSettings.backgroundColor,
                duration: newSettings.duration,
                timelineEndTime: item.startTime + newSettings.duration,
                alignment: newSettings.alignment,
                backgroundOpacity: newSettings.backgroundOpacity,
                backgroundBorderWidth: newSettings.backgroundBorderWidth,
                backgroundBorderColor: newSettings.backgroundBorderColor,
                backgroundH: newSettings.backgroundH,
                backgroundW: newSettings.backgroundW,
                backgroundBorderRadius: newSettings.backgroundBorderRadius,
                textBorderColor: newSettings.textBorderColor,
                textBorderWidth: newSettings.textBorderWidth,
                textBorderOpacity: newSettings.textBorderOpacity,
              }
            : item
        );
        return newLayers;
      });
      setTempSegmentValues((prev) => ({
        ...prev,
        scale: newSettings.scale,
      }));
      setTotalDuration((prev) => {
        const layer = videoLayers[editingTextSegment.layer];
        const updatedSegment = layer.find((item) => item.id === editingTextSegment.id);
        return Math.max(prev, updatedSegment?.startTime + updatedSegment?.duration || prev);
      });

      // Debounced auto-save for text changes
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        handleSaveTextSegment();
      }, 1000);
    }
  };

  const handleSaveTextSegment = async () => {
    if (!editingTextSegment || !sessionId || !projectId) return;
    try {
      const token = localStorage.getItem('token');
      const updatedTextSegment = {
        ...editingTextSegment,
        text: textSettings.text,
        fontFamily: textSettings.fontFamily,
        scale: textSettings.scale || 1.0,
        fontColor: textSettings.fontColor,
        backgroundColor: textSettings.backgroundColor,
        timelineStartTime: editingTextSegment.startTime,
        timelineEndTime: editingTextSegment.startTime + textSettings.duration,
        alignment: textSettings.alignment,
        backgroundOpacity: textSettings.backgroundOpacity,
        backgroundBorderWidth: textSettings.backgroundBorderWidth,
        backgroundBorderColor: textSettings.backgroundBorderColor,
        backgroundH: textSettings.backgroundH,
        backgroundW: textSettings.backgroundW,
        backgroundBorderRadius: textSettings.backgroundBorderRadius,
        textBorderColor: textSettings.textBorderColor,
        textBorderWidth: textSettings.textBorderWidth,
        textBorderOpacity: textSettings.textBorderOpacity,
        keyframes: keyframes,
      };
      await axios.put(
        `${API_BASE_URL}/projects/${projectId}/update-text`,
        {
          segmentId: editingTextSegment.id,
          text: updatedTextSegment.text,
          fontFamily: updatedTextSegment.fontFamily,
          scale: updatedTextSegment.scale,
          fontColor: updatedTextSegment.fontColor,
          backgroundColor: updatedTextSegment.backgroundColor,
          timelineStartTime: updatedTextSegment.timelineStartTime,
          timelineEndTime: updatedTextSegment.timelineEndTime,
          layer: updatedTextSegment.layer,
          positionX: updatedTextSegment.positionX,
          positionY: updatedTextSegment.positionY,
          alignment: updatedTextSegment.alignment,
          backgroundOpacity: updatedTextSegment.backgroundOpacity,
          backgroundBorderWidth: updatedTextSegment.backgroundBorderWidth,
          backgroundBorderColor: updatedTextSegment.backgroundBorderColor,
          backgroundH: updatedTextSegment.backgroundH,
          backgroundW: updatedTextSegment.backgroundW,
          backgroundBorderRadius: updatedTextSegment.backgroundBorderRadius,
          textBorderColor: updatedTextSegment.textBorderColor,
          textBorderWidth: updatedTextSegment.textBorderWidth,
          textBorderOpacity: updatedTextSegment.textBorderOpacity,
          keyframes: updatedTextSegment.keyframes,
        },
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );

      // Update videoLayers with the latest segment data
      let updatedVideoLayers = videoLayers;
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[editingTextSegment.layer] = newLayers[editingTextSegment.layer].map((item) =>
          item.id === editingTextSegment.id ? { ...updatedTextSegment } : item
        );
        updatedVideoLayers = newLayers;
        return newLayers;
      });

      saveHistory();

      // Fetch updated segment data to ensure synchronization
      await fetchKeyframes(editingTextSegment.id, 'text');

      // Trigger auto-save of the project with updated videoLayers
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        autoSaveProject(updatedVideoLayers, audioLayers);
        console.log('Auto-saved project after text segment save:', editingTextSegment.id);
      }, 1000);
    } catch (error) {
      console.error('Error saving text segment:', error);
      alert('Failed to save text segment. Please try again.');
    }
  };

  const openTextTool = async () => {
    if (!sessionId || !projectId) return;
    try {
      const token = localStorage.getItem('token');
      let startTime = currentTime;
      if (videoLayers[0].length > 0) {
        const lastSegment = videoLayers[0][videoLayers[0].length - 1];
        startTime = Math.max(startTime, lastSegment.startTime + lastSegment.duration);
      }
      const duration = textSettings.duration;

      // Create temporary segment with UUID
      const tempSegmentId = `temp-${uuidv4()}`;
      const tempSegment = {
        id: tempSegmentId,
        type: 'text',
        text: textSettings.text,
        startTime: roundToThreeDecimals(startTime),
        duration: duration,
        layer: 0,
        fontFamily: textSettings.fontFamily,
        scale: textSettings.scale || 1.0,
        fontColor: textSettings.fontColor,
        backgroundColor: textSettings.backgroundColor,
        positionX: 0,
        positionY: 0,
        alignment: textSettings.alignment,
        backgroundOpacity: textSettings.backgroundOpacity,
        backgroundBorderWidth: textSettings.backgroundBorderWidth,
        backgroundBorderColor: textSettings.backgroundBorderColor,
        backgroundH: textSettings.backgroundH,
        backgroundW: textSettings.backgroundW,
        backgroundBorderRadius: textSettings.backgroundBorderRadius,
        textBorderColor: textSettings.textBorderColor, // Added
        textBorderWidth: textSettings.textBorderWidth, // Added
        textBorderOpacity: textSettings.textBorderOpacity, // Added
        keyframes: {},
      };

      // Add temporary segment to videoLayers for instant rendering
      let updatedVideoLayers = videoLayers;
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[0] = [...(newLayers[0] || []), tempSegment];
        updatedVideoLayers = newLayers;
        return newLayers;
      });

      // Make API call
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-text`,
        {
          text: textSettings.text,
          layer: 0,
          timelineStartTime: roundToThreeDecimals(startTime),
          timelineEndTime: roundToThreeDecimals(startTime + duration),
          fontFamily: textSettings.fontFamily,
          scale: textSettings.scale || 1.0,
          fontColor: textSettings.fontColor,
          backgroundColor: textSettings.backgroundColor,
          positionX: 0,
          positionY: 0,
          alignment: textSettings.alignment,
          backgroundOpacity: textSettings.backgroundOpacity,
          backgroundBorderWidth: textSettings.backgroundBorderWidth,
          backgroundBorderColor: textSettings.backgroundBorderColor,
          backgroundH: textSettings.backgroundH,
          backgroundW: textSettings.backgroundW,
          backgroundBorderRadius: textSettings.backgroundBorderRadius,
          textBorderColor: textSettings.textBorderColor, // Added
          textBorderWidth: textSettings.textBorderWidth, // Added
          textBorderOpacity: textSettings.textBorderOpacity, // Added
        },
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );

      const newTextSegment = response.data;

      // Validate response
      if (!newTextSegment.textSegmentId) {
        throw new Error('Backend did not return textSegmentId');
      }

      // Update temporary segment with backend data
      const updatedSegment = {
        id: newTextSegment.textSegmentId,
        type: 'text',
        text: newTextSegment.text,
        startTime: roundToThreeDecimals(newTextSegment.timelineStartTime),
        duration: roundToThreeDecimals(newTextSegment.timelineEndTime - newTextSegment.timelineStartTime),
        layer: newTextSegment.layer,
        fontFamily: newTextSegment.fontFamily,
        scale: newTextSegment.scale || 1.0,
        fontColor: newTextSegment.fontColor,
        backgroundColor: newTextSegment.backgroundColor,
        positionX: newTextSegment.positionX || 0,
        positionY: newTextSegment.positionY || 0,
        alignment: newTextSegment.alignment,
        backgroundOpacity: newTextSegment.backgroundOpacity ?? 1.0,
        backgroundBorderWidth: newTextSegment.backgroundBorderWidth ?? 0,
        backgroundBorderColor: newTextSegment.backgroundBorderColor || '#000000',
        backgroundH: newTextSegment.backgroundH ?? 0,
        backgroundW: newTextSegment.backgroundW ?? 0,
        backgroundBorderRadius: newTextSegment.backgroundBorderRadius ?? 0,
        textBorderColor: newTextSegment.textBorderColor || 'transparent', // Added
        textBorderWidth: newTextSegment.textBorderWidth ?? 0, // Added
        textBorderOpacity: newTextSegment.textBorderOpacity ?? 1.0, // Added
        keyframes: newTextSegment.keyframes || {},
      };

      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[0] = newLayers[0].map((item) =>
          item.id === tempSegmentId ? updatedSegment : item
        );
        updatedVideoLayers = newLayers;
        return newLayers;
      });

      setTotalDuration((prev) => Math.max(prev, startTime + duration));
      setSelectedSegment(updatedSegment);
      setEditingTextSegment(updatedSegment);
      setTextSettings({
        text: updatedSegment.text,
        fontFamily: updatedSegment.fontFamily,
        scale: updatedSegment.scale,
        fontColor: updatedSegment.fontColor,
        backgroundColor: updatedSegment.backgroundColor,
        duration: updatedSegment.duration,
        alignment: updatedSegment.alignment,
        backgroundOpacity: updatedSegment.backgroundOpacity,
        backgroundBorderWidth: updatedSegment.backgroundBorderWidth,
        backgroundBorderColor: updatedSegment.backgroundBorderColor,
        backgroundH: updatedSegment.backgroundH,
        backgroundW: updatedSegment.backgroundW,
        backgroundBorderRadius: updatedSegment.backgroundBorderRadius,
        textBorderColor: updatedSegment.textBorderColor, // Added
        textBorderWidth: updatedSegment.textBorderWidth, // Added
        textBorderOpacity: updatedSegment.textBorderOpacity, // Added
      });
      setIsTextToolOpen(true);
      preloadMedia();
      saveHistory();

      // Auto-save the project with updated videoLayers
      autoSaveProject(updatedVideoLayers, audioLayers);
    } catch (error) {
      console.error('Error adding text to timeline:', error);
      alert('Failed to add text to timeline. Please try again.');
    }
  };

  useEffect(() => {
    if (!projectId) {
      navigate('/dashboard');
      return;
    }
    const initializeProject = async () => {
      try {
        await fetchVideos();
        await fetchAudios();
        await fetchPhotos();
        await fetchTransitions();
        await fetchElements();
        const token = localStorage.getItem('token');
        const sessionResponse = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/session`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSessionId(sessionResponse.data);
        const projectResponse = await axios.get(
          `${API_BASE_URL}/projects/${projectId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const project = projectResponse.data;
        if (project.width && project.height) {
          setCanvasDimensions({ width: project.width, height: project.height });
        }
        if (project.fps) {
          setProjectFps(project.fps);
        }
      } catch (error) {
        console.error('Error initializing project:', error);
        navigate('/dashboard');
      }
    };
    initializeProject();
    const handleBeforeUnload = () => {};
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [projectId, navigate]);

  const fetchVideos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/videos/my-videos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedVideos = response.data.map((video) => ({
        ...video,
        filePath: video.filePath || video.filename,
        displayPath: video.title || (video.filePath || video.filename).split('/').pop(),
      }));
      setVideos(updatedVideos);
      await Promise.all(updatedVideos.map((video) => generateVideoThumbnail(video)));
      setThumbnailsGenerated(true);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const fetchAudios = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const project = response.data;
      if (project.audioJson) {
        let audioFiles =
          typeof project.audioJson === 'string' ? JSON.parse(project.audioJson) : project.audioJson;
        if (Array.isArray(audioFiles)) {
          const updatedAudios = audioFiles.map((audio) => {
            const fullFileName = audio.audioPath.split('/').pop();
            const originalFileName = fullFileName.replace(`${projectId}_`, '').replace(/^\d+_/, '');
            return {
              id: audio.audioPath || `audio-${fullFileName}-${Date.now()}`,
              fileName: fullFileName,
              displayName: originalFileName,
              audioPath: `${API_BASE_URL}/projects/${projectId}/audio/${encodeURIComponent(fullFileName)}`,
              waveformImage: audio.waveformPath
                ? `${API_BASE_URL}/projects/${projectId}/waveforms/${encodeURIComponent(audio.waveformPath.split('/').pop())}`
                : '/images/audio.jpeg',
            };
          });
          setAudios(updatedAudios);
        } else {
          setAudios([]);
        }
      } else {
        setAudios([]);
      }
    } catch (error) {
      console.error('Error fetching audios:', error);
      setAudios([]);
    }
  };
  const fetchPhotos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const project = response.data;
      if (project.imagesJson) {
        let imageFiles =
          typeof project.imagesJson === 'string' ? JSON.parse(project.imagesJson) : project.imagesJson;
        if (Array.isArray(imageFiles)) {
          const updatedPhotos = await Promise.all(
            imageFiles.map(async (image) => {
              const fullFileName = image.imagePath.split('/').pop();
              const originalFileName = fullFileName.replace(`${projectId}_`, '').replace(/^\d+_/, '');
              const thumbnail = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(fullFileName)}`;
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
                  resolve(canvas.toDataURL('image/jpeg'));
                };
                img.onerror = () => resolve(null);
              });
              return {
                id: image.imagePath || `image-${fullFileName}-${Date.now()}`,
                fileName: fullFileName,
                displayName: originalFileName,
                filePath: `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(fullFileName)}`,
                thumbnail,
              };
            })
          );
          setPhotos(updatedPhotos);
        } else {
          setPhotos([]);
        }
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      setPhotos([]);
    }
  };

  const handleTransitionDragStart = (e, transition) => {
    const dragData = {
      type: 'transition',
      transition: {
        type: transition.type,
        duration: 1,
        label: transition.label,
      },
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleTransitionDrop = async (segmentId, start, end, layer, timelinePosition, transitionType) => {
    if (!sessionId || !projectId || !transitionType || !segmentId) {
      console.error('Missing required parameters for transition drop:', {
        sessionId,
        projectId,
        transitionType,
        segmentId,
      });
      return;
    }
    try {
      const token = localStorage.getItem('token');
      let parameters = {};
      if (transitionType === 'Zoom') {
        parameters.direction = 'in';
      } else if (transitionType === 'Rotate') {
        parameters.direction = 'clockwise';
      } else if (transitionType === 'Slide') {
        parameters.direction = 'right';
      }
      const payload = {
        type: transitionType,
        duration: 1,
        segmentId,
        start,
        end,
        layer,
        parameters,
      };
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-transition`,
        payload,
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );
      const newTransition = response.data;
      setTransitions((prev) => [...prev, newTransition]);
      await fetchTransitions();
      saveHistory();

      // Schedule auto-save with updated transitions
      if (transitionSaveTimeoutRef.current) clearTimeout(transitionSaveTimeoutRef.current);
      transitionSaveTimeoutRef.current = setTimeout(() => {
        autoSaveProject(videoLayers, audioLayers);
        console.log('Auto-saved project after transition drop:', newTransition);
      }, 1000);

    } catch (error) {
      console.error('Error adding transition:', error.response?.data || error.message);
      alert('Failed to add transition. Please try again.');
    }
  };

  const preloadMedia = () => {
    const existingPreloadElements = document.querySelectorAll('.preload-media');
    existingPreloadElements.forEach((el) => el.remove());

    const preloadContainer = document.createElement('div');
    preloadContainer.style.display = 'none';
    preloadContainer.className = 'preload-media-container';
    document.body.appendChild(preloadContainer);

    videoLayers.forEach((layer) => {
      layer.forEach((segment) => {
        if (segment.type === 'video' && segment.filePath) {
          const video = document.createElement('video');
          const normalizedFilePath = segment.filePath.startsWith('videos/')
            ? segment.filePath.substring(7)
            : segment.filePath;
          video.src = `${API_BASE_URL}/videos/${encodeURIComponent(normalizedFilePath)}`;
          video.preload = 'auto';
          video.muted = true;
          video.className = 'preload-media';
          preloadContainer.appendChild(video);
          video.load();
        } else if (segment.type === 'image' && segment.filePath) {
          const img = document.createElement('img');
          img.src = segment.filePath;
          img.className = 'preload-media';
          preloadContainer.appendChild(img);
        }
      });
    });

    audioLayers.forEach((layer) => {
      layer.forEach((segment) => {
        if (segment.fileName) {
          const audio = document.createElement('audio');
          audio.src = `${API_BASE_URL}/projects/${projectId}/audio/${encodeURIComponent(segment.fileName)}`;
          audio.preload = 'auto';
          audio.className = 'preload-media';
          preloadContainer.appendChild(audio);
          audio.load();
          console.log(`Preloading audio for project ${projectId}: ${segment.fileName}`);
        }
      });
    });
  };

  useEffect(() => {
      const fetchAndSetLayers = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
            params: { sessionId },
            headers: { Authorization: `Bearer ${token}` },
          });
          const project = response.data;
          if (project && project.timelineState) {
            let timelineState =
              typeof project.timelineState === 'string' ? JSON.parse(project.timelineState) : project.timelineState;
            const newVideoLayers = [[], [], []];
            const newAudioLayers = [[], [], []];

            if (timelineState.segments && timelineState.segments.length > 0) {
              for (const segment of timelineState.segments) {
                const layerIndex = segment.layer || 0;
                if (layerIndex < 0) continue;
                if (layerIndex >= newVideoLayers.length) {
                  while (newVideoLayers.length <= layerIndex) newVideoLayers.push([]);
                }
                if (segment.sourceVideoPath) {
                  const video = videos.find((v) => {
                    const vPath = v.filePath || v.filename;
                    const normalizedVPath = vPath.startsWith('videos/') ? vPath.substring(7) : vPath;
                    const normalizedVideoPath = segment.sourceVideoPath.startsWith('videos/')
                      ? segment.sourceVideoPath.substring(7)
                      : segment.sourceVideoPath;
                    return normalizedVPath === normalizedVideoPath;
                  });
                  if (video) {
                    newVideoLayers[layerIndex].push({
                      id: segment.id,
                      type: 'video',
                      startTime: segment.timelineStartTime || 0,
                      duration: (segment.timelineEndTime - segment.timelineStartTime) || 0,
                      filePath: segment.sourceVideoPath,
                      layer: layerIndex,
                      positionX: segment.positionX || 0,
                      positionY: segment.positionY || 0,
                      scale: segment.scale || 1,
                      filters: segment.filters || [],
                      keyframes: segment.keyframes || {},
                      cropL: segment.cropL || 0,
                      cropR: segment.cropR || 0,
                      cropT: segment.cropT || 0,
                      cropB: segment.cropB || 0,
                    });
                    console.log('Segment crop values:', { id: segment.id, cropL: segment.cropL, cropR: segment.cropR, cropT: segment.cropT, cropB: segment.cropB }); // Debug
                  }
                } else if (segment.imagePath) {
                  const photo = photos.find((p) => p.fileName === segment.imagePath.split('/').pop());
                  if (photo) {
                    newVideoLayers[layerIndex].push({
                      id: segment.id,
                      type: 'image',
                      startTime: segment.timelineStartTime || 0,
                      duration: (segment.timelineEndTime - segment.timelineStartTime) || 5,
                      fileName: segment.imagePath.split('/').pop(),
                      filePath: photo.filePath,
                      layer: layerIndex,
                      positionX: segment.positionX || 0,
                      positionY: segment.positionY || 0,
                      scale: segment.scale || 1,
                      filters: segment.filters || [], // Added from old code
                      keyframes: segment.keyframes || {}, // Add keyframes
                      cropL: segment.cropL || 0, // Add crop parameters
                      cropR: segment.cropR || 0,
                      cropT: segment.cropT || 0,
                      cropB: segment.cropB || 0,
                    });
                  }
                }
              }
            }

            if (timelineState.textSegments && timelineState.textSegments.length > 0) {
              for (const textSegment of timelineState.textSegments) {
                const layerIndex = textSegment.layer || 0;
                if (layerIndex < 0) continue;
                if (layerIndex >= newVideoLayers.length) {
                  while (newVideoLayers.length <= layerIndex) newVideoLayers.push([]);
                }
                newVideoLayers[layerIndex].push({
                  id: textSegment.textSegmentId,
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
                  backgroundH: textSegment.backgroundH ?? 0,
                  backgroundW: textSegment.backgroundW ?? 0,
                  backgroundBorderRadius: textSegment.backgroundBorderRadius ?? 0,
                  textBorderColor: textSegment.textBorderColor || 'transparent', // Added
                  textBorderWidth: textSegment.textBorderWidth ?? 0, // Added
                  textBorderOpacity: textSegment.textBorderOpacity ?? 1.0, // Added
                  keyframes: textSegment.keyframes || {},
                });
              }
            }

            if (timelineState.audioSegments && timelineState.audioSegments.length > 0) {
              for (const audioSegment of timelineState.audioSegments) {
                const backendLayer = audioSegment.layer || -1;
                const layerIndex = Math.abs(backendLayer) - 1;
                if (layerIndex >= newAudioLayers.length) {
                  while (newAudioLayers.length <= layerIndex) newAudioLayers.push([]);
                }
                newAudioLayers[layerIndex].push({
                  id: audioSegment.id,
                  type: 'audio',
                  audioPath: audioSegment.audioPath, // Preserve full audioPath
                  fileName: audioSegment.audioPath.split('/').pop(), // Optional for display
                  startTime: audioSegment.timelineStartTime || 0,
                  duration: (audioSegment.timelineEndTime - audioSegment.timelineStartTime) || 0,
                  layer: backendLayer,
                  displayName: audioSegment.audioPath.split('/').pop(),
                  waveformImage: '/images/audio.jpeg',
                  volume: audioSegment.volume || 1.0,
                  keyframes: audioSegment.keyframes || {}, // Add keyframes
                });
              }
            }

            setVideoLayers(newVideoLayers);
            setAudioLayers(newAudioLayers);
            let maxEndTime = 0;
            [...newVideoLayers, ...newAudioLayers].forEach((layer) => {
              layer.forEach((item) => {
                const endTime = item.startTime + item.duration;
                if (endTime > maxEndTime) maxEndTime = endTime;
              });
            });
            setTotalDuration(maxEndTime > 0 ? maxEndTime : 0);
            preloadMedia(); // Preload after setting layers
          }
        } catch (error) {
          console.error('Error fetching timeline data for layers:', error);
        }
      };
      if (projectId && sessionId && videos.length > 0) fetchAndSetLayers();
    }, [projectId, sessionId, videos, photos]);

    // Add useEffect to preload on videoLayers/audioLayers changes
    useEffect(() => {
      if (videoLayers.some((layer) => layer.length > 0) || audioLayers.some((layer) => layer.length > 0)) {
        preloadMedia();
      }
    }, [videoLayers, audioLayers]);

  useEffect(() => {
    if (videoLayers.some((layer) => layer.length > 0) || audioLayers.some((layer) => layer.length > 0)) {
      preloadMedia();
    }
  }, [videoLayers, audioLayers]);

  const handleVideoUpload = async (event) => {
    const files = Array.from(event.target.files);
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
      formData.append('titles', file.name);
    });
    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/videos/upload/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
      });
      const newVideos = response.data;
      if (newVideos) await fetchVideos();
    } catch (error) {
      console.error('Error uploading video:', error);
    } finally {
      setUploading(false);
    }
  };

  const fetchElements = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found in localStorage');
          setElements([]);
          return;
        }

        const response = await axios.get(`${API_BASE_URL}/api/global-elements`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log('Global elements response:', response.data); // Debug response

        const updatedElements = response.data
          .filter((element) => element.fileName && typeof element.fileName === 'string') // Filter valid elements
          .map((element) => {
            if (!element.fileName) {
              console.warn('Element with missing fileName:', element);
            }
            return {
              id: element.id || `element-${element.fileName || 'unknown'}-${Date.now()}`,
              fileName: element.fileName || 'unknown.png', // Fallback
              displayName: element.fileName || 'Untitled Element', // Use fileName directly
              filePath: `${API_BASE_URL}/api/global-elements/${encodeURIComponent(element.fileName || 'unknown.png')}`,
              thumbnail: `${API_BASE_URL}/api/global-elements/${encodeURIComponent(element.fileName || 'unknown.png')}`,
            };
          });

        setElements(updatedElements);
      } catch (error) {
        console.error('Error fetching global elements:', error);
        if (error.response?.status === 401) {
          alert('Session expired. Please log in again.');
          navigate('/login');
        } else if (error.response?.status === 403) {
          alert('You do not have permission to fetch elements. Please contact support.');
        } else {
          alert('Failed to fetch global elements. Please try again.');
        }
        setElements([]);
      }
    };

    const handleAudioUpload = async (event) => {
      const files = Array.from(event.target.files);
      if (files.length === 0) return;

      const formData = new FormData();
      files.forEach((file) => {
        formData.append('audio', file);
        formData.append('audioFileNames', file.name);
      });

      try {
        setUploading(true);
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/upload-audio`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` } }
        );
        const { project, audioFiles } = response.data;

        // Update state with audioFiles from response
        if (audioFiles && Array.isArray(audioFiles)) {
          const updatedAudios = audioFiles.map((audio) => {
            const fullFileName = audio.audioFileName.split('/').pop();
            const originalFileName = fullFileName.replace(`${projectId}_`, '').replace(/^\d+_/, '');
            return {
              id: audio.audioPath || `audio-${fullFileName}-${Date.now()}`,
              fileName: fullFileName,
              displayName: originalFileName,
              audioPath: `${API_BASE_URL}/projects/${projectId}/audio/${encodeURIComponent(fullFileName)}`,
              waveformImage: audio.waveformPath
                ? `${API_BASE_URL}/projects/${projectId}/waveforms/${encodeURIComponent(audio.waveformPath.split('/').pop())}`
                : '/images/audio.jpeg',
            };
          });
          setAudios(updatedAudios);
        }

        // Fetch audios to ensure consistency
        if (project) await fetchAudios();
      } catch (error) {
        console.error('Error uploading audio files:', error);
        alert('Failed to upload one or more audio files. Please try again.');
      } finally {
        setUploading(false);
      }
    };

  const generateVideoThumbnail = async (video) => {
    if (!video || (!video.filePath && !video.filename)) return;
    if (video.thumbnail) return;
    let path = video.filePath || video.filename;
    if (path.startsWith('videos/')) path = path.substring(7);
    const videoUrl = `${API_BASE_URL}/videos/${encodeURIComponent(path)}`;
    try {
      const videoElement = document.createElement('video');
      videoElement.crossOrigin = 'anonymous';
      videoElement.src = videoUrl;
      await new Promise((resolve, reject) => {
        videoElement.onloadeddata = resolve;
        videoElement.onerror = reject;
        setTimeout(resolve, 5000);
      });
      const seekTime = Math.min(1, (video.duration || 0) * 0.25);
      videoElement.currentTime = seekTime;
      await new Promise((resolve) => {
        videoElement.onseeked = resolve;
        setTimeout(resolve, 2000);
      });
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg');
      video.thumbnail = thumbnail;
      setVideos((prevVideos) =>
        prevVideos.map((v) =>
          (v.filePath || v.ipath) === (video.filePath || video.filename) ? { ...v, thumbnail } : v
        )
      );
    } catch (error) {
      console.error('Error creating thumbnail for video:', path, error);
    }
  };

  const handleSaveProject = async () => {
    if (!projectId || !sessionId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/projects/${projectId}/save`,
        {},
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Project saved successfully!');
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project. Please try again.');
    }
  };

  const handleExportProject = async () => {
    if (!projectId || !sessionId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/export`,
        {},
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );
      const exportedFileName = response.data;
      alert(`Project exported successfully as ${exportedFileName}!`);
    } catch (error) {
      console.error('Error exporting project:', error);
      alert('Failed to export project. Please try again.');
    }
  };

  const handleMediaDragStart = (e, media, type) => {
    const mediaId = media.id || `media-${media.filePath || media.fileName || media.filename || media.imageFileName || media.displayName}-${Date.now()}`;
    const dragData = {
      type: type,
      isDragOperation: true,
      [type === 'media' ? 'video' : type === 'photo' ? 'photo' : type === 'audio' ? 'audio' : 'element']: {
        id: mediaId,
        filePath: type === 'media' ? (media.filePath || media.filename) : undefined,
        fileName: type === 'audio' || type === 'photo' || type === 'element' ? media.fileName : undefined,
        displayPath: media.displayPath || media.displayName || (media.filePath || media.fileName || media.filename || media.imageFileName || media.displayName)?.split('/').pop(),
        duration: media.duration || 5,
        thumbnail: media.thumbnail || (type === 'photo' || type === 'element' ? media.filePath : undefined),
      },
    };
    const jsonString = JSON.stringify(dragData);
    e.dataTransfer.setData('application/json', jsonString);
    e.dataTransfer.setData('text/plain', jsonString);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleTextStyleDragStart = (e, style) => {
    const dragData = {
      type: 'textStyle',
      textStyle: {
        ...style,
        id: `text-style-${Date.now()}`,
      },
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleTextStyleClick = async (style) => {
    if (!sessionId || !projectId || uploading) return;
    try {
      const token = localStorage.getItem('token');
      let startTime = roundToThreeDecimals(currentTime);
      let maxEndTime = 0;
      videoLayers.forEach((layer) => {
        layer.forEach((segment) => {
          const segmentEndTime = segment.startTime + segment.duration;
          if (segmentEndTime > maxEndTime) maxEndTime = segmentEndTime;
        });
      });
      startTime = Math.max(startTime, maxEndTime);

      const duration = style.duration || 5;

      // Create temporary segment with UUID
      const tempSegmentId = `temp-${uuidv4()}`;
      const tempSegment = {
        id: tempSegmentId,
        type: 'text',
        text: style.text,
        startTime: roundToThreeDecimals(startTime),
        duration: duration,
        layer: 0,
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
        backgroundH: style.backgroundH ?? 0,
        backgroundW: style.backgroundW ?? 0,
        backgroundBorderRadius: style.backgroundBorderRadius ?? 0,
        textBorderColor: style.textBorderColor || 'transparent', // Added
        textBorderWidth: style.textBorderWidth ?? 0, // Added
        textBorderOpacity: style.textBorderOpacity ?? 1.0, // Added
        keyframes: {},
      };

      // Add temporary segment to videoLayers
      let updatedVideoLayers = videoLayers;
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[0] = [...(newLayers[0] || []), tempSegment];
        updatedVideoLayers = newLayers;
        return newLayers;
      });

      // Make API call
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-text`,
        {
          text: style.text,
          layer: 0,
          timelineStartTime: roundToThreeDecimals(startTime),
          timelineEndTime: roundToThreeDecimals(startTime + duration),
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
          backgroundH: style.backgroundH ?? 0,
          backgroundW: style.backgroundW ?? 0,
          backgroundBorderRadius: style.backgroundBorderRadius ?? 0,
          textBorderColor: style.textBorderColor || 'transparent', // Added
          textBorderWidth: style.textBorderWidth ?? 0, // Added
          textBorderOpacity: style.textBorderOpacity ?? 1.0, // Added
        },
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );

      const newTextSegment = response.data;

      // Validate response
      if (!newTextSegment.textSegmentId) {
        throw new Error('Backend did not return textSegmentId');
      }

      // Update temporary segment with backend data
      const updatedSegment = {
        id: newTextSegment.textSegmentId,
        type: 'text',
        text: newTextSegment.text,
        startTime: roundToThreeDecimals(newTextSegment.timelineStartTime),
        duration: roundToThreeDecimals(newTextSegment.timelineEndTime - newTextSegment.timelineStartTime),
        layer: newTextSegment.layer,
        fontFamily: newTextSegment.fontFamily,
        scale: newTextSegment.scale || 1.0,
        fontColor: newTextSegment.fontColor,
        backgroundColor: newTextSegment.backgroundColor,
        positionX: newTextSegment.positionX || 0,
        positionY: newTextSegment.positionY || 0,
        alignment: newTextSegment.alignment,
        backgroundOpacity: newTextSegment.backgroundOpacity ?? 1.0,
        backgroundBorderWidth: newTextSegment.backgroundBorderWidth ?? 0,
        backgroundBorderColor: newTextSegment.backgroundBorderColor || '#000000',
        backgroundH: newTextSegment.backgroundH ?? 0,
        backgroundW: newTextSegment.backgroundW ?? 0,
        backgroundBorderRadius: newTextSegment.backgroundBorderRadius ?? 0,
        textBorderColor: newTextSegment.textBorderColor || 'transparent', // Added
        textBorderWidth: newTextSegment.textBorderWidth ?? 0, // Added
        textBorderOpacity: newTextSegment.textBorderOpacity ?? 1.0, // Added
        keyframes: newTextSegment.keyframes || {},
      };

      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[0] = newLayers[0].map((item) =>
          item.id === tempSegmentId ? updatedSegment : item
        );
        updatedVideoLayers = newLayers;
        return newLayers;
      });

      setTotalDuration((prev) => Math.max(prev, startTime + duration));
      setSelectedSegment(updatedSegment);
      setEditingTextSegment(updatedSegment);
      setTextSettings({
        text: updatedSegment.text,
        fontFamily: updatedSegment.fontFamily,
        scale: updatedSegment.scale,
        fontColor: updatedSegment.fontColor,
        backgroundColor: updatedSegment.backgroundColor,
        duration: updatedSegment.duration,
        alignment: updatedSegment.alignment,
        backgroundOpacity: updatedSegment.backgroundOpacity,
        backgroundBorderWidth: updatedSegment.backgroundBorderWidth,
        backgroundBorderColor: updatedSegment.backgroundBorderColor,
        backgroundH: updatedSegment.backgroundH,
        backgroundW: updatedSegment.backgroundW,
        backgroundBorderRadius: updatedSegment.backgroundBorderRadius,
        textBorderColor: updatedSegment.textBorderColor, // Added
        textBorderWidth: updatedSegment.textBorderWidth, // Added
        textBorderOpacity: updatedSegment.textBorderOpacity, // Added
      });
      setIsTextToolOpen(true);
      preloadMedia();
      saveHistory();

      // Trigger auto-save
      setTimeout(() => {
        autoSaveProject(updatedVideoLayers, audioLayers);
      }, 1000);
    } catch (error) {
      console.error('Error adding text style to timeline:', error);
      alert('Failed to add text style to timeline. Please try again.');
    }
  };

  const handleVideoClick = debounce(async (video, isDragEvent = false) => {
    if (isDragEvent) return;
    setSelectedVideo(video);
    if (!sessionId || !projectId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
        params: { sessionId },
        headers: { Authorization: `Bearer ${token}` },
      });
      let timelineState =
        response.data.timelineState
          ? typeof response.data.timelineState === 'string'
            ? JSON.parse(response.data.timelineState)
            : response.data.timelineState
          : { segments: [], textSegments: [], imageSegments: [] };

      let endTime = 0;
      const allSegments = [
        ...(timelineState.segments || []),
      ...(timelineState.textSegments || []),
      ...(timelineState.imageSegments || []),
    ];
    if (allSegments.length > 0) {
      allSegments.forEach((segment) => {
        const segmentEndTime = segment.timelineStartTime + (segment.timelineEndTime - segment.timelineStartTime);
        if (segmentEndTime > endTime) endTime = segmentEndTime;
      });
    }

    const timelineStartTime = endTime;
    let selectedLayer = findAvailableLayer(timelineStartTime, null, videoLayers);

    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      while (newLayers.length <= selectedLayer) {
        newLayers.push([]);
      }
      return newLayers;
    });

    const newSegment = await addVideoToTimeline(
      video.filePath || video.filename,
      selectedLayer,
      timelineStartTime,
      null,
      0,
      null
    );

    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      while (newLayers.length <= selectedLayer) newLayers.push([]);
      const exists = newLayers[selectedLayer].some((segment) => segment.id === newSegment.id);
      if (!exists) {
        newLayers[selectedLayer].push(newSegment);
      } else {
        console.warn(`Segment with id ${newSegment.id} already exists in layer ${selectedLayer}`);
      }
      return newLayers;
    });

    const segmentDuration = newSegment.timelineEndTime - newSegment.timelineStartTime;
    setTotalDuration((prev) => Math.max(prev, timelineStartTime + segmentDuration));
  } catch (error) {
    console.error('Error adding video to timeline:', error);
    alert('Failed to add video to timeline. Please try again.');
  }
}, 300);

  const addImageToTimeline = async (imageFileName, layer, timelineStartTime, timelineEndTime, isElement = false) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/add-project-image-to-timeline`,
        {
          imageFileName,
          layer: layer || 0,
          timelineStartTime: timelineStartTime || 0,
          timelineEndTime: timelineEndTime || timelineStartTime + 5,
          isElement,
        },
        { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
      );

      const newImageSegment = response.data;
      if (!newImageSegment) {
        throw new Error(`Failed to add image segment for ${imageFileName}`);
      }

      const photo = photos.find((p) => p.fileName === imageFileName);
      if (!photo && !isElement) {
        throw new Error(`Photo with fileName ${imageFileName} not found`);
      }

      // Ensure isElement is set based on the input parameter
      const newSegment = {
        id: newImageSegment.id,
        type: 'image',
        fileName: imageFileName,
        filePath: isElement
          ? `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(imageFileName)}`
          : photo?.filePath,
        startTime: newImageSegment.timelineStartTime,
        duration: newImageSegment.timelineEndTime - newImageSegment.timelineStartTime,
        layer: layer || 0,
        positionX: newImageSegment.positionX || 0,
        positionY: newImageSegment.positionY || 0,
        scale: newImageSegment.scale || 1,
        opacity: newImageSegment.opacity || 1,
        filters: newImageSegment.filters || [],
        keyframes: newImageSegment.keyframes || {},
        thumbnail: photo?.thumbnail,
        isElement: isElement || newImageSegment.element || false, // Explicitly set isElement
      };

      let updatedVideoLayers = videoLayers;
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        while (newLayers.length <= layer) newLayers.push([]);
        const exists = newLayers[layer].some((segment) => segment.id === newSegment.id);
        if (!exists) {
          newLayers[layer].push(newSegment);
        } else {
          console.warn(`Segment with id ${newSegment.id} already exists in layer ${layer}`);
        }
        updatedVideoLayers = newLayers;
        return newLayers;
      });

      setTotalDuration((prev) => Math.max(prev, newSegment.startTime + newSegment.duration));
      preloadMedia();

      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        autoSaveProject(updatedVideoLayers, audioLayers);
      }, 1000);

      saveHistory();
      return newSegment;
    } catch (error) {
      console.error('Error adding image to timeline:', error);
      throw error;
    }
  };

const addVideoToTimeline = async (videoPath, layer, timelineStartTime, timelineEndTime, startTimeWithinVideo, endTimeWithinVideo) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/add-to-timeline`,
      {
        videoPath,
        layer: layer || 0,
        timelineStartTime: timelineStartTime || 0,
        timelineEndTime: timelineEndTime || null,
        startTime: startTimeWithinVideo || 0,
        endTime: endTimeWithinVideo || null,
      },
      { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
    );
    const { videoSegmentId, audioSegmentId } = response.data;

    const segmentResponse = await axios.get(
      `${API_BASE_URL}/projects/${projectId}/get-segment`,
      {
        params: { sessionId, segmentId: videoSegmentId },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const videoSegment = segmentResponse.data.videoSegment;
    if (!videoSegment) {
      throw new Error(`Newly created video segment ${videoSegmentId} not found`);
    }

    const video = videos.find((v) => (v.filePath || v.filename) === videoPath);
    if (!video) {
      throw new Error(`Video with path ${videoPath} not found in videos list`);
    }

    const newSegment = {
      id: videoSegment.id,
      type: 'video',
      startTime: videoSegment.timelineStartTime,
      duration: videoSegment.timelineEndTime - videoSegment.timelineStartTime,
      filePath: videoSegment.filename || videoPath,
      layer: layer || 0,
      positionX: videoSegment.positionX || 0,
      positionY: videoSegment.positionY || 0,
      scale: videoSegment.scale || 1,
      startTimeWithinVideo: videoSegment.startTime || 0,
      endTimeWithinVideo: videoSegment.endTime || (videoSegment.timelineEndTime - videoSegment.timelineStartTime),
      thumbnail: video.thumbnail,
      filters: videoSegment.filters || [],
      audioSegmentId: audioSegmentId || null,
    };

    let updatedVideoLayers = videoLayers;
    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      while (newLayers.length <= layer) newLayers.push([]);
      newLayers[layer] = [...newLayers[layer], newSegment];
      updatedVideoLayers = newLayers;
      return newLayers;
    });

    let updatedAudioLayers = audioLayers;
    if (audioSegmentId && segmentResponse.data.audioSegment) {
      const audioSegment = segmentResponse.data.audioSegment;
      const audioLayerIndex = Math.abs(audioSegment.layer) - 1;
      const newAudioSegment = {
        id: audioSegment.id,
        type: 'audio',
        fileName: audioSegment.audioFileName || audioSegment.audioPath.split('/').pop(),
        startTime: audioSegment.timelineStartTime,
        duration: audioSegment.timelineEndTime - audioSegment.timelineStartTime,
        timelineStartTime: audioSegment.timelineStartTime,
        timelineEndTime: audioSegment.timelineEndTime,
        startTimeWithinAudio: audioSegment.startTime || 0,
        endTimeWithinAudio: audioSegment.endTime || (audioSegment.timelineEndTime - audioSegment.timelineStartTime),
        layer: audioSegment.layer,
        displayName: audioSegment.audioPath
          ? audioSegment.audioPath.split('/').pop()
          : audioSegment.audioFileName,
        waveformImage: '/images/audio.jpeg',
        volume: audioSegment.volume || 1.0,
      };

      setAudioLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        while (newLayers.length <= audioLayerIndex) newLayers.push([]);
        newLayers[audioLayerIndex] = [...newLayers[audioLayerIndex], newAudioSegment];
        updatedAudioLayers = newLayers;
        return newLayers;
      });
    }

    setTotalDuration((prev) => Math.max(prev, newSegment.startTime + newSegment.duration));
    preloadMedia();

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      autoSaveProject(updatedVideoLayers, updatedAudioLayers);
    }, 1000);

    saveHistory();
    return newSegment;
  } catch (error) {
    console.error('Error adding video to timeline:', error);
    throw error;
  }
};

const handleTimeUpdate = (newTime, updatePlayhead = true) => {
  const clampedTime = Math.max(0, Math.min(totalDuration, newTime));
  setCurrentTime(clampedTime);
  if (updatePlayhead && timelineSetPlayhead) {
    timelineSetPlayhead(clampedTime, false);
  }
};

const handleDeleteSegment = async () => {
  if (!selectedSegment || !sessionId || !projectId) return;

  try {
    const token = localStorage.getItem('token');
    let endpoint = '';
    switch (selectedSegment.type) {
      case 'video':
        endpoint = `${API_BASE_URL}/projects/timeline/video/${sessionId}/${selectedSegment.id}`;
        break;
      case 'audio':
        endpoint = `${API_BASE_URL}/projects/timeline/audio/${sessionId}/${selectedSegment.id}`;
        break;
      case 'image':
        endpoint = `${API_BASE_URL}/projects/timeline/image/${sessionId}/${selectedSegment.id}`;
        break;
      case 'text':
        endpoint = `${API_BASE_URL}/projects/timeline/text/${sessionId}/${selectedSegment.id}`;
        break;
      default:
        console.error('Unknown segment type:', selectedSegment.type);
        return;
    }

    await axios.delete(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const transitionsToDelete = transitions.filter(
      (transition) => transition.segmentId === selectedSegment.id
    );

    for (const transition of transitionsToDelete) {
      try {
        await axios.delete(
          `${API_BASE_URL}/projects/${projectId}/remove-transition`,
          {
            params: { sessionId, transitionId: transition.id },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (error) {
        console.error(`Error deleting transition ${transition.id}:`, error);
      }
    }

    let updatedVideoLayers = videoLayers;
    let updatedAudioLayers = audioLayers;
    if (selectedSegment.type === 'audio') {
      setAudioLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        const layerIndex = Math.abs(selectedSegment.layer) - 1;
        newLayers[layerIndex] = newLayers[layerIndex].filter(
          (item) => item.id !== selectedSegment.id
        );
        updatedAudioLayers = newLayers;
        return newLayers;
      });
    } else {
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[selectedSegment.layer] = newLayers[selectedSegment.layer].filter(
          (item) => item.id !== selectedSegment.id
        );
        updatedVideoLayers = newLayers;
        return newLayers;
      });
    }

    setTransitions((prevTransitions) =>
      prevTransitions.filter(
        (transition) => transition.segmentId !== selectedSegment.id
      )
    );

    const allLayers = [...updatedVideoLayers, ...updatedAudioLayers];
    let maxEndTime = 0;
    allLayers.forEach((layer) => {
      layer.forEach((item) => {
        const endTime = item.startTime + item.duration;
        if (endTime > maxEndTime) maxEndTime = endTime;
      });
    });
    setTotalDuration(maxEndTime);

    setSelectedSegment(null);
    setIsTextToolOpen(false);
    setIsTransformOpen(false);
    setIsFiltersOpen(false);
    preloadMedia();

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      autoSaveProject(updatedVideoLayers, updatedAudioLayers);
    }, 1000);
  } catch (error) {
    console.error('Error deleting segment:', error);
    alert('Failed to delete segment. Please try again.');
  }
};

useEffect(() => {
  const frameDuration = 1 / projectFps;
  const handleKeyDown = (e) => {
    if (!isPlaying) {
      if (e.key === 'ArrowLeft') {
        handleTimeUpdate(Math.max(0, currentTime - frameDuration), true);
      } else if (e.key === 'ArrowRight') {
        handleTimeUpdate(Math.min(totalDuration, currentTime + frameDuration), true);
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isPlaying, totalDuration, currentTime, selectedSegment, projectFps]);

useEffect(() => {
  if (isPlaying && currentTime >= totalDuration) {
    setIsPlaying(false);
    setCurrentTime(totalDuration);
  }
}, [currentTime, isPlaying, totalDuration]);

const handleMouseDown = (e) => {
  e.preventDefault();
  setIsDraggingHandle(true);
};

const handleMouseMove = (e) => {
  if (!isDraggingHandle) return;
  const contentWrapper = document.querySelector('.content-wrapper');
  const wrapperHeight = contentWrapper.clientHeight;
  const controlsPanelHeight = 60;
  const resizeHandleHeight = 6;
  const zoomSliderHeight = 40;
  const previewMarginTotal = 40;
  const mouseY = e.clientY;
  const wrapperTop = contentWrapper.getBoundingClientRect().top;
  const distanceFromTop = mouseY - wrapperTop;

  const availableHeight = wrapperHeight - controlsPanelHeight - resizeHandleHeight - zoomSliderHeight - previewMarginTotal;

  const previewHeightPx = distanceFromTop - resizeHandleHeight - 20;
  const minPreviewHeight = 100;
  const maxPreviewHeight = availableHeight - 150;
  const clampedPreviewHeight = Math.max(minPreviewHeight, Math.min(maxPreviewHeight, previewHeightPx));

  const remainingHeight = availableHeight - clampedPreviewHeight;
  const timelineHeightPercent = (remainingHeight / availableHeight) * 100;
  const minTimelineHeight = 10;
  const maxTimelineHeight = 50;
  const clampedTimelineHeight = Math.max(minTimelineHeight, Math.min(maxTimelineHeight, timelineHeightPercent));

  setPreviewHeight(`${clampedPreviewHeight}px`);
  setTimelineHeight(clampedTimelineHeight);
};

const handleMouseUp = () => setIsDraggingHandle(false);

useEffect(() => {
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDraggingHandle]);

const toggleSection = (section) => setExpandedSection(expandedSection === section ? null : section);

const handleSegmentSelect = async (segment) => {
    setSelectedSegment(segment);
    if (segment) {
      let initialValues = {};
      switch (segment.type) {
        case 'video':
        case 'image':
          initialValues = {
            positionX: segment.positionX || 0,
            positionY: segment.positionY || 0,
            scale: segment.scale || 1,
            opacity: segment.opacity || 1,
            cropL: segment.cropL !== undefined ? segment.cropL : 0, // Keep in 0-100
            cropR: segment.cropR !== undefined ? segment.cropR : 0,
            cropT: segment.cropT !== undefined ? segment.cropT : 0,
            cropB: segment.cropB !== undefined ? segment.cropB : 0,
          };
          break;
        case 'text':
          initialValues = {
            positionX: segment.positionX || 0,
            positionY: segment.positionY || 0,
            scale: segment.scale || 1,
            opacity: segment.opacity || 1,
          };
          break;
        case 'audio':
          initialValues = {
            volume: segment.volume || 1.0,
          };
          break;
        default:
          break;
      }

      // Fetch keyframes and ensure they're set correctly
      const segmentData = await fetchKeyframes(segment.id, segment.type);
      const keyframesData = segmentData?.keyframes || {};
      console.log(`Setting keyframes for ${segment.type} ${segment.id}:`, keyframesData);

      // Calculate relative time
      const relativeTime = currentTime - segment.startTime;
      setCurrentTimeInSegment(Math.max(0, Math.min(segment.duration, relativeTime)));

      // Update initialValues with keyframe values
      Object.keys(keyframesData).forEach((prop) => {
        const propKeyframes = keyframesData[prop] || [];
        if (propKeyframes.length > 0) {
          const value = getValueAtTime(propKeyframes, currentTimeInSegment);
          if (value !== null) {
            initialValues[prop] = value;
          }
        }
      });

      console.log('Initial tempSegmentValues:', initialValues);
      setTempSegmentValues(initialValues);

      // Update layers with keyframes
      if (segment.type !== 'audio') {
        setVideoLayers((prevLayers) => {
          const newLayers = [...prevLayers];
          newLayers[segment.layer] = newLayers[segment.layer].map((item) =>
            item.id === segment.id ? { ...item, keyframes: keyframesData } : item
          );
          console.log(`Updated videoLayers[${segment.layer}] for ${segment.id}:`, newLayers[segment.layer]);
          return newLayers;
        });
      } else {
        setAudioLayers((prevLayers) => {
          const newLayers = [...prevLayers];
          const layerIndex = Math.abs(segment.layer) - 1;
          newLayers[layerIndex] = newLayers[layerIndex].map((item) =>
            item.id === segment.id ? { ...item, keyframes: keyframesData } : item
          );
          return newLayers;
        });
      }

      // Fetch filters for video/image
      if (segment.type === 'video' || segment.type === 'image') {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(
            `${API_BASE_URL}/projects/${projectId}/segments/${segment.id}/filters`,
            {
              params: { sessionId },
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const filters = response.data || [];
          setAppliedFilters(filters);

          const initialFilterParams = {
            brightness: 0,
            contrast: 1,
            saturation: 1,
            hue: 0,
            blur: 0,
            sharpen: 0,
          };
          filters.forEach((filter) => {
            initialFilterParams[filter.filterName] =
              parseFloat(filter.filterValue) || initialFilterParams[filter.filterName];
          });
          setFilterParams(initialFilterParams);

          setVideoLayers((prevLayers) => {
            const newLayers = [...prevLayers];
            newLayers[segment.layer] = newLayers[segment.layer].map((item) =>
              item.id === segment.id ? { ...item, filters } : item
            );
            return newLayers;
          });

          // Force re-render of VideoPreview to ensure filters are applied
          setCurrentTime((prev) => prev + 0);
        } catch (error) {
          console.error('Error fetching filters for segment:', error);
          setAppliedFilters([]);
          setFilterParams({
            brightness: 0,
            contrast: 1,
            saturation: 1,
            hue: 0,
            blur: 0,
            sharpen: 0,
          });
        }
      } else {
        setAppliedFilters([]);
        setFilterParams({
          brightness: 0,
          contrast: 1,
          saturation: 1,
          hue: 0,
          blur: 0,
          sharpen: 0,
        });
      }
      await fetchTransitions();
    } else {
      setTempSegmentValues({});
      setAppliedFilters([]);
      setFilterParams({
        brightness: 0,
        contrast: 1,
        saturation: 1,
        hue: 0,
        blur: 0,
        sharpen: 0,
      });
      setKeyframes({});
      setCurrentTimeInSegment(0);
    }
    handleTextSegmentSelect(segment);
  };

const fetchKeyframes = async (segmentId, segmentType) => {
  try {
    const token = localStorage.getItem('token');
    let response;
    switch (segmentType) {
      case 'video':
      case 'image':
      case 'text':
      case 'audio':
        response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
          params: { sessionId },
          headers: { Authorization: `Bearer ${token}` },
        });
        const timelineState =
          typeof response.data.timelineState === 'string'
            ? JSON.parse(response.data.timelineState)
            : response.data.timelineState;
        let segments;
        if (segmentType === 'video') {
          segments = timelineState.segments || [];
        } else if (segmentType === 'image') {
          segments = timelineState.imageSegments || [];
        } else if (segmentType === 'text') {
          segments = timelineState.textSegments || [];
        } else {
          segments = timelineState.audioSegments || [];
        }
        const segment = segments.find((s) => s.id === segmentId);
        response = { data: segment || {} };
        break;
      default:
        throw new Error('Invalid segment type');
    }
    const segmentData = response.data;
    console.log(`Fetched keyframes for ${segmentType} segment ${segmentId}:`, segmentData.keyframes);
    const keyframesData = segmentData?.keyframes || {};
    setKeyframes(keyframesData);
    return segmentData;
  } catch (error) {
    console.error(`Error fetching keyframes for ${segmentType}:`, error);
    setKeyframes({});
    return null;
  }
};

const getValueAtTime = (keyframesArray, time) => {
  if (!keyframesArray || keyframesArray.length === 0) return null;
  const sorted = [...keyframesArray].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) {
      const t = (time - sorted[i].time) / (sorted[i + 1].time - sorted[i].time);
      return sorted[i].value + t * (sorted[i + 1].value - sorted[i].value);
    }
  }
  return sorted[0].value;
};

const addKeyframe = async (property, value) => {
  if (!selectedSegment) return;
  const time = currentTimeInSegment;

  const currentKeyframes = keyframes || {};
  const updatedPropertyKeyframes = (currentKeyframes[property] || []).filter(
    (kf) => !areTimesEqual(kf.time, time)
  );
  updatedPropertyKeyframes.push({ time, value, interpolationType: 'linear' });
  updatedPropertyKeyframes.sort((a, b) => a.time - b.time);

  const updatedKeyframes = {
    ...currentKeyframes,
    [property]: updatedPropertyKeyframes,
  };

  setKeyframes(updatedKeyframes);

  let updatedVideoLayers = videoLayers;
  let updatedAudioLayers = audioLayers;
  if (selectedSegment.type === 'audio') {
    setAudioLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      const layerIndex = Math.abs(selectedSegment.layer) - 1;
      newLayers[layerIndex] = newLayers[layerIndex].map((item) =>
        item.id === selectedSegment.id ? { ...item, keyframes: updatedKeyframes } : item
      );
      updatedAudioLayers = newLayers;
      return newLayers;
    });
  } else {
    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      newLayers[selectedSegment.layer] = newLayers[selectedSegment.layer].map((item) =>
        item.id === selectedSegment.id ? { ...item, keyframes: updatedKeyframes } : item
      );
      updatedVideoLayers = newLayers;
      return newLayers;
    });
  }

  setTempSegmentValues((prev) => ({
    ...prev,
    [property]: value,
  }));

  try {
    const token = localStorage.getItem('token');
    await axios.post(
      `${API_BASE_URL}/projects/${projectId}/add-keyframe`,
      {
        segmentId: selectedSegment.id,
        segmentType: selectedSegment.type,
        property,
        time,
        value,
        interpolationType: 'linear',
      },
      { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
    );

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      autoSaveProject(updatedVideoLayers, updatedAudioLayers);
    }, 1000);
  } catch (error) {
    console.error('Error adding keyframe:', error);
  }
};

const removeKeyframe = async (property, time) => {
  if (!selectedSegment) return;
  try {
    const token = localStorage.getItem('token');
    await axios.delete(`${API_BASE_URL}/projects/${projectId}/remove-keyframe`, {
      params: {
        sessionId,
        segmentId: selectedSegment.id,
        segmentType: selectedSegment.type,
        property,
        time,
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    const updatedKeyframes = {
      ...keyframes,
      [property]: (keyframes[property] || []).filter((kf) => !areTimesEqual(kf.time, time)),
    };
    setKeyframes(updatedKeyframes);

    let updatedVideoLayers = videoLayers;
    let updatedAudioLayers = audioLayers;
    if (selectedSegment.type === 'audio') {
      setAudioLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        const layerIndex = Math.abs(selectedSegment.layer) - 1;
        newLayers[layerIndex] = newLayers[layerIndex].map((item) =>
          item.id === selectedSegment.id ? { ...item, keyframes: updatedKeyframes } : item
        );
        updatedAudioLayers = newLayers;
        return newLayers;
      });
    } else {
      setVideoLayers((prevLayers) => {
        const newLayers = [...prevLayers];
        newLayers[selectedSegment.layer] = newLayers[selectedSegment.layer].map((item) =>
          item.id === selectedSegment.id ? { ...item, keyframes: updatedKeyframes } : item
        );
        updatedVideoLayers = newLayers;
        return newLayers;
      });
    }

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      autoSaveProject(updatedVideoLayers, updatedAudioLayers);
    }, 1000);

    await fetchKeyframes(selectedSegment.id, selectedSegment.type);
  } catch (error) {
    console.error('Error removing keyframe:', error);
  }
};

const toggleKeyframe = (property) => {
  const currentKeyframes = keyframes[property] || [];
  const keyframeAtTime = currentKeyframes.find((kf) => areTimesEqual(kf.time, currentTimeInSegment));
  if (keyframeAtTime) {
    removeKeyframe(property, currentTimeInSegment);
  } else {
    const value = tempSegmentValues[property] !== undefined
      ? tempSegmentValues[property]
      : (currentKeyframes.length > 0
         ? getValueAtTime(currentKeyframes, currentTimeInSegment)
         : (property === 'scale' || property === 'opacity' ? 1 : 0));
    addKeyframe(property, value);
  }
};

const navigateKeyframes = (property, direction) => {
  if (!selectedSegment || !keyframes[property]) return;
  const sortedKeyframes = keyframes[property].sort((a, b) => a.time - b.time);
  const currentIndex = sortedKeyframes.findIndex((kf) => kf.time >= currentTimeInSegment);
  let newIndex;
  if (direction === 'prev') {
    newIndex = currentIndex === -1 ? sortedKeyframes.length - 1 : Math.max(0, currentIndex - 1);
  } else {
    newIndex = currentIndex === -1 ? 0 : Math.min(sortedKeyframes.length - 1, currentIndex + 1);
  }
  if (sortedKeyframes[newIndex]) {
    const newTime = sortedKeyframes[newIndex].time;
    setCurrentTimeInSegment(newTime);
    handleTimeUpdate(selectedSegment.startTime + newTime);
  }
};

const updateSegmentProperty = (property, value) => {
  setTempSegmentValues((prev) => {
    const newValues = { ...prev, [property]: value };
    console.log(`Updating ${property} to ${value}, new tempSegmentValues:`, newValues); // Debug log
    return newValues;
  });

  const targetLayers = selectedSegment.layer < 0 ? audioLayers : videoLayers;
  const layerIndex = selectedSegment.layer < 0 ? Math.abs(selectedSegment.layer) - 1 : selectedSegment.layer;
  const newLayers = targetLayers.map((layer, idx) =>
    idx === layerIndex
      ? layer.map((item) => (item.id === selectedSegment.id ? { ...item, [property]: value } : item))
      : layer
  );
  if (selectedSegment.layer < 0) {
    setAudioLayers(newLayers);
  } else {
    setVideoLayers(newLayers);
  }

  // Clear any existing timeout
  if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

  // Schedule save with the latest tempSegmentValues and keyframes
  updateTimeoutRef.current = setTimeout(() => {
    console.log(`Scheduling saveSegmentChanges for ${property}: ${value}`); // Debug log
    saveSegmentChanges(keyframes, { ...tempSegmentValues, [property]: value });
  }, 500);
};

const saveSegmentChanges = async (updatedKeyframes = keyframes, tempValues = tempSegmentValues) => {
  if (!selectedSegment || !sessionId || !projectId) {
    console.error('Cannot save segment changes: Missing required data', {
      selectedSegment,
      sessionId,
      projectId,
    });
    return;
  }

  console.log('Saving segment changes with tempValues:', tempValues); // Debug log

  try {
    const token = localStorage.getItem('token');
    let updatedVideoLayers = videoLayers;
    let updatedAudioLayers = audioLayers;

    switch (selectedSegment.type) {
      case 'video':
        const normalizedTempValues = {
          positionX: tempValues.positionX !== undefined ? Number(tempValues.positionX) : 0,
          positionY: tempValues.positionY !== undefined ? Number(tempValues.positionY) : 0,
          scale: tempValues.scale !== undefined ? Number(tempValues.scale) : 1,
          opacity: tempValues.opacity !== undefined ? Number(tempValues.opacity) : 1,
          cropL: tempValues.cropL !== undefined ? Number(tempValues.cropL) : 0,
          cropR: tempValues.cropR !== undefined ? Number(tempValues.cropR) : 0,
          cropT: tempValues.cropT !== undefined ? Number(tempValues.cropT) : 0,
          cropB: tempValues.cropB !== undefined ? Number(tempValues.cropB) : 0,
        };

        console.log('Normalized temp values for video:', normalizedTempValues);

        const videoPayload = {
          segmentId: selectedSegment.id || '',
          positionX: updatedKeyframes.positionX && updatedKeyframes.positionX.length > 0 ? undefined : normalizedTempValues.positionX,
          positionY: updatedKeyframes.positionY && updatedKeyframes.positionY.length > 0 ? undefined : normalizedTempValues.positionY,
          scale: updatedKeyframes.scale && updatedKeyframes.scale.length > 0 ? undefined : normalizedTempValues.scale,
          opacity: normalizedTempValues.opacity,
          layer: Number(selectedSegment.layer) || 0,
          timelineStartTime: Number(selectedSegment.startTime) || 0,
          timelineEndTime: Number(selectedSegment.startTime + selectedSegment.duration) || 0,
          startTime: Number(selectedSegment.startTimeWithinVideo) || 0,
          endTime: Number(selectedSegment.endTimeWithinVideo) || 0,
          cropL: normalizedTempValues.cropL,
          cropR: normalizedTempValues.cropR,
          cropT: normalizedTempValues.cropT,
          cropB: normalizedTempValues.cropB,
          keyframes: updatedKeyframes || {},
        };

        // Validate crop values
        const cropValues = [videoPayload.cropL, videoPayload.cropR, videoPayload.cropT, videoPayload.cropB];
        if (cropValues.some(val => val === undefined || val === null || isNaN(val) || val < 0 || val > 100)) {
          console.error('Invalid crop values in payload:', cropValues);
          throw new Error('Crop values must be valid numbers between 0 and 100');
        }
        if (videoPayload.cropL + videoPayload.cropR >= 100) {
          console.error('Crop left + right exceeds 100%:', videoPayload.cropL, videoPayload.cropR);
          throw new Error('Total crop (left + right) must be less than 100%');
        }
        if (videoPayload.cropT + videoPayload.cropB >= 100) {
          console.error('Crop top + bottom exceeds 100%:', videoPayload.cropT, videoPayload.cropB);
          throw new Error('Total crop (top + bottom) must be less than 100%');
        }

        console.log('Video segment payload:', JSON.stringify(videoPayload, null, 2));

        const videoResponse = await axios.put(
          `${API_BASE_URL}/projects/${projectId}/update-segment`,
          videoPayload,
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Server response for video segment update:', videoResponse.data);

        // Update videoLayers
        setVideoLayers((prev) => {
          const newLayers = [...prev];
          const layerIndex = selectedSegment.layer;
          const segmentIndex = newLayers[layerIndex].findIndex((s) => s.id === selectedSegment.id);
          if (segmentIndex !== -1) {
            newLayers[layerIndex][segmentIndex] = {
              ...newLayers[layerIndex][segmentIndex],
              cropL: videoPayload.cropL,
              cropR: videoPayload.cropR,
              cropT: videoPayload.cropT,
              cropB: videoPayload.cropB,
              positionX: videoPayload.positionX !== undefined ? videoPayload.positionX : newLayers[layerIndex][segmentIndex].positionX || 0,
              positionY: videoPayload.positionY !== undefined ? videoPayload.positionY : newLayers[layerIndex][segmentIndex].positionY || 0,
              scale: videoPayload.scale !== undefined ? videoPayload.scale : newLayers[layerIndex][segmentIndex].scale || 1,
              opacity: videoPayload.opacity !== undefined ? videoPayload.opacity : newLayers[layerIndex][segmentIndex].opacity || 1,
              startTime: videoPayload.timelineStartTime,
              duration: videoPayload.timelineEndTime - videoPayload.timelineStartTime,
              startTimeWithinVideo: videoPayload.startTime,
              endTimeWithinVideo: videoPayload.endTime,
              layer: videoPayload.layer,
              keyframes: videoPayload.keyframes,
            };
          }
          updatedVideoLayers = newLayers; // Update the variable for auto-save
          return newLayers;
        });
        break;

      case 'image':
        const normalizedImageValues = {
          positionX: tempValues.positionX !== undefined ? Number(tempValues.positionX) : 0,
          positionY: tempValues.positionY !== undefined ? Number(tempValues.positionY) : 0,
          scale: tempValues.scale !== undefined ? Number(tempValues.scale) : 1,
          opacity: tempValues.opacity !== undefined ? Number(tempValues.opacity) : 1,
          cropL: tempValues.cropL !== undefined ? Number(tempValues.cropL) : 0,
          cropR: tempValues.cropR !== undefined ? Number(tempValues.cropR) : 0,
          cropT: tempValues.cropT !== undefined ? Number(tempValues.cropT) : 0,
          cropB: tempValues.cropB !== undefined ? Number(tempValues.cropB) : 0,
        };

        const payload = {
          segmentId: selectedSegment.id || '',
          positionX: updatedKeyframes.positionX && updatedKeyframes.positionX.length > 0 ? undefined : normalizedImageValues.positionX,
          positionY: updatedKeyframes.positionY && updatedKeyframes.positionY.length > 0 ? undefined : normalizedImageValues.positionY,
          scale: updatedKeyframes.scale && updatedKeyframes.scale.length > 0 ? undefined : normalizedImageValues.scale,
          opacity: updatedKeyframes.opacity && updatedKeyframes.opacity.length > 0 ? undefined : normalizedImageValues.opacity,
          layer: Number(selectedSegment.layer) || 0,
          timelineStartTime: Number(selectedSegment.startTime) || 0,
          timelineEndTime: Number(selectedSegment.startTime + selectedSegment.duration) || 0,
          cropL: normalizedImageValues.cropL,
          cropR: normalizedImageValues.cropR,
          cropT: normalizedImageValues.cropT,
          cropB: normalizedImageValues.cropB,
          keyframes: updatedKeyframes || {},
          filters: Array.isArray(appliedFilters)
            ? appliedFilters.map(filter => ({
                filterName: filter.filterName,
                filterValue: String(filter.filterValue),
                filterId: filter.filterId
              }))
            : [],
          filtersToRemove: [],
        };

        // Validate crop values
        const imageCropValues = [payload.cropL, payload.cropR, payload.cropT, payload.cropB];
        if (imageCropValues.some(val => val === undefined || val === null || isNaN(val) || val < 0 || val > 100)) {
          console.error('Invalid crop values in image payload:', imageCropValues);
          throw new Error('Crop values must be valid numbers between 0 and 100');
        }
        if (payload.cropL + payload.cropR >= 100) {
          console.error('Crop left + right exceeds 100%:', payload.cropL, payload.cropR);
          throw new Error('Total crop (left + right) must be less than 100%');
        }
        if (payload.cropT + payload.cropB >= 100) {
          console.error('Crop top + bottom exceeds 100%:', payload.cropT, payload.cropB);
          throw new Error('Total crop (top + bottom) must be less than 100%');
        }

        console.log('Image segment payload:', JSON.stringify(payload, null, 2));

        const imageResponse = await axios.put(
          `${API_BASE_URL}/projects/${projectId}/update-image`,
          payload,
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Server response for image segment update:', imageResponse.data);

        // Update videoLayers
        setVideoLayers((prev) => {
          const newLayers = [...prev];
          const layerIndex = selectedSegment.layer;
          const segmentIndex = newLayers[layerIndex].findIndex(s => s.id === selectedSegment.id);
          if (segmentIndex !== -1) {
            newLayers[layerIndex][segmentIndex] = {
              ...newLayers[layerIndex][segmentIndex],
              cropL: payload.cropL,
              cropR: payload.cropR,
              cropT: payload.cropT,
              cropB: payload.cropB,
              positionX: payload.positionX !== undefined ? payload.positionX : newLayers[layerIndex][segmentIndex].positionX || 0,
              positionY: payload.positionY !== undefined ? payload.positionY : newLayers[layerIndex][segmentIndex].positionY || 0,
              scale: payload.scale !== undefined ? payload.scale : newLayers[layerIndex][segmentIndex].scale || 1,
              opacity: payload.opacity !== undefined ? payload.opacity : newLayers[layerIndex][segmentIndex].opacity || 1,
              startTime: payload.timelineStartTime,
              duration: payload.timelineEndTime - payload.timelineStartTime,
              layer: payload.layer,
              keyframes: payload.keyframes,
              filters: payload.filters,
            };
          }
          updatedVideoLayers = newLayers; // Update the variable for auto-save
          return newLayers;
        });
        break;

      case 'text':
        const textPayload = {
          segmentId: selectedSegment.id,
          text: textSettings.text,
          fontFamily: textSettings.fontFamily,
          fontColor: textSettings.fontColor,
          backgroundColor: textSettings.backgroundColor,
          timelineStartTime: selectedSegment.startTime,
          timelineEndTime: selectedSegment.startTime + textSettings.duration,
          layer: selectedSegment.layer,
          scale: updatedKeyframes.scale && updatedKeyframes.scale.length > 0 ? undefined : tempValues.scale,
          positionX: updatedKeyframes.positionX && updatedKeyframes.positionX.length > 0 ? undefined : tempValues.positionX,
          positionY: updatedKeyframes.positionY && updatedKeyframes.positionY.length > 0 ? undefined : tempValues.positionY,
          opacity: updatedKeyframes.opacity && updatedKeyframes.opacity.length > 0 ? undefined : tempValues.opacity,
          alignment: textSettings.alignment,
          backgroundOpacity: textSettings.backgroundOpacity,
          backgroundBorderWidth: textSettings.backgroundBorderWidth,
          backgroundBorderColor: textSettings.backgroundBorderColor,
          backgroundPadding: textSettings.backgroundPadding,
          backgroundBorderRadius: textSettings.backgroundBorderRadius,
          textBorderColor: textSettings.textBorderColor, // Added
          textBorderWidth: textSettings.textBorderWidth, // Added
          textBorderOpacity: textSettings.textBorderOpacity, // Added
          keyframes: updatedKeyframes,
        };

        console.log('Text segment payload:', JSON.stringify(textPayload, null, 2));

        await axios.put(
          `${API_BASE_URL}/projects/${projectId}/update-text`,
          textPayload,
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );

        // Update videoLayers
        setVideoLayers((prev) => {
          const newLayers = [...prev];
          const layerIndex = selectedSegment.layer;
          const segmentIndex = newLayers[layerIndex].findIndex((s) => s.id === selectedSegment.id);
          if (segmentIndex !== -1) {
            newLayers[layerIndex][segmentIndex] = {
              ...newLayers[layerIndex][segmentIndex],
              text: textPayload.text,
              fontFamily: textPayload.fontFamily,
              fontColor: textPayload.fontColor,
              backgroundColor: textPayload.backgroundColor,
              scale: textPayload.scale !== undefined ? textPayload.scale : newLayers[layerIndex][segmentIndex].scale || 1,
              positionX: textPayload.positionX !== undefined ? textPayload.positionX : newLayers[layerIndex][segmentIndex].positionX || 0,
              positionY: textPayload.positionY !== undefined ? textPayload.positionY : newLayers[layerIndex][segmentIndex].positionY || 0,
              opacity: textPayload.opacity !== undefined ? textPayload.opacity : newLayers[layerIndex][segmentIndex].opacity || 1,
              startTime: textPayload.timelineStartTime,
              duration: textPayload.timelineEndTime - textPayload.timelineStartTime,
              layer: textPayload.layer,
              alignment: textPayload.alignment,
              backgroundOpacity: textPayload.backgroundOpacity,
              backgroundBorderWidth: textPayload.backgroundBorderWidth,
              backgroundBorderColor: textPayload.backgroundBorderColor,
              backgroundPadding: textPayload.backgroundPadding,
              backgroundBorderRadius: textPayload.backgroundBorderRadius,
              textBorderColor: textPayload.textBorderColor, // Added
              textBorderWidth: textPayload.textBorderWidth, // Added
              textBorderOpacity: textPayload.textBorderOpacity, // Added
              keyframes: textPayload.keyframes,
            };
          }
          updatedVideoLayers = newLayers; // Update the variable for auto-save
          return newLayers;
        });
        break;

      case 'audio':
        const audioPayload = {
          audioSegmentId: selectedSegment.id,
          volume: updatedKeyframes.volume && updatedKeyframes.volume.length > 0 ? undefined : tempValues.volume,
          keyframes: updatedKeyframes,
        };

        console.log('Audio segment payload:', JSON.stringify(audioPayload, null, 2));

        await axios.put(
          `${API_BASE_URL}/projects/${projectId}/update-audio`,
          audioPayload,
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );

        // Update audioLayers
        setAudioLayers((prev) => {
          const newLayers = [...prev];
          const layerIndex = Math.abs(selectedSegment.layer) - 1;
          const segmentIndex = newLayers[layerIndex].findIndex((s) => s.id === selectedSegment.id);
          if (segmentIndex !== -1) {
            newLayers[layerIndex][segmentIndex] = {
              ...newLayers[layerIndex][segmentIndex],
              volume: audioPayload.volume !== undefined ? audioPayload.volume : newLayers[layerIndex][segmentIndex].volume || 1,
              keyframes: audioPayload.keyframes,
            };
          }
          updatedAudioLayers = newLayers; // Update the variable for auto-save
          return newLayers;
        });
        break;

      default:
        console.warn('Unknown segment type:', selectedSegment.type);
        return;
    }

    // Update history after successful save
    saveHistory();

    // Refresh keyframes after saving
    await fetchKeyframes(selectedSegment.id, selectedSegment.type);
    await fetchTransitions();
    preloadMedia();

    // Trigger auto-save of the project with updated layers
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      console.log('Triggering auto-save for project with updated layers:', {
        updatedVideoLayers,
        updatedAudioLayers,
      });
      autoSaveProject(updatedVideoLayers, updatedAudioLayers);
    }, 1000);
  } catch (error) {
    console.error('Error saving segment changes:', error);
    if (error.response) {
      console.error('Server error details:', error.response.data);
    }
    throw error;
  }
};

const handlePhotoUpload = async (event) => {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('image', file);
    formData.append('imageFileNames', file.name);
  });

  try {
    setUploading(true);
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/upload-image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` } }
    );
    const updatedProject = response.data;
    if (updatedProject) await fetchPhotos();
  } catch (error) {
    console.error('Error uploading images:', error);
    alert('Failed to upload one or more images. Please try again.');
  } finally {
    setUploading(false);
  }
};

const handlePhotoClick = async (photo, isDragEvent = false) => {
  if (uploading) return;
  if (isDragEvent) return;
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
      params: { sessionId },
      headers: { Authorization: `Bearer ${token}` },
    });
    let timelineState =
      response.data.timelineState
        ? typeof response.data.timelineState === 'string'
          ? JSON.parse(response.data.timelineState)
          : response.data.timelineState
        : { segments: [], textSegments: [], imageSegments: [] };

    let endTime = 0;
    const allSegments = [
      ...(timelineState.segments || []),
      ...(timelineState.textSegments || []),
      ...(timelineState.imageSegments || []),
    ];
    if (allSegments.length > 0) {
      allSegments.forEach((segment) => {
        const segmentEndTime = segment.timelineStartTime + (segment.timelineEndTime - segment.timelineStartTime);
        if (segmentEndTime > endTime) endTime = segmentEndTime;
      });
    }

    const timelineStartTime = endTime;
    const timelineEndTime = endTime + 5;

    let selectedLayer = findAvailableLayer(timelineStartTime, timelineEndTime, videoLayers);

    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      while (newLayers.length <= selectedLayer) {
        newLayers.push([]);
      }
      return newLayers;
    });

    const newSegment = await addImageToTimeline(
      photo.fileName,
      selectedLayer,
      timelineStartTime,
      timelineEndTime,
      false
    );

    setTotalDuration((prev) => Math.max(prev, timelineStartTime + (timelineEndTime - timelineStartTime)));
    preloadMedia();
    saveHistory();
  } catch (error) {
    console.error('Error adding photo to timeline:', error);
    alert('Failed to add photo to timeline. Please try again.');
  }
};

const updateFilters = async (newFilterParams) => {
  if (!selectedSegment || !sessionId || !projectId || Object.keys(newFilterParams).length === 0) return;
  if (selectedSegment.type !== 'video' && selectedSegment.type !== 'image') return;

  try {
    const token = localStorage.getItem('token');
    const updatedFilters = [...appliedFilters];

    for (const [filterName, filterValue] of Object.entries(newFilterParams)) {
      const existingFilter = updatedFilters.find((f) => f.filterName === filterName);
      if (existingFilter) {
        await axios.put(
          `${API_BASE_URL}/projects/${projectId}/update-filter`,
          {
            segmentId: selectedSegment.id,
            filterId: existingFilter.filterId,
            filterName,
            filterValue: filterValue.toString(),
          },
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );
        existingFilter.filterValue = filterValue.toString();
      } else {
        const response = await axios.post(
          `${API_BASE_URL}/projects/${projectId}/apply-filter`,
          {
            segmentId: selectedSegment.id,
            filterName,
            filterValue: filterValue.toString(),
          },
          { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
        );
        updatedFilters.push(response.data);
      }
    }

    // Update appliedFilters state
    setAppliedFilters(updatedFilters);

    // Update videoLayers with the new filters
    let updatedVideoLayers = videoLayers;
    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      newLayers[selectedSegment.layer] = newLayers[selectedSegment.layer].map((item) =>
        item.id === selectedSegment.id ? { ...item, filters: updatedFilters } : item
      );
      updatedVideoLayers = newLayers;
      return newLayers;
    });

    // Update selectedSegment to propagate filter changes
    setSelectedSegment((prev) => ({ ...prev, filters: updatedFilters }));

    // Force VideoPreview to re-render
    setCurrentTime((prev) => prev + 0); // Micro-update to trigger re-render

    // Schedule auto-save
    if (filterUpdateTimeoutRef.current) clearTimeout(filterUpdateTimeoutRef.current);
    filterUpdateTimeoutRef.current = setTimeout(() => {
      autoSaveProject(updatedVideoLayers, audioLayers);
    }, 1000);

    saveHistory();
  } catch (error) {
    console.error('Error updating filters:', error);
    alert('Failed to apply filters. Please try again.');
  }
};

const handleRemoveFilter = async (filterName) => {
  if (!selectedSegment || !sessionId || !projectId) return;
  try {
    const token = localStorage.getItem('token');
    const filterToRemove = appliedFilters.find((f) => f.filterName === filterName);
    if (!filterToRemove) return;
    await axios.post(
      `${API_BASE_URL}/projects/${projectId}/remove-filter`,
      {
        segmentId: selectedSegment.id,
        filterId: filterToRemove.filterId,
      },
      { params: { sessionId }, headers: { Authorization: `Bearer ${token}` } }
    );
    const updatedFilters = appliedFilters.filter((f) => f.filterName !== filterName);

    setAppliedFilters(updatedFilters);
    let updatedVideoLayers = videoLayers;
    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      newLayers[selectedSegment.layer] = newLayers[selectedSegment.layer].map((item) =>
        item.id === selectedSegment.id ? { ...item, filters: updatedFilters } : item
      );
      updatedVideoLayers = newLayers;
      return newLayers;
    });
    setSelectedSegment((prev) => ({ ...prev, filters: updatedFilters }));
    setFilterParams((prev) => {
      const newSettings = { ...prev };
      delete newSettings[filterName];
      return newSettings;
    });

    if (filterUpdateTimeoutRef.current) clearTimeout(filterUpdateTimeoutRef.current);
    filterUpdateTimeoutRef.current = setTimeout(() => {
      autoSaveProject(updatedVideoLayers, audioLayers);
    }, 1000);
  } catch (error) {
    console.error('Error removing filter:', error);
  }
};

const updateFilterSetting = (filterName, filterValue) => {
  if (!selectedSegment || !projectId) return;

  // Update filterParams for the UI
  setFilterParams((prev) => ({
    ...prev,
    [filterName]: filterValue,
  }));

  // Debounce the filter update
  if (filterUpdateTimeoutRef.current) {
    clearTimeout(filterUpdateTimeoutRef.current);
  }
  filterUpdateTimeoutRef.current = setTimeout(async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Auth token:', token); // Debug log
      if (!token) {
        console.error('No token found for API request');
        alert('Authentication token missing. Please log in again.');
        navigate('/login');
        return;
      }

      const segmentId = selectedSegment.id;
      console.log('Applying filter:', { filterName, filterValue, segmentId }); // Debug log

      // Use existing sessionId if available; otherwise, start a new session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        console.log('No sessionId found, starting new editing session');
        const sessionResponse = await fetch(`http://localhost:8080/projects/${projectId}/session`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          throw new Error(`Failed to start editing session: ${sessionResponse.status} ${errorText}`);
        }
        currentSessionId = await sessionResponse.text();
        console.log('New Session ID:', currentSessionId); // Debug log
        setSessionId(currentSessionId); // Update sessionId state
      } else {
        console.log('Using existing Session ID:', currentSessionId); // Debug log
      }

      // Update local videoLayers state
      let filterId = null;
      setVideoLayers((prevLayers) =>
        prevLayers.map((layer, layerIndex) =>
          layer.map((segment) => {
            if (
              segment.id === selectedSegment.id &&
              segment.layer === selectedSegment.layer &&
              layerIndex === selectedSegment.layer
            ) {
              const currentFilters = Array.isArray(segment.filters) ? segment.filters : [];
              let newFilters;

              if (filterValue === '' || filterValue === null || filterValue === undefined) {
                newFilters = currentFilters.filter((f) => f.filterName !== filterName);
              } else {
                const existingFilter = currentFilters.find((f) => f.filterName === filterName);
                filterId = existingFilter ? existingFilter.filterId : crypto.randomUUID(); // Generate filterId if new
                newFilters = [
                  ...currentFilters.filter((f) => f.filterName !== filterName),
                  { filterId, filterName, filterValue: filterValue.toString(), segmentId },
                ];
              }

              return {
                ...segment,
                filters: newFilters,
              };
            }
            return segment;
          })
        )
      );

      // Update selectedSegment.filters to keep UI in sync
      setSelectedSegment((prev) => {
        const currentFilters = Array.isArray(prev.filters) ? prev.filters : [];
        let newFilters;
        if (filterValue === '' || filterValue === null || filterValue === undefined) {
          newFilters = currentFilters.filter((f) => f.filterName !== filterName);
        } else {
          newFilters = [
            ...currentFilters.filter((f) => f.filterName !== filterName),
            { filterId: filterId || crypto.randomUUID(), filterName, filterValue: filterValue.toString(), segmentId },
          ];
        }
        return { ...prev, filters: newFilters };
      });

      // Save to backend
      if (filterValue === '' || filterValue === null || filterValue === undefined) {
        console.log('Removing filter:', { filterName, segmentId }); // Debug log
        const response = await fetch(
          `http://localhost:8080/projects/${projectId}/remove-filter?sessionId=${currentSessionId}&segmentId=${segmentId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const responseText = await response.text();
        console.log('Remove filter response:', responseText || 'Empty response'); // Debug log
        if (!response.ok) {
          throw new Error(`Failed to remove filter ${filterName}: ${response.status} ${responseText}`);
        }
        console.log(`Filter ${filterName} removed for segment ${segmentId}`);
      } else {
        const requestBody = {
          filterId: filterId || crypto.randomUUID(), // Ensure filterId is included
          segmentId,
          filterName,
          filterValue: filterValue.toString(),
        };
        console.log('Sending filter request:', requestBody); // Debug log
        const response = await fetch(
          `http://localhost:8080/projects/${projectId}/apply-filter?sessionId=${currentSessionId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );
        const responseText = await response.text();
        console.log('Apply filter response:', responseText || 'Empty response'); // Debug log
        if (!response.ok) {
          throw new Error(`Failed to apply filter ${filterName}: ${response.status} ${responseText}`);
        }
        // Handle empty response (backend returns 200 OK with no body)
        let responseData = {};
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            console.warn('Response is not JSON, treating as empty:', responseText);
          }
        }
        console.log(`Filter ${filterName} applied for segment ${segmentId} with value ${filterValue}`, responseData); // Debug log
      }

      // Trigger auto-save to persist state
      await autoSaveProject(videoLayers, audioLayers);
      console.log('Auto-save triggered after filter update');
    } catch (error) {
      console.error('Error saving filter to backend:', error);
      alert(`Failed to save filter changes: ${error.message}`);
    }
  }, 500);
};

useEffect(() => {
  if (selectedSegment) {
    const relativeTime = currentTime - selectedSegment.startTime;
    setCurrentTimeInSegment(Math.max(0, Math.min(selectedSegment.duration, relativeTime)));
  }
}, [currentTime, selectedSegment]);

const resetFilters = async () => {
  if (!selectedSegment || !sessionId || !projectId) return;
  if (selectedSegment.type !== 'video' && selectedSegment.type !== 'image') return;

  try {
    const token = localStorage.getItem('token');
    // Send a single DELETE request to remove all filters for the segment
    await axios.delete(`${API_BASE_URL}/projects/${projectId}/remove-filter`, {
      params: {
        sessionId,
        segmentId: selectedSegment.id,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    setAppliedFilters([]);
    setFilterParams({
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
      blur: 0,
      sharpen: 0,
      grayscale: '',
      invert: '',
      rotate: 0,
      flip: '',
    });

    let updatedVideoLayers = videoLayers;
    setVideoLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      newLayers[selectedSegment.layer] = newLayers[selectedSegment.layer].map((item) =>
        item.id === selectedSegment.id ? { ...item, filters: [] } : item
      );
      updatedVideoLayers = newLayers;
      return newLayers;
    });
    setSelectedSegment((prev) => ({ ...prev, filters: [] }));

    // Save history to capture the reset state
    saveHistory();

    // Trigger auto-save immediately with updated layers
    if (filterUpdateTimeoutRef.current) clearTimeout(filterUpdateTimeoutRef.current);
    await autoSaveProject(updatedVideoLayers, audioLayers);
  } catch (error) {
    console.error('Error resetting filters:', error);
    alert('Failed to reset filters. Please try again.');
  }
};

// Add this before the return statement
const filteredElements = elements.filter((element) =>
  element.displayName.toLowerCase().includes(elementSearchQuery.toLowerCase())
);

return (
  <div className="project-editor">
    <aside className={`media-panel ${isMediaPanelOpen ? 'open' : 'closed'}`}>
      <div className="panel-header">
        <button className="toggle-button" onClick={toggleMediaPanel}>
          {isMediaPanelOpen ? '◄' : '►'}
        </button>
      </div>
      {isMediaPanelOpen && (
        <div className="panel-content">
          <h2 onClick={() => setExpandedSection(null)}>Media Library</h2>
          <div className="media-section">
            <button className="section-button" onClick={() => toggleSection('videos')}>
              Videos
            </button>
            {expandedSection === 'videos' && (
              <div className="section-content">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  id="upload-video"
                  className="hidden-input"
                  multiple
                />
                <label htmlFor="upload-video" className="upload-button">
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </label>
                {videos.length === 0 ? (
                  <div className="empty-state">Pour it in, I am waiting!</div>
                ) : (
                  <div className="video-list">
                    {videos.map((video) => (
                      <div
                        key={video.id || video.filePath || video.filename}
                        className={`video-item ${
                          selectedVideo && (selectedVideo.id === video.id || selectedVideo.filePath === video.filePath)
                            ? 'selected'
                            : ''
                        }`}
                        draggable={true}
                        onDragStart={(e) => handleMediaDragStart(e, video, 'media')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVideoClick(video);
                        }}
                        onDragEnd={(e) => e.stopPropagation()}
                      >
                        {video.thumbnail ? (
                          <div
                            className="video-thumbnail"
                            style={{
                              backgroundImage: `url(${video.thumbnail})`,
                              height: '130px',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              borderRadius: '4px',
                            }}
                          ></div>
                        ) : (
                          <div className="video-thumbnail-placeholder"></div>
                        )}
                        {video.title || (video.displayPath ? video.displayPath.split('/').pop().replace(/^\d+_/, '') : 'Untitled Video')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="media-section">
            <button className="section-button" onClick={() => toggleSection('photos')}>
              Photos
            </button>
            {expandedSection === 'photos' && (
              <div className="section-content">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  id="upload-photo"
                  className="hidden-input"
                  multiple
                />
                <label htmlFor="upload-photo" className="upload-button">
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </label>
                {photos.length === 0 ? (
                  <div className="empty-state">Pour it in, I am waiting!</div>
                ) : (
                  <div className="photo-list">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="photo-item"
                        draggable={true}
                        onDragStart={(e) => handleMediaDragStart(e, photo, 'photo')}
                        onClick={() => handlePhotoClick(photo)}
                      >
                        <img src={photo.filePath} alt={photo.displayName} className="photo-thumbnail" />
                        <div className="photo-title">{photo.displayName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="media-section">
            <button className="section-button" onClick={() => toggleSection('audios')}>
              Audio
            </button>
            {expandedSection === 'audios' && (
              <div className="section-content">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  id="upload-audio"
                  className="hidden-input"
                  multiple
                />
                <label htmlFor="upload-audio" className="upload-button">
                  {uploading ? 'Uploading...' : 'Upload Audio'}
                </label>
                {audios.length === 0 ? (
                  <div className="empty-state">Pour it in, I am waiting!</div>
                ) : (
                  <div className="audio-list">
                    {audios.map((audio) => (
                      <div
                        key={audio.id}
                        className="audio-item"
                        draggable={true}
                        onDragStart={(e) => handleMediaDragStart(e, audio, 'audio')}
                        onClick={() => handleAudioClick(audio)}
                      >
                        <img src={audio.waveformImage || '/images/audio.jpeg'} alt="Audio Waveform" className="audio-waveform" />
                        <div className="audio-title">{audio.displayName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="media-section">
            <button className="section-button" onClick={() => toggleSection('elements')}>
              Elements
            </button>
            {expandedSection === 'elements' && (
              <div className="section-content">
                <input
                  type="text"
                  placeholder="Search elements..."
                  value={elementSearchQuery}
                  onChange={(e) => setElementSearchQuery(e.target.value)}
                  className="search-input"
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                    fontSize: '14px',
                  }}
                />
                {filteredElements.length === 0 ? (
                  <div className="empty-state">
                    {elementSearchQuery ? 'No elements match your search.' : 'No elements available!'}
                  </div>
                ) : (
                  <div className="element-list">
                    {filteredElements.map((element) => (
                      <div
                        key={element.id}
                        className="element-item"
                        draggable={true}
                        onDragStart={(e) => handleMediaDragStart(e, element, 'element')}
                        onClick={() => handleElementClick(element)}
                      >
                        <img src={element.thumbnail || element.filePath} alt={element.displayName} className="element-thumbnail" />
                        <div className="element-title">{element.displayName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="media-section">
            <button className="section-button" onClick={() => toggleSection('textStyles')}>
              Text Styles
            </button>
            {expandedSection === 'textStyles' && (
              <div className="section-content">
                {defaultTextStyles.length === 0 ? (
                  <div className="empty-state">No text styles available!</div>
                ) : (
                  <div className="text-style-list">
                    {defaultTextStyles.map((style, index) => (
                      <div
                        key={`text-style-${index}`}
                        className="text-style-item"
                        draggable={true}
                        onDragStart={(e) => handleTextStyleDragStart(e, style)}
                        onClick={() => handleTextStyleClick(style)}
                        style={{
                          backgroundColor: style.backgroundColor,
                          color: style.fontColor,
                          fontFamily: style.fontFamily,
                          padding: `${Math.max(style.backgroundH / 2, style.backgroundW / 2)}px`,
                          borderRadius: `${style.backgroundBorderRadius}px`,
                          border: `${style.backgroundBorderWidth}px solid ${style.backgroundBorderColor}`,
                          opacity: style.backgroundOpacity,
                          textAlign: style.alignment,
                          margin: '10px 0',
                          cursor: 'pointer',
                          WebkitTextStroke: style.textBorderWidth > 0 ? `${style.textBorderWidth}px ${style.textBorderColor}` : 'none', // Added
                          WebkitTextStrokeOpacity: style.textBorderOpacity || 1.0, // Added (Note: CSS does not support stroke opacity directly)
                        }}
                      >
                        {style.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>

    <div className="main-content">
      <div className="content-wrapper">
        <div className="preview-section" style={{ height: previewHeight }}>
          <VideoPreview
            videoLayers={videoLayers}
            audioLayers={audioLayers}
            currentTime={currentTime}
            isPlaying={isPlaying}
            canvasDimensions={canvasDimensions}
            totalDuration={totalDuration}
            onTimeUpdate={handleTimeUpdate}
            setIsPlaying={setIsPlaying}
            containerHeight={previewHeight}
            videos={videos}
            photos={photos}
            transitions={transitions}
            fps={projectFps}
            onLoadedAudioSegmentsUpdate={handleLoadedAudioSegmentsUpdate}
          />
        </div>
        <div className={`resize-preview-section ${isDraggingHandle ? 'dragging' : ''}`} onMouseDown={handleMouseDown}></div>
        <div className="controls-panel">
          <button className="control-button" onClick={handleSaveProject}>
            Save Project
          </button>
          <button
            className="delete-button"
            onClick={handleDeleteSegment}
            disabled={!selectedSegment}
          >
            🗑️
          </button>
          <button className="control-button" onClick={handleExportProject}>
            Export Video
          </button>
        </div>
        <div className="timeline-section" style={{ height: `${timelineHeight}%` }}>
          {sessionId ? (
            <TimelineComponent
              videos={videos}
              audios={audios}
              sessionId={sessionId}
              projectId={projectId}
              totalDuration={totalDuration}
              setTotalDuration={setTotalDuration}
              onVideoSelect={(time, video) => setCurrentTime(time)}
              canvasDimensions={canvasDimensions}
              addVideoToTimeline={addVideoToTimeline}
              onTimeUpdate={(newTime) => handleTimeUpdate(newTime, false)}
              onSegmentSelect={handleSegmentSelect}
              videoLayers={videoLayers}
              audioLayers={audioLayers}
              setVideoLayers={setVideoLayers}
              setAudioLayers={setAudioLayers}
              thumbnailsGenerated={thumbnailsGenerated}
              openTextTool={openTextTool}
              timeScale={timeScale}
              setTimeScale={setTimeScale}
              setPlayheadFromParent={(setPlayhead) => (timelineSetPlayhead = setPlayhead)}
              onDeleteSegment={handleDeleteSegment}
              transitions={transitions}
              setTransitions={setTransitions}
              handleTransitionDrop={handleTransitionDrop}
              onTransitionSelect={handleTransitionSelect}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              fps={projectFps}
              saveHistory={saveHistory}
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              currentTime={currentTime}
              preloadMedia={preloadMedia} // Add this line
            />
          ) : (
            <div className="loading-message">Loading timeline...</div>
          )}
        </div>
        <div className="zoom-slider-container">
          <input
            type="range"
            min={MIN_TIME_SCALE}
            max={MAX_TIME_SCALE}
            step={0.1}
            value={timeScale}
            onChange={(e) => setTimeScale(Number(e.target.value))}
            className="zoom-slider"
          />
          <span>Zoom: {timeScale.toFixed(1)}px/s</span>
        </div>
      </div>
    </div>

    <aside className={`tools-panel ${isToolsPanelOpen ? 'open' : 'closed'}`}>
      <div className="panel-header">
        <button className="toggle-button" onClick={toggleToolsPanel}>
          {isToolsPanelOpen ? '►' : '◄'}
        </button>
      </div>
      {isToolsPanelOpen && (
        <div className="panel-content">
          <h2>Tools</h2>
          <div className="tools-sections">
            <div className="tool-section">
              <button
                className={`tool-button ${isTransformOpen ? 'active' : ''}`}
                onClick={toggleTransformPanel}
              >
                Transform
              </button>
            </div>
            <div className="tool-section">
              <button
                className={`tool-button ${isFiltersOpen ? 'active' : ''}`}
                onClick={toggleFiltersPanel}
              >
                Filters
              </button>
            </div>
            <div className="tool-section">
              <button
                className={`tool-button ${isTextToolOpen ? 'active' : ''}`}
                onClick={toggleTextTool}
                disabled={!selectedSegment || selectedSegment.type !== 'text'}
              >
                Text
              </button>
            </div>
            <div className="tool-section">
              <button
                className={`tool-button ${isTransitionsOpen ? 'active' : ''}`}
                onClick={toggleTransitionsPanel}
              >
                Transitions
              </button>
            </div>
          </div>
          {selectedSegment && isTransformOpen && (
            <div className="transform-panel">
              <h3>Transform</h3>
              <KeyframeControls
                selectedSegment={selectedSegment}
                keyframes={keyframes}
                currentTimeInSegment={currentTimeInSegment}
                tempSegmentValues={tempSegmentValues}
                editingProperty={editingProperty}
                setTempSegmentValues={setTempSegmentValues}
                setEditingProperty={setEditingProperty}
                toggleKeyframe={toggleKeyframe}
                navigateKeyframes={navigateKeyframes}
                updateSegmentProperty={updateSegmentProperty}
                handleTimeUpdate={handleTimeUpdate}
                areTimesEqual={areTimesEqual}
                getValueAtTime={getValueAtTime}
                setCurrentTimeInSegment={setCurrentTimeInSegment}
              />
            </div>
          )}
          {isFiltersOpen && (
            <FilterControls
              selectedSegment={selectedSegment}
              filterParams={filterParams}
              appliedFilters={appliedFilters}
              updateFilterSetting={updateFilterSetting}
              resetFilters={resetFilters}
            />
          )}
          {isTextToolOpen && selectedSegment && selectedSegment.type === 'text' && (
            <div className="text-tool-panel">
              <h3>Text Settings</h3>
              <div className="control-group">
                <label>Text Content</label>
                <textarea
                  value={textSettings.text}
                  onChange={(e) => updateTextSettings({ ...textSettings, text: e.target.value })}
                  rows="4"
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: '8px',
                    fontSize: '14px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter text (press Enter for new line)"
                />
              </div>
              <div className="control-group">
                <label>Font Family</label>
                <select
                  value={textSettings.fontFamily}
                  onChange={(e) => updateTextSettings({ ...textSettings, fontFamily: e.target.value })}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>
              <div className="control-group">
                <label>Font Color</label>
                <input
                  type="color"
                  value={textSettings.fontColor}
                  onChange={(e) => updateTextSettings({ ...textSettings, fontColor: e.target.value })}
                />
              </div>
              <div className="control-group">
                <label>Background Color</label>
                <input
                  type="color"
                  value={textSettings.backgroundColor === 'transparent' ? '#000000' : textSettings.backgroundColor}
                  onChange={(e) =>
                    updateTextSettings({
                      ...textSettings,
                      backgroundColor: e.target.value === '#000000' ? 'transparent' : e.target.value,
                    })
                  }
                />
              </div>
              <div className="control-group">
                <label>Background Opacity</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={textSettings.backgroundOpacity}
                    onChange={(e) => updateTextSettings({ ...textSettings, backgroundOpacity: parseFloat(e.target.value) })}
                  />
                  <input
                    type="number"
                    value={textSettings.backgroundOpacity}
                    onChange={(e) => updateTextSettings({ ...textSettings, backgroundOpacity: parseFloat(e.target.value) || 1.0 })}
                    step="0.01"
                    min="0"
                    max="1"
                    style={{ width: '60px', marginLeft: '10px' }}
                  />
                </div>
              </div>
              <div className="control-group">
                <label>Background Border Width</label>
                <input
                  type="number"
                  value={textSettings.backgroundBorderWidth}
                  onChange={(e) => updateTextSettings({ ...textSettings, backgroundBorderWidth: parseInt(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  style={{ width: '60px' }}
                />
              </div>
              <div className="control-group">
                <label>Background Border Color</label>
                <input
                  type="color"
                  value={textSettings.backgroundBorderColor}
                  onChange={(e) => updateTextSettings({ ...textSettings, backgroundBorderColor: e.target.value })}
                />
              </div>
              <div className="control-group">
                <label>Background Height</label>
                <input
                  type="number"
                  value={textSettings.backgroundH}
                  onChange={(e) => updateTextSettings({ ...textSettings, backgroundH: parseInt(e.target.value)})}
                  min="0"
                  step="1"
                  style={{ width: '60px' }}
                />
              </div>
              <div className="control-group">
                <label>Background Width</label>
                <input
                  type="number"
                  value={textSettings.backgroundW}
                  onChange={(e) => updateTextSettings({ ...textSettings, backgroundW: parseInt(e.target.value)})}
                  min="0"
                  step="1"
                  style={{ width: '60px' }}
                />
              </div>
              <div className="control-group">
                <label>Background Border Radius</label>
                <input
                  type="number"
                  value={textSettings.backgroundBorderRadius}
                  onChange={(e) => updateTextSettings({ ...textSettings, backgroundBorderRadius: parseInt(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  style={{ width: '60px' }}
                />
              </div>
              <div className="control-group">
                <label>Text Border Color</label>
                <input
                  type="color"
                  value={textSettings.textBorderColor === 'transparent' ? '#000000' : textSettings.textBorderColor}
                  onChange={(e) =>
                    updateTextSettings({
                      ...textSettings,
                      textBorderColor: e.target.value === '#000000' ? 'transparent' : e.target.value,
                    })
                  }
                />
              </div>
              <div className="control-group">
                <label>Text Border Width</label>
                <input
                  type="number"
                  value={textSettings.textBorderWidth}
                  onChange={(e) => updateTextSettings({ ...textSettings, textBorderWidth: parseInt(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  style={{ width: '60px' }}
                />
              </div>
              <div className="control-group">
                <label>Text Border Opacity</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={textSettings.textBorderOpacity}
                    onChange={(e) => updateTextSettings({ ...textSettings, textBorderOpacity: parseFloat(e.target.value) })}
                  />
                  <input
                    type="number"
                    value={textSettings.textBorderOpacity}
                    onChange={(e) => updateTextSettings({ ...textSettings, textBorderOpacity: parseFloat(e.target.value) || 1.0 })}
                    step="0.01"
                    min="0"
                    max="1"
                    style={{ width: '60px', marginLeft: '10px' }}
                  />
                </div>
              </div>
              <div className="control-group">
                <label>Alignment</label>
                <select
                  value={textSettings.alignment}
                  onChange={(e) => updateTextSettings({ ...textSettings, alignment: e.target.value })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="control-group">
                <label>Duration (s)</label>
                <input
                  type="number"
                  value={textSettings.duration}
                  onChange={(e) => updateTextSettings({ ...textSettings, duration: parseFloat(e.target.value) || 5 })}
                  min="0.1"
                  step="0.1"
                  style={{ width: '60px' }}
                />
              </div>
              <button onClick={handleSaveTextSegment}>Save Text</button>
            </div>
          )}
          {isTransitionsOpen && (
            <TransitionsPanel
              availableTransitions={availableTransitions}
              selectedTransition={selectedTransition}
              handleTransitionDragStart={handleTransitionDragStart}
              handleTransitionDurationChange={handleTransitionDurationChange}
              handleTransitionDirectionChange={handleTransitionDirectionChange}
              handleTransitionDelete={handleTransitionDelete}
            />
          )}
        </div>
      )}
    </aside>
  </div>
);
};

export default ProjectEditor;