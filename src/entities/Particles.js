import { state, ctx } from '../state.js';

// Pre-allocate 2000 particles for the pool
export const particlePool = Array.from({ length: 2000 }, () => ({ active: false }));
export const shockwaves = [];

function getFreeParticle() {
    for (let i = 0; i < particlePool.length; i++) {
        if (!particlePool[i].active) return particlePool[i];
    }
    return null;
}

export function createParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        const p = getFreeParticle();
        if (!p) break;
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = (Math.random() - 0.5) * 5;
        p.vy = (Math.random() - 0.5) * 5;
        p.life = 20 + Math.random() * 15;
        p.maxLife = p.life;
        p.color = `hsl(${Math.random() * 50 + 100}, 100%, 70%)`;
        p.type = 'spark';
        p.sizeDelta = 0;
        p.size = 2.5 + Math.random() * 2;
    }
}

export function createJetExhaust(x, y, angle = 0, power = 1.0, isAfterburner = false) {
    const is4K = state.graphicsMode === '4k';
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Direction opposite to jet heading (rear exhaust)
    const backX = -cosA;
    const backY = -sinA;

    // 1. High-energy afterburner / thrust flame
    const flameCount = isAfterburner ? 3 : 1;
    for (let k = 0; k < flameCount; k++) {
        const fireP = getFreeParticle();
        if (fireP) {
            fireP.active = true;
            // Slight lateral jitter across nozzle
            const spread = (Math.random() - 0.5) * 6;
            fireP.x = x + (-sinA * spread);
            fireP.y = y + (cosA * spread);
            
            const speed = (isAfterburner ? 6.5 : 4.0) + Math.random() * 3.0;
            fireP.vx = backX * speed + (Math.random() - 0.5) * 0.8;
            fireP.vy = backY * speed + (Math.random() - 0.5) * 0.8;
            fireP.life = (isAfterburner ? 18 : 12) + Math.random() * 6;
            fireP.maxLife = fireP.life;

            if (isAfterburner) {
                // Supersonic hot blue/cyan/white flame with Mach diamonds
                const r = Math.random();
                fireP.color = r < 0.4 ? '#00f3ff' : (r < 0.75 ? '#ffffff' : '#f72585');
            } else {
                fireP.color = Math.random() < 0.6 ? '#FFA500' : '#FF4500';
            }
            fireP.size = (isAfterburner ? 4.5 : 3.0) + Math.random() * 2;
            fireP.type = isAfterburner ? 'plasma' : 'fire';
            fireP.sizeDelta = -0.08; // shrinks as it burns
        }
    }

    // 2. Trailing heat/smoke expansion
    if (state.frames % (isAfterburner ? 1 : 2) === 0) {
        const smokeP = getFreeParticle();
        if (smokeP) {
            smokeP.active = true;
            smokeP.x = x + backX * 8 + (Math.random() - 0.5) * 6;
            smokeP.y = y + backY * 8 + (Math.random() - 0.5) * 6;
            const smokeSpeed = 1.8 + Math.random() * 1.5;
            smokeP.vx = backX * smokeSpeed + (Math.random() - 0.5) * 0.5;
            smokeP.vy = backY * smokeSpeed - 0.2 + (Math.random() - 0.5) * 0.4;
            smokeP.life = (is4K ? 35 : 22) + Math.random() * 15;
            smokeP.maxLife = smokeP.life;
            smokeP.color = isAfterburner ? 'rgba(180, 220, 255, 0.35)' : 'rgba(210, 210, 210, 0.3)';
            smokeP.sizeDelta = is4K ? 0.35 : 0.22;
            smokeP.size = 4 + Math.random() * 2;
            smokeP.type = 'smoke';
        }
    }
}

export function createWingtipContrail(x, y, intensity = 1.0) {
    const p = getFreeParticle();
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = -state.gameSpeed * 0.8 - Math.random() * 0.5;
    p.vy = (Math.random() - 0.5) * 0.3;
    p.life = 25 + Math.random() * 15;
    p.maxLife = p.life;
    p.color = 'rgba(240, 248, 255, 0.45)';
    p.type = 'contrail';
    p.size = 2.0 * intensity;
    p.sizeDelta = 0.18;
}

