import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/Layout';
import Login from './components/Login';
import GoogleOAuthCallback from './components/GoogleOAuthCallback';
import NotificationPermissionModal from './components/NotificationPermissionModal';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const SocialMediaPage = lazy(() => import('./components/SocialMediaPage'));
const FacebookPage = lazy(() => import('./components/FacebookPage'));
const InstagramPage = lazy(() => import('./components/InstagramPage'));
const LinkedInPage = lazy(() => import('./components/LinkedInPage'));
const SchedulerDebug = lazy(() => import('./components/SchedulerDebug'));

// Loading component
const LoadingSpinner = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '18px',
    flexDirection: 'column',
    gap: '10px'
  }}>
    <div className="spinner"></div>
    <div>Loading...</div>
  </div>
);

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '20px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>Something went wrong</h2>
          <p>Please refresh the page or try again later.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
        
        {/* Protected routes */}
        {isAuthenticated ? (
          <>
            <Route path="/" element={
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                  <Dashboard />
                </Suspense>
              </Layout>
            } />
            <Route path="/social-media" element={
              <Suspense fallback={<LoadingSpinner />}>
                <SocialMediaPage />
              </Suspense>
            } />
            <Route path="/facebook" element={
              <Suspense fallback={<LoadingSpinner />}>
                <FacebookPage />
              </Suspense>
            } />
            <Route path="/instagram" element={
              <Layout>
              <Suspense fallback={<LoadingSpinner />}>
                <InstagramPage />
              </Suspense>
              </Layout>
            } />
            <Route path="/linkedin" element={
              <Suspense fallback={<LoadingSpinner />}>
                <LinkedInPage />
              </Suspense>
            } />
            <Route path="/debug/scheduler" element={
              <Suspense fallback={<LoadingSpinner />}>
                <SchedulerDebug />
              </Suspense>
            } />

          </>
        ) : (
          <Route path="*" element={<Login />} />
        )}
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
            <NotificationPermissionModal />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;