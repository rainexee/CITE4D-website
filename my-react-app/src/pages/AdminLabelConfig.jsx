// AdminLabelConfig.jsx - Simplified version
import React, { useState, useEffect } from 'react';

function AdminLabelConfig({ datasetId, onConfigSaved }) {
  const [labelColumns, setLabelColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [newLabel, setNewLabel] = useState({
    columnName: '',
    displayColumn: '',
    description: '',
    possibleValues: ''
  });

  useEffect(() => {
    loadLabelConfig();
    loadDatasetColumns();
  }, [datasetId]);

  const loadDatasetColumns = async () => {
    try {
      const response = await fetch(`/api/datasets/${datasetId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.dataset) {
        const columns = data.dataset.columns || [];
        setAvailableColumns(Array.isArray(columns) ? columns : []);
      }
    } catch (error) {
      console.error('Error loading dataset columns:', error);
    }
  };

  const loadLabelConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/dataset/${datasetId}/labels`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setLabelColumns(data.labels);
      }
    } catch (error) {
      console.error('Error loading label config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLabel = () => {
    if (!newLabel.columnName.trim()) {
      alert('Label column name is required');
      return;
    }
    if (!newLabel.displayColumn) {
      alert('Display column is required (this is what students will see)');
      return;
    }
    
    // Process possible values - split by comma and trim
    let possibleValuesArray = [];
    if (newLabel.possibleValues && newLabel.possibleValues.trim()) {
      possibleValuesArray = newLabel.possibleValues.split(',').map(v => v.trim()).filter(v => v);
    }
    
    setLabelColumns(prev => [...prev, {
      column_name: newLabel.columnName.trim(),
      display_column: newLabel.displayColumn,
      description: newLabel.description.trim() || null,
      possible_values: possibleValuesArray
    }]);
    
    setNewLabel({
      columnName: '',
      displayColumn: '',
      description: '',
      possibleValues: ''
    });
  };

  const handleRemoveLabel = (index) => {
    setLabelColumns(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLabel = (index, field, value) => {
    setLabelColumns(prev => prev.map((label, i) => {
      if (i === index) {
        if (field === 'possible_values') {
          const valuesArray = value.split(',').map(v => v.trim()).filter(v => v);
          return { ...label, [field]: valuesArray };
        }
        return { ...label, [field]: value };
      }
      return label;
    }));
  };

  const handleSaveConfig = async () => {
    const invalidLabels = labelColumns.filter(l => !l.column_name || !l.column_name.trim());
    if (invalidLabels.length > 0) {
      alert('All label columns must have a label column name');
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        labelColumns: labelColumns.map(lc => ({
          columnName: lc.column_name,
          displayColumn: lc.display_column || lc.column_name,
          description: lc.description || null,
          possibleValues: lc.possible_values || []
        }))
      };
      
      const response = await fetch(`/api/admin/dataset/${datasetId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        onConfigSaved && onConfigSaved();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="loading-spinner-small"></div>;
  }

  return (
    <div className="admin-label-config">
      <h4>🏷️ Label Columns Configuration</h4>
      <p className="config-help">
        Configure which columns students should label. 
        <strong> Pro tip:</strong> You can type any column name - even ones not in the dataset. 
        New columns will be automatically appended to the CSV when annotations complete.
      </p>
      
      {availableColumns.length > 0 && (
        <div className="available-columns-hint">
          <small>📋 Existing columns in dataset: {availableColumns.join(', ')}</small>
        </div>
      )}
      
      {/* Existing Labels List */}
      {labelColumns.length > 0 && (
        <div className="labels-list">
          <h5>Configured Label Columns</h5>
          {labelColumns.map((label, idx) => {
            const isCustom = !availableColumns.includes(label.column_name);
            return (
              <div key={idx} className="label-config-item">
                <div className="label-header">
                  <span className="label-name">
                    {isCustom && <span className="custom-badge">🆕 New</span>}
                    Label: <strong>{label.column_name}</strong> 
                    (Display: <span className="display-column-name">{label.display_column || 'N/A'}</span>)
                  </span>
                  <button 
                    type="button"
                    className="remove-label-btn"
                    onClick={() => handleRemoveLabel(idx)}
                  >
                    Remove
                  </button>
                </div>
                <div className="label-fields-grid">
                  <div className="label-field">
                    <label>Label Column (what students assign):</label>
                    <input
                      type="text"
                      value={label.column_name}
                      onChange={(e) => handleUpdateLabel(idx, 'column_name', e.target.value)}
                      className="label-input"
                      placeholder="Column name"
                    />
                    {isCustom && (
                      <small className="custom-hint">✨ New column - will be added to dataset</small>
                    )}
                  </div>
                  <div className="label-field">
                    <label>Display Column (what students see):</label>
                    <select
                      value={label.display_column || ''}
                      onChange={(e) => handleUpdateLabel(idx, 'display_column', e.target.value)}
                      className="label-select"
                    >
                      <option value="">Select column...</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="label-fields-grid">
                  <div className="label-field">
                    <input
                      type="text"
                      value={label.description || ''}
                      onChange={(e) => handleUpdateLabel(idx, 'description', e.target.value)}
                      placeholder="Description/instructions for students"
                      className="label-desc-input"
                    />
                  </div>
                  <div className="label-field">
                    <input
                      type="text"
                      value={label.possible_values ? label.possible_values.join(', ') : ''}
                      onChange={(e) => handleUpdateLabel(idx, 'possible_values', e.target.value)}
                      placeholder="Possible values (comma-separated, leave empty for free text)"
                      className="label-values-input"
                    />
                  </div>
                </div>
                <small>Students will see the <strong>{label.display_column || '?'}</strong> column and assign a value to <strong>{label.column_name}</strong></small>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Add New Label Form */}
      <div className="add-label-form">
        <h5>Add New Label Column</h5>
        <div className="form-grid">
          <div className="form-row">
            <label>Column to Label:</label>
            <div className="column-selection-group">
              <input
                type="text"
                value={newLabel.columnName}
                onChange={(e) => setNewLabel({ ...newLabel, columnName: e.target.value })}
                placeholder="Enter column name (existing or new)"
                className="column-name-input"
              />
              <small className="hint-text">
                Tip: Type any name - if it doesn't exist, it will be created automatically
              </small>
            </div>
          </div>
          
          <div className="form-row">
            <label>Display Column (what students will see):</label>
            <select
              value={newLabel.displayColumn}
              onChange={(e) => setNewLabel({ ...newLabel, displayColumn: e.target.value })}
              className="column-select"
            >
              <option value="">Select column to display...</option>
              {availableColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-row">
          <input
            type="text"
            value={newLabel.description}
            onChange={(e) => setNewLabel({ ...newLabel, description: e.target.value })}
            placeholder="Instructions for students (optional)"
            className="description-input"
          />
        </div>
        <div className="form-row">
          <input
            type="text"
            value={newLabel.possibleValues}
            onChange={(e) => setNewLabel({ ...newLabel, possibleValues: e.target.value })}
            placeholder="Possible values (comma-separated, e.g., Positive, Negative, Neutral)"
            className="values-input"
          />
        </div>
        <button type="button" onClick={handleAddLabel} className="add-label-btn">
          + Add Label Column
        </button>
      </div>
      
      {/* Save Button */}
      <div className="config-actions">
        <button 
          onClick={handleSaveConfig} 
          disabled={isSaving}
          className="save-config-btn"
        >
          {isSaving ? 'Saving...' : 'Save Label Configuration'}
        </button>
      </div>
    </div>
  );
}

export default AdminLabelConfig;