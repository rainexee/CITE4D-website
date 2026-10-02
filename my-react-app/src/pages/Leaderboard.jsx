// Leaderboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Medal, Award, Users, TrendingUp, Calendar, Star, 
  Sparkles, Crown, Target, Activity, ChevronDown, LogOut,
  Settings, Bell, Menu, X, User, Database, Filter, FolderOpen,
  Clock, CheckCircle, Flame
} from 'lucide-react';
import '../styles/Leaderboard.css';

function Leaderboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [timeFrame, setTimeFrame] = useState('all-time');
  const [filterType, setFilterType] = useState('annotations');

  useEffect(() => {
    checkUserSession();
    loadLeaderboard();
  }, []);

  const checkUserSession = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      navigate('/');
    }
  };

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/leaderboard', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setUser(null);
        navigate('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getRankIcon = (index) => {
    switch(index) {
      case 0:
        return <Crown size={24} className="rank-icon gold" />;
      case 1:
        return <Medal size={24} className="rank-icon silver" />;
      case 2:
        return <Medal size={24} className="rank-icon bronze" />;
      default:
        return <span className="rank-number">{index + 1}</span>;
    }
  };

  const getRankClass = (index) => {
    switch(index) {
      case 0: return 'rank-1';
      case 1: return 'rank-2';
      case 2: return 'rank-3';
      default: return '';
    }
  };

  const getAchievementLevel = (count) => {
    if (count >= 100) return { label: 'Legendary', icon: <Flame size={16} />, color: '#ff6b35' };
    if (count >= 50) return { label: 'Master', icon: <Award size={16} />, color: '#9b59b6' };
    if (count >= 25) return { label: 'Expert', icon: <Star size={16} />, color: '#3498db' };
    if (count >= 10) return { label: 'Rising Star', icon: <Sparkles size={16} />, color: '#2ecc71' };
    if (count >= 5) return { label: 'Contributor', icon: <CheckCircle size={16} />, color: '#e67e22' };
    return { label: 'Beginner', icon: <Target size={16} />, color: '#95a5a6' };
  };

  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  if (isLoading) {
    return (
      <div className="leaderboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      {/* Sidebar */}
      <aside className={`leaderboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo" onClick={() => navigate('/dashboard')}>
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
            <button className="nav-item active">
              <Trophy size={20} />
              <span>Leaderboard</span>
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
      <main className="leaderboard-main">
        {/* Header */}
        <header className="leaderboard-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          
          <div className="header-title">
            <Trophy size={24} className="header-icon" />
            <h1>Leaderboard</h1>
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
        
        {/* Welcome Banner */}
        <div className="leaderboard-banner">
          <div className="banner-content">
            <h1>
              Community Contributors 
              <Sparkles size={24} className="sparkle-icon" />
            </h1>
            <p>Celebrating our top contributors who help improve data quality through annotations</p>
          </div>
          <div className="banner-stats">
            <div className="stat">
              <Users size={20} />
              <div>
                <span className="stat-value">{leaderboard.length}</span>
                <span className="stat-label">Contributors</span>
              </div>
            </div>
            <div className="stat">
              <CheckCircle size={20} />
              <div>
                <span className="stat-value">
                  {leaderboard.reduce((sum, entry) => sum + entry.annotation_count, 0)}
                </span>
                <span className="stat-label">Total Annotations</span>
              </div>
            </div>
            <div className="stat">
              <Flame size={20} />
              <div>
                <span className="stat-value">
                  {leaderboard.length > 0 ? Math.max(...leaderboard.map(e => e.annotation_count)) : 0}
                </span>
                <span className="stat-label">Top Score</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filter Bar */}
        <div className="filters-bar">
          <div className="filter-group">
            <button 
              className={`filter-btn ${filterType === 'annotations' ? 'active' : ''}`}
              onClick={() => setFilterType('annotations')}
            >
              <CheckCircle size={16} />
              By Annotations
            </button>
          </div>
          <div className="view-controls">
            <span className="filter-label">Time Frame:</span>
            <select 
              value={timeFrame} 
              onChange={(e) => setTimeFrame(e.target.value)}
              className="timeframe-select"
            >
              <option value="all-time">All Time</option>
              <option value="this-month">This Month</option>
              <option value="this-week">This Week</option>
            </select>
          </div>
        </div>
        
        {/* Top 3 Podium */}
        {topThree.length > 0 && (
          <div className="podium-section">
            <div className="podium">
              {/* 2nd Place */}
              {topThree[1] && (
                <div className="podium-place second">
                  <div className="podium-rank">
                    <Medal size={32} className="rank-icon silver" />
                    <span className="rank-name">2nd</span>
                  </div>
                  <div className="podium-avatar">
                    {topThree[1].picture ? (
                      <img src={topThree[1].picture} alt={topThree[1].name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {topThree[1].name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <h3 className="podium-name">{topThree[1].name?.split(' ')[0] || topThree[1].name}</h3>
                  <p className="podium-stats">
                    <strong>{topThree[1].annotation_count}</strong> annotations
                  </p>
                  <div className="podium-base second-base"></div>
                </div>
              )}
              
              {/* 1st Place */}
              {topThree[0] && (
                <div className="podium-place first">
                  <div className="podium-rank">
                    <Crown size={36} className="rank-icon gold" />
                    <span className="rank-name">1st</span>
                  </div>
                  <div className="podium-avatar champion">
                    {topThree[0].picture ? (
                      <img src={topThree[0].picture} alt={topThree[0].name} />
                    ) : (
                      <div className="avatar-placeholder champion-avatar">
                        {topThree[0].name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <h3 className="podium-name">{topThree[0].name?.split(' ')[0] || topThree[0].name}</h3>
                  <p className="podium-stats">
                    <strong>{topThree[0].annotation_count}</strong> annotations
                  </p>
                  <div className="podium-base first-base"></div>
                </div>
              )}
              
              {/* 3rd Place */}
              {topThree[2] && (
                <div className="podium-place third">
                  <div className="podium-rank">
                    <Medal size={32} className="rank-icon bronze" />
                    <span className="rank-name">3rd</span>
                  </div>
                  <div className="podium-avatar">
                    {topThree[2].picture ? (
                      <img src={topThree[2].picture} alt={topThree[2].name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {topThree[2].name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <h3 className="podium-name">{topThree[2].name?.split(' ')[0] || topThree[2].name}</h3>
                  <p className="podium-stats">
                    <strong>{topThree[2].annotation_count}</strong> annotations
                  </p>
                  <div className="podium-base third-base"></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Leaderboard Table */}
        <div className="leaderboard-table-container">
          <div className="table-header">
            <h3>All Contributors</h3>
            <div className="table-stats">
              <span>{leaderboard.length} active contributors</span>
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="col-rank">Rank</th>
                  <th className="col-user">Contributor</th>
                  <th className="col-stats">Achievement</th>
                  <th className="col-count">Annotations</th>
                  <th className="col-badge">Badge</th>
                </tr>
              </thead>
              <tbody>
                {restOfLeaderboard.map((entry, idx) => {
                  const achievement = getAchievementLevel(entry.annotation_count);
                  const isCurrentUser = user?.name === entry.name;
                  return (
                    <tr key={entry.student_id} className={`leaderboard-row ${isCurrentUser ? 'current-user' : ''} ${getRankClass(idx + 3)}`}>
                      <td className="col-rank">
                        <div className="rank-cell">
                          <span className="rank-number">{idx + 4}</span>
                        </div>
                      </td>
                      <td className="col-user">
                        <div className="user-cell">
                          <div className="user-avatar-small">
                            {entry.picture ? (
                              <img src={entry.picture} alt={entry.name} />
                            ) : (
                              <div className="avatar-initials">
                                {entry.name?.charAt(0) || 'U'}
                              </div>
                            )}
                          </div>
                          <div className="user-info">
                            <span className="user-fullname">{entry.name}</span>
                            {isCurrentUser && <span className="you-badge">You</span>}
                          </div>
                        </div>
                      </td>
                      <td className="col-stats">
                        <div className="achievement-badge" style={{ backgroundColor: achievement.color + '20', color: achievement.color }}>
                          {achievement.icon}
                          <span>{achievement.label}</span>
                        </div>
                      </td>
                      <td className="col-count">
                        <div className="count-cell">
                          <span className="count-value">{entry.annotation_count}</span>
                          <div className="count-bar-container">
                            <div 
                              className="count-bar" 
                              style={{ 
                                width: `${Math.min(100, (entry.annotation_count / (leaderboard[0]?.annotation_count || 1)) * 100)}%`,
                                backgroundColor: achievement.color
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="col-badge">
                        {entry.annotation_count >= 100 ? (
                          <div className="badge legendary" title="Legendary Contributor">
                            <Flame size={20} />
                          </div>
                        ) : entry.annotation_count >= 50 ? (
                          <div className="badge master" title="Master Contributor">
                            <Award size={20} />
                          </div>
                        ) : entry.annotation_count >= 25 ? (
                          <div className="badge expert" title="Expert Contributor">
                            <Star size={20} />
                          </div>
                        ) : entry.annotation_count >= 10 ? (
                          <div className="badge rising" title="Rising Star">
                            <Sparkles size={20} />
                          </div>
                        ) : entry.annotation_count >= 5 ? (
                          <div className="badge contributor" title="Contributor">
                            <CheckCircle size={20} />
                          </div>
                        ) : (
                          <div className="badge beginner" title="Beginner">
                            <Target size={20} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {restOfLeaderboard.length === 0 && topThree.length <= 3 && (
            <div className="no-results">
              <Trophy size={48} />
              <h3>No contributors yet</h3>
              <p>Be the first to make an annotation!</p>
            </div>
          )}
        </div>
        
        {/* Call to Action for current user if not in top */}
        {user && leaderboard.findIndex(entry => entry.name === user.name) === -1 && (
          <div className="cta-section">
            <div className="cta-content">
              <Target size={24} />
              <div>
                <h4>You haven't made any annotations yet!</h4>
                <p>Start contributing to datasets and climb the leaderboard</p>
              </div>
              <button className="cta-btn" onClick={() => navigate('/dashboard')}>
                Browse Datasets
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Leaderboard;