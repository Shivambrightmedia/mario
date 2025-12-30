// ========================================
// SUPER MARIO WEB - Main Game Engine
// ========================================

class MarioGame {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Screen elements
        this.loadingScreen = document.getElementById('loading-screen');
        this.connectionScreen = document.getElementById('connection-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.gameoverOverlay = document.getElementById('gameover-overlay');
        this.loadingProgress = document.getElementById('loading-progress');

        // HUD elements
        this.scoreDisplay = document.getElementById('score');
        this.coinsDisplay = document.getElementById('coins');
        this.timeDisplay = document.getElementById('time');
        this.livesDisplay = document.getElementById('lives');

        // Game state
        this.gameStarted = false;
        this.gamePaused = false;
        this.gameOver = false;
        this.score = 0;
        this.coins = 0;
        this.lives = 3;
        this.time = 400;
        this.roomId = null;

        // Input state
        this.keys = {
            left: false,
            right: false,
            jump: false
        };

        // Game objects
        this.mario = null;
        this.platforms = [];
        this.enemies = [];
        this.collectibles = [];
        this.decorations = [];

        // Camera
        this.camera = { x: 0, y: 0 };

        // Level data
        this.levelWidth = GAME_CONFIG.GAME.LEVEL_WIDTH;
        this.groundLevel = 0;

        // Socket connection to backend
        this.socket = io(GAME_CONFIG.SERVER_URL);

        // Initialize
        this.init();
    }

    async init() {
        // Simulate loading
        await this.simulateLoading();

        // Setup socket events
        this.setupSocket();

        // Setup canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Also allow keyboard controls for testing
        this.setupKeyboardControls();

        // Show connection screen
        this.loadingScreen.classList.add('hidden');
        this.connectionScreen.classList.remove('hidden');
    }

    async simulateLoading() {
        const steps = 20;
        for (let i = 1; i <= steps; i++) {
            this.loadingProgress.style.width = `${(i / steps) * 100}%`;
            await this.delay(50);
        }
        await this.delay(500);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupSocket() {
        const serverStatus = document.getElementById('server-status');
        const serverDot = serverStatus.querySelector('.server-dot');
        const serverText = serverStatus.querySelector('.server-text');

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            serverDot.style.background = '#43B047';
            serverText.textContent = 'Server connected';

            // Create room after connection
            this.socket.emit('create-room', (response) => {
                this.roomId = response.roomId;
                document.getElementById('room-id').textContent = this.roomId;
                this.loadQRCode();
            });
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            serverDot.style.background = '#E52521';
            serverText.textContent = 'Server disconnected - Check backend URL';
        });

        this.socket.on('disconnect', () => {
            serverDot.style.background = '#FBD000';
            serverText.textContent = 'Reconnecting...';
        });

        // Controller connected
        this.socket.on('controller-connected', (data) => {
            console.log('Controller connected:', data);
            this.updateConnectionStatus(true, data.controllerCount);
        });

        // Controller disconnected
        this.socket.on('controller-disconnected', (data) => {
            console.log('Controller disconnected:', data);
            if (data.controllerCount === 0) {
                this.updateConnectionStatus(false, 0);
            } else {
                document.getElementById('controller-count').textContent = data.controllerCount;
            }
        });

        // Game input from controller
        this.socket.on('game-input', (data) => {
            this.handleInput(data);
        });

        // Game started
        this.socket.on('game-started', () => {
            if (!this.gameStarted) {
                this.startGame();
            }
        });

        // Game paused
        this.socket.on('game-paused', () => {
            this.pauseGame();
        });

        // Game resumed
        this.socket.on('game-resumed', () => {
            this.resumeGame();
        });

