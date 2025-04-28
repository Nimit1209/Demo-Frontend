import React, { useState, useEffect } from 'react';

const KeyframeControls = ({
  selectedSegment,
  keyframes,
  currentTimeInSegment,
  tempSegmentValues,
  editingProperty,
  setTempSegmentValues,
  setEditingProperty,
  toggleKeyframe,
  navigateKeyframes,
  updateSegmentProperty,
  handleTimeUpdate,
  areTimesEqual,
  getValueAtTime,
  setCurrentTimeInSegment,
  canvasDimensions,
}) => {
  const [error, setError] = useState('');
  const [localCropValues, setLocalCropValues] = useState({
    cropL: 0,
    cropR: 0,
    cropT: 0,
    cropB: 0,
  });

  useEffect(() => {
    if (selectedSegment) {
      const newLocalCropValues = {
        cropL: Number(tempSegmentValues.cropL) || 0,
        cropR: Number(tempSegmentValues.cropR) || 0,
        cropT: Number(tempSegmentValues.cropT) || 0,
        cropB: Number(tempSegmentValues.cropB) || 0,
      };
      setLocalCropValues(newLocalCropValues);
    }
  }, [selectedSegment, tempSegmentValues]);

  if (!selectedSegment) return null;

  let properties = [];
  switch (selectedSegment.type) {
    case 'video':
    case 'image':
      properties = [
        { name: 'positionX', label: 'Position X', unit: 'px', step: 1, min: -9999, max: 9999, supportsKeyframes: true },
        { name: 'positionY', label: 'Position Y', unit: 'px', step: 1, min: -9999, max: 9999, supportsKeyframes: true },
        { name: 'scale', label: 'Scale', unit: '', step: 0.01, min: 0.1, max: 5, supportsKeyframes: true },
        { name: 'opacity', label: 'Opacity', unit: '', step: 0.01, min: 0, max: 1, supportsKeyframes: false },
        { name: 'cropL', label: 'Crop Left', unit: '%', step: 0.1, min: 0, max: 100, supportsKeyframes: false, isCrop: true },
        { name: 'cropR', label: 'Crop Right', unit: '%', step: 0.1, min: 0, max: 100, supportsKeyframes: false, isCrop: true },
        { name: 'cropT', label: 'Crop Top', unit: '%', step: 0.1, min: 0, max: 100, supportsKeyframes: false, isCrop: true },
        { name: 'cropB', label: 'Crop Bottom', unit: '%', step: 0.1, min: 0, max: 100, supportsKeyframes: false, isCrop: true },
      ];
      break;
    case 'text':
      properties = [
        { name: 'positionX', label: 'Position X', unit: 'px', step: 1, min: -9999, max: 9999, supportsKeyframes: true },
        { name: 'positionY', label: 'Position Y', unit: 'px', step: 1, min: -9999, max: 9999, supportsKeyframes: true },
        { name: 'scale', label: 'Scale', unit: '', step: 0.01, min: 0.1, max: 5, supportsKeyframes: true },
        { name: 'opacity', label: 'Opacity', unit: '', step: 0.01, min: 0, max: 1, supportsKeyframes: false },
      ];
      break;
    case 'audio':
      properties = [
        { name: 'volume', label: 'Volume', unit: '', step: 0.01, min: 0, max: 1, supportsKeyframes: true },
      ];
      break;
    default:
      return null;
  }

  const validateCropValue = (value) => {
    return !isNaN(value) && value >= 0 && value <= 100;
  };

  const handleCropChange = (propName, newValue) => {
    if (!validateCropValue(newValue)) {
      setError(`Invalid value for ${propName}. Must be between 0 and 100.`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    let cropL = propName === 'cropL' ? newValue : localCropValues.cropL;
    let cropR = propName === 'cropR' ? newValue : localCropValues.cropR;
    let cropT = propName === 'cropT' ? newValue : localCropValues.cropT;
    let cropB = propName === 'cropB' ? newValue : localCropValues.cropB;

    if (cropL + cropR >= 100) {
      setError('Total crop (left + right) must be less than 100%.');
      setTimeout(() => setError(''), 3000);
      if (propName === 'cropL') cropL = 100 - cropR;
      if (propName === 'cropR') cropR = 100 - cropL;
      newValue = propName === 'cropL' ? cropL : cropR;
    }

    if (cropT + cropB >= 100) {
      setError('Total crop (top + bottom) must be less than 100%.');
      setTimeout(() => setError(''), 3000);
      if (propName === 'cropT') cropT = 100 - cropB;
      if (propName === 'cropB') cropB = 100 - cropT;
      newValue = propName === 'cropT' ? cropT : cropB;
    }

    const updatedLocalCropValues = {
      ...localCropValues,
      [propName]: newValue,
    };
    setLocalCropValues(updatedLocalCropValues);

    const updatedTempValues = {
      ...tempSegmentValues,
      [propName]: Number(newValue),
    };
    setTempSegmentValues(updatedTempValues);

    updateSegmentProperty(propName, Number(newValue));
  };

  const startDragging = (e, property) => {
    e.preventDefault();
    const initialX = e.clientX;
    const initialValue = parseFloat(
      tempSegmentValues[property.name] ||
      selectedSegment[property.name] ||
      (property.name === 'scale' || property.name === 'opacity' ? 1 : property.isCrop ? 0 : 0)
    );
    const step = property.step;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - initialX;
      const sensitivity = step < 1 ? 0.1 : 1;
      let newValue = initialValue + (deltaX * step * sensitivity);
      newValue = Math.max(property.min, Math.min(property.max, newValue));
      newValue = Math.round(newValue / step) * step;
      if (property.isCrop) {
        handleCropChange(property.name, newValue);
      } else {
        setTempSegmentValues((prev) => ({ ...prev, [property.name]: newValue }));
        updateSegmentProperty(property.name, newValue);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleValueClick = (property) => {
    setEditingProperty(property.name);
  };

  const handleInputChange = (e, property) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) return;
    newValue = Math.max(property.min, Math.min(property.max, newValue));
    newValue = Math.round(newValue / property.step) * property.step;
    if (property.isCrop) {
      handleCropChange(property.name, newValue);
    } else {
      setTempSegmentValues((prev) => ({ ...prev, [property.name]: newValue }));
      updateSegmentProperty(property.name, newValue);
    }
  };

  const handleInputKeyDown = (e, property) => {
    if (e.key === 'Enter') {
      setEditingProperty(null);
    }
  };

  const handleInputBlur = (property) => {
    setEditingProperty(null);
  };

  return (
    <div className="keyframe-section">
      {error && <div className="error-message">{error}</div>}
      {properties.map((prop) => {
        const hasKeyframes = prop.supportsKeyframes && keyframes[prop.name] && keyframes[prop.name].length > 0;
        const isAtKeyframe = hasKeyframes && keyframes[prop.name].some((kf) => areTimesEqual(kf.time, currentTimeInSegment));
        const currentValue = prop.isCrop
          ? localCropValues[prop.name]
          : hasKeyframes
          ? getValueAtTime(keyframes[prop.name], currentTimeInSegment)
          : (tempSegmentValues[prop.name] !== undefined
             ? tempSegmentValues[prop.name]
             : selectedSegment[prop.name] || (prop.name === 'scale' || prop.name === 'opacity' ? 1 : 0));
        const miniTimelineWidth = 200;
        const duration = selectedSegment.duration;

        return (
          <div key={prop.name} className="property-row">
            <div className="property-header">
              {prop.supportsKeyframes && (
                <button
                  className={`keyframe-toggle ${isAtKeyframe ? 'active' : ''}`}
                  onClick={() => toggleKeyframe(prop.name)}
                  title="Toggle Keyframe"
                >
                  ⏱
                </button>
              )}
              <label>{prop.label}</label>
            </div>
            <div className="property-controls">
              {editingProperty === prop.name ? (
                <input
                  type="text"
                  className="value-scrubber"
                  defaultValue={currentValue.toFixed(prop.step < 1 ? 2 : 0)}
                  onChange={(e) => handleInputChange(e, prop)}
                  onKeyDown={(e) => handleInputKeyDown(e, prop)}
                  onBlur={() => handleInputBlur(prop)}
                  autoFocus
                  style={{ width: '60px', textAlign: 'center' }}
                />
              ) : (
                <div
                  className="value-scrubber"
                  onClick={() => handleValueClick(prop)}
                  onMouseDown={(e) => startDragging(e, prop)}
                >
                  {currentValue.toFixed(prop.step < 1 ? 2 : 0)} {prop.unit}
                </div>
              )}
              {prop.supportsKeyframes && (
                <div className="keyframe-nav">
                  <button
                    onClick={() => navigateKeyframes(prop.name, 'prev')}
                    disabled={!hasKeyframes}
                  >
                    ◄
                  </button>
                  <button
                    onClick={() => navigateKeyframes(prop.name, 'next')}
                    disabled={!hasKeyframes}
                  >
                    ►
                  </button>
                </div>
              )}
            </div>
            {prop.supportsKeyframes && (
              <div className="mini-timeline">
                <div
                  className="mini-playhead"
                  style={{ left: `${(currentTimeInSegment / duration) * miniTimelineWidth}px` }}
                />
                {(keyframes[prop.name] || []).map((kf, index) => (
                  <div
                    key={index}
                    className="keyframe-marker"
                    style={{ left: `${(kf.time / duration) * miniTimelineWidth}px` }}
                    onClick={() => {
                      setTempSegmentValues((prev) => ({ ...prev, [prop.name]: kf.value }));
                      setCurrentTimeInSegment(kf.time);
                      handleTimeUpdate(selectedSegment.startTime + kf.time);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KeyframeControls;