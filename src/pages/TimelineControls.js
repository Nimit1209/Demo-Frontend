import React from 'react';

const TimelineControls = ({
  isPlaying,
  togglePlayback,
  currentTime,
  totalDuration,
  formatTime,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  isSaving,
  onAddTextClick,
  toggleSplitMode,
  isSplitMode,
}) => {
  return (
    <div className="timeline-controls">
      <button onClick={togglePlayback}>
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
      <span className="time-display">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>
      <div className="add-text-control">
        <button onClick={onAddTextClick}>Add Text</button>
      </div>
      <div className="split-control">
        <button
          onClick={toggleSplitMode}
          className={isSplitMode ? 'active' : ''}
          title="Split Segment"
        >
          ✂️
        </button>
      </div>
    </div>
  );
};

export default TimelineControls;