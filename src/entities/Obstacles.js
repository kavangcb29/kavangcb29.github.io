import { state, ctx, getEffectiveSpeed, saveProgress } from '../state.js';
import { soundEffects } from '../audio.js';
import { plane } from './Plane.js';
import { currentTheme } from '../graphics/Themes.js';
import { createParticles, createScrapeSparks, createShockwave } from './Particles.js';
import { createPipeDebris } from './Debris.js';
import { addFloatingText } from './FloatingTexts.js';
import { unlockAchievement, gameOver, winLevel, updateScoreUI } from '../ui.js';

export const obstacles = {
    list: [],
    width: 50,

    update: function () {
        if (state.frames % 120 === 0) {
            const minHeight = 50;
            const maxHeight = state.gameHeight - state.pipeGap - minHeight;
            const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);

            this.list.push({
                x: state.gameWidth,
                topHeight: topHeight,
                passed: false
            });
        }

        for (let i = 0; i < this.list.length; i++) {
            let obs = this.list[i];
            obs.x -= getEffectiveSpeed(plane);

            if (obs.destroyed) {
                continue;
            }

            const pLeft = plane.x - plane.width / 2 + 5;
            const pRight = plane.x + plane.width / 2 - 5;
            const pTop = plane.y - plane.height / 2 + 5;
            const pBottom = plane.y + plane.height / 2 - 5;

            const bottomPipeY = obs.topHeight + state.pipeGap;

            const hitTop = (pRight > obs.x && pLeft < obs.x + this.width && pTop < obs.topHeight);
            const hitBottom = (pRight > obs.x && pLeft < obs.x + this.width && pBottom > bottomPipeY);

            if (hitTop || hitBottom) {
                if (plane.shielded || plane.invincible > 0) {
                    if (plane.shielded) {
                        plane.shielded = false;
                        plane.invincible = 60;
                        obs.destroyed = true;
                        soundEffects.shieldBreak();
                        state.screenShake = 12;
                        state.shieldsBroken++;
                        saveProgress();
                        if (state.shieldsBroken >= 3) unlockAchievement('shield_master');
                        addFloatingText(plane.x, plane.y - 25, 'SHIELD BREAK!', '#00FFFF');
                        createParticles(obs.x + this.width / 2, hitTop ? obs.topHeight / 2 : bottomPipeY + 80, 25);
                        createPipeDebris(obs.x + this.width / 2, hitTop ? obs.topHeight / 2 : bottomPipeY + 80, currentTheme.pipe);
                    } else if (plane.invincible > 0) {
                        obs.destroyed = true;
                        createParticles(obs.x + this.width / 2, hitTop ? obs.topHeight / 2 : bottomPipeY + 80, 15);
                        createPipeDebris(obs.x + this.width / 2, hitTop ? obs.topHeight / 2 : bottomPipeY + 80, currentTheme.pipe);
                    }
                } else {
                    gameOver();
                }
            }

            // Aerodynamic Close-Shave & Slipstream Detection
            if (!obs.nearMissChecked && pRight > obs.x && pLeft < obs.x + this.width) {
                const distToTop = pTop - obs.topHeight;
                const distToBottom = bottomPipeY - pBottom;
                
                // Close Shave (flying within 18px of pipe rim)
                if ((distToTop > 0 && distToTop < 18) || (distToBottom > 0 && distToBottom < 18)) {
                    obs.nearMissChecked = true;
                    soundEffects.nearMiss();
                    const sparkY = distToTop < 18 ? obs.topHeight : bottomPipeY;
                    createScrapeSparks(plane.x, sparkY, -1, 0);
                    state.screenShake = 4;
                    state.streak++;
                    state.score += 2;
                    state.telemetry.nearMisses = (state.telemetry.nearMisses || 0) + 1;
                    addFloatingText(plane.x + 20, sparkY, '⚡ NEAR MISS! +2', '#FFD700');
                    updateScoreUI();
                }
                
                // Perfect Slipstream Tunnel (centered high-speed punch)
                const gapCenter = obs.topHeight + (state.pipeGap / 2);
                const distFromCenter = Math.abs(plane.y - gapCenter);
                if (distFromCenter < 20 && (plane.airspeed > 13 || plane.mach > 0.85)) {
                    obs.slipstreamChecked = true;
                    soundEffects.nearMiss();
                    createShockwave(plane.x, gapCenter, 45, 'rgba(0, 243, 255, 0.7)');
                    plane.thrust = 1.3;
                    plane.afterburner = 0.7;
                    state.score += 3;
                    addFloatingText(plane.x + 30, plane.y - 20, '⚡ SLIPSTREAM BURST! +3', '#00f3ff');
                    updateScoreUI();
                }
            }

            if (!obs.passed && plane.x > obs.x + this.width) {
                state.streak++;
                const mult = state.streak >= 15 ? 4 : (state.streak >= 10 ? 3 : (state.streak >= 5 ? 2 : 1));
                state.score += mult;
                state.obstaclesPassed++;
                soundEffects.score();
                if (mult > 1) {
                    addFloatingText(plane.x + 20, plane.y - 15, `+${mult} (STREAK x${mult}!)`, '#FF6B00');
                } else {
                    addFloatingText(plane.x + 20, plane.y - 15, '+1', '#2ECC71');
                }
                if (state.score >= 50) unlockAchievement('centurion');
                if (state.score > state.highScore) {
                    state.highScore = state.score;
                    saveProgress();
                }
                updateScoreUI();
                obs.passed = true;

                if (state.obstaclesPassed >= state.obstaclesToWin) {
                    winLevel();
                }
            }

            if (obs.x + this.width < 0) {
                this.list.shift();
                i--;
            }
        }
    },

    draw: function () {
        ctx.fillStyle = currentTheme.pipe;
        ctx.strokeStyle = currentTheme.pipeBorder;
        ctx.lineWidth = 2;

        for (let obs of this.list) {
            if (obs.destroyed) continue;

            const bottomPipeY = obs.topHeight + state.pipeGap;
            const bottomHeight = state.gameHeight - bottomPipeY;

            if (state.graphicsMode === '4k') {
                const topGrad = ctx.createLinearGradient(obs.x, 0, obs.x + this.width, 0);
                topGrad.addColorStop(0, '#555555');
                topGrad.addColorStop(0.3, '#2e2e2e');
                topGrad.addColorStop(0.7, '#1a1a1a');
                topGrad.addColorStop(1, '#0d0d0d');
                ctx.fillStyle = topGrad;
                ctx.fillRect(obs.x, 0, this.width, obs.topHeight);
                ctx.fillRect(obs.x, bottomPipeY, this.width, bottomHeight);

                ctx.fillStyle = '#666666';
                ctx.fillRect(obs.x - 3, obs.topHeight - 22, this.width + 6, 22);
                ctx.fillRect(obs.x - 3, bottomPipeY, this.width + 6, 22);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillRect(obs.x + 4, 0, 4, obs.topHeight);
                ctx.fillRect(obs.x + 4, bottomPipeY, 4, bottomHeight);

                ctx.fillStyle = '#aaaaaa';
                for (let ry = 15; ry < obs.topHeight - 10; ry += 35) {
                    ctx.beginPath();
                    ctx.arc(obs.x + 8, ry, 2.5, 0, Math.PI * 2);
                    ctx.arc(obs.x + this.width - 8, ry, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                for (let ry = bottomPipeY + 25; ry < state.gameHeight - 10; ry += 35) {
                    ctx.beginPath();
                    ctx.arc(obs.x + 8, ry, 2.5, 0, Math.PI * 2);
                    ctx.arc(obs.x + this.width - 8, ry, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (state.graphicsMode === 'retro') {
                ctx.fillStyle = '#00E436';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4;
                ctx.fillRect(obs.x, 0, this.width, obs.topHeight);
                ctx.strokeRect(obs.x, 0, this.width, obs.topHeight);
                ctx.fillRect(obs.x, bottomPipeY, this.width, bottomHeight);
                ctx.strokeRect(obs.x, bottomPipeY, this.width, bottomHeight);

                ctx.fillRect(obs.x - 4, obs.topHeight - 20, this.width + 8, 20);
                ctx.strokeRect(obs.x - 4, obs.topHeight - 20, this.width + 8, 20);
                ctx.fillRect(obs.x - 4, bottomPipeY, this.width + 8, 20);
                ctx.strokeRect(obs.x - 4, bottomPipeY, this.width + 8, 20);
            } else {
                ctx.fillStyle = currentTheme.pipe;
                ctx.strokeStyle = currentTheme.pipeBorder;
                ctx.lineWidth = 2;
                ctx.fillRect(obs.x, 0, this.width, obs.topHeight);
                ctx.strokeRect(obs.x, 0, this.width, obs.topHeight);
                ctx.fillRect(obs.x, bottomPipeY, this.width, bottomHeight);
                ctx.strokeRect(obs.x, bottomPipeY, this.width, bottomHeight);

                ctx.fillStyle = currentTheme.pipeBorder;
                ctx.fillRect(obs.x - 2, obs.topHeight - 20, this.width + 4, 20);
                ctx.fillRect(obs.x - 2, bottomPipeY, this.width + 4, 20);
            }
        }
    },

    reset: function () {
        this.list = [];
    }
};
