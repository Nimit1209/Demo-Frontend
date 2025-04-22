import React, { useState, useEffect } from 'react';

const TextSegmentDialog = ({
  showTextDialog, // Keep this prop to control visibility
  // Remove textDialogPosition prop as it's no longer needed
  editingTextSegment,
  textSettings,
  onClose,
  onSave,
  onTextSettingsChange,
}) => {
  const [localTextSettings, setLocalTextSettings] = useState({ ...textSettings });

  useEffect(() => {
    if (editingTextSegment && !editingTextSegment.isNew) {
      setLocalTextSettings({
        text: editingTextSegment.text || 'Text',
        fontFamily: editingTextSegment.fontFamily || 'Arial',
        fontSize: editingTextSegment.fontSize || 24,
        fontColor: editingTextSegment.fontColor || '#FFFFFF',
        backgroundColor: editingTextSegment.backgroundColor || 'transparent',
        positionX: editingTextSegment.positionX || 0,
        positionY: editingTextSegment.positionY || 0,
        duration: editingTextSegment.duration || 5,
      });
    } else {
      setLocalTextSettings({ ...textSettings });
    }
  }, [editingTextSegment, textSettings]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    onSave(localTextSettings);
  };

  return (
    <div className={`text-segment-dialog ${showTextDialog ? 'show' : ''}`}>
      <div className="dialog-header">
        <h3>{editingTextSegment?.isNew ? 'Add Text' : 'Edit Text'}</h3>
        <button className="close-button" onClick={handleClose}>×</button>
      </div>

      <div className="dialog-content">
        <div className="form-group">
          <label>Text</label>
          <textarea
            value={localTextSettings.text}
            onChange={(e) => setLocalTextSettings({ ...localTextSettings, text: e.target.value })}
            rows={3}
          ></textarea>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Font</label>
            <select
              value={localTextSettings.fontFamily}
              onChange={(e) => setLocalTextSettings({ ...localTextSettings, fontFamily: e.target.value })}
            >
              <option value="Arial">Arial</option>
              <option value="Verdana">Verdana</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>

          <div className="form-group">
            <label>Size</label>
            <input
              type="number"
              value={localTextSettings.fontSize}
              onChange={(e) => setLocalTextSettings({ ...localTextSettings, fontSize: parseInt(e.target.value) })}
              min="8"
              max="72"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Text Color</label>
            <input
              type="color"
              value={localTextSettings.fontColor}
              onChange={(e) => setLocalTextSettings({ ...localTextSettings, fontColor: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Background</label>
            <input
              type="color"
              value={localTextSettings.backgroundColor === 'transparent' ? '#000000' : localTextSettings.backgroundColor}
              onChange={(e) => setLocalTextSettings({ ...localTextSettings, backgroundColor: e.target.value })}
            />
            <label>
              <input
                type="checkbox"
                checked={localTextSettings.backgroundColor === 'transparent'}
                onChange={(e) =>
                  setLocalTextSettings({
                    ...localTextSettings,
                    backgroundColor: e.target.checked ? 'transparent' : '#000000',
                  })
                }
              />
              Transparent
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Position X</label>
            <input
              type="range"
              min="0"
              max="100"
              value={localTextSettings.positionX}
              onChange={(e) => setLocalTextSettings({ ...localTextSettings, positionX: parseInt(e.target.value) })}
            />
            <span>{localTextSettings.positionX}%</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Position Y</label>
            <input
              type="range"
              min="0"
              max="100"
              value={localTextSettings.positionY}
              onChange={(e) => setLocalTextSettings({ ...localTextSettings, positionY: parseInt(e.target.value) })}
            />
            <span>{localTextSettings.positionY}%</span>
          </div>
        </div>

        <div className="form-group">
          <label>Duration (seconds)</label>
          <input
            type="number"
            value={localTextSettings.duration}
            onChange={(e) => setLocalTextSettings({ ...localTextSettings, duration: parseFloat(e.target.value) })}
            min="0.1"
            step="0.1"
          />
        </div>

        <div className="dialog-buttons">
          <button className="cancel-button" onClick={handleClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default TextSegmentDialog;