        // Game restart
        this.socket.on('game-restart', () => {
            this.restartGame();
        });
    }

    async loadQRCode() {
        const qrLoading = document.getElementById('qr-loading');
        const qrCode = document.getElementById('qr-code');

        try {
            // Build QR code URL with frontend URL parameter
            const frontendUrl = encodeURIComponent(GAME_CONFIG.FRONTEND_URL);
            const response = await fetch(
                `${GAME_CONFIG.SERVER_URL}/api/qrcode/${this.roomId}?frontendUrl=${frontendUrl}`
            );
            const data = await response.json();

            qrCode.src = data.qrCode;
            qrCode.classList.remove('hidden');
            qrLoading.classList.add('hidden');
        } catch (error) {
            console.error('Failed to load QR code:', error);
            qrLoading.innerHTML = '<span style="color: #E52521;">Failed to generate QR</span>';
        }
    }

    updateConnectionStatus(connected, count) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        const controllerSection = document.getElementById('controller-section');
        const controllerCount = document.getElementById('controller-count');

        if (connected) {
            statusIndicator.classList.remove('waiting');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Controller Connected!';
            controllerSection.classList.remove('hidden');
            controllerCount.textContent = count;
        } else {
            statusIndicator.classList.add('waiting');
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Waiting for controller...';
            controllerSection.classList.add('hidden');
        }
    }

    handleInput(data) {
        const { action, state } = data;
        const isPressed = state === 'start';

        switch (action) {
            case 'left':
                this.keys.left = isPressed;
                break;
            case 'right':
                this.keys.right = isPressed;
                break;
            case 'jump':
                if (isPressed && this.mario && !this.mario.isJumping) {
                    this.mario.jump();
                }
                break;
        }
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted && e.code === 'Space') {
                this.startGame();
                return;
            }

            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = true;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                case 'Space':
                    if (this.mario && !this.mario.isJumping) {
                        this.mario.jump();
                    }
                    break;
                case 'KeyP':
                case 'Escape':
                    if (this.gamePaused) {
                        this.resumeGame();
                    } else {
                        this.pauseGame();
                    }
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = false;
                    break;
            }
        });
    }

    resizeCanvas() {
        const container = this.gameScreen;
        const hud = document.querySelector('.game-hud');
        const hudHeight = hud ? hud.offsetHeight : 60;

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - hudHeight;

        this.groundLevel = this.canvas.height - 64;
    }

    startGame() {
        this.gameStarted = true;
        this.gamePaused = false;
        this.gameOver = false;
        this.score = 0;
        this.coins = 0;
        this.lives = 3;
        this.time = 400;
        this.camera.x = 0;

        // Hide connection screen, show game
        this.connectionScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.gameoverOverlay.classList.add('hidden');
        this.pauseOverlay.classList.add('hidden');

        // Resize canvas after showing game screen
        setTimeout(() => {
            this.resizeCanvas();
            this.initLevel();
            this.gameLoop();
            this.startTimer();
        }, 100);
    }

    restartGame() {
        this.gameOver = false;
        this.score = 0;
        this.coins = 0;
        this.lives = 3;
        this.time = 400;
        this.camera.x = 0;

        this.gameoverOverlay.classList.add('hidden');
        this.pauseOverlay.classList.add('hidden');

        this.initLevel();
        this.startTimer();
    }

    initLevel() {
        // Create Mario
        this.mario = new Mario(100, this.groundLevel - 64, this);

        // Create platforms
        this.platforms = [];
        this.createLevel();

        // Create enemies
        this.enemies = [];
        this.spawnEnemies();

        // Create collectibles
        this.collectibles = [];
        this.spawnCollectibles();

        // Create decorations
        this.createDecorations();
    }

    createLevel() {
        // Ground
        for (let x = 0; x < this.levelWidth; x += 64) {
            // Add gaps
            if ((x > 800 && x < 928) || (x > 1600 && x < 1728) || (x > 3200 && x < 3392)) {
                continue;
            }
            this.platforms.push(new Platform(x, this.groundLevel, 64, 64, 'ground'));
        }

        // Floating platforms
        const platformData = [
            { x: 300, y: this.groundLevel - 180, w: 192, type: 'brick' },
            { x: 500, y: this.groundLevel - 280, w: 64, type: 'question' },
            { x: 700, y: this.groundLevel - 180, w: 128, type: 'brick' },
            { x: 1000, y: this.groundLevel - 200, w: 256, type: 'brick' },
            { x: 1400, y: this.groundLevel - 300, w: 128, type: 'brick' },
            { x: 1800, y: this.groundLevel - 150, w: 192, type: 'brick' },
            { x: 2000, y: this.groundLevel - 280, w: 64, type: 'question' },
            { x: 2200, y: this.groundLevel - 200, w: 192, type: 'brick' },
            { x: 2600, y: this.groundLevel - 250, w: 128, type: 'brick' },
            { x: 2900, y: this.groundLevel - 180, w: 256, type: 'brick' },
            { x: 3500, y: this.groundLevel - 200, w: 192, type: 'brick' },
            { x: 3800, y: this.groundLevel - 300, w: 64, type: 'question' },
            { x: 4100, y: this.groundLevel - 180, w: 256, type: 'brick' },
            { x: 4500, y: this.groundLevel - 250, w: 128, type: 'brick' },
            { x: 4800, y: this.groundLevel - 180, w: 192, type: 'brick' },
            { x: 5200, y: this.groundLevel - 200, w: 128, type: 'brick' },
            { x: 5500, y: this.groundLevel - 280, w: 64, type: 'question' },
            { x: 5800, y: this.groundLevel - 200, w: 256, type: 'brick' },
        ];

        platformData.forEach(p => {
            for (let x = 0; x < p.w; x += 64) {
                this.platforms.push(new Platform(p.x + x, p.y, 64, 64, p.type));
            }
        });

        // Stairs/pipes
        this.createPipe(1200, this.groundLevel, 2);
        this.createPipe(2400, this.groundLevel, 3);
        this.createPipe(3000, this.groundLevel, 2);
        this.createPipe(4000, this.groundLevel, 4);
        this.createPipe(5000, this.groundLevel, 2);

        // Flag pole at end
        this.platforms.push(new Platform(this.levelWidth - 200, this.groundLevel - 400, 16, 400, 'pole'));
    }

    createPipe(x, groundY, height) {
        const pipeHeight = height * 64;
        this.platforms.push(new Platform(x, groundY - pipeHeight, 96, pipeHeight, 'pipe'));
    }

    spawnEnemies() {
        const enemyPositions = [
            400, 600, 900, 1100, 1500, 1900, 2300, 2700, 3100, 3600, 4200, 4600, 5300, 5700
        ];

        enemyPositions.forEach(x => {
            this.enemies.push(new Goomba(x, this.groundLevel - 48, this));
        });
    }

    spawnCollectibles() {
        const coinPositions = [
            { x: 350, y: this.groundLevel - 250 },
            { x: 410, y: this.groundLevel - 250 },
            { x: 500, y: this.groundLevel - 350 },
            { x: 750, y: this.groundLevel - 250 },
            { x: 1050, y: this.groundLevel - 280 },
            { x: 1110, y: this.groundLevel - 280 },
            { x: 1450, y: this.groundLevel - 380 },
            { x: 1850, y: this.groundLevel - 230 },
            { x: 2000, y: this.groundLevel - 350 },
            { x: 2250, y: this.groundLevel - 280 },
            { x: 2650, y: this.groundLevel - 330 },
            { x: 2950, y: this.groundLevel - 260 },
            { x: 3550, y: this.groundLevel - 280 },
            { x: 3800, y: this.groundLevel - 370 },
            { x: 4150, y: this.groundLevel - 260 },
            { x: 4550, y: this.groundLevel - 330 },
            { x: 4850, y: this.groundLevel - 260 },
            { x: 5250, y: this.groundLevel - 280 },
            { x: 5500, y: this.groundLevel - 350 },
            { x: 5850, y: this.groundLevel - 280 },
        ];

        coinPositions.forEach(pos => {
            this.collectibles.push(new Coin(pos.x, pos.y));
        });
    }

    createDecorations() {
        this.decorations = [];

        // Clouds
        for (let x = 0; x < this.levelWidth; x += 600) {
            this.decorations.push({
                type: 'cloud',
                x: x + Math.random() * 200,
                y: 50 + Math.random() * 100,
                size: 1 + Math.random() * 0.5
            });
        }

        // Hills
        for (let x = 0; x < this.levelWidth; x += 800) {
            this.decorations.push({
                type: 'hill',
                x: x + Math.random() * 200,
                y: this.groundLevel,
                size: 0.8 + Math.random() * 0.4
            });
        }

        // Bushes
        for (let x = 0; x < this.levelWidth; x += 400) {
            this.decorations.push({
                type: 'bush',
                x: x + Math.random() * 150,
                y: this.groundLevel,
                size: 0.6 + Math.random() * 0.4
            });
        }
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (!this.gamePaused && this.gameStarted && !this.gameOver) {
                this.time--;
                this.updateHUD();

                if (this.time <= 0) {
                    this.playerDeath();
                }
            }
        }, 1000);
    }

    pauseGame() {
        if (!this.gameStarted || this.gameOver) return;
        this.gamePaused = true;
        this.pauseOverlay.classList.remove('hidden');
    }

    resumeGame() {
        if (!this.gameStarted || this.gameOver) return;
        this.gamePaused = false;
        this.pauseOverlay.classList.add('hidden');
    }

    updateHUD() {
        this.scoreDisplay.textContent = this.score.toString().padStart(6, '0');
        this.coinsDisplay.textContent = `×${this.coins.toString().padStart(2, '0')}`;
        this.timeDisplay.textContent = this.time.toString();
        this.livesDisplay.textContent = `×${this.lives}`;
    }

    addScore(points) {
        this.score += points;
        this.updateHUD();
    }

    collectCoin() {
        this.coins++;
        this.addScore(200);

        if (this.coins >= 100) {
            this.coins = 0;
            this.lives++;
        }
    }

    playerDeath() {
        this.lives--;

        if (this.lives <= 0) {
            this.triggerGameOver();
        } else {
            // Reset position
            this.mario.x = 100;
            this.mario.y = this.groundLevel - 64;
            this.mario.velocityX = 0;
            this.mario.velocityY = 0;
            this.camera.x = 0;
            this.time = 400;
            this.updateHUD();
        }
    }

    triggerGameOver() {
        this.gameOver = true;
        this.gameoverOverlay.classList.remove('hidden');

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    checkLevelComplete() {
        if (this.mario.x >= this.levelWidth - 250) {
            // Level complete!
            this.addScore(this.time * 50);
            this.triggerGameOver();
        }
    }

    gameLoop() {
        if (!this.gameStarted) return;

        if (!this.gamePaused && !this.gameOver) {
            this.update();
        }

        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update Mario
        if (this.mario) {
            this.mario.update(this.keys);

            // Check collisions with platforms
            this.platforms.forEach(platform => {
                if (this.mario.collidesWith(platform)) {
                    this.mario.resolveCollision(platform);
                }
            });

            // Check collisions with enemies
            this.enemies = this.enemies.filter(enemy => {
                if (!enemy.alive) return false;

                enemy.update();

                // Platform collisions for enemies
                this.platforms.forEach(platform => {
                    if (enemy.collidesWith(platform)) {
                        enemy.resolveCollision(platform);
                    }
                });

                // Mario collision
                if (this.mario.collidesWith(enemy)) {
                    if (this.mario.velocityY > 0 && this.mario.y + this.mario.height < enemy.y + enemy.height / 2) {
                        // Stomp!
                        enemy.stomp();
                        this.mario.velocityY = -8;
                        this.addScore(100);
                    } else {
                        // Mario hit
                        this.playerDeath();
                    }
                }

                return true;
            });

            // Check collectibles
            this.collectibles = this.collectibles.filter(coin => {
                if (this.mario.collidesWith(coin)) {
                    this.collectCoin();
                    return false;
                }
                coin.update();
                return true;
            });

            // Update camera
            this.updateCamera();

            // Check death by falling
            if (this.mario.y > this.canvas.height) {
                this.playerDeath();
            }

            // Check level complete
            this.checkLevelComplete();
        }
    }

    updateCamera() {
        // Camera follows Mario
        const targetX = this.mario.x - this.canvas.width / 3;
        this.camera.x = Math.max(0, Math.min(targetX, this.levelWidth - this.canvas.width));
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#5c94fc';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render decorations (background)
        this.renderDecorations();

        // Render platforms
        this.platforms.forEach(platform => {
            platform.render(this.ctx, this.camera);
        });

        // Render collectibles
        this.collectibles.forEach(coin => {
            coin.render(this.ctx, this.camera);
        });

        // Render enemies
        this.enemies.forEach(enemy => {
            enemy.render(this.ctx, this.camera);
        });

        // Render Mario
        if (this.mario) {
            this.mario.render(this.ctx, this.camera);
        }
    }

    renderDecorations() {
        this.decorations.forEach(dec => {
            const screenX = dec.x - this.camera.x * 0.5; // Parallax effect

            switch (dec.type) {
                case 'cloud':
                    this.drawCloud(screenX, dec.y, dec.size);
                    break;
                case 'hill':
                    this.drawHill(dec.x - this.camera.x, dec.y, dec.size);
                    break;
                case 'bush':
                    this.drawBush(dec.x - this.camera.x, dec.y, dec.size);
                    break;
            }
        });
    }

    drawCloud(x, y, size) {
        this.ctx.fillStyle = '#ffffff';
        const r = 30 * size;

        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.arc(x + r, y - r * 0.3, r * 0.8, 0, Math.PI * 2);
        this.ctx.arc(x + r * 1.8, y, r * 0.9, 0, Math.PI * 2);
        this.ctx.arc(x + r * 0.9, y + r * 0.3, r * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawHill(x, y, size) {
        const width = 200 * size;
        const height = 100 * size;

        this.ctx.fillStyle = '#7bc67b';
        this.ctx.beginPath();
        this.ctx.moveTo(x - width / 2, y);
        this.ctx.quadraticCurveTo(x, y - height, x + width / 2, y);
        this.ctx.fill();
    }

    drawBush(x, y, size) {
        this.ctx.fillStyle = '#228b22';
        const r = 25 * size;

        this.ctx.beginPath();
        this.ctx.arc(x, y - r, r, 0, Math.PI * 2);
        this.ctx.arc(x - r * 0.8, y - r * 0.7, r * 0.7, 0, Math.PI * 2);
        this.ctx.arc(x + r * 0.8, y - r * 0.7, r * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// ========================================
// Mario Character
// ========================================

class Mario {
    constructor(x, y, game) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 48;
        this.height = 64;
        this.velocityX = 0;
        this.velocityY = 0;
        this.speed = GAME_CONFIG.GAME.PLAYER_SPEED;
        this.jumpForce = GAME_CONFIG.GAME.JUMP_FORCE;
        this.gravity = GAME_CONFIG.GAME.GRAVITY;
        this.friction = 0.85;
        this.isJumping = false;
        this.facingRight = true;
        this.animationFrame = 0;
        this.frameCounter = 0;
    }

    update(keys) {
        // Horizontal movement
        if (keys.left) {
            this.velocityX = -this.speed;
            this.facingRight = false;
        } else if (keys.right) {
            this.velocityX = this.speed;
            this.facingRight = true;
        } else {
            this.velocityX *= this.friction;
        }

        // Apply gravity
        this.velocityY += this.gravity;

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Animation
        this.frameCounter++;
        if (this.frameCounter >= 8) {
            this.frameCounter = 0;
            this.animationFrame = (this.animationFrame + 1) % 3;
        }

        // Boundary check
        if (this.x < 0) this.x = 0;
        if (this.x > this.game.levelWidth - this.width) {
            this.x = this.game.levelWidth - this.width;
        }
    }

    jump() {
        if (!this.isJumping) {
            this.velocityY = this.jumpForce;
            this.isJumping = true;
        }
    }

    collidesWith(other) {
        return this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y;
    }

    resolveCollision(platform) {
        if (platform.type === 'pole') return;

        const overlapX = Math.min(this.x + this.width, platform.x + platform.width) -
            Math.max(this.x, platform.x);
        const overlapY = Math.min(this.y + this.height, platform.y + platform.height) -
            Math.max(this.y, platform.y);

        if (overlapX < overlapY) {
            // Horizontal collision
            if (this.x < platform.x) {
                this.x = platform.x - this.width;
            } else {
                this.x = platform.x + platform.width;
            }
            this.velocityX = 0;
        } else {
            // Vertical collision
            if (this.y < platform.y) {
                this.y = platform.y - this.height;
                this.velocityY = 0;
                this.isJumping = false;
            } else {
                this.y = platform.y + platform.height;
                this.velocityY = 0;
            }
        }
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y;

        ctx.save();

        if (!this.facingRight) {
            ctx.translate(screenX + this.width / 2, 0);
            ctx.scale(-1, 1);
            ctx.translate(-(screenX + this.width / 2), 0);
        }

        // Draw Mario (simplified)
        // Hat
        ctx.fillStyle = '#E52521';
        ctx.fillRect(screenX + 8, screenY, 32, 16);
        ctx.fillRect(screenX + 4, screenY + 8, 40, 8);

        // Face
        ctx.fillStyle = '#FFDAB9';
        ctx.fillRect(screenX + 8, screenY + 16, 32, 20);

        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX + 16, screenY + 20, 4, 6);
        ctx.fillRect(screenX + 28, screenY + 20, 4, 6);

        // Mustache
        ctx.fillStyle = '#4a3000';
        ctx.fillRect(screenX + 12, screenY + 28, 24, 6);

        // Body
        ctx.fillStyle = '#E52521';
        ctx.fillRect(screenX + 8, screenY + 36, 32, 16);

        // Overalls
        ctx.fillStyle = '#049CD8';
        ctx.fillRect(screenX + 4, screenY + 44, 40, 20);

        // Legs animation
        if (Math.abs(this.velocityX) > 0.5 && !this.isJumping) {
            const legOffset = this.animationFrame === 1 ? 4 : 0;
            ctx.fillRect(screenX + 8, screenY + 54 + legOffset, 12, 10);
            ctx.fillRect(screenX + 28, screenY + 54 - legOffset, 12, 10);
        } else {
            ctx.fillRect(screenX + 8, screenY + 54, 12, 10);
            ctx.fillRect(screenX + 28, screenY + 54, 12, 10);
        }

        ctx.restore();
    }
}

// ========================================
// Platform
// ========================================

class Platform {
    constructor(x, y, width, height, type = 'ground') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;

        // Skip if off screen
        if (screenX + this.width < 0 || screenX > ctx.canvas.width) return;

        switch (this.type) {
            case 'ground':
                this.drawGround(ctx, screenX);
                break;
            case 'brick':
                this.drawBrick(ctx, screenX);
                break;
            case 'question':
                this.drawQuestion(ctx, screenX);
                break;
            case 'pipe':
                this.drawPipe(ctx, screenX);
                break;
            case 'pole':
                this.drawPole(ctx, screenX);
                break;
        }
    }

    drawGround(ctx, screenX) {
        // Top grass
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX, this.y, this.width, this.height);

        ctx.fillStyle = '#228B22';
        ctx.fillRect(screenX, this.y, this.width, 8);

        // Texture
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(screenX + 16, this.y + 16, 8, 8);
        ctx.fillRect(screenX + 40, this.y + 32, 8, 8);
    }

    drawBrick(ctx, screenX) {
        ctx.fillStyle = '#B85C38';
        ctx.fillRect(screenX, this.y, this.width, this.height);

        // Brick lines
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX + 2, this.y + 2, this.width - 4, this.height - 4);

        ctx.beginPath();
        ctx.moveTo(screenX, this.y + this.height / 2);
        ctx.lineTo(screenX + this.width, this.y + this.height / 2);
        ctx.moveTo(screenX + this.width / 2, this.y);
        ctx.lineTo(screenX + this.width / 2, this.y + this.height / 2);
        ctx.stroke();
    }

    drawQuestion(ctx, screenX) {
        ctx.fillStyle = '#FBD000';
        ctx.fillRect(screenX, this.y, this.width, this.height);

        ctx.strokeStyle = '#D4A000';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX + 2, this.y + 2, this.width - 4, this.height - 4);

        // Question mark
        ctx.fillStyle = '#000';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('?', screenX + this.width / 2, this.y + this.height - 16);
    }

    drawPipe(ctx, screenX) {
        // Pipe body
        ctx.fillStyle = '#43B047';
        ctx.fillRect(screenX + 8, this.y + 32, this.width - 16, this.height - 32);

        // Pipe top
        ctx.fillStyle = '#5DC05D';
        ctx.fillRect(screenX, this.y, this.width, 32);

        // Highlights
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(screenX + 8, this.y, 8, 32);
        ctx.fillRect(screenX + 16, this.y + 32, 8, this.height - 32);
    }

    drawPole(ctx, screenX) {
        // Pole
        ctx.fillStyle = '#808080';
        ctx.fillRect(screenX, this.y, this.width, this.height);

        // Flag
        ctx.fillStyle = '#43B047';
        ctx.beginPath();
        ctx.moveTo(screenX + this.width, this.y + 20);
        ctx.lineTo(screenX + this.width + 60, this.y + 50);
        ctx.lineTo(screenX + this.width, this.y + 80);
        ctx.fill();
    }
}

