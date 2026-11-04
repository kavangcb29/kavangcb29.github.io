import { state, ctx, saveProgress, canvas } from './state.js';
import { soundEffects, toggleMusic } from './audio.js';
import { currentTheme, setCurrentTheme } from './graphics/Themes.js';
import { plane } from './entities/Plane.js';
import { obstacles } from './entities/Obstacles.js';
import { collectibles } from './entities/Collectibles.js';
import { createParticles, createFireworks, resetParticles } from './entities/Particles.js';
import { resetDebris } from './entities/Debris.js';
import { resetFloatingTexts } from './entities/FloatingTexts.js';

const achievements = [
    { id: 'first_flight', name: 'First Flight', desc: 'Complete Level 1', icon: '✈️', unlocked: false },
    { id: 'coin_collector', name: 'Coin Collector', desc: 'Collect 10 Coins total', icon: '💰', unlocked: false },
    { id: 'shield_master', name: 'Shield Master', desc: 'Break 3 Pipes with a Shield', icon: '🛡️', unlocked: false },
    { id: 'night_owl', name: 'Night Owl', desc: 'Reach Level 11 (Night Theme)', icon: '🌙', unlocked: false },
    { id: 'centurion', name: 'Centurion', desc: 'Score 50 points in one run', icon: '👑', unlocked: false }
];

const savedAchievements = JSON.parse(localStorage.getItem('flappy_achievements') || '[]');
achievements.forEach(a => {
    if (savedAchievements.includes(a.id)) a.unlocked = true;
});

export function unlockAchievement(id) {
    const ach = achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
        ach.unlocked = true;
        savedAchievements.push(id);
        localStorage.setItem('flappy_achievements', JSON.stringify(savedAchievements));
        soundEffects.achievement();
        showAchievementToast(ach.name);
    }
}

function showAchievementToast(name) {
    const toast = document.getElementById('achievement-toast');
    const descEl = document.getElementById('toast-desc');
    if (toast && descEl) {
        descEl.innerText = name;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
    }
}

