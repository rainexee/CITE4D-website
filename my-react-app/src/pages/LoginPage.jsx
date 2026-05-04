import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Mail, Database, Loader, AlertCircle, X } from 'lucide-react';
import '../styles/LoginPage.css';

function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get user info from Google
        const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${codeResponse.access_token}`, {
          headers: {
            Authorization: `Bearer ${codeResponse.access_token}`,
            Accept: 'application/json'
          }
        });
        const userData = await userInfoRes.json();
        
        // Check if email is from DLSU
        if (userData.email && userData.email.endsWith("@dlsu.edu.ph")) {
          // Send to your backend
          const backendRes = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              token: codeResponse.access_token,
              email: userData.email,
              name: userData.name,
              picture: userData.picture
            }),
          });
          
          const backendData = await backendRes.json();
          
          if (backendData.success) {
            // Store user data
            localStorage.setItem('user', JSON.stringify(backendData.user));
            localStorage.setItem('isAuthenticated', 'true');
            
            // Redirect to dashboard
            navigate('/dashboard');
          } else {
            setError('Authentication failed. Please try again.');
          }
        } else {
          setError(`Access Denied! Only DLSU email addresses (@dlsu.edu.ph) are allowed. Your email: ${userData.email || 'not provided'}`);
        }
      } catch (err) {
        console.error("Login error:", err);
        setError('An error occurred during login. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.log('Login Failed:', error);
      setError('Google login failed. Please try again.');
      setIsLoading(false);
    }
  });

  const handleGuestAccess = () => {
    // Optional: Allow guest access with limited features
    navigate('/reviews');
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="login-overlay"></div>
      </div>
      
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <Database size={48} strokeWidth={1.5} />
            <h1>Datanaut</h1>
          </div>
          
          <h2>Welcome Back</h2>
          <p className="login-subtitle">
            Sign in with your DLSU email to access dataset reviews and annotations
          </p>
          
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="error-close">
                <X size={16} />
              </button>
            </div>
          )}
          
          <button 
            className="google-login-btn"
            onClick={() => loginWithGoogle()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader size={20} className="spinner" />
            ) : (
              <Mail size={20} />
            )}
            <span>
              {isLoading ? 'Signing in...' : 'Sign in with DLSU Google Account'}
            </span>
          </button>
          
          <div className="login-divider">
            <span>or</span>
          </div>
          
          <button 
            className="guest-btn"
            onClick={handleGuestAccess}
            disabled={isLoading}
          >
            Continue as Guest
          </button>
          
          <div className="login-footer">
            <p>
              By continuing, you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>
            </p>
            <p className="email-note">
              <small>Only @dlsu.edu.ph email addresses are accepted</small>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;