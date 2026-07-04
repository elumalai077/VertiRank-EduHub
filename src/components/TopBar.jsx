// src/components/TopBar.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import  jwtDecode from 'jwt-decode';
import axios from 'axios'; // Make sure to install axios: npm install axios
import "../styles/TopBar.css"
const TopBar = () => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Decode JWT token and get user details
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserDetails(decoded);
        console.log('Decoded user details:', decoded);
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
  }, []);

  // Update current time every second for expiry countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    // Prevent multiple logout attempts
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    
    try {
      // Get device ID from localStorage (or generate if not exists)
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = generateDeviceId();
        localStorage.setItem('deviceId', deviceId);
      }
      
      // Get user details from decoded token or localStorage
      const token = localStorage.getItem("token");
      const decoded = jwtDecode(token);
      
      // Prepare logout request body
      const logoutData = {
        academyId: decoded.academyId || decoded.academy_id,
        gmail: decoded.gmail || decoded.email,
        deviceId: deviceId
      };
      
      // Call your Lambda logout endpoint
      const API_URL = import.meta.env.VITE_API_URL || 'https://3k4ygdloz8.execute-api.ap-south-1.amazonaws.com/dev'; // Replace with your API URL
      const response = await axios.post(`${API_URL}/Log_out`, logoutData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200) {
        console.log('Logout successful:', response.data.message);
        // Clear local storage
        localStorage.removeItem("token");
        localStorage.removeItem("deviceId");
        // Navigate to login
        navigate('/');
      } else {
        console.error('Logout failed:', response.data.message);
        // Even if backend logout fails, clear local session
        localStorage.removeItem("token");
        navigate('/');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // In case of network error, still clear local session
      if (error.response?.status === 403) {
        alert('Unauthorized logout attempt. Please login again.');
      } else if (error.response?.status === 404) {
        alert('User not found. Please login again.');
      } else {
        alert('Logout failed. Please try again.');
      }
      // Clear local storage anyway
      localStorage.removeItem("token");
      navigate('/');
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  // Generate a unique device ID
  const generateDeviceId = () => {
    return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const formatExpiryTime = (expTimestamp) => {
    if (!expTimestamp) return 'N/A';
    const expiryDate = new Date(expTimestamp * 1000);
    const timeLeft = expiryDate - currentTime;
    
    if (timeLeft <= 0) {
      return 'Expired';
    }
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  };

  const getExpiryStatusClass = (expTimestamp) => {
    if (!expTimestamp) return 'expiry-unknown';
    const expiryDate = new Date(expTimestamp * 1000);
    const timeLeft = expiryDate - currentTime;
    const minutesLeft = timeLeft / (1000 * 60);
    
    if (timeLeft <= 0) return 'expiry-expired';
    if (minutesLeft < 5) return 'expiry-critical';
    if (minutesLeft < 30) return 'expiry-warning';
    return 'expiry-normal';
  };

  if (!userDetails) {
    return (
      <div className="topbar">
        <div className="topbar-left">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="#6C63FF" />
              <path d="M8 20L14 8L20 20M10.5 15.5H17.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>AcademyHub</span>
          </div>
        </div>
        <div className="topbar-right">
          <button 
            className="btn-logout" 
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#6C63FF" />
            <path d="M8 20L14 8L20 20M10.5 15.5H17.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>AcademyHub</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="user-info-card">
          <div className="user-info-item">
            <span className="info-label">📧 Email:</span>
            <span className="info-value">{userDetails.gmail || userDetails.email || 'N/A'}</span>
          </div>
          <div className="user-info-item">
            <span className="info-label">🏫 Academy ID:</span>
            <span className="info-value">{userDetails.academyId || userDetails.academy_id || 'N/A'}</span>
          </div>
          <div className="user-info-item">
            <span className="info-label">⏰ Expires:</span>
            <span className={`info-value ${getExpiryStatusClass(userDetails.exp)}`}>
              {formatExpiryTime(userDetails.exp)}
            </span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="avatar" style={{ background: '#6C63FF' }}>
          {(userDetails.gmail || userDetails.email || 'U')[0].toUpperCase()}
        </div>
        <button 
          className={`btn-logout ${isLoggingOut ? 'loading' : ''}`} 
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  );
};

export default TopBar;