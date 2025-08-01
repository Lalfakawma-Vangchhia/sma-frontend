import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [permissions, setPermissions] = useState({
    granted: false,
    prePosting: true,
    success: true,
    failure: true
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [websocket, setWebsocket] = useState(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPermissions = localStorage.getItem('notificationPermissions');
    if (savedPermissions) {
      setPermissions(JSON.parse(savedPermissions));
    }

    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      const parsed = JSON.parse(savedNotifications);
      setNotifications(parsed);
      setUnreadCount(parsed.filter(n => !n.isRead).length);
    }
  }, []);

  // Save permissions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notificationPermissions', JSON.stringify(permissions));
  }, [permissions]);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Request browser notification permissions
  const requestPermissions = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      
      setPermissions(prev => ({ ...prev, granted }));
      
      if (granted) {
        // Test notification
        new Notification('Notifications Enabled!', {
          body: 'You will now receive alerts about your scheduled posts.',
          icon: '/favicon.ico'
        });
      }
      
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }, []);

  // Add new notification
  const addNotification = useCallback((notification) => {
    console.log('🔔 Adding notification:', notification);
    const newNotification = {
      id: Date.now().toString(),
      timestamp: new Date(),
      isRead: false,
      ...notification
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Keep only last 100 notifications
      const result = updated.slice(0, 100);
      console.log(`📊 Updated notifications: ${result.length} total`);
      return result;
    });

    setUnreadCount(prev => {
      const newCount = prev + 1;
      console.log(`📈 Updated unread count: ${newCount}`);
      return newCount;
    });

    // Show browser notification if permissions granted and enabled
    if (permissions.granted && shouldShowBrowserNotification(notification.type)) {
      showBrowserNotification(newNotification);
    }

    return newNotification;
  }, [permissions]);

  // Check if browser notification should be shown based on user preferences
  const shouldShowBrowserNotification = useCallback((type) => {
    switch (type) {
      case 'pre_posting':
        return permissions.prePosting;
      case 'success':
        return permissions.success;
      case 'failure':
        return permissions.failure;
      default:
        return true;
    }
  }, [permissions]);

  // Show browser notification
  const showBrowserNotification = useCallback((notification) => {
    if (!permissions.granted) return;

    const options = {
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.type === 'failure',
      actions: notification.type === 'pre_posting' ? [
        { action: 'edit', title: 'Edit Post' },
        { action: 'dismiss', title: 'Dismiss' }
      ] : []
    };

    const browserNotification = new Notification(
      `${notification.platform.toUpperCase()} - ${notification.strategyName}`,
      options
    );

    browserNotification.onclick = () => {
      handleNotificationClick(notification);
      browserNotification.close();
    };

    // Auto-close after 10 seconds for non-failure notifications
    if (notification.type !== 'failure') {
      setTimeout(() => browserNotification.close(), 10000);
    }
  }, [permissions]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'pre_posting':
      case 'failure':
        // Navigate to bulk composer
        if (notification.platform === 'facebook') {
          window.location.href = '/facebook';
        } else if (notification.platform === 'instagram') {
          window.location.href = '/instagram';
        }
        break;
      case 'success':
        // Navigate to social media dashboard or specific post
        window.location.href = `/${notification.platform}`;
        break;
      default:
        break;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      // Update backend first
      await apiClient.markNotificationRead(notificationId);
      
      // Then update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      console.log(`✅ Marked notification ${notificationId} as read`);
    } catch (error) {
      console.error(`❌ Failed to mark notification ${notificationId} as read:`, error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Update backend first
      await apiClient.markAllNotificationsRead();
      
      // Then update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      setUnreadCount(0);
      console.log('✅ Marked all notifications as read');
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
    }
  }, []);

  // Update notification preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    setPermissions(prev => ({ ...prev, ...newPreferences }));
    
    // Save to backend if user is authenticated
    try {
      await apiClient.updateNotificationPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }, []);

  // Setup WebSocket connection for real-time notifications
  const setupWebSocket = useCallback(() => {
    if (websocket) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('No auth token found, skipping WebSocket setup');
      return;
    }

    // Determine the correct WebSocket protocol based on the current page protocol
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';
    const wsUrl = process.env.REACT_APP_WS_URL || `${wsProtocol}//localhost:8000`;
    const fullWsUrl = `${wsUrl}/api/ws/notifications?token=${encodeURIComponent(token)}`;
    
    console.log('🔌 Current page protocol:', window.location.protocol);
    console.log('🔌 Using WebSocket protocol:', wsProtocol);
    console.log('🔌 Attempting WebSocket connection to:', fullWsUrl);
    console.log('🔌 Token length:', token.length);
    console.log('🔌 Token preview:', token.substring(0, 50) + '...');
    
    const ws = new WebSocket(fullWsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for notifications');
      setWebsocket(ws);
      
      // Send periodic ping messages to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds
      
      // Store interval ID for cleanup
      ws.pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data);
        
        if (data.type === 'connection_established') {
          console.log('✅ WebSocket connection confirmed by server');
        } else if (data.type === 'pong') {
          console.debug('🏓 Received pong from server');
        } else if (data.type === 'notification' && data.notification) {
          // Transform WebSocket notification to frontend format
          const transformedNotification = {
            id: data.notification.id,
            type: data.notification.type,
            platform: data.notification.platform,
            strategyName: data.notification.strategyName,
            message: data.notification.message,
            isRead: data.notification.isRead,
            timestamp: data.notification.timestamp,
            scheduledTime: data.notification.scheduledTime,
            error: data.notification.error,
            postId: data.notification.postId
          };
          addNotification(transformedNotification);
        } else {
          console.warn('⚠️ WebSocket message with unknown type:', data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        console.error('Raw event data:', event.data);
      }
    };

    ws.onclose = (event) => {
      console.warn('❌ WebSocket closed:', event.code, event.reason);
      console.warn('❌ WebSocket close details:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        type: event.type
      });
      
      // Clear ping interval
      if (ws.pingInterval) {
        clearInterval(ws.pingInterval);
      }
      
      setWebsocket(null);
      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('🔄 Attempting WebSocket reconnection...');
        setupWebSocket();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      if (error && error.target && error.target.url) {
        console.error('❌ WebSocket URL:', error.target.url);
      }
      if (error.message) {
        console.error('❌ WebSocket error message:', error.message);
      }
      console.error('❌ WebSocket error details:', {
        type: error.type,
        target: error.target,
        currentTarget: error.currentTarget,
        eventPhase: error.eventPhase,
        bubbles: error.bubbles,
        cancelable: error.cancelable,
        defaultPrevented: error.defaultPrevented,
        isTrusted: error.isTrusted,
        timeStamp: error.timeStamp
      });
      // Don't close immediately, let the onclose handler deal with reconnection
    };
  }, [websocket, addNotification]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [websocket]);

  // Load notifications from backend
  const loadNotifications = useCallback(async () => {
    try {
      console.log('🔄 Loading notifications from backend...');
      const response = await apiClient.getNotifications();
      console.log('📨 Notifications response:', response);
      
      if (response && response.success && Array.isArray(response.data)) {
        console.log('📊 Raw notifications data:', response.data);
        
        // Transform backend data to frontend format
        const transformedNotifications = response.data.map(notification => {
          const transformed = {
            id: notification.id,
            type: notification.type,
            platform: notification.platform,
            strategyName: notification.strategy_name,
            message: notification.message,
            isRead: notification.is_read,
            timestamp: notification.created_at,
            scheduledTime: notification.scheduled_time,
            error: notification.error_message,
            postId: notification.post_id
          };
          console.log('🔄 Transformed notification:', transformed);
          return transformed;
        });
        
        console.log('📋 Final transformed notifications:', transformedNotifications);
        setNotifications(transformedNotifications);
        const unreadCount = transformedNotifications.filter(n => !n.isRead).length;
        setUnreadCount(unreadCount);
        console.log(`✅ Loaded ${transformedNotifications.length} notifications, ${unreadCount} unread`);
      } else {
        console.error('❌ Failed to load notifications: Invalid or missing data', response);
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ Failed to load notifications:', error);
      if (error.response) {
        console.error('❌ Backend error response:', error.response);
      }
      if (error.stack) {
        console.error('❌ Error stack:', error.stack);
      }
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  // Initialize notifications and WebSocket when user is authenticated
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Delay notification loading to prevent competing with auth requests on page refresh
      setTimeout(() => {
        loadNotifications();
        setupWebSocket();
      }, 1000); // 1 second delay
    }
  }, [loadNotifications, setupWebSocket]);

  // Check if user should see permission modal
  const checkPermissionModal = useCallback(() => {
    const hasSeenModal = localStorage.getItem('hasSeenNotificationModal');
    const token = localStorage.getItem('authToken');
    
    if (token && !hasSeenModal && !permissions.granted) {
      setShowPermissionModal(true);
    }
  }, [permissions.granted]);

  // Listen for login events
  useEffect(() => {
    const handleUserLogin = () => {
      setTimeout(() => {
        checkPermissionModal();
      }, 500);
    };

    window.addEventListener('userLoggedIn', handleUserLogin);
    return () => window.removeEventListener('userLoggedIn', handleUserLogin);
  }, [checkPermissionModal]);

  // Handle permission modal response
  const handlePermissionAllow = useCallback(async () => {
    const granted = await requestPermissions();
    setShowPermissionModal(false);
    localStorage.setItem('hasSeenNotificationModal', 'true');
    
    if (granted) {
      // Load user preferences from backend
      try {
        const response = await apiClient.getNotificationPreferences();
        if (response.success) {
          setPermissions(prev => ({ ...prev, ...response.data }));
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      }
    }
  }, [requestPermissions]);

  const handlePermissionBlock = useCallback(() => {
    setShowPermissionModal(false);
    localStorage.setItem('hasSeenNotificationModal', 'true');
    setPermissions(prev => ({ ...prev, granted: false }));
  }, []);

  // Test notification function for debugging
  const testNotification = useCallback(() => {
    addNotification({
      type: 'success',
      platform: 'instagram',
      strategyName: 'Test Notification',
      message: 'This is a test notification to verify the system is working!',
      timestamp: new Date().toISOString()
    });
  }, [addNotification]);

  // Test WebSocket connection function
  const testWebSocketConnection = useCallback(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('❌ No auth token found for WebSocket test');
      return;
    }

    // Use the same protocol logic as setupWebSocket
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';
    const wsUrl = process.env.REACT_APP_WS_URL || `${wsProtocol}//localhost:8000`;
    const fullWsUrl = `${wsUrl}/api/ws/notifications?token=${encodeURIComponent(token)}`;
    console.log('🧪 Testing WebSocket connection to:', fullWsUrl);
    
    const testWs = new WebSocket(fullWsUrl);
    
    testWs.onopen = () => {
      console.log('✅ Test WebSocket connection successful');
      testWs.close();
    };
    
    testWs.onerror = (error) => {
      console.error('❌ Test WebSocket connection failed:', error);
    };
    
    testWs.onclose = (event) => {
      console.log('🔌 Test WebSocket connection closed:', event.code, event.reason);
    };
  }, []);

  // Test API connection function
  const testApiConnection = useCallback(async () => {
    try {
      console.log('🧪 Testing API connection...');
      const response = await apiClient.getNotifications();
      console.log('✅ API test response:', response);
      if (response && response.success) {
        console.log(`✅ API test successful: ${response.data.length} notifications found`);
      } else {
        console.error('❌ API test failed:', response?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ API test error:', error);
    }
  }, []);

  // Test simple WebSocket connection function
  const testSimpleWebSocket = useCallback(() => {
    console.log('🧪 Testing simple WebSocket connection...');
    // Use the same protocol logic as setupWebSocket
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';
    const wsUrl = process.env.REACT_APP_WS_URL || `${wsProtocol}//localhost:8000`;
    const fullWsUrl = `${wsUrl}/api/ws/test`;
    console.log('🔌 Simple WebSocket URL:', fullWsUrl);
    
    const testWs = new WebSocket(fullWsUrl);
    
    testWs.onopen = () => {
      console.log('✅ Simple WebSocket connection successful');
      testWs.send('Hello from frontend!');
    };
    
    testWs.onmessage = (event) => {
      console.log('📨 Simple WebSocket message received:', event.data);
    };
    
    testWs.onerror = (error) => {
      console.error('❌ Simple WebSocket connection failed:', error);
    };
    
    testWs.onclose = (event) => {
      console.log('🔌 Simple WebSocket connection closed:', event.code, event.reason);
    };
  }, []);

  const value = {
    notifications,
    unreadCount,
    permissions,
    isNotificationCenterOpen,
    showPermissionModal,
    setIsNotificationCenterOpen,
    addNotification,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    requestPermissions,
    handleNotificationClick,
    checkPermissionModal,
    handlePermissionAllow,
    handlePermissionBlock,
    loadNotifications,
    testNotification,
    testWebSocketConnection,
    testApiConnection,
    testSimpleWebSocket,
    refreshNotifications: loadNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};