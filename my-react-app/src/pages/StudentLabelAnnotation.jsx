// StudentLabelAnnotation.jsx - Fixed display column rendering

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, LogOut, User, ChevronDown, Menu, X, Save, 
  Eye, CheckCircle, AlertCircle, RefreshCw, Check
} from 'lucide-react';

import '../styles/StudentLabelAnnotation.css';

function StudentLabelAnnotation() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [selectedValue, setSelectedValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [message, setMessage] = useState(null);
  const [taskMessage, setTaskMessage] = useState(null);

  useEffect(() => {
    checkUserSession();
    loadTask();
  }, []);

  const checkUserSession = async () => {
    try {
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      if (response.ok) {
        const userData = await response.json();
        if (userData.role !== 'student') {
          navigate('/dashboard');
          return;
        }
        setUser(userData);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      navigate('/');
    }
  };

  const loadTask = async () => {
    setIsLoading(true);
    setSelectedValue('');
    setTaskMessage(null);
    
    try {
      const response = await fetch('/api/student/annotation-task', { 
        credentials: 'include' 
      });
      const data = await response.json();
      
      if (data.success) {
        setAssignment(data.hasAssignment ? data.assignment : null);
        if (!data.hasAssignment) {
          setMessage({ type: 'info', text: data.message || 'No tasks available!' });
        }
      }
    } catch (error) {
      console.error('Error loading task:', error);
      setMessage({ type: 'error', text: 'Failed to load your task' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
      if (!selectedValue) {
          setTaskMessage({ type: 'error', text: 'Please select a value before submitting' });
          return;
      }

      setIsSubmitting(true);
      try {
          const response = await fetch('/api/student/submit-annotation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                  assignmentId: assignment.id,
                  selectedValue: selectedValue
              })
          });

          const data = await response.json();
          
          if (data.success) {
              setTaskMessage({ type: 'success', text: data.message });
              setSelectedValue('');
              
              // IMPORTANT: Update the assignment with new limitInfo
              if (data.limitInfo) {
                  setAssignment(prev => prev ? {
                      ...prev,
                      limitInfo: data.limitInfo
                  } : null);
              }
              
              if (data.nextAssignment) {
                  setTimeout(() => {
                      // Make sure nextAssignment has displayColumn and limitInfo
                      if (data.nextAssignment && !data.nextAssignment.displayColumn) {
                          data.nextAssignment.displayColumn = data.nextAssignment.columnName;
                      }
                      // If the next assignment doesn't have limitInfo, use the current one
                      if (data.nextAssignment && !data.nextAssignment.limitInfo && data.limitInfo) {
                          data.nextAssignment.limitInfo = data.limitInfo;
                      }
                      setAssignment(data.nextAssignment);
                      setTaskMessage(null);
                  }, 1500);
              } else {
                  // Check if student has reached their limit
                  if (data.limitInfo && data.limitInfo.remaining <= 0) {
                      setTaskMessage({ 
                          type: 'info', 
                          text: `🎉 You've completed all ${data.limitInfo.maxAllowed} annotations for this dataset! Great job!` 
                      });
                      setTimeout(() => {
                          setAssignment(null);
                          setTaskMessage(null);
                          setMessage({ type: 'info', text: 'Great job! No more tasks available at the moment.' });
                      }, 3000);
                  } else {
                      setTimeout(() => {
                          setAssignment(null);
                          setTaskMessage(null);
                          setMessage({ type: 'info', text: 'Great job! No more tasks available at the moment.' });
                      }, 1500);
                  }
              }
          } else {
              setTaskMessage({ type: 'error', text: data.error || 'Failed to submit' });
          }
      } catch (error) {
          console.error('Error submitting:', error);
          setTaskMessage({ type: 'error', text: 'An error occurred. Please try again.' });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your task...</p>
      </div>
    );
  }

  const renderValueSelector = () => {
    if (!assignment) return null;
    
    const { possibleValues, columnName } = assignment;
    
    if (possibleValues && possibleValues.length > 0) {
      return (
        <div className="value-selector predefined">
          <label>Select a value for <strong>{columnName}</strong>:</label>
          <div className="value-buttons">
            {possibleValues.map((value, idx) => (
              <button
                key={idx}
                type="button"
                className={`value-btn ${selectedValue === value ? 'selected' : ''}`}
                onClick={() => setSelectedValue(value)}
              >
                {selectedValue === value && <Check size={14} />}
                {value}
              </button>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div className="value-selector free-text">
        <label htmlFor="annotationValue">
          Enter a value for <strong>{columnName}</strong>:
        </label>
        <textarea
          id="annotationValue"
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          placeholder="Enter your annotation here..."
          rows={3}
          disabled={isSubmitting}
        />
      </div>
    );
  };

  // Helper to get display column value from rowData
  const getDisplayValue = () => {
    if (!assignment || !assignment.rowData) return null;
    
    const { displayColumn, rowData } = assignment;
    
    // Try to get the display column value
    if (displayColumn && rowData[displayColumn] !== undefined) {
      return rowData[displayColumn];
    }
    
    // Fallback: get the first value from rowData
    const values = Object.values(rowData);
    return values.length > 0 ? values[0] : null;
  };

  // Helper to get the label column current value
  const getLabelCurrentValue = () => {
    if (!assignment || !assignment.rowData) return null;
    
    const { columnName, rowData } = assignment;
    const key = 'current_' + columnName;
    return rowData[key] !== undefined ? rowData[key] : null;
  };

  return (
    <div className="dashboard-container">
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo" onClick={() => navigate('/')}>
            <Database size={28} />
            <span>The Data Collective</span>
          </div>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="sidebar-nav">
          <div className="nav-section">
            <h3>Student Tasks</h3>
            <button className="nav-item active" onClick={loadTask}>
              <Eye size={20} />
              <span>My Current Task</span>
            </button>
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div className="user-info-sidebar">
            <div className="user-avatar">
              {user?.picture ? <img src={user.picture} alt={user.name} /> : <User size={20} />}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.name?.split(' ')[0] || 'Student'}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <h1>Label Annotation Task</h1>
          <div className="user-menu-wrapper">
            <div className="user-avatar-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
              {user?.picture ? <img src={user.picture} alt={user.name} /> : <User size={20} />}
              <ChevronDown size={16} />
            </div>
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                </div>
                <hr />
                <button onClick={handleLogout} className="dropdown-item logout">
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {message && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {taskMessage && (
          <div className={`task-message ${taskMessage.type}`}>
            {taskMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{taskMessage.text}</span>
          </div>
        )}

        {assignment ? (
          <div className="label-annotation-container">
            {/* Limit Info */}
            {assignment.limitInfo && (
                <div className="limit-info-banner">
                    <div className="limit-stats">
                        <span>📊 Your progress for this dataset:</span>
                        <span className="limit-count">
                            {assignment.limitInfo.totalUsed} / {assignment.limitInfo.maxAllowed} annotations
                        </span>
                    </div>
                    <div className="limit-progress-bar">
                        <div 
                            className="limit-progress-fill"
                            style={{ 
                                width: assignment.limitInfo.totalUsed > 0 
                                    ? `${(assignment.limitInfo.totalUsed / assignment.limitInfo.maxAllowed) * 100}%` 
                                    : '0%'
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Dataset Information */}
            <div className="task-card">
              <h2>{assignment.datasetTitle}</h2>
              <p className="dataset-description">{assignment.datasetDescription}</p>
              
              <div className="task-info">
                <div className="info-box">
                  <h3>🎯 Your Task</h3>
                  <p><strong>Column to label:</strong> {assignment.columnName}</p>
                  {assignment.labelDescription && (
                    <p><strong>Instructions:</strong> {assignment.labelDescription}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Current Row Data - Show ONLY the display column */}
            <div className="task-card">
              <h3>📊 Current Row Data</h3>
              <p className="task-context">
                Based on the <strong>{assignment.displayColumn}</strong> column below, what label should be assigned to <strong>{assignment.columnName}</strong>?
              </p>
              
              <div className="data-preview">
                <table className="row-data-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Show the display column value */}
                    <tr className="display-column-row highlight-row">
                      <td className="column-name">
                        <strong>{assignment.displayColumn}</strong> 
                        <span className="display-badge">📌 base your label on this</span>
                      </td>
                      <td className="column-value display-value">
                        <span className="display-value-text">{getDisplayValue() || '—'}</span>
                      </td>
                    </tr>
                    
                    {/* Show the label column (needs annotation) */}
                    <tr className="target-column">
                      <td className="column-name">
                        <strong>{assignment.columnName}</strong> 
                        <span className="needs-label-badge">✏️ needs your label</span>
                      </td>
                      <td className="column-value">
                        {getLabelCurrentValue() ? (
                          <span className="current-value">Current: {getLabelCurrentValue()}</span>
                        ) : (
                          <span className="empty-value">[Select a value below]</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Show other columns as context */}
              {assignment.rowData && Object.keys(assignment.rowData).length > 2 && (
                <div className="row-context">
                  <details>
                    <summary>📋 View full row context (other columns)</summary>
                    <table className="context-table">
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(assignment.rowData).map(([key, value]) => {
                          const isDisplayColumn = key === assignment.displayColumn;
                          const isLabelColumn = key === 'current_' + assignment.columnName;
                          if (!isDisplayColumn && !isLabelColumn) {
                            return (
                              <tr key={key}>
                                <td className="column-name">{key}</td>
                                <td className="column-value">{value || '—'}</td>
                              </tr>
                            );
                          }
                          return null;
                        })}
                      </tbody>
                    </table>
                  </details>
                </div>
              )}
            </div>

            {/* Value Selector */}
            <div className="task-card highlight">
              <h3>✏️ Select Value for {assignment.columnName}</h3>
              {renderValueSelector()}
              
              <div className="task-help-text">
                <small>Based on the <strong>{assignment.displayColumn}</strong> value above, select the appropriate label for <strong>{assignment.columnName}</strong></small>
              </div>
              
              <div className="task-actions">
                <button 
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  <Save size={18} />
                  {isSubmitting ? 'Submitting...' : 'Submit Annotation'}
                </button>
                <button 
                  className="btn-secondary"
                  onClick={loadTask}
                  disabled={isSubmitting}
                >
                  <RefreshCw size={18} />
                  Refresh Task
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-task-container">
            <div className="no-task-card">
              <CheckCircle size={64} className="success-icon" />
              <h2>No Tasks Available!</h2>
              <p>{message?.text || "You've completed all available tasks. Check back later for more!"}</p>
              <button className="btn-primary" onClick={loadTask}>
                <RefreshCw size={18} />
                Refresh
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default StudentLabelAnnotation;