// UI Elements
const homeScreen = document.getElementById('home-screen');
const levelScreen = document.getElementById('level-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const completedLevelElement = document.getElementById('completed-level');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const finalScoreElement = document.getElementById('final-score');
const levelGrid = document.getElementById('level-grid');
const trophiesScreen = document.getElementById('trophies-screen');
const trophyList = document.getElementById('trophy-list');
const pauseScreen = document.getElementById('pause-screen');
const cinematicScreen = document.getElementById('cinematic-screen');
const heroPreviewBanner = document.getElementById('hero-preview-banner');
const closeCinematicBtn = document.getElementById('close-cinematic-btn');

const homePlayBtn = document.getElementById('home-play-btn');
const levelsBtn = document.getElementById('levels-btn');
const trophiesBtn = document.getElementById('trophies-btn');
const backTrophiesBtn = document.getElementById('back-trophies-btn');
const backHomeBtn = document.getElementById('back-home-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const homeBtnComplete = document.getElementById('home-btn-complete');

const pauseBtn = document.getElementById('pause-btn');
const musicToggleBtn = document.getElementById('music-toggle-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const pauseHomeBtn = document.getElementById('pause-home-btn');

const homeHighScoreElement = document.getElementById('home-high-score');
const gameoverHighScoreElement = document.getElementById('gameover-high-score');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const soundToggleBtn = document.getElementById('sound-toggle-btn');

// Leaderboard UI Elements
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const leaderboardList = document.getElementById('leaderboard-list');

// Mock Global Leaderboard Data (Simulates API)
let mockGlobalLeaderboard = [
    { name: "Maverick", score: 9999 },
    { name: "SkyKing", score: 8500 },
    { name: "NeonRider", score: 7200 },
    { name: "CloudSurfer", score: 5400 },
    { name: "NoobPilot", score: 1500 }
];

async function fetchLeaderboard() {
    leaderboardList.innerHTML = '<div class="leaderboard-loading">Loading scores...</div>';
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // In a real app, this would be a fetch() call to a backend
    const localHigh = state.highScore;
    let combined = [...mockGlobalLeaderboard];
    
    if (localHigh > 0) {
        // Add player to the list if they have a score
        combined.push({ name: "YOU", score: localHigh, isPlayer: true });
    }
    
    combined.sort((a, b) => b.score - a.score);
    
    leaderboardList.innerHTML = '';
    combined.slice(0, 10).forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = `leaderboard-item ${index < 3 ? 'rank-' + (index + 1) : ''}`;
        if (entry.isPlayer) item.style.border = '2px solid #f72585';
        
        item.innerHTML = `
            <span>#${index + 1} ${entry.name}</span>
            <span>${entry.score} pts</span>
        `;
        leaderboardList.appendChild(item);
    });
}

// Settings Logic
const settingsBtn = document.getElementById('settings-btn');
const settingsScreen = document.getElementById('settings-screen');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');

const uiThemeSelect = document.getElementById('ui-theme-select');
const spaceActionSelect = document.getElementById('spacebar-action-select');
const flightModelSelect = document.getElementById('flight-model-select');
const hudModeSelect = document.getElementById('hud-mode-select');
const groundEffectSlider = document.getElementById('ground-effect-slider');
const turbulenceSlider = document.getElementById('turbulence-slider');
const gameSpeedSlider = document.getElementById('game-speed-slider');
const gravitySlider = document.getElementById('gravity-slider');
const jumpSlider = document.getElementById('jump-slider');
const gapSlider = document.getElementById('gap-slider');
const hudToggleBtn = document.getElementById('hud-toggle-btn');

function applySettingsUI() {
    uiThemeSelect.value = state.uiTheme;
    spaceActionSelect.value = state.spacebarAction;
    if (flightModelSelect) flightModelSelect.value = state.flightModel || 'realistic';
    if (hudModeSelect) hudModeSelect.value = state.hudMode || 'tactical';
    if (groundEffectSlider) {
        groundEffectSlider.value = state.groundEffectStrength;
        const geVal = document.getElementById('ground-effect-val');
        if (geVal) geVal.innerText = state.groundEffectStrength;
    }
    if (turbulenceSlider) {
        turbulenceSlider.value = state.windTurbulence;
        const turbVal = document.getElementById('turbulence-val');
        if (turbVal) turbVal.innerText = state.windTurbulence;
    }
    gameSpeedSlider.value = state.gameSpeed;
    gravitySlider.value = state.gravity;
    jumpSlider.value = state.jumpStrength;
    gapSlider.value = state.pipeGap;
    
    document.getElementById('speed-val').innerText = state.gameSpeed;
    document.getElementById('gravity-val').innerText = state.gravity;
    document.getElementById('jump-val').innerText = state.jumpStrength;
    document.getElementById('gap-val').innerText = state.pipeGap;
    
    if (state.uiTheme === 'light') document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');
}

if (flightModelSelect) {
    flightModelSelect.addEventListener('change', (e) => {
        state.flightModel = e.target.value;
        localStorage.setItem('flappy_flight_model', state.flightModel);
    });
}

if (hudModeSelect) {
    hudModeSelect.addEventListener('change', (e) => {
        state.hudMode = e.target.value;
        localStorage.setItem('flappy_hud_mode', state.hudMode);
    });
}

if (groundEffectSlider) {
    groundEffectSlider.addEventListener('input', (e) => {
        state.groundEffectStrength = parseFloat(e.target.value);
        const geVal = document.getElementById('ground-effect-val');
        if (geVal) geVal.innerText = state.groundEffectStrength;
        localStorage.setItem('flappy_ground_effect', state.groundEffectStrength);
    });
}

if (turbulenceSlider) {
    turbulenceSlider.addEventListener('input', (e) => {
        state.windTurbulence = parseFloat(e.target.value);
        const turbVal = document.getElementById('turbulence-val');
        if (turbVal) turbVal.innerText = state.windTurbulence;
        localStorage.setItem('flappy_turbulence', state.windTurbulence);
    });
}

uiThemeSelect.addEventListener('change', (e) => {
    state.uiTheme = e.target.value;
    localStorage.setItem('flappy_ui_theme', state.uiTheme);
    applySettingsUI();
});

spaceActionSelect.addEventListener('change', (e) => {
    state.spacebarAction = e.target.value;
    localStorage.setItem('flappy_space_action', state.spacebarAction);
});

gameSpeedSlider.addEventListener('input', (e) => {
    state.gameSpeed = parseFloat(e.target.value);
    document.getElementById('speed-val').innerText = state.gameSpeed;
    localStorage.setItem('flappy_game_speed', state.gameSpeed);
});

gravitySlider.addEventListener('input', (e) => {
    state.gravity = parseFloat(e.target.value);
    document.getElementById('gravity-val').innerText = state.gravity;
    localStorage.setItem('flappy_gravity', state.gravity);
});

jumpSlider.addEventListener('input', (e) => {
    state.jumpStrength = parseFloat(e.target.value);
    document.getElementById('jump-val').innerText = state.jumpStrength;
    localStorage.setItem('flappy_jump', state.jumpStrength);
});

gapSlider.addEventListener('input', (e) => {
    state.pipeGap = parseInt(e.target.value, 10);
    document.getElementById('gap-val').innerText = state.pipeGap;
    localStorage.setItem('flappy_pipe_gap', state.pipeGap);
});

resetSettingsBtn.addEventListener('click', () => {
    localStorage.removeItem('flappy_ui_theme');
    localStorage.removeItem('flappy_space_action');
    localStorage.removeItem('flappy_flight_model');
    localStorage.removeItem('flappy_hud_mode');
    localStorage.removeItem('flappy_ground_effect');
    localStorage.removeItem('flappy_turbulence');
    localStorage.removeItem('flappy_game_speed');
    localStorage.removeItem('flappy_gravity');
    localStorage.removeItem('flappy_jump');
    localStorage.removeItem('flappy_pipe_gap');
    
    state.uiTheme = 'dark';
    state.spacebarAction = 'flap';
    state.flightModel = 'realistic';
    state.hudMode = 'tactical';
    state.groundEffectStrength = 1.0;
    state.windTurbulence = 0.2;
    state.gameSpeed = 3;
    state.gravity = 0.25;
    state.jumpStrength = 4.6;
    state.pipeGap = 150;
    
    applySettingsUI();
    soundEffects.score();
});

// Initialize Settings UI on load
applySettingsUI();

// Shop Logic
const shopBtn = document.getElementById('shop-btn');
const shopScreen = document.getElementById('shop-screen');
const closeShopBtn = document.getElementById('close-shop-btn');
const shopGrid = document.getElementById('shop-grid');
const shopCoinsVal = document.getElementById('shop-coins-val');

const shopItems = [
    { id: 'skin_1', type: 'skin', name: 'Gold Plane', desc: 'A shiny golden plane', price: 100, val: 1 },
    { id: 'skin_2', type: 'skin', name: 'Neon Plane', desc: 'Cyberpunk neon aesthetics', price: 250, val: 2 },
    { id: 'laser_red', type: 'laser', name: 'Red Lasers', desc: 'Shoots red lasers', price: 150, val: '#ff0000' },
    { id: 'laser_green', type: 'laser', name: 'Green Lasers', desc: 'Shoots green lasers', price: 150, val: '#00ff00' }
];

let unlockedShopItems = JSON.parse(localStorage.getItem('flappy_unlocked_items') || '[]');

export function updateShopUI() {
    shopCoinsVal.innerText = state.totalCoins;
    shopGrid.innerHTML = '';
    
    shopItems.forEach(item => {
        const isUnlocked = unlockedShopItems.includes(item.id);
        let isEquipped = false;
        if (item.type === 'skin' && state.selectedSkin === item.val) isEquipped = true;
        if (item.type === 'laser' && state.laserColor === item.val) isEquipped = true;
        
        const el = document.createElement('div');
        el.className = 'shop-item';
        
        const btnText = isEquipped ? 'Equipped' : (isUnlocked ? 'Equip' : `Buy (${item.price} 💰)`);
        const btnClass = isEquipped ? 'disabled' : '';
        const btnDisabled = isEquipped ? 'disabled' : '';
        
        el.innerHTML = `
            <div class="shop-item-info">
                <h3>${item.name}</h3>
                <p>${item.desc}</p>
            </div>
            <button class="${btnClass}" ${btnDisabled} onclick="window.handleShopClick('${item.id}')">${btnText}</button>
        `;
        shopGrid.appendChild(el);
    });
}

window.handleShopClick = function(id) {
    const item = shopItems.find(i => i.id === id);
    if (!item) return;
    
    if (unlockedShopItems.includes(id)) {
        // Equip
        if (item.type === 'skin') {
            state.selectedSkin = item.val;
            localStorage.setItem('flappy_skin', item.val);
        } else if (item.type === 'laser') {
            state.laserColor = item.val;
            localStorage.setItem('flappy_laser', item.val);
        }
        soundEffects.flap();
    } else {
        // Buy
        if (state.totalCoins >= item.price) {
            state.totalCoins -= item.price;
            unlockedShopItems.push(id);
            localStorage.setItem('flappy_unlocked_items', JSON.stringify(unlockedShopItems));
            
            // Auto equip
            if (item.type === 'skin') {
                state.selectedSkin = item.val;
                localStorage.setItem('flappy_skin', item.val);
            } else if (item.type === 'laser') {
                state.laserColor = item.val;
                localStorage.setItem('flappy_laser', item.val);
            }
            
            soundEffects.score();
            import('./state.js').then(s => s.saveProgress());
        } else {
            soundEffects.shieldBreak(); // Use as error sound
        }
    }
    updateShopUI();
};

export function updateScoreUI() {
    scoreDisplay.innerText = `${state.obstaclesPassed}/${state.obstaclesToWin}`;
    if (progressBar) {
        const percent = Math.min(100, (state.obstaclesPassed / state.obstaclesToWin) * 100);
        progressBar.style.width = `${percent}%`;
    }
}

export function resizeCanvas() {
    state.gameWidth = window.innerWidth;
    state.gameHeight = window.innerHeight;
    
    let dpr = 1;
    if (typeof state.graphicsMode !== 'undefined') {
        dpr = (state.graphicsMode === '4k') ? Math.max(2, window.devicePixelRatio || 2) : (state.graphicsMode === 'high' ? (window.devicePixelRatio || 1) : 1);
    }
    
    canvas.width = state.gameWidth * dpr;
    canvas.height = state.gameHeight * dpr;
    canvas.style.width = state.gameWidth + 'px';
    canvas.style.height = state.gameHeight + 'px';
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    ctx.imageSmoothingEnabled = (typeof state.graphicsMode !== 'undefined' && state.graphicsMode !== 'retro');
    if (typeof state.graphicsMode !== 'undefined' && state.graphicsMode === '4k') {
        ctx.imageSmoothingQuality = 'high';
    }
}

export function handleInput() {
    if (state.gameState === 'PLAYING') {
        plane.flap();
    }
}

export function togglePause() {
    if (state.gameState === 'PLAYING') {
        state.gameState = 'PAUSED';
        if (pauseScreen) pauseScreen.classList.remove('hidden');
    } else if (state.gameState === 'PAUSED') {
        state.gameState = 'PLAYING';
        if (pauseScreen) pauseScreen.classList.add('hidden');
    }
}

export function toggleHUD() {
    if (state.hudMode === 'tactical') {
        state.hudMode = 'minimal';
    } else if (state.hudMode === 'minimal') {
        state.hudMode = 'off';
    } else {
        state.hudMode = 'tactical';
    }
    localStorage.setItem('flappy_hud_mode', state.hudMode);
    if (hudToggleBtn) {
        hudToggleBtn.innerText = state.hudMode === 'tactical' ? 'HUD' : (state.hudMode === 'minimal' ? 'MIN' : 'OFF');
    }
    if (hudModeSelect) hudModeSelect.value = state.hudMode;
    soundEffects.score();
}

// Attach UI Event Listeners
export function initUIListeners() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    if (hudToggleBtn) {
        hudToggleBtn.addEventListener('click', toggleHUD);
        hudToggleBtn.innerText = state.hudMode === 'tactical' ? 'HUD' : (state.hudMode === 'minimal' ? 'MIN' : 'OFF');
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault();
            if (state.gameState === 'PLAYING') {
                plane.pitchTrim(1);
            } else {
                handleInput();
            }
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            e.preventDefault();
            if (state.gameState === 'PLAYING') {
                plane.pitchTrim(-1);
            }
        } else if (e.code === 'KeyH') {
            e.preventDefault();
            toggleHUD();
        } else if (e.code === 'Space') {
            e.preventDefault();
            if (state.gameState === 'PLAYING') {
                if (state.spacebarAction === 'shoot') {
                    plane.shoot();
                } else {
                    handleInput();
                }
            } else {
                handleInput(); // Start game on space
            }
        } else if (e.key === 'Shift' || e.key === 'Control' || e.code === 'KeyB') {
            e.preventDefault();
            if (state.gameState === 'PLAYING') {
                plane.shoot();
            }
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
            e.preventDefault();
            togglePause();
        }
    });

    let lastFlapTime = 0;
    function handlePointerDown(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('.ui-screen:not(.hidden)')) {
            return;
        }
        const now = performance.now();
        if (now - lastFlapTime < 50) return;
        lastFlapTime = now;
        
        let clientX = 0;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else if (e.clientX !== undefined) {
            clientX = e.clientX;
        }

        if (clientX > window.innerWidth / 2) {
            if (state.gameState === 'PLAYING') {
                plane.shoot();
            }
        } else {
            handleInput();
        }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown, { passive: true });

    homePlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startLevel(state.currentLevel);
    });

    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            soundEffects.score();
            homeScreen.classList.add('hidden');
            leaderboardScreen.classList.remove('hidden');
            fetchLeaderboard();
        });
    }

    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener('click', () => {
            soundEffects.flap();
            leaderboardScreen.classList.add('hidden');
            homeScreen.classList.remove('hidden');
        });
    }
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            soundEffects.score();
            homeScreen.classList.add('hidden');
            settingsScreen.classList.remove('hidden');
            applySettingsUI();
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            soundEffects.flap();
            settingsScreen.classList.add('hidden');
            homeScreen.classList.remove('hidden');
        });
    }

    if (shopBtn) {
        shopBtn.addEventListener('click', () => {
            soundEffects.score();
            homeScreen.classList.add('hidden');
            shopScreen.classList.remove('hidden');
            updateShopUI();
        });
    }

    if (closeShopBtn) {
        closeShopBtn.addEventListener('click', () => {
            soundEffects.flap();
            shopScreen.classList.add('hidden');
            homeScreen.classList.remove('hidden');
        });
    }

    levelsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showLevelSelect();
    });

    if (trophiesBtn) {
        trophiesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showTrophies();
        });
    }
    if (backTrophiesBtn) {
        backTrophiesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showHome();
        });
    }
    if (pauseBtn) {
        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePause();
        });
    }
    if (musicToggleBtn) {
        musicToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });
    }
    if (resumeBtn) {
        resumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePause();
        });
    }
    if (pauseRestartBtn) {
        pauseRestartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pauseScreen) pauseScreen.classList.add('hidden');
            startLevel(state.currentLevel);
        });
    }
    if (pauseHomeBtn) {
        pauseHomeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pauseScreen) pauseScreen.classList.add('hidden');
            showHome();
        });
    }
    if (heroPreviewBanner) {
        heroPreviewBanner.addEventListener('click', (e) => {
            e.stopPropagation();
            showCinematic();
        });
    }
    if (closeCinematicBtn) {
        closeCinematicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showHome();
        });
    }

    backHomeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showHome();
    });

    restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startLevel(state.currentLevel);
    });

    homeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showHome();
    });

    nextLevelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.currentLevel < 100) {
            startLevel(state.currentLevel + 1);
        } else {
            showHome();
        }
    });

    homeBtnComplete.addEventListener('click', (e) => {
        e.stopPropagation();
        showHome();
    });

    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.soundEnabled = !state.soundEnabled;
            soundToggleBtn.innerText = state.soundEnabled ? '🔊' : '🔇';
        });
    }

    const skinButtons = document.querySelectorAll('.skin-btn');
    function updateSkinButtons() {
        skinButtons.forEach((btn) => {
            const idx = parseInt(btn.getAttribute('data-skin'), 10);
            if (idx === state.selectedSkin) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }
    skinButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.selectedSkin = parseInt(btn.getAttribute('data-skin'), 10);
            localStorage.setItem('flappy_skin', state.selectedSkin);
            updateSkinButtons();
            soundEffects.flap();
        });
    });
    updateSkinButtons();

    const graphicsToggleBtn = document.getElementById('graphics-toggle-btn');
    const graphicsBtns = document.querySelectorAll('.graphics-btn');
    const crtOverlay = document.getElementById('crt-overlay');

    function setGraphicsMode(mode, showToastMsg = false) {
        state.graphicsMode = mode;
        localStorage.setItem('graphics_mode', mode);

        if (mode === '4k') {
            if (graphicsToggleBtn) {
                graphicsToggleBtn.innerText = '4K';
                graphicsToggleBtn.style.background = 'linear-gradient(45deg, #FFD700, #FF8C00)';
                graphicsToggleBtn.style.color = '#000';
            }
            if (crtOverlay) crtOverlay.classList.add('hidden');
            if (showToastMsg) showAchievementToast('🌟 4K ULTRA UHD Graphics');
        } else if (mode === 'high') {
            if (graphicsToggleBtn) {
                graphicsToggleBtn.innerText = 'HD';
                graphicsToggleBtn.style.background = 'rgba(255, 255, 255, 0.8)';
                graphicsToggleBtn.style.color = '#2c3e50';
            }
            if (crtOverlay) crtOverlay.classList.add('hidden');
            if (showToastMsg) showAchievementToast('⚡ HIGH HD Arcade Graphics');
        } else if (mode === 'retro') {
            if (graphicsToggleBtn) {
                graphicsToggleBtn.innerText = '8B';
                graphicsToggleBtn.style.background = '#9d4edd';
                graphicsToggleBtn.style.color = '#fff';
            }
            if (crtOverlay) crtOverlay.classList.remove('hidden');
            if (showToastMsg) showAchievementToast('👾 RETRO 8-Bit Pixel Graphics');
        }

        graphicsBtns.forEach((btn) => {
            if (btn.getAttribute('data-graphics') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        resizeCanvas();
    }

    if (graphicsToggleBtn) {
        graphicsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nextMode = state.graphicsMode === '4k' ? 'high' : (state.graphicsMode === 'high' ? 'retro' : '4k');
            setGraphicsMode(nextMode, true);
            soundEffects.flap();
        });
    }
    graphicsBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setGraphicsMode(btn.getAttribute('data-graphics'), true);
            soundEffects.flap();
        });
    });
    setGraphicsMode(state.graphicsMode);
}


