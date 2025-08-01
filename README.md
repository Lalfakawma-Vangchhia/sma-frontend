# Social Media Automation Dashboard - Frontend

A React-based frontend for managing social media automation, scheduling posts, and handling bulk content operations across multiple platforms.

## Features

- Google OAuth authentication
- Facebook Graph API integration for post scheduling
- Instagram content management
- Bulk post composer and scheduler
- Real-time notifications
- Scheduled post history and management

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Backend API server running
- Google Cloud Console project with OAuth configured
- Facebook Developer App with Graph API access

## Installation

### 1. Clone and Setup

```bash
git clone [your-repo-url]
cd frontend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the frontend directory:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_FACEBOOK_APP_ID=your_facebook_app_id
HTTPS=true
SSL_CRT_FILE=localhost.pem
SSL_KEY_FILE=localhost-key.pem
```

### 3. SSL Certificates (Required for OAuth)

The project includes SSL certificates for local development. If you need to generate new ones:

```bash
# Generate SSL certificates for localhost
openssl req -x509 -newkey rsa:4096 -keyout localhost-key.pem -out localhost.pem -days 365 -nodes -subj "/CN=localhost"
```

### 4. Start Development Server

```bash
npm start
```

The application will run on `https://localhost:3000`

## Google OAuth Setup

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google+ API
   - Google Drive API (if using drive features)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen:
   - Add your domain
   - Add authorized redirect URIs:
     - `https://localhost:3000/auth/google/callback`
     - `http://localhost:8000/auth/google/callback` (backend)

### 2. Implementation Details

The Google OAuth flow works as follows:

1. **Frontend Initiation**: User clicks login, redirected to Google consent screen
2. **User Consent**: User approves requested permissions (email, profile)
3. **Authorization Code**: Google redirects back with temporary code
4. **Backend Token Exchange**: Backend exchanges code for access/refresh tokens
5. **Session Creation**: User session established with JWT tokens

Required scopes:
- `openid` - Basic OpenID Connect
- `email` - User email access
- `profile` - Basic profile information

## Facebook Graph API Setup

### 1. Facebook Developer Configuration

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add "Facebook Login" product
4. Configure OAuth redirect URIs:
   - `https://localhost:3000/auth/facebook/callback`
   - `http://localhost:8000/auth/facebook/callback`
5. Add required permissions:
   - `pages_manage_posts` - Post to pages
   - `pages_read_engagement` - Read page insights
   - `instagram_basic` - Instagram integration
   - `instagram_content_publish` - Instagram posting

### 2. Graph API Usage

The application uses Facebook Graph API for:

- **Page Management**: Retrieve user's Facebook pages
- **Post Scheduling**: Schedule posts to Facebook pages
- **Instagram Integration**: Cross-post to connected Instagram accounts
- **Analytics**: Fetch post performance metrics

API endpoints used:
- `/me/accounts` - Get user's pages
- `/{page-id}/feed` - Post to page
- `/{page-id}/scheduled_posts` - Manage scheduled content
- `/{instagram-account-id}/media` - Instagram media management

### 3. Permissions Flow

1. User authenticates with Facebook
2. App requests page permissions
3. User grants access to specific pages
4. App stores page access tokens
5. Scheduled posts use page tokens for publishing

## Project Structure

```
src/
├── components/          # React components
│   ├── Dashboard.js     # Main dashboard
│   ├── Login.js         # Authentication
│   ├── FacebookPage.js  # Facebook integration
│   ├── InstagramPage.js # Instagram management
│   └── BulkComposer.js  # Bulk content creation
├── contexts/            # React contexts
│   ├── AuthContext.js   # Authentication state
│   └── NotificationContext.js # Notifications
├── services/            # API services
│   └── apiClient.js     # HTTP client
└── App.js              # Main application

```

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## API Integration

The frontend communicates with the backend API for:

- User authentication and session management
- Social media account linking
- Post scheduling and management
- File uploads and media handling
- Real-time notifications via WebSocket

## Security Considerations

- All OAuth flows use HTTPS in production
- Client secrets are never exposed to frontend
- JWT tokens stored securely in httpOnly cookies
- CSRF protection implemented
- Input validation on all forms

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**: Ensure redirect URIs match exactly in OAuth providers
2. **SSL Certificate Issues**: Regenerate certificates if browser shows warnings
3. **API Connection Failed**: Verify backend server is running and CORS configured
4. **Facebook Permissions**: Ensure app is approved for required permissions

### Development Tips

- Use browser developer tools to debug OAuth flows
- Check network tab for API request/response details
- Enable verbose logging in development environment
- Test with different Facebook page types and permissions

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with proper testing
4. Submit pull request with detailed description

## License

[Your License Here]
