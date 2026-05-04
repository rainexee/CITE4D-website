// NewDataset.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Upload,
  X,
  Plus,
  Trash2,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader,
  ArrowLeft,
  Eye,
  Tag,
  Calendar,
  Users,
  BarChart3,
  BookOpen,
  Award,
  Clock,
  User,
  LogOut,
  Settings,
  Bell,
  Menu,
  Search,
  Grid,
  List,
  ChevronDown,
  Sparkles,
  FolderOpen,
  MapPin,
  Mail,
  Activity,
  Flame,
  Star
} from 'lucide-react';
import '../styles/Dashboard.css';
import '../styles/NewDataset.css';

function NewDataset() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'education',
    tags: [],
    author: '',
    format: 'CSV',
    size: '',
    columns: [],
    isPublic: true,
    license: 'MIT',
    version: '1.0.0',
    source: '',
    methodology: '',
    updateFrequency: 'monthly'
  });

  // Tag input state
  const [tagInput, setTagInput] = useState('');
  
  // Column input state
  const [columnInput, setColumnInput] = useState('');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  
  // Form validation
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Categories
  const categories = [
    { id: 'education', name: 'Education', icon: <BookOpen size={18} /> },
    { id: 'analytics', name: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'trending', name: 'Trending', icon: <Activity size={18} /> },
    { id: 'popular', name: 'Popular', icon: <Star size={18} /> },
    { id: 'research', name: 'Research', icon: <Database size={18} /> }
  ];

  // Licenses
  const licenses = [
    'MIT',
    'Apache 2.0',
    'GPL 3.0',
    'CC BY 4.0',
    'CC BY-SA 4.0',
    'ODC Open Database License'
  ];

  // Formats
  const formats = ['CSV', 'JSON', 'Excel', 'Parquet', 'SQLite'];

  // Update frequencies
  const frequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one-time'];

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        
        // Check if user is admin
        if (userData.role !== 'admin') {
          navigate('/dashboard');
        }
        
        // Set author to user's name
        setFormData(prev => ({
          ...prev,
          author: userData.name || userData.email
        }));
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      navigate('/');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        setUser(null);
        navigate('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTagAdd = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim().toLowerCase()]
      }));
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTagAdd();
    }
  };

  const handleColumnAdd = () => {
    if (columnInput.trim() && !formData.columns.includes(columnInput.trim())) {
      setFormData(prev => ({
        ...prev,
        columns: [...prev.columns, columnInput.trim()]
      }));
      setColumnInput('');
    }
  };

  const handleColumnRemove = (columnToRemove) => {
    setFormData(prev => ({
      ...prev,
      columns: prev.columns.filter(col => col !== columnToRemove)
    }));
  };

  const handleColumnKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleColumnAdd();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|json|xlsx|xls)$/)) {
      setFileError('Please upload a valid file (CSV, JSON, or Excel)');
      setSelectedFile(null);
      return;
    }
    
    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setFileError('File size must be less than 100MB');
      setSelectedFile(null);
      return;
    }
    
    setFileError(null);
    setSelectedFile(file);
    setFormData(prev => ({
      ...prev,
      size: formatFileSize(file.size)
    }));
    
    // Preview CSV/JSON file
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      previewCSV(file);
    } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
      previewJSON(file);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const previewCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').slice(0, 6);
      const headers = lines[0].split(',');
      
      // Auto-populate columns if empty
      if (formData.columns.length === 0) {
        setFormData(prev => ({
          ...prev,
          columns: headers.slice(0, 10)
        }));
      }
      
      const previewData = lines.slice(1, 4).map(line => line.split(','));
      setFilePreview({ type: 'csv', headers, data: previewData });
    };
    reader.readAsText(file);
  };

  const previewJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const previewData = Array.isArray(data) ? data.slice(0, 3) : data;
        
        // Auto-populate columns if empty and data is array of objects
        if (formData.columns.length === 0 && Array.isArray(data) && data.length > 0) {
          setFormData(prev => ({
            ...prev,
            columns: Object.keys(data[0]).slice(0, 10)
          }));
        }
        
        setFilePreview({ type: 'json', data: previewData });
      } catch (error) {
        console.error('JSON parsing error:', error);
        setFileError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    } else if (formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }
    
    if (!formData.author.trim()) {
      newErrors.author = 'Author is required';
    }
    
    if (formData.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    } else if (formData.tags.length > 10) {
      newErrors.tags = 'Maximum 10 tags allowed';
    }
    
    if (formData.columns.length === 0) {
      newErrors.columns = 'At least one column is required';
    }
    
    if (!selectedFile && !formData.size) {
      newErrors.file = 'Please upload a dataset file';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            const firstError = document.querySelector('.error-message');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        
        setIsLoading(true);
        setUploadProgress(0);
        setUploadStatus(null);
        
        try {
            // Create FormData for API submission
            const submitData = new FormData();
            
            // Create metadata object
            const metadata = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                tags: formData.tags,
                author: formData.author,
                format: formData.format,
                size: formData.size,
                columns: formData.columns,
                version: formData.version,
                license: formData.license,
                source: formData.source,
                methodology: formData.methodology,
                updateFrequency: formData.updateFrequency,
                isPublic: formData.isPublic
            };
            
            // Append metadata as JSON string
            submitData.append('metadata', JSON.stringify(metadata));
            
            // Append the file
            if (selectedFile) {
                submitData.append('dataset', selectedFile);
            }
            
            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(progressInterval);
                        return 95;
                    }
                    return prev + 5;
                });
            }, 200);
            
            // Make API call to the existing /api/upload endpoint
            const response = await fetch('/api/upload', {
                method: 'POST',
                credentials: 'include',
                body: submitData
            });
            
            clearInterval(progressInterval);
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                setUploadProgress(100);
                setUploadStatus({ 
                    type: 'success', 
                    message: data.message || 'Dataset uploaded successfully!' 
                });
                
                // Redirect after short delay
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } else {
                throw new Error(data.error || 'Failed to upload dataset');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus({ 
                type: 'error', 
                message: error.message || 'Failed to upload dataset. Please try again.' 
            });
            setIsLoading(false);
        }
    };

  if (!user) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
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
            <h3>Main</h3>
            <button className="nav-item" onClick={() => navigate('/dashboard')}>
              <Database size={20} />
              <span>Datasets</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/my-datasets')}>
              <FolderOpen size={20} />
              <span>My Datasets</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/analytics')}>
              <BarChart3 size={20} />
              <span>Analytics</span>
            </button>
          </div>
          
          <div className="nav-section">
            <h3>Community</h3>
            <button className="nav-item">
              <Users size={20} />
              <span>Discussions</span>
            </button>
            <button className="nav-item">
              <Award size={20} />
              <span>Leaderboard</span>
            </button>
          </div>
          
          <div className="nav-section">
            <h3>Resources</h3>
            <button className="nav-item">
              <BookOpen size={20} />
              <span>Tutorials</span>
            </button>
            <button className="nav-item">
              <FileText size={20} />
              <span>Documentation</span>
            </button>
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div className="user-info-sidebar">
            <div className="user-avatar">
              {user?.picture ? (
                <img src={user.picture} alt={user.name} />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.name?.split(' ')[0] || 'User'}</span>
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
        {/* Header */}
        <header className="dashboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          
          <div className="header-search">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search datasets..."
            />
          </div>
          
          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={20} />
            </button>
            
            <div className="user-menu-wrapper">
              <div 
                className="user-avatar-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} />
                ) : (
                  <User size={20} />
                )}
                <ChevronDown size={16} />
              </div>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <hr />
                  <button onClick={() => navigate('/profile')} className="dropdown-item">
                    <User size={16} />
                    Profile
                  </button>
                  <button onClick={() => navigate('/settings')} className="dropdown-item">
                    <Settings size={16} />
                    Settings
                  </button>
                  <hr />
                  <button onClick={handleLogout} className="dropdown-item logout">
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* New Dataset Form */}
        <div className="new-dataset-container">
          <div className="form-header">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
            <h1>
              <Upload size={28} />
              Upload New Dataset
            </h1>
            <p>Share your data with the DLSU community. All datasets are reviewed before publication.</p>
          </div>
          
          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.type}`}>
              {uploadStatus.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span>{uploadStatus.message}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="dataset-form">
            {/* Basic Information */}
            <div className="form-section">
              <h2>Basic Information</h2>
              <div className="form-group">
                <label htmlFor="title">
                  Dataset Title *
                  <span className="required">required</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  onBlur={() => setTouched({ ...touched, title: true })}
                  placeholder="e.g., DLSU Course Evaluation Dataset 2024"
                  className={errors.title && touched.title ? 'error' : ''}
                />
                {errors.title && touched.title && <span className="error-message">{errors.title}</span>}
                <small className="field-hint">A clear, descriptive title (5-200 characters)</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="description">
                  Description *
                  <span className="required">required</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  onBlur={() => setTouched({ ...touched, description: true })}
                  rows="5"
                  placeholder="Describe what this dataset contains, its purpose, and potential use cases..."
                  className={errors.description && touched.description ? 'error' : ''}
                />
                {errors.description && touched.description && <span className="error-message">{errors.description}</span>}
                <small className="field-hint">
                  {formData.description.length}/2000 characters
                </small>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <div className="category-selector">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`category-option ${formData.category === cat.id ? 'active' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                      >
                        {cat.icon}
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="format">File Format *</label>
                  <select
                    id="format"
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                  >
                    {formats.map(fmt => (
                      <option key={fmt} value={fmt}>{fmt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* File Upload */}
            <div className="form-section">
              <h2>Dataset File</h2>
              <div className={`file-upload-area ${fileError ? 'error' : ''}`}>
                {!selectedFile ? (
                  <>
                    <input
                      type="file"
                      id="dataset-file"
                      accept=".csv,.json,.xlsx,.xls"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="dataset-file" className="upload-label">
                      <Upload size={48} />
                      <span className="upload-title">Click to upload or drag and drop</span>
                      <span className="upload-subtitle">CSV, JSON, or Excel files (max 100MB)</span>
                    </label>
                  </>
                ) : (
                  <div className="file-preview">
                    <div className="file-info">
                      <FileText size={32} />
                      <div>
                        <strong>{selectedFile.name}</strong>
                        <span>{formData.size}</span>
                      </div>
                      <button 
                        type="button"
                        className="remove-file"
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                          setFormData(prev => ({ ...prev, size: '' }));
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    
                    {filePreview && (
                      <div className="data-preview">
                        <h4>Data Preview</h4>
                        <div className="preview-scroll">
                          {filePreview.type === 'csv' && (
                            <table className="preview-table small">
                              <thead>
                                <tr>
                                  {filePreview.headers.slice(0, 5).map((header, idx) => (
                                    <th key={idx}>{header}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filePreview.data.map((row, idx) => (
                                  <tr key={idx}>
                                    {row.slice(0, 5).map((cell, cellIdx) => (
                                      <td key={cellIdx}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {filePreview.type === 'json' && (
                            <pre className="json-preview">
                              {JSON.stringify(filePreview.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {fileError && <span className="error-message">{fileError}</span>}
              </div>
            </div>
            
            {/* Tags & Metadata */}
            <div className="form-section">
              <h2>Tags & Metadata</h2>
              <div className="form-group">
                <label htmlFor="tags">
                  Tags *
                  <span className="required">required</span>
                </label>
                <div className="tags-input">
                  <div className="tags-list">
                    {formData.tags.map(tag => (
                      <span key={tag} className="tag-item">
                        #{tag}
                        <button type="button" onClick={() => handleTagRemove(tag)}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    placeholder="Add a tag and press Enter"
                  />
                </div>
                {errors.tags && <span className="error-message">{errors.tags}</span>}
                <small className="field-hint">Add relevant tags to help users find your dataset (max 10)</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="columns">
                  Columns/Fields *
                  <span className="required">required</span>
                </label>
                <div className="columns-input">
                  <div className="columns-list">
                    {formData.columns.map(column => (
                      <span key={column} className="column-item">
                        {column}
                        <button type="button" onClick={() => handleColumnRemove(column)}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={columnInput}
                    onChange={(e) => setColumnInput(e.target.value)}
                    onKeyPress={handleColumnKeyPress}
                    placeholder="Add a column name and press Enter"
                  />
                </div>
                {errors.columns && <span className="error-message">{errors.columns}</span>}
                <small className="field-hint">List all columns/fields in your dataset</small>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="author">Author/Organization *</label>
                  <input
                    type="text"
                    id="author"
                    name="author"
                    value={formData.author}
                    onChange={handleInputChange}
                    onBlur={() => setTouched({ ...touched, author: true })}
                    className={errors.author && touched.author ? 'error' : ''}
                  />
                  {errors.author && touched.author && <span className="error-message">{errors.author}</span>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="version">Version</label>
                  <input
                    type="text"
                    id="version"
                    name="version"
                    value={formData.version}
                    onChange={handleInputChange}
                    placeholder="1.0.0"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="license">License *</label>
                  <select
                    id="license"
                    name="license"
                    value={formData.license}
                    onChange={handleInputChange}
                  >
                    {licenses.map(lic => (
                      <option key={lic} value={lic}>{lic}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="updateFrequency">Update Frequency</label>
                  <select
                    id="updateFrequency"
                    name="updateFrequency"
                    value={formData.updateFrequency}
                    onChange={handleInputChange}
                  >
                    {frequencies.map(freq => (
                      <option key={freq} value={freq}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="form-section">
              <h2>Additional Information</h2>
              <div className="form-group">
                <label htmlFor="source">Data Source</label>
                <input
                  type="text"
                  id="source"
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  placeholder="Where did this data come from?"
                />
                <small className="field-hint">URL or description of the original data source</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="methodology">Collection Methodology</label>
                <textarea
                  id="methodology"
                  name="methodology"
                  value={formData.methodology}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Describe how the data was collected, processed, and any limitations..."
                />
                <small className="field-hint">Help users understand the data collection process</small>
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleInputChange}
                  />
                  Make this dataset publicly available
                </label>
                <small>Public datasets can be viewed and downloaded by all users</small>
              </div>
            </div>
            
            {/* Form Actions */}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader size={18} className="spinning" />
                    Uploading... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Upload Dataset
                  </>
                )}
              </button>
            </div>
            
            {isLoading && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <span>{uploadProgress}% uploaded</span>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

export default NewDataset;