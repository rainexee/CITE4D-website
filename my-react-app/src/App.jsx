import React, { useState } from 'react';
import { MessageSquare, EyeOff, ThumbsUp, Filter, Star, ChevronRight, Mail, Database } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

function App() {
  const [showLogin, setShowLogin] = useState(false);

  const loginWithGoogle = useGoogleLogin({
    onSuccess: (codeResponse) => {
      fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${codeResponse.access_token}`, {
        headers: {
          Authorization: `Bearer ${codeResponse.access_token}`,
          Accept: 'application/json'
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.email && data.email.endsWith("@dlsu.edu.ph")) {
            alert(`Success! Logged in as: ${data.email}`);
            setShowLogin(false);
            // Here is where you'll eventually send data to your MySQL API!
          } else {
            alert(`Access Denied! Your email (${data.email}) is not a DLSU account.`);
          }
        })
        .catch((err) => console.error("Failed to fetch user info:", err));
    },
    onError: (error) => console.log('Login Failed:', error)
  });

  return (
    <>
      {/* Navbar section */}
      <nav className="navbar container">
        <a href="/" className="logo">
          {/* Database icon for Datanaut repository */}
          <Database size={24} strokeWidth={2} />
          Datanaut
        </a>
        <div className="nav-links">
          <a href="#" className="nav-link">Home</a>
          <a href="#" className="nav-link">Reviews</a>
          <a href="#" className="nav-link">About</a>
          <a href="#" className="btn btn-primary" onClick={(e) => { e.preventDefault(); setShowLogin(true); }}>Log in</a>
        </div>
      </nav>

      {/* Hero section */}
      <main>
        <section className="hero container">
          <div className="hero-pill">
            <Star size={16} fill="currentColor" color="#fbbf24" />
            <span>Data is the new currency. </span>
          </div>
          <h1>Dataset viewer.</h1>
          <p>
            Dataset viewer is an unofficial platform exclusive for De La Salle University students to discover and annotate datasets.
          </p>
          <div className="hero-actions">
            <a href="#" className="btn btn-primary btn-lg">
              Get Started <ChevronRight size={20} style={{ marginLeft: '4px' }} />
            </a>
            <a href="#" className="btn btn-secondary btn-lg">
              Read Reviews
            </a>
          </div>
        </section>

        {/* Features section */}
        <section className="features container" id="features">
          <div className="features-header">
            <h2>Everything you need to know.</h2>
            <p>From detailed reviews to an active student voting system, our platform provides all the insights you need for your next enlistment.</p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <MessageSquare size={24} />
              </div>
              <h3>Post Reviews</h3>
              <p>With our modern editor, you can write and format your professor reviews with style, helping fellow students understand the class dynamics.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <EyeOff size={24} />
              </div>
              <h3>Anonymous</h3>
              <p>Your privacy matters. Every student has the choice to post their review completely anonymously, ensuring honest and uncompromised feedback.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <ThumbsUp size={24} />
              </div>
              <h3>Vote Reviews</h3>
              <p>Similar to Reddit, we have an upvote and downvote system. The most helpful and accurate reviews always rise to the top.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Filter size={24} />
              </div>
              <h3>Advanced Filters</h3>
              <p>We offer powerful filtering options ranging from departments, courses, and rating metrics to help you find the exact reviews you need.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Star size={24} />
              </div>
              <h3>Detailed Ratings</h3>
              <p>Easily see a summarized breakdown of student ratings for each professor, covering workload, grading, and teaching style.</p>
            </div>

            {/* Empty card for symmetry or a 'Coming Soon' feature mentioned on the site */}
            <div className="feature-card" style={{ borderStyle: 'dashed', backgroundColor: 'transparent', justifyItems: 'center', alignItems: 'center', textAlign: 'center' }}>
              <h3>And many more!</h3>
              <p>More features are coming soon. Stay tuned for further updates designed for the DLSU community.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer section */}
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-text">
            © {new Date().getFullYear()} Datanaut. An unofficial DLSU platform.
          </div>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
            <a href="#">Contact Us</a>
            <a href="#">Support Us</a>
          </div>
        </div>
      </footer>

      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="loginpopup" onClick={(e) => e.stopPropagation()}>
            <div className="login-header">
              <div className="login-title">Log in or sign up now!</div>
              <div className="login-subtitle">Use your DLSU email address to continue with Datanaut!</div>
            </div>

            <button className="btn-login" onClick={() => loginWithGoogle()}>
              <div className="btn-login-content">
                <Mail size={16} />
                <span>Login with your DLSU Google Account</span>
              </div>
            </button>

            <p className="login-terms">
              By using Datanaut, you agree to follow the guidelines outlined in the{' '}
              <a target="_blank" rel="noreferrer" href="https://www.dlsu.edu.ph/wp-content/uploads/pdf/osa/student-handbook.pdf">
                DLSU Student Handbook
              </a>,{' '}
              <a href="/terms-of-use">Terms of Use</a>, and{' '}
              <a data-testid="privacy-link" href="/privacy-policy">
                Privacy Policy
              </a>{' '}
              of Datanaut.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
