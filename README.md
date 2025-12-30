# Mario Web Game - Frontend

This is the frontend for the Super Mario Web game with mobile controller support.

## Deployment to Netlify

### Quick Deploy

1. Push the `frontend` folder to a GitHub repository
2. Connect the repository to Netlify
3. Set the publish directory to the root of the frontend folder
4. Deploy!

### Manual Deploy

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify deploy --prod --dir=.`

## Configuration

Before deploying, update `config.js` with your backend server URL:

```javascript
const GAME_CONFIG = {
    SERVER_URL: 'https://your-backend-server.onrender.com',
    // ...
};
```

## Files

- `index.html` - Main game screen (for TV/laptop)
- `controller.html` - Mobile controller interface
- `game.js` - Game engine
- `config.js` - Server configuration
- `styles.css` - Game styles
- `netlify.toml` - Netlify configuration
