// Facebook SDK and utility functions

/**
 * Load Facebook SDK
 * @param {string} appId - Facebook App ID
 * @returns {Promise} - Promise that resolves when SDK is loaded
 */
export const loadFacebookSDK = (appId) => {
  return new Promise((resolve, reject) => {
    // Check if SDK is already loaded and initialized
    if (window.FB && window.FB.init) {
      resolve(window.FB);
      return;
    }

    // Set up the async init function before loading the script
    window.fbAsyncInit = function() {
      try {
        console.log('🔄 Initializing Facebook SDK with App ID:', appId);
        
        if (!appId || appId === 'your_app_id_here') {
          reject(new Error('Invalid Facebook App ID provided'));
          return;
        }

        // Try with the latest version first, fallback to older versions if needed
        const versions = ['v19.0', 'v18.0', 'v17.0'];
        let initSuccess = false;
        
        for (const version of versions) {
          try {
            window.FB.init({
              appId: appId,
              cookie: true,
              xfbml: true,
              version: version
            });
            console.log(`✅ Facebook SDK initialized with version ${version}`);
            initSuccess = true;
            break;
          } catch (versionError) {
            console.warn(`⚠️ Failed to initialize with version ${version}:`, versionError);
            continue;
          }
        }
        
        if (!initSuccess) {
          throw new Error('Failed to initialize Facebook SDK with any supported version');
        }

        console.log('✅ Facebook SDK initialized successfully');

        // Wait a moment for initialization to complete
        setTimeout(() => {
          try {
            if (window.FB.AppEvents) {
              window.FB.AppEvents.logPageView();
            }
            console.log('✅ Facebook SDK ready for use');
            resolve(window.FB);
          } catch (appEventsError) {
            console.warn('⚠️ Facebook AppEvents failed, but SDK is ready:', appEventsError);
            resolve(window.FB);
          }
        }, 200);
      } catch (error) {
        console.error('❌ Failed to initialize Facebook SDK:', error);
        reject(new Error('Failed to initialize Facebook SDK: ' + error.message));
      }
    };

    // Check if script is already loading
    if (document.querySelector('script[src*="sdk.js"]')) {
      // Script is already loading, just wait for fbAsyncInit
      return;
    }

    // Load Facebook SDK script
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onerror = (error) => {
      reject(new Error('Failed to load Facebook SDK script'));
    };

    document.head.appendChild(script);
  });
};

/**
 * Convert file to base64 string
 * @param {File} file - File object to convert
 * @returns {Promise<string>} - Promise that resolves to base64 string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = () => {
      resolve(reader.result);
    };
    
    reader.onerror = (error) => {
      reject(new Error('Failed to read file: ' + error.message));
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Get Facebook login status
 * @returns {Promise} - Promise that resolves with login status
 */
export const getFacebookLoginStatus = () => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    window.FB.getLoginStatus((response) => {
      resolve(response);
    });
  });
};

/**
 * Facebook login
 * @param {Object} options - Login options
 * @returns {Promise} - Promise that resolves with login response
 */
export const facebookLogin = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    const defaultOptions = {
      scope: 'public_profile,pages_show_list,pages_manage_posts,pages_read_engagement',
      return_scopes: true
    };

    window.FB.login((response) => {
      if (response.authResponse) {
        resolve(response);
      } else {
        reject(new Error('Facebook login failed or was cancelled'));
      }
    }, { ...defaultOptions, ...options });
  });
};

/**
 * Facebook logout
 * @returns {Promise} - Promise that resolves when logout is complete
 */
export const facebookLogout = () => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    window.FB.logout((response) => {
      resolve(response);
    });
  });
};

/**
 * Get Facebook user info
 * @param {string} accessToken - Access token
 * @param {string} fields - Fields to retrieve
 * @returns {Promise} - Promise that resolves with user info
 */
export const getFacebookUserInfo = (accessToken, fields = 'id,name,email') => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    window.FB.api('/me', { 
      access_token: accessToken, 
      fields: fields 
    }, (response) => {
      if (response.error) {
        reject(new Error(response.error.message));
      } else {
        resolve(response);
      }
    });
  });
};

/**
 * Get Facebook pages
 * @param {string} accessToken - Access token
 * @returns {Promise} - Promise that resolves with pages data
 */
export const getFacebookPages = (accessToken) => {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }

    window.FB.api('/me/accounts', {
      access_token: accessToken,
      fields: 'id,name,category,access_token,picture,fan_count,tasks'
    }, (response) => {
      if (response.error) {
        reject(new Error(response.error.message));
      } else {
        resolve(response);
      }
    });
  });
};

/**
 * Validate file type for Facebook upload
 * @param {File} file - File to validate
 * @param {string} type - Expected type ('image' or 'video')
 * @returns {boolean} - Whether file is valid
 */
export const validateFileType = (file, type) => {
  if (!file) return false;

  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/wmv', 'video/flv', 'video/webm'];

  if (type === 'image') {
    return imageTypes.includes(file.type);
  } else if (type === 'video') {
    return videoTypes.includes(file.type);
  }

  return false;
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if file size is within limits
 * @param {File} file - File to check
 * @param {string} type - File type ('image' or 'video')
 * @returns {boolean} - Whether file size is acceptable
 */
export const validateFileSize = (file, type) => {
  if (!file) return false;

  const maxImageSize = 10 * 1024 * 1024; // 10MB for images
  const maxVideoSize = 100 * 1024 * 1024; // 100MB for videos

  if (type === 'image') {
    return file.size <= maxImageSize;
  } else if (type === 'video') {
    return file.size <= maxVideoSize;
  }

  return false;
};

const facebookService = {
  loadFacebookSDK,
  fileToBase64,
  getFacebookLoginStatus,
  facebookLogin,
  facebookLogout,
  getFacebookUserInfo,
  getFacebookPages,
  validateFileType,
  formatFileSize,
  validateFileSize
};

export default facebookService;