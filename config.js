// ========================================
// GAME CONFIGURATION
// ========================================
// Update SERVER_URL to your deployed backend URL before deploying to Netlify

const GAME_CONFIG = {
    // Backend WebSocket server URL
    // For local development: 'http://localhost:3000'
    // For production: 'https://your-backend-url.onrender.com' (or Railway, Heroku, etc.)
    SERVER_URL: 'http://localhost:3000',

    // Frontend URL (for QR code generation)
    // For local development: 'http://localhost:5500' or wherever you serve the frontend
    // For production: 'https://your-app.netlify.app'
    FRONTEND_URL: window.location.origin,

    // Game settings
    GAME: {
        LEVEL_WIDTH: 6400,
        GRAVITY: 0.6,
        PLAYER_SPEED: 5,
        JUMP_FORCE: -15
    }
};

// Make config available globally
window.GAME_CONFIG = GAME_CONFIG;