export function createMachCone(x, y, angle = 0) {
    const p = getFreeParticle();
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.angle = angle;
    p.vx = -state.gameSpeed * 0.5;
    p.vy = 0;
    p.life = 10;
    p.maxLife = 10;
    p.color = 'rgba(255, 255, 255, 0.7)';
    p.type = 'machCone';
    p.size = 18;
    p.sizeDelta = 2.5;
}

export function createShockwave(x, y, maxRadius = 60, color = 'rgba(0, 243, 255, 0.8)') {
    shockwaves.push({
        x,
        y,
        radius: 5,
        maxRadius,
        life: 25,
        maxLife: 25,
        color
    });
}

export function createGroundSpray(x, y, intensity = 1.0) {
    for (let i = 0; i < 2; i++) {
        const p = getFreeParticle();
        if (!p) break;
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 15;
        p.y = y;
        p.vx = -3 - Math.random() * 3;
        p.vy = -Math.random() * 2.5 * intensity;
        p.life = 20 + Math.random() * 10;
        p.maxLife = p.life;
        p.color = 'rgba(255, 255, 255, 0.4)';
        p.type = 'spray';
        p.size = 3.5 + Math.random() * 3;
        p.sizeDelta = 0.2;
    }
}

export function createScrapeSparks(x, y, dirX = -1, dirY = 0) {
    for (let i = 0; i < 12; i++) {
        const p = getFreeParticle();
        if (!p) break;
        p.active = true;
        p.x = x;
        p.y = y;
        const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.5;
        const speed = 4 + Math.random() * 8;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 15 + Math.random() * 10;
        p.maxLife = p.life;
        p.color = Math.random() < 0.7 ? '#FFD700' : '#FF4500';
        p.type = 'spark';
        p.size = 2.0 + Math.random() * 1.5;
        p.sizeDelta = -0.05;
    }
}

export function handleParticles() {
    // 1. Render Shockwave Rings
    for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += (sw.maxRadius - sw.radius) * 0.22;
        sw.life--;

        const alpha = Math.max(0, sw.life / sw.maxLife);
        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3 * alpha;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner distortion shimmer
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * alpha;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (sw.life <= 0) {
            shockwaves.splice(s, 1);
        }
    }

    // 2. Render Particle Pool
    for (let i = 0; i < particlePool.length; i++) {
        let p = particlePool[i];
        if (!p.active) continue;

        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        const progress = p.life / p.maxLife;

        ctx.save();
        if (p.type === 'fire' || p.type === 'plasma') {
            ctx.globalCompositeOperation = 'lighter';
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, progress));

        const currentSize = Math.max(0.2, (p.size || 3) + ((p.maxLife - p.life) * (p.sizeDelta || 0)));

        if (p.type === 'machCone') {
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (progress * 0.7) + ')';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, currentSize * 0.4, currentSize, (p.angle || 0) + Math.PI / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.type === 'contrail' || p.type === 'smoke' || p.type === 'spray') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
            ctx.fill();

            // Glow core for plasma & sparks
            if (p.type === 'plasma' || p.type === 'fire') {
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = Math.min(1, progress * 1.5);
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();

        if (p.life <= 0) {
            p.active = false;
        }
    }
}

export function createFireworks(x, y) {
    for (let i = 0; i < 40; i++) {
        const p = getFreeParticle();
        if (!p) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 7;
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 40 + Math.random() * 20;
        p.maxLife = p.life;
        p.color = `hsl(${Math.random() * 360}, 100%, 65%)`;
        p.type = 'firework';
        p.sizeDelta = -0.03;
        p.size = 3.5;
    }
}

export function resetParticles() {
    for (let i = 0; i < particlePool.length; i++) {
        particlePool[i].active = false;
    }
    shockwaves.length = 0;
}
