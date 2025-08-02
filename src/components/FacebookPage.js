import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import BulkComposer from './BulkComposer';
import AIGenerateTab from './AIGenerateTab';
import ManualPostTab from './ManualPostTab';
import AutomateTab from './AutomateTab';
import { loadFacebookSDK, fileToBase64 } from '../services/facebookService';
import './FacebookPage.css';

function FacebookPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Core state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [availablePages, setAvailablePages] = useState([]);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('auto');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Form states
  const [autoFormData, setAutoFormData] = useState({
    prompt: '',
    mediaType: 'none',
    mediaFile: null,
    generatedContent: '',
    isGenerating: false,
    imagePrompt: '',
    generatedImageUrl: null,
    generatedImageFilename: null,
    isGeneratingImage: false
  });

  const [manualFormData, setManualFormData] = useState({
    message: '',
    mediaType: 'none',
    mediaFile: null
  });

  // UI states
  const [isPublishing, setIsPublishing] = useState(false);
  const [autoPostHistory, setAutoPostHistory] = useState([]);
  const [manualPostHistory, setManualPostHistory] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const [showBulkComposer, setShowBulkComposer] = useState(false);
  const [showAutomate, setShowAutomate] = useState(false);
  const [autoReplyMessagesEnabled, setAutoReplyMessagesEnabled] = useState(true);
  const [autoReplyMessagesLoading, setAutoReplyMessagesLoading] = useState(false);
  const [autoReplyMessagesError, setAutoReplyMessagesError] = useState(null);

  // File picker modal states (currently unused but kept for future functionality)
  // const [showFilePicker, setShowFilePicker] = useState(false);
  // const [filePickerType, setFilePickerType] = useState('');
  // const [filePickerFormType, setFilePickerFormType] = useState('');
  // const [isLoadingGoogleDrive, setIsLoadingGoogleDrive] = useState(false);
  // const [googleDriveAvailable, setGoogleDriveAvailable] = useState(false);

  // Schedule and automation states
  const [scheduleData, setScheduleData] = useState({
    prompt: '',
    time: '',
    frequency: 'daily',
    customDate: '',
    isActive: false,
    scheduleId: null
  });

  const [autoReplyMessageRule, setAutoReplyMessageRule] = useState(null);
  const [autoReplySettings, setAutoReplySettings] = useState({
    enabled: false,
    template: 'Thank you for your comment! We appreciate your engagement. 😊',
    ruleId: null,
    selectedPostIds: []
  });

  const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || '697225659875731';
  
  // Validate Facebook App ID
  useEffect(() => {
    if (!FACEBOOK_APP_ID || FACEBOOK_APP_ID === 'your_app_id_here') {
      console.warn('⚠️ Facebook App ID not configured properly. Please set REACT_APP_FACEBOOK_APP_ID in your environment variables.');
    } else {
      console.log('✅ Facebook App ID configured:', FACEBOOK_APP_ID);
    }
  }, [FACEBOOK_APP_ID]);

  // Mobile detection utility
  const isMobile = () => window.innerWidth <= 768;

  const loadAutoReplySettings = useCallback(async () => {
    if (!selectedPage) return;

    try {
      console.log('🔄 Loading auto-reply settings for page:', selectedPage.id, selectedPage.name);

      const rules = await apiClient.getAutomationRules('facebook', 'AUTO_REPLY');
      console.log('📋 Found automation rules:', rules);

      const socialAccounts = await apiClient.getSocialAccounts();
      const facebookAccounts = socialAccounts.filter(acc =>
        acc.platform === 'facebook' && acc.is_connected
      );
      console.log('� Faceboouk accounts:', facebookAccounts);

      const matchingAccount = facebookAccounts.find(acc =>
        acc.platform_user_id === selectedPage.id
      );
      console.log('🎯 Matching account:', matchingAccount);

      if (matchingAccount) {
        const autoReplyRule = rules.find(rule =>
          rule.social_account_id === matchingAccount.id
        );
        console.log('🤖 Auto-reply rule found:', autoReplyRule);

        if (autoReplyRule) {
          setAutoReplySettings(prev => ({
            ...prev,
            enabled: autoReplyRule.is_active,
            template: autoReplyRule.actions?.response_template || prev.template,
            ruleId: autoReplyRule.id,
            selectedPostIds: autoReplyRule.actions?.selected_post_ids || []
          }));
          console.log('✅ Auto-reply settings loaded:', {
            enabled: autoReplyRule.is_active,
            template: autoReplyRule.actions?.response_template,
            ruleId: autoReplyRule.id,
            selectedPostIds: autoReplyRule.actions?.selected_post_ids
          });
        } else {
          setAutoReplySettings(prev => ({
            ...prev,
            enabled: false,
            template: 'Thank you for your comment! We appreciate your engagement. 😊',
            ruleId: null,
            selectedPostIds: []
          }));
          console.log('❌ No auto-reply rule found, using defaults');
        }
      } else {
        setAutoReplySettings(prev => ({
          ...prev,
          enabled: false,
          template: 'Thank you for your comment! We appreciate your engagement. �',
          ruleId: null,
          selectedPostIds: []
        }));
        console.log('❌ No matching account found, using defaults');
      }
    } catch (error) {
      console.error('❌ Error loading auto-reply settings:', error);
    }
  }, [selectedPage]);

  const checkExistingFacebookConnections = useCallback(async () => {
    try {
      setIsCheckingStatus(true);
      const response = await apiClient.getFacebookStatus();

      if (response.connected) {
        setFacebookConnected(true);

        let socialAccounts = [];
        let facebookAccounts = [];

        try {
          socialAccounts = await apiClient.getSocialAccounts();
          facebookAccounts = socialAccounts.filter(acc =>
            acc.platform === 'facebook' && acc.is_connected
          );
        } catch (accountsError) {
          console.warn('Failed to fetch social accounts:', accountsError);
        }

        const pagesFromBackend = response.accounts.pages.map(page => {
          const matchingAccount = facebookAccounts.find(acc =>
            acc.platform_user_id === page.platform_id
          );

          return {
            id: page.platform_id,
            internalId: matchingAccount?.id,
            name: page.name,
            category: page.category,
            access_token: '',
            profilePicture: page.profile_picture || '',
            canPost: page.can_post,
            canComment: page.can_comment,
            followerCount: page.follower_count
          };
        });

        setAvailablePages(pagesFromBackend);

        if (pagesFromBackend.length === 1) {
          setSelectedPage(pagesFromBackend[0]);
        }

        setConnectionStatus(`Connected! ${response.pages_count} Facebook page(s) available.`);
      } else {
        setConnectionStatus('Ready to connect your Facebook account');
      }
    } catch (error) {
      console.error('Error checking Facebook status:', error);
      setConnectionStatus('Unable to check Facebook connection status');
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  // Check for existing Facebook connections on component mount
  useEffect(() => {
    checkExistingFacebookConnections();
    checkGoogleDriveAvailability();

    const handleResize = () => {
      setConnectionStatus(prev => prev);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkExistingFacebookConnections]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      setIsConnecting(false);
      setIsPublishing(false);
      setIsLoggingOut(false);
      setIsCheckingStatus(false);
    };
  }, []);

  const checkGoogleDriveAvailability = async () => {
    try {
      const { authenticated } = await apiClient.getGoogleDriveStatus();
      // setGoogleDriveAvailable(authenticated); // Commented out as not currently used
    } catch (error) {
      console.warn('Drive status check failed:', error.message);
      // setGoogleDriveAvailable(false); // Commented out as not currently used
    }
  };

  const loadPostHistory = useCallback(async () => {
    if (!selectedPage) return;
    try {
      setIsLoadingPosts(true);
      const response = await apiClient.getSocialPosts('facebook', 50, selectedPage.internalId);
      const posts = response
        .slice(0, 50)
        .sort((a, b) => new Date(b.created_at || b.next_execution) - new Date(a.created_at || a.next_execution));
      
      // Filter posts based on their actual type/source
      const aiPosts = posts.filter(post => 
        post.post_type === 'ai_generated' || 
        post.generation_method === 'ai' || 
        post.content_source === 'ai' ||
        (post.metadata && post.metadata.generated_by_ai)
      ).slice(0, 10);
      
      const manualPosts = posts.filter(post => 
        post.post_type === 'manual' || 
        post.generation_method === 'manual' || 
        post.content_source === 'manual' ||
        (!post.post_type && !post.generation_method && !post.content_source)
      ).slice(0, 10);
      
      // If we can't determine the type, show all posts in both sections for now
      if (aiPosts.length === 0 && manualPosts.length === 0 && posts.length > 0) {
        setAutoPostHistory(posts.slice(0, 10));
        setManualPostHistory(posts.slice(0, 10));
      } else {
        setAutoPostHistory(aiPosts);
        setManualPostHistory(manualPosts);
      }
      
      // Debug logging
      console.log('📊 Post History Loaded:', {
        totalPosts: posts.length,
        aiPosts: aiPosts.length,
        manualPosts: manualPosts.length,
        samplePost: posts[0]
      });
    } catch (error) {
      console.error('Error loading post history:', error);
      // Set empty arrays on error
      setAutoPostHistory([]);
      setManualPostHistory([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [selectedPage]);

  // Load posts when page is selected or tab changes
  useEffect(() => {
    if (selectedPage && facebookConnected) {
      loadPostHistory();
      loadAutoReplySettings();
    }
  }, [selectedPage, facebookConnected, activeTab, loadPostHistory, loadAutoReplySettings]);

  const handleFacebookLogout = async () => {
    try {
      const safeScheduleData = scheduleData || {};

      if (selectedPage && safeScheduleData.isActive) {
        const confirmDisconnect = window.confirm(
          `⚠️ Warning: You have an active schedule for "${selectedPage.name}". Disconnecting will deactivate this schedule. Do you want to continue?`
        );

        if (!confirmDisconnect) {
          return;
        }

        try {
          await apiClient.deleteScheduledPost(safeScheduleData.scheduleId);
          console.log('✅ Schedule deactivated before disconnect');
        } catch (scheduleError) {
          console.warn('Failed to deactivate schedule before disconnect:', scheduleError);
        }
      }

      setIsLoggingOut(true);
      setConnectionStatus('Disconnecting from Facebook...');

      await apiClient.logoutFacebook();

      setFacebookConnected(false);
      setAvailablePages([]);
      setSelectedPage(null);
      setAutoPostHistory([]);
      setManualPostHistory([]);

      setScheduleData({
        prompt: '',
        time: '',
        frequency: 'daily',
        customDate: '',
        isActive: false,
        scheduleId: null
      });

      setConnectionStatus('Successfully disconnected from Facebook');

      setTimeout(() => {
        setConnectionStatus('Ready to connect your Facebook account');
      }, 3000);

    } catch (error) {
      console.error('Error logging out from Facebook:', error);
      setConnectionStatus('Failed to disconnect from Facebook: ' + error.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const loginWithFacebook = async () => {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setConnectionStatus('Facebook login requires HTTPS. Please use https://localhost:3001 or deploy with HTTPS');
      return;
    }

    try {
      await apiClient.getCurrentUser();
    } catch (error) {
      setConnectionStatus('Your session has expired. Please log out and log back in to connect Facebook.');
      setTimeout(() => {
        logout();
        navigate('/');
      }, 3000);
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Loading Facebook SDK...');

    try {
      console.log('🔄 Loading Facebook SDK with App ID:', FACEBOOK_APP_ID);
      await loadFacebookSDK(FACEBOOK_APP_ID);

      // Add more thorough checks
      if (!window.FB) {
        throw new Error('Facebook SDK not loaded - window.FB is undefined');
      }
      
      if (typeof window.FB.init !== 'function') {
        throw new Error('Facebook SDK not properly initialized - FB.init is not a function');
      }
      
      if (typeof window.FB.login !== 'function') {
        throw new Error('Facebook SDK login function not available - FB.login is not a function');
      }

      console.log('✅ Facebook SDK loaded successfully');
      setConnectionStatus('Connecting to Facebook...');

      window.FB.login((response) => {
        if (response.authResponse && response.authResponse.accessToken) {
          setConnectionStatus('Facebook login successful! Fetching pages...');

          (async () => {
            try {
              const { mappedPages, userInfo } = await fetchPages(response.authResponse.accessToken);

              if (mappedPages.length > 0) {
                setConnectionStatus('Connecting to backend...');
                const backendResponse = await connectToBackend(response.authResponse.accessToken, userInfo, mappedPages);

                if (backendResponse?.data?.pages) {
                  setAvailablePages(mappedPages);
                  setConnectionStatus(`Connected successfully! ${backendResponse.data.pages_connected} pages synchronized with backend.`);
                }
              } else {
                setConnectionStatus('No pages found in Facebook API. Connecting to backend to check for existing connections...');

                try {
                  await connectToBackend(response.authResponse.accessToken, userInfo, []);

                  const existingAccounts = await apiClient.getSocialAccounts();
                  const facebookPages = existingAccounts.filter(acc =>
                    acc.platform === 'facebook' && acc.account_type === 'page' && acc.is_connected
                  );

                  if (facebookPages.length > 0) {
                    const backendMappedPages = facebookPages.map(page => ({
                      id: page.platform_user_id,
                      internalId: page.id,
                      name: page.display_name,
                      category: page.platform_data?.category || 'Page',
                      access_token: page.access_token || response.authResponse.accessToken,
                      profilePicture: page.profile_picture_url || '',
                      canPost: page.platform_data?.can_post !== false,
                      canComment: page.platform_data?.can_comment !== false,
                      followerCount: page.follower_count || 0
                    }));

                    setAvailablePages(backendMappedPages);
                    setConnectionStatus(`Found ${facebookPages.length} existing page(s) from previous connections!`);
                  } else {
                    setConnectionStatus('No pages found. You may need to grant page permissions or create a Facebook page first.');
                  }
                } catch (backendError) {
                  console.error('[FB.login] Backend check failed:', backendError);
                  setConnectionStatus('No pages found. You may need to grant page permissions or create a Facebook page first.');
                }
              }
            } catch (error) {
              console.error('[FB.login] Error in page fetching or backend connection:', error);
              setConnectionStatus('Error during setup: ' + (error.message || 'Unknown error'));
              setIsConnecting(false);
              setFacebookConnected(false);
            }
          })();
        } else {
          if (response.status === 'not_authorized') {
            setConnectionStatus('Please authorize the app to continue and select at least one page.');
          } else {
            setConnectionStatus('Facebook login cancelled or failed');
          }
          setIsConnecting(false);
        }
      }, {
        scope: [
          'public_profile',
          'pages_show_list',
          'pages_read_engagement',
          'pages_manage_posts',
          'pages_manage_engagement',
          'pages_read_user_content',
          'pages_manage_metadata'
        ].join(','),
        enable_profile_selector: true,
        return_scopes: true,
        auth_type: 'rerequest',
        display: 'popup'
      });
    } catch (error) {
      console.error('Facebook login error:', error);
      setConnectionStatus('Facebook login failed: ' + error.message);
      setIsConnecting(false);
      
      // If it's an SDK loading issue, suggest a refresh
      if (error.message.includes('SDK') || error.message.includes('init')) {
        setTimeout(() => {
          setConnectionStatus('Please refresh the page and try again. If the issue persists, check your internet connection.');
        }, 2000);
      }
    }
  };

  const fetchPages = async (accessToken) => {
    if (!accessToken) {
      setConnectionStatus('No Facebook access token found. Please try reconnecting.');
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }

    try {
      const permissionsResponse = await new Promise((resolve, reject) => {
        window.FB.api('/me/permissions', { access_token: accessToken }, (response) => {
          if (response.error) reject(new Error(response.error.message));
          else resolve(response);
        });
      });

      const grantedPermissions = permissionsResponse.data?.filter(p => p.status === 'granted').map(p => p.permission) || [];
      const requiredPermissions = ['pages_show_list', 'pages_manage_posts'];
      const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));

      if (missingPermissions.length > 0) {
        setConnectionStatus(`Missing permissions: ${missingPermissions.join(', ')}. Your app needs "Pages API" permissions.`);
      }

      const userInfo = await new Promise((resolve, reject) => {
        window.FB.api('/me', { access_token: accessToken, fields: 'id,name,email' }, (response) => {
          if (response.error) reject(new Error(response.error.message));
          else resolve(response);
        });
      });

      const pagesResponse = await new Promise((resolve, reject) => {
        window.FB.api('/me/accounts', {
          access_token: accessToken,
          fields: 'id,name,category,access_token,picture,fan_count,tasks'
        }, (response) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
          } else {
            resolve(response);
          }
        });
      });

      const pages = pagesResponse.data || [];
      const mappedPages = pages.map(page => {
        const tasks = page.tasks || [];
        const canPost = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE');
        const canComment = tasks.includes('MODERATE') || tasks.includes('MANAGE');

        return {
          id: page.id,
          internalId: null,
          name: page.name,
          category: page.category || 'Page',
          access_token: page.access_token,
          profilePicture: page.picture?.data?.url || '',
          canPost: canPost,
          canComment: canComment,
          followerCount: page.fan_count || 0
        };
      });

      setAvailablePages(mappedPages);

      if (mappedPages.length === 1) {
        setSelectedPage(mappedPages[0]);
        setConnectionStatus(`Connected successfully! 1 page found.`);
        setTimeout(() => loadAutoReplySettings(), 500);
      } else if (mappedPages.length > 1) {
        setSelectedPage(null);
        setConnectionStatus(`Connected successfully! ${mappedPages.length} pages found. Please select a page below.`);
      } else {
        setSelectedPage({
          id: userInfo.id,
          internalId: null,
          name: userInfo.name,
          access_token: accessToken,
          category: 'Personal Profile',
          profilePicture: '',
          canPost: true,
          canComment: true,
          followerCount: 0
        });
        setConnectionStatus('Connected as personal profile (no pages found).');
        setTimeout(() => loadAutoReplySettings(), 500);
      }
      setFacebookConnected(true);
      setIsConnecting(false);
      return { mappedPages, userInfo };
    } catch (error) {
      console.error('Facebook API error:', error);
      setConnectionStatus('Failed to get Facebook data: ' + (error.message || 'Unknown error'));
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }
  };

  const connectToBackend = async (accessToken, userInfo, pages) => {
    try {
      const response = await apiClient.connectFacebook(accessToken, userInfo.id, pages);

      if (response.data?.data?.token_type === 'long_lived_user_token') {
        const expiresAt = response.data.data.token_expires_at;
        if (expiresAt) {
          const expiryDate = new Date(expiresAt);
          setConnectionStatus(`Connected with long-lived token (expires: ${expiryDate.toLocaleDateString()})`);
        } else {
          setConnectionStatus('Connected with long-lived token');
        }
      }

      setTimeout(async () => {
        try {
          const socialAccounts = await apiClient.getSocialAccounts();
          const facebookAccounts = socialAccounts.filter(acc =>
            acc.platform === 'facebook' && acc.is_connected
          );

          const updatedPages = availablePages.map(page => {
            const matchingAccount = facebookAccounts.find(acc =>
              acc.platform_user_id === page.id
            );
            return {
              ...page,
              internalId: matchingAccount?.id
            };
          });

          setAvailablePages(updatedPages);

          if (selectedPage) {
            const matchingAccount = facebookAccounts.find(acc =>
              acc.platform_user_id === selectedPage.id
            );
            if (matchingAccount) {
              setSelectedPage(prev => ({
                ...prev,
                internalId: matchingAccount.id
              }));
            }
          }
        } catch (error) {
          console.error('Error updating page data with internal IDs:', error);
          setConnectionStatus('Warning: Unable to get account details. You may need to reconnect Facebook for scheduling to work.');
        }
      }, 2000);

      return response;
    } catch (error) {
      console.error('Backend connection error:', error);

      if (error.response?.status === 401) {
        setConnectionStatus('Your session has expired. Please log out and log back in to connect Facebook.');
        setTimeout(() => {
          logout();
          navigate('/');
        }, 3000);
      } else if (error.response?.data?.detail?.includes('long-lived token')) {
        setConnectionStatus('Failed to get long-lived Facebook token. Please try reconnecting.');
      } else {
        setConnectionStatus('Failed to connect to backend: ' + (error.response?.data?.detail || error.message));
      }

      throw error;
    }
  };

  const handleAutoInputChange = (e) => {
    const { name, value, files } = e.target;
    setAutoFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleManualInputChange = (e) => {
    const { name, value, files } = e.target;
    setManualFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleMediaTypeChange = (type, formType) => {
    if (type === 'photo' || type === 'video') {
      openFilePicker(type, formType);
      return;
    }

    if (formType === 'auto') {
      setAutoFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null,
        generatedImageUrl: type === 'ai_image' ? prev.generatedImageUrl : null,
        generatedImageFilename: type === 'ai_image' ? prev.generatedImageFilename : null,
        imagePrompt: type === 'ai_image' ? prev.imagePrompt : ''
      }));
    } else {
      setManualFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null,
        generatedImageUrl: type === 'ai_image' ? prev.generatedImageUrl : null,
        generatedImageFilename: type === 'ai_image' ? prev.generatedImageFilename : null,
        imagePrompt: type === 'ai_image' ? prev.imagePrompt : ''
      }));
    }
  };

  const openFilePicker = (type, formType) => {
    // File picker functionality to be implemented
    console.log('File picker requested:', type, formType);
    // setFilePickerType(type);
    // setFilePickerFormType(formType);
    // setShowFilePicker(true);
  };

  const generatePostContent = async () => {
    if (!autoFormData.prompt.trim()) {
      setConnectionStatus('Please enter a prompt for AI generation');
      return;
    }

    setAutoFormData(prev => ({ ...prev, isGenerating: true }));
    setConnectionStatus('Generating content with AI...');

    try {
      const response = await apiClient.generateContent(autoFormData.prompt);
      setAutoFormData(prev => ({
        ...prev,
        generatedContent: response.content,
        isGenerating: false
      }));
      setConnectionStatus('Content generated successfully!');
    } catch (error) {
      console.error('Content generation error:', error);
      setConnectionStatus('Failed to generate content: ' + (error.message || 'Unknown error'));
      setAutoFormData(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const generateImage = async (formType) => {
    const currentData = formType === 'auto' ? autoFormData : manualFormData;
    const setFormData = formType === 'auto' ? setAutoFormData : setManualFormData;

    const imagePrompt = currentData.imagePrompt || currentData.prompt || (formType === 'manual' ? currentData.message : '');

    if (!imagePrompt.trim()) {
      setConnectionStatus('Please enter an image prompt or description');
      return;
    }

    setFormData(prev => ({ ...prev, isGeneratingImage: true }));
    setConnectionStatus('Generating image with AI...');

    try {
      const response = await apiClient.generateFacebookImage(imagePrompt, 'feed');

      if (response.success) {
        setFormData(prev => ({
          ...prev,
          generatedImageUrl: response.data.image_url,
          generatedImageFilename: response.data.filename,
          isGeneratingImage: false
        }));
        setConnectionStatus('Image generated successfully!');
      } else {
        throw new Error(response.error || 'Image generation failed');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      setConnectionStatus('Failed to generate image: ' + (error.message || 'Unknown error'));
      setFormData(prev => ({ ...prev, isGeneratingImage: false }));
    }
  };

  const generateImageWithCaption = async () => {
    if (!autoFormData.prompt.trim()) {
      setConnectionStatus('Please enter a prompt for generation');
      return;
    }

    setAutoFormData(prev => ({ ...prev, isGenerating: true, isGeneratingImage: true }));
    setConnectionStatus('Generating image and caption with AI...');

    try {
      const textResponse = await apiClient.generateContent(autoFormData.prompt);

      if (!textResponse.content) {
        throw new Error('Failed to generate text content');
      }

      const imagePrompt = autoFormData.imagePrompt || autoFormData.prompt;
      const imageResponse = await apiClient.generateFacebookImage(imagePrompt, 'feed');

      if (!imageResponse.success) {
        throw new Error(imageResponse.error || 'Image generation failed');
      }

      setAutoFormData(prev => ({
        ...prev,
        generatedContent: textResponse.content,
        generatedImageUrl: imageResponse.data.image_url,
        generatedImageFilename: imageResponse.data.filename,
        isGenerating: false,
        isGeneratingImage: false
      }));

      setConnectionStatus('Image and caption generated successfully!');
    } catch (error) {
      console.error('Image with caption generation error:', error);
      setConnectionStatus('Failed to generate image and caption: ' + (error.message || 'Unknown error'));
      setAutoFormData(prev => ({ ...prev, isGenerating: false, isGeneratingImage: false }));
    }
  };

  const publishPost = async () => {
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    const isAutoMode = activeTab === 'auto';
    const content = isAutoMode ? autoFormData.generatedContent : manualFormData.message;
    const mediaType = isAutoMode ? autoFormData.mediaType : manualFormData.mediaType;
    const mediaFile = isAutoMode ? autoFormData.mediaFile : manualFormData.mediaFile;
    const generatedImageUrl = isAutoMode ? autoFormData.generatedImageUrl : manualFormData.generatedImageUrl;
    const generatedImageFilename = isAutoMode ? autoFormData.generatedImageFilename : manualFormData.generatedImageFilename;

    if (!content || content.trim() === '') {
      if (mediaType !== 'video') {
        setConnectionStatus('Please enter some content for your post');
        return;
      }
    }

    if (mediaType === 'photo' && !mediaFile) {
      setConnectionStatus('Please select a media file to upload');
      return;
    }

    if (mediaType === 'video' && !mediaFile) {
      setConnectionStatus('Please select a video file to upload');
      return;
    }

    if (mediaType === 'ai_image' && (!generatedImageUrl || !generatedImageFilename)) {
      setConnectionStatus('Please generate an image first');
      return;
    }

    try {
      setIsPublishing(true);
      setConnectionStatus('Publishing post to Facebook...');

      const postOptions = {
        postType: 'feed'
      };

      if (isAutoMode) {
        if (autoFormData.generatedContent) {
          postOptions.textContent = autoFormData.generatedContent;
        } else if (autoFormData.prompt) {
          postOptions.contentPrompt = autoFormData.prompt;
          postOptions.useAIText = true;
        } else {
          postOptions.textContent = content;
        }
      } else {
        if (content && content.trim()) {
          postOptions.textContent = content;
        }
      }

      if (mediaType === 'ai_image' && generatedImageUrl && generatedImageFilename) {
        postOptions.imageUrl = generatedImageUrl;
        postOptions.imageFilename = generatedImageFilename;
      } else if (mediaType === 'ai_image' && (autoFormData.imagePrompt || manualFormData.imagePrompt)) {
        const imagePrompt = isAutoMode ? autoFormData.imagePrompt : manualFormData.imagePrompt;
        postOptions.imagePrompt = imagePrompt;
        postOptions.useAIImage = true;
      } else if (mediaType === 'photo' && mediaFile) {
        const imageData = await fileToBase64(mediaFile);
        postOptions.imageUrl = imageData;
      } else if (mediaType === 'video' && mediaFile) {
        try {
          const videoData = await fileToBase64(mediaFile);
          postOptions.videoUrl = videoData;
          postOptions.videoFilename = mediaFile.name;
        } catch (error) {
          console.error('Error converting video to base64:', error);
          throw new Error('Failed to process video file: ' + error.message);
        }
      }

      if (!postOptions.textContent && !postOptions.contentPrompt && !postOptions.imageUrl && !postOptions.imagePrompt && !postOptions.videoUrl) {
        throw new Error('No content provided. Please add text content, generate content, or add media.');
      }

      const postResult = await apiClient.createFacebookPost(selectedPage.id, postOptions);

      if (!postResult.success) {
        throw new Error(postResult.error || 'Failed to create post via backend');
      }

      setConnectionStatus('Post published successfully!');

      setTimeout(() => {
        loadPostHistory();
      }, 1000);

      if (isAutoMode) {
        setAutoFormData(prev => ({
          ...prev,
          prompt: '',
          generatedContent: '',
          mediaFile: null,
          mediaType: 'none',
          imagePrompt: '',
          generatedImageUrl: null,
          generatedImageFilename: null
        }));
      } else {
        setManualFormData(prev => ({
          ...prev,
          message: '',
          mediaFile: null,
          mediaType: 'none',
          imagePrompt: '',
          generatedImageUrl: null,
          generatedImageFilename: null
        }));
      }

    } catch (error) {
      console.error('Post publishing error:', error);
      setConnectionStatus('Failed to publish post: ' + (error.message || 'Unknown error'));
    } finally {
      setIsPublishing(false);
    }
  };

  const loadAutoReplyMessageRule = useCallback(async () => {
    if (!selectedPage) return;
    setAutoReplyMessagesLoading(true);
    setAutoReplyMessagesError(null);
    try {
      const rules = await apiClient.getAutomationRules('facebook', 'AUTO_REPLY_MESSAGE');
      const socialAccounts = await apiClient.getSocialAccounts();
      const matchingAccount = socialAccounts.find(acc => acc.platform === 'facebook' && acc.platform_user_id === selectedPage.id);
      const rule = rules.find(r => r.social_account_id === matchingAccount?.id);
      if (rule) {
        setAutoReplyMessageRule(rule);
        setAutoReplyMessagesEnabled(rule.is_active !== false);
      } else {
        setAutoReplyMessageRule(null);
        setAutoReplyMessagesEnabled(true);
      }
    } catch (err) {
      setAutoReplyMessagesError('Failed to load auto-reply message rule.');
    } finally {
      setAutoReplyMessagesLoading(false);
    }
  }, [selectedPage]);

  useEffect(() => {
    loadAutoReplyMessageRule();
  }, [selectedPage, loadAutoReplyMessageRule]);

  const handleAutoReplyMessagesToggle = async () => {
    if (!autoReplyMessageRule) return;
    setAutoReplyMessagesLoading(true);
    setAutoReplyMessagesError(null);
    try {
      const updated = await apiClient.updateAutomationRule(autoReplyMessageRule.id, {
        is_active: !autoReplyMessagesEnabled
      });
      setAutoReplyMessagesEnabled(updated.is_active);
      setAutoReplyMessageRule(updated);
    } catch (err) {
      setAutoReplyMessagesError('Failed to update auto-reply message rule.');
    } finally {
      setAutoReplyMessagesLoading(false);
    }
  };

  const getStatusCardClass = () => {
    if (connectionStatus.includes('Failed') || connectionStatus.includes('error') || connectionStatus.includes('Error')) {
      return 'status-card error';
    } else if (connectionStatus.includes('successful') || connectionStatus.includes('Connected') || connectionStatus.includes('completed')) {
      return 'status-card success';
    } else {
      return 'status-card info';
    }
  };

  return (
    <div className="facebook-page-container">
      {/* Enhanced Navigation Header */}
      <div className="facebook-header">
        <div className="facebook-header-left">
          <div className={`facebook-icon-container ${facebookConnected ? 'connected' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div className="facebook-header-content">
            <h1 className="facebook-title">
              {facebookConnected ?
                (selectedPage ? selectedPage.name : 'Facebook Manager') :
                'Facebook Manager'
              }
            </h1>
            <div className="facebook-subtitle">
              {facebookConnected ? (
                selectedPage ? (
                  <div className="page-status-info">
                    <div className="status-indicator connected" />
                    <span className="page-category">{selectedPage.category}</span>
                    <span className="page-followers">{selectedPage.followerCount?.toLocaleString() || 0} followers</span>
                  </div>
                ) : (
                  <div className="page-status-info">
                    <div className="status-indicator connecting" />
                    <span>Connected • Select a page to continue</span>
                  </div>
                )
              ) : (
                <div className="page-status-info">
                  <div className="status-indicator disconnected" />
                  <span>Not connected • Ready to link your account</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="facebook-header-actions">
          {facebookConnected && (
            <button
              onClick={handleFacebookLogout}
              disabled={isLoggingOut}
              className="header-action-btn disconnect-btn"
              title="Disconnect Facebook"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {!isMobile() && (isLoggingOut ? 'Disconnecting...' : 'Disconnect')}
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="header-action-btn dashboard-btn"
            title="Back to Dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            {!isMobile() && 'Dashboard'}
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className={`facebook-main-content ${!facebookConnected ? 'centered' : ''}`}>
        {/* Subtle Status Indicator */}
        {connectionStatus && (
          <div className={`status-indicator-bar ${getStatusCardClass().split(' ')[1]}`}>
            <div className="status-content">
              <div className="status-icon">
                {connectionStatus.includes('Failed') || connectionStatus.includes('error') ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                ) : connectionStatus.includes('successful') || connectionStatus.includes('Connected') ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22,4 12,14.01 9,11.01" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="1" />
                  </svg>
                )}
              </div>
              <span className="status-text">{connectionStatus}</span>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className={`facebook-main-card ${!facebookConnected ? 'connect-mode' : ''}`}>
          {!facebookConnected ? (
            /* Enhanced Connect Card */
            <div className="connect-card">
              <div className="connect-visual">
                <div className="connect-icon-wrapper">
                  <div className="connect-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </div>
                  <div className="connect-pulse"></div>
                </div>
              </div>

              <div className="connect-content">
                <h2 className="connect-title">Connect Your Facebook</h2>
                <p className="connect-description">
                  Link your Facebook pages to start creating and managing posts with AI assistance
                </p>

                <button
                  onClick={loginWithFacebook}
                  disabled={isConnecting || isCheckingStatus}
                  className="connect-button"
                >
                  <div className="connect-button-content">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span>
                      {isCheckingStatus ? 'Checking Connection...' : (isConnecting ? 'Connecting...' : 'Connect Facebook')}
                    </span>
                  </div>
                  {(isConnecting || isCheckingStatus) && (
                    <div className="connect-loading">
                      <div className="loading-spinner"></div>
                    </div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Connected Content */
            <div className="facebook-connected-content">
              {/* Enhanced Page Selection */}
              {availablePages.length > 1 && (
                <div className="page-selector-card">
                  <div className="page-selector-header">
                    <div className="page-selector-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="page-selector-content">
                      <h3>Select Page</h3>
                      <p>Choose which Facebook page to manage</p>
                    </div>
                  </div>

                  <div className="page-selector-dropdown">
                    <select
                      className="page-dropdown"
                      value={selectedPage?.id || ''}
                      onChange={e => {
                        const page = availablePages.find(p => p.id === e.target.value);
                        if (page && selectedPage?.id !== page.id) {
                          setSelectedPage(page);
                          setAutoPostHistory([]);
                          setManualPostHistory([]);
                          setShowBulkComposer(false);
                          setActiveTab('auto');
                          setConnectionStatus('');
                          setScheduleData({
                            prompt: '',
                            time: '',
                            frequency: 'daily',
                            customDate: '',
                            isActive: false,
                            scheduleId: null
                          });
                          setTimeout(() => {
                            loadAutoReplySettings();
                            loadPostHistory();
                          }, 100);
                        }
                      }}
                    >
                      <option value="" disabled>Choose a page...</option>
                      {availablePages.map(page => (
                        <option key={page.id} value={page.id}>
                          {page.name} • {page.category}
                        </option>
                      ))}
                    </select>

                    <div className="dropdown-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6,9 12,15 18,9" />
                      </svg>
                    </div>
                  </div>

                  {selectedPage && (
                    <div className="selected-page-info">
                      <div className="page-avatar">
                        {selectedPage.profilePicture ? (
                          <img
                            src={selectedPage.profilePicture}
                            alt={selectedPage.name}
                            className="page-avatar-image"
                          />
                        ) : (
                          <div className="page-avatar-placeholder">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="page-details">
                        <div className="page-name">{selectedPage.name}</div>
                        <div className="page-stats">
                          <span className="follower-count">
                            {selectedPage.followerCount?.toLocaleString() || 0} followers
                          </span>
                          <div className="connection-status">
                            <div className="status-dot connected"></div>
                            <span>Connected</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Main Content Area */}
              {selectedPage && (
                <div className="facebook-workspace">
                  {/* Enhanced Tab Navigation */}
                  <div className="workspace-tabs">
                    <button
                      className={`workspace-tab ${activeTab === 'auto' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('auto');
                        setShowAutomate(false);
                      }}
                    >
                      <div className="tab-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                      <span className="tab-label">{isMobile() ? 'AI' : 'AI Generate'}</span>
                    </button>

                    <button
                      className={`workspace-tab ${activeTab === 'manual' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('manual');
                        setShowAutomate(false);
                      }}
                    >
                      <div className="tab-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </div>
                      <span className="tab-label">{isMobile() ? 'Manual' : 'Manual Post'}</span>
                    </button>

                    <button
                      className={`workspace-tab ${activeTab === 'bulk' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('bulk');
                        setShowBulkComposer(true);
                        setShowAutomate(false);
                      }}
                    >
                      <div className="tab-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3h18v18H3z" />
                          <path d="M9 9h6v6H9z" />
                          <path d="M15 3v18" />
                          <path d="M9 3v18" />
                        </svg>
                      </div>
                      <span className="tab-label">{isMobile() ? 'Bulk' : 'Bulk Posts'}</span>
                    </button>

                    <button
                      className={`workspace-tab ${activeTab === 'automate' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('automate');
                        setShowAutomate(true);
                      }}
                    >
                      <div className="tab-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      </div>
                      <span className="tab-label">Automate</span>
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="workspace-content">
                    {/* AI Generate Tab */}
                    {activeTab === 'auto' && (
                      <AIGenerateTab
                        formData={autoFormData}
                        setFormData={setAutoFormData}
                        onGenerate={generatePostContent}
                        onGenerateImage={generateImage}
                        onGenerateImageWithCaption={generateImageWithCaption}
                        onPublish={publishPost}
                        isPublishing={isPublishing}
                        postHistory={autoPostHistory}
                        isLoadingPosts={isLoadingPosts}
                        onRefreshPosts={loadPostHistory}
                      />
                    )}

                    {/* Manual Post Tab */}
                    {activeTab === 'manual' && (
                      <ManualPostTab
                        formData={manualFormData}
                        setFormData={setManualFormData}
                        onPublish={publishPost}
                        isPublishing={isPublishing}
                        postHistory={manualPostHistory}
                        isLoadingPosts={isLoadingPosts}
                        onRefreshPosts={loadPostHistory}
                        onMediaTypeChange={handleMediaTypeChange}
                      />
                    )}

                    {/* Bulk Composer Tab */}
                    {activeTab === 'bulk' && showBulkComposer && (
                      <BulkComposer
                        selectedPage={selectedPage}
                        availablePages={availablePages}
                        onPageChange={setSelectedPage}
                        onClose={() => {
                          setShowBulkComposer(false);
                          setActiveTab('auto');
                        }}
                      />
                    )}

                    {/* Automate Tab */}
                    {activeTab === 'automate' && showAutomate && (
                      <AutomateTab
                        autoReplySettings={autoReplySettings}
                        autoReplyMessageRule={autoReplyMessageRule}
                        autoReplyMessagesEnabled={autoReplyMessagesEnabled}
                        autoReplyMessagesLoading={autoReplyMessagesLoading}
                        autoReplyMessagesError={autoReplyMessagesError}
                        onToggleAutoReplyMessages={handleAutoReplyMessagesToggle}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FacebookPage;