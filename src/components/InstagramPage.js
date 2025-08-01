import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import IgBulkComposer from './igBulkComposer';
import './InstagramPage.css';
import ScheduledPostHistory from './ScheduledPostHistory';
import { loadFacebookSDK } from './FacebookUtils';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

const InstagramPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { addNotification, testNotification, testWebSocketConnection, testApiConnection, testSimpleWebSocket, refreshNotifications } = useNotifications();

  // UI State
  const [isConnected, setIsConnected] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeTab, setActiveTab] = useState('connect');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [fbAccessToken, setFbAccessToken] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Post State
  const [postType, setPostType] = useState('photo'); // photo | carousel | reel
  const [caption, setCaption] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState('');
  const [imageSource, setImageSource] = useState('ai'); // ai | upload | drive
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [autoGenerateCaption, setAutoGenerateCaption] = useState(false);
  const [captionPrompt, setCaptionPrompt] = useState('');
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  // Strategy Template State
  const [strategyData, setStrategyData] = useState({
    promptTemplate: '',
    brandName: '',
    hookIdea: '',
    features: '',
    location: '',
    phone: '',
    website: '',
    callToAction: '',
    imagePrompt: '',
    customStrategyTemplate: ''
  });

  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyTemplates, setStrategyTemplates] = useState([
    { id: 'default', name: 'Default Template', prompt: 'Generate a catchy Instagram caption for this post.' },
    { id: 'product', name: 'Product Showcase', prompt: 'Create an engaging caption highlighting the key features and benefits of this product.' },
    { id: 'event', name: 'Event Promotion', prompt: 'Write an exciting caption to promote this event, including date, time, and location.' },
    { id: 'custom', name: 'Custom Template', prompt: '' }
  ]);

  // Carousel State
  const [carouselImages, setCarouselImages] = useState([]); // URLs
  const [carouselFiles, setCarouselFiles] = useState([]); // File objects
  const [carouselCount, setCarouselCount] = useState(3);
  const [carouselCaption, setCarouselCaption] = useState('');
  const [carouselGenerating, setCarouselGenerating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Reel State
  const [reelFile, setReelFile] = useState(null);
  const [reelUrl, setReelUrl] = useState('');
  const [reelFilename, setReelFilename] = useState('');
  const [reelCaption, setReelCaption] = useState('');
  const [reelUploading, setReelUploading] = useState(false);
  const [reelAutoGenerateCaption, setReelAutoGenerateCaption] = useState(false);
  const [reelCaptionPrompt, setReelCaptionPrompt] = useState('');
  const [generatingReelCaption, setGeneratingReelCaption] = useState(false);
  // Thumbnail State for Reel
  const [reelThumbnailFile, setReelThumbnailFile] = useState(null);
  const [reelThumbnailUrl, setReelThumbnailUrl] = useState('');
  const [reelThumbnailFilename, setReelThumbnailFilename] = useState('');

  // Media Gallery
  const [userMedia, setUserMedia] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Google Drive Integration
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [driveAuthenticated, setDriveAuthenticated] = useState(false);
  const [driveAuthLoading, setDriveAuthLoading] = useState(false);

  // Auto-Reply State
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyTemplate, setAutoReplyTemplate] = useState('Thank you for your comment! We appreciate your engagement. 😊');
  const [autoReplyPosts, setAutoReplyPosts] = useState([]);
  const [selectedAutoReplyPosts, setSelectedAutoReplyPosts] = useState([]);
  const [autoReplyLoading, setAutoReplyLoading] = useState(false);
  const [loadingAutoReplyPosts, setLoadingAutoReplyPosts] = useState(false);
  const [isSelectingPosts, setIsSelectingPosts] = useState(false);

  // DM Auto-Reply State
  const [dmAutoReplyEnabled, setDmAutoReplyEnabled] = useState(false);
  const [dmAutoReplyTemplate, setDmAutoReplyTemplate] = useState('Thanks for your message! I\'ll get back to you soon. 😊');
  const [dmAutoReplyLoading, setDmAutoReplyLoading] = useState(false);

  // File Picker Modal State
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerType, setFilePickerType] = useState(''); // 'photo' or 'video'
  const [filePickerFormType, setFilePickerFormType] = useState(''); // 'manual' or 'carousel'
  const [isLoadingGoogleDrive, setIsLoadingGoogleDrive] = useState(false);
  const [googleDriveAvailable, setGoogleDriveAvailable] = useState(false);

  // Bulk Composer State
  const [showBulkComposer, setShowBulkComposer] = useState(false);

  // Facebook SDK
  const INSTAGRAM_APP_ID = process.env.REACT_APP_INSTAGRAM_APP_ID || '24054495060908418';

  // Mobile detection utility
  const isMobile = () => window.innerWidth <= 768;

  // --- New: Global Auto-Reply State ---
  const [globalAutoReplyEnabled, setGlobalAutoReplyEnabled] = useState(false);
  const [globalAutoReplyLoading, setGlobalAutoReplyLoading] = useState(false);
  const [globalAutoReplyStatus, setGlobalAutoReplyStatus] = useState(''); // For toast/feedback

  // --- New: Global Auto-Reply Progress State ---
  const [globalAutoReplyProgress, setGlobalAutoReplyProgress] = useState(null);

  // --- New: Global Auto-Reply Error and Retry State ---
  const [apiError, setApiError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  // --- New: Toast Notification ---
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3500);
  };

  // --- New: Global Auto-Reply API Logic ---
  const handleGlobalAutoReplyToggle = async () => {
    if (!selectedAccount) {
      showToast('Please select an Instagram account first.', 'error');
      return;
    }
    setGlobalAutoReplyLoading(true);
    setApiError(null);
    try {
      if (!globalAutoReplyEnabled) {
        const enableRes = await apiClient.enableGlobalInstagramAutoReply(selectedAccount.platform_user_id);
        if (enableRes.success) {
          setGlobalAutoReplyEnabled(true);
          // eslint-disable-next-line no-undef
          setGlobalAutoReplyStatus('enabled');
          showToast('Auto-reply enabled for all posts and comments!', 'success');
        } else {
          setApiError(enableRes.error || 'Failed to enable auto-reply.');
          showToast('Failed to enable auto-reply: ' + (enableRes.error || 'Unknown error'), 'error');
        }
      } else {
        const disableRes = await apiClient.disableGlobalInstagramAutoReply(selectedAccount.platform_user_id);
        if (disableRes.success) {
          setGlobalAutoReplyEnabled(false);
          // eslint-disable-next-line no-undef
          setGlobalAutoReplyStatus('disabled');
          showToast('Auto-reply disabled.', 'info');
        } else {
          setApiError(disableRes.error || 'Failed to disable auto-reply.');
          showToast('Failed to disable auto-reply: ' + (disableRes.error || 'Unknown error'), 'error');
        }
      }
    } catch (err) {
      setApiError(err.message || JSON.stringify(err));
      showToast('Error: ' + (err.message || err.toString()), 'error');
    } finally {
      setGlobalAutoReplyLoading(false);
    }
  };

  // --- New: Fetch initial global auto-reply status on account select ---
  useEffect(() => {
    const fetchGlobalAutoReplyStatus = async () => {
      if (!selectedAccount) return;
      try {
        const statusRes = await apiClient.getGlobalInstagramAutoReplyStatus(selectedAccount.platform_user_id);
        setGlobalAutoReplyEnabled(!!statusRes.enabled);
        // eslint-disable-next-line no-undef
        setGlobalAutoReplyStatus(statusRes.enabled ? 'enabled' : 'disabled');
      } catch (err) {
        setGlobalAutoReplyEnabled(false);
        // eslint-disable-next-line no-undef
        setGlobalAutoReplyStatus('disabled');
      }
    };
    fetchGlobalAutoReplyStatus();
  }, [selectedAccount]);

  // --- New: Poll for global auto-reply progress when enabled ---
  useEffect(() => {
    let intervalId;
    const pollProgress = async () => {
      if (!selectedAccount || !globalAutoReplyEnabled) return;
      try {
        const res = await apiClient.getGlobalInstagramAutoReplyProgress(selectedAccount.platform_user_id);
        if (res.success) {
          setGlobalAutoReplyProgress(res.progress);
          setApiError(null);
        }
      } catch (err) {
        setApiError(err.message || JSON.stringify(err));
        // Optionally, showToast('Progress error: ' + (err.message || err.toString()), 'error');
      }
    };
    if (globalAutoReplyEnabled && selectedAccount) {
      pollProgress();
      intervalId = setInterval(pollProgress, 3000);
    } else {
      setGlobalAutoReplyProgress(null);
    }
    return () => intervalId && clearInterval(intervalId);
  }, [globalAutoReplyEnabled, selectedAccount]);

  // --- Facebook SDK Helpers ---
  const checkLoginStatus = () => {
    if (!window.FB || !isAuthenticated) return;
    window.FB.getLoginStatus((response) => {
      if (response.status === 'connected') {
        setFbAccessToken(response.authResponse.accessToken);
        setMessage('Instagram: Using existing Facebook login session');
        handleConnectInstagram(response.authResponse.accessToken);
      } else {
        setMessage('Instagram: Please connect your Facebook account to continue');
      }
    });
  };
  const initializeFacebookSDK = () => {
    if (window.FB) {
      window.FB.init({ appId: INSTAGRAM_APP_ID, cookie: true, xfbml: true, version: 'v18.0' });
      setSdkLoaded(true);
      checkLoginStatus();
      return;
    }
    window.fbAsyncInit = function () {
      window.FB.init({ appId: INSTAGRAM_APP_ID, cookie: true, xfbml: true, version: 'v18.0' });
      setSdkLoaded(true);
      checkLoginStatus();
    };
    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadFacebookSDK(process.env.REACT_APP_FACEBOOK_APP_ID || '697225659875731').then(() => {
        checkLoginStatus();
        checkGoogleDriveAvailability();
      });
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    checkLoginStatus();
    initializeFacebookSDK();
    // eslint-disable-next-line
  }, [INSTAGRAM_APP_ID, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setInstagramAccounts([]); // Clear previous state
      setSelectedAccount('');
      setIsConnected(false);
      setActiveTab('connect');
      setMessage('');

      // Ensure token is set before making request
      const token = localStorage.getItem('authToken');
      if (token) {
        apiClient.setToken(token);
        console.log('🔍 DEBUG: Token set for Instagram accounts request');
      } else {
        console.error('🔍 DEBUG: No auth token found in localStorage');
        setMessage('Authentication token not found. Please log in again.');
        return;
      }

      // Fetch new user's Instagram accounts
      apiClient.getInstagramAccounts()
        .then(accounts => {
          console.log('🔍 DEBUG: Successfully fetched Instagram accounts:', accounts);
          setInstagramAccounts(accounts);
        })
        .catch(error => {
          console.error('🔍 DEBUG: Error fetching Instagram accounts:', error);
          if (error.message.includes('Could not validate credentials')) {
            setMessage('Your session has expired. Please log in again.');
          } else if (error.message.includes('Failed to fetch')) {
            setMessage('Unable to connect to server. Please check if the backend is running and try again.');
          } else {
            setMessage(`Error loading Instagram accounts: ${error.message}`);
          }
        });
    }
  }, [isAuthenticated]);

  // --- Instagram Connect ---
  const handleConnectInstagram = async (accessToken = fbAccessToken) => {
    if (!isAuthenticated) {
      setMessage('Please log in to your account first before connecting Instagram.');
      setLoading(false);
      return;
    }
    if (!accessToken) {
      setMessage('No access token available. Please log in with Facebook first.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setMessage('Fetching Instagram Business accounts...');
      const response = await apiClient.connectInstagram(accessToken);

      // Fetch the full list of social accounts from the backend
      const allAccounts = await apiClient.getSocialAccounts();
      // Filter for Instagram accounts
      const instagramAccountsFromBackend = allAccounts.filter(acc => acc.platform === 'instagram');

      // Map and merge info for display
      const mappedAccounts = instagramAccountsFromBackend.map(account => ({
        id: account.id, // Internal DB ID
        platform_user_id: account.platform_user_id, // Instagram user ID
        username: account.username,
        name: account.display_name || account.page_name,
        followers_count: account.follower_count || 0,
        media_count: account.media_count || 0,
        profile_picture_url: account.profile_picture_url
      }));

      setInstagramAccounts(mappedAccounts);
      setIsConnected(true);
      setMessage(`Found ${mappedAccounts.length} Instagram Business account(s)!`);
      if (mappedAccounts.length === 1) {
        setSelectedAccount(mappedAccounts[0]);
        loadUserMedia(mappedAccounts[0].platform_user_id);
      }
    } catch (error) {
      setMessage(error.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB) {
      setMessage('Facebook SDK not loaded');
      return;
    }
    setLoading(true);
    setMessage('Initiating Instagram OAuth via Facebook...');
    window.FB.login((response) => {
      if (response.status === 'connected') {
        const accessToken = response.authResponse.accessToken;
        setFbAccessToken(accessToken);
        setMessage('Facebook login successful! Connecting Instagram accounts...');
        handleConnectInstagram(accessToken);
      } else {
        setMessage('Facebook login failed or was cancelled');
        setLoading(false);
      }
    }, {
      scope: 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement, business_management'
    });
  };

  // --- Media Loading ---
  const loadUserMedia = async (instagramUserId) => {
    setLoadingMedia(true);
    try {
      const media = await apiClient.getInstagramMedia(instagramUserId);
      setUserMedia(media?.data?.media || []);
    } catch (error) {
      setMessage(`Error loading media: ${error.message}`);
    } finally {
      setLoadingMedia(false);
    }
  };

  // --- Image Upload ---
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setMessage('Please select a PNG or JPG image');
      return;
    }

    // Debug authentication status
    console.log('🔍 DEBUG: Authentication check before upload');
    console.log('🔍 DEBUG: isAuthenticated:', isAuthenticated);
    console.log('🔍 DEBUG: user:', user);
    console.log('🔍 DEBUG: apiClient token exists:', !!apiClient.token);

    setUploadingImage(true);
    setMessage('Uploading image...');
    try {
      const res = await apiClient.uploadImageToCloudinary(file);
      if (res && res.success && res.data && res.data.url) {
        setUploadedImageUrl(res.data.url);
        setAiImageUrl(res.data.url);
        setSelectedImageFile(file);
        setMessage('Image uploaded successfully!');
      } else {
        throw new Error(res?.error || 'Upload failed');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Upload error details:', err);
      setMessage(`Image upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // --- AI Image Generation ---
  const handleGenerateAIImage = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please enter a prompt for image generation.');
      return;
    }

    setAiGenerating(true);
    setMessage('Generating Instagram-optimized image with AI...');

    try {
      console.log('🔍 DEBUG: Generating Instagram image with prompt:', aiPrompt.trim());

      const res = await apiClient.generateInstagramImage(aiPrompt.trim());
      console.log('🔍 DEBUG: Image generation response:', res);

      if (res && res.success && res.data && res.data.image_url) {
        setAiImageUrl(res.data.image_url);
        const dimensions = res.data.width && res.data.height ? `(${res.data.width}x${res.data.height})` : '';
        setMessage(`AI image generated successfully! ${dimensions}`);
        console.log('🔍 DEBUG: Generated image URL:', res.data.image_url);
        console.log('🔍 DEBUG: Image dimensions:', res.data.width, 'x', res.data.height);
        console.log('🔍 DEBUG: Enhanced prompt:', res.data.enhanced_prompt);
      } else if (res && res.data && res.data.image_url) {
        // Fallback for different response format
        setAiImageUrl(res.data.image_url);
        setMessage('AI image generated successfully!');
        console.log('🔍 DEBUG: Generated image URL (fallback):', res.data.image_url);
      } else {
        console.error('🔍 DEBUG: Invalid response format:', res);
        setMessage('Failed to generate image. Please try again.');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Image generation error:', err);

      // Handle specific error types
      let errorMessage = err.message || err.toString();

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid or expired Stability AI API key. Please check your API key in the backend configuration.';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or upgrade your Stability AI plan.';
        // Set a 5-minute cooldown
        setRateLimitCooldown(300);
        const cooldownInterval = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      setMessage('Error generating image: ' + errorMessage);
    } finally {
      setAiGenerating(false);
    }
  };

  // --- Auto Generate Caption ---
  const handleAutoGenerateCaption = async () => {
    if (!captionPrompt.trim()) {
      setMessage('Please enter a prompt for caption generation.');
      return;
    }

    setGeneratingCaption(true);
    setMessage('Generating caption with AI...');

    try {
      console.log('🔍 DEBUG: Generating Instagram caption with prompt:', captionPrompt.trim());

      const res = await apiClient.generateInstagramCaption(captionPrompt.trim());
      console.log('🔍 DEBUG: Caption generation response:', res);

      if (res && res.success && res.data && res.data.content) {
        setCaption(res.data.content);
        setMessage('Caption generated successfully!');
        console.log('🔍 DEBUG: Generated caption:', res.data.content);
      } else if (res && res.content) {
        // Fallback for different response format
        setCaption(res.content);
        setMessage('Caption generated successfully!');
        console.log('🔍 DEBUG: Generated caption (fallback):', res.content);
      } else {
        console.error('🔍 DEBUG: Invalid response format:', res);
        setMessage('Failed to generate caption. Please try again.');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Caption generation error:', err);
      setMessage('Error generating caption: ' + (err.message || err.toString()));
    } finally {
      setGeneratingCaption(false);
    }
  };

  // --- Generate Image and Caption Together ---
  const handleGenerateImageAndCaption = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please enter a prompt for generation.');
      return;
    }

    setAiGenerating(true);
    setGeneratingCaption(true);
    setMessage('Generating Instagram-optimized image and caption with AI...');

    try {
      console.log('🔍 DEBUG: Generating image and caption with prompt:', aiPrompt.trim());

      // Generate image first
      const imageRes = await apiClient.generateInstagramImage(aiPrompt.trim());
      console.log('🔍 DEBUG: Image generation response:', imageRes);

      if (!imageRes || !imageRes.success || !imageRes.data || !imageRes.data.image_url) {
        throw new Error('Failed to generate image');
      }

      setAiImageUrl(imageRes.data.image_url);
      console.log('🔍 DEBUG: Generated image URL:', imageRes.data.image_url);
      console.log('🔍 DEBUG: Image dimensions:', imageRes.data.width, 'x', imageRes.data.height);

      // Generate caption using the same prompt
      const captionRes = await apiClient.generateInstagramCaption(aiPrompt.trim());
      console.log('🔍 DEBUG: Caption generation response:', captionRes);

      if (captionRes && captionRes.success && captionRes.data && captionRes.data.content) {
        setCaption(captionRes.data.content);
        console.log('🔍 DEBUG: Generated caption:', captionRes.data.content);
      } else if (captionRes && captionRes.content) {
        // Fallback for different response format
        setCaption(captionRes.content);
        console.log('🔍 DEBUG: Generated caption (fallback):', captionRes.content);
      } else {
        console.warn('🔍 DEBUG: Caption generation failed, using fallback');
        setCaption(`Check out this amazing image! ${aiPrompt.trim()}`);
      }

      const dimensions = imageRes.data.width && imageRes.data.height ? `(${imageRes.data.width}x${imageRes.data.height})` : '';
      setMessage(`Image and caption generated successfully! ${dimensions}`);

    } catch (err) {
      console.error('🔍 DEBUG: Image and caption generation error:', err);

      // Handle specific error types
      let errorMessage = err.message || err.toString();

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid or expired Stability AI API key. Please check your API key in the backend configuration.';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or upgrade your Stability AI plan.';
        // Set a 5-minute cooldown
        setRateLimitCooldown(300);
        const cooldownInterval = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      setMessage('Error generating image and caption: ' + errorMessage);

      // Clear any partial results on error
      setAiImageUrl('');
      setCaption('');
    } finally {
      setAiGenerating(false);
      setGeneratingCaption(false);
    }
  };

  // --- Retry Image Generation ---
  const handleRetryImageGeneration = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please enter a prompt for image generation.');
      return;
    }

    setAiGenerating(true);
    setMessage('Retrying image generation...');

    try {
      console.log('🔍 DEBUG: Retrying image generation with prompt:', aiPrompt.trim());

      const res = await apiClient.generateInstagramImage(aiPrompt.trim());
      console.log('🔍 DEBUG: Retry image generation response:', res);

      if (res && res.success && res.data && res.data.image_url) {
        setAiImageUrl(res.data.image_url);
        setMessage('Image generated successfully on retry!');
        console.log('🔍 DEBUG: Generated image URL (retry):', res.data.image_url);
      } else if (res && res.data && res.data.image_url) {
        // Fallback for different response format
        setAiImageUrl(res.data.image_url);
        setMessage('Image generated successfully on retry!');
        console.log('🔍 DEBUG: Generated image URL (retry fallback):', res.data.image_url);
      } else {
        console.error('🔍 DEBUG: Invalid response format on retry:', res);
        setMessage('Failed to generate image on retry. Please try again.');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Retry image generation error:', err);

      // Handle specific error types
      let errorMessage = err.message || err.toString();

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid or expired Stability AI API key. Please check your API key in the backend configuration.';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or upgrade your Stability AI plan.';
        // Set a 5-minute cooldown
        setRateLimitCooldown(300);
        const cooldownInterval = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      setMessage('Error retrying image generation: ' + errorMessage);
    } finally {
      setAiGenerating(false);
    }
  };

  // --- Carousel Upload ---
  const handleCarouselFilesChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length < 3 || files.length > 7) {
      setMessage('Please select 3 to 7 images.');
      return;
    }
    setCarouselGenerating(true);
    setMessage('Uploading carousel images...');
    try {
      const urls = [];
      for (const file of files) {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setMessage('All images must be PNG or JPG.');
          setCarouselGenerating(false);
          return;
        }
        const res = await apiClient.uploadImageToCloudinary(file);
        if (res && res.success && res.data && res.data.url) {
          urls.push(res.data.url);
        } else {
          throw new Error(res?.error || 'Upload failed');
        }
      }
      setCarouselImages(urls);
      setMessage(`Uploaded ${urls.length} images for carousel.`);
    } catch (err) {
      setMessage('Error uploading carousel images: ' + err.message);
    } finally {
      setCarouselGenerating(false);
    }
  };

  // --- Carousel Drag and Drop Handlers ---
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newImages = [...carouselImages];
    const draggedImage = newImages[draggedIndex];

    // Remove the dragged item
    newImages.splice(draggedIndex, 1);

    // Insert at new position
    newImages.splice(dropIndex, 0, draggedImage);

    setCarouselImages(newImages);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const removeCarouselImage = (indexToRemove) => {
    const newImages = carouselImages.filter((_, index) => index !== indexToRemove);
    setCarouselImages(newImages);

    // Adjust carousel count if needed
    if (newImages.length < carouselCount) {
      setCarouselCount(Math.max(3, newImages.length));
    }
  };

  // --- Carousel Auto Generate Caption ---
  const handleCarouselAutoGenerateCaption = async () => {
    if (!captionPrompt.trim()) {
      setMessage('Please provide a prompt for caption generation.');
      return;
    }

    setGeneratingCaption(true);
    setMessage('Generating carousel caption...');

    try {
      const result = await apiClient.generateInstagramCaption(captionPrompt.trim());
      if (result.success && result.content) {
        setCarouselCaption(result.content);
        setMessage('Caption generated successfully!');
      } else {
        setMessage('Failed to generate caption: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('Error generating caption: ' + err.message);
    } finally {
      setGeneratingCaption(false);
    }
  };

  // --- Reel Upload ---
  const handleReelFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setMessage('Only .mp4 or .mov files are allowed.');
      return;
    }
    setReelUploading(true);
    setMessage('Uploading video...');
    try {
      const res = await apiClient.uploadVideoToCloudinary(file);
      console.log('Video upload response:', res);

      // Check for different response structures
      if (res && res.success && (res.url || res.data?.url)) {
        const videoUrl = res.url || res.data?.url;
        const filename = res.filename || res.data?.filename;
        setReelUrl(videoUrl);
        setReelFilename(filename || '');
        // eslint-disable-next-line no-undef
        setReelFile(file);
        console.log('🔍 DEBUG: Video uploaded successfully:', {
          videoUrl,
          filename,
          res
        });
        setMessage('Video uploaded successfully!');
      } else if (res && res.data && res.data.url) {
        // Alternative response structure
        setReelUrl(res.data.url);
        setReelFilename(res.data.filename || '');
        // eslint-disable-next-line no-undef
        setReelFile(file);
        setMessage('Video uploaded successfully!');
      } else {
        throw new Error(res?.error || res?.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Video upload error:', err);
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setReelUploading(false);
    }
  };

  // --- Reel Auto Generate Caption ---
  const handleReelAutoGenerateCaption = async () => {
    if (!reelCaptionPrompt.trim()) {
      setMessage('Please provide a prompt for caption generation.');
      return;
    }

    setGeneratingReelCaption(true);
    setMessage('Generating reel caption...');

    try {
      const result = await apiClient.generateInstagramCaption(reelCaptionPrompt.trim());
      if (result.success && result.content) {
        setReelCaption(result.content);
        setMessage('Reel caption generated successfully!');
      } else {
        setMessage('Failed to generate caption: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('Error generating caption: ' + err.message);
    } finally {
      setGeneratingReelCaption(false);
    }
  };

  // --- Reel Thumbnail Upload ---
  const handleReelThumbnailChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setMessage('Only .jpg, .jpeg, .png files are allowed for thumbnail.');
      return;
    }
    setMessage('Uploading thumbnail image...');
    try {
      const res = await apiClient.uploadThumbnailToCloudinary(file);
      if (res && res.success && (res.url || res.data?.url)) {
        const imageUrl = res.url || res.data?.url;
        const filename = res.filename || res.data?.filename;
        setReelThumbnailUrl(imageUrl);
        setReelThumbnailFilename(filename || '');
        // eslint-disable-next-line no-undef
        setReelThumbnailFile(file);
        console.log('🔍 DEBUG: Thumbnail uploaded successfully:', {
          imageUrl,
          filename,
          res
        });
        setMessage('Thumbnail uploaded successfully!');
      } else {
        throw new Error(res?.error || res?.message || 'Thumbnail upload failed');
      }
    } catch (err) {
      setMessage('Error: ' + (err.message || err.toString()));
    }
  };

  // --- Google Drive Integration ---
  const checkGoogleDriveAuth = async () => {
    try {
      const response = await apiClient.getGoogleDriveStatus();
      setDriveAuthenticated(response.authenticated);
      return response.authenticated;
    } catch (error) {
      console.error('Error checking Google Drive auth:', error);
      setDriveAuthenticated(false);
      return false;
    }
  };

  const authenticateGoogleDrive = async () => {
    setDriveAuthLoading(true);
    try {
      const response = await apiClient.getGoogleDriveAuthorizeUrl();
      if (response.consent_url) {
        // Open popup for OAuth
        const popup = window.open(
          response.consent_url,
          'google-drive-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for OAuth completion
        const handleMessage = (event) => {
          if (event.data.success) {
            setDriveAuthenticated(true);
            setMessage('Google Drive connected successfully!');
            loadDriveFiles();
          } else if (event.data.error) {
            setMessage(`Google Drive authentication failed: ${event.data.error}`);
          }
          window.removeEventListener('message', handleMessage);
          if (popup) popup.close();
        };

        window.addEventListener('message', handleMessage);
      } else if (response.already_authenticated) {
        setDriveAuthenticated(true);
        setMessage('Google Drive already authenticated!');
        loadDriveFiles();
      }
    } catch (error) {
      setMessage(`Google Drive authentication error: ${error.message}`);
    } finally {
      setDriveAuthLoading(false);
    }
  };

  const loadDriveFiles = async () => {
    if (!driveAuthenticated) return;

    setLoadingDriveFiles(true);
    try {
      const response = await apiClient.getGoogleDriveFiles('image/');
      if (response.success && response.files) {
        setDriveFiles(response.files);
      } else {
        setMessage('Failed to load Google Drive files');
      }
    } catch (error) {
      setMessage(`Error loading Google Drive files: ${error.message}`);
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleDriveFileSelect = async (fileId, fileName) => {
    setUploadingImage(true);
    setMessage('Downloading file from Google Drive...');
    try {
      const response = await apiClient.downloadGoogleDriveFile(fileId);
      if (response.success && response.fileContent) {
        // Convert base64 to blob and upload to Cloudinary
        const byteCharacters = atob(response.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.mimeType });

        // Create a File object from the blob
        const file = new File([blob], fileName, { type: response.mimeType });

        // Upload to Cloudinary
        const uploadResponse = await apiClient.uploadImageToCloudinary(file);
        if (uploadResponse.success && uploadResponse.data && uploadResponse.data.url) {
          setUploadedImageUrl(uploadResponse.data.url);
          setAiImageUrl(uploadResponse.data.url);
          setMessage('File uploaded from Google Drive successfully!');
          setShowDriveModal(false);
        } else {
          throw new Error(uploadResponse.error || 'Upload failed');
        }
      } else {
        throw new Error(response.error || 'Download failed');
      }
    } catch (error) {
      setMessage(`Error processing Google Drive file: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const openDriveModal = async () => {
    const isAuth = await checkGoogleDriveAuth();
    if (!isAuth) {
      await authenticateGoogleDrive();
    } else {
      await loadDriveFiles();
    }
    setShowDriveModal(true);
  };

  // File Picker Functions
  const openFilePicker = (type, formType) => {
    setFilePickerType(type);
    setFilePickerFormType(formType);
    setShowFilePicker(true);
  };

  const closeFilePicker = () => {
    setShowFilePicker(false);
    setFilePickerType('');
    setFilePickerFormType('');
    setIsLoadingGoogleDrive(false);
  };

  const handleLocalFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (filePickerFormType === 'carousel') {
      // Handle carousel upload
      handleCarouselFilesChange({ target: { files } });
    } else {
      // Handle single file upload
      const file = files[0];
      if (filePickerType === 'photo') {
        handleImageChange({ target: { files: [file] } });
      } else if (filePickerType === 'video') {
        handleReelFileChange({ target: { files: [file] } });
      }
    }
    closeFilePicker();
  };

  const handleGoogleDriveSelect = async () => {
    setIsLoadingGoogleDrive(true);
    try {
      // Check if already authenticated
      const status = await apiClient.getGoogleDriveStatus();
      if (!status.authenticated) {
        // Get consent URL for popup
        const authResponse = await apiClient.getGoogleDriveAuthorizeUrl();
        if (authResponse.consent_url) {
          // Open popup and wait for completion
          await openDriveAuthPopup(authResponse.consent_url);
        }
      }

      // After popup closes, re-check authentication status
      const finalStatus = await apiClient.getGoogleDriveStatus();
      if (!finalStatus.authenticated) {
        throw new Error('Authentication was not completed successfully');
      }

      // Update state and proceed with Google Drive picker
      setGoogleDriveAvailable(true);

      // Initialize Google Drive API
      await loadGoogleDriveAPI();

      // Check if google object is available
      if (typeof window.google === 'undefined' || !window.google.picker) {
        throw new Error('Google Picker API failed to load');
      }

      // Get fresh token for picker
      const authResult = await apiClient.getGoogleDriveAuth();

      // Open Google Drive picker
      const picker = new window.google.picker.PickerBuilder()
        .addView(new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes(filePickerType === 'photo' ? 'image/*' : 'video/*'))
        .setOAuthToken(authResult.access_token)
        .setDeveloperKey(process.env.REACT_APP_GOOGLE_DEVELOPER_KEY || '')
        .setCallback(handleGoogleDriveCallback)
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED, filePickerFormType === 'carousel')
        .setTitle(filePickerFormType === 'carousel' ? 'Select multiple files from Google Drive' : 'Select a file from Google Drive')
        .setSelectableMimeTypes(filePickerType === 'photo' ? 'image/*' : 'video/*')
        .build();

      picker.setVisible(true);

    } catch (error) {
      console.error('Error with Google Drive selection:', error);
      setMessage(`Google Drive error: ${error.message}`);
    } finally {
      setIsLoadingGoogleDrive(false);
    }
  };

  const loadGoogleDriveAPI = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.picker) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', () => {
            resolve();
          });
        } else {
          reject(new Error('Google API failed to load'));
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const openDriveAuthPopup = (authUrl) => {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        authUrl,
        'google-drive-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      const messageHandler = (event) => {
        if (event.data.success) {
          setGoogleDriveAvailable(true);
          setMessage('Google Drive connected successfully!');
          resolve();
        } else if (event.data.error) {
          setMessage(`Google Drive authentication failed: ${event.data.error}`);
          reject(new Error(event.data.error));
        }
        window.removeEventListener('message', messageHandler);
        if (popup) popup.close();
      };

      window.addEventListener('message', messageHandler);

      // Timeout after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (popup) popup.close();
        reject(new Error('Authentication timeout'));
      }, 300000);
    });
  };

  const handleGoogleDriveCallback = async (data) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const files = data.docs;
      try {
        if (filePickerFormType === 'carousel') {
          // Handle multiple files for carousel
          const fileObjects = [];
          for (const file of files) {
            const fileContent = await downloadGoogleDriveFile(file.id);
            const blob = new Blob([fileContent], { type: file.mimeType });
            const fileObj = new File([blob], file.name, { type: file.mimeType });
            fileObjects.push(fileObj);
          }
          handleCarouselFilesChange({ target: { files: fileObjects } });
        } else {
          // Handle single file
          const file = files[0];
          const fileContent = await downloadGoogleDriveFile(file.id);
          const blob = new Blob([fileContent], { type: file.mimeType });
          const fileObj = new File([blob], file.name, { type: file.mimeType });

          if (filePickerType === 'photo') {
            handleImageChange({ target: { files: [fileObj] } });
          } else if (filePickerType === 'video') {
            handleReelFileChange({ target: { files: [fileObj] } });
          }
        }

        closeFilePicker();
        setMessage('File(s) selected from Google Drive successfully!');
      } catch (error) {
        console.error('Error downloading file from Google Drive:', error);
        setMessage('Failed to download file from Google Drive: ' + error.message);
      }
    }
  };

  const downloadGoogleDriveFile = async (fileId) => {
    try {
      const response = await apiClient.downloadGoogleDriveFile(fileId);
      if (response.success && response.fileContent) {
        // Convert base64 to blob
        const byteCharacters = atob(response.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return byteArray;
      } else {
        throw new Error(response.error || 'Download failed');
      }
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  };

  // --- Post Submission ---
  const handlePublish = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first');
      return;
    }

    if (postType === 'photo' && (!aiImageUrl || !aiImageUrl.trim()) && (!uploadedImageUrl || !uploadedImageUrl.trim())) {
      setMessage('Please select or generate an image');
      return;
    }

    if (postType === 'carousel' && carouselImages.length === 0) {
      setMessage('Please generate or upload carousel images');
      return;
    }

    if (postType === 'reel' && !reelUrl) {
      setMessage('Please upload a video for the reel');
      return;
    }

    setLoading(true);
    setMessage('Creating Instagram post...');

    // Create pre-posting notification
    addNotification({
      type: 'pre_posting',
      platform: 'instagram',
      strategyName: postType === 'photo' ? 'Photo Post' : (postType === 'reel' ? 'Reel Post' : 'Carousel Post'),
      message: `Preparing to publish your Instagram ${postType} post...`,
      timestamp: new Date().toISOString()
    });

    try {
      // Use the unified Instagram post endpoint for all post types
      const options = {
        instagram_user_id: selectedAccount.platform_user_id,
        post_type: postType === 'photo' ? 'feed' : (postType === 'reel' ? 'reel' : postType),
        media_type: postType === 'reel' ? 'video' : 'image' // <-- robust: send 'video' for reels
      };

      // Handle different post types
      if (postType === 'photo') {
        options.caption = caption;
        const imageUrl = imageSource === 'ai' ? aiImageUrl : uploadedImageUrl;
        if (imageUrl && imageUrl.trim()) {
          options.image_url = imageUrl;
        } else {
          // If no image is available, we can't create a photo post
          setMessage('Please select or generate an image before creating a photo post');
          setLoading(false);
          return;
        }
        console.log('🔍 DEBUG: Photo post options:', {
          postType,
          imageSource,
          aiImageUrl,
          uploadedImageUrl,
          finalImageUrl: options.image_url,
          caption: options.caption
        });
      } else if (postType === 'carousel') {
        // For carousel, we need to use the carousel-specific endpoint
        const response = await apiClient.postInstagramCarousel(
          selectedAccount.platform_user_id,
          carouselCaption,
          carouselImages
        );

        if (response.success) {
          setMessage('Instagram carousel post created successfully!');

          // Create success notification for carousel
          addNotification({
            type: 'success',
            platform: 'instagram',
            strategyName: 'Carousel Post',
            message: 'Your Instagram carousel post was published successfully!',
            timestamp: new Date().toISOString()
          });

          // Reset form
          setCarouselImages([]);
          setCarouselCaption('');
          setCaptionPrompt('');
          setAutoGenerateCaption(false);
          setAiPrompt('');

          // Reload user media
          if (selectedAccount) {
            loadUserMedia(selectedAccount.platform_user_id);
          }
        } else {
          setMessage(`Failed to create carousel post: ${response.error}`);

          // Create failure notification for carousel
          addNotification({
            type: 'failure',
            platform: 'instagram',
            strategyName: 'Carousel Post',
            message: `Failed to publish Instagram carousel post: ${response.error}`,
            timestamp: new Date().toISOString()
          });
        }
        setLoading(false);
        return;
      } else if (postType === 'reel') {
        options.caption = reelCaption;
        // Always use Cloudinary URL for Reels
        if (reelUrl && reelUrl.trim().startsWith('http')) {
          options.video_url = reelUrl;
        } else if (reelFilename && reelFilename.trim()) {
          options.video_filename = reelFilename;
        }
        options.is_reel = true;
        if (reelThumbnailUrl && reelThumbnailUrl.trim()) {
          options.thumbnail_url = reelThumbnailUrl;
        } else if (reelThumbnailFilename && reelThumbnailFilename.trim()) {
          options.thumbnail_filename = reelThumbnailFilename;
        }
        options.media_type = 'video';
        // Do NOT send media_file or media_filename for Reels
        if ('media_file' in options) delete options.media_file;
        if ('media_filename' in options) delete options.media_filename;
        if ('image_url' in options) delete options.image_url;
        console.log('🔍 DEBUG: Reel post options:', options);
        console.log('🔍 DEBUG: Thumbnail state values:', {
          reelThumbnailUrl,
          reelThumbnailFilename,
          hasThumbnailUrl: reelThumbnailUrl && reelThumbnailUrl.trim(),
          hasThumbnailFilename: reelThumbnailFilename && reelThumbnailFilename.trim()
        });
      }

      // Remove any empty string values from options to avoid backend validation issues
      const cleanOptions = Object.fromEntries(
        Object.entries(options).filter(([key, value]) =>
          value !== null && value !== undefined && value !== ''
        )
      );

      // Additional validation for photo posts
      if (postType === 'photo' && !cleanOptions.image_url) {
        setMessage('Photo posts require an image. Please select or generate an image first.');
        setLoading(false);
        return;
      }

      // Additional validation for reel posts
      if (postType === 'reel' && !cleanOptions.video_url && !cleanOptions.video_filename) {
        setMessage('Reel posts require a video. Please upload a video first.');
        setLoading(false);
        return;
      }

      console.log('🔍 DEBUG: Calling createUnifiedInstagramPost with:', {
        instagramUserId: selectedAccount.platform_user_id,
        options: cleanOptions,
        originalPostType: postType,
        originalOptions: options,
        reelUrl: reelUrl,
        reelFilename: reelFilename
      });
      console.log('🔍 DEBUG: Final thumbnail state before API call:', {
        reelThumbnailUrl,
        reelThumbnailFilename,
        hasThumbnailUrl: reelThumbnailUrl && reelThumbnailUrl.trim(),
        hasThumbnailFilename: reelThumbnailFilename && reelThumbnailFilename.trim(),
        cleanOptionsHasThumbnail: cleanOptions.thumbnail_url || cleanOptions.thumbnail_filename
      });
      const response = await apiClient.createUnifiedInstagramPost(selectedAccount.platform_user_id, cleanOptions);

      if (response.success) {
        setMessage('Instagram post created successfully!');

        // Create success notification
        addNotification({
          type: 'success',
          platform: 'instagram',
          strategyName: postType === 'photo' ? 'Photo Post' : (postType === 'reel' ? 'Reel Post' : 'Carousel Post'),
          message: `Your Instagram ${postType} post was published successfully!`,
          timestamp: new Date().toISOString()
        });

        // Reset form
        setCaption('');
        setReelCaption('');
        setReelCaptionPrompt('');
        setReelAutoGenerateCaption(false);
        setAiImageUrl('');
        setUploadedImageUrl('');
        setReelUrl('');
        setReelFilename(''); // Clear the filename too
        // eslint-disable-next-line no-undef
        setReelFile(null);
        setSelectedImageFile(null);
        setAiPrompt('');
        setCaptionPrompt('');
        setReelThumbnailUrl('');
        setReelThumbnailFilename('');
        // eslint-disable-next-line no-undef
        setReelThumbnailFile(null);
        // Reload user media
        if (selectedAccount) {
          loadUserMedia(selectedAccount.platform_user_id);
        }
        // --- Synchronize account info for post count ---
        try {
          const allAccounts = await apiClient.getSocialAccounts();
          const updatedAccount = allAccounts.find(acc => acc.id === selectedAccount.id);
          if (updatedAccount) {
            setSelectedAccount(updatedAccount);
            setInstagramAccounts(prev =>
              prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc)
            );
          }
        } catch (err) {
          console.warn('Failed to refresh account info after post:', err);
        }
        setActiveTab('scheduled-posts');
      } else {
        let errorMsg = `Failed to create post: ${response.error || 'Unknown error'}`;
        if (response.details) {
          errorMsg += `\nDetails: ${typeof response.details === 'string' ? response.details : JSON.stringify(response.details)}`;
        }
        setMessage(errorMsg);

        // Create failure notification
        addNotification({
          type: 'failure',
          platform: 'instagram',
          strategyName: postType === 'photo' ? 'Photo Post' : (postType === 'reel' ? 'Reel Post' : 'Carousel Post'),
          message: `Failed to publish Instagram ${postType} post: ${response.error || 'Unknown error'}`,
          timestamp: new Date().toISOString()
        });
        console.error('Instagram post error:', response);
      }
    } catch (error) {
      console.error('Error creating Instagram post:', error);
      setMessage(`Error creating post: ${error.message}`);

      // Create failure notification for unexpected errors
      addNotification({
        type: 'failure',
        platform: 'instagram',
        strategyName: postType === 'photo' ? 'Photo Post' : (postType === 'reel' ? 'Reel Post' : 'Carousel Post'),
        message: `Unexpected error creating Instagram ${postType} post: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Check Google Drive availability
  const checkGoogleDriveAvailability = async () => {
    try {
      const status = await apiClient.getGoogleDriveStatus();
      setGoogleDriveAvailable(status.authenticated);
    } catch (error) {
      console.error('Error checking Google Drive availability:', error);
      setGoogleDriveAvailable(false);
    }
  };

  // --- Logout ---
  const handleLogout = () => {
    setInstagramAccounts([]);
    setSelectedAccount('');
    setIsConnected(false);
    setActiveTab('connect');
    setMessage('Instagram accounts disconnected');
  };

  // Auto-Reply Functions
  const loadAutoReplySettings = async () => {
    if (!selectedAccount) return;

    try {
      console.log('🔄 Loading auto-reply settings for Instagram account:', selectedAccount.platform_user_id, selectedAccount.username);

      // Get automation rules for Instagram auto-reply
      const rules = await apiClient.getAutomationRules('instagram', 'auto_reply');
      console.log('📋 Found automation rules:', rules);

      // Find existing auto-reply rule for this account
      const existingRule = rules.find(rule =>
        rule.social_account_id === selectedAccount.id &&
        rule.rule_type === 'AUTO_REPLY'
      );

      if (existingRule) {
        setAutoReplyEnabled(existingRule.is_active);
        setAutoReplyTemplate(existingRule.actions?.template || '');
        console.log('✅ Found existing auto-reply rule:', existingRule);
      } else {
        setAutoReplyEnabled(false);
        setAutoReplyTemplate('');
        console.log('📝 No existing auto-reply rule found');
      }

      // Load posts for auto-reply selection
      await loadPostsForAutoReply();

    } catch (error) {
      console.error('❌ Error loading auto-reply settings:', error);

      let errorMessage = 'Failed to load auto-reply settings';
      if (error.response?.data?.detail) {
        errorMessage += ': ' + error.response.data.detail;
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }

      setMessage(errorMessage);
    }
  };

  // DM Auto-Reply Functions
  const loadDmAutoReplySettings = async () => {
    if (!selectedAccount) return;
    try {
      console.log('🔄 Loading DM auto-reply settings for Instagram account:', selectedAccount.platform_user_id, selectedAccount.username);
      const statusResponse = await apiClient.getInstagramDmAutoReplyStatus(selectedAccount.platform_user_id);
      console.log('📋 DM auto-reply status:', statusResponse);
      if (statusResponse.success) {
        setDmAutoReplyEnabled(statusResponse.enabled);
        console.log('✅ DM auto-reply status loaded:', statusResponse.enabled);
      } else {
        setDmAutoReplyEnabled(false);
        showToast('Failed to load DM auto-reply status: ' + (statusResponse.error || 'Unknown error'), 'error');
        console.log('📝 No DM auto-reply status found');
      }
    } catch (error) {
      setDmAutoReplyEnabled(false);
      showToast('Error loading DM auto-reply settings: ' + (error?.message || 'Unknown error'), 'error');
      console.error('❌ Error loading DM auto-reply settings:', error);
    }
  };

  const handleDmAutoReplyToggle = async () => {
    if (!selectedAccount) {
      showToast('Please select an Instagram account first.', 'error');
      return;
    }
    setDmAutoReplyLoading(true);
    try {
      const response = await apiClient.toggleInstagramDmAutoReply(
        selectedAccount.platform_user_id,
        !dmAutoReplyEnabled
      );
      if (response.success) {
        setDmAutoReplyEnabled(!dmAutoReplyEnabled);
        showToast(
          !dmAutoReplyEnabled
            ? 'Auto DM Reply enabled successfully!'
            : 'Auto DM Reply disabled successfully.',
          'success'
        );
      } else {
        showToast('Failed to toggle Auto DM Reply: ' + (response.error || 'Unknown error'), 'error');
        console.error('❌ Failed to toggle Auto DM Reply:', response);
      }
    } catch (error) {
      showToast('Failed to toggle Auto DM Reply: ' + (error?.message || 'Unknown error'), 'error');
      console.error('❌ Error toggling Auto DM Reply:', error);
    } finally {
      setDmAutoReplyLoading(false);
    }
  };

  const loadPostsForAutoReply = async () => {
    if (!selectedAccount) return;

    try {
      setLoadingAutoReplyPosts(true);
      console.log('🔄 Loading posts for auto-reply selection for Instagram account:', selectedAccount.platform_user_id);

      // First, try to get posts directly from the database
      const response = await apiClient.getPosts('instagram');
      console.log('📋 All Instagram posts from database:', response);

      if (response && Array.isArray(response)) {
        console.log('🔍 Selected account details:', {
          id: selectedAccount.id,
          platform_user_id: selectedAccount.platform_user_id,
          username: selectedAccount.username
        });

        // Filter posts for this specific account with better debugging
        const accountPosts = response.filter(post => {
          // Primary match: social_account_id (most reliable)
          const matchesAccountId = post.social_account?.id === selectedAccount.id;

          // Secondary matches for compatibility
          const matchesPlatformUserId = post.social_account?.platform_user_id === selectedAccount.platform_user_id;
          const matchesUsername = post.social_account?.username === selectedAccount.username;

          const isMatch = matchesAccountId || matchesPlatformUserId || matchesUsername;

          console.log('🔍 Checking post:', {
            postId: post.id,
            postAccountId: post.social_account?.id,
            postPlatformUserId: post.social_account?.platform_user_id,
            postUsername: post.social_account?.username,
            selectedAccountId: selectedAccount.id,
            selectedPlatformUserId: selectedAccount.platform_user_id,
            selectedUsername: selectedAccount.username,
            matchesAccountId,
            matchesPlatformUserId,
            matchesUsername,
            isMatch
          });

          return isMatch;
        });

        console.log('📋 Posts for this account:', accountPosts.length);
        console.log('📋 All posts in database:', response.length);
        console.log('📋 Account posts details:', accountPosts.map(post => ({
          id: post.id,
          content: post.content?.substring(0, 50) + '...',
          social_account_id: post.social_account?.id,
          platform_user_id: post.social_account?.platform_user_id,
          username: post.social_account?.username
        })));

        if (accountPosts.length === 0) {
          console.log('⚠️ No posts found for this specific account. Showing all Instagram posts for debugging...');

          // Show all Instagram posts for debugging
          setAutoReplyPosts(response);
          console.log('📋 Showing all Instagram posts for debugging:', response.length);

          // Also try to sync from Instagram API
          console.log('🔄 Attempting to sync from Instagram...');
          try {
            const syncResponse = await apiClient.syncInstagramPosts(selectedAccount.platform_user_id);
            console.log('📡 Sync response:', syncResponse);

            if (syncResponse.success) {
              // Re-fetch posts after sync
              const refreshedResponse = await apiClient.getPosts('instagram');
              const refreshedAccountPosts = refreshedResponse.filter(post => {
                // Primary match: social_account_id (most reliable)
                const matchesAccountId = post.social_account?.id === selectedAccount.id;

                // Secondary matches for compatibility
                const matchesPlatformUserId = post.social_account?.platform_user_id === selectedAccount.platform_user_id;
                const matchesUsername = post.social_account?.username === selectedAccount.username;

                return matchesAccountId || matchesPlatformUserId || matchesUsername;
              });

              if (refreshedAccountPosts.length > 0) {
                setAutoReplyPosts(refreshedAccountPosts);
                console.log('✅ Posts loaded after sync:', refreshedAccountPosts.length);
              } else {
                console.log('⚠️ Still no posts found after sync. Showing all posts for debugging.');
                setAutoReplyPosts(refreshedResponse);
                setMessage('No posts found for this account. Showing all Instagram posts for debugging. Create some posts first using the Create Post tab.');
              }
            } else {
              setMessage('Failed to sync posts from Instagram. Showing all posts for debugging.');
            }
          } catch (syncError) {
            console.error('❌ Sync error:', syncError);
            setMessage('Failed to sync posts from Instagram. Showing all posts for debugging.');
          }
        } else {
          setAutoReplyPosts(accountPosts);
          console.log('✅ Posts loaded for auto-reply selection:', accountPosts.length);
        }
      } else {
        throw new Error('Failed to load posts');
      }
    } catch (error) {
      console.error('❌ Error loading posts for auto-reply:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to load posts for auto-reply selection';
      if (error.message.includes('404')) {
        errorMessage = 'Instagram account not found. Please reconnect your Instagram account.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      }

      setMessage(errorMessage);
    } finally {
      setLoadingAutoReplyPosts(false);
    }
  };

  const handlePostSelection = (postId) => {
    setSelectedAutoReplyPosts(prev => {
      if (prev.includes(postId)) {
        return prev.filter(id => id !== postId);
      } else {
        return [...prev, postId];
      }
    });
  };

  const handlePostTouch = (postId, event) => {
    event.preventDefault();
    handlePostSelection(postId);
  };

  const selectAllPosts = () => {
    const allPostIds = autoReplyPosts.map(post => post.id);
    setSelectedAutoReplyPosts(allPostIds);
  };

  const deselectAllPosts = () => {
    setSelectedAutoReplyPosts([]);
  };



  const handleSelectPosts = () => {
    setIsSelectingPosts(true);
    // Load posts when entering selection mode
    if (autoReplyPosts.length === 0) {
      loadPostsForAutoReply();
    }
  };

  const handleDoneSelecting = () => {
    setIsSelectingPosts(false);
  };

  const handleAutoReplyToggle = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first');
      return;
    }

    // Check if posts are available when enabling
    if (!autoReplyEnabled && autoReplyPosts.length === 0) {
      setMessage('No posts available for auto-reply. Please create some posts first.');
      return;
    }

    // If enabling auto-reply without selected posts, auto-select all posts
    if (!autoReplyEnabled && selectedAutoReplyPosts.length === 0) {
      const allPostIds = autoReplyPosts.map(post => post.id);
      setSelectedAutoReplyPosts(allPostIds);
      console.log('Auto-selecting all posts for auto-reply:', allPostIds);
    }

    // Add mobile-friendly confirmation for enabling auto-reply
    if (!autoReplyEnabled) {
      const isMobile = window.innerWidth <= 768;
      const postCount = selectedAutoReplyPosts.length > 0 ? selectedAutoReplyPosts.length : autoReplyPosts.length;
      const confirmMessage = isMobile
        ? `Enable auto-reply for ${postCount} post(s)?`
        : `Enable auto-reply for ${postCount} post(s)? AI will automatically reply to comments mentioning the commenter.`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setAutoReplyLoading(true);
    try {
      console.log('🔄 Toggling auto-reply for Instagram account:', selectedAccount.platform_user_id, selectedAccount.username);
      console.log('📝 Selected post IDs:', selectedAutoReplyPosts);
      console.log('🎯 New state will be:', !autoReplyEnabled);

      const response = await apiClient.toggleInstagramAutoReply(
        selectedAccount.platform_user_id,
        !autoReplyEnabled,
        autoReplyTemplate,
        selectedAutoReplyPosts
      );

      console.log('📡 Backend response:', response);

      if (response.success) {
        setAutoReplyEnabled(!autoReplyEnabled);

        const successMessage = !autoReplyEnabled
          ? isMobile()
            ? `Auto-reply enabled for ${response.data?.selected_posts_count || selectedAutoReplyPosts.length} post(s)!`
            : `Auto-reply enabled successfully for ${response.data?.selected_posts_count || selectedAutoReplyPosts.length} post(s)! AI will automatically reply to comments mentioning the commenter.`
          : 'Auto-reply disabled successfully.';

        setMessage(successMessage);

        console.log('✅ Auto-reply toggled successfully:', {
          enabled: !autoReplyEnabled,
          selectedPostsCount: response.data?.selected_posts_count
        });
      } else {
        throw new Error(response.error || 'Failed to toggle auto-reply');
      }
    } catch (error) {
      console.error('❌ Auto-reply toggle error:', error);
      setMessage('Error toggling auto-reply: ' + (error.message || 'Unknown error'));
    } finally {
      setAutoReplyLoading(false);
    }
  };

  // Load auto-reply settings when account is selected
  useEffect(() => {
    console.log('🔍 DEBUG: Auto-reply useEffect triggered');
    console.log('🔍 DEBUG: selectedAccount:', selectedAccount);
    console.log('🔍 DEBUG: activeTab:', activeTab);
    if (selectedAccount && activeTab === 'auto-reply') {
      console.log('🔍 DEBUG: Loading auto-reply settings');
      loadAutoReplySettings();
    }
  }, [selectedAccount, activeTab]);

  // Persist auto-reply state on page refresh
  useEffect(() => {
    if (selectedAccount && autoReplyEnabled) {
      // Re-validate auto-reply state with backend
      const validateAutoReplyState = async () => {
        try {
          const rules = await apiClient.getAutomationRules('instagram', 'auto_reply');
          const socialAccounts = await apiClient.getSocialAccounts();
          const instagramAccount = socialAccounts.find(acc =>
            acc.platform === 'instagram' && acc.platform_user_id === selectedAccount.platform_user_id
          );

          if (instagramAccount) {
            const existingRule = rules.find(rule =>
              rule.social_account_id === instagramAccount.id &&
              rule.rule_type === 'AUTO_REPLY'
            );

            if (!existingRule || !existingRule.is_active) {
              setAutoReplyEnabled(false);
              setSelectedAutoReplyPosts([]);
            }
          }
        } catch (error) {
          console.error('Error validating auto-reply state:', error);
        }
      };

      validateAutoReplyState();
    }
  }, [selectedAccount, autoReplyEnabled]);

  // Load user media when account is selected
  useEffect(() => {
    if (selectedAccount && activeTab === 'post') {
      loadUserMedia(selectedAccount.platform_user_id);
    }
  }, [selectedAccount, activeTab]);

  // Load DM auto-reply settings when account is selected
  useEffect(() => {
    if (selectedAccount && activeTab === 'auto-reply') {
      loadDmAutoReplySettings();
    }
  }, [selectedAccount, activeTab]);

  // Add a useEffect to always load DM auto-reply settings when selectedAccount changes
  useEffect(() => {
    if (selectedAccount) {
      loadDmAutoReplySettings();
    }
  }, [selectedAccount]);

  // --- New: Scheduled Posts Grid State ---
  const [scheduledGridRows, setScheduledGridRows] = useState([]);

  // Show grid if redirected with scheduled posts
  useEffect(() => {
    if (location.state && location.state.scheduledGridRows) {
      setScheduledGridRows(location.state.scheduledGridRows);
    }
  }, [location.state]);

  // --- Auto-refresh scheduled posts grid ---
  useEffect(() => {
    let intervalId;
    const fetchScheduledPosts = async () => {
      try {
        const posts = await apiClient.getScheduledPosts();
        setScheduledGridRows(posts.filter(post => post.platform === 'instagram'));
      } catch (err) { }
    };
    fetchScheduledPosts(); // Always fetch on mount
    intervalId = setInterval(fetchScheduledPosts, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // --- UI Render ---
  if (authLoading) {
    return <div className="instagram-container"><div className="loading-screen"><div className="loading-spinner"></div><p>Checking authentication...</p></div></div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="instagram-container">
        <div className="header-section">
          <button onClick={() => navigate('/')} className="back-button">Back to Dashboard</button>
          <h1 style="position: left">Instagram Management</h1>
          <p>Please log in to your account to connect and manage Instagram.</p>
        </div>
        <div className="auth-required">
          <div className="auth-icon"></div>
          <h2>Authentication Required</h2>
          <p>You need to be logged in to use Instagram features. Please log in first.</p>
        </div>
      </div>
    );
  }
  if (!sdkLoaded) {
    return <div className="instagram-container"><div className="loading-screen"><div className="loading-spinner"></div><p>Loading Instagram SDK...</p></div></div>;
  }

  return (
    <div className="instagram-container">
      <div className="header-section">
        <button onClick={() => navigate('/')} className="back-button">Back to Dashboard</button>
        <div className="header-content">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="currentColor" strokeWidth="2" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="header-text">
            <h1>Instagram Management</h1>
            <p>Connect and manage your Instagram Business accounts</p>
          </div>
        </div>
      </div>

      {/* --- Moved: Global Auto-Reply Section --- */}
      {isConnected && selectedAccount && (
        <div className="global-auto-reply-section" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          padding: '18px 24px', marginBottom: 18, border: '1px solid #eee',
          flexWrap: 'wrap', gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: '#f3f3f3', border: '1px solid #e0e0e0' }}>
              {selectedAccount.profile_picture_url ? (
                <img src={selectedAccount.profile_picture_url} alt={selectedAccount.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#eee' }} />
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>@{selectedAccount.username}</div>
              <div style={{ color: '#888', fontSize: 14 }}>{selectedAccount.name}</div>
              <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
                <span style={{ marginRight: 12 }}>
                  <b>{selectedAccount.followers_count}</b> followers
                </span>
                <span>
                  <b>{selectedAccount.media_count}</b> posts
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="auto-reply-toggle-btn"
              onClick={handleGlobalAutoReplyToggle}
              disabled={globalAutoReplyLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600,
                background: globalAutoReplyEnabled ? '#38c172' : '#e0e0e0',
                color: globalAutoReplyEnabled ? '#fff' : '#444',
                border: 'none', borderRadius: 20, padding: '10px 22px', fontSize: 16,
                cursor: globalAutoReplyLoading ? 'not-allowed' : 'pointer',
                boxShadow: globalAutoReplyEnabled ? '0 2px 8px rgba(56,193,114,0.08)' : 'none',
                transition: 'background 0.2s'
              }}
            >
              <span style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                background: globalAutoReplyEnabled ? '#2ecc40' : '#bbb',
                marginRight: 6, border: globalAutoReplyEnabled ? '2px solid #fff' : '2px solid #ccc',
                boxShadow: globalAutoReplyEnabled ? '0 0 4px #38c172' : 'none',
                verticalAlign: 'middle',
              }} />
              Auto Comment Reply: {globalAutoReplyEnabled ? 'Enabled' : 'Disabled'}
              {globalAutoReplyLoading && (
                <span className="loading-spinner" style={{ marginLeft: 10, width: 18, height: 18, border: '2px solid #fff', borderTop: '2px solid #38c172', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
              )}
            </button>

            {/* --- DM Auto-Reply Toggle Button --- */}
            <button
              className="auto-reply-toggle-btn"
              onClick={handleDmAutoReplyToggle}
              disabled={dmAutoReplyLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600,
                background: dmAutoReplyEnabled ? '#38c172' : '#e0e0e0',
                color: dmAutoReplyEnabled ? '#fff' : '#444',
                border: 'none', borderRadius: 20, padding: '10px 22px', fontSize: 16,
                cursor: dmAutoReplyLoading ? 'not-allowed' : 'pointer',
                boxShadow: dmAutoReplyEnabled ? '0 2px 8px rgba(56,193,114,0.08)' : 'none',
                transition: 'background 0.2s'
              }}
            >
              <span style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                background: dmAutoReplyEnabled ? '#2ecc40' : '#bbb',
                marginRight: 6, border: dmAutoReplyEnabled ? '2px solid #fff' : '2px solid #ccc',
                boxShadow: dmAutoReplyEnabled ? '0 0 4px #38c172' : 'none',
                verticalAlign: 'middle',
              }} />
              Auto DM Reply: {dmAutoReplyEnabled ? 'Enabled' : 'Disabled'}
              {dmAutoReplyLoading && (
                <span className="loading-spinner" style={{ marginLeft: 10, width: 18, height: 18, border: '2px solid #fff', borderTop: '2px solid #38c172', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
              )}
            </button>


          </div>
        </div>
      )}
      {message && <div className="status-message info"><span className="message-text">{message}</span></div>}
      <div className="main-content">
        <div className="tab-navigation">
          <button className={`tab-button ${activeTab === 'connect' ? 'active' : ''}`} onClick={() => setActiveTab('connect')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Connect Account
          </button>
          <button className={`tab-button ${activeTab === 'post' ? 'active' : ''}`} onClick={() => setActiveTab('post')} disabled={!isConnected}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            Create Post
          </button>
          <button className={`tab-button ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')} disabled={!isConnected || !selectedAccount}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
            Media Gallery
          </button>
          <button
            className={`tab-button ${activeTab === 'bulk-composer' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk-composer')}
            disabled={!isConnected || !selectedAccount}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Bulk Composer
          </button>
          <button className={`tab-button ${activeTab === 'scheduled-posts' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled-posts')} disabled={!isConnected || !selectedAccount}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            Scheduled Posts
          </button>
        </div>
        <div className="tab-content">
          {activeTab === 'connect' && (
            <div className="connect-section">
              {!isConnected ? (
                <div className="connection-card">
                  <div className="connection-icon"></div>
                  <h2>Connect Instagram Account</h2>
                  <p>Connect your Instagram Business account through Facebook to start posting and managing content.</p>
                  <button onClick={handleFacebookLogin} disabled={loading} className="connect-main-button">{loading ? 'Connecting...' : 'Connect via Facebook'}</button>
                  <div className="requirements-card">
                    <h3>Requirements</h3>
                    <ul>
                      <li>Instagram Business or Creator account</li>
                      <li>Connected to a Facebook Page</li>
                      <li>Admin access to the Facebook Page</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="connected-accounts">
                  <div className="accounts-header">
                    <h2>Connected Instagram Accounts</h2>
                    <button onClick={handleLogout} className="logout-button">Disconnect</button>
                  </div>
                  <div className="accounts-grid">
                    {instagramAccounts.map(account => (
                      <div key={account.id} className={`account-card ${selectedAccount.id === account.id ? 'selected' : ''}`} onClick={() => setSelectedAccount(account)}>
                        <div className="account-avatar">{account.profile_picture_url ? <img src={account.profile_picture_url} alt={account.username} /> : <div className="avatar-placeholder"></div>}</div>
                        <div className="account-info">
                          <h3>@{account.username}</h3>
                          <p>{account.name}</p>
                          <div className="account-stats"><span>{account.followers_count} followers</span><span>{account.media_count} posts</span></div>
                        </div>
                        {selectedAccount.id === account.id && <div className="selected-indicator"></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'post' && selectedAccount && (
            <div className="post-section">
              <div className="post-type-toggle">
                <button className={postType === 'photo' ? 'active' : ''} onClick={() => setPostType('photo')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                  </svg>
                  Photo
                </button>
                <button className={postType === 'carousel' ? 'active' : ''} onClick={() => setPostType('carousel')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Carousel
                </button>
                <button className={postType === 'reel' ? 'active' : ''} onClick={() => setPostType('reel')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  Reel
                </button>
              </div>
              {/* Photo Post */}
              {postType === 'photo' && (
                <div className="post-card">
                  <div className="form-group">
                    <label>Image Source</label>
                    <div className="image-source-toggle">
                      <button className={imageSource === 'ai' ? 'active' : ''} onClick={() => setImageSource('ai')}>AI</button>
                      <button className={imageSource === 'upload' ? 'active' : ''} onClick={() => setImageSource('upload')}>Upload</button>
                    </div>
                  </div>
                  {imageSource === 'ai' && (
                    <div className="form-group">
                      <label>AI Prompt</label>
                      <textarea
                        value={aiPrompt}
                        onChange={e => {
                          setAiPrompt(e.target.value);
                          // Clear generated content when prompt changes
                          if (aiImageUrl) {
                            setAiImageUrl('');
                          }
                          if (caption && !caption.trim().includes('Check out this amazing image!')) {
                            setCaption('');
                          }
                        }}
                        placeholder="Describe your image..."
                        rows={3}
                        className="post-textarea"
                      />
                      <div className="ai-buttons">
                        <button className="ai-generate-button" onClick={handleGenerateAIImage} disabled={aiGenerating || !aiPrompt.trim() || rateLimitCooldown > 0}>
                          {aiGenerating ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                                <path d="M21 12a9 9 0 11-6.219-8.56" />
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              Generate Image
                            </>
                          )}
                        </button>
                        <button className="ai-generate-button secondary" onClick={handleGenerateImageAndCaption} disabled={aiGenerating || generatingCaption || !aiPrompt.trim() || rateLimitCooldown > 0}>
                          {aiGenerating || generatingCaption ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                                <path d="M21 12a9 9 0 11-6.219-8.56" />
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14,2 14,8 20,8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                              Generate Image & Caption
                            </>
                          )}
                        </button>
                        {message && message.includes('Error') && aiPrompt.trim() && (
                          <button className="ai-generate-button retry" onClick={handleRetryImageGeneration} disabled={aiGenerating || rateLimitCooldown > 0}>
                            {aiGenerating ? 'Retrying...' : 'Retry Generation'}
                          </button>
                        )}
                      </div>
                      {rateLimitCooldown > 0 && (
                        <div style={{ color: '#e53e3e', marginTop: 8, fontWeight: 500 }}>
                          Too many requests. Please wait {Math.floor(rateLimitCooldown / 60)}:{(rateLimitCooldown % 60).toString().padStart(2, '0')} before trying again.
                        </div>
                      )}
                    </div>
                  )}
                  {imageSource === 'upload' && (
                    <div className="form-group image-upload">
                      <label>Select Image</label>
                      <button
                        type="button"
                        onClick={() => openFilePicker('photo', 'manual')}
                        className="file-picker-button"
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                              <path d="M21 12a9 9 0 11-6.219-8.56" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7,10 12,15 17,10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Choose Image
                          </>
                        )}
                      </button>
                      {uploadedImageUrl && (
                        <div className="image-preview">
                          <img src={uploadedImageUrl} alt="Preview" className="preview-image" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="form-group">
                    <label>Caption</label>
                    <div className="caption-section">
                      <div className="caption-toggle">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={autoGenerateCaption}
                            onChange={e => setAutoGenerateCaption(e.target.checked)}
                          />
                          <span className="toggle-text">Auto Generate Caption</span>
                        </label>
                      </div>
                      {autoGenerateCaption ? (
                        <div className="caption-prompt-section">
                          <textarea
                            value={captionPrompt}
                            onChange={e => setCaptionPrompt(e.target.value)}
                            placeholder="Describe what you want in the caption..."
                            rows={2}
                            className="caption-prompt-textarea"
                          />
                          <button
                            onClick={handleAutoGenerateCaption}
                            disabled={generatingCaption || !captionPrompt.trim()}
                            className="generate-caption-button"
                          >
                            {generatingCaption ? (
                              <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                                </svg>
                                Generating...
                              </>
                            ) : (
                              <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14,2 14,8 20,8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                Generate Caption
                              </>
                            )}
                          </button>
                        </div>
                      ) : null}
                      <textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder={autoGenerateCaption ? "Caption will be generated..." : "Write your caption..."}
                        rows={3}
                        className="post-textarea"
                        disabled={autoGenerateCaption}
                      />
                    </div>
                  </div>
                  {(aiImageUrl || uploadedImageUrl) && <div className="generated-image"><img src={aiImageUrl || uploadedImageUrl} alt="Preview" /></div>}
                  <button className="publish-button" onClick={handlePublish} disabled={loading || !(aiImageUrl || uploadedImageUrl) || (!caption.trim() && !autoGenerateCaption)}>{loading ? 'Publishing...' : 'Publish Post'}</button>
                </div>
              )}
              {/* Carousel Post */}
              {postType === 'carousel' && (
                <div className="post-card">
                  <div className="form-group">
                    <label>Carousel Mode</label>
                    <div className="image-source-toggle">
                      <button
                        className={imageSource === 'ai' ? 'active' : ''}
                        onClick={() => setImageSource('ai')}
                        disabled={carouselGenerating}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        AI Generation
                      </button>
                      <button
                        className={imageSource === 'upload' ? 'active' : ''}
                        onClick={() => setImageSource('upload')}
                        disabled={carouselGenerating}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7,10 12,15 17,10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Manual Upload
                      </button>
                    </div>
                  </div>

                  {/* Image Count Selector */}
                  <div className="form-group">
                    <label>Number of Images: {carouselCount}</label>
                    <input
                      type="range"
                      min="3"
                      max="7"
                      value={carouselCount}
                      onChange={(e) => setCarouselCount(parseInt(e.target.value))}
                      className="slider"
                      disabled={carouselGenerating}
                    />
                    <div className="slider-labels">
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                      <span>6</span>
                      <span>7</span>
                    </div>
                  </div>

                  {/* AI Generation Mode */}
                  {imageSource === 'ai' && (
                    <div className="form-group">
                      <label>AI Prompt for Carousel</label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe the carousel content you want to generate..."
                        rows="3"
                        className="post-textarea"
                        disabled={carouselGenerating}
                      />
                      <div className="ai-generation-note">
                        <small>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                          Tip: Carousel generation takes 3-5 minutes for {carouselCount} images. Please be patient!
                        </small>
                      </div>
                      <button
                        className="generate-button"
                        onClick={async () => {
                          if (!aiPrompt.trim()) {
                            setMessage('Please enter a prompt for carousel generation.');
                            return;
                          }
                          setCarouselGenerating(true);
                          setMessage(`Generating ${carouselCount} carousel images with AI... This may take 3-5 minutes.`);
                          try {
                            const response = await apiClient.generateInstagramCarousel(aiPrompt.trim(), carouselCount);
                            if (response && response.success && response.image_urls) {
                              setCarouselImages(response.image_urls);
                              setCarouselCaption(response.caption || '');
                              setMessage(`AI carousel generated successfully with ${response.image_urls.length} images!`);
                            } else {
                              setMessage(response.error || 'Failed to generate carousel images.');
                            }
                          } catch (error) {
                            console.error('Carousel generation error:', error);
                            if (error.message && error.message.includes('timeout')) {
                              setMessage('Carousel generation timed out. This can happen with complex prompts or when generating many images. Please try again with a simpler prompt or fewer images.');
                            } else {
                              setMessage('Error generating carousel: ' + (error.message || error.toString()));
                            }
                          } finally {
                            setCarouselGenerating(false);
                          }
                        }}
                        disabled={carouselGenerating || !aiPrompt.trim()}
                      >
                        {carouselGenerating ? (
                          <>
                            <div className="button-spinner"></div>
                            Generating {carouselCount} Images...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            Generate Carousel
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Manual Upload Mode */}
                  {imageSource === 'upload' && (
                    <div className="form-group">
                      <label>Upload Images (JPG/PNG)</label>
                      <button
                        type="button"
                        onClick={() => openFilePicker('photo', 'carousel')}
                        className="file-picker-button"
                        disabled={carouselGenerating}
                      >
                        {carouselGenerating ? (
                          <>
                            <div className="button-spinner"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7,10 12,15 17,10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Select {carouselCount} Images
                          </>
                        )}
                      </button>
                      <p className="file-upload-hint">
                        Select {carouselCount} images for your carousel
                      </p>
                    </div>
                  )}

                  {/* Caption Generation */}
                  <div className="form-group">
                    <label>Caption</label>
                    <div className="caption-section">
                      <div className="caption-toggle">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={autoGenerateCaption}
                            onChange={e => setAutoGenerateCaption(e.target.checked)}
                          />
                          <span className="toggle-text">Auto Generate Caption</span>
                        </label>
                      </div>
                      {autoGenerateCaption ? (
                        <div className="caption-prompt-section">
                          <textarea
                            value={captionPrompt}
                            onChange={e => setCaptionPrompt(e.target.value)}
                            placeholder="Describe what you want in the caption..."
                            rows={2}
                            className="caption-prompt-textarea"
                          />
                          <button
                            onClick={handleCarouselAutoGenerateCaption}
                            disabled={generatingCaption || !captionPrompt.trim()}
                            className="generate-caption-button"
                          >
                            {generatingCaption ? 'Generating...' : 'Generate Caption'}
                          </button>
                        </div>
                      ) : null}
                      <textarea
                        value={carouselCaption}
                        onChange={e => setCarouselCaption(e.target.value)}
                        placeholder={autoGenerateCaption ? "Caption will be generated..." : "Write your caption..."}
                        rows={3}
                        className="post-textarea"
                        disabled={autoGenerateCaption}
                      />
                    </div>
                  </div>

                  {/* Carousel Preview */}
                  {carouselImages.length > 0 && (
                    <div className="carousel-preview-section">
                      <h4>Carousel Preview <span className="drag-hint">(Drag to reorder)</span></h4>
                      <div className="carousel-preview-grid">
                        {carouselImages.slice(0, carouselCount).map((url, index) => (
                          <div
                            key={index}
                            className={`carousel-preview-item ${draggedIndex === index ? 'dragging' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                          >
                            <img src={url} alt={`Carousel item ${index + 1}`} />
                            <span className="carousel-item-number">{index + 1}</span>
                            <div className="drag-handle">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="9" cy="12" r="1" />
                                <circle cx="9" cy="5" r="1" />
                                <circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="12" r="1" />
                                <circle cx="15" cy="5" r="1" />
                                <circle cx="15" cy="19" r="1" />
                              </svg>
                            </div>
                            {carouselImages.length > 3 && (
                              <button
                                className="remove-image-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCarouselImage(index);
                                }}
                                title="Remove image"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="publish-button"
                    onClick={async () => {
                      if (!selectedAccount) {
                        setMessage('Please select an Instagram account first.');
                        return;
                      }
                      if (carouselImages.length < 3) {
                        setMessage('Please add at least 3 images for carousel.');
                        return;
                      }
                      if (!carouselCaption.trim() && !autoGenerateCaption) {
                        setMessage('Please write a caption or enable auto-generate caption.');
                        return;
                      }
                      if (autoGenerateCaption && !captionPrompt.trim()) {
                        setMessage('Please provide a prompt for auto-generating caption.');
                        return;
                      }

                      setLoading(true);
                      setMessage('Publishing carousel post...');
                      try {
                        console.log('🔍 DEBUG: Carousel publish - selectedAccount:', selectedAccount);
                        console.log('🔍 DEBUG: Carousel publish - carouselImages:', carouselImages);
                        console.log('🔍 DEBUG: Carousel publish - carouselCount:', carouselCount);

                        const finalCaption = autoGenerateCaption && captionPrompt.trim() ?
                          await (async () => {
                            const res = await apiClient.generateInstagramCaption(captionPrompt.trim());
                            return res.content || carouselCaption || 'Check out this amazing carousel!';
                          })() : carouselCaption;

                        console.log('🔍 DEBUG: Carousel publish - finalCaption:', finalCaption);

                        const response = await apiClient.postInstagramCarousel(
                          selectedAccount.platform_user_id,
                          finalCaption,
                          carouselImages.slice(0, carouselCount)
                        );

                        if (response.success) {
                          setMessage('Carousel post published successfully!');
                          setCarouselImages([]);
                          setCarouselCaption('');
                          setCaptionPrompt('');
                          setAutoGenerateCaption(false);
                          setAiPrompt('');
                          loadUserMedia(selectedAccount.platform_user_id);
                        } else {
                          setMessage('Failed to publish carousel: ' + (response.error || 'Unknown error'));
                        }
                      } catch (err) {
                        setMessage('Error publishing carousel: ' + (err.message || err.toString()));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || carouselImages.length < 3 || (!carouselCaption.trim() && !autoGenerateCaption)}
                  >
                    {loading ? 'Publishing...' : 'Publish Carousel'}
                  </button>
                </div>
              )}
              {/* Reel Post */}
              {postType === 'reel' && (
                <div className="post-card">
                  <div className="form-group">
                    <label>Upload Reel Video (.mp4, .mov)</label>
                    <div className="file-input-wrapper">
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,.mp4,.mov"
                        onChange={handleReelFileChange}
                        disabled={reelUploading}
                        id="reel-video-input"
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="reel-video-input"
                        className="file-picker-button"
                        style={{ opacity: reelUploading ? 0.6 : 1, cursor: reelUploading ? 'not-allowed' : 'pointer' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7,10 12,15 17,10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {reelUploading ? 'Uploading...' : 'Choose Video File'}
                      </label>
                    </div>
                    {reelUrl && (
                      <div className="video-preview">
                        <video src={reelUrl} controls style={{ width: '100%', maxHeight: '300px' }} />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Upload Reel Thumbnail (optional):</label>
                    <div className="file-input-wrapper">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleReelThumbnailChange}
                        disabled={!reelUrl}
                        id="reel-thumbnail-input"
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="reel-thumbnail-input"
                        className="file-picker-button"
                        style={{ opacity: !reelUrl ? 0.6 : 1, cursor: !reelUrl ? 'not-allowed' : 'pointer' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21,15 16,10 5,21" />
                        </svg>
                        Choose Thumbnail
                      </label>
                    </div>
                    {reelThumbnailUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <img
                          src={reelThumbnailUrl}
                          alt="Reel Thumbnail Preview"
                          style={{ maxWidth: 120, borderRadius: 8, border: '1px solid #eee' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setReelThumbnailUrl('');
                            setReelThumbnailFilename('');
                            setReelThumbnailFile(null);
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e53e3e',
                            cursor: 'pointer',
                            color: '#e53e3e',
                            fontSize: 18,
                            borderRadius: '4px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove thumbnail"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Caption</label>
                    <div className="caption-section">
                      <div className="caption-toggle">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={reelAutoGenerateCaption}
                            onChange={e => setReelAutoGenerateCaption(e.target.checked)}
                          />
                          <span className="toggle-text">Auto Generate Caption</span>
                        </label>
                      </div>
                      {reelAutoGenerateCaption ? (
                        <div className="caption-prompt-section">
                          <textarea
                            value={reelCaptionPrompt}
                            onChange={e => setReelCaptionPrompt(e.target.value)}
                            placeholder="Describe what you want in the caption..."
                            rows={2}
                            className="caption-prompt-textarea"
                          />
                          <button
                            onClick={handleReelAutoGenerateCaption}
                            disabled={generatingReelCaption || !reelCaptionPrompt.trim()}
                            className="generate-caption-button"
                          >
                            {generatingReelCaption ? 'Generating...' : 'Generate Caption'}
                          </button>
                        </div>
                      ) : null}
                      <textarea
                        value={reelCaption}
                        onChange={e => setReelCaption(e.target.value)}
                        placeholder={reelAutoGenerateCaption ? "Caption will be generated..." : "Write your caption..."}
                        rows={3}
                        className="post-textarea"
                        disabled={reelAutoGenerateCaption}
                      />
                    </div>
                  </div>
                  <button className="publish-button" onClick={handlePublish} disabled={loading || !reelUrl || (!reelCaption.trim() && !reelAutoGenerateCaption)}>{loading ? 'Publishing...' : 'Publish Reel'}</button>
                </div>
              )}
            </div>
          )}
          {activeTab === 'media' && selectedAccount && (
            <div className="media-section">
              <div className="media-header"><h2>Recent Posts</h2><p>Your latest Instagram content</p></div>
              {loadingMedia ? <div className="loading-media"><div className="loading-spinner"></div><p>Loading media...</p></div> : userMedia.length > 0 ? <div className="media-grid">{userMedia.slice(0, 12).map((media) => <div key={media.id} className="media-item"><div className="media-content">{media.media_type === 'IMAGE' ? <img src={media.media_url} alt="Instagram post" /> : media.media_type === 'VIDEO' ? <video controls><source src={media.media_url} type="video/mp4" /></video> : null}</div><div className="media-overlay"><div className="media-info"><p className="media-caption">{media.caption ? media.caption.substring(0, 100) + '...' : 'No caption'}</p><p className="media-date">{new Date(media.timestamp).toLocaleDateString()}</p></div></div></div>)}</div> : <div className="no-media"><h3>No Media Found</h3><p>No media found for this account. Start creating posts to see them here!</p></div>}
            </div>
          )}
          {activeTab === 'bulk-composer' && selectedAccount && (
            <IgBulkComposer selectedAccount={selectedAccount} onClose={() => { }} />
          )}
          {activeTab === 'scheduled-posts' && (
            <ScheduledPostHistory />
          )}
        </div>
      </div>

      {/* Google Drive Modal */}
      {showDriveModal && (
        <div className="modal-overlay" onClick={() => setShowDriveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select from Google Drive</h3>
              <button onClick={() => setShowDriveModal(false)} className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              {!driveAuthenticated ? (
                <div className="drive-auth">
                  <p>Connect to Google Drive to select files</p>
                  <button onClick={authenticateGoogleDrive} disabled={driveAuthLoading} className="auth-button">
                    {driveAuthLoading ? 'Connecting...' : 'Connect Google Drive'}
                  </button>
                </div>
              ) : (
                <div className="drive-files">
                  {loadingDriveFiles ? (
                    <div className="loading-files">
                      <div className="loading-spinner"></div>
                      <p>Loading files...</p>
                    </div>
                  ) : driveFiles.length > 0 ? (
                    <div className="files-grid">
                      {driveFiles.map((file) => (
                        <div key={file.id} className="file-item" onClick={() => handleDriveFileSelect(file.id, file.name)}>
                          {file.thumbnailLink ? (
                            <img src={file.thumbnailLink} alt={file.name} className="file-thumbnail" />
                          ) : (
                            <div className="file-icon"></div>
                          )}
                          <div className="file-info">
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">{file.size ? `${Math.round(file.size / 1024)} KB` : 'Unknown size'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-files">
                      <p>No image files found in Google Drive</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="modal-overlay" onClick={closeFilePicker}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select {filePickerType === 'photo' ? 'Photo' : 'Video'}</h3>
              <button onClick={closeFilePicker} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="file-picker-options">
                <div
                  className="file-option"
                  onClick={() => document.getElementById('local-file-input').click()}
                  onTouchStart={(e) => e.preventDefault()}
                >
                  <div className="file-option-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div className="file-option-content">
                    <h4>From Device</h4>
                    <p>Select a file from your computer</p>
                  </div>
                </div>

                <div
                  className={`file-option ${!googleDriveAvailable ? 'disabled' : ''}`}
                  onClick={handleGoogleDriveSelect}
                  onTouchStart={(e) => {
                    if (!googleDriveAvailable) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    handleGoogleDriveSelect();
                  }}
                >
                  <div className="file-option-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="file-option-content">
                    <h4>From Google Drive</h4>
                    <p>
                      {googleDriveAvailable
                        ? 'Select a file from your Google Drive'
                        : 'Google Drive not configured. See setup guide.'
                      }
                    </p>
                    {isLoadingGoogleDrive && (
                      <div className="loading-indicator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                        Loading...
                      </div>
                    )}
                    {!googleDriveAvailable && (
                      <div className="unavailable-indicator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hidden file input for local file selection */}
              <input
                id="local-file-input"
                type="file"
                accept={filePickerType === 'photo' ? 'image/*' : 'video/*'}
                multiple={filePickerFormType === 'carousel'}
                onChange={handleLocalFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {globalAutoReplyEnabled && globalAutoReplyProgress && (
        <div className="auto-reply-progress" style={{ margin: '16px 0', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
          <p><strong>Auto-Reply Progress:</strong> {globalAutoReplyProgress.status}</p>
          {globalAutoReplyProgress.status === 'processing' && (
            <p>Processing post {globalAutoReplyProgress.current_post} of {globalAutoReplyProgress.total_posts}, comment {globalAutoReplyProgress.current_comment} of {globalAutoReplyProgress.total_comments}</p>
          )}
          {globalAutoReplyProgress.status === 'done' && <p>All comments processed!</p>}
          {globalAutoReplyProgress.details && <p>{globalAutoReplyProgress.details}</p>}
        </div>
      )}
      {apiError && (
        <div className="api-error" style={{ color: 'red', margin: '12px 0' }}>
          <p>Error: {apiError}</p>
          <button onClick={() => { setApiError(null); setRetrying(true); setTimeout(() => { setRetrying(false); window.location.reload(); }, 500); }}>Retry</button>
          {retrying && <span>Retrying...</span>}
        </div>
      )}
    </div>
  );
};

export default InstagramPage; 