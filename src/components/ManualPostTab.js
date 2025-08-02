import React from 'react';
import './ManualPostTab.css';

const ManualPostTab = ({ 
  formData, 
  setFormData, 
  onPublish, 
  isPublishing,
  postHistory,
  isLoadingPosts,
  onRefreshPosts,
  onMediaTypeChange
}) => {
  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleMediaTypeSelect = (type) => {
    if (onMediaTypeChange) {
      onMediaTypeChange(type, 'manual');
    } else {
      setFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null
      }));
    }
  };

  return (
    <div className="manual-post-container">
      <div className="manual-post-form">
        <div className="form-header">
          <div className="form-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <div className="form-title-section">
            <h3 className="form-title">Manual Post</h3>
            <p className="form-subtitle">Create and share your own content</p>
          </div>
        </div>
        
        {/* Message Input */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Post Message</span>
            <span className="label-hint">Share what's on your mind</span>
          </label>
          <div className="textarea-container">
            <textarea
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              placeholder="What's happening? Share your thoughts, updates, or announcements..."
              className="form-textarea"
              rows="5"
            />
            <div className="textarea-counter">
              {formData.message.length}/2000
            </div>
          </div>
        </div>

        {/* Media Options */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Add Media</span>
            <span className="label-hint">Enhance your post with visual content</span>
          </label>
          <div className="media-options">
            <button
              type="button"
              className={`media-option ${formData.mediaType === 'none' ? 'active' : ''}`}
              onClick={() => handleMediaTypeSelect('none')}
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
              className={`media-option ${formData.mediaType === 'photo' ? 'active' : ''}`}
              onClick={() => handleMediaTypeSelect('photo')}
            >
              <div className="media-option-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
              </div>
              <div className="media-option-content">
                <span className="media-option-title">Upload Photo</span>
                <span className="media-option-desc">Add an image</span>
              </div>
            </button>
            
            <button
              type="button"
              className={`media-option ${formData.mediaType === 'video' ? 'active' : ''}`}
              onClick={() => handleMediaTypeSelect('video')}
            >
              <div className="media-option-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23,7 16,12 23,17 23,7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <div className="media-option-content">
                <span className="media-option-title">Upload Video</span>
                <span className="media-option-desc">Add a video</span>
              </div>
            </button>
          </div>
        </div>

        {/* Photo Upload */}
        {formData.mediaType === 'photo' && (
          <div className="media-upload-section">
            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Upload Photo</span>
                <span className="label-hint">Select an image file (JPG, PNG, GIF)</span>
              </label>
              <div className="file-upload-area">
                <input
                  type="file"
                  name="mediaFile"
                  accept="image/*"
                  onChange={handleInputChange}
                  className="file-input"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="file-upload-label">
                  <div className="upload-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                  </div>
                  <div className="upload-text">
                    <span className="upload-title">Click to upload photo</span>
                    <span className="upload-subtitle">or drag and drop</span>
                  </div>
                </label>
              </div>
              {formData.mediaFile && (
                <div className="media-preview">
                  <div className="preview-header">
                    <span className="preview-title">Selected Photo</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mediaFile: null }))}
                      className="remove-media-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div className="image-preview-container">
                    <img 
                      src={URL.createObjectURL(formData.mediaFile)} 
                      alt="Preview" 
                      className="preview-image"
                    />
                  </div>
                  <div className="media-info">
                    <span className="file-name">{formData.mediaFile.name}</span>
                    <span className="file-size">
                      {(formData.mediaFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Upload */}
        {formData.mediaType === 'video' && (
          <div className="media-upload-section">
            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Upload Video</span>
                <span className="label-hint">Select a video file (MP4, MOV, AVI)</span>
              </label>
              <div className="file-upload-area">
                <input
                  type="file"
                  name="mediaFile"
                  accept="video/*"
                  onChange={handleInputChange}
                  className="file-input"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="file-upload-label">
                  <div className="upload-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23,7 16,12 23,17 23,7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  </div>
                  <div className="upload-text">
                    <span className="upload-title">Click to upload video</span>
                    <span className="upload-subtitle">or drag and drop</span>
                  </div>
                </label>
              </div>
              {formData.mediaFile && (
                <div className="media-preview">
                  <div className="preview-header">
                    <span className="preview-title">Selected Video</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mediaFile: null }))}
                      className="remove-media-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div className="video-preview-container">
                    <video 
                      src={URL.createObjectURL(formData.mediaFile)} 
                      controls
                      className="preview-video"
                    />
                  </div>
                  <div className="media-info">
                    <span className="file-name">{formData.mediaFile.name}</span>
                    <span className="file-size">
                      {(formData.mediaFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Publish Button */}
        <div className="publish-section">
          <button
            onClick={onPublish}
            disabled={!formData.message.trim() || isPublishing}
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
            <h4>Recent Manual Posts</h4>
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <h4>No manual posts yet</h4>
            <p>Create your first manual post to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualPostTab;