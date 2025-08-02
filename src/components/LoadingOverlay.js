import React from 'react';
import './LoadingOverlay.css';

const LoadingOverlay = ({ 
  isVisible = false, 
  message = 'Loading...', 
  type = 'spinner',
  backdrop = true 
}) => {
  if (!isVisible) return null;

  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return (
          <div className="loading-dots">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        );
      case 'pulse':
        return <div className="loading-pulse"></div>;
      case 'bars':
        return (
          <div className="loading-bars">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        );
      default:
        return <div className="loading-spinner"></div>;
    }
  };

  return (
    <div className={`loading-overlay ${backdrop ? 'with-backdrop' : ''}`}>
      <div className="loading-content">
        {renderLoader()}
        {message && <div className="loading-message">{message}</div>}
      </div>
    </div>
  );
};

export default LoadingOverlay;