import { state } from './state.js';

let audioCtx = null;

export function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function playTone(freq, type, duration, startFreq = freq, volume = 0.15) {
    if (!state.soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, startFreq), ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {}
}

// Procedural Continuous Jet Engine & Wind Synthesizer
let engineNodes = null;

export function initEngineAudio() {
    if (engineNodes || !state.soundEnabled) return;
    try {
        const ctx = getAudioContext();

        // 1. Master Engine Gain
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
        masterGain.connect(ctx.destination);

        // 2. Low-frequency Turbofan Rumble (Sawtooth through lowpass filter)
        const rumbleOsc = ctx.createOscillator();
        rumbleOsc.type = 'sawtooth';
        rumbleOsc.frequency.setValueAtTime(55, ctx.currentTime);

        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(180, ctx.currentTime);
        rumbleFilter.Q.setValueAtTime(2.0, ctx.currentTime);

        const rumbleGain = ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.04, ctx.currentTime);

        rumbleOsc.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(masterGain);
        rumbleOsc.start();

        // 3. High-frequency Compressor Whine (Sine wave)
        const whineOsc = ctx.createOscillator();
        whineOsc.type = 'sine';
        whineOsc.frequency.setValueAtTime(950, ctx.currentTime);

        const whineGain = ctx.createGain();
        whineGain.gain.setValueAtTime(0.015, ctx.currentTime);

        whineOsc.connect(whineGain);
        whineGain.connect(masterGain);
        whineOsc.start();

        // 4. Aerodynamic Wind Rush Noise (White noise generator through bandpass)
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // Pink-ish filtered noise
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
        }

        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        noiseNode.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(450, ctx.currentTime);
        windFilter.Q.setValueAtTime(1.2, ctx.currentTime);

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.02, ctx.currentTime);

        noiseNode.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(masterGain);
        noiseNode.start();

        engineNodes = {
            masterGain,
            rumbleOsc,
            rumbleFilter,
            rumbleGain,
            whineOsc,
            whineGain,
            windFilter,
            windGain
        };
    } catch (e) {}
}

export function updateEngineAudio(thrustLevel, airspeedRatio, isStalled, inGroundEffect) {
    if (!state.soundEnabled || state.gameState !== 'PLAYING') {
        if (engineNodes && engineNodes.masterGain) {
            try {
                const ctx = getAudioContext();
                engineNodes.masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
            } catch (e) {}
        }
        return;
    }

    if (!engineNodes) {
        initEngineAudio();
    }
    if (!engineNodes) return;

    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Smoothly fade master volume in
        engineNodes.masterGain.gain.setTargetAtTime(0.2, now, 0.08);

        // Modulate turbofan rumble frequency with engine thrust
        const rumbleFreq = 50 + (thrustLevel * 45) + (airspeedRatio * 20);
        engineNodes.rumbleOsc.frequency.setTargetAtTime(rumbleFreq, now, 0.06);
        engineNodes.rumbleFilter.frequency.setTargetAtTime(160 + (thrustLevel * 220), now, 0.06);

        // Modulate turbine whine frequency (spooling jet engine)
        const whineFreq = 850 + (thrustLevel * 1400) + (airspeedRatio * 400);
        engineNodes.whineOsc.frequency.setTargetAtTime(whineFreq, now, 0.08);

        // Wind noise frequency scales with airspeed (dive whoosh)
        const windFreq = 350 + (airspeedRatio * 1800);
        engineNodes.windFilter.frequency.setTargetAtTime(windFreq, now, 0.05);
        const windVolume = 0.015 + (airspeedRatio * 0.06);
        engineNodes.windGain.gain.setTargetAtTime(windVolume, now, 0.05);

        // Ground effect air cushion whistling
        if (inGroundEffect) {
            engineNodes.whineGain.gain.setTargetAtTime(0.035, now, 0.08);
        } else {
            engineNodes.whineGain.gain.setTargetAtTime(0.018, now, 0.08);
        }

        // Stall buffeting turbulence
        if (isStalled) {
            const wobble = Math.sin(Date.now() * 0.02) * 20;
            engineNodes.rumbleOsc.frequency.setValueAtTime(Math.max(30, rumbleFreq + wobble), now);
        }
    } catch (e) {}
}

export function stopEngineAudio() {
    if (engineNodes && engineNodes.masterGain) {
        try {
            const ctx = getAudioContext();
            engineNodes.masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
        } catch (e) {}
    }
}

let lastStallChime = 0;

export const soundEffects = {
    flap: () => {
        // Crisp aerodynamic thrust impulse
        playTone(320, 'sine', 0.12, 180, 0.2);
        playTone(650, 'triangle', 0.08, 480, 0.12);
    },
    afterburner: () => {
        playTone(180, 'sawtooth', 0.22, 120, 0.25);
        playTone(850, 'triangle', 0.18, 500, 0.15);
    },
    stallWarning: () => {
        const now = performance.now();
        if (now - lastStallChime < 600) return;
        lastStallChime = now;
        // Military cockpit stall warning beep
        playTone(880, 'sine', 0.08, 880, 0.2);
        setTimeout(() => playTone(880, 'sine', 0.08, 880, 0.2), 120);
    },
    sonicBoom: () => {
        playTone(60, 'sawtooth', 0.55, 240, 0.35);
        playTone(40, 'triangle', 0.7, 120, 0.3);
    },
    nearMiss: () => {
        playTone(1400, 'sine', 0.18, 900, 0.22);
        playTone(600, 'triangle', 0.22, 1100, 0.18);
    },
    scrape: () => {
        playTone(2400, 'square', 0.08, 1600, 0.15);
    },
    score: () => playTone(1174, 'sine', 0.15, 880, 0.18),
    win: () => {
        playTone(523, 'triangle', 0.1, 523);
        setTimeout(() => playTone(659, 'triangle', 0.1, 659), 100);
        setTimeout(() => playTone(783, 'triangle', 0.1, 783), 200);
        setTimeout(() => playTone(1046, 'triangle', 0.25, 1046), 300);
    },
    gameOver: () => {
        stopEngineAudio();
        playTone(100, 'sawtooth', 0.45, 300, 0.25);
    },
    coin: () => playTone(1567, 'sine', 0.12, 1318, 0.15),
    powerup: () => playTone(880, 'triangle', 0.2, 440, 0.2),
    shieldBreak: () => playTone(200, 'sawtooth', 0.25, 600, 0.25),
    achievement: () => {
        playTone(587.33, 'triangle', 0.12, 587.33);
        setTimeout(() => playTone(880, 'triangle', 0.25, 880), 120);
    },
    laser: () => playTone(1200, 'square', 0.1, 800, 0.15),
    explosion: () => playTone(50, 'sawtooth', 0.35, 150, 0.3)
};

let musicInterval = null;
const chiptuneNotes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 349.23, 440.00, 587.33];
let currentNoteIndex = 0;

export function toggleMusic() {
    state.musicEnabled = !state.musicEnabled;
    const btn = document.getElementById('music-toggle-btn');
    if (btn) btn.innerText = state.musicEnabled ? '🎵' : '🔇';
    if (state.musicEnabled) {
        if (!musicInterval) {
            musicInterval = setInterval(() => {
                if (state.musicEnabled && state.gameState === 'PLAYING') {
                    playTone(chiptuneNotes[currentNoteIndex], 'square', 0.1, chiptuneNotes[currentNoteIndex], 0.08);
                    currentNoteIndex = (currentNoteIndex + 1) % chiptuneNotes.length;
                }
            }, 180);
        }
    } else if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}
