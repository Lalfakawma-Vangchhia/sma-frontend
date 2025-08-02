import React from 'react';
import './AIGenerateTab.css';

const AIGenerateTab = ({ 
  formData, 
  setFormData, 
  onGenerate, 
  onGenerateImage, 
  onGenerateImageWithCaption, 
  onPublish, 
  isPublishing,
  postHistory,
  isLoadingPosts,
  onRefreshPosts
}) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMediaTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      mediaType: type,
      mediaFile: null,
      generatedImageUrl: type === 'ai_image' ? prev.generatedImageUrl : null,
      generatedImageFilename: type === 'ai_image' ? prev.generatedImageFilename : null,
      imagePrompt: type === 'ai_image' ? prev.imagePrompt : ''
    }));
  };

  return (
    <div className="ai-generate-container">
      <div className="ai-generate-form">
        <div className="form-header">
          <div className="form-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="form-title-section">
            <h3 className="form-title">AI Content Generation</h3>
            <p className="form-subtitle">Create engaging posts with AI assistance</p>
          </div>
        </div>
        
        {/* Content Prompt */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Content Prompt</span>
            <span className="label-hint">Describe what you want to post about</span>
          </label>
          <div className="textarea-container">
            <textarea
              name="prompt"
              value={formData.prompt}
              onChange={handleInputChange}
              placeholder="e.g., Create a motivational post about achieving goals in 2024..."
              className="form-textarea"
              rows="3"
            />
            <div className="textarea-counter">
              {formData.prompt.length}/500
            </div>
          </div>
        </div>

        {/* Generate Content Button */}
        <div className="form-group">
          <button
            onClick={onGenerate}
            disabled={!formData.prompt.trim() || formData.isGenerating}
            className="action-btn primary"
          >
            <div className="btn-content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>{formData.isGenerating ? 'Generating...' : 'Generate Content'}</span>
            </div>
            {formData.isGenerating && (
              <div className="btn-loading">
                <div className="loading-spinner"></div>
              </div>
            )}
          </button>
        </div>

        {/* Generated Content Display */}
        {formData.generatedContent && (
          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Generated Content</span>
              <span className="label-hint">Review and edit if needed</span>
            </label>
            <div className="generated-content-container">
              <textarea
                value={formData.generatedContent}
                onChange={(e) => setFormData(prev => ({ ...prev, generatedContent: e.target.value }))}
                className="form-textarea generated-content"
                rows="4"
              />
              <div className="content-actions">
                <button
                  onClick={onGenerate}
                  disabled={formData.isGenerating}
                  className="action-btn secondary small"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Media Options */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Media Options</span>
            <span className="label-hint">Add visual content to your post</span>
          </label>
          <div className="media-options">
            <button
              type="button"
              className={`media-option ${formData.mediaType === 'none' ? 'active' : ''}`}
              onClick={() => handleMediaTypeChange('none')}
            >
              <div className="media-option-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div className="media-option-content">
                <span className="media-option-title">Text Only</span>
                <span className="media-option-desc">No media attachment</span>
              </div>
            </button>
            
            <button
              type="button"
              className={`media-option ${formData.mediaType === 'ai_image' ? 'active' : ''}`}
              onClick={() => handleMediaTypeChange('ai_image')}
            >
              <div className="media-option-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div className="media-option-content">
                <span className="media-option-title">AI Image</span>
                <span className="media-option-desc">Generate with AI</span>
              </div>
            </button>
          </div>
        </div>

        {/* AI Image Generation */}
        {formData.mediaType === 'ai_image' && (
          <div className="ai-image-section">
            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Image Prompt</span>
                <span className="label-hint">Describe the image you want to generate</span>
              </label>
              <input
                type="text"
                name="imagePrompt"
                value={formData.imagePrompt}
                onChange={handleInputChange}
                placeholder="e.g., A modern office workspace with natural lighting..."
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <button
                onClick={() => onGenerateImage('auto')}
                disabled={!formData.imagePrompt.trim() || formData.isGeneratingImage}
                className="action-btn secondary"
              >
                <div className="btn-content">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                  <span>{formData.isGeneratingImage ? 'Generating...' : 'Generate Image'}</span>
                </div>
                {formData.isGeneratingImage && (
                  <div className="btn-loading">
                    <div className="loading-spinner"></div>
                  </div>
                )}
              </button>
            </div>
            
            {formData.generatedImageUrl && (
              <div className="form-group">
                <label className="form-label">
                  <span className="label-text">Generated Image</span>
                </label>
                <div className="image-preview-container">
                  <img 
                    src={formData.generatedImageUrl} 
                    alt="Generated" 
                    className="preview-image"
                  />
                  <div className="image-actions">
                    <button
                      onClick={() => onGenerateImage('auto')}
                      disabled={formData.isGeneratingImage}
                      className="action-btn secondary small"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 4v6h-6"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="quick-actions">
          <button
            onClick={onGenerateImageWithCaption}
            disabled={!formData.prompt.trim() || formData.isGenerating || formData.isGeneratingImage}
            className="action-btn success"
          >
            <div className="btn-content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>Generate Content + Image</span>
            </div>
          </button>
        </div>

        {/* Publish Button */}
        <div className="publish-section">
          <button
            onClick={onPublish}
            disabled={!formData.generatedContent || isPublishing}
            className="publish-btn"
          >
            <div className="btn-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13"/>
                <polygon points="22,2 15,22 11,13 2,9"/>
              </svg>
              <span>{isPublishing ? 'Publishing...' : 'Publish Post'}</span>
            </div>
            {isPublishing && (
              <div className="btn-loading">
                <div className="loading-spinner"></div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Post History */}
      <div className="post-history-section">
        <div className="post-history-header">
          <div className="history-title">
            <h4>Recent AI Posts</h4>
            <span className="post-count">{postHistory.length} posts</span>
          </div>
          <button
            onClick={onRefreshPosts}
            disabled={isLoadingPosts}
            className="refresh-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {!isLoadingPosts && 'Refresh'}
          </button>
        </div>
        
        {isLoadingPosts ? (
          <div className="loading-posts">
            <div className="loading-spinner"></div>
            <span>Loading posts...</span>
          </div>
        ) : postHistory.length > 0 ? (
          <div className="posts-list">
            {postHistory.map((post, index) => (
              <div key={index} className="post-item">
                <div className="post-content">
                  <p className="post-text">{post.content}</p>
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="post-media">
                      <img src={post.media_urls[0]} alt="Post media" className="post-image" />
                    </div>
                  )}
                </div>
                <div className="post-meta">
                  <span className="post-date">
                    {new Date(post.created_at || post.next_execution).toLocaleDateString()}
                  </span>
                  <span className={`post-status ${post.status}`}>{post.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-posts">
            <div className="no-posts-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h4>No AI posts yet</h4>
            <p>Create your first AI-generated post to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIGenerateTab;