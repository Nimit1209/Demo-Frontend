import React from 'react';
import '../CSS/Timeline.css';

const TimelineLayer = ({
  layer,
  layerIndex,
  timeScale,
  handleDragStart,
  handleResizeStart,
  playingVideoId,
  handleVideoSelect,
  handleEditTextSegment,
  selectedSegmentId,
  transitions,
  onTransitionSelect, // NEW: Prop to handle transition selection
}) => {
  const isAudioLayer = layer.some((item) => item.type === 'audio');

  // Function to get transition position, adjusted for the segment's startTime
  const getTransitionPosition = (transition, segmentStartTime) => {
    const startTime = transition.timelineStartTime || 0;
    // Since the transition is inside the timeline-item, we need to offset its left position
    // by subtracting the segment's startTime to make it absolute relative to the timeline
    const relativeLeft = (startTime - segmentStartTime) * timeScale;
    return {
      left: relativeLeft,
      width: transition.duration * timeScale,
      transition,
    };
  };

  return (
    <div className="layer">
      <div className="layer-label">{isAudioLayer ? `Layer ${layerIndex}` : `Layer ${layerIndex}`}</div>
      <div className="layer-items">
        {layer.map((item, index) => {
          const style = {
            left: `${item.startTime * timeScale}px`,
            width: `${item.duration * timeScale}px`,
            backgroundImage: item.thumbnail
              ? `url(${item.thumbnail})`
              : item.type === 'image' && item.filePath
              ? `url(${item.filePath})`
              : item.type === 'audio'
              ? `url(${item.waveformImage})`
              : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: index,
            top: '5px',
          };
          const isSelected = item.id === selectedSegmentId;

          // Find transitions related to this segment
          const itemTransitions = transitions.filter(
            (t) => t.fromSegmentId === item.id || t.toSegmentId === item.id
          );

          return (
            <div
              key={item.id}
              className={`timeline-item ${
                item.type === 'text'
                  ? 'text-segment'
                  : item.type === 'image'
                  ? 'image-segment'
                  : item.type === 'audio'
                  ? 'audio-segment'
                  : 'video-segment'
              } ${item.id === playingVideoId ? 'playing' : ''} ${isSelected ? 'selected' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, item, layerIndex)}
              style={style}
              onClick={(e) => {
                e.stopPropagation();
                if (item.type === 'text') {
                  handleEditTextSegment(item, e);
                } else {
                  handleVideoSelect(item.id);
                }
              }}
            >
              {isSelected && (
                <div
                  className="resize-handle resize-left"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, item, layerIndex, 'left');
                  }}
                />
              )}
              {item.type === 'text' && (
                <div
                  className="text-segment-preview"
                  style={{
                    backgroundColor: item.backgroundColor || 'rgba(0, 0, 0, 0.7)',
                    color: item.fontColor || '#FFFFFF',
                    fontFamily: item.fontFamily || 'Arial',
                    fontSize: `${Math.min(item.fontSize / 2, 14)}px` || '12px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div className="text-segment-icon">T</div>
                  <div className="text-segment-content">
                    {item.text.substring(0, 15)}
                    {item.text.length > 15 ? '...' : ''}
                  </div>
                </div>
              )}
              {(item.type === 'video' || item.type === 'image' || item.type === 'audio') && (
                <div className="video-title">
                  {item.type === 'video'
                    ? item.title || item.displayPath || item.filePath || item.filename || 'Unnamed Video'
                    : item.type === 'image'
                    ? item.fileName || 'Unnamed Image'
                    : item.displayName || 'Unnamed Audio'}
                </div>
              )}
              {isSelected && (
                <div
                  className="resize-handle resize-right"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, item, layerIndex, 'right');
                  }}
                />
              )}
              {/* Render transitions */}
              {itemTransitions.map((transition) => {
                const pos = getTransitionPosition(transition, item.startTime);
                if (!pos) return null;
                return (
                  <div
                    key={transition.id}
                    className="transition-overlay"
                    style={{
                      left: `${pos.left}px`,
                      width: `${pos.width}px`,
                      height: '20px',
                      backgroundColor: 'rgba(0, 255, 255, 0.5)',
                      position: 'absolute',
                      top: '0',
                      zIndex: index + 100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransitionSelect(transition); // NEW: Select transition and open panel
                    }}
                    onDragStart={(e) => e.preventDefault()} // Prevent dragging
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag initiation on segment
                  >
                    <span className="transition-label">{transition.type}</span>
                    {/* REMOVED: Resize handles */}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineLayer;