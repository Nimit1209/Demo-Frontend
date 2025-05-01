import React from 'react';

const FilterControls = ({
  selectedSegment,
  filterParams,
  appliedFilters,
  updateFilterSetting,
  resetFilters
}) => {
  return (
    <div className="filters-panel" style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <h3>
        Filters
        {selectedSegment && (selectedSegment.type === 'video' || selectedSegment.type === 'image') && (
          <button
            onClick={resetFilters}
            style={{
              marginLeft: '10px',
              padding: '2px 6px',
              fontSize: '12px',
              cursor: 'pointer',
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
            title="Reset all filters"
          >
            ↺
          </button>
        )}
      </h3>
      {!selectedSegment || (selectedSegment.type !== 'video' && selectedSegment.type !== 'image') ? (
        <p>Select a video or image segment to apply filters</p>
      ) : (
        <>
          {/* Color Adjustments */}
          <div className="filter-group">
            <h4>Color Adjustments</h4>
            <div className="control-group">
              <label>Brightness (-1 to 1)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={filterParams.brightness !== undefined ? filterParams.brightness : 0}
                  onChange={(e) => updateFilterSetting('brightness', parseFloat(e.target.value))}
                />
                <input
                  type="number"
                  value={filterParams.brightness !== undefined ? filterParams.brightness : 0}
                  onChange={(e) => updateFilterSetting('brightness', parseFloat(e.target.value))}
                  step="0.01"
                  min="-1"
                  max="1"
                  style={{ width: '60px', marginLeft: '10px' }}
                />
              </div>
            </div>
            <div className="control-group">
              <label>Contrast (0 to 2)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={filterParams.contrast !== undefined ? filterParams.contrast : 1}
                  onChange={(e) => updateFilterSetting('contrast', parseFloat(e.target.value))}
                />
                <input
                  type="number"
                  value={filterParams.contrast !== undefined ? filterParams.contrast : 1}
                  onChange={(e) => updateFilterSetting('contrast', parseFloat(e.target.value))}
                  step="0.01"
                  min="0"
                  max="2"
                  style={{ width: '60px', marginLeft: '10px' }}
                />
              </div>
            </div>
            <div className="control-group">
              <label>Saturation (0 to 2)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={filterParams.saturation !== undefined ? filterParams.saturation : 1}
                  onChange={(e) => updateFilterSetting('saturation', parseFloat(e.target.value))}
                />
                <input
                  type="number"
                  value={filterParams.saturation !== undefined ? filterParams.saturation : 1}
                  onChange={(e) => updateFilterSetting('saturation', parseFloat(e.target.value))}
                  step="0.01"
                  min="0"
                  max="2"
                  style={{ width: '60px', marginLeft: '10px' }}
                />
              </div>
            </div>
            <div className="control-group">
              <label>Hue (-180 to 180)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={filterParams.hue !== undefined ? filterParams.hue : 0}
                  onChange={(e) => updateFilterSetting('hue', parseInt(e.target.value))}
                />
                <input
                  type="number"
                  value={filterParams.hue !== undefined ? filterParams.hue : 0}
                  onChange={(e) => updateFilterSetting('hue', parseInt(e.target.value))}
                  step="1"
                  min="-180"
                  max="180"
                  style={{ width: '60px', marginLeft: '10px' }}
                />
              </div>
            </div>
          </div>

          {/* Stylization Filters */}
          <div className="filter-group">
            <h4>Stylization</h4>
            <div className="control-group">
              <label>Grayscale</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={!!filterParams.grayscale}
                  onChange={(e) => updateFilterSetting('grayscale', e.target.checked ? '1' : '')}
                />
              </div>
            </div>
            <div className="control-group">
              <label>Invert</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={!!filterParams.invert}
                  onChange={(e) => updateFilterSetting('invert', e.target.checked ? '1' : '')}
                />
              </div>
            </div>
          </div>

          {/* Transformation */}
          <div className="filter-group">
            <h4>Transformation</h4>
            <div className="control-group">
              <label>Rotate (-180 to 180°)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={filterParams.rotate !== undefined ? filterParams.rotate : 0}
                  onChange={(e) => updateFilterSetting('rotate', parseInt(e.target.value))}
                />
                <input
                  type="number"
                  value={filterParams.rotate !== undefined ? filterParams.rotate : 0}
                  onChange={(e) => updateFilterSetting('rotate', parseInt(e.target.value))}
                  step="1"
                  min="-180"
                  max="180"
                  style={{ width: '60px', marginLeft: '10px' }}
                />
              </div>
            </div>
            <div className="control-group">
              <label>Flip</label>
              <select
                value={filterParams.flip || 'none'}
                onChange={(e) => updateFilterSetting('flip', e.target.value === 'none' ? '' : e.target.value)}
              >
                <option value="none">None</option>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterControls;