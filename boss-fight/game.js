// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas to fullscreen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
const game = {
    gameOver: false,
    keys: {},
    mouseX: 0,
    mouseY: 0,
    
    // Player object
    player: {
        x: 0,
        y: 0,
        radius: 20,
        velocityX: 0,
        velocityY: 0,
        speed: 6,
        health: 200,
        maxHealth: 200,
        shootCooldown: 0,
        // Healing ability
        healActive: false,
        healCooldown: 0,
        healMaxCooldown: 800,
        healAmount: 80,
        healDuration: 60,
        healDurationRemaining: 0,
        // Temporary shooting modes with durations and cooldowns
        activeMode: 0, // Current active mode (0 = none)
        modes: {
            1: { name: 'Multi Shot', duration: 0, maxDuration: 180, cooldown: 0, maxCooldown: 200 },
            2: { name: 'Minigun', duration: 0, maxDuration: 150, cooldown: 0, maxCooldown: 250 },
            3: { name: 'Ray Gun', duration: 0, maxDuration: 120, cooldown: 0, maxCooldown: 220 },
            4: { name: 'Shotgun', duration: 0, maxDuration: 200, cooldown: 0, maxCooldown: 180 },
            5: { name: 'Explosive', duration: 0, maxDuration: 150, cooldown: 0, maxCooldown: 240 },
            6: { name: 'Piercing', duration: 0, maxDuration: 180, cooldown: 0, maxCooldown: 200 },
            7: { name: 'Laser Sniper', duration: 0, maxDuration: 100, cooldown: 0, maxCooldown: 280 },
            8: { name: 'Ricochet', duration: 0, maxDuration: 160, cooldown: 0, maxCooldown: 230 },
            9: { name: 'Orbital', duration: 0, maxDuration: 200, cooldown: 0, maxCooldown: 210 }
        }
    },
    
    // Boss object
    boss: {
        x: 0,
        y: 0,
        radius: 60,
        velocityX: 2.5,
        velocityY: 2,
        health: 1200,
        maxHealth: 1200,
        attackCooldown: 0,
        attackInterval: 100,
        rotation: 0,
        attackQueue: [], // Queue for mixing attacks
        eyeStalkPhase: 0, // For animation
        activeRays: [], // Active ray beams
        isDashing: false,
        dashDuration: 0,
        dashVelocityX: 0,
        dashVelocityY: 0
    },
    
    // Projectiles
    projectiles: [],
    playerProjectiles: [],
    
    // Particles for effects
    particles: [],
    
    // Frame counter for healing
    frameCount: 0,
    healInterval: 1000,
    healAmount: 15,
    
    // Game state
    gameStarted: false,
    
    // Initialize game
    init() {
        // Set initial positions
        this.player.x = canvas.width / 2;
        this.player.y = canvas.height / 2;
        this.boss.x = canvas.width / 2;
        this.boss.y = canvas.height / 4;
        
        this.setupEventListeners();
        this.gameLoop();
    },
    
    // Start the game from menu
    startGame() {
        this.gameStarted = true;
        const menuElement = document.getElementById('mainMenu');
        menuElement.classList.add('hidden');
        
        // Reset game state
        this.gameOver = false;
        this.player.health = this.player.maxHealth;
        this.boss.health = this.boss.maxHealth;
        this.frameCount = 0;
        
        // Activate initial random mode
        this.activateRandomMode();
        
        // Clear old projectiles and particles
        this.projectiles = [];
        this.playerProjectiles = [];
        this.particles = [];
        
        this.updateUI();
    },
    
    // Event listeners for controls
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Healing ability - Q key
            if (e.key.toLowerCase() === 'q') {
                this.activateHealing();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mouse movement tracking
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
        
        // Mouse click to shoot
        canvas.addEventListener('click', (e) => {
            if (this.gameOver) return;
            
            const rect = canvas.getBoundingClientRect();
            const targetX = e.clientX - rect.left;
            const targetY = e.clientY - rect.top;
            
            this.shootProjectile(targetX, targetY);
        });
        
        // Hold mouse to shoot (for minigun and ray gun)
        let isMouseDown = false;
        canvas.addEventListener('mousedown', () => {
            isMouseDown = true;
        });
        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        // Continuous shooting for certain modes
        setInterval(() => {
            if (isMouseDown && !this.gameOver) {
                if (this.player.activeMode === 2 || this.player.activeMode === 3) {
                    if (this.player.shootCooldown <= 0) {
                        this.shootProjectile(this.mouseX, this.mouseY);
                    }
                }
            }
        }, 50);
    },
    
    // Activate random mode
    activateRandomMode() {
        // Get available modes (not on cooldown)
        const availableModes = [];
        for (let i = 1; i <= 9; i++) {
            if (this.player.modes[i].cooldown === 0) {
                availableModes.push(i);
            }
        }
        
        // If no modes available, wait
        if (availableModes.length === 0) {
            this.player.activeMode = 0;
            return;
        }
        
        // Pick random available mode
        const randomMode = availableModes[Math.floor(Math.random() * availableModes.length)];
        this.activateMode(randomMode);
    },
    
    // Activate temporary mode
    activateMode(modeNum) {
        const mode = this.player.modes[modeNum];
        
        // Check if mode is on cooldown
        if (mode.cooldown > 0) {
            return; // Can't activate while on cooldown
        }
        
        // Deactivate current mode if any
        if (this.player.activeMode !== 0) {
            this.player.modes[this.player.activeMode].duration = 0;
        }
        
        // Activate new mode
        this.player.activeMode = modeNum;
        mode.duration = mode.maxDuration;
        
        // Visual feedback
        const colors = {
            1: '#ff6600', 2: '#ffff00', 3: '#00ffff',
            4: '#ff3300', 5: '#ff9900', 6: '#00ff88',
            7: '#ff00ff', 8: '#00ff00', 9: '#8800ff'
        };
        this.createParticles(this.player.x, this.player.y, colors[modeNum], 20);
    },
    
    // Activate healing ability (Q key)
    activateHealing() {
        if (this.player.healCooldown > 0) {
            return; // Still on cooldown
        }
        
        // Check if already at max health
        if (this.player.health >= this.player.maxHealth) {
            return;
        }
        
        // Heal the player
        this.player.health = Math.min(this.player.health + this.player.healAmount, this.player.maxHealth);
        this.player.healDurationRemaining = this.player.healDuration;
        this.player.healActive = true;
        
        // Start cooldown
        this.player.healCooldown = this.player.healMaxCooldown;
        
        // Visual and audio feedback
        this.createParticles(this.player.x, this.player.y, '#00ff00', 40);
        this.updateUI();
    },
    
    // Player shoots projectile
    shootProjectile(targetX, targetY) {
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const speed = 10;
        
        // Different modes
        switch(this.player.activeMode) {
            case 1: // Multi Shot - 3 bullets in spread
                for (let i = -1; i <= 1; i++) {
                    const spreadAngle = angle + (i * 0.2);
                    this.playerProjectiles.push({
                        x: this.player.x,
                        y: this.player.y,
                        radius: 6,
                        velocityX: Math.cos(spreadAngle) * speed,
                        velocityY: Math.sin(spreadAngle) * speed,
                        damage: 10,
                        color: '#ff6600'
                    });
                }
                this.player.shootCooldown = 20;
                this.createParticles(this.player.x, this.player.y, '#ff6600', 8);
                break;
            
            case 2: // Minigun - rapid fire
                this.playerProjectiles.push({
                    x: this.player.x,
                    y: this.player.y,
                    radius: 5,
                    velocityX: Math.cos(angle) * (speed * 1.5),
                    velocityY: Math.sin(angle) * (speed * 1.5),
                    damage: 5,
                    color: '#ffff00'
                });
                this.player.shootCooldown = 3;
                this.createParticles(this.player.x, this.player.y, '#ffff00', 3);
                break;
            
            case 3: // Ray Gun - continuous beam (handled in draw/update)
                this.player.shootCooldown = 5;
                break;
            
            case 4: // Shotgun - wide spread of 7 bullets
                for (let i = -3; i <= 3; i++) {
                    const spreadAngle = angle + (i * 0.15);
                    this.playerProjectiles.push({
                        x: this.player.x,
                        y: this.player.y,
                        radius: 5,
                        velocityX: Math.cos(spreadAngle) * (speed * 0.8),
                        velocityY: Math.sin(spreadAngle) * (speed * 0.8),
                        damage: 8,
                        color: '#ff3300'
                    });
                }
                this.player.shootCooldown = 30;
                this.createParticles(this.player.x, this.player.y, '#ff3300', 15);
                break;
            
            case 5: // Explosive - bullets that create explosion on hit
                this.playerProjectiles.push({
                    x: this.player.x,
                    y: this.player.y,
                    radius: 7,
                    velocityX: Math.cos(angle) * speed,
                    velocityY: Math.sin(angle) * speed,
                    damage: 20,
                    color: '#ff9900',
                    explosive: true
                });
                this.player.shootCooldown = 25;
                this.createParticles(this.player.x, this.player.y, '#ff9900', 10);
                break;
            
            case 6: // Piercing - goes through and hits multiple times
                this.playerProjectiles.push({
                    x: this.player.x,
                    y: this.player.y,
                    radius: 6,
                    velocityX: Math.cos(angle) * (speed * 1.3),
                    velocityY: Math.sin(angle) * (speed * 1.3),
                    damage: 12,
                    color: '#00ff88',
                    piercing: true,
                    hits: 0
                });
                this.player.shootCooldown = 18;
                this.createParticles(this.player.x, this.player.y, '#00ff88', 8);
                break;
            
            case 7: // Laser Sniper - high damage, slow fire
                this.playerProjectiles.push({
                    x: this.player.x,
                    y: this.player.y,
                    radius: 4,
                    velocityX: Math.cos(angle) * (speed * 2.5),
                    velocityY: Math.sin(angle) * (speed * 2.5),
                    damage: 40,
                    color: '#ff00ff'
                });
                this.player.shootCooldown = 45;
                this.createParticles(this.player.x, this.player.y, '#ff00ff', 12);
                break;
            
            case 8: // Ricochet - bounces off walls
                this.playerProjectiles.push({
                    x: this.player.x,
                    y: this.player.y,
                    radius: 6,
                    velocityX: Math.cos(angle) * speed,
                    velocityY: Math.sin(angle) * speed,
                    damage: 12,
                    color: '#00ff00',
                    ricochet: true,
                    bounces: 0
                });
                this.player.shootCooldown = 20;
                this.createParticles(this.player.x, this.player.y, '#00ff00', 8);
                break;
            
            case 9: // Orbital - creates orbiting bullets
                const orbitCount = 4;
                for (let i = 0; i < orbitCount; i++) {
                    const orbitAngle = (Math.PI * 2 / orbitCount) * i;
                    this.playerProjectiles.push({
                        x: this.player.x,
                        y: this.player.y,
                        radius: 6,
                        velocityX: Math.cos(orbitAngle) * 4,
                        velocityY: Math.sin(orbitAngle) * 4,
                        damage: 8,
                        color: '#8800ff',
                        orbital: true,
                        orbitAngle: orbitAngle,
                        orbitDistance: 0
                    });
                }
                this.player.shootCooldown = 40;
                this.createParticles(this.player.x, this.player.y, '#8800ff', 15);
                break;
            
            default: // Normal shot
                this.playerProjectiles.push({
                    x: this.player.x,
                    y: this.player.y,
                    radius: 8,
                    velocityX: Math.cos(angle) * speed,
                    velocityY: Math.sin(angle) * speed,
                    damage: 15,
                    color: '#ffff00'
                });
                this.player.shootCooldown = 15;
                this.createParticles(this.player.x, this.player.y, '#ffff00', 5);
                break;
        }
    },
    
    // Boss attack patterns (21 total, can mix - includes player weapon modes)
    bossAttack() {
        // Randomly select 2-4 attacks to mix for high difficulty
        const numAttacks = Math.floor(Math.random() * 3) + 2;
        const patterns = [];
        
        for (let i = 0; i < numAttacks; i++) {
            patterns.push(Math.floor(Math.random() * 21));
        }
        
        patterns.forEach((pattern, index) => {
            setTimeout(() => {
                this.executeAttackPattern(pattern);
            }, index * 200);
        });
    },
    
    executeAttackPattern(pattern) {
        switch(pattern) {
            case 0: // Ray Beam from main eye
                this.createRayBeam(this.boss.x, this.boss.y, this.player.x, this.player.y, 60);
                break;
            case 1: // Ray Beams from 3 random eyestalks
                for (let i = 0; i < 5; i++) {
                    const randomEye = Math.floor(Math.random() * 10);
                    const angle = (Math.PI * 2 / 10) * randomEye + this.boss.rotation * 0.3;
                    const stalkLength = this.boss.radius + 40;
                    const stalkX = this.boss.x + Math.cos(angle) * stalkLength;
                    const stalkY = this.boss.y + Math.sin(angle) * stalkLength;
                    this.createRayBeam(stalkX, stalkY, this.player.x, this.player.y, 30);
                }
                break;
            case 2: // Spiral projectiles
                for (let i = 0; i < 24; i++) {
                    const angle = (Math.PI * 2 / 24) * i + this.boss.rotation * 10;
                    const targetX = this.boss.x + Math.cos(angle) * 500;
                    const targetY = this.boss.y + Math.sin(angle) * 500;
                    this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                }
                break;
            case 3: // Circle explosion
                for (let i = 0; i < 32; i++) {
                    const angle = (Math.PI * 2 / 32) * i;
                    const targetX = this.boss.x + Math.cos(angle) * 500;
                    const targetY = this.boss.y + Math.sin(angle) * 500;
                    this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                }
                break;
            case 4: // Wave barrage at player
                for (let i = 0; i < 15; i++) {
                    setTimeout(() => {
                        this.createBossProjectile(this.boss.x, this.boss.y, this.player.x, this.player.y);
                    }, i * 50);
                }
                break;
            case 5: // X pattern with rays
                const angles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
                angles.forEach(angle => {
                    const targetX = this.boss.x + Math.cos(angle) * 1000;
                    const targetY = this.boss.y + Math.sin(angle) * 1000;
                    this.createRayBeam(this.boss.x, this.boss.y, targetX, targetY, 45);
                });
                break;
            case 6: // Homing projectiles
                for (let i = 0; i < 10; i++) {
                    setTimeout(() => {
                        this.createHomingProjectile();
                    }, i * 80);
                }
                break;
            case 7: // Pentagon pattern
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i;
                    for (let j = 0; j < 5; j++) {
                        const targetX = this.boss.x + Math.cos(angle) * (200 + j * 100);
                        const targetY = this.boss.y + Math.sin(angle) * (200 + j * 100);
                        this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                    }
                }
                break;
            case 8: // Rotating ray sweep - all eyestalks
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI * 2 / 10) * i + this.boss.rotation * 0.3;
                    const stalkLength = this.boss.radius + 40;
                    const stalkX = this.boss.x + Math.cos(angle) * stalkLength;
                    const stalkY = this.boss.y + Math.sin(angle) * stalkLength;
                    const rayAngle = angle + this.boss.rotation;
                    const targetX = stalkX + Math.cos(rayAngle) * 1000;
                    const targetY = stalkY + Math.sin(rayAngle) * 1000;
                    this.createRayBeam(stalkX, stalkY, targetX, targetY, 35);
                }
                break;
            case 9: // Random spread chaos
                for (let i = 0; i < 40; i++) {
                    const randomAngle = Math.random() * Math.PI * 2;
                    const targetX = this.boss.x + Math.cos(randomAngle) * 500;
                    const targetY = this.boss.y + Math.sin(randomAngle) * 500;
                    this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                }
                break;
            case 10: // Alternating ray + projectile grid
                // Rays in + pattern
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI / 2) * i;
                    const targetX = this.boss.x + Math.cos(angle) * 1000;
                    const targetY = this.boss.y + Math.sin(angle) * 1000;
                    this.createRayBeam(this.boss.x, this.boss.y, targetX, targetY, 40);
                }
                // Projectiles in X pattern
                setTimeout(() => {
                    const xAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
                    xAngles.forEach(angle => {
                        for (let i = 0; i < 5; i++) {
                            const targetX = this.boss.x + Math.cos(angle) * (150 + i * 100);
                            const targetY = this.boss.y + Math.sin(angle) * (150 + i * 100);
                            this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                        }
                    });
                }, 300);
                break;
            case 11: // Dash attack toward player
                const dashAngle = Math.atan2(
                    this.player.y - this.boss.y,
                    this.player.x - this.boss.x
                );
                this.boss.isDashing = true;
                this.boss.dashDuration = 30;
                const dashSpeed = 22;
                this.boss.dashVelocityX = Math.cos(dashAngle) * dashSpeed;
                this.boss.dashVelocityY = Math.sin(dashAngle) * dashSpeed;
                this.createParticles(this.boss.x, this.boss.y, '#ff00ff', 30);
                break;
            case 12: // Multi Shot - 3 bullets spread toward player
                for (let i = -1; i <= 1; i++) {
                    const angleToPlayer = Math.atan2(
                        this.player.y - this.boss.y,
                        this.player.x - this.boss.x
                    );
                    const spreadAngle = angleToPlayer + (i * 0.2);
                    const targetX = this.boss.x + Math.cos(spreadAngle) * 500;
                    const targetY = this.boss.y + Math.sin(spreadAngle) * 500;
                    this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                }
                break;
            case 13: // Minigun - rapid barrage
                for (let i = 0; i < 12; i++) {
                    setTimeout(() => {
                        this.createBossProjectile(this.boss.x, this.boss.y, this.player.x, this.player.y);
                    }, i * 40);
                }
                break;
            case 14: // Shotgun - wide spread
                for (let i = -3; i <= 3; i++) {
                    const angleToPlayer = Math.atan2(
                        this.player.y - this.boss.y,
                        this.player.x - this.boss.x
                    );
                    const spreadAngle = angleToPlayer + (i * 0.15);
                    const targetX = this.boss.x + Math.cos(spreadAngle) * 500;
                    const targetY = this.boss.y + Math.sin(spreadAngle) * 500;
                    this.createBossProjectile(this.boss.x, this.boss.y, targetX, targetY);
                }
                break;
            case 15: // Explosive - larger projectiles
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const angle = Math.atan2(
                            this.player.y - this.boss.y,
                            this.player.x - this.boss.x
                        );
                        const speed = 4;
                        this.projectiles.push({
                            x: this.boss.x,
                            y: this.boss.y,
                            radius: 18,
                            velocityX: Math.cos(angle) * speed,
                            velocityY: Math.sin(angle) * speed,
                            damage: 20,
                            type: 'explosive'
                        });
                    }, i * 200);
                }
                break;
            case 16: // Piercing - fast straight shots
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => {
                        const angle = Math.atan2(
                            this.player.y - this.boss.y,
                            this.player.x - this.boss.x
                        );
                        const speed = 8;
                        this.projectiles.push({
                            x: this.boss.x,
                            y: this.boss.y,
                            radius: 10,
                            velocityX: Math.cos(angle) * speed,
                            velocityY: Math.sin(angle) * speed,
                            damage: 12,
                            type: 'piercing'
                        });
                    }, i * 100);
                }
                break;
            case 17: // Laser Sniper - single powerful beam
                const sniperAngle = Math.atan2(
                    this.player.y - this.boss.y,
                    this.player.x - this.boss.x
                );
                this.createRayBeam(
                    this.boss.x, this.boss.y,
                    this.boss.x + Math.cos(sniperAngle) * 1000,
                    this.boss.y + Math.sin(sniperAngle) * 1000,
                    80
                );
                break;
            case 18: // Ricochet - bouncing projectiles
                for (let i = 0; i < 6; i++) {
                    const randomAngle = Math.random() * Math.PI * 2;
                    const speed = 6;
                    this.projectiles.push({
                        x: this.boss.x,
                        y: this.boss.y,
                        radius: 10,
                        velocityX: Math.cos(randomAngle) * speed,
                        velocityY: Math.sin(randomAngle) * speed,
                        damage: 12,
                        type: 'ricochet',
                        bounces: 0
                    });
                }
                break;
            case 19: // Orbital - expanding spiral
                const orbitCount = 6;
                for (let i = 0; i < orbitCount; i++) {
                    const orbitAngle = (Math.PI * 2 / orbitCount) * i;
                    const speed = 3;
                    this.projectiles.push({
                        x: this.boss.x,
                        y: this.boss.y,
                        radius: 10,
                        velocityX: Math.cos(orbitAngle) * speed,
                        velocityY: Math.sin(orbitAngle) * speed,
                        damage: 8,
                        type: 'orbital',
                        orbitAngle: orbitAngle,
                        orbitSpeed: 0.08
                    });
                }
                break;
            case 20: // Ray Gun - sustained beam at player
                const rayAngle = Math.atan2(
                    this.player.y - this.boss.y,
                    this.player.x - this.boss.x
                );
                this.createRayBeam(
                    this.boss.x, this.boss.y,
                    this.boss.x + Math.cos(rayAngle) * 1000,
                    this.boss.y + Math.sin(rayAngle) * 1000,
                    60
                );
                break;
        }
    },
    
    // Create boss projectile
    createBossProjectile(startX, startY, targetX, targetY) {
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = 5.5;
        
        this.projectiles.push({
            x: startX,
            y: startY,
            radius: 12,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            damage: 10,
            type: 'normal'
        });
    },
    
    // Create ray beam attack
    createRayBeam(startX, startY, targetX, targetY, duration) {
        const angle = Math.atan2(targetY - startY, targetX - startX);
        
        this.boss.activeRays.push({
            startX: startX,
            startY: startY,
            angle: angle,
            length: 2000,
            width: 20,
            duration: duration,
            damage: 15
        });
    },
    
    // Create homing projectile
    createHomingProjectile() {
        const angle = Math.random() * Math.PI * 2;
        const distance = 200;
        
        this.projectiles.push({
            x: this.boss.x + Math.cos(angle) * distance,
            y: this.boss.y + Math.sin(angle) * distance,
            radius: 10,
            velocityX: 0,
            velocityY: 0,
            damage: 12,
            type: 'homing',
            speed: 4
        });
    },
    
    // Create particle effect
    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                velocityX: (Math.random() - 0.5) * 6,
                velocityY: (Math.random() - 0.5) * 6,
                size: Math.random() * 4 + 2,
                color: color,
                life: 30
            });
        }
    },
    
    // Update game state
    update() {
        if (!this.gameStarted || this.gameOver) return;
        
        // Increment frame counter
        this.frameCount++;
        
        // Heal player every 1000 frames
        if (this.frameCount % this.healInterval === 0) {
            const oldHealth = this.player.health;
            this.player.health = Math.min(this.player.maxHealth, this.player.health + this.healAmount);
            
            // Visual feedback if healed
            if (this.player.health > oldHealth) {
                this.createParticles(this.player.x, this.player.y, '#00ff00', 20);
                this.updateUI();
            }
        }
        
        // Player movement with WASD
        this.player.velocityX = 0;
        this.player.velocityY = 0;
        
        if (this.keys['w']) this.player.velocityY = -this.player.speed;
        if (this.keys['s']) this.player.velocityY = this.player.speed;
        if (this.keys['a']) this.player.velocityX = -this.player.speed;
        if (this.keys['d']) this.player.velocityX = this.player.speed;
        
        // Normalize diagonal movement
        if (this.player.velocityX !== 0 && this.player.velocityY !== 0) {
            this.player.velocityX *= 0.707;
            this.player.velocityY *= 0.707;
        }
        
        // Update player position
        this.player.x += this.player.velocityX;
        this.player.y += this.player.velocityY;
        
        // Keep player in bounds
        this.player.x = Math.max(this.player.radius, Math.min(canvas.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(canvas.height - this.player.radius, this.player.y));
        
        // Update cooldowns
        if (this.player.shootCooldown > 0) this.player.shootCooldown--;
        if (this.player.healCooldown > 0) this.player.healCooldown--;
        
        // Update heal duration for visual effect
        if (this.player.healDurationRemaining > 0) this.player.healDurationRemaining--;
        
        // Update mode durations and cooldowns
        if (this.player.activeMode !== 0) {
            const activeMode = this.player.modes[this.player.activeMode];
            activeMode.duration--;
            
            if (activeMode.duration <= 0) {
                // Mode duration expired, deactivate and start cooldown
                activeMode.cooldown = activeMode.maxCooldown;
                this.createParticles(this.player.x, this.player.y, '#ffffff', 10);
                
                // Immediately activate a new random mode
                this.activateRandomMode();
            }
        } else {
            // If no active mode, try to activate one
            this.activateRandomMode();
        }
        
        // Update all mode cooldowns
        for (let i = 1; i <= 9; i++) {
            if (this.player.modes[i].cooldown > 0) {
                this.player.modes[i].cooldown--;
            }
        }
        
        // Boss dash attack handling
        if (this.boss.isDashing) {
            this.boss.dashDuration--;
            this.boss.x += this.boss.dashVelocityX;
            this.boss.y += this.boss.dashVelocityY;
            
            // Create dash trail particles
            this.createParticles(this.boss.x, this.boss.y, '#ff00ff', 5);
            
            // Check collision with player during dash
            if (this.checkCircleCollision(this.boss, this.player)) {
                this.player.health -= 40;
                this.createParticles(this.player.x, this.player.y, '#ff0000', 20);
                this.updateUI();
                
                if (this.player.health <= 0) {
                    this.endGame(false);
                }
                
                // End dash on collision
                this.boss.isDashing = false;
                this.boss.dashDuration = 0;
            }
            
            // End dash when duration expires
            if (this.boss.dashDuration <= 0) {
                this.boss.isDashing = false;
            }
        } else {
            // Normal boss movement
            this.boss.x += this.boss.velocityX;
            this.boss.y += this.boss.velocityY;
        }
        
        // Boss boundaries
        if (this.boss.x <= this.boss.radius + 150 || this.boss.x >= canvas.width - this.boss.radius - 150) {
            this.boss.velocityX *= -1;
            // Stop dash if hitting wall
            if (this.boss.isDashing) {
                this.boss.isDashing = false;
                this.boss.dashDuration = 0;
            }
        }
        
        if (this.boss.y <= this.boss.radius + 100 || this.boss.y >= canvas.height / 2) {
            this.boss.velocityY *= -1;
            // Stop dash if hitting wall
            if (this.boss.isDashing) {
                this.boss.isDashing = false;
                this.boss.dashDuration = 0;
            }
        }
        
        // Update boss orbitals
        this.boss.rotation += 0.03;
        
        // Update eyestalk animation
        this.boss.eyeStalkPhase += 0.12;
        
        // Boss attacks
        this.boss.attackCooldown++;
        if (this.boss.attackCooldown >= this.boss.attackInterval) {
            this.bossAttack();
            this.boss.attackCooldown = 0;
        }
        
        // Update active ray beams
        this.boss.activeRays = this.boss.activeRays.filter(ray => {
            ray.duration--;
            
            // Check collision with player using line-circle intersection
            const rayLength = 1000;
            const rayEndX = ray.x + Math.cos(ray.angle) * rayLength;
            const rayEndY = ray.y + Math.sin(ray.angle) * rayLength;
            
            // Calculate closest point on ray to player
            const dx = rayEndX - ray.x;
            const dy = rayEndY - ray.y;
            const t = Math.max(0, Math.min(1, 
                ((this.player.x - ray.x) * dx + (this.player.y - ray.y) * dy) / (dx * dx + dy * dy)
            ));
            const closestX = ray.x + t * dx;
            const closestY = ray.y + t * dy;
            
            // Check if closest point is within player radius
            const distToPlayer = Math.sqrt(
                (closestX - this.player.x) ** 2 + (closestY - this.player.y) ** 2
            );
            
            if (distToPlayer < this.player.radius + 8) {
                // Ray hits player
                this.player.health -= 1; // Continuous damage per frame
                this.createParticles(closestX, closestY, '#ff4444', 3);
                this.updateUI();
                
                if (this.player.health <= 0) {
                    this.endGame(false);
                }
            }
            
            return ray.duration > 0;
        });
        
        // Update boss projectiles
        this.projectiles = this.projectiles.filter(proj => {
            // Homing projectile tracking
            if (proj.type === 'homing') {
                const angleToPlayer = Math.atan2(
                    this.player.y - proj.y,
                    this.player.x - proj.x
                );
                const currentAngle = Math.atan2(proj.velocityY, proj.velocityX);
                const speed = Math.sqrt(proj.velocityX ** 2 + proj.velocityY ** 2);
                
                // Gradually turn toward player (turnRate controls responsiveness)
                const turnRate = 0.08;
                let angleDiff = angleToPlayer - currentAngle;
                
                // Normalize angle difference to -PI to PI
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                const newAngle = currentAngle + angleDiff * turnRate;
                proj.velocityX = Math.cos(newAngle) * speed;
                proj.velocityY = Math.sin(newAngle) * speed;
            }
            
            // Orbital projectiles curve
            if (proj.type === 'orbital') {
                proj.orbitAngle += proj.orbitSpeed;
                const speed = Math.sqrt(proj.velocityX ** 2 + proj.velocityY ** 2);
                proj.velocityX = Math.cos(proj.orbitAngle) * speed;
                proj.velocityY = Math.sin(proj.orbitAngle) * speed;
            }
            
            // Ricochet off walls
            if (proj.type === 'ricochet') {
                if (proj.x <= 0 || proj.x >= canvas.width) {
                    proj.velocityX *= -1;
                    proj.bounces++;
                    this.createParticles(proj.x, proj.y, '#ff00ff', 5);
                }
                if (proj.y <= 0 || proj.y >= canvas.height) {
                    proj.velocityY *= -1;
                    proj.bounces++;
                    this.createParticles(proj.x, proj.y, '#ff00ff', 5);
                }
                // Remove after 4 bounces
                if (proj.bounces > 4) {
                    return false;
                }
            }
            
            const timeSlowMultiplier = this.player.timeSlowActive ? 0.3 : 1;
            proj.x += proj.velocityX * timeSlowMultiplier;
            proj.y += proj.velocityY * timeSlowMultiplier;
            
            // Check collision with player (shield blocks damage)
            if (this.checkCircleCollision(proj, this.player)) {
                if (!this.player.shieldActive) {
                    this.player.health -= proj.damage;
                    this.createParticles(proj.x, proj.y, '#ff4444', 10);
                    
                    // Explosive creates extra damage zone
                    if (proj.type === 'explosive') {
                        this.createParticles(proj.x, proj.y, '#ff9900', 30);
                        for (let i = 0; i < 8; i++) {
                            const angle = (Math.PI * 2 / 8) * i;
                            this.createParticles(
                                proj.x + Math.cos(angle) * 30,
                                proj.y + Math.sin(angle) * 30,
                                '#ff6600', 10
                            );
                        }
                    }
                    
                    this.updateUI();
                    
                    if (this.player.health <= 0) {
                        this.endGame(false);
                    }
                } else {
                    this.createParticles(proj.x, proj.y, '#00ff00', 15);
                }
                
                // Piercing continues through
                if (proj.type === 'piercing') {
                    return true;
                }
                
                return false;
            }
            
            // Remove if out of bounds (except ricochet)
            if (proj.type !== 'ricochet') {
                return proj.x > -50 && proj.x < canvas.width + 50 && 
                       proj.y > -50 && proj.y < canvas.height + 50;
            }
            return true;
        });
        
        // Update player projectiles
        this.playerProjectiles = this.playerProjectiles.filter(proj => {
            // Orbital projectiles behavior
            if (proj.orbital) {
                proj.orbitAngle += 0.1;
                proj.orbitDistance += 2;
                const centerX = this.player.x;
                const centerY = this.player.y;
                proj.x = centerX + Math.cos(proj.orbitAngle) * proj.orbitDistance;
                proj.y = centerY + Math.sin(proj.orbitAngle) * proj.orbitDistance;
                
                // Remove if too far from player
                if (proj.orbitDistance > 300) {
                    return false;
                }
            } else {
                // Normal movement
                proj.x += proj.velocityX;
                proj.y += proj.velocityY;
            }
            
            // Ricochet off walls
            if (proj.ricochet) {
                if (proj.x <= 0 || proj.x >= canvas.width) {
                    proj.velocityX *= -1;
                    proj.bounces++;
                    this.createParticles(proj.x, proj.y, proj.color, 5);
                }
                if (proj.y <= 0 || proj.y >= canvas.height) {
                    proj.velocityY *= -1;
                    proj.bounces++;
                    this.createParticles(proj.x, proj.y, proj.color, 5);
                }
                // Remove after 3 bounces
                if (proj.bounces > 3) {
                    return false;
                }
            }
            
            // Check collision with boss
            if (this.checkCircleCollision(proj, this.boss)) {
                this.boss.health -= proj.damage;
                this.createParticles(proj.x, proj.y, '#00ff00', 15);
                this.updateUI();
                
                // Explosive creates AoE damage
                if (proj.explosive) {
                    // Extra particles for explosion
                    this.createParticles(proj.x, proj.y, '#ff9900', 30);
                    for (let i = 0; i < 8; i++) {
                        const angle = (Math.PI * 2 / 8) * i;
                        this.createParticles(
                            proj.x + Math.cos(angle) * 30,
                            proj.y + Math.sin(angle) * 30,
                            '#ff6600', 10
                        );
                    }
                }
                
                // Piercing goes through
                if (proj.piercing) {
                    proj.hits++;
                    if (proj.hits >= 3) {
                        return false;
                    }
                    return true; // Continue through
                }
                
                if (this.boss.health <= 0) {
                    this.endGame(true);
                }
                return false;
            }
            
            // Remove if out of bounds (except ricochet)
            if (!proj.ricochet) {
                return proj.x > -50 && proj.x < canvas.width + 50 && 
                       proj.y > -50 && proj.y < canvas.height + 50;
            }
            return true;
        });
        
        // Player ray gun damage
        if (this.player.activeMode === 3) {
            // Check if ray gun beam intersects boss using line-circle intersection
            const dx = this.mouseX - this.player.x;
            const dy = this.mouseY - this.player.y;
            const t = Math.max(0, Math.min(1,
                ((this.boss.x - this.player.x) * dx + (this.boss.y - this.player.y) * dy) / (dx * dx + dy * dy)
            ));
            const closestX = this.player.x + t * dx;
            const closestY = this.player.y + t * dy;
            
            const distToBoss = Math.sqrt(
                (closestX - this.boss.x) ** 2 + (closestY - this.boss.y) ** 2
            );
            
            if (distToBoss < this.boss.radius + 6) {
                // Ray gun hits boss - continuous damage
                this.boss.health -= 0.3;
                this.createParticles(closestX, closestY, '#00ffff', 2);
                this.updateUI();
                
                if (this.boss.health <= 0) {
                    this.endGame(true);
                }
            }
        }
        
        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.velocityX *= 0.98;
            particle.velocityY *= 0.98;
            particle.life--;
            return particle.life > 0;
        });
    },
    
    // Check collision between two circles
    checkCircleCollision(circle1, circle2) {
        const dx = circle1.x - circle2.x;
        const dy = circle1.y - circle2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < circle1.radius + circle2.radius;
    },
    
    // Draw game
    draw() {
        if (!this.gameStarted) return;
        
        // Clear canvas with gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        if (this.player.timeSlowActive) {
            gradient.addColorStop(0, '#150a25');
            gradient.addColorStop(1, '#2a1040');
        } else {
            gradient.addColorStop(0, '#0a0015');
            gradient.addColorStop(1, '#1a0030');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw background stars
        this.drawStars();
        
        // Draw boss
        this.drawBoss();
        
        // Draw player
        this.drawPlayer();
        
        // Draw boss projectiles
        this.projectiles.forEach(proj => {
            // Different colors based on projectile type
            let color = '#ff00ff'; // default magenta
            if (proj.type === 'homing') color = '#ff0000'; // red
            else if (proj.type === 'explosive') color = '#ff9900'; // orange
            else if (proj.type === 'piercing') color = '#00ff88'; // cyan-green
            else if (proj.type === 'ricochet') color = '#00ff00'; // green
            else if (proj.type === 'orbital') color = '#8800ff'; // purple
            
            ctx.fillStyle = color;
            ctx.shadowBlur = 20;
            ctx.shadowColor = color;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        
        // Draw boss ray beams
        this.boss.activeRays.forEach(ray => {
            const rayLength = 1000;
            const endX = ray.x + Math.cos(ray.angle) * rayLength;
            const endY = ray.y + Math.sin(ray.angle) * rayLength;
            
            // Outer glow
            ctx.strokeStyle = '#ff0044';
            ctx.lineWidth = 15;
            ctx.globalAlpha = 0.3;
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ff0044';
            ctx.beginPath();
            ctx.moveTo(ray.x, ray.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Inner beam
            ctx.strokeStyle = '#ff6666';
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.8;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.moveTo(ray.x, ray.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Core beam
            ctx.strokeStyle = '#ffaaaa';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(ray.x, ray.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        });
        
        // Draw player projectiles
        this.playerProjectiles.forEach(proj => {
            ctx.fillStyle = proj.color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = proj.color;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        
        // Draw player ray gun beam
        if (this.player.activeMode === 3) {
            // Outer glow
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 12;
            ctx.globalAlpha = 0.3;
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(this.player.x, this.player.y);
            ctx.lineTo(this.mouseX, this.mouseY);
            ctx.stroke();
            
            // Inner beam
            ctx.strokeStyle = '#66ffff';
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.7;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(this.player.x, this.player.y);
            ctx.lineTo(this.mouseX, this.mouseY);
            ctx.stroke();
            
            // Core beam
            ctx.strokeStyle = '#aaffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(this.player.x, this.player.y);
            ctx.lineTo(this.mouseX, this.mouseY);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
        
        // Draw particles
        this.particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.life / 30;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        
        // Draw mode UI
        this.drawModeUI();
    },
    
    // Draw stars background
    drawStars() {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 100; i++) {
            const x = (i * 137.5) % canvas.width;
            const y = (i * 79.3) % canvas.height;
            const size = (i % 3) + 1;
            ctx.fillRect(x, y, size, size);
        }
    },
    
    // Draw mode UI
    drawModeUI() {
        const startX = 20;
        const startY = canvas.height - 180;
        const boxWidth = 100;
        const boxHeight = 16;
        const spacing = 2;
        
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        
        for (let i = 1; i <= 9; i++) {
            const mode = this.player.modes[i];
            const y = startY + (i - 1) * (boxHeight + spacing);
            
            // Mode background
            if (this.player.activeMode === i) {
                // Active mode
                ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
            } else if (mode.cooldown > 0) {
                // On cooldown
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            } else {
                // Ready
                ctx.fillStyle = 'rgba(100, 100, 255, 0.2)';
            }
            ctx.fillRect(startX, y, boxWidth, boxHeight);
            
            // Progress bar
            if (this.player.activeMode === i) {
                // Duration bar
                const progress = mode.duration / mode.maxDuration;
                ctx.fillStyle = 'rgba(0, 255, 100, 0.7)';
                ctx.fillRect(startX, y, boxWidth * progress, boxHeight);
            } else if (mode.cooldown > 0) {
                // Cooldown bar
                const progress = 1 - (mode.cooldown / mode.maxCooldown);
                ctx.fillStyle = 'rgba(100, 100, 255, 0.5)';
                ctx.fillRect(startX, y, boxWidth * progress, boxHeight);
            }
            
            // Border
            ctx.strokeStyle = this.player.activeMode === i ? '#00ff00' : 
                             mode.cooldown > 0 ? '#ff0000' : '#6666ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(startX, y, boxWidth, boxHeight);
            
            // Text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${i}: ${mode.name.substring(0, 8)}`, startX + 3, y + 11);
        }
        
        // Draw heal ability indicator
        const healY = startY + 180;
        ctx.fillStyle = this.player.healCooldown > 0 ? 'rgba(100, 50, 50, 0.3)' : 'rgba(0, 100, 0, 0.3)';
        ctx.fillRect(startX, healY, boxWidth, boxHeight);
        
        if (this.player.healCooldown > 0) {
            const healProgress = 1 - (this.player.healCooldown / this.player.healMaxCooldown);
            ctx.fillStyle = 'rgba(100, 200, 100, 0.6)';
            ctx.fillRect(startX, healY, boxWidth * healProgress, boxHeight);
        } else {
            ctx.fillStyle = 'rgba(0, 255, 100, 0.7)';
            ctx.fillRect(startX, healY, boxWidth, boxHeight);
        }
        
        ctx.strokeStyle = this.player.healCooldown > 0 ? '#ff6666' : '#00ff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, healY, boxWidth, boxHeight);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Q: Heal ${this.player.healAmount}`, startX + 3, healY + 11);
        
        ctx.textAlign = 'left';
    },
    
    // Draw player
    drawPlayer() {
        const p = this.player;
        
        // Shield effect
        if (p.shieldActive) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff00';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Dash trail effect
        if (p.dashDuration > 0) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Healing aura effect
        if (p.healDurationRemaining > 0) {
            const healProgress = p.healDurationRemaining / p.healDuration;
            ctx.globalAlpha = healProgress * 0.6;
            ctx.fillStyle = '#00ff00';
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#00ff00';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }
        
        // Main body - simple circle
        ctx.fillStyle = '#00aaff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00aaff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Glow effect
        ctx.strokeStyle = '#00ddff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
    },
    
    // Draw boss as D&D Beholder
    drawBoss() {
        const b = this.boss;
        
        // Dash effect - glowing aura when dashing
        if (b.isDashing) {
            // Outer glow ring
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.5;
            ctx.shadowBlur = 40;
            ctx.shadowColor = '#ff00ff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 20, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner glow ring
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.7;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
        
        // Draw eyestalks (10 of them)
        const eyeStalkCount = 10;
        for (let i = 0; i < eyeStalkCount; i++) {
            const angle = (Math.PI * 2 / eyeStalkCount) * i + this.boss.rotation * 0.3;
            // Add wave animation to stalk length - each stalk waves independently
            const waveOffset = Math.sin(this.boss.eyeStalkPhase + i * 0.6) * 15;
            const stalkLength = b.radius + 40 + waveOffset;
            const stalkX = b.x + Math.cos(angle) * stalkLength;
            const stalkY = b.y + Math.sin(angle) * stalkLength;
            
            // Stalk with curved animation
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            
            // Add bezier curve for wavy effect
            const midX = b.x + Math.cos(angle) * (stalkLength * 0.5);
            const midY = b.y + Math.sin(angle) * (stalkLength * 0.5);
            const curveOffset = Math.sin(this.boss.eyeStalkPhase * 1.5 + i) * 10;
            const controlX = midX + Math.cos(angle + Math.PI / 2) * curveOffset;
            const controlY = midY + Math.sin(angle + Math.PI / 2) * curveOffset;
            
            ctx.quadraticCurveTo(controlX, controlY, stalkX, stalkY);
            ctx.stroke();
            
            // Eye symbol at end of stalk (monocolored logo style)
            ctx.fillStyle = '#ff3333';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff3333';
            
            // Eye shape (almond/oval)
            ctx.beginPath();
            ctx.ellipse(stalkX, stalkY, 10, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupil (simple circle in center)
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(stalkX, stalkY, 3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }
        
        // Main body sphere
        ctx.fillStyle = '#8b008b';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#8b008b';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Texture on body
        ctx.fillStyle = '#9932cc';
        ctx.beginPath();
        ctx.arc(b.x - 15, b.y - 15, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x + 20, b.y - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x + 10, b.y + 20, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Large central eye (monocolored logo style)
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffff00';
        
        // Eye shape (almond/oval)
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.radius * 0.55, b.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupil (simple circle in center)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Boss outer glow
        ctx.strokeStyle = '#9932cc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    },
    
    // Update UI
    updateUI() {
        // Update health bars
        const playerHealthPercent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('playerHealth').style.width = playerHealthPercent + '%';
        document.getElementById('playerHealthText').textContent = 
            Math.max(0, this.player.health) + '/' + this.player.maxHealth;
        
        const bossHealthPercent = (this.boss.health / this.boss.maxHealth) * 100;
        document.getElementById('bossHealth').style.width = bossHealthPercent + '%';
        document.getElementById('bossHealthText').textContent = 
            Math.max(0, this.boss.health) + '/' + this.boss.maxHealth;
    },
    
    // End game
    endGame(playerWon) {
        this.gameOver = true;
        const gameOverDiv = document.getElementById('gameOver');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        
        if (playerWon) {
            title.textContent = '🎉 VICTORY! 🎉';
            title.style.color = '#4caf50';
            message.textContent = 'You defeated the Beholder!';
        } else {
            title.textContent = '💀 DEFEATED 💀';
            title.style.color = '#f44336';
            message.textContent = 'The Beholder\'s gaze consumed you...';
        }
        
        gameOverDiv.style.display = 'block';
    },
    
    // Restart game
    restart() {
        // Reset player
        this.player.x = canvas.width / 2;
        this.player.y = canvas.height / 2;
        this.player.velocityY = 0;
        this.player.velocityX = 0;
        this.player.health = this.player.maxHealth;
        this.player.shootCooldown = 0;
        this.frameCount = 0;
        
        // Reset boss
        this.boss.x = canvas.width / 2;
        this.boss.y = canvas.height / 4;
        this.boss.velocityX = 2.5;
        this.boss.velocityY = 2;
        this.boss.health = this.boss.maxHealth;
        this.boss.attackCooldown = 0;
        this.boss.rotation = 0;
        this.boss.activeRays = [];
        
        // Reset game state
        this.gameOver = false;
        this.gameStarted = false;
        this.projectiles = [];
        this.playerProjectiles = [];
        this.particles = [];
        
        // Hide game over screen and show menu
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('mainMenu').classList.remove('hidden');
        
        // Update UI
        this.updateUI();
    },
    
    // Main game loop
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
};

// Start game when page loads
window.addEventListener('load', () => {
    game.init();
});
