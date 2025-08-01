// API Client for Backend Integration
class ApiClient {
  constructor() {
    // For localhost development, match the frontend protocol
    // This ensures HTTPS frontend talks to HTTPS backend
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    let defaultURL;
    if (isLocalhost) {
      // Match the frontend protocol for localhost development
      const protocol = window.location.protocol;
      defaultURL = `${protocol}//localhost:8000/api`;
    } else {
      // For production, match the current protocol
      const isHttps = window.location.protocol === 'https:';
      const protocol = isHttps ? 'https:' : 'http:';
      defaultURL = `${protocol}//localhost:8000/api`;
    }

    this.baseURL = process.env.REACT_APP_API_URL || defaultURL;
    
    // Always get fresh token from localStorage
    this.refreshToken();

    // Request queue to prevent overwhelming the server
    this.requestQueue = [];
    this.activeRequests = 0;
    this.maxConcurrentRequests = 50; // Limit concurrent requests

    console.log('🔍 DEBUG: API Client initialized with baseURL:', this.baseURL);
    console.log('🔍 DEBUG: Frontend protocol:', window.location.protocol);
    console.log('🔍 DEBUG: Backend will use same protocol for localhost');
    console.log('🔍 DEBUG: Request queue initialized with max concurrent requests:', this.maxConcurrentRequests);
  }

  refreshToken() {
    // Always get the latest token from localStorage
    this.token = localStorage.getItem('authToken');
    return this.token;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Always get fresh token before making request
    const currentToken = this.refreshToken();
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    return headers;
  }

