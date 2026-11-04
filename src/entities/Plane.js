import { state, ctx, getEffectiveSpeed } from '../state.js';
import { soundEffects, updateEngineAudio } from '../audio.js';
import { skins } from '../graphics/Themes.js';
import { createJetExhaust, createParticles, createWingtipContrail, createMachCone, createGroundSpray, createShockwave } from './Particles.js';
import { gameOver } from '../ui.js';
import { obstacles } from './Obstacles.js';

export const plane = {
    // Spatial & Inertial
    x: 160,
    y: 250,
    baseX: 160,
    width: 48,
    height: 28,
    vx: 0,
    vy: 0,
    get velocity() {
        return this.vy;
    },
    set velocity(val) {
        this.vy = val;
    },
    
    // Aerodynamic State
    angle: 0,              // Fuselage pitch attitude theta (rad)
    pitchVelocity: 0,      // Pitch rate omega (rad/s)
    airspeed: 12,          // True airspeed magnitude
    flightPathAngle: 0,    // Gamma = atan2(vy, vx)
    aoa: 0,                // Angle of attack alpha = gamma - theta
    gForce: 1.0,           // Load factor Nz
    mach: 0.72,            // Mach number
    thrust: 0.4,           // Current thrust level (0.0 to 1.5)
    targetThrust: 0.4,
    afterburner: 0,        // Afterburner intensity (0 to 1)
    elevatorAngle: 0,      // Control surface deflection (rad)
    rudderAngle: 0,
    
    // Flight Dynamics Flags
    stalled: false,
    stallBuffet: 0,
    inGroundEffect: false,
    supersonic: false,
    hasSonicBoomed: false,
    
    // Status & Powerups
    shielded: false,
    invincible: 0,
    slowmo: 0,
    nearMissBonus: 0,
    lastShotTime: 0,

    reset: function () {
        this.baseX = Math.min(180, Math.max(120, state.gameWidth * 0.22));
        this.x = this.baseX;
        this.y = state.gameHeight * 0.45;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.pitchVelocity = 0;
        this.airspeed = 12;
        this.flightPathAngle = 0;
        this.aoa = 0;
        this.gForce = 1.0;
        this.mach = 0.72;
        this.thrust = 0.4;
        this.targetThrust = 0.4;
        this.afterburner = 0;
        this.elevatorAngle = 0;
        this.rudderAngle = 0;
        this.stalled = false;
        this.stallBuffet = 0;
        this.inGroundEffect = false;
        this.supersonic = false;
        this.hasSonicBoomed = false;
        this.shielded = false;
        this.invincible = 0;
        this.slowmo = 0;
        this.nearMissBonus = 0;
    },

    update: function () {
        if (this.invincible > 0) this.invincible--;
        if (this.slowmo > 0) this.slowmo--;
        if (this.nearMissBonus > 0) this.nearMissBonus--;

        if (state.gameState !== 'PLAYING') {
            // Idle floating on menu
            this.angle = Math.sin(state.frames * 0.04) * 0.08;
            this.y += Math.sin(state.frames * 0.05) * 0.6;
            this.thrust = 0.3;
            this.afterburner = 0;
            return;
        }

        // 1. Flight Dynamics Model: Realistic Aerodynamics vs Arcade
        if (state.flightModel === 'realistic') {
            this.updateRealisticPhysics();
        } else {
            this.updateArcadePhysics();
        }

        // 2. Sound & Engine Modulation
        const airspeedRatio = Math.min(1.5, this.airspeed / 16);
        updateEngineAudio(this.thrust, airspeedRatio, this.stalled, this.inGroundEffect);

        // 3. Environmental Aerodynamic FX
        // Supersonic Mach Cone
        if (this.mach >= 1.0) {
            if (!this.hasSonicBoomed) {
                soundEffects.sonicBoom();
                createShockwave(this.x, this.y, 90, 'rgba(255, 255, 255, 0.9)');
                state.screenShake = 10;
                this.hasSonicBoomed = true;
            }
            if (state.frames % 3 === 0) {
                createMachCone(this.x + 10, this.y, this.angle);
            }
        } else if (this.mach < 0.95) {
            this.hasSonicBoomed = false;
        }

        // Wingtip Vortices & Vapor Contrails (High-G or High AoA condensation)
        const wingSpan = 22;
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);
        const leftWingX = this.x - sinA * wingSpan;
        const leftWingY = this.y + cosA * wingSpan * 0.5;
        const rightWingX = this.x + sinA * wingSpan;
        const rightWingY = this.y - cosA * wingSpan * 0.5;

        if (Math.abs(this.gForce - 1.0) > 1.2 || Math.abs(this.aoa) > 0.18 || this.mach > 0.92) {
            const intensity = Math.min(2.0, Math.abs(this.gForce - 1.0) * 0.7 + Math.abs(this.aoa) * 3);
            createWingtipContrail(leftWingX, leftWingY, intensity);
            createWingtipContrail(rightWingX, rightWingY, intensity);
        }

        // Volumetric Jet Exhaust
        const exhaustX = this.x - cosA * 24;
        const exhaustY = this.y - sinA * 24;
        createJetExhaust(exhaustX, exhaustY, this.angle, this.thrust, this.afterburner > 0.15);

        // Ground Effect Spray
        if (this.inGroundEffect && this.y > state.gameHeight - 80) {
            createGroundSpray(this.x - 10, state.gameHeight - 2, 1.2);
        }

        // 4. Boundary Collision & Limits
        if (this.y + this.height / 2 >= state.gameHeight) {
            this.y = state.gameHeight - this.height / 2;
            gameOver();
        }
        if (this.y - this.height / 2 <= 0) {
            this.y = this.height / 2;
            this.vy = Math.max(0, this.vy);
        }

        // 5. Update Telemetry State for HUD
        state.telemetry.airspeedKts = Math.round(this.airspeed * 28);
        state.telemetry.mach = parseFloat(this.mach.toFixed(2));
        state.telemetry.altitudeFt = Math.max(0, Math.round((state.gameHeight - this.y) * 12));
        state.telemetry.verticalSpeedFpm = Math.round(-this.vy * 600);
        state.telemetry.gForce = parseFloat(this.gForce.toFixed(1));
        state.telemetry.aoaDeg = parseFloat((this.aoa * 57.2958).toFixed(1));
        state.telemetry.stalled = this.stalled;
        state.telemetry.groundEffect = this.inGroundEffect;
        state.telemetry.afterburner = this.afterburner > 0.2;
        state.telemetry.pullUpWarning = (this.y > state.gameHeight - 160 && this.vy > 2.5);
    },

    updateRealisticPhysics: function () {
        // Effective forward airspeed of world stream
        const baseSpeed = getEffectiveSpeed(this) * 3.8;
        const forwardU = baseSpeed + this.vx;
        const verticalV = this.vy;

        // True Airspeed Magnitude
        this.airspeed = Math.sqrt(forwardU * forwardU + verticalV * verticalV);

        // Flight Path Angle gamma (screen: down is positive)
        this.flightPathAngle = Math.atan2(verticalV, forwardU);

        // Angle of Attack alpha = gamma - theta (when nose is pitched up, theta is negative, so alpha is positive)
        this.aoa = this.flightPathAngle - this.angle;

        // Mach number (Speed of sound ~ 16 units in this scale)
        this.mach = this.airspeed / 15.5;

        // Dynamic Pressure q = 0.5 * rho * V^2
        const rho = 0.085;
        const dynamicPressure = 0.5 * rho * this.airspeed * this.airspeed;

        // Ground Proximity Calculation
        const altitude = state.gameHeight - this.y;
        const groundThreshold = 140;
        this.inGroundEffect = (altitude < groundThreshold);
        let geFactor = 0;
        if (this.inGroundEffect) {
            geFactor = Math.max(0, 1 - (altitude / groundThreshold));
        }

        // Lift Coefficient & Aerodynamic Stall Dynamics
        const criticalAoA = 0.314; // ~18 degrees
        let cl = 0;
        if (Math.abs(this.aoa) < criticalAoA) {
            // Linear pre-stall regime
            cl = 4.2 * this.aoa;
            this.stalled = false;
            this.stallBuffet = 0;
        } else {
            // Post-stall separation
            cl = (criticalAoA * 4.2 * 0.4) * Math.sign(this.aoa);
            this.stalled = true;
            this.stallBuffet = (Math.random() - 0.5) * 0.08;
            soundEffects.stallWarning();
        }

        // Ground Effect Lift Enhancement
        if (this.inGroundEffect) {
            cl *= (1 + 0.5 * geFactor * (state.groundEffectStrength || 1.0));
        }

        // Aerodynamic Lift Force (acts perpendicular to flight path)
        const wingArea = 0.65;
        const liftMagnitude = dynamicPressure * wingArea * cl;
        const liftX = liftMagnitude * Math.sin(this.flightPathAngle);
        const liftY = -liftMagnitude * Math.cos(this.flightPathAngle);

        // Drag Coefficient (Parasitic + Induced + Stall Wave Drag)
        const cd0 = 0.035;
        const inducedK = 0.08 * (1 - 0.65 * geFactor); // Ground effect reduces induced drag!
        let cd = cd0 + inducedK * (cl * cl);
        if (this.stalled) cd += 0.15;
        if (this.mach > 0.92) cd += (this.mach - 0.92) * 0.8; // Transonic wave drag

        const dragMagnitude = dynamicPressure * wingArea * cd;
        const dragX = -dragMagnitude * Math.cos(this.flightPathAngle);
        const dragY = -dragMagnitude * Math.sin(this.flightPathAngle);

        // Engine Thrust Force (acts along fuselage pitch angle theta)
        this.thrust += (this.targetThrust - this.thrust) * 0.12;
        const thrustMagnitude = this.thrust * 4.8;
        const thrustX = thrustMagnitude * Math.cos(this.angle);
        const thrustY = thrustMagnitude * Math.sin(this.angle);

        // Atmospheric Wind & Turbulence
        let turbY = 0;
        if (state.windTurbulence > 0) {
            turbY = Math.sin(state.frames * 0.08 + this.x * 0.02) * (state.windTurbulence * 0.6);
        }

        // Gravity
        const mass = 1.0;
        const gravityForce = mass * state.gravity * 3.8;

        // Net Physical Forces
        const netFx = thrustX + liftX + dragX;
        const netFy = thrustY + liftY + dragY + gravityForce + turbY;

        // Linear Acceleration
        const ax = netFx / mass;
        const ay = netFy / mass;

        this.vx += ax * 0.25;
        this.vy += ay * 0.25;

        // Inertial damping on horizontal forward drift (keeps plane near target base corridor)
        const distFromBase = this.x - this.baseX;
        this.vx -= distFromBase * 0.015;
        this.vx *= 0.94;
        this.x += this.vx;

        // Natural vertical translation
        this.y += this.vy;

        // Rotational Dynamics & Elevator Moments
        // Aerodynamic damping & weathercock stability (natural self-leveling towards flight path)
        const weathercockMoment = -1.8 * (this.angle - this.flightPathAngle);
        const pitchDamping = -2.5 * this.pitchVelocity;
        const elevatorMoment = -3.2 * this.elevatorAngle;
        
        // Stalled restoring moment (nose naturally falls forward to recover)
        const stallRecoveryMoment = this.stalled ? 0.08 : 0;

        const totalMoment = weathercockMoment + pitchDamping + elevatorMoment + stallRecoveryMoment;
        this.pitchVelocity += totalMoment * 0.12;
        this.pitchVelocity *= 0.88; // Pitch inertia damping
        this.angle += this.pitchVelocity * 0.15 + this.stallBuffet;

        // Clamp physical pitch to realistic aerobatic limits
        this.angle = Math.max(-Math.PI / 2.6, Math.min(Math.PI / 2.6, this.angle));

        // Elevator spring return
        this.elevatorAngle *= 0.85;

        // Compute Load Factor (G-Force)
        // Nz = 1 + (lift - weight) / weight
        this.gForce = 1.0 - (liftY / gravityForce);

        // Afterburner Decay
        if (this.afterburner > 0) {
            this.afterburner -= 0.03;
            if (this.afterburner <= 0) {
                this.afterburner = 0;
                this.targetThrust = 0.4;
            }
        }
    },

    updateArcadePhysics: function () {
        // Classic responsive arcade physics with modern damping
        this.vy += state.gravity;
        this.y += this.vy;

        let targetAngle = this.vy * 0.09;
        targetAngle = Math.min(Math.PI / 3.2, Math.max(-Math.PI / 3.2, targetAngle));
        this.angle += (targetAngle - this.angle) * 0.18;

        this.thrust = 0.4 + (this.afterburner * 0.8);
        this.airspeed = getEffectiveSpeed(this) * 3.8;
        this.mach = this.airspeed / 16;
        this.gForce = 1.0 - (this.vy * 0.3);
        this.aoa = 0.05;
        this.stalled = false;

        if (this.afterburner > 0) {
            this.afterburner -= 0.04;
        }
    },

    flap: function () {
        if (state.gameState !== 'PLAYING') return;

        soundEffects.flap();
        createParticles(this.x, this.y, 4);

        if (state.flightModel === 'realistic') {
            // Realistic Aerodynamic Pulse: Elevator pull + Afterburner burst
            this.elevatorAngle = -0.35; // Elevator up
            this.pitchVelocity -= 0.22;  // Nose pitch up
            this.targetThrust = 1.35;    // Turbojet afterburner kicks in
            this.afterburner = 1.0;
            // Immediate aerodynamic vertical impulse
            this.vy = Math.min(this.vy - 3.2, -state.jumpStrength * 0.75);
            // Kinetic forward kick
            this.vx = Math.min(this.vx + 1.2, 4.0);
        } else {
            this.vy = -state.jumpStrength;
            this.afterburner = 1.0;
        }
    },

    pitchTrim: function (direction) {
        // Smooth pitch trim for keyboard / touch controls (1 = pitch up, -1 = pitch down)
        if (state.flightModel === 'realistic') {
            this.elevatorAngle = -0.25 * direction;
            this.pitchVelocity -= 0.15 * direction;
            if (direction > 0) {
                this.targetThrust = 1.0;
                this.afterburner = 0.6;
            }
        } else {
            this.vy += (direction > 0 ? -1.5 : 1.5);
        }
    },

    shoot: function () {
        const now = performance.now();
        if (!this.lastShotTime || now - this.lastShotTime > 220) {
            this.lastShotTime = now;
            import('./Projectiles.js').then(module => {
                const cosA = Math.cos(this.angle);
                const sinA = Math.sin(this.angle);
                // Dual wingtip laser firing
                module.shootLaser(this.x + cosA * 20, this.y + sinA * 20 - 8);
                module.shootLaser(this.x + cosA * 20, this.y + sinA * 20 + 8);
            });
        }
    },

    draw: function () {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Invincibility shield flickering
        if (this.invincible > 0 && Math.floor(state.frames / 4) % 2 === 0) {
            ctx.globalAlpha = 0.45;
        }

        ctx.rotate(this.angle);

        // Draw Shield Bubble if active
        if (this.shielded) {
            this.drawEnergyShield();
        }

        // Draw Modern High-Detail Vector Aircraft
        const skinIndex = state.selectedSkin || 0;
        this.drawFighterJet(skinIndex);

        ctx.restore();

        // Draw Tactical HUD Overlay if enabled
        if (state.gameState === 'PLAYING' && state.hudMode !== 'off') {
            this.drawTacticalHUD();
        }
    },

    drawEnergyShield: function () {
        const shieldPulse = 1.0 + Math.sin(state.frames * 0.15) * 0.08;
        const shieldRadius = 34 * shieldPulse;

        // Glowing outer plasma ring
        ctx.save();
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Hexagonal energy grid shield fill
        const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, shieldRadius);
        grad.addColorStop(0, 'rgba(0, 243, 255, 0.05)');
        grad.addColorStop(0.8, 'rgba(0, 243, 255, 0.22)');
        grad.addColorStop(1, 'rgba(0, 243, 255, 0.45)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawFighterJet: function (skinIndex) {
        // Modern detailed vector fighter jet model
        // Palette configs based on skin
        const skinPalette = [
            // 0: Cyber Valkyrie (Neon Synthwave)
            { primary: '#f72585', secondary: '#7209b7', accent: '#4cc9f0', canopy: '#00f3ff', glow: '#f72585', metals: '#2b2d42' },
            // 1: Golden Phoenix (Sleek Interceptor)
            { primary: '#FFD700', secondary: '#B8860B', accent: '#ffffff', canopy: '#00e5ff', glow: '#FFD700', metals: '#4a3e1b' },
            // 2: Cyan Ghost (F-22 Stealth)
            { primary: '#00FFFF', secondary: '#008B8B', accent: '#e0f7fa', canopy: '#80deea', glow: '#00FFFF', metals: '#1c2833' },
            // 3: Crimson Aero-Racer (Aerobatic Special)
            { primary: '#e63946', secondary: '#1d3557', accent: '#f1faee', canopy: '#a8dadc', glow: '#e63946', metals: '#343a40' }
        ];

        const p = skinPalette[skinIndex] || skinPalette[0];

        // 1. Afterburner Nozzles & Shock Diamonds (Rear)
        this.drawAfterburnerPlume(p);

        // 2. Wings (Delta / Swept Wing Geometry)
        ctx.save();
        ctx.fillStyle = p.metals;
        // Underwing hardpoints
        ctx.fillRect(-12, -18, 16, 3);
        ctx.fillRect(-12, 15, 16, 3);

        // Main Wing Structure
        ctx.fillStyle = p.secondary;
        ctx.beginPath();
        ctx.moveTo(12, 0);       // Leading edge root
        ctx.lineTo(-14, -26);    // Left wingtip
        ctx.lineTo(-24, -25);    // Trailing edge outer
        ctx.lineTo(-18, 0);      // Trailing edge root
        ctx.lineTo(-24, 25);     // Right wingtip trailing
        ctx.lineTo(-14, 26);     // Right wingtip
        ctx.closePath();
        ctx.fill();

        // Upper Wing Surface with Camo/Stripe Accent
        ctx.fillStyle = p.primary;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-12, -22);
        ctx.lineTo(-18, -21);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-18, 21);
        ctx.lineTo(-12, 22);
        ctx.closePath();
        ctx.fill();

        // Articulating Elevons / Flaps (Deflect based on pitch control!)
        const elevonDeflection = this.elevatorAngle * 12;
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.moveTo(-18, -22);
        ctx.lineTo(-24, -22 + elevonDeflection);
        ctx.lineTo(-24, -8 + elevonDeflection);
        ctx.lineTo(-18, -8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-18, 8);
        ctx.lineTo(-24, 8 - elevonDeflection);
        ctx.lineTo(-24, 22 - elevonDeflection);
        ctx.lineTo(-18, 22);
        ctx.closePath();
        ctx.fill();

        // Formation Strobe Lights on Wingtips
        ctx.fillStyle = '#ff3333'; // Port (Red)
        ctx.beginPath();
        ctx.arc(-14, -25, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#33ff33'; // Starboard (Green)
        ctx.beginPath();
        ctx.arc(-14, 25, 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Central Fuselage (Stealth Faceted Body)
        const fuseGrad = ctx.createLinearGradient(0, -10, 0, 10);
        fuseGrad.addColorStop(0, p.secondary);
        fuseGrad.addColorStop(0.5, p.primary);
        fuseGrad.addColorStop(1, p.secondary);
        ctx.fillStyle = fuseGrad;

        ctx.beginPath();
        ctx.moveTo(28, 0);      // Needle nose radome
        ctx.lineTo(16, -6);     // Forward chine
        ctx.lineTo(-18, -7);    // Mid fuselage
        ctx.lineTo(-26, -4);    // Engine bay left
        ctx.lineTo(-26, 4);     // Engine bay right
        ctx.lineTo(-18, 7);
        ctx.lineTo(16, 6);
        ctx.closePath();
        ctx.fill();

        // Fuselage Panel Highlight Line
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(14, -4);
        ctx.lineTo(-14, -4);
        ctx.stroke();

        // 4. Twin Canted Vertical Stabilizers (Tails)
        ctx.fillStyle = p.metals;
        // Port tail
        ctx.beginPath();
        ctx.moveTo(-10, -9);
        ctx.lineTo(-26, -16);
        ctx.lineTo(-24, -8);
        ctx.closePath();
        ctx.fill();

        // Starboard tail
        ctx.beginPath();
        ctx.moveTo(-10, 9);
        ctx.lineTo(-26, 16);
        ctx.lineTo(-24, 8);
        ctx.closePath();
        ctx.fill();

        // 5. Glass Bubble Cockpit Canopy
        const canopyGrad = ctx.createLinearGradient(12, -3, 0, 3);
        canopyGrad.addColorStop(0, '#ffffff');
        canopyGrad.addColorStop(0.3, p.canopy);
        canopyGrad.addColorStop(1, '#001a33');
        ctx.fillStyle = canopyGrad;

        ctx.beginPath();
        ctx.ellipse(4, 0, 12, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Specular Sun Glare on Canopy
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(4, -1.5, 9, Math.PI * 0.9, Math.PI * 1.4);
        ctx.stroke();

        // Pilot Helmet Silhouette
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(3, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 6. Air Ingestion Ducts
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(-2, -7.5, 7, 2);
        ctx.fillRect(-2, 5.5, 7, 2);

        ctx.restore();
    },

    drawAfterburnerPlume: function (palette) {
        ctx.save();
        const thrustP = Math.max(0.2, this.thrust);
        const plumeLength = (20 + thrustP * 28 + (this.afterburner * 20));
        const plumeWidth = 6 + (this.afterburner * 4);

        // Core Combustion Flame
        const plumeGrad = ctx.createLinearGradient(-26, 0, -26 - plumeLength, 0);
        if (this.afterburner > 0.1) {
            plumeGrad.addColorStop(0, '#ffffff');
            plumeGrad.addColorStop(0.2, '#00f3ff');
            plumeGrad.addColorStop(0.7, '#f72585');
            plumeGrad.addColorStop(1, 'transparent');
        } else {
            plumeGrad.addColorStop(0, '#ffffff');
            plumeGrad.addColorStop(0.3, '#FFA500');
            plumeGrad.addColorStop(0.7, '#FF4500');
            plumeGrad.addColorStop(1, 'transparent');
        }

        ctx.fillStyle = plumeGrad;
        ctx.beginPath();
        ctx.moveTo(-26, -plumeWidth / 2);
        ctx.lineTo(-26 - plumeLength, 0);
        ctx.lineTo(-26, plumeWidth / 2);
        ctx.closePath();
        ctx.fill();

        // Supersonic Shock Diamonds (Mach Diamonds)
        if (thrustP > 0.8 || this.afterburner > 0.2) {
            ctx.fillStyle = '#ffffff';
            const numDiamonds = 3;
            for (let d = 1; d <= numDiamonds; d++) {
                const dx = -26 - (d * (plumeLength / (numDiamonds + 1)));
                const dw = 4;
                const dh = 2.5;
                ctx.beginPath();
                ctx.moveTo(dx, -dh);
                ctx.lineTo(dx + dw, 0);
                ctx.lineTo(dx, dh);
                ctx.lineTo(dx - dw, 0);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    },

    drawTacticalHUD: function () {
        ctx.save();
        const hudColor = '#00f3ff';
        const warnColor = '#ff0055';
        const amberColor = '#ffb703';

        ctx.strokeStyle = hudColor;
        ctx.fillStyle = hudColor;
        ctx.shadowColor = hudColor;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.5;

        // Centered HUD Reference Frame around aircraft
        const cx = this.x;
        const cy = this.y;

        // 1. Artificial Horizon & Pitch Ladder
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);

        // Horizon line
        ctx.beginPath();
        ctx.moveTo(-70, 0);
        ctx.lineTo(-30, 0);
        ctx.moveTo(30, 0);
        ctx.lineTo(70, 0);
        ctx.stroke();

        // Pitch Ladder Rungs (+15 deg climb, -15 deg dive)
        const rungSpacing = 35;
        // Climb rung (+15)
        ctx.beginPath();
        ctx.moveTo(-45, -rungSpacing);
        ctx.lineTo(-25, -rungSpacing);
        ctx.lineTo(-25, -rungSpacing + 6);
        ctx.moveTo(25, -rungSpacing + 6);
        ctx.lineTo(25, -rungSpacing);
        ctx.lineTo(45, -rungSpacing);
        ctx.stroke();

        // Dive rung (-15) - dashed
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(-45, rungSpacing);
        ctx.lineTo(-25, rungSpacing);
        ctx.lineTo(-25, rungSpacing - 6);
        ctx.moveTo(25, rungSpacing - 6);
        ctx.lineTo(25, rungSpacing);
        ctx.lineTo(45, rungSpacing);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 2. Flight Path Marker (Velocity Vector Indicator: O---O)
        const fpmAngle = this.flightPathAngle;
        const fpmDist = 48;
        const fpmX = cx + Math.cos(fpmAngle) * fpmDist;
        const fpmY = cy + Math.sin(fpmAngle) * fpmDist;

        ctx.beginPath();
        ctx.arc(fpmX, fpmY, 5, 0, Math.PI * 2);
        ctx.moveTo(fpmX - 11, fpmY);
        ctx.lineTo(fpmX - 5, fpmY);
        ctx.moveTo(fpmX + 5, fpmY);
        ctx.lineTo(fpmX + 11, fpmY);
        ctx.moveTo(fpmX, fpmY - 5);
        ctx.lineTo(fpmX, fpmY - 9);
        ctx.stroke();

        // 3. Airspeed Tape (Left HUD Box)
        const tapeLeft = Math.max(20, cx - 140);
        ctx.font = '700 13px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.strokeRect(tapeLeft, cy - 22, 55, 44);
        ctx.fillText(`${state.telemetry.airspeedKts}KT`, tapeLeft + 50, cy + 5);
        ctx.font = '700 10px "Courier New", monospace';
        ctx.fillText(`M ${state.telemetry.mach}`, tapeLeft + 50, cy + 18);

        // 4. Altitude Tape (Right HUD Box)
        const tapeRight = Math.min(state.gameWidth - 75, cx + 85);
        ctx.strokeRect(tapeRight, cy - 22, 58, 44);
        ctx.textAlign = 'left';
        ctx.font = '700 13px "Courier New", monospace';
        ctx.fillText(`${state.telemetry.altitudeFt}FT`, tapeRight + 6, cy + 5);
        ctx.font = '700 10px "Courier New", monospace';
        ctx.fillText(`VSI ${state.telemetry.verticalSpeedFpm}`, tapeRight + 6, cy + 18);

        // 5. G-Force & Angle of Attack (AoA)
        ctx.font = '700 11px "Courier New", monospace';
        ctx.textAlign = 'left';
        let gColor = hudColor;
        if (state.telemetry.gForce > 5.0) gColor = warnColor;
        else if (state.telemetry.gForce > 3.5) gColor = amberColor;

        ctx.fillStyle = gColor;
        ctx.fillText(`G: ${state.telemetry.gForce > 0 ? '+' : ''}${state.telemetry.gForce}G`, tapeLeft, cy - 35);
        ctx.fillStyle = hudColor;
        ctx.fillText(`AoA: ${state.telemetry.aoaDeg}°`, tapeLeft, cy - 48);

        // 6. Tactical Annunciator Banners
        ctx.textAlign = 'center';
        if (this.stalled) {
            ctx.fillStyle = warnColor;
            ctx.shadowColor = warnColor;
            ctx.font = '900 16px "Courier New", monospace';
            ctx.fillText('⚠ [ STALL WARNING ] ⚠', cx, cy - 80);
        } else if (state.telemetry.pullUpWarning) {
            ctx.fillStyle = warnColor;
            ctx.shadowColor = warnColor;
            ctx.font = '900 16px "Courier New", monospace';
            ctx.fillText('▼ [ PULL UP / TERRAIN ] ▼', cx, cy - 80);
        } else if (this.inGroundEffect) {
            ctx.fillStyle = hudColor;
            ctx.font = '800 12px "Courier New", monospace';
            ctx.fillText('⚡ [ GROUND EFFECT CUSHION ] ⚡', cx, cy - 80);
        } else if (this.mach >= 1.0) {
            ctx.fillStyle = amberColor;
            ctx.shadowColor = amberColor;
            ctx.font = '900 14px "Courier New", monospace';
            ctx.fillText('⚡ [ SUPERSONIC MACH 1+ ] ⚡', cx, cy - 80);
        }

        // 7. Tactical Lead Reticle to Next Obstacle
        if (obstacles.list.length > 0) {
            const nextObs = obstacles.list.find(o => !o.passed && !o.destroyed && o.x > cx - 50);
            if (nextObs) {
                const targetY = nextObs.topHeight + (state.pipeGap / 2);
                const targetX = nextObs.x + (obstacles.width / 2);
                
                // Draw dynamic director diamond
                ctx.save();
                ctx.strokeStyle = amberColor;
                ctx.shadowColor = amberColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(targetX, targetY - 10);
                ctx.lineTo(targetX + 10, targetY);
                ctx.lineTo(targetX, targetY + 10);
                ctx.lineTo(targetX - 10, targetY);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.restore();
    }
};