export function showHome() {
    state.gameState = 'HOME';
    homeScreen.classList.remove('hidden');
    levelScreen.classList.add('hidden');
    if (trophiesScreen) trophiesScreen.classList.add('hidden');
    if (cinematicScreen) cinematicScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    levelCompleteScreen.classList.add('hidden');
    scoreDisplay.classList.add('hidden');
    levelDisplay.classList.add('hidden');
    if (progressBarContainer) progressBarContainer.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    if (homeHighScoreElement) homeHighScoreElement.innerText = state.highScore;
    resetGameObjects();
}

export function showCinematic() {
    state.gameState = 'CINEMATIC';
    homeScreen.classList.add('hidden');
    if (cinematicScreen) cinematicScreen.classList.remove('hidden');
}

export function showTrophies() {
    state.gameState = 'TROPHIES';
    homeScreen.classList.add('hidden');
    if (trophiesScreen) {
        trophiesScreen.classList.remove('hidden');
        renderTrophyList();
    }
}

function renderTrophyList() {
    if (!trophyList) return;
    trophyList.innerHTML = '';
    achievements.forEach(a => {
        const item = document.createElement('div');
        item.className = `trophy-item ${a.unlocked ? 'unlocked' : 'locked'}`;
        item.innerHTML = `
            <div class="trophy-icon">${a.icon}</div>
            <div class="trophy-info">
                <h4>${a.name}</h4>
                <p>${a.desc}</p>
            </div>
        `;
        trophyList.appendChild(item);
    });
}