  // Process the request queue
  processQueue() {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    const { resolve, reject, requestFn } = this.requestQueue.shift();
    this.activeRequests++;

    requestFn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.activeRequests--;
        this.processQueue(); // Process next request in queue
      });
  }

  // Queue a request to prevent overwhelming the server
  queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, requestFn });
      this.processQueue();
    });
  }

  async request(endpoint, options = {}) {
    // Queue the request to prevent overwhelming the server
    return this.queueRequest(async () => {
      const url = `${this.baseURL}${endpoint}`;

      const config = {
        headers: this.getHeaders(),
        ...options,
      };

      try {
        console.log(`Making API request to: ${url} (Active: ${this.activeRequests}, Queued: ${this.requestQueue.length})`);

        // Dynamic timeout – longer for AI image endpoints which can take ~30-60 s
        let timeoutMs = 300000; // default  s
        const longRunningEndpoints = [
          '/facebook/generate-image',
          '/facebook/post-with-image',
          '/facebook/ai-post-with-image',
          '/facebook/post-with-pre-generated-image',
          '/facebook/create-post',  // Add the unified Facebook post endpoint
          '/instagram/post-carousel',  // Add Instagram carousel endpoint
          '/social/instagram/upload-video',  // Add video upload endpoint
          '/social/instagram/upload-image',  // Add image upload endpoint
          '/social/instagram/upload-video',  // Alternative video upload path
          '/social/instagram/upload-image',   // Alternative image upload path
          '/social/instagram/generate-carousel',  // AI carousel generation
          '/social/instagram/generate-image',     // AI image generation
          '/social/instagram/generate-caption',   // AI caption generation
          '/social/facebook/generate-image',      // Facebook AI image generation
          '/social/facebook/generate-caption-with-strategy',  // Facebook AI caption generation
          '/social/facebook/generate-bulk-captions',          // Facebook AI bulk caption generation
          '/ai/generate-content',                 // General AI content generation
          '/social/instagram/create-post',        // Instagram post creation
          '/social/facebook/create-post',         // Facebook post creation
          '/social/instagram/post-carousel',      // Instagram carousel posting
          '/social/instagram/post',               // Instagram post endpoint
          '/social/facebook/post',                // Facebook post endpoint
          '/ai/',                                 // All AI endpoints
          '/generate',                                // Any generation endpoint
          '/carousel',                                // Carousel operations
          '/upload'                                   // Upload operations
        ];

        // Check for specific high-load operations
        const isAIGeneration = endpoint.includes('generate') || endpoint.includes('ai/');
        const isCarouselOperation = endpoint.includes('carousel');
        const isUploadOperation = endpoint.includes('upload');

        if (longRunningEndpoints.some(ep => endpoint.includes(ep))) {
          if (isAIGeneration || isCarouselOperation) {
            timeoutMs = 300000; // 5 minutes for AI generation and carousel operations
          } else if (isUploadOperation) {
            timeoutMs = 180000; // 3 minutes for upload operations
          } else {
            timeoutMs = 120000; // 2 minutes for other long-running operations
          }
        }

        console.log(`⏱ Using timeout ${timeoutMs / 1000}s for this request`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error(`⏰ Timeout after ${timeoutMs / 1000}s for endpoint: ${endpoint}`);
          controller.abort();
        }, timeoutMs);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json();
          } catch (e) {
            console.warn('Failed to parse error response as JSON');
          }

          // Handle 401 Unauthorized specifically
          if (response.status === 401) {
            console.warn('Authentication failed - token may be expired');
            this.setToken(null); // Clear invalid token
            throw new Error('Could not validate credentials - please log in again');
          }

          // Handle 503 Service Unavailable (concurrency limit exceeded)
          if (response.status === 503) {
            console.warn('Server temporarily unavailable - concurrency limit exceeded');
            // Wait a bit and retry for non-critical requests
            if (!endpoint.includes('generate') && !endpoint.includes('post') && !endpoint.includes('upload')) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              // Retry the request once
              const retryResponse = await fetch(url, {
                ...config,
                signal: controller.signal
              });
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                console.log(`✅ Retry successful for ${endpoint}`);
                return retryData;
              }
            }
            throw new Error('Server is temporarily busy. Please try again in a moment.');
          }

          // Handle validation errors (422)
          if (response.status === 422 && errorData.detail) {
            // Handle Pydantic validation errors
            if (Array.isArray(errorData.detail)) {
              const validationErrors = errorData.detail.map(err =>
                `${err.loc.join('.')}: ${err.msg}`
              ).join(', ');
              throw new Error(`Validation Error: ${validationErrors}`);
            } else {
              throw new Error(errorData.detail);
            }
          }

          // Extract error message properly
          let errorMessage = 'Unknown error occurred';
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }

          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        console.log(`API response from ${endpoint}:`, responseData);
        return responseData;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error(`API request timeout for ${endpoint}`);
          throw new Error('Request timed out - backend server may not be responding');
        }
        console.error(`API Error (${endpoint}):`, error);
        throw error;
      }
    });
  }

  // Test connection to backend
  async testConnection() {
    try {
      // Use the same protocol as the frontend for localhost
      const protocol = window.location.protocol;
      const healthURL = `${protocol}//localhost:8000/health`;
      console.log('Testing backend connection to:', healthURL);
      const response = await fetch(healthURL);
      console.log('Backend connection test result:', response.status, response.ok);
      return response.ok;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      if (window.location.protocol === 'https:') {
        console.error('This is likely due to SSL certificate issues. Please visit https://localhost:8000/health in your browser and accept the certificate.');
      } else {
        console.error('Make sure the backend server is running on the correct protocol.');
      }
      return false;
    }
  }

  // Authentication endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(email, password) {
    console.log('🔍 DEBUG: Attempting login...');
    console.log('🔍 DEBUG: Email:', email);
    console.log('🔍 DEBUG: API Base URL:', this.baseURL);
    console.log('🔍 DEBUG: Full login URL:', `${this.baseURL}/auth/login`);
    
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    console.log('🔍 DEBUG: Login response:', response);

    if (response.access_token) {
      this.setToken(response.access_token);
      console.log('🔍 DEBUG: Token set successfully');
    }

    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    this.setToken(null);
  }

  // OTP endpoints
  async sendOTP(email) {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOTP(email, otp) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resendOTP(email) {
    return this.request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Google OAuth endpoints
  async getGoogleOAuthUrl() {
    return this.request('/auth/google/url');
  }

  async googleOAuthCallback(code, redirectUri) {
    const response = await this.request('/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({
        code: code,
        redirect_uri: redirectUri
      }),
    });

    if (response.access_token) {
      this.setToken(response.access_token);
    }

    return response;
  }

  async disconnectGoogleAccount() {
    return this.request('/auth/google/disconnect', {
      method: 'DELETE',
    });
  }

  // Facebook endpoints
  async getFacebookStatus() {
    return this.request('/social/facebook/status');
  }

  async connectFacebook(accessToken, userId, pages = []) {
    return this.request('/social/facebook/connect', {
      method: 'POST',
      body: JSON.stringify({
        access_token: accessToken,
        user_id: userId,
        pages: pages
      }),
    });
  }

  async refreshFacebookTokens() {
    return this.request('/social/facebook/refresh-tokens', {
      method: 'POST',
    });
  }

  async logoutFacebook() {
    return this.request('/social/facebook/logout', {
      method: 'POST',
    });
  }

  // (No scheduled post methods here anymore)

  async getSocialPosts(platform = null, limit = 50, socialAccountId = null) {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    params.append('limit', limit.toString());
    if (socialAccountId) params.append('social_account_id', socialAccountId);

    return this.request(`/api/social/posts?${params.toString()}`);
  }

  async connectInstagram(accessToken) {
    return this.request('/social/instagram/connect', {
      method: 'POST',
      body: JSON.stringify({
        access_token: accessToken
      }),
    });
  }

  async createInstagramPost(data) {
    return this.request('/social/instagram/post', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get Instagram media
  async getInstagramMedia(instagramUserId, limit = 25) {
    return this.request(`/social/instagram/media/${instagramUserId}?limit=${limit}`);
  }

  // Debug Instagram API
  async debugInstagramApi(instagramUserId) {
    return this.request(`/social/debug/instagram-api-test/${instagramUserId}`);
  }

  // Test Instagram post creation
  async testInstagramPost(instagramUserId, testImageUrl, testCaption) {
    return this.request(`/social/debug/instagram-test-post/${instagramUserId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test_image_url: testImageUrl,
        test_caption: testCaption
      })
    });
  }

  // Upload image to Cloudinary for Instagram
  async uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Use custom FormData upload method
    const url = `${this.baseURL}/social/instagram/upload-image`;
    const config = {
      method: 'POST',
      body: formData,
    };

    // Add authorization header manually for FormData
    if (this.token) {
      config.headers = {
        'Authorization': `Bearer ${this.token}`
      };
      console.log('🔍 DEBUG: Token found, adding Authorization header');
    } else {
      console.log('🔍 DEBUG: No token found!');
      console.log('🔍 DEBUG: this.token:', this.token);
      console.log('🔍 DEBUG: localStorage authToken:', localStorage.getItem('authToken'));
    }

    try {
      console.log(`🔍 DEBUG: Uploading image to Cloudinary via ${url}`);
      console.log(`🔍 DEBUG: Request config:`, config);
      const response = await fetch(url, config);

      console.log(`🔍 DEBUG: Response status:`, response.status);
      console.log(`🔍 DEBUG: Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
          console.log(`🔍 DEBUG: Error response data:`, errorData);
        } catch (e) {
          console.warn('Failed to parse error response as JSON');
        }

        let errorMessage = 'Unknown error occurred';
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log(`FormData upload response:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`FormData upload error:`, error);
      throw error;
    }
  }

  // Upload thumbnail to Cloudinary for Instagram reels
  async uploadThumbnailToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Use custom FormData upload method
    const url = `${this.baseURL}/social/instagram/upload-thumbnail`;
    const config = {
      method: 'POST',
      body: formData,
    };

    // Add authorization header manually for FormData
    if (this.token) {
      config.headers = {
        'Authorization': `Bearer ${this.token}`
      };
    }

    try {
      console.log(`🔍 DEBUG: Uploading thumbnail to Cloudinary via ${url}`);
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.warn('Failed to parse error response as JSON');
        }

        let errorMessage = 'Unknown error occurred';
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log(`Thumbnail upload response:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Thumbnail upload error:`, error);
      throw error;
    }
  }

  // Upload video to Cloudinary for Instagram
  async uploadVideoToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Use custom FormData upload method
    const url = `${this.baseURL}/social/instagram/upload-video`;
    const config = {
      method: 'POST',
      body: formData,
    };

    // Add authorization header manually for FormData
    if (this.token) {
      config.headers = {
        'Authorization': `Bearer ${this.token}`
      };
    }

    try {
      console.log(`🔍 DEBUG: Uploading video to Cloudinary via ${url}`);
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.warn('Failed to parse error response as JSON');
        }

        let errorMessage = 'Unknown error occurred';
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log(`Thumbnail upload response:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Thumbnail upload error:`, error);
      throw error;
    }
  }

  // Google Drive integration for Instagram
  async getGoogleDriveFiles(mimeType = null) {
    const params = mimeType ? `?mime_type=${mimeType}` : '';
    return this.request(`/api/google-drive/files${params}`);
  }

  async downloadGoogleDriveFile(fileId) {
    return this.request(`/api/google-drive/download/${fileId}`);
  }

  async getGoogleDriveAuth() {
    return this.request('/google-drive/auth');
  }

  async getGoogleDriveStatus() {
    return this.request('/google-drive/status');
  }

  async getGoogleDriveAuthorizeUrl() {
    return this.request('/google-drive/authorize');
  }

  async getGoogleDriveToken() {
    const response = await this.request('/google-drive/token');
    return response;
  }

  async debugGoogleDrive() {
    return this.request('/google-drive/debug');
  }

  async testGoogleDriveImages() {
    return this.request('/google-drive/test-images');
  }

  async disconnectGoogleDrive() {
    return this.request('/google-drive/disconnect', {
      method: 'POST',
    });
  }

  // Generate Instagram image using Stability AI
  async generateInstagramImage(imagePrompt, postType = 'feed') {
    return this.request('/social/instagram/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        prompt: imagePrompt,
        post_type: postType
      }),
    });
  }

  // Unified Instagram post creation endpoint
  async createUnifiedInstagramPost(instagramUserId, options = {}) {
    const payload = {
      instagram_user_id: instagramUserId,
      caption: options.caption,
      post_type: options.post_type || 'feed',
      media_type: options.media_type || 'image',
      use_ai_text: options.use_ai_text || false,
      use_ai_image: options.use_ai_image || false,
      content_prompt: options.content_prompt,
      image_prompt: options.image_prompt,
      image_url: options.image_url,
      video_url: options.video_url,
      video_filename: options.video_filename,
      media_file: options.media_file,
      media_filename: options.media_filename,
      is_reel: options.is_reel || false,
      thumbnail_url: options.thumbnail_url,
      thumbnail_filename: options.thumbnail_filename,
      thumbnail_file: options.thumbnail_file,
      location: options.location,
      hashtags: options.hashtags
    };

    // Remove undefined and null values
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([key, value]) =>
        value !== null && value !== undefined && value !== ''
      )
    );

    return this.request('/social/instagram/create-post', {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
  }

  // REPLACE Make.com auto-reply webhook
  async toggleAutoReply(pageId, enabled, responseTemplate = 'Thank you for your comment!', selectedPostIds = []) {
    return this.request('/social/facebook/auto-reply', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pageId,
        enabled: enabled,
        response_template: responseTemplate,
        selected_post_ids: selectedPostIds
      }),
    });
  }

  // Get posts for auto-reply selection
  async getPostsForAutoReply(pageId) {
    return this.request(`/social/facebook/posts-for-auto-reply?page_id=${pageId}`);
  }

  // Instagram Auto-Reply Methods
  async toggleInstagramAutoReply(instagramUserId, enabled, responseTemplate = 'Thank you for your comment!', selectedPostIds = []) {
    return this.request('/social/instagram/auto-reply', {
      method: 'POST',
      body: JSON.stringify({
        instagram_user_id: instagramUserId,
        enabled: enabled,
        response_template: responseTemplate,
        selected_post_ids: selectedPostIds
      }),
    });
  }

  async getInstagramPostsForAutoReply(instagramUserId) {
    return this.request(`/social/instagram/posts-for-auto-reply?instagram_user_id=${instagramUserId}`);
  }

  async syncInstagramPosts(instagramUserId) {
    return this.request('/social/instagram/sync-posts', {
      method: 'POST',
      body: JSON.stringify({
        instagram_user_id: instagramUserId
      }),
    });
  }

  // Get connected social accounts
  async getSocialAccounts() {
    return this.request('/social/accounts');
  }

  async getInstagramAccounts() {
    // This assumes your backend endpoint is /api/social/accounts and returns only Instagram accounts
    try {
      console.log('🔍 DEBUG: Fetching Instagram accounts from /social/accounts');
      console.log('🔍 DEBUG: Current token:', this.token ? 'Token exists' : 'No token');
      console.log('🔍 DEBUG: Base URL:', this.baseURL);

      const response = await this.request('/social/accounts', {
        method: 'GET',
      });
      console.log('🔍 DEBUG: Instagram accounts response:', response);
      return response;
    } catch (error) {
      console.error('🔍 DEBUG: Failed to fetch Instagram accounts:', error);
      console.error('🔍 DEBUG: Error type:', error.constructor.name);
      console.error('🔍 DEBUG: Error message:', error.message);

      if (error.message.includes('Failed to fetch')) {
        console.error('🔍 DEBUG: This is likely a network, CORS, or SSL certificate issue.');
        console.error('🔍 DEBUG: Please visit https://localhost:8000/health and https://localhost:8000/api/social/accounts in your browser to accept the SSL certificate.');
        console.error('🔍 DEBUG: Also check if backend is running with HTTPS.');
      }

      if (error.message.includes('Could not validate credentials')) {
        console.error('🔍 DEBUG: Authentication failed - token may be expired or invalid.');
        console.error('🔍 DEBUG: Please try logging out and logging back in.');
      }

      throw error;
    }
  }

  // Get posts
  async getPosts(platform = null, status = null, limit = 50) {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());

    const query = params.toString();
    return this.request(`/api/social/posts${query ? `?${query}` : ''}`);
  }

  // Get automation rules
  async getAutomationRules(platform = null, ruleType = null) {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (ruleType) params.append('rule_type', ruleType);

    const query = params.toString();
    return this.request(`/social/automation-rules${query ? `?${query}` : ''}`);
  }

  // Generate content using Groq API
  async generateContent(prompt) {
    return this.request('/ai/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        prompt: prompt
      }),
    });
  }

  async generateInstagramCaption(prompt) {
    try {
      const response = await this.request('/social/instagram/generate-caption', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt
        }),
      });

      if (!response || !response.content) {
        console.error('Invalid response format from caption generation:', response);
        return {
          success: false,
          error: 'Invalid response format from server'
        };
      }

      return {
        success: true,
        content: response.content,
        ...response
      };
    } catch (error) {
      console.error('Error generating Instagram caption:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate caption',
        details: error.response?.data || error.toString()
      };
    }
  }

  async generateCaptionWithStrategy(customStrategy, context = "", maxLength = 2000) {
    const response = await this.request('/social/generate-caption-with-strategy', {
      method: 'POST',
      body: JSON.stringify({
        custom_strategy: customStrategy,
        context: context,
        max_length: maxLength
      }),
    });
    return response;
  }

  async generateFacebookCaptionWithStrategy(customStrategy, context = "", maxLength = 2000) {
    const response = await this.request('/social/facebook/generate-caption-with-strategy', {
      method: 'POST',
      body: JSON.stringify({
        custom_strategy: customStrategy,
        context: context,
        max_length: maxLength
      }),
    });
    return response;
  }

  async generateFacebookBulkCaptions(customStrategy, contexts, maxLength = 2000) {
    const response = await this.request('/social/facebook/generate-bulk-captions', {
      method: 'POST',
      body: JSON.stringify({
        custom_strategy: customStrategy,
        contexts: contexts,
        max_length: maxLength
      }),
    });
    return response;
  }

  async generateBulkCaptions(customStrategy, contexts, maxLength = 2000) {
    const response = await this.request('/social/generate-bulk-captions', {
      method: 'POST',
      body: JSON.stringify({
        custom_strategy: customStrategy,
        contexts: contexts,
        max_length: maxLength
      }),
    });
    return response;
  }

  // Generate Instagram carousel
  async generateInstagramCarousel(prompt, count = 3) {
    const response = await this.request('/social/instagram/generate-carousel', {
      method: 'POST',
      body: JSON.stringify({
        prompt: prompt,
        count: count
      }),
    });
    return response;
  }

  // Post Instagram carousel
  async postInstagramCarousel(instagramUserId, caption, imageUrls) {
    const response = await this.request('/social/instagram/post-carousel', {
      method: 'POST',
      body: JSON.stringify({
        instagram_user_id: instagramUserId,
        caption: caption,
        image_urls: imageUrls
      }),
    });
    return response;
  }

  // Unified Facebook post creation endpoint
  async createFacebookPost(pageId, options = {}) {
    return this.request('/social/facebook/create-post', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pageId,
        message: options.message,
        image_url: options.image_url,
        post_type: options.post_type || 'feed',
        use_ai: options.use_ai || false,
        prompt: options.prompt,
        scheduled_time: options.scheduled_time,
        carousel_images: options.carousel_images || [],
        video_url: options.video_url,
        location: options.location,
        hashtags: options.hashtags
      }),
    });
  }

  // Stability AI Image Generation endpoint (standalone)
  async generateFacebookImage(imagePrompt, postType = 'feed') {
    return this.request('/social/facebook/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        prompt: imagePrompt,
        post_type: postType
      }),
    });
  }

  // Get AI service status including Stability AI
  async getAIServiceStatus() {
    return this.request('/ai/status');
  }

  // Debug endpoint for Stability AI troubleshooting
  async debugStabilityAI() {
    return this.request('/social/debug/stability-ai-status');
  }

  // Debug endpoint for testing Facebook image posts
  async debugFacebookImagePost(pageId, message = "Test post from debug") {
    return this.request('/social/facebook/debug-image-post', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pageId,
        message: message
      }),
    });
  }

  // Bulk Composer - Schedule multiple posts
  async bulkSchedulePosts(requestData) {
    const response = await this.request('/social/bulk-composer/schedule', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    return response;
  }

  // Notification endpoints
  async getNotifications(limit = 50, offset = 0) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    return this.request(`/notifications?${params.toString()}`);
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/mark-read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  async getNotificationPreferences() {
    return this.request('/notification-preferences');
  }

  async updateNotificationPreferences(preferences) {
    return this.request('/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async testNotification() {
    return this.request('/test-notification', {
      method: 'POST',
    });
  }

  // Bulk Composer - Schedule multiple posts for Instagram
  async bulkScheduleInstagramPosts({ social_account_id, posts }) {
    // Send social_account_id as a query param, posts as the body
    console.log('📤 API Client: Sending bulk schedule request with:', { social_account_id, posts: posts.length });
    return this.request(`/social/instagram/bulk-schedule?social_account_id=${encodeURIComponent(social_account_id)}`, {
      method: 'POST',
      body: JSON.stringify(posts),
    });
  }

  // Bulk Composer - Get scheduled posts
  async getBulkComposerContent(socialAccountId = null) {
    let endpoint = '/social/bulk-composer/content';
    if (socialAccountId) {
      endpoint += `?social_account_id=${socialAccountId}`;
    }
    return this.request(endpoint);
  }

  // Bulk Composer - Update post caption
  async updateBulkComposerPost(postId, caption) {
    return this.request(`/social/bulk-composer/content/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({
        caption: caption
      }),
    });
  }

  // Bulk Composer - Cancel/delete scheduled post
  async cancelBulkComposerPost(postId) {
    return this.request(`/social/bulk-composer/content/${postId}`, {
      method: 'DELETE',
    });
  }

  // LinkedIn endpoints
  async getLinkedInStatus() {
    return this.request('/social/linkedin/status');
  }

  async getLinkedInConfig() {
    return this.request('/social/linkedin/config');
  }

  async connectLinkedIn(data) {
    return this.request('/social/linkedin/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exchangeLinkedInCode(code) {
    return this.request('/social/linkedin/exchange-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disconnectLinkedIn() {
    return this.request('/social/linkedin/disconnect', {
      method: 'POST',
    });
  }

  async refreshLinkedInTokens() {
    return this.request('/social/linkedin/refresh-tokens', {
      method: 'POST',
    });
  }

  // Get Instagram DM auto-reply status
  async getInstagramDmAutoReplyStatus(instagramUserId) {
    return this.request(`/social/instagram/dm-auto-reply/status/${instagramUserId}`);
  }

  // Enable global Instagram auto-reply
  async enableGlobalInstagramAutoReply(instagramUserId) {
    return this.request(`/social/instagram/auto_reply/global/enable?instagram_user_id=${instagramUserId}`, {
      method: 'POST'
    });
  }

  // Disable global Instagram auto-reply
  async disableGlobalInstagramAutoReply(instagramUserId) {
    return this.request(`/social/instagram/auto_reply/global/disable?instagram_user_id=${instagramUserId}`, {
      method: 'POST'
    });
  }

  // Get global auto-reply status
  async getGlobalInstagramAutoReplyStatus(instagramUserId) {
    return this.request(`/social/instagram/auto_reply/global/status?instagram_user_id=${instagramUserId}`);
  }

  // Get global auto-reply progress
  async getGlobalInstagramAutoReplyProgress(instagramUserId) {
    return this.request(`/social/instagram/auto_reply/global/progress?instagram_user_id=${instagramUserId}`);
  }

  async getScheduledPosts() {
    // Adjust the endpoint if your backend uses a different path
    return this.request('/social/scheduled-posts');
  }

  async updateScheduledPost(postId, updatedData) {
    return this.request(`/social/scheduled-posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(updatedData)
    });
  }

  async deleteScheduledPost(postId) {
    return this.request(`/social/scheduled-posts/${postId}`, {
      method: 'DELETE'
    });
  }
}

const apiClient = new ApiClient();
export default apiClient;