import React, { useRef, useEffect, useState, useMemo } from 'react';
import '../CSS/VideoPreview.css';
import fx from 'glfx';

const API_BASE_URL = 'http://localhost:8080';

// Add baseFontSize constant
const baseFontSize = 24;

const VideoPreview = ({
  videoLayers,
  audioLayers = [],
  currentTime,
  isPlaying,
  canvasDimensions = { width: 1080, height: 1920 },
  onTimeUpdate,
  totalDuration = 0,
  setIsPlaying,
  containerHeight,
  videos = [],
  photos = [],
  transitions = [],
  fps = 25,
}) => {
  const [loadingVideos, setLoadingVideos] = useState(new Set());
  const [loadingAudios, setLoadingAudios] = useState(new Set());
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef(null);
  const videoRefs = useRef({});
  const audioRefs = useRef({});
  const preloadRefs = useRef({});
  const animationFrameRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const glCanvasRef = useRef(null);
  const glTextureRefs = useRef({});
  const fxCanvasRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const lerp = (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1);

  const getKeyframeValue = (keyframes, time, defaultValue) => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    if (time <= sorted[0].time) return sorted[0].value;
    if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (time >= sorted[i].time && time <= sorted[i + 1].time) {
        const t = (time - sorted[i].time) / (sorted[i + 1].time - sorted[i].time);
        return lerp(sorted[i].value, sorted[i + 1].value, t);
      }
    }
    return defaultValue;
  };

  useEffect(() => {
    // Debug audio elements
    console.log("Visible audio elements:", getVisibleAudioElements());
    console.log("Audio refs:", audioRefs.current);
  }, [currentTime]);

  const computeTransitionEffects = (element, localTime) => {
    const relevantTransitions = transitions.filter(
      (t) =>
        (t.toSegmentId === element.id || t.fromSegmentId === element.id) &&
        element.layer === t.layer &&
        currentTime >= t.timelineStartTime &&
        currentTime <= t.timelineStartTime + t.duration
    );

    let effects = {
      opacity: null,
      positionX: 0,
      positionY: 0,
      clipPath: null,
      scale: null,
      rotate: null,
    };

    for (const transition of relevantTransitions) {
      const progress = (currentTime - transition.timelineStartTime) / transition.duration;
      const parameters = transition.parameters || {};

      if (transition.type === 'Fade') {
        if (transition.toSegmentId === element.id && transition.fromSegmentId === null) {
          effects.opacity = lerp(0, 1, progress);
        } else if (transition.fromSegmentId === element.id) {
          effects.opacity = lerp(1, 0, progress);
        }
      } else if (transition.type === 'Slide') {
        const direction = parameters.direction || 'right';
        const canvasWidth = canvasDimensions.width;
        const canvasHeight = canvasDimensions.height;

        if (transition.toSegmentId === element.id) {
          if (direction === 'right') {
            effects.positionX = lerp(canvasWidth, 0, progress);
          } else if (direction === 'left') {
            effects.positionX = lerp(-canvasWidth, 0, progress);
          } else if (direction === 'top') {
            effects.positionY = lerp(-canvasHeight, 0, progress);
          } else if (direction === 'bottom') {
            effects.positionY = lerp(canvasHeight, 0, progress);
          }
        } else if (transition.fromSegmentId === element.id) {
          if (direction === 'right') {
            effects.positionX = lerp(0, -canvasWidth, progress);
          } else if (direction === 'left') {
            effects.positionX = lerp(0, canvasWidth, progress);
          } else if (direction === 'top') {
            effects.positionY = lerp(0, canvasHeight, progress);
          } else if (direction === 'bottom') {
            effects.positionY = lerp(0, -canvasHeight, progress);
          }
        }
      } else if (transition.type === 'Wipe') {
        const direction = parameters.direction || 'left';
        if (transition.toSegmentId === element.id) {
          if (direction === 'left') {
            effects.clipPath = `inset(0 calc((1 - ${progress}) * 100%) 0 0)`;
          } else if (direction === 'right') {
            effects.clipPath = `inset(0 0 0 calc((1 - ${progress}) * 100%))`;
          } else if (direction === 'top') {
            effects.clipPath = `inset(calc((1 - ${progress}) * 100%) 0 0 0)`;
          } else if (direction === 'bottom') {
            effects.clipPath = `inset(0 0 calc((1 - ${progress}) * 100%) 0)`;
          }
        } else if (transition.fromSegmentId === element.id) {
          if (direction === 'left') {
            effects.clipPath = `inset(0 calc(${progress} * 100%) 0 0)`;
          } else if (direction === 'right') {
            effects.clipPath = `inset(0 0 0 calc(${progress} * 100%))`;
          } else if (direction === 'top') {
            effects.clipPath = `inset(calc(${progress} * 100%) 0 0 0)`;
          } else if (direction === 'bottom') {
            effects.clipPath = `inset(0 0 calc(${progress} * 100%) 0)`;
          }
        }
      } else if (transition.type === 'Zoom') {
        const direction = parameters.direction || 'in';
        if (transition.toSegmentId === element.id) {
          effects.scale = direction === 'in' ? lerp(0.1, 1, progress) : lerp(2, 1, progress);
        } else if (transition.fromSegmentId === element.id) {
          effects.scale = direction === 'in' ? lerp(1, 2, progress) : lerp(1, 0.1, progress);
        }
      } else if (transition.type === 'Rotate') {
        const direction = parameters.direction || 'clockwise';
        const rotationSpeed = direction === 'clockwise' ? 720 : -720; // 720 deg/s
        const angle = rotationSpeed * transition.duration; // Total angle for transition duration
        if (transition.toSegmentId === element.id) {
          effects.rotate = lerp(angle, 0, progress); // From angle to 0
        } else if (transition.fromSegmentId === element.id) {
          effects.rotate = lerp(0, angle, progress); // From 0 to angle
        }
      } else if (transition.type === 'Push') {
        const direction = parameters.direction || 'right';
        const canvasWidth = canvasDimensions.width;
        const canvasHeight = canvasDimensions.height;

        if (transition.toSegmentId === element.id) {
          if (direction === 'right') {
            effects.positionX = lerp(-canvasWidth, 0, progress);
          } else if (direction === 'left') {
            effects.positionX = lerp(canvasWidth, 0, progress);
          } else if (direction === 'top') {
            effects.positionY = lerp(canvasHeight, 0, progress);
          } else if (direction === 'bottom') {
            effects.positionY = lerp(-canvasHeight, 0, progress);
          }
        } else if (transition.fromSegmentId === element.id) {
          if (direction === 'right') {
            effects.positionX = lerp(0, canvasWidth, progress);
          } else if (direction === 'left') {
            effects.positionX = lerp(0, -canvasWidth, progress);
          } else if (direction === 'top') {
            effects.positionY = lerp(0, -canvasHeight, progress);
          } else if (direction === 'bottom') {
            effects.positionY = lerp(0, canvasHeight, progress);
          }
        }
      }
    }

    return effects;
  };

  const computeFilterStyle = (filters, localTime) => {
    if (!filters || !Array.isArray(filters)) return { css: '', webgl: [] };

    const cssFilterMap = {
      brightness: (value) => `brightness(${parseFloat(value) + 1})`,
      contrast: (value) => `contrast(${parseFloat(value)})`,
      saturation: (value) => `saturate(${parseFloat(value)})`,
      hue: (value) => `hue-rotate(${parseInt(value)}deg)`,
      grayscale: (value) => (parseFloat(value) > 0 ? `grayscale(1)` : ''),
      invert: (value) => (parseFloat(value) > 0 ? `invert(1)` : ''),
      rotate: () => {
        console.log('Rotate filter applied via transform, not CSS filter.');
        return '';
      },
      flip: () => {
        console.log('Flip filter applied via transform, not CSS filter.');
        return '';
      },
    };

    const cssStyles = [];

    filters.forEach((filter) => {
      const { filterName, filterValue } = filter;
      if (cssFilterMap[filterName]) {
        const style = cssFilterMap[filterName](filterValue);
        if (style) cssStyles.push(style);
      } else {
        console.log(`Filter "${filterName}" is not supported in preview and will be ignored.`);
      }
    });

    return {
      css: cssStyles.length > 0 ? cssStyles.join(' ') : '',
      webgl: [],
    };
  };

  const videoLayerIds = useMemo(() => {
    return videoLayers
      .flat()
      .filter((item) => item.type === 'video')
      .map((item) => `${item.id}-${item.filePath}`)
      .join('|');
  }, [videoLayers]);

  const audioLayerIds = useMemo(() => {
    return audioLayers
      .flat()
      .filter((item) => item.type === 'audio')
      .map((item) => `${item.id}-${item.fileName}`)
      .join('|');
  }, [audioLayers]);

  useEffect(() => {
    try {
      fxCanvasRef.current = fx.canvas();
      glCanvasRef.current = fxCanvasRef.current;
      glCanvasRef.current.style.display = 'none';
      document.body.appendChild(glCanvasRef.current);
    } catch (e) {
      console.error('Failed to initialize WebGL:', e);
    }

    return () => {
      if (glCanvasRef.current) {
        glCanvasRef.current.remove();
        glCanvasRef.current = null;
        fxCanvasRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const preloadVideos = () => {
      const allVideoItems = videoLayers.flat().filter((item) => item.type === 'video');
      const preloadPromises = allVideoItems.map((item) => {
        const normalizedFilePath = item.filePath.startsWith('videos/')
          ? item.filePath.substring(7)
          : item.filePath;
        const videoUrl = `${API_BASE_URL}/videos/${encodeURIComponent(normalizedFilePath)}`;

        if (!preloadRefs.current[item.id]) {
          const video = document.createElement('video');
          video.preload = 'auto';
          video.src = videoUrl;
          video.crossOrigin = 'anonymous';
          video.muted = true; // Ensure preload video is muted
          video.style.display = 'none';
          document.body.appendChild(video);
          preloadRefs.current[item.id] = video;

          return new Promise((resolve) => {
            video.onloadeddata = () => {
              try {
                if (fxCanvasRef.current) {
                  const texture = fxCanvasRef.current.texture(video);
                  glTextureRefs.current[item.id] = texture;
                }
              } catch (e) {
                console.error(`Failed to create WebGL texture for video ${item.id}:`, e);
              }
              setLoadingVideos((prev) => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
              });
              resolve();
            };
            video.onerror = () => {
              console.error(`Failed to preload video ${item.filePath}`);
              resolve();
            };
          });
        }
        return Promise.resolve();
      });

      setLoadingVideos(new Set(allVideoItems.map((item) => item.id)));
      return preloadPromises;
    };

    const preloadAudios = () => {
      const allAudioItems = audioLayers.flat().filter((item) => item.type === 'audio');
      const preloadPromises = allAudioItems.map((item) => {
        const audioUrl = `${API_BASE_URL}/projects/88/audio/${encodeURIComponent(item.fileName)}`;

        if (!preloadRefs.current[item.id]) {
          const audio = document.createElement('audio');
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
          audio.muted = false;
          audio.src = audioUrl;
          audio.style.display = 'none';
          document.body.appendChild(audio);
          preloadRefs.current[item.id] = audio;
          audio.src = audioUrl; // Set src after appending
          audio.load(); // Explicitly load to initialize

          console.log(`Preloading audio: ${item.fileName}, URL: ${audioUrl}`);

          return new Promise((resolve) => {
            audio.onloadeddata = () => {
              setLoadingAudios((prev) => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
              });
              resolve();
            };
            audio.onerror = () => {
              console.error(`Failed to preload audio ${item.fileName}`);
              resolve();
            };
          });
        }
        return Promise.resolve();
      });

      setLoadingAudios(new Set(allAudioItems.map((item) => item.id)));
      return preloadPromises;
    };

    Promise.all([...preloadVideos(), ...preloadAudios()]).then(() => {
      setPreloadComplete(true);
      console.log('All videos and audios preloaded');
    });

    return () => {
      Object.values(preloadRefs.current).forEach((element) => {
        if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
          element.pause();
          document.body.removeChild(element);
        }
      });
      Object.values(glTextureRefs.current).forEach((texture) => {
        try {
          texture.destroy();
        } catch (e) {
          console.error('Error destroying texture:', e);
        }
      });
      preloadRefs.current = {};
      glTextureRefs.current = {};
    };
  }, [videoLayerIds, audioLayerIds]);

  useEffect(() => {
    const preloadImages = () => {
      const allImageItems = videoLayers.flat().filter((item) => item.type === 'image');
      allImageItems.forEach((item) => {
        if (!glTextureRefs.current[item.id]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = item.filePath;
          img.onload = () => {
            try {
              if (fxCanvasRef.current) {
                const texture = fxCanvasRef.current.texture(img);
                glTextureRefs.current[item.id] = texture;
              }
            } catch (e) {
              console.error(`Failed to create WebGL texture for image ${item.id}:`, e);
            }
          };
          img.onerror = () => {
            console.error(`Failed to preload image ${item.filePath}`);
          };
        }
      });
    };

    preloadImages();
  }, [videoLayers]);

  useEffect(() => {
    const visibleElements = getVisibleElements();
    const visibleAudioElements = getVisibleAudioElements();

    // Handle video playback
    const setVideoTimeFunctions = new Map();

    visibleElements.forEach((element) => {
      if (element.type === 'video') {
        const videoRef = videoRefs.current[element.id];
        if (videoRef) {
          const normalizedFilePath = element.filePath.startsWith('videos/')
            ? element.filePath.substring(7)
            : element.filePath;
          const videoUrl = `${API_BASE_URL}/videos/${encodeURIComponent(normalizedFilePath)}`;

          if (!videoRef.src) {
            videoRef.src = videoUrl;
            videoRef.crossOrigin = 'anonymous';
            videoRef.load();
          }

          const setVideoTime = () => {
            const targetTime = element.localTime + (element.startTimeWithinVideo || 0);
            if (Math.abs(videoRef.currentTime - targetTime) > 0.05) {
              videoRef.currentTime = targetTime;
            }
          };
          setVideoTimeFunctions.set(element.id, setVideoTime);

          if (videoRef.readyState >= 2) {
            setVideoTime();
          } else {
            videoRef.addEventListener('loadeddata', setVideoTime, { once: true });
          }

          // Ensure all videos are muted
          videoRef.muted = true;

          if (isPlaying && preloadComplete) {
            videoRef.play().catch((error) => console.error('Video playback error:', error));
          } else {
            videoRef.pause();
          }
        }
      }
    });

    // Handle audio playback
    const setAudioTimeFunctions = new Map();

    visibleAudioElements.forEach((element) => {
      const audioRef = audioRefs.current[element.id];
      if (audioRef) {
        const audioUrl = `${API_BASE_URL}/projects/88/audio/${encodeURIComponent(element.fileName)}`;

        if (!audioRef.src) {
          audioRef.src = audioUrl;
          audioRef.crossOrigin = 'anonymous';
          audioRef.muted = false;
          audioRef.load();
          console.log(`Initialized audio ${element.fileName} with src ${audioUrl}`);
        }

        const setAudioTime = () => {
          const targetTime = element.localTime + (element.startTimeWithinAudio || 0);
          if (Math.abs(audioRef.currentTime - targetTime) > 0.05) {
            audioRef.currentTime = targetTime;
            console.log(`Set audio ${element.fileName} to time ${targetTime}`);
          }
        };
        setAudioTimeFunctions.set(element.id, setAudioTime);

        if (audioRef.readyState >= 2) {
          setAudioTime();
        } else {
          audioRef.addEventListener('loadeddata', () => {
            setAudioTime();
            console.log(`Audio ${element.fileName} loadeddata, readyState: ${audioRef.readyState}`);
          }, { once: true });
        }

        // Apply volume from keyframes or default
        const volume = getKeyframeValue(
          element.keyframes && element.keyframes.volume,
          element.localTime,
          element.volume || 1.0
        );
        audioRef.volume = Math.max(0, Math.min(1, volume));
        console.log(`Set audio ${element.fileName} volume to ${volume}`);

        if (isPlaying && preloadComplete) {
          audioRef.play()
            .then(() => console.log(`Audio ${element.fileName} started playing`))
            .catch((error) => console.error(`Audio playback error for ${element.fileName}:`, error));
        } else {
          audioRef.pause();
          console.log(`Audio ${element.fileName} paused (isPlaying: ${isPlaying}, preloadComplete: ${preloadComplete})`);
        }
      } else {
        console.warn(`No audioRef found for element ID ${element.id}`);
      }
    });

    // Pause non-visible videos
    const visibleIds = visibleElements.map((el) => el.id);
    Object.entries(videoRefs.current).forEach(([id, videoRef]) => {
      if (!visibleIds.includes(id) && videoRef) {
        videoRef.pause();
        videoRef.muted = true;
      }
    });

    // Pause non-visible audios
    const visibleAudioIds = visibleAudioElements.map((el) => el.id);
    Object.entries(audioRefs.current).forEach(([id, audioRef]) => {
      if (!visibleAudioIds.includes(id) && audioRef) {
        audioRef.pause();
        console.log(`Paused non-visible audio ID ${id}`);
      }
    });

    return () => {
      setVideoTimeFunctions.forEach((setVideoTime, id) => {
        const videoRef = videoRefs.current[id];
        if (videoRef) {
          videoRef.removeEventListener('loadeddata', setVideoTime);
        }
      });
      setAudioTimeFunctions.forEach((setAudioTime, id) => {
        const audioRef = audioRefs.current[id];
        if (audioRef) {
          audioRef.removeEventListener('loadeddata', setAudioTime);
        }
      });
    };
  }, [currentTime, isPlaying, videoLayers, audioLayers, preloadComplete]);

  useEffect(() => {
    const frameDuration = 1 / fps; // Duration of one frame in seconds

    const updatePlayhead = (timestamp) => {
      if (isPlaying) {
        if (!lastUpdateTimeRef.current) {
          lastUpdateTimeRef.current = timestamp;
        }
        const deltaMs = timestamp - lastUpdateTimeRef.current;
        const framesElapsed = Math.floor(deltaMs / (1000 / fps)); // Number of frames based on FPS
        const deltaTime = framesElapsed * frameDuration; // Time advanced in seconds
        lastUpdateTimeRef.current = timestamp - (deltaMs % (1000 / fps)); // Align to frame boundary

        const newTime = Math.min(totalDuration, currentTime + deltaTime);
        onTimeUpdate(newTime);
        if (newTime >= totalDuration) {
          if (setIsPlaying) setIsPlaying(false);
          onTimeUpdate(0);
        }
      } else {
        lastUpdateTimeRef.current = timestamp; // Reset timestamp when paused
      }
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    if (isPlaying) {
      lastUpdateTimeRef.current = null; // Reset on play
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, onTimeUpdate, totalDuration, setIsPlaying, fps]);

  useEffect(() => {
    if (previewContainerRef.current) {
      const calculateSize = () => {
        const containerWidth = previewContainerRef.current.clientWidth;
        const containerHeightPx =
          containerHeight && containerHeight !== 'auto'
            ? parseFloat(containerHeight)
            : previewContainerRef.current.clientHeight;
        const canvasAspectRatio = canvasDimensions.width / canvasDimensions.height;

        let newScale = Math.min(
          containerWidth / canvasDimensions.width,
          containerHeightPx / canvasDimensions.height
        );

        const minPreviewHeight = 100;
        const minScale = minPreviewHeight / canvasDimensions.height;
        const maxScale = 1.0;

        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        setScale(newScale);

        const canvasWrapper = document.querySelector('.canvas-wrapper');
        if (canvasWrapper) {
          canvasWrapper.style.transform = `scale(${newScale})`;
          canvasWrapper.style.width = `${canvasDimensions.width}px`;
          canvasWrapper.style.height = `${canvasDimensions.height}px`;
        }

        const previewArea = document.querySelector('.preview-area');
        if (previewArea) {
          previewArea.style.width = `${canvasDimensions.width * newScale}px`;
          previewArea.style.height = `${canvasDimensions.height * newScale}px`;
        }
      };

      calculateSize();
      window.addEventListener('resize', calculateSize);
      return () => window.removeEventListener('resize', calculateSize);
    }
  }, [canvasDimensions, containerHeight]);

  const getVisibleElements = () => {
    const visibleElements = [];
    videoLayers.forEach((layer, layerIndex) => {
      layer.forEach((item) => {
        const itemStartTime = item.startTime || 0;
        const itemEndTime = itemStartTime + item.duration;
        if (currentTime >= itemStartTime && currentTime < itemEndTime) {
          visibleElements.push({
            ...item,
            layerIndex,
            localTime: currentTime - itemStartTime,
          });
        }
      });
    });
    return visibleElements.sort((a, b) => a.layerIndex - b.layerIndex);
  };

  const getVisibleAudioElements = () => {
    const visibleAudioElements = [];
    audioLayers.forEach((layer, layerIndex) => {
      layer.forEach((item) => {
        const itemStartTime = item.startTime || 0;
        const itemEndTime = itemStartTime + item.duration;
        if (currentTime >= itemStartTime && currentTime < itemEndTime) {
          visibleAudioElements.push({
            ...item,
            layerIndex,
            localTime: currentTime - itemStartTime,
          });
        }
      });
    });
    return visibleAudioElements;
  };

  const applyWebGLFilters = (element, sourceElement) => {
    return sourceElement;
  };

  const visibleElements = getVisibleElements();

  return (
    <div className="video-preview-container" ref={previewContainerRef}>
      <div className="preview-area">
        <div
          className="canvas-wrapper"
          style={{
            width: `${canvasDimensions.width}px`,
            height: `${canvasDimensions.height}px`,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'black',
            transformOrigin: 'top left',
          }}
        >
          {visibleElements.map((element) => {
            const positionX = getKeyframeValue(
              element.keyframes && element.keyframes.positionX,
              element.localTime,
              element.positionX || 0
            );
            const positionY = getKeyframeValue(
              element.keyframes && element.keyframes.positionY,
              element.localTime,
              element.positionY || 0
            );
            const scaleFactor = getKeyframeValue(
              element.keyframes && element.keyframes.scale,
              element.localTime,
              element.scale || 1
            );
            let opacity = getKeyframeValue(
              element.keyframes && element.keyframes.opacity,
              element.localTime,
              element.opacity || 1
            );

            const transitionEffects = computeTransitionEffects(element, element.localTime);
            if (transitionEffects.opacity !== null) {
              opacity = transitionEffects.opacity;
            }
            const transitionPosX = transitionEffects.positionX;
            const transitionPosY = transitionEffects.positionY;
            const clipPath = transitionEffects.clipPath;
            const transitionScale = transitionEffects.scale;
            const transitionRotate = transitionEffects.rotate;

            const { css: filterStyle, webgl: webglFilters } = computeFilterStyle(element.filters, element.localTime);

            let transform = '';
            const rotateFilter = element.filters?.find((f) => f.filterName === 'rotate');
            const flipFilter = element.filters?.find((f) => f.filterName === 'flip');
            if (rotateFilter) {
              transform += `rotate(${parseInt(rotateFilter.filterValue)}deg) `;
            }
            if (flipFilter) {
              if (flipFilter.filterValue === 'horizontal') {
                transform += 'scaleX(-1) ';
              } else if (flipFilter.filterValue === 'vertical') {
                transform += 'scaleY(-1) ';
              }
            }
            if (transitionScale !== null) {
              transform += `scale(${transitionScale}) `;
            }
            if (transitionRotate !== null) {
              transform += `rotate(${transitionRotate}deg) `;
            }

            if (element.type === 'video') {
              const videoWidth = element.width || 1080;
              const videoHeight = element.height || 1920;

              let displayWidth = videoWidth * scaleFactor;
              let displayHeight = videoHeight * scaleFactor;

              const posX = (canvasDimensions.width - displayWidth) / 2 + positionX + transitionPosX;
              const posY = (canvasDimensions.height - displayHeight) / 2 + positionY + transitionPosY;

              return (
                <React.Fragment key={element.id}>
                  <video
                    ref={(el) => (videoRefs.current[element.id] = el)}
                    className="preview-video"
                    muted={true} // Always mute video elements
                    crossOrigin="anonymous"
                    style={{
                      position: 'absolute',
                      width: `${displayWidth}px`,
                      height: `${displayHeight}px`,
                      left: `${posX}px`,
                      top: `${posY}px`,
                      zIndex: element.layerIndex,
                      opacity,
                      objectFit: 'contain',
                      filter: filterStyle,
                      transform: transform.trim(),
                      clipPath,
                      display: webglFilters.length > 0 ? 'none' : 'block',
                    }}
                    onError={(e) => console.error(`Error loading video ${element.filePath}:`, e)}
                    onLoadedData={() => console.log(`Video ${element.filePath} loaded`)}
                    preload="auto"
                  />
                  {webglFilters.length > 0 && (
                    <canvas
                      style={{
                        position: 'absolute',
                        width: `${displayWidth}px`,
                        height: `${displayHeight}px`,
                        left: `${posX}px`,
                        top: `${posY}px`,
                        zIndex: element.layerIndex,
                        opacity,
                        transform: transform.trim(),
                        clipPath,
                      }}
                      ref={(canvas) => {
                        if (canvas && videoRefs.current[element.id]) {
                          const filtered = applyWebGLFilters(element, videoRefs.current[element.id]);
                          if (filtered === videoRefs.current[element.id]) {
                            canvas.style.display = 'none';
                            if (videoRefs.current[element.id]) {
                              videoRefs.current[element.id].style.display = 'block';
                            }
                          } else {
                            canvas.width = displayWidth;
                            canvas.height = displayHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(filtered, 0, 0, displayWidth, displayHeight);
                          }
                        }
                      }}
                    />
                  )}
                </React.Fragment>
              );
            } else if (element.type === 'image') {
              const imgWidth = element.width || canvasDimensions.width;
              const imgHeight = element.height || canvasDimensions.height;
              const displayWidth = imgWidth * scaleFactor;
              const displayHeight = imgHeight * scaleFactor;

              const posX = (canvasDimensions.width - displayWidth) / 2 + positionX + transitionPosX;
              const posY = (canvasDimensions.height - displayHeight) / 2 + positionY + transitionPosY;

              const photo = photos.find((p) => p.fileName === element.fileName) || {
                filePath: element.filePath,
              };

              return (
                <React.Fragment key={element.id}>
                  <img
                    src={webglFilters.length > 0 ? null : photo.filePath}
                    alt="Preview"
                    crossOrigin="anonymous"
                    style={{
                      position: 'absolute',
                      width: `${displayWidth}px`,
                      height: `${displayHeight}px`,
                      left: `${posX}px`,
                      top: `${posY}px`,
                      opacity,
                      zIndex: element.layerIndex,
                      filter: filterStyle,
                      transform: transform.trim(),
                      clipPath,
                      display: webglFilters.length > 0 ? 'none' : 'block',
                    }}
                  />
                  {webglFilters.length > 0 && (
                    <canvas
                      style={{
                        position: 'absolute',
                        width: `${displayWidth}px`,
                        height: `${displayHeight}px`,
                        left: `${posX}px`,
                        top: `${posY}px`,
                        zIndex: element.layerIndex,
                        opacity,
                        transform: transform.trim(),
                        clipPath,
                      }}
                      ref={(canvas) => {
                        if (canvas) {
                          const img = new Image();
                          img.crossOrigin = 'anonymous';
                          img.src = photo.filePath;
                          img.onload = () => {
                            const filtered = applyWebGLFilters(element, img);
                            canvas.width = displayWidth;
                            canvas.height = displayHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(filtered, 0, 0, displayWidth, displayHeight);
                          };
                          img.onerror = () => {
                            console.error(`Failed to load image for WebGL filtering: ${photo.filePath}`);
                          };
                        }
                      }}
                    />
                  )}
                </React.Fragment>
              );
            } else if (element.type === 'text') {
              const fontSize = baseFontSize * scaleFactor;
              const textWidth = element.text.length * fontSize * 0.6;
              const textHeight = fontSize * 1.2;

              const posX = (canvasDimensions.width - textWidth) / 2 + positionX + transitionPosX;
              const posY = (canvasDimensions.height - textHeight) / 2 + positionY + transitionPosY;

              return (
                <div
                  key={element.id}
                  className="preview-text"
                  style={{
                    position: 'absolute',
                    left: `${posX}px`,
                    top: `${posY}px`,
                    fontFamily: element.fontFamily || 'Arial',
                    fontSize: `${fontSize}px`,
                    color: element.fontColor || '#FFFFFF',
                    backgroundColor: element.backgroundColor
                      ? `${element.backgroundColor}${element.backgroundColor.startsWith('#') ? '80' : ''}`
                      : 'transparent',
                    padding: `${5 * scale}px`,
                    zIndex: element.layerIndex + 10,
                    whiteSpace: 'pre-wrap',
                    textAlign: 'center',
                    opacity,
                    filter: filterStyle,
                    transform: transform.trim(),
                    clipPath,
                  }}
                >
                  {element.text}
                </div>
              );
            }
            return null;
          })}
          {/* Audio elements for playback */}
          {getVisibleAudioElements().map((element) => (
            <audio
              key={element.id}
              ref={(el) => (audioRefs.current[element.id] = el)}
              preload="auto"
              crossOrigin="anonymous"
              muted={false}
              onError={(e) => console.error(`Error loading audio ${element.fileName}:`, e)}
              onLoadedData={() => console.log(`Audio ${element.fileName} loaded`)}
            />
          ))}
        </div>

        {visibleElements.length === 0 && <div className="preview-empty-state"></div>}

        {(loadingVideos.size > 0 || loadingAudios.size > 0) && (
          <div className="preview-loading">
            <div className="preview-spinner"></div>
          </div>
        )}

        <div className="preview-time">{formatTime(currentTime)}</div>
      </div>
    </div>
  );
};

export default VideoPreview;