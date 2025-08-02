import React from 'react';
import './ProgressIndicator.css';

const ProgressIndicator = ({ 
  steps = [], 
  currentStep = 0, 
  className = '',
  size = 'medium' 
}) => {
  return (
    <div className={`progress-indicator ${size} ${className}`}>
      <div className="progress-track">
        {steps.map((step, index) => (
          <div key={index} className="progress-step-container">
            <div 
              className={`progress-step ${
                index < currentStep ? 'completed' : 
                index === currentStep ? 'active' : 'pending'
              }`}
            >
              <div className="step-circle">
                {index < currentStep ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                ) : (
                  <span className="step-number">{index + 1}</span>
                )}
              </div>
              <span className="step-label">{step}</span>
            </div>
            {index < steps.length - 1 && (
              <div 
                className={`progress-connector ${
                  index < currentStep ? 'completed' : 'pending'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressIndicator;