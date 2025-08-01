import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

const SchedulerDebug = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDebugInfo = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request('/social/debug/scheduled-posts-status');
      setDebugInfo(response);
      setMessage('Debug info loaded successfully');
    } catch (error) {
      console.error('Error fetching debug info:', error);
      setMessage('Failed to load debug info: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerScheduler = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request('/social/debug/trigger-scheduler', {
        method: 'POST'
      });
      setMessage('Scheduler triggered successfully: ' + response.message);
      // Refresh debug info after triggering
      setTimeout(fetchDebugInfo, 2000);
    } catch (error) {
      console.error('Error triggering scheduler:', error);
      setMessage('Failed to trigger scheduler: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#007bff';
      case 'posted': return '#28a745';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Instagram Scheduler Debug</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={fetchDebugInfo} 
          disabled={loading}
          style={{ marginRight: '10px', padding: '8px 16px' }}
        >
          {loading ? 'Loading...' : 'Refresh Debug Info'}
        </button>
        <button 
          onClick={triggerScheduler} 
          disabled={loading}
          style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none' }}
        >
          {loading ? 'Triggering...' : 'Trigger Scheduler'}
        </button>
      </div>

      {message && (
        <div style={{ 
          padding: '10px', 
          marginBottom: '20px', 
          backgroundColor: message.includes('Failed') ? '#f8d7da' : '#d4edda',
          border: `1px solid ${message.includes('Failed') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      {debugInfo && (
        <div>
          <h3>System Status</h3>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <p><strong>Current Time (UTC):</strong> {new Date(debugInfo.current_time_utc).toLocaleString()}</p>
            <p><strong>Current Time (IST):</strong> {new Date(debugInfo.current_time_ist).toLocaleString()}</p>
            <p><strong>Total Posts:</strong> {debugInfo.total_posts}</p>
            <p><strong>Due Posts:</strong> {debugInfo.due_posts_count}</p>
          </div>

          {debugInfo.due_posts_count > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Posts Due for Execution</h4>
              <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                {debugInfo.due_posts.map(post => (
                  <div key={post.id} style={{ marginBottom: '5px' }}>
                    <strong>Post {post.id}:</strong> {post.caption} 
                    <span style={{ color: '#666', fontSize: '0.9em' }}>
                      ({post.post_type} - {new Date(post.scheduled_datetime).toLocaleString()})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3>All Scheduled Posts</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>ID</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Caption</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Type</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Active</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Scheduled Time</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Due</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd' }}>Has Media</th>
                </tr>
              </thead>
              <tbody>
                {debugInfo.posts.map(post => (
                  <tr key={post.id}>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{post.id}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', maxWidth: '200px' }}>
                      {post.caption}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{post.post_type}</td>
                    <td style={{ 
                      padding: '8px', 
                      border: '1px solid #ddd',
                      color: getStatusColor(post.status),
                      fontWeight: 'bold'
                    }}>
                      {post.status}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {post.is_active ? '✅' : '❌'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {post.scheduled_datetime ? new Date(post.scheduled_datetime).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {post.is_due ? '🔔' : '⏳'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {post.has_media ? '✅' : '❌'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulerDebug;