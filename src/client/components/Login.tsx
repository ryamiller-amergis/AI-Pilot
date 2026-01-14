import React, { useEffect, useState } from 'react';
import './Login.css';

export const Login: React.FC = () => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    fetch('/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          // Already authenticated, redirect to app
          window.location.href = '/';
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, []);

  const handleLogin = () => {
    window.location.href = '/auth/login';
  };

  if (checking) {
    return (
      <div className="login-container">
        <div className="login-card">
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-icon">🔐</div>
        <h1>AI Pilot</h1>
        <p>Sign in with your Azure DevOps account to continue</p>
        <button className="login-button" onClick={handleLogin}>
          Sign in with Azure DevOps
        </button>
      </div>
    </div>
  );
};
