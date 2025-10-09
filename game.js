// Zombie Survival Shooter Game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');

// Game settings
const PLAYER_SIZE = 32;
const ZOMBIE_SIZE = 32;
const BULLET_SIZE = 8;
const LOOT_SIZE = 16;
const PLAYER_SPEED = 4;
const ZOMBIE_SPEED = 1.5;
const BULLET_SPEED = 8;
const SPAWN_INTERVAL = 1500;
const LOOT_HEAL = 20;

let keys = {};
let bullets = [];
let zombies = [];
let unicorns = [];
let loots = [];
let score = 0;
let lastSpawn = 0;
let lastUnicornSpawn = 0;
let boss = null;
let bossActiveUntilScore = 1000;
// audio context for shooting noise
let audioCtx = null;

function playShootSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(1000 + Math.random()*400, audioCtx.currentTime);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime);
        o.connect(g); g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.06 + Math.random()*0.04);
    } catch (e) {
        // audio not available
    }
}

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: PLAYER_SIZE,
    health: 100,
    angle: 0
};

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(-PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.fillStyle = '#fff';
    ctx.fillRect(PLAYER_SIZE/4, -PLAYER_SIZE/8, PLAYER_SIZE/2, PLAYER_SIZE/4); // gun
    ctx.restore();
}

function drawZombie(z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.arc(0, 0, ZOMBIE_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -6, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-6, -6, 1.2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

function drawBullet(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(0, 0, BULLET_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

function drawLoot(l) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.fillStyle = '#00bcd4';
    ctx.beginPath();
    ctx.arc(0, 0, LOOT_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

// draw unicorn
function drawUnicorn(u) {
    ctx.save();
    ctx.translate(u.x, u.y);
    // body
    ctx.fillStyle = '#ff80ab';
    ctx.beginPath();
    ctx.ellipse(0, 0, ZOMBIE_SIZE/2, ZOMBIE_SIZE/3, 0, 0, Math.PI*2);
    ctx.fill();
    // horn
    ctx.fillStyle = '#ffd600';
    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.lineTo(14, -24);
    ctx.lineTo(4, -18);
    ctx.fill();
    // eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-6, -4, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

// particles and damage text for hit feedback
let particles = [];
let damageTexts = [];

function spawnHitEffects(x, y, amount) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x, y,
            vx: (Math.random()-0.5)*4,
            vy: (Math.random()-0.5)*4,
            life: 30 + Math.random()*20,
            color: '#ff5252'
        });
    }
    damageTexts.push({x, y, text: String(amount), life: 60});
}

function spawnZombie() {
    let edge = Math.floor(Math.random()*4);
    let x, y;
    if (edge === 0) { // top
        x = Math.random()*canvas.width;
        y = -ZOMBIE_SIZE;
    } else if (edge === 1) { // right
        x = canvas.width + ZOMBIE_SIZE;
        y = Math.random()*canvas.height;
    } else if (edge === 2) { // bottom
        x = Math.random()*canvas.width;
        y = canvas.height + ZOMBIE_SIZE;
    } else { // left
        x = -ZOMBIE_SIZE;
        y = Math.random()*canvas.height;
    }
    zombies.push({x, y, size: ZOMBIE_SIZE, health: 30});
}

function spawnUnicorn() {
    // spawn unicorns less frequently
    let x = Math.random()*canvas.width;
    let y = Math.random()*canvas.height;
    unicorns.push({x, y, size: ZOMBIE_SIZE, health: 20, vx:0, vy:0, target: null, dashCooldown: 0});
}

function spawnLoot(x, y) {
    loots.push({x, y, size: LOOT_SIZE});
}

function updatePlayer() {
    if (keys['w'] || keys['ArrowUp']) player.y -= PLAYER_SPEED;
    if (keys['s'] || keys['ArrowDown']) player.y += PLAYER_SPEED;
    if (keys['a'] || keys['ArrowLeft']) player.x -= PLAYER_SPEED;
    if (keys['d'] || keys['ArrowRight']) player.x += PLAYER_SPEED;
    // Clamp
    player.x = Math.max(PLAYER_SIZE/2, Math.min(canvas.width-PLAYER_SIZE/2, player.x));
    player.y = Math.max(PLAYER_SIZE/2, Math.min(canvas.height-PLAYER_SIZE/2, player.y));
}

function updateBullets() {
    for (let i = bullets.length-1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * BULLET_SPEED;
        b.y += Math.sin(b.angle) * BULLET_SPEED;
        // Remove if out of bounds
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }
}

function updateZombies() {
    for (let i = zombies.length-1; i >= 0; i--) {
        let z = zombies[i];
        let dx = player.x - z.x;
        let dy = player.y - z.y;
        let dist = Math.hypot(dx, dy);
        if (dist > 0) {
            z.x += (dx/dist) * ZOMBIE_SPEED;
            z.y += (dy/dist) * ZOMBIE_SPEED;
        }
        // Collision with player
        if (dist < (PLAYER_SIZE+ZOMBIE_SIZE)/2) {
            // zombie damages player but player can still shoot
            player.health -= 0.3;
            if (player.health < 0) player.health = 0;
            // small knockback to zombie so it doesn't get stuck
            let push = 1;
            z.x -= (dx/dist) * push;
            z.y -= (dy/dist) * push;
        }
    }
}

function updateUnicorns() {
    for (let i = unicorns.length-1; i >= 0; i--) {
        let u = unicorns[i];
        // unicorn AI: choose a random target occasionally, then dash toward it
        if (!u.target || Math.random() < 0.005) {
            u.target = {x: Math.random()*canvas.width, y: Math.random()*canvas.height};
        }
        let dx = u.target.x - u.x;
        let dy = u.target.y - u.y;
        let dist = Math.hypot(dx, dy);
        let speed = 1.5;
        if (u.dashCooldown <= 0 && Math.random() < 0.01) {
            // dash
            u.vx = (dx/dist) * 6;
            u.vy = (dy/dist) * 6;
            u.dashCooldown = 60 + Math.random()*60;
        }
        u.x += u.vx || 0;
        u.y += u.vy || 0;
        // slow down
        u.vx *= 0.95;
        u.vy *= 0.95;
        if (dist < 10) u.target = null;
        u.dashCooldown -= 1;
        // clamp
        u.x = Math.max(u.size/2, Math.min(canvas.width-u.size/2, u.x));
        u.y = Math.max(u.size/2, Math.min(canvas.height-u.size/2, u.y));
        // collision with player (unicorns don't hurt player)
    }
}

function spawnBoss() {
    boss = {x: canvas.width/2, y: -100, size: 120, health: 500, vx:0, vy:1.2, attackTimer: 0};
}

function updateBoss() {
    if (!boss) return;
    // move into arena
    boss.x += boss.vx;
    boss.y += boss.vy;
    // simple horizontal sway
    boss.vx = Math.sin(Date.now()/500) * 1.5;
    // attack periodically
    boss.attackTimer -= 1;
    if (boss.attackTimer <= 0) {
        boss.attackTimer = 80;
        // fire projectiles toward player
        for (let a = -1; a <= 1; a++) {
            let angle = Math.atan2(player.y - boss.y, player.x - boss.x) + a*0.2;
            bullets.push({x: boss.x, y: boss.y, angle: angle, fromBoss: true});
        }
    }
    // clamp inside canvas
    boss.x = Math.max(boss.size/2, Math.min(canvas.width-boss.size/2, boss.x));
    // boss collision with bullets handled in handleCollisions
}

function drawBoss() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    // big menacing body
    ctx.fillStyle = '#6a1b9a';
    ctx.beginPath();
    ctx.arc(0, 0, boss.size/2, 0, Math.PI*2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-20, -10, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-20, -10, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, -10, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(20, -10, 3, 0, Math.PI*2); ctx.fill();
    // health bar
    ctx.fillStyle = '#000'; ctx.fillRect(-boss.size/2, boss.size/2 + 6, boss.size, 8);
    ctx.fillStyle = '#ff5252'; ctx.fillRect(-boss.size/2, boss.size/2 + 6, boss.size * (boss.health/500), 8);
    ctx.restore();
}

function updateParticles() {
    for (let i = particles.length-1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = damageTexts.length-1; i >= 0; i--) {
        let d = damageTexts[i];
        d.y -= 0.5;
        d.life -= 1;
        if (d.life <= 0) damageTexts.splice(i, 1);
    }
}

function updateLoots() {
    for (let i = loots.length-1; i >= 0; i--) {
        let l = loots[i];
        let dist = Math.hypot(player.x - l.x, player.y - l.y);
        if (dist < (PLAYER_SIZE+LOOT_SIZE)/2) {
            player.health = Math.min(100, player.health + LOOT_HEAL);
            loots.splice(i, 1);
        }
    }
}

function handleCollisions() {
    for (let i = zombies.length-1; i >= 0; i--) {
        let z = zombies[i];
        for (let j = bullets.length-1; j >= 0; j--) {
            let b = bullets[j];
            let dist = Math.hypot(z.x - b.x, z.y - b.y);
            if (dist < (ZOMBIE_SIZE+BULLET_SIZE)/2) {
                z.health -= 20;
                bullets.splice(j, 1);
                spawnHitEffects(z.x, z.y, 20);
                if (z.health <= 0) {
                    score += 10;
                    spawnLoot(z.x, z.y);
                    zombies.splice(i, 1);
                    break;
                }
            }
        }
    }
    // unicorn collisions
    for (let i = unicorns.length-1; i >= 0; i--) {
        let u = unicorns[i];
        for (let j = bullets.length-1; j >= 0; j--) {
            let b = bullets[j];
            let dist = Math.hypot(u.x - b.x, u.y - b.y);
            if (dist < (u.size+BULLET_SIZE)/2) {
                u.health -= 20;
                bullets.splice(j, 1);
                spawnHitEffects(u.x, u.y, 50);
                if (u.health <= 0) {
                    score += 50; // unicorns give more points!
                    // sparkle loot
                    spawnLoot(u.x, u.y);
                    unicorns.splice(i, 1);
                    break;
                }
            }
        }
    }
    // boss collisions
    if (boss) {
        for (let j = bullets.length-1; j >= 0; j--) {
            let b = bullets[j];
            if (b.fromBoss) continue; // boss bullets don't hurt boss
            let dist = Math.hypot(boss.x - b.x, boss.y - b.y);
            if (dist < (boss.size+BULLET_SIZE)/2) {
                boss.health -= 10;
                bullets.splice(j, 1);
                spawnHitEffects(b.x, b.y, 10);
                if (boss.health <= 0) {
                    score += 500;
                    // clear boss and spawn big loot
                    spawnLoot(boss.x, boss.y);
                    boss = null;
                    bossActiveUntilScore += 1000; // next boss threshold
                    break;
                }
            }
        }
    }
    // boss bullets can hit the player
    for (let j = bullets.length-1; j >= 0; j--) {
        let b = bullets[j];
        if (!b.fromBoss) continue;
        let dist = Math.hypot(player.x - b.x, player.y - b.y);
        if (dist < (PLAYER_SIZE+BULLET_SIZE)/2) {
            player.health -= 12;
            spawnHitEffects(b.x, b.y, 12);
            bullets.splice(j, 1);
            if (player.health < 0) player.health = 0;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer();
    zombies.forEach(drawZombie);
    unicorns.forEach(drawUnicorn);
    bullets.forEach(drawBullet);
    // draw boss bullets differently
    bullets.forEach(b => {
        if (b.fromBoss) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.fillStyle = '#8e24aa';
            ctx.beginPath();
            ctx.arc(0, 0, BULLET_SIZE/2, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    });
    loots.forEach(drawLoot);
    // draw particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    damageTexts.forEach(d => {
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(d.text, d.x, d.y);
    });
    // draw boss
    drawBoss();
}

function update() {
    updatePlayer();
    updateBullets();
    updateZombies();
    updateUnicorns();
    updateLoots();
    updateParticles();
    handleCollisions();
    scoreEl.textContent = 'Score: ' + score;
    healthEl.textContent = 'Health: ' + Math.max(0, Math.floor(player.health));
}

function gameLoop(ts) {
    if (player.health <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width/2, canvas.height/2);
        ctx.font = '24px Arial';
        ctx.fillText('Final Score: ' + score, canvas.width/2, canvas.height/2+40);
        ctx.fillText('Refresh to play again', canvas.width/2, canvas.height/2+80);
        return;
    }
    let now = Date.now();
    if (now - lastSpawn > SPAWN_INTERVAL) {
        spawnZombie();
        lastSpawn = now;
    }
    // unicorns spawn less often
    if (now - lastUnicornSpawn > SPAWN_INTERVAL * 8) {
        spawnUnicorn();
        lastUnicornSpawn = now;
    }
    // spawn a boss when score threshold reached
    if (!boss && score >= bossActiveUntilScore) {
        spawnBoss();
    }
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    player.angle = Math.atan2(my - player.y, mx - player.x);
});

canvas.addEventListener('mousedown', e => {
    if (player.health <= 0) return;
    bullets.push({
        x: player.x + Math.cos(player.angle)*PLAYER_SIZE/2,
        y: player.y + Math.sin(player.angle)*PLAYER_SIZE/2,
        angle: player.angle
    });
    playShootSound();
});

// Allow shooting with spacebar too
document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        bullets.push({
            x: player.x + Math.cos(player.angle)*PLAYER_SIZE/2,
            y: player.y + Math.sin(player.angle)*PLAYER_SIZE/2,
            angle: player.angle
        });
        playShootSound();
    }
});

// Start game
requestAnimationFrame(gameLoop);
