import { state, ctx, bgImage4K, getEffectiveSpeed } from '../state.js';
import { currentTheme } from './Themes.js';
import { plane } from '../entities/Plane.js';

export const background = {
    mountains: [],
    clouds: [],
    stars: [],
    snowflakes: [],
    layers: {
        farMountains: { x: 0, speed: 0.2 },
        nearMountains: { x: 0, speed: 0.6 }
    },
    init: function () {
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * state.gameWidth,
                y: Math.random() * (state.gameHeight / 2),
                speed: 0.1 + Math.random() * 0.2,
                size: 30 + Math.random() * 50
            });
        }
        for (let i = 0; i < 40; i++) {
            this.stars.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * (window.innerHeight * 0.6),
                size: 1 + Math.random() * 2,
                alpha: Math.random()
            });
        }
        for (let i = 0; i < 35; i++) {
            this.snowflakes.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                size: 2 + Math.random() * 3,
                vy: 1 + Math.random() * 2,
                vx: (Math.random() - 0.5) * 1
            });
        }
    },
    update: function () {
        const speedMultiplier = state.gameSpeed || 1;
        for (let c of this.clouds) {
            c.x -= c.speed * speedMultiplier;
            if (c.x + c.size * 2 < 0) c.x = state.gameWidth + c.size;
        }
        
        this.layers.farMountains.x -= this.layers.farMountains.speed * speedMultiplier;
        if (this.layers.farMountains.x <= -state.gameWidth) {
            this.layers.farMountains.x += state.gameWidth;
        }
        
        this.layers.nearMountains.x -= this.layers.nearMountains.speed * speedMultiplier;
        if (this.layers.nearMountains.x <= -state.gameWidth) {
            this.layers.nearMountains.x += state.gameWidth;
        }

        if (currentTheme.name === 'Snow') {
            for (let s of this.snowflakes) {
                s.y += s.vy;
                s.x += s.vx;
                if (s.y > state.gameHeight) {
                    s.y = -10;
                    s.x = Math.random() * state.gameWidth;
                }
            }
        }
    },
    draw: function () {
        if (state.graphicsMode === '4k' && bgImage4K.complete && bgImage4K.naturalWidth > 0) {
            ctx.save();
            const panOffset = (state.frames * 0.15) % state.gameWidth;
            ctx.drawImage(bgImage4K, -panOffset, 0, state.gameWidth + 10, state.gameHeight);
            ctx.drawImage(bgImage4K, state.gameWidth - panOffset, 0, state.gameWidth + 10, state.gameHeight);
            
            const skyGlow = ctx.createLinearGradient(0, 0, 0, state.gameHeight);
            skyGlow.addColorStop(0, 'rgba(255, 140, 0, 0.15)');
            skyGlow.addColorStop(1, 'rgba(15, 32, 39, 0.35)');
            ctx.fillStyle = skyGlow;
            ctx.fillRect(0, 0, state.gameWidth, state.gameHeight);
            ctx.restore();
            this.drawTelemetry();
            return;
        }

        if (currentTheme.name === 'Night') {
            ctx.fillStyle = '#ffffff';
            for (let s of this.stars) {
                ctx.globalAlpha = 0.4 + Math.sin(state.frames * 0.05 + s.x) * 0.4;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Offscreen Prerendering for Parallax Mountains
        if (!this.farMountainCanvas || this.lastTheme !== currentTheme.name || this.lastHeight !== state.gameHeight) {
            this.farMountainCanvas = document.createElement('canvas');
            this.farMountainCanvas.width = state.gameWidth;
            this.farMountainCanvas.height = state.gameHeight;
            const fCtx = this.farMountainCanvas.getContext('2d');
            
            fCtx.fillStyle = currentTheme.mountains;
            fCtx.globalAlpha = 0.6;
            fCtx.beginPath();
            fCtx.moveTo(0, state.gameHeight);
            fCtx.lineTo(200, state.gameHeight - 150);
            fCtx.lineTo(400, state.gameHeight - 50);
            fCtx.lineTo(600, state.gameHeight - 200);
            fCtx.lineTo(900, state.gameHeight - 100);
            fCtx.lineTo(state.gameWidth, state.gameHeight - 250);
            fCtx.lineTo(state.gameWidth, state.gameHeight);
            fCtx.fill();

            this.nearMountainCanvas = document.createElement('canvas');
            this.nearMountainCanvas.width = state.gameWidth;
            this.nearMountainCanvas.height = state.gameHeight;
            const nCtx = this.nearMountainCanvas.getContext('2d');
            
            nCtx.fillStyle = currentTheme.mountains;
            nCtx.beginPath();
            nCtx.moveTo(0, state.gameHeight);
            nCtx.lineTo(150, state.gameHeight - 100);
            nCtx.lineTo(350, state.gameHeight - 250);
            nCtx.lineTo(550, state.gameHeight - 150);
            nCtx.lineTo(800, state.gameHeight - 300);
            nCtx.lineTo(state.gameWidth, state.gameHeight - 150);
            nCtx.lineTo(state.gameWidth, state.gameHeight);
            nCtx.fill();
            
            this.lastTheme = currentTheme.name;
            this.lastHeight = state.gameHeight;
        }
        
        const fx = this.layers.farMountains.x;
        ctx.drawImage(this.farMountainCanvas, fx, 0);
        ctx.drawImage(this.farMountainCanvas, fx + state.gameWidth, 0);
        
        const nx = this.layers.nearMountains.x;
        ctx.drawImage(this.nearMountainCanvas, nx, 0);
        ctx.drawImage(this.nearMountainCanvas, nx + state.gameWidth, 0);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let c of this.clouds) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.8, c.y - c.size * 0.5, c.size * 0.9, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 1.5, c.y, c.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        if (currentTheme.name === 'Snow') {
            ctx.fillStyle = '#ffffff';
            for (let s of this.snowflakes) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        this.drawTelemetry();
    },
    
    drawTelemetry: function () {
        if (state.gameState === 'PLAYING') {
            ctx.save();
            ctx.fillStyle = state.graphicsMode === '4k' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
            ctx.font = '800 48px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const centerY = state.gameHeight / 2;
            const centerX = state.gameWidth / 2;
            
            ctx.fillText(`ALT: ${Math.floor(state.gameHeight - plane.y)}M`, centerX, centerY - 60);
            ctx.fillText(`SPD: ${Math.floor(getEffectiveSpeed(plane) * 100)} KPH`, centerX, centerY);
            ctx.fillText(`DST: ${Math.floor(state.frames / 5)}M`, centerX, centerY + 60);
            
            ctx.font = '700 24px Outfit, sans-serif';
            const engTemp = 70 + (state.streak * 5) + Math.floor(Math.abs(plane.vy || 0) * 3);
            ctx.fillText(`ENG TEMP: ${engTemp}°C | M ${state.telemetry.mach || '0.72'}`, centerX, centerY + 110);
            
            ctx.restore();
        }
    }
};
background.init();