export function showLevelSelect() {
    state.gameState = 'LEVEL_SELECT';
    homeScreen.classList.add('hidden');
    levelScreen.classList.remove('hidden');
    renderLevelGrid();
}

function renderLevelGrid() {
    levelGrid.innerHTML = '';
    for (let i = 1; i <= 25; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerText = i;
        if (i > state.maxLevelUnlocked) {
            btn.classList.add('locked');
            btn.disabled = true;
        } else {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                startLevel(i);
            });
        }
        levelGrid.appendChild(btn);
    }
}

function setDifficulty(level) {
    const themeIndex = Math.ceil(level / 5) % 4; 
    
    if (themeIndex === 1) {
        setCurrentTheme({
            name: 'Nature',
            bg: 'linear-gradient(180deg, #87CEEB 0%, #E0F7FA 60%, #A5D6A7 100%)',
            mountains: '#2c3e50',
            pipe: '#2ECC71', pipeBorder: '#27ae60',
            planeBody: '#f72585', planeTail: '#b5179e', planeWing: '#4cc9f0'
        });
    } else if (themeIndex === 2) {
        setCurrentTheme({
            name: 'Desert',
            bg: 'linear-gradient(180deg, #FFB75E 0%, #ED8F03 100%)',
            mountains: '#8B4513',
            pipe: '#FFD700', pipeBorder: '#DAA520',
            planeBody: '#00FFFF', planeTail: '#008B8B', planeWing: '#FFFFFF'
        });
    } else if (themeIndex === 3) {
        setCurrentTheme({
            name: 'Night',
            bg: 'linear-gradient(180deg, #0F2027 0%, #203A43 60%, #2C5364 100%)',
            mountains: '#000000',
            pipe: '#8A2BE2', pipeBorder: '#4B0082',
            planeBody: '#FFD700', planeTail: '#DAA520', planeWing: '#FFFFFF'
        });
    } else {
        setCurrentTheme({
            name: 'Snow',
            bg: 'linear-gradient(180deg, #E0FFFF 0%, #FFFFFF 100%)',
            mountains: '#B0E0E6',
            pipe: '#FFFFFF', pipeBorder: '#ADD8E6',
            planeBody: '#FF0000', planeTail: '#8B0000', planeWing: '#FFFFFF'
        });
    }
    
    document.body.style.background = currentTheme.bg;

    if (level <= 10) {
        state.gravity = 0.2;
        state.jumpStrength = 4.0;
        state.gameSpeed = 3 + (level * 0.1);
        state.pipeGap = 170;
    } else if (level <= 20) {
        state.gravity = 0.25;
        state.jumpStrength = 4.6;
        state.gameSpeed = 4 + ((level - 10) * 0.15);
        state.pipeGap = 150;
    } else {
        state.gravity = 0.35;
        state.jumpStrength = 5.2;
        state.gameSpeed = 5 + ((level - 20) * 0.2);
        state.pipeGap = 130;
    }
}

