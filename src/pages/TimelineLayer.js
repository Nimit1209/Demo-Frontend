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
  onTransitionSelect,
}) => {
  const isAudioLayer = layer.some((item) => item.type === 'audio');

  const getTransitionPosition = (transition, segmentStartTime, segmentDuration) => {
    let relativeLeft;
    if (transition.start && !transition.end) {
      relativeLeft = 0;
    } else if (transition.end && !transition.start) {
      relativeLeft = (segmentDuration - transition.duration) * timeScale;
    } else {
      relativeLeft = 0;
    }
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

          const itemTransitions = transitions.filter(
            (t) => t.segmentId === item.id && t.layer === layerIndex
          );

          return (
            <div
              key={item.id}
              data-id={item.id} // Added data-id attribute
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
              {(item.type === 'video' || item.type === 'image') && (
                <div className="video-title">
                  {item.type === 'video'
                    ? item.title || item.displayPath || item.filePath || item.filename || 'Unnamed Video'
                    : item.fileName || 'Unnamed Image'}
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
              {itemTransitions.map((transition) => {
                const pos = getTransitionPosition(transition, item.startTime, item.duration);
                if (!pos) return null;
                const isCrossDissolve = transition.type === 'CrossDissolve';
                return (
                  <div
                    key={transition.id}
                    className="transition-overlay"
                    style={{
                      left: `${pos.left}px`,
                      width: `${pos.width}px`,
                      height: '20px',
                      background: isCrossDissolve
                        ? 'linear-gradient(to right, rgba(0, 255, 255, 0.5), rgba(0, 255, 255, 0))'
                        : 'rgba(0, 255, 255, 0.5)',
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
                      onTransitionSelect(transition);
                    }}
                    onDragStart={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span className="transition-label">{transition.type}</span>
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