// ========================================
// Goomba Enemy
// ========================================

class Goomba {
    constructor(x, y, game) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 48;
        this.height = 48;
        this.velocityX = -1.5;
        this.velocityY = 0;
        this.gravity = 0.5;
        this.alive = true;
        this.stomped = false;
        this.stompTimer = 0;
    }

    update() {
        if (this.stomped) {
            this.stompTimer++;
            if (this.stompTimer > 30) {
                this.alive = false;
            }
            return;
        }

        // Apply gravity
        this.velocityY += this.gravity;

        // Move
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Boundary check
        if (this.y > this.game.canvas.height) {
            this.alive = false;
        }
    }

    stomp() {
        this.stomped = true;
        this.height = 16;
    }

    collidesWith(other) {
        if (!this.alive || this.stomped) return false;

        return this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y;
    }

    resolveCollision(platform) {
        if (platform.type === 'pole') return;

        const overlapY = Math.min(this.y + this.height, platform.y + platform.height) -
            Math.max(this.y, platform.y);
        const overlapX = Math.min(this.x + this.width, platform.x + platform.width) -
            Math.max(this.x, platform.x);

        if (overlapY > 0 && overlapY < this.height && this.velocityY > 0) {
            // Land on platform
            this.y = platform.y - this.height;
            this.velocityY = 0;
        } else if (overlapX > 0 && overlapX < this.width) {
            // Hit wall, reverse direction
            this.velocityX *= -1;
        }
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;

        if (screenX + this.width < 0 || screenX > ctx.canvas.width) return;

        if (this.stomped) {
            // Flat goomba
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(screenX, this.y, this.width, 16);
        } else {
            // Body
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(screenX + this.width / 2, this.y + 24, 22, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(screenX + 10, this.y + 12, 10, 12);
            ctx.fillRect(screenX + 28, this.y + 12, 10, 12);

            ctx.fillStyle = '#000000';
            ctx.fillRect(screenX + 14, this.y + 16, 5, 6);
            ctx.fillRect(screenX + 30, this.y + 16, 5, 6);

            // Feet
            ctx.fillStyle = '#000000';
            ctx.fillRect(screenX + 6, this.y + 38, 14, 10);
            ctx.fillRect(screenX + 28, this.y + 38, 14, 10);
        }
    }
}

// ========================================
// Coin Collectible
// ========================================

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.animationFrame = 0;
        this.frameCounter = 0;
        this.baseY = y;
    }

    update() {
        this.frameCounter++;
        if (this.frameCounter >= 10) {
            this.frameCounter = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
        }

        // Floating animation
        this.y = this.baseY + Math.sin(Date.now() / 300) * 3;
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;

        if (screenX + this.width < 0 || screenX > ctx.canvas.width) return;

        // Coin with rotation effect
        const scaleX = Math.abs(Math.sin(this.animationFrame * Math.PI / 4));

        ctx.save();
        ctx.translate(screenX + this.width / 2, this.y + this.height / 2);
        ctx.scale(Math.max(0.2, scaleX), 1);

        // Gold color
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        // Inner detail
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ========================================
// Initialize Game
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    window.game = new MarioGame();
});