export function startLevel(level) {
    state.currentLevel = level;
    setDifficulty(level);

    state.gameState = 'PLAYING';

    homeScreen.classList.add('hidden');
    levelScreen.classList.add('hidden');
    if (trophiesScreen) trophiesScreen.classList.add('hidden');
    if (cinematicScreen) cinematicScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    levelCompleteScreen.classList.add('hidden');

    scoreDisplay.classList.remove('hidden');
    levelDisplay.classList.remove('hidden');
    if (pauseBtn) pauseBtn.classList.remove('hidden');
    levelDisplay.innerText = `Level ${state.currentLevel}`;
    if (progressBarContainer) {
        progressBarContainer.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';
    }

    state.score = 0;
    state.obstaclesPassed = 0;
    state.frames = 0;
    obstacles.reset();
    createParticles(plane.x, plane.y, 10);

    updateScoreUI();

    plane.y = state.gameHeight / 2;
    plane.velocity = 0;
    plane.angle = 0;
}

export function winLevel() {
    state.gameState = 'LEVEL_COMPLETE';
    soundEffects.win();
    createFireworks(state.gameWidth * 0.3, state.gameHeight * 0.4);
    createFireworks(state.gameWidth * 0.7, state.gameHeight * 0.4);
    createFireworks(state.gameWidth * 0.5, state.gameHeight * 0.3);
    unlockAchievement('first_flight');
    if (state.currentLevel >= 11) unlockAchievement('night_owl');
    if (state.currentLevel === state.maxLevelUnlocked) {
        state.maxLevelUnlocked++;
        saveProgress();
    }

    levelCompleteScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
    levelDisplay.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    if (progressBarContainer) progressBarContainer.classList.add('hidden');
    completedLevelElement.innerText = state.currentLevel;
}

export function gameOver() {
    state.gameState = 'GAMEOVER';
    state.streak = 0;
    soundEffects.gameOver();
    state.screenShake = 15;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        saveProgress();
    }
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
    levelDisplay.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    if (progressBarContainer) progressBarContainer.classList.add('hidden');
    finalScoreElement.innerText = state.score;
    if (gameoverHighScoreElement) gameoverHighScoreElement.innerText = state.highScore;
}

import { resetProjectiles } from './entities/Projectiles.js';
import { resetEnemies } from './entities/Enemies.js';

export function resetGameObjects() {
    obstacles.reset();
    collectibles.reset();
    resetParticles();
    resetDebris();
    resetFloatingTexts();
    resetProjectiles();
    resetEnemies();
    plane.reset();
}
