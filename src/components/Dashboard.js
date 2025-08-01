import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import apiClient from '../services/apiClient';

function Dashboard() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { addNotification } = useNotifications();

  const automationModules = [
    {
      id: 1,
      title: 'Facebook Automation',
      description: 'Intelligent content scheduling and engagement automation across all social platforms',
      path: '/facebook',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      id: 2,
      title: 'Instagram Automation',
      description: 'Intelligent content scheduling and engagement automation across all social platforms',
      path: '/instagram',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
    },
    {
      id: 3,
      title: 'Email Automation',
      description: 'Advanced email sequences with behavioral triggers and personalization engines',
      path: 'https://email-automation-dashboard-frontend.onrender.com/',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
    {
      id: 4,
      title: 'Linked In Automation',
      description: 'AI-driven network building and engagement automation',
      path: '/linkedin',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      ),
    },
    {
      id: 5,
      title: 'ThorSignia ChatBot',
      description: 'A chatbot for thorsignia',
      path: 'https://82a99f7c9188.ngrok-free.app/',
      icon: (
        <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="8" y="14" width="32" height="20" rx="10" fill="#f3f4f6" stroke="currentColor" />
          <ellipse cx="24" cy="34" rx="8" ry="4" fill="#f3f4f6" stroke="currentColor" />
          <circle cx="18" cy="24" r="2.5" fill="currentColor" />
          <circle cx="30" cy="24" r="2.5" fill="currentColor" />
          <rect x="22" y="28" width="4" height="2" rx="1" fill="currentColor" />
          <rect x="20" y="10" width="8" height="4" rx="2" fill="#f3f4f6" stroke="currentColor" />
          <rect x="12" y="8" width="4" height="4" rx="2" fill="#f3f4f6" stroke="currentColor" />
          <rect x="32" y="8" width="4" height="4" rx="2" fill="#f3f4f6" stroke="currentColor" />
        </svg>
      ),
    }
  ];

  const handleModuleClick = (path) => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank');
    } else {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Test notification function
  const testNotification = async () => {
    try {
      // Test backend notification creation
      const response = await apiClient.testNotification();
      
      if (response.success) {
        console.log('✅ Backend test notification created successfully');
        alert('✅ Backend test notification created! Check the notification bell.');
      } else {
        console.error('❌ Backend test notification failed');
        alert('❌ Backend test notification failed');
      }
    } catch (error) {
      console.error('❌ Error creating backend test notification:', error);
      alert('❌ Error creating backend test notification: ' + error.message);
    }
    
    // Also add a frontend test notification
    addNotification({
      type: 'pre_posting',
      platform: 'instagram',
      strategyName: 'Frontend Test',
      message: 'This is a frontend test notification to verify the UI is working properly.'
    });
  };

  return (
    <main className="dashboard-main">
      <div className="dashboard-header">
        <div className="user-profile">
          <div className="user-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="user-name">{user?.full_name || 'User'}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 0 0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
      <div className="automation-suite">
        {automationModules.map((module) => (
          <div
            key={module.id}
            className={`automation-module ${hoveredCard === module.id ? 'active' : ''}`}
            onMouseEnter={() => setHoveredCard(module.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="module-icon">{module.icon}</div>

            <div className="module-content">
              <h3 className="module-title">{module.title}</h3>
              <p className="module-description">{module.description}</p>
            </div>

            <div className="module-action">
              <button
                className="access-btn"
                onClick={() => handleModuleClick(module.path)}
              >
                <span>Launch Module</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </main >
  );
}

export default Dashboard; 