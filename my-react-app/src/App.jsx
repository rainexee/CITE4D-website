import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'; // Add useNavigate
import { MessageSquare, EyeOff, ThumbsUp, Filter, Star, ChevronRight, Mail, Database } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

// Import pages you'll create
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';



function App() {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate(); // Add navigation

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        // First, get user info from Google
        const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${codeResponse.access_token}`, {
          headers: {
            Authorization: `Bearer ${codeResponse.access_token}`,
            Accept: 'application/json'
          }
        });
        const userData = await userInfoRes.json();
        
        if (userData.email && userData.email.endsWith("@dlsu.edu.ph")) {
         
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
            // Store user data in localStorage or context
            localStorage.setItem('user', JSON.stringify(backendData.user));
            alert(`Welcome, ${userData.email}!`);
            setShowLogin(false);
            navigate('/dashboard'); // Redirect to dashboard after login
          } else {
            alert('Authentication failed. Please try again.');
          }
        } else {
          alert(`Access Denied! Your email (${userData.email}) is not a DLSU account.`);
        }
      } catch (err) {
        console.error("Failed to authenticate:", err);
        alert('Login failed. Please try again.');
      }
    },
    onError: (error) => console.log('Login Failed:', error)
  });

  


 

  return (
    <Routes>
      <Route path="/" element={<LandingPage loginWithGoogle={loginWithGoogle} />} />
      {/* <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reviews" element={<Reviews />} />
      <Route path="/about" element={<About />} /> */}
      {/* Redirect any unknown routes to landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;