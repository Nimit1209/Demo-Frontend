import React from 'react';

const SnapIndicators = ({ snapIndicators, timeScale, layers = [] }) => {
  // Calculate layer indices based on the array length
  const layerIndices = Array.isArray(layers) ? layers.map((_, idx) => idx) : [];
  const totalLayers = layerIndices.length;

  return (
    <>
      {snapIndicators.map((indicator, index) => {
        // Adjust layerIndex calculation: if layerIdx is -1 (timeline start), use a default position
        const layerIndex = indicator.layerIdx >= 0
          ? layerIndices.indexOf(indicator.layerIdx)
          : indicator.layerIdx === -1
          ? totalLayers - 1 // Position at the bottom for timeline start
          : layerIndices.indexOf(indicator.layerIdx);
        return (
          <div
            key={`snap-${index}`}
            className={`snap-indicator ${indicator.edge === 'end' ? 'snap-end' : 'snap-start'} ${indicator.time === 0 ? 'snap-timeline-start' : ''}`}
            style={{
              left: `${indicator.time * timeScale}px`,
              top: `${(totalLayers - layerIndex - 1) * 40}px`, // Adjust top position
              height: '40px',
            }}
          />
        );
      })}
    </>
  );
};

export default SnapIndicators;