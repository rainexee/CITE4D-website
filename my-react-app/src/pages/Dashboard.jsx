import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Search,
  Filter,
  TrendingUp,
  Users,
  Download,
  Eye,
  ThumbsUp,
  MessageSquare,
  Star,
  ChevronDown,
  Grid,
  List,
  BarChart3,
  BookOpen,
  Award,
  Clock,
  User,
  LogOut,
  Settings,
  Bell,
  Menu,
  X,
  Plus,
  ExternalLink,
  Calendar,
  Activity,
  Flame,
  Sparkles,
  FolderOpen,
  FileText,
  Mail,
  MapPin
} from 'lucide-react';
import '../styles/Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [filteredDatasets, setFilteredDatasets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Sample dataset categories
  const categories = [
    { id: 'all', name: 'All Datasets', icon: <Database size={18} />, count: 0 },
    { id: 'education', name: 'Education', icon: <BookOpen size={18} />, count: 0 },
    { id: 'analytics', name: 'Analytics', icon: <BarChart3 size={18} />, count: 0 },
    { id: 'trending', name: 'Trending', icon: <TrendingUp size={18} />, count: 0 },
    { id: 'popular', name: 'Most Viewed', icon: <Eye size={18} />, count: 0 },
    { id: 'recent', name: 'Recently Added', icon: <Clock size={18} />, count: 0 },
  ];

  // Sample datasets data
  const sampleDatasets = [
    {
      id: 1,
      title: "DLSU Course Evaluation Dataset 2024",
      description: "Comprehensive course evaluation data from DLSU students including professor ratings, workload scores, and overall satisfaction metrics across 45+ courses.",
      category: "education",
      views: 1247,
      likes: 342,
      downloads: 567,
      reviews: 89,
      tags: ["courses", "professors", "ratings"],
      author: "DLSU Education Research",
      dateAdded: "2024-01-15",
      lastUpdated: "2024-03-20",
      size: "2.3 MB",
      format: "CSV, JSON",
      columns: ["course_code", "professor_name", "difficulty_rating", "workload_hours", "recommendation_score"],
      preview: true
    },
    {
      id: 2,
      title: "Student Performance Analytics",
      description: "Analysis of student performance metrics across different departments, including GPA distributions, study habits, and correlation with extracurricular activities.",
      category: "analytics",
      views: 892,
      likes: 267,
      downloads: 445,
      reviews: 56,
      tags: ["performance", "GPA", "analytics"],
      author: "DLSU Data Science Club",
      dateAdded: "2024-02-01",
      lastUpdated: "2024-03-15",
      size: "1.8 MB",
      format: "CSV, Excel",
      columns: ["student_id", "department", "gpa", "study_hours", "extracurricular_hours"],
      preview: true
    },
    {
      id: 3,
      title: "Enrollment Trends by Department",
      description: "Historical enrollment data showing trends in student enrollment across various departments and programs over the last 5 years.",
      category: "trending",
      views: 1563,
      likes: 489,
      downloads: 734,
      reviews: 112,
      tags: ["enrollment", "departments", "trends"],
      author: "DLSU Office of Admissions",
      dateAdded: "2024-01-10",
      lastUpdated: "2024-03-18",
      size: "3.1 MB",
      format: "CSV, JSON",
      columns: ["year", "semester", "department", "enrollment_count", "acceptance_rate"],
      preview: true
    },
    {
      id: 4,
      title: "Professor Rating Analysis",
      description: "In-depth analysis of professor ratings across different criteria including teaching effectiveness, accessibility, grading fairness, and course difficulty.",
      category: "popular",
      views: 2156,
      likes: 734,
      downloads: 892,
      reviews: 156,
      tags: ["professors", "ratings", "teaching"],
      author: "Datanaut Community",
      dateAdded: "2024-02-15",
      lastUpdated: "2024-03-22",
      size: "4.2 MB",
      format: "CSV",
      columns: ["professor_id", "department", "teaching_score", "accessibility_score", "fairness_score", "difficulty_score"],
      preview: true
    },
    {
      id: 5,
      title: "Career Outcomes Survey 2023",
      description: "Survey results from recent graduates covering employment rates, starting salaries, industry placement, and job satisfaction by major.",
      category: "analytics",
      views: 978,
      likes: 301,
      downloads: 512,
      reviews: 67,
      tags: ["career", "employment", "salary"],
      author: "DLSU Career Services",
      dateAdded: "2024-02-20",
      lastUpdated: "2024-03-10",
      size: "1.5 MB",
      format: "CSV, Excel",
      columns: ["major", "employment_status", "starting_salary", "company_name", "job_satisfaction"],
      preview: true
    },
    {
      id: 6,
      title: "Course Difficulty Rankings",
      description: "Community-voted difficulty rankings for all major courses, including workload breakdowns and time commitment analysis.",
      category: "trending",
      views: 1845,
      likes: 567,
      downloads: 623,
      reviews: 134,
      tags: ["difficulty", "workload", "courses"],
      author: "Student Government",
      dateAdded: "2024-02-25",
      lastUpdated: "2024-03-23",
      size: "2.1 MB",
      format: "CSV, JSON",
      columns: ["course_code", "difficulty_rating", "avg_study_hours", "fail_rate", "recommendation"],
      preview: true
    },
    {
      id: 7,
      title: "Library Usage Statistics",
      description: "Analysis of library resource usage including peak hours, most borrowed materials, and study space occupancy patterns.",
      category: "education",
      views: 654,
      likes: 198,
      downloads: 312,
      reviews: 34,
      tags: ["library", "resources", "usage"],
      author: "DLSU Libraries",
      dateAdded: "2024-03-01",
      lastUpdated: "2024-03-20",
      size: "1.2 MB",
      format: "CSV",
      columns: ["date", "hour", "visitor_count", "books_borrowed", "study_rooms_booked"],
      preview: true
    },
    {
      id: 8,
      title: "Research Publication Metrics",
      description: "Track research output and citations across DLSU departments, including collaboration networks and publication impact factors.",
      category: "popular",
      views: 1123,
      likes: 378,
      downloads: 456,
      reviews: 78,
      tags: ["research", "publications", "citations"],
      author: "DLSU Research Office",
      dateAdded: "2024-02-10",
      lastUpdated: "2024-03-19",
      size: "3.8 MB",
      format: "CSV, JSON",
      columns: ["department", "publications_count", "citations", "avg_impact_factor", "collaborations"],
      preview: true
    }
  ];

  useEffect(() => {
    checkUserSession();
    loadDatasets();
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
        console.log('User session found:', userData);
      } else {
        // Redirect to home if not authenticated
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      navigate('/');
    }
  };

  const loadDatasets = () => {
    // Simulate API call
    setTimeout(() => {
      setDatasets(sampleDatasets);
      setFilteredDatasets(sampleDatasets);
      setIsLoading(false);
    }, 1000);
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

  const handleSearch = (term) => {
    setSearchTerm(term);
    filterDatasets(term, selectedCategory);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    filterDatasets(searchTerm, category);
  };

  const filterDatasets = (term, category) => {
    let filtered = [...datasets];
    
    if (term) {
      filtered = filtered.filter(dataset =>
        dataset.title.toLowerCase().includes(term.toLowerCase()) ||
        dataset.description.toLowerCase().includes(term.toLowerCase()) ||
        dataset.tags.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
      );
    }
    
    if (category !== 'all') {
      filtered = filtered.filter(dataset => dataset.category === category);
    }
    
    setFilteredDatasets(filtered);
  };

  const handleViewDataset = (dataset) => {
    setSelectedDataset(dataset);
    setShowModal(true);
    // Increment view count (would be an API call in production)
  };

  const handleDownloadDataset = (dataset) => {
    alert(`Downloading ${dataset.title}...`);
    // Implement actual download logic
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
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
            <span>Datanaut</span>
          </div>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="sidebar-nav">
          <div className="nav-section">
            <h3>Main</h3>
            <button className="nav-item active">
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
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          
          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={20} />
            </button>
            <button className="create-btn">
              <Plus size={18} />
              <span>New Dataset</span>
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
        
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="banner-content">
            <h1>
              Welcome back, {user?.name?.split(' ')[0] || 'Student'}! 
              <Sparkles size={24} className="sparkle-icon" />
            </h1>
            <p>Discover and analyze datasets from the DLSU community. Find insights for your research and projects.</p>
          </div>
          <div className="banner-stats">
            <div className="stat">
              <Database size={20} />
              <div>
                <span className="stat-value">{datasets.length}</span>
                <span className="stat-label">Datasets</span>
              </div>
            </div>
            <div className="stat">
              <Users size={20} />
              <div>
                <span className="stat-value">2.5k+</span>
                <span className="stat-label">Contributors</span>
              </div>
            </div>
            <div className="stat">
              <Flame size={20} />
              <div>
                <span className="stat-value">1.2k+</span>
                <span className="stat-label">Downloads</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters Bar */}
        <div className="filters-bar">
          <div className="categories-scroll">
            {categories.map(category => (
              <button
                key={category.id}
                className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => handleCategoryFilter(category.id)}
              >
                {category.icon}
                <span>{category.name}</span>
              </button>
            ))}
          </div>
          
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={18} />
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        
        {/* Datasets Grid/List */}
        <div className={`datasets-container ${viewMode}`}>
          {filteredDatasets.length === 0 ? (
            <div className="no-results">
              <Database size={48} />
              <h3>No datasets found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredDatasets.map(dataset => (
              <div key={dataset.id} className="dataset-card">
                <div className="dataset-header">
                  <div className="dataset-icon">
                    <Database size={24} />
                  </div>
                  <div className="dataset-title-section">
                    <h3 onClick={() => handleViewDataset(dataset)}>
                      {dataset.title}
                    </h3>
                    <div className="dataset-meta">
                      <span className="meta-item">
                        <Calendar size={14} />
                        {dataset.dateAdded}
                      </span>
                      <span className="meta-item">
                        <Clock size={14} />
                        Updated {dataset.lastUpdated}
                      </span>
                      <span className="meta-item">
                        <FileText size={14} />
                        {dataset.size}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="dataset-description">{dataset.description}</p>
                
                <div className="dataset-tags">
                  {dataset.tags.map(tag => (
                    <span key={tag} className="tag">#{tag}</span>
                  ))}
                </div>
                
                <div className="dataset-stats">
                  <div className="stat-group">
                    <Eye size={16} />
                    <span>{dataset.views.toLocaleString()}</span>
                  </div>
                  <div className="stat-group">
                    <ThumbsUp size={16} />
                    <span>{dataset.likes.toLocaleString()}</span>
                  </div>
                  <div className="stat-group">
                    <Download size={16} />
                    <span>{dataset.downloads.toLocaleString()}</span>
                  </div>
                  <div className="stat-group">
                    <MessageSquare size={16} />
                    <span>{dataset.reviews}</span>
                  </div>
                </div>
                
                <div className="dataset-footer">
                  <div className="dataset-author">
                    <User size={14} />
                    <span>{dataset.author}</span>
                  </div>
                  <div className="dataset-actions">
                    <button 
                      className="action-btn preview"
                      onClick={() => handleViewDataset(dataset)}
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button 
                      className="action-btn download"
                      onClick={() => handleDownloadDataset(dataset)}
                    >
                      <Download size={16} />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      
      {/* Dataset Preview Modal */}
      {showModal && selectedDataset && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedDataset.title}</h2>
              <button className="close-modal" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="dataset-info">
                <div className="info-section">
                  <h3>Description</h3>
                  <p>{selectedDataset.description}</p>
                </div>
                
                <div className="info-section">
                  <h3>Dataset Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>Format:</strong> {selectedDataset.format}
                    </div>
                    <div className="info-item">
                      <strong>Size:</strong> {selectedDataset.size}
                    </div>
                    <div className="info-item">
                      <strong>Last Updated:</strong> {selectedDataset.lastUpdated}
                    </div>
                    <div className="info-item">
                      <strong>Author:</strong> {selectedDataset.author}
                    </div>
                  </div>
                </div>
                
                <div className="info-section">
                  <h3>Columns</h3>
                  <div className="columns-list">
                    {selectedDataset.columns.map((col, index) => (
                      <span key={index} className="column-tag">{col}</span>
                    ))}
                  </div>
                </div>
                
                {selectedDataset.preview && (
                  <div className="info-section">
                    <h3>Data Preview</h3>
                    <div className="preview-table">
                      <table>
                        <thead>
                          <tr>
                            {selectedDataset.columns.slice(0, 4).map((col, index) => (
                              <th key={index}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3].map((row) => (
                            <tr key={row}>
                              {selectedDataset.columns.slice(0, 4).map((_, index) => (
                                <td key={index}>Sample data {row}.{index + 1}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Close
              </button>
              <button 
                className="btn-primary"
                onClick={() => handleDownloadDataset(selectedDataset)}
              >
                <Download size={16} />
                Download Dataset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;