import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Star, 
  MessageSquare, 
  EyeOff, 
  ThumbsUp, 
  Filter, 
  ChevronRight, 
  TrendingUp,
  Users,
  ArrowRight,
  Mail,
  MapPin,
  Award,
  BookOpen,
  Search,
  BarChart3,
  User,
  LogOut,
  Settings
} from 'lucide-react';
import '../styles/LandingPage.css';

function LandingPage({ loginWithGoogle }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check for existing session on component mount
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
            navigate('/dashboard')
        }
    } catch (error) {
        console.error('Error checking session:', error);
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
        setShowDropdown(false);
        alert('Logged out successfully!');
        navigate('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Wrapper function to handle loading state
  const handleGoogleLogin = () => {
    setIsLoading(true);
    loginWithGoogle();
    
    // Check for user after login attempt
    setTimeout(() => {
      checkUserSession();
      setIsLoading(false);
    }, 2000);
  };

  const features = [
    {
      icon: <MessageSquare size={28} />,
      title: "Post Reviews",
      description: "Share your experiences with professors and courses using our modern, rich-text editor."
    },
    {
      icon: <EyeOff size={28} />,
      title: "100% Anonymous",
      description: "Your privacy matters. Post reviews anonymously to ensure honest, unfiltered feedback."
    },
    {
      icon: <ThumbsUp size={28} />,
      title: "Community Voting",
      description: "Upvote helpful reviews and downvote misleading ones. Best content rises to the top."
    },
    {
      icon: <Filter size={28} />,
      title: "Smart Filters",
      description: "Filter by department, course, professor, rating, and semester to find exactly what you need."
    },
    {
      icon: <BarChart3 size={28} />,
      title: "Data Analytics",
      description: "Visualize trends, grade distributions, and workload patterns across different courses."
    },
    {
      icon: <Award size={28} />,
      title: "Verified Students",
      description: "Only @dlsu.edu.ph email addresses can post, ensuring authentic DLSU community reviews."
    }
  ];

  const stats = [
    { icon: <Users size={24} />, value: "2,500+", label: "Active Students" },
    { icon: <MessageSquare size={24} />, value: "1,200+", label: "Reviews Posted" },
    { icon: <BookOpen size={24} />, value: "45+", label: "Courses Covered" },
    { icon: <TrendingUp size={24} />, value: "95%", label: "Satisfaction Rate" }
  ];

  const testimonials = [
    {
      name: "Maria Santos",
      course: "Computer Science",
      review: "Datanaut helped me choose the right professors for my major subjects. The reviews are honest and incredibly helpful!",
      rating: 5,
      avatar: "https://ui-avatars.com/api/?name=Maria+Santos&background=667eea&color=fff"
    },
    {
      name: "Juan Dela Cruz",
      course: "Business Management",
      review: "Finally, a platform exclusively for DLSU students! The anonymous feature makes it safe to share honest feedback.",
      rating: 5,
      avatar: "https://ui-avatars.com/api/?name=Juan+Cruz&background=764ba2&color=fff"
    },
    {
      name: "Sofia Reyes",
      course: "Psychology",
      review: "The voting system ensures that the most useful reviews are always visible. Saved me from a difficult professor!",
      rating: 5,
      avatar: "https://ui-avatars.com/api/?name=Sofia+Reyes&background=f59e0b&color=fff"
    }
  ];

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Database size={28} />
            <span>Datanaut</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#stats">Stats</a>
            <a href="#testimonials">Reviews</a>
            <a href="#about">About</a>
          </div>
          
          {/* Conditional rendering based on user session */}
          {user ? (
            <div className="user-menu">
              <div 
                className="user-info"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div className="user-avatar">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">{user.name || user.email}</span>
                  <span className="user-email">{user.email}</span>
                </div>
              </div>
              
              {showDropdown && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <hr />
                  <button onClick={() => navigate('/dashboard')} className="dropdown-item">
                    <Database size={16} />
                    Dashboard
                  </button>
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
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              className="nav-cta" 
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In with DLSU Email'}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section - Show different content when logged in */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
        
        <div className="hero-container">
          <div className="hero-badge">
            <Star size={16} fill="#fbbf24" color="#fbbf24" />
            <span>Exclusive for DLSU Students</span>
          </div>
          
          {user ? (
            <>
              <h1 className="hero-title">
                Welcome Back,
                <span className="gradient-text"> {user.name?.split(' ')[0] || 'Student'}!</span>
              </h1>
              <p className="hero-subtitle">
                Ready to discover more about your courses? Check out the latest reviews 
                or share your own experiences with the DLSU community.
              </p>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                  <ChevronRight size={20} />
                </button>
                <button className="btn-secondary" onClick={() => navigate('/reviews')}>
                  Browse Reviews
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="hero-title">
                Discover the Truth About
                <span className="gradient-text"> Your Courses</span>
              </h1>
              <p className="hero-subtitle">
                Datanaut is the unofficial platform where DLSU students share honest reviews about 
                professors, courses, and class experiences. Make informed decisions for your enlistment.
              </p>
              <div className="hero-buttons">
                <button 
                  className="btn-primary" 
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Get Started Free'}
                  <ChevronRight size={20} />
                </button>
                <button className="btn-secondary" onClick={() => {
                  document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
                }}>
                  Learn More
                </button>
              </div>
            </>
          )}
          
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-value">2.5k+</span>
              <span className="stat-label">Active Students</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">1.2k+</span>
              <span className="stat-label">Reviews</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">45+</span>
              <span className="stat-label">Courses</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rest of your sections remain the same */}
      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Everything You Need to Know</h2>
            <p>
              From detailed professor reviews to an active voting system, 
              Datanaut provides all the insights for your academic journey.
            </p>
          </div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div className="feature-card" key={index}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div className="stat-card" key={index}>
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-number">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="howitworks-section">
        <div className="container">
          <div className="section-header">
            <h2>How Datanaut Works</h2>
            <p>Simple steps to start making informed decisions</p>
          </div>
          
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-icon"><Mail size={32} /></div>
              <h3>Sign in with DLSU Email</h3>
              <p>Use your @dlsu.edu.ph email to verify you're part of the community</p>
            </div>
            
            <div className="step-arrow">
              <ChevronRight size={32} />
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-icon"><Search size={32} /></div>
              <h3>Search & Discover</h3>
              <p>Find professors, courses, and read authentic student experiences</p>
            </div>
            
            <div className="step-arrow">
              <ChevronRight size={32} />
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-icon"><ThumbsUp size={32} /></div>
              <h3>Share & Vote</h3>
              <p>Share your experiences and help fellow Animo students</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="testimonials-section">
        <div className="container">
          <div className="section-header">
            <h2>What Students Say</h2>
            <p>Join thousands of DLSU students who trust Datanaut</p>
          </div>
          
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div className="testimonial-card" key={index}>
                <div className="testimonial-header">
                  <img src={testimonial.avatar} alt={testimonial.name} />
                  <div>
                    <h4>{testimonial.name}</h4>
                    <p>{testimonial.course}</p>
                  </div>
                </div>
                <div className="testimonial-rating">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={16} fill="#fbbf24" color="#fbbf24" />
                  ))}
                </div>
                <p className="testimonial-text">"{testimonial.review}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Make Informed Decisions?</h2>
            <p>Join the Datanaut community today and never be caught off guard by a difficult class again.</p>
            {user ? (
              <button className="cta-button" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
                <ArrowRight size={20} />
              </button>
            ) : (
              <button 
                className="cta-button" 
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Get Started Now'}
                <ArrowRight size={20} />
              </button>
            )}
            <p className="cta-note">✓ Free for all DLSU students</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Database size={32} />
              <h3>Datanaut</h3>
              <p>Empowering DLSU students with authentic academic insights since 2024.</p>
              <div className="social-links">
                <a href="#" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>GitHub</a>
                <a href="#" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>Twitter</a>
                <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Email</a>
              </div>
            </div>
            
            <div className="footer-links">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#stats">Statistics</a>
              <a href="#testimonials">Testimonials</a>
            </div>
            
            <div className="footer-links">
              <h4>Company</h4>
              <a href="#about">About Us</a>
              <a href="#">Contact</a>
              <a href="#">Support</a>
            </div>
            
            <div className="footer-links">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2024 Datanaut. An unofficial DLSU platform. All rights reserved.</p>
            <div className="footer-badge">
              <MapPin size={14} />
              <span>De La Salle University Community</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;