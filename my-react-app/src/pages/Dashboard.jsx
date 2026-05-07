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
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Sample dataset categories
  const categories = [
    { id: 'all', name: 'All Datasets', icon: <Database size={18} />, count: 0 },
    { id: 'education', name: 'Education', icon: <BookOpen size={18} />, count: 0 },
    { id: 'analytics', name: 'Analytics', icon: <BarChart3 size={18} />, count: 0 },
    { id: 'trending', name: 'Trending', icon: <TrendingUp size={18} />, count: 0 },
    { id: 'popular', name: 'Most Viewed', icon: <Eye size={18} />, count: 0 },
    { id: 'recent', name: 'Recently Added', icon: <Clock size={18} />, count: 0 },
  ];

  // Sample datasets data with real sample rows
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
      sampleRows: [
        { course_code: "CCPROG1", professor_name: "Dr. Maria Santos", difficulty_rating: 3.2, workload_hours: 8.5, recommendation_score: 4.5 },
        { course_code: "CCPROG2", professor_name: "Dr. Juan Reyes", difficulty_rating: 3.8, workload_hours: 10.0, recommendation_score: 4.2 },
        { course_code: "CSINTSY", professor_name: "Prof. Anna Cruz", difficulty_rating: 4.2, workload_hours: 12.5, recommendation_score: 3.8 },
        { course_code: "CSMATH", professor_name: "Dr. Carlos Lopez", difficulty_rating: 3.5, workload_hours: 9.0, recommendation_score: 4.3 },
        { course_code: "CSELECT", professor_name: "Prof. Bea Rivera", difficulty_rating: 2.8, workload_hours: 7.0, recommendation_score: 4.7 }
      ],
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
      sampleRows: [
        { student_id: "12123456", department: "Computer Science", gpa: 3.75, study_hours: 25, extracurricular_hours: 8 },
        { student_id: "12123457", department: "Business", gpa: 3.45, study_hours: 20, extracurricular_hours: 12 },
        { student_id: "12123458", department: "Engineering", gpa: 3.60, study_hours: 28, extracurricular_hours: 5 },
        { student_id: "12123459", department: "Psychology", gpa: 3.85, study_hours: 22, extracurricular_hours: 10 },
        { student_id: "12123460", department: "Communications", gpa: 3.30, study_hours: 18, extracurricular_hours: 15 }
      ],
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
      sampleRows: [
        { year: 2023, semester: "1st Sem", department: "Computer Science", enrollment_count: 450, acceptance_rate: 0.68 },
        { year: 2023, semester: "2nd Sem", department: "Computer Science", enrollment_count: 420, acceptance_rate: 0.65 },
        { year: 2024, semester: "1st Sem", department: "Computer Science", enrollment_count: 480, acceptance_rate: 0.70 },
        { year: 2023, semester: "1st Sem", department: "Business", enrollment_count: 520, acceptance_rate: 0.72 },
        { year: 2023, semester: "2nd Sem", department: "Engineering", enrollment_count: 380, acceptance_rate: 0.60 }
      ],
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
      author: "The Data Collective Community",
      dateAdded: "2024-02-15",
      lastUpdated: "2024-03-22",
      size: "4.2 MB",
      format: "CSV",
      columns: ["professor_id", "department", "teaching_score", "accessibility_score", "fairness_score", "difficulty_score"],
      sampleRows: [
        { professor_id: "PROF001", department: "Computer Science", teaching_score: 4.5, accessibility_score: 4.2, fairness_score: 4.3, difficulty_score: 3.8 },
        { professor_id: "PROF002", department: "Mathematics", teaching_score: 4.2, accessibility_score: 3.9, fairness_score: 4.0, difficulty_score: 4.2 },
        { professor_id: "PROF003", department: "English", teaching_score: 4.8, accessibility_score: 4.6, fairness_score: 4.7, difficulty_score: 3.2 },
        { professor_id: "PROF004", department: "Physics", teaching_score: 3.9, accessibility_score: 3.7, fairness_score: 4.1, difficulty_score: 4.5 },
        { professor_id: "PROF005", department: "History", teaching_score: 4.3, accessibility_score: 4.4, fairness_score: 4.2, difficulty_score: 3.5 }
      ],
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
      sampleRows: [
        { major: "Computer Science", employment_status: "Employed", starting_salary: 45000, company_name: "Google", job_satisfaction: 4.5 },
        { major: "Business", employment_status: "Employed", starting_salary: 40000, company_name: "Deloitte", job_satisfaction: 4.2 },
        { major: "Engineering", employment_status: "Employed", starting_salary: 42000, company_name: "Lockheed Martin", job_satisfaction: 4.3 },
        { major: "Psychology", employment_status: "Graduate School", starting_salary: 0, company_name: "N/A", job_satisfaction: 4.0 },
        { major: "Communications", employment_status: "Employed", starting_salary: 38000, company_name: "ABS-CBN", job_satisfaction: 4.1 }
      ],
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
      sampleRows: [
        { course_code: "CSINTSY", difficulty_rating: 4.5, avg_study_hours: 15, fail_rate: 0.25, recommendation: 3.2 },
        { course_code: "MATH101", difficulty_rating: 3.8, avg_study_hours: 10, fail_rate: 0.15, recommendation: 4.0 },
        { course_code: "PHYS101", difficulty_rating: 4.2, avg_study_hours: 12, fail_rate: 0.20, recommendation: 3.5 },
        { course_code: "ENGL102", difficulty_rating: 2.5, avg_study_hours: 6, fail_rate: 0.05, recommendation: 4.5 },
        { course_code: "CHEM101", difficulty_rating: 4.0, avg_study_hours: 11, fail_rate: 0.18, recommendation: 3.8 }
      ],
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
      sampleRows: [
        { date: "2024-03-01", hour: 9, visitor_count: 45, books_borrowed: 32, study_rooms_booked: 8 },
        { date: "2024-03-01", hour: 14, visitor_count: 120, books_borrowed: 85, study_rooms_booked: 15 },
        { date: "2024-03-02", hour: 10, visitor_count: 78, books_borrowed: 54, study_rooms_booked: 10 },
        { date: "2024-03-02", hour: 15, visitor_count: 95, books_borrowed: 67, study_rooms_booked: 12 },
        { date: "2024-03-03", hour: 11, visitor_count: 88, books_borrowed: 61, study_rooms_booked: 11 }
      ],
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
      sampleRows: [
        { department: "Computer Science", publications_count: 45, citations: 1250, avg_impact_factor: 2.8, collaborations: 32 },
        { department: "Physics", publications_count: 38, citations: 980, avg_impact_factor: 3.1, collaborations: 28 },
        { department: "Chemistry", publications_count: 42, citations: 1100, avg_impact_factor: 3.0, collaborations: 30 },
        { department: "Biology", publications_count: 52, citations: 1450, avg_impact_factor: 3.4, collaborations: 35 },
        { department: "Mathematics", publications_count: 35, citations: 820, avg_impact_factor: 2.5, collaborations: 25 }
      ],
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

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
        const response = await fetch('/api/datasets?limit=20', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.datasets) {
                // Transform API data to match component expectations
                const transformedDatasets = data.datasets.map(dataset => ({
                    id: dataset.dataset_id,
                    title: dataset.title,
                    description: dataset.description,
                    category: dataset.category,
                    views: dataset.views || 0,
                    likes: dataset.likes || 0,
                    downloads: dataset.downloads || 0,
                    reviews: dataset.reviews || 0,
                    tags: dataset.tags || [],
                    author: dataset.author || dataset.uploader_name,
                    dateAdded: dataset.created_at ? dataset.created_at.split('T')[0] : '',
                    lastUpdated: dataset.updated_at ? dataset.updated_at.split('T')[0] : '',
                    size: dataset.size || 'N/A',
                    format: dataset.format || 'CSV',
                    columns: dataset.columns || [],
                    sampleRows: dataset.sampleRows || [],
                    preview: true
                }));
                setDatasets(transformedDatasets);
                setFilteredDatasets(transformedDatasets);
            } else {
                // Fallback to sample data if no datasets
                setDatasets(sampleDatasets);
                setFilteredDatasets(sampleDatasets);
            }
        } else {
            // Fallback to sample data if API fails
            console.log('Using sample data');
            setDatasets(sampleDatasets);
            setFilteredDatasets(sampleDatasets);
        }
    } catch (error) {
        console.error('Error loading datasets:', error);
        // Fallback to sample data
        setDatasets(sampleDatasets);
        setFilteredDatasets(sampleDatasets);
    } finally {
        setIsLoading(false);
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

  const handleViewDataset = async (dataset) => {
    setSelectedDataset(dataset);
    setShowModal(true);
    setPreviewData(null);
    setIsLoadingPreview(true);
    
    // Try to fetch real preview data from API
    try {
      const response = await fetch(`/api/datasets/${dataset.id}/preview`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.preview) {
          setPreviewData(data.preview);
        } else if (dataset.sampleRows) {
          // Use sample rows if available
          setPreviewData({
            columns: dataset.columns,
            rows: dataset.sampleRows
          });
        }
      } else if (dataset.sampleRows) {
        // Use sample rows from the dataset
        setPreviewData({
          columns: dataset.columns,
          rows: dataset.sampleRows
        });
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      if (dataset.sampleRows) {
        setPreviewData({
          columns: dataset.columns,
          rows: dataset.sampleRows
        });
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadDataset = async (dataset) => {
    try {
        const response = await fetch(`/api/datasets/${dataset.id}/download`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            // Create a blob from the response
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Set filename
            const filename = `${dataset.title}.${dataset.format.toLowerCase()}`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to download dataset. Please try again.');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading dataset. Please try again.');
    }
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
            <span>The Data Collective</span>
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

            {user?.role === "admin" && (
              <button 
                className="create-btn"
                onClick={() => navigate('/new-dataset')}
              >
                <Plus size={18} />
                <span>New Dataset</span>
              </button>

              )
            }
            
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
                  <h3>Columns ({selectedDataset.columns.length})</h3>
                  <div className="columns-list">
                    {selectedDataset.columns.map((col, index) => (
                      <span key={index} className="column-tag">{col}</span>
                    ))}
                  </div>
                </div>
                
                {selectedDataset.preview && (
                  <div className="info-section">
                    <h3>Data Preview (First 5 rows)</h3>
                    {isLoadingPreview ? (
                      <div className="preview-loading">
                        <div className="loading-spinner-small"></div>
                        <p>Loading preview data...</p>
                      </div>
                    ) : previewData && previewData.rows && previewData.rows.length > 0 ? (
                      <div className="preview-table-container">
                        <div className="preview-scroll">
                          <table className="preview-table">
                            <thead>
                              <tr>
                                <th className="preview-row-number">#</th>
                                {selectedDataset.columns.map((col, index) => (
                                  <th key={index}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.rows.slice(0, 5).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  <td className="preview-row-number">{rowIndex + 1}</td>
                                  {selectedDataset.columns.map((col, colIndex) => (
                                    <td key={colIndex}>
                                      {row[col] !== undefined && row[col] !== null
                                        ? typeof row[col] === 'number'
                                          ? row[col].toLocaleString()
                                          : String(row[col])
                                        : '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {previewData.rows.length > 5 && (
                          <div className="preview-note">
                            Showing 5 of {previewData.rows.length} rows
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="preview-error">
                        <p>No preview data available for this dataset.</p>
                      </div>
                    )}
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