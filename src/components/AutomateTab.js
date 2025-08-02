import React from 'react';
import './AutomateTab.css';

const AutomateTab = ({ 
  autoReplySettings,
  autoReplyMessageRule,
  autoReplyMessagesEnabled,
  autoReplyMessagesLoading,
  autoReplyMessagesError,
  onToggleAutoReplyMessages
}) => {
  return (
    <div className="automate-container">
      <div className="automate-header">
        <div className="automate-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
        <div className="automate-title-section">
          <h3 className="automate-title">Automation Settings</h3>
          <p className="automate-subtitle">Configure automated responses and interactions</p>
        </div>
      </div>

      <div className="automation-cards">
        {/* Auto-Reply Comments Card */}
        <div className="automation-card">
          <div className="automation-card-header">
            <div className="automation-card-icon comments">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="automation-card-content">
              <h4 className="automation-card-title">Auto-Reply Comments</h4>
              <p className="automation-card-description">
                Automatically respond to comments on your posts with AI-generated replies
              </p>
            </div>
            <div className="automation-status">
              <div className="status-indicator always-on">
                <div className="status-dot active"></div>
                <span className="status-text">Always On</span>
              </div>
            </div>
          </div>
          
          <div className="automation-card-body">
            <div className="feature-highlight">
              <div className="highlight-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
              </div>
              <div className="highlight-content">
                <span className="highlight-title">Smart AI Responses</span>
                <span className="highlight-description">
                  Every new post automatically gets AI-powered comment replies to boost engagement
                </span>
              </div>
            </div>
            
            <div className="automation-info">
              <div className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <circle cx="12" cy="16" r="1"/>
                </svg>
              </div>
              <span className="info-text">
                This feature is enabled by default for all posts to maximize engagement and interaction with your audience.
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Reply Messages Card */}
        <div className="automation-card">
          <div className="automation-card-header">
            <div className="automation-card-icon messages">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div className="automation-card-content">
              <h4 className="automation-card-title">Auto-Reply Messages</h4>
              <p className="automation-card-description">
                Automatically respond to direct messages with customized replies
              </p>
            </div>
            <div className="automation-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoReplyMessagesEnabled}
                  disabled={autoReplyMessagesLoading || !autoReplyMessageRule}
                  onChange={onToggleAutoReplyMessages}
                />
                <span className="toggle-slider"></span>
              </label>
              <div className="toggle-status">
                <span className={`status-text ${autoReplyMessagesEnabled ? 'enabled' : 'disabled'}`}>
                  {autoReplyMessagesEnabled ? 'On' : 'Off'}
                </span>
                {autoReplyMessagesLoading && (
                  <div className="loading-spinner small"></div>
                )}
              </div>
            </div>
          </div>
          
          <div className="automation-card-body">
            {autoReplyMessagesError && (
              <div className="error-message">
                <div className="error-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <span>{autoReplyMessagesError}</span>
              </div>
            )}
            
            <div className="message-template-section">
              <div className="template-header">
                <h5 className="template-title">Message Template</h5>
                <span className="template-hint">This template will be used for auto-replies</span>
              </div>
              <div className="template-preview">
                <div className="template-content">
                  {autoReplyMessageRule?.actions?.message_template || 
                   "Thank you for your message! We'll get back to you soon."}
                </div>
              </div>
            </div>
            
            <div className="automation-note">
              <div className="note-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <circle cx="12" cy="16" r="1"/>
                </svg>
              </div>
              <span className="note-text">
                To customize the auto-reply template or modify the automation logic, please contact your administrator.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Automation Stats */}
      <div className="automation-stats">
        <div className="stats-header">
          <h4 className="stats-title">Automation Activity</h4>
          <span className="stats-subtitle">Recent automation performance</span>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">--</div>
              <div className="stat-label">Comments Replied</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">--</div>
              <div className="stat-label">Messages Replied</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">--</div>
              <div className="stat-label">Engagement Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomateTab;