import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, LogOut, User, ChevronDown, Menu, X, Save, Eye, CheckCircle, AlertCircle } from 'lucide-react';

function StudentAnnotationView() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [submittedValue, setSubmittedValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [message, setMessage] = useState(null);

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
    try {
      const response = await fetch('/api/student/task', { credentials: 'include' });
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
    if (!submittedValue.trim()) {
      setMessage({ type: 'error', text: 'Please enter a value before submitting' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assignmentId: assignment.id,
          submittedValue: submittedValue.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setSubmittedValue('');
        
        if (data.nextAssignment) {
          setAssignment(data.nextAssignment);
        } else {
          setAssignment(null);
          setMessage({ type: 'info', text: 'Great job! No more tasks available at the moment.' });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit' });
      }
    } catch (error) {
      console.error('Error submitting:', error);
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
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

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <h1>Student Annotation Task</h1>
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

        {/* Message Display */}
        {message && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {assignment ? (
          <div className="student-task-container">
            {/* Dataset Information */}
            <div className="task-card">
              <h2>{assignment.datasetTitle}</h2>
              <p className="dataset-description">{assignment.datasetDescription}</p>
              
              <div className="task-info">
                <div className="info-box">
                  <h3>🎯 Your Task</h3>
                  <p><strong>Column to fill:</strong> {assignment.columnName}</p>
                  <p><strong>Instructions:</strong> {assignment.taskDescription}</p>
                </div>
              </div>
            </div>

            {/* Current Row Data Display */}
            <div className="task-card">
              <h3>📊 Current Row Data</h3>
              <div className="data-preview">
                <table className="row-data-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.rowData && Object.entries(assignment.rowData).map(([key, value]) => (
                      <tr key={key} className={key === assignment.columnName ? 'target-column' : ''}>
                        <td className="column-name">{key}</td>
                        <td className="column-value">
                          {key === assignment.columnName ? (
                            <span className="empty-value">[Empty - Needs your input]</span>
                          ) : (
                            value || '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Input Form */}
            <div className="task-card highlight">
              <h3>✏️ Enter Value for {assignment.columnName}</h3>
              <div className="input-section">
                <label htmlFor="annotationValue">
                  Based on the other data in this row, what should go in the <strong>{assignment.columnName}</strong> column?
                </label>
                <textarea
                  id="annotationValue"
                  value={submittedValue}
                  onChange={(e) => setSubmittedValue(e.target.value)}
                  placeholder="Enter your annotation here..."
                  rows={4}
                />
                <div className="button-group">
                  <button 
                    className="btn-primary" 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <Save size={18} />
                    {isSubmitting ? 'Submitting...' : 'Submit Annotation'}
                  </button>
                  <button className="btn-secondary" onClick={loadTask}>
                    Refresh Task
                  </button>
                </div>
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
                Refresh
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default StudentAnnotationView;