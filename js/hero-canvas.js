(function () {
  'use strict';

  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const hero = canvas.closest('.hero');

  let W = 0, H = 0;
  let time = 0;
  let animId;

  // Mouse tracking
  let mouseX = null, mouseY = null;
  let lastMouseX = null, lastMouseY = null;
  let mouseVelocity = 0;

  // Particle pools
  const trailParticles = [];
  const ambientParticles = [];
  const ripples = [];

  // --- CONFIG ---
  const AMBIENT_COUNT = 80;
  const TRAIL_LIFE_BASE = 1.2;   // seconds equivalent
  const TRAIL_DECAY = 0.012;
  const GLYPH_CHANCE = 0.08;
  const GLYPHS = ['{', '}', '~', '//', '01', '<>', ';'];

  // Colors
  const BLUE   = [30,  136, 229];
  const CYAN   = [79,  195, 247];
  const DBLUE  = [21,  101, 192];
  const LBLUE  = [144, 202, 249];
  const PALETTE = [BLUE, CYAN, DBLUE, LBLUE, [100, 181, 246]];

  // ─── River path ────────────────────────────────────────────────────────────
  function riverY(x, t) {
    const n = x / W;
    return H * 0.5
      + Math.sin(n * Math.PI * 1.6 + t * 0.32) * H * 0.20
      + Math.sin(n * Math.PI * 3.8 + t * 0.16) * H * 0.06
      + Math.sin(n * Math.PI * 7.2 - t * 0.35) * H * 0.022;
  }

  // ─── Trail Particle (cursor trail) ─────────────────────────────────────────
  class TrailParticle {
    constructor(x, y, speed) {
      this.x = x;
      this.y = y;
      // Gentle random drift, faster mouse = bigger particle
      const vel = Math.min(speed, 18);
      this.vx = (Math.random() - 0.5) * 0.9;
      this.vy = (Math.random() - 0.5) * 0.9 - 0.25;
      this.size = Math.random() * 2.5 + 1.5 + vel * 0.08;
      this.life = 1;
      this.decay = TRAIL_DECAY * (0.8 + Math.random() * 0.6);
      // Alternate between blue and cyan
      const c = Math.random() > 0.45 ? CYAN : BLUE;
      this.r = c[0]; this.g = c[1]; this.b = c[2];
      this.isGlyph = Math.random() < GLYPH_CHANCE;
      this.glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      this.glyphSize = Math.random() * 10 + 9;
    }

    update() {
      this.x  += this.vx;
      this.y  += this.vy;
      this.vy += 0.018;   // gentle gravity
      this.vx *= 0.97;
      this.life -= this.decay;
      this.size *= 0.988;
    }

    draw() {
      if (this.life <= 0) return;
      const a = Math.max(0, this.life);

      ctx.save();
      ctx.globalAlpha = a;

      if (this.isGlyph) {
        ctx.shadowBlur  = 14;
        ctx.shadowColor = `rgba(${this.r},${this.g},${this.b},0.8)`;
        ctx.font        = `${this.glyphSize}px 'JetBrains Mono', monospace`;
        ctx.fillStyle   = `rgba(${this.r},${this.g},${this.b},1)`;
        ctx.fillText(this.glyph, this.x, this.y);
      } else {
        // Outer glow
        ctx.shadowBlur  = 18;
        ctx.shadowColor = `rgba(${this.r},${this.g},${this.b},0.9)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},0.9)`;
        ctx.fill();

        // Bright inner core
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 240, 255, 0.95)`;
        ctx.fill();
      }

      ctx.restore();
    }

    isDead() { return this.life <= 0 || this.size < 0.25; }
  }

  // ─── Ambient Particle (background river flow) ───────────────────────────────
  class AmbientParticle {
    constructor(xStart) {
      this.isGlyph = Math.random() < 0.07;
      this.glyph   = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      this.reset(xStart);
    }

    reset(xStart) {
      this.x       = xStart !== undefined ? xStart : -Math.random() * 80;
      this.channel = (Math.random() - 0.5) * 2;  // -1 to 1, spread across river
      this.y       = riverY(this.x, time) + this.channel * H * 0.12;
      this.speed   = Math.random() * 0.9 + 0.2;
      this.size    = Math.random() * 1.4 + 0.3;
      this.glyphSize = Math.random() * 8 + 7;
      this.vx = 0;
      this.vy = 0;
      const c      = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      this.r = c[0]; this.g = c[1]; this.b = c[2];
      this.alpha   = Math.random() * 0.22 + 0.06;
    }

    update(t) {
      // Softly follow the river
      const ty = riverY(this.x + 2, t) + this.channel * H * 0.12;
      this.vy  += (ty - this.y) * 0.05;
      this.vy  *= 0.82;
      this.x   += this.speed + this.vx;
      this.y   += this.vy;
      this.vx  *= 0.9;

      // Mouse gentle push
      if (mouseX !== null) {
        const dx   = this.x - mouseX;
        const dy   = this.y - mouseY;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 110 * 110 && dist2 > 0) {
          const dist  = Math.sqrt(dist2);
          const force = (1 - dist / 110) * 2.5;
          this.vx += (dx / dist) * force;
          this.vy += (dy / dist) * force;
        }
      }

      if (this.x > W + 20) this.reset();
      this.y = Math.max(0, Math.min(H, this.y));
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      if (this.isGlyph) {
        ctx.font      = `${this.glyphSize}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = `rgb(${this.r},${this.g},${this.b})`;
        ctx.fillText(this.glyph, this.x, this.y);
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${this.r},${this.g},${this.b})`;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ─── Click Ripple ───────────────────────────────────────────────────────────
  class Ripple {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.r = 0;
      this.maxR  = 80 + Math.random() * 50;
      this.speed = 2.8 + Math.random() * 0.8;
      this.life  = 1;
    }

    update() {
      this.r    += this.speed;
      this.life  = Math.max(0, 1 - this.r / this.maxR);
    }

    draw() {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.life * 0.8;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = `rgba(79, 195, 247, 0.6)`;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(79, 195, 247, ${this.life})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      if (this.r > 14) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r - 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(30, 136, 229, ${this.life * 0.5})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    isDead() { return this.r >= this.maxR; }
  }

  // ─── Background drawing ─────────────────────────────────────────────────────
  function drawDotGrid() {
    const sp = 44;
    ctx.fillStyle = 'rgba(30, 136, 229, 0.07)';
    for (let x = 0; x <= W; x += sp) {
      for (let y = 0; y <= H; y += sp) {
        ctx.beginPath();
        ctx.arc(x, y, 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRiverGlow(t) {
    // Topographic lines around the river
    ctx.save();
    for (let i = 1; i <= 4; i++) {
      const spread = i * H * 0.045;
      const alpha  = 0.04 - i * 0.007;
      if (alpha <= 0) break;
      ctx.strokeStyle = `rgba(79, 195, 247, ${alpha})`;
      ctx.lineWidth   = 1;

      [1, -1].forEach(sign => {
        ctx.beginPath();
        ctx.moveTo(0, riverY(0, t) + sign * spread);
        for (let x = 4; x <= W; x += 4) {
          ctx.lineTo(x, riverY(x, t) + sign * spread);
        }
        ctx.stroke();
      });
    }

    // Soft river glow band
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0,    'rgba(30, 136, 229, 0)');
    grad.addColorStop(0.3,  'rgba(30, 136, 229, 0.05)');
    grad.addColorStop(0.55, 'rgba(79, 195, 247, 0.07)');
    grad.addColorStop(0.8,  'rgba(30, 136, 229, 0.04)');
    grad.addColorStop(1,    'rgba(30, 136, 229, 0)');

    ctx.beginPath();
    ctx.moveTo(0, riverY(0, t));
    for (let x = 4; x <= W; x += 4) ctx.lineTo(x, riverY(x, t));
    ctx.strokeStyle = grad;
    ctx.lineWidth   = H * 0.13;
    ctx.stroke();

    ctx.restore();
  }

  // ─── Init ───────────────────────────────────────────────────────────────────
  function initAmbient() {
    ambientParticles.length = 0;
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      ambientParticles.push(
        new AmbientParticle((i / AMBIENT_COUNT) * W * 1.1)
      );
    }
  }

  function resize() {
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
    initAmbient();
  }

  // ─── Spawn trail particles along movement path ──────────────────────────────
  function spawnTrail(x1, y1, x2, y2, vel) {
    const dx    = x2 - x1;
    const dy    = y2 - y1;
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / 6));  // 1 particle per 6px

    for (let i = 0; i < steps; i++) {
      const t  = (i + 1) / steps;
      trailParticles.push(new TrailParticle(x1 + dx * t, y1 + dy * t, vel));
    }
  }

  // ─── Main loop ──────────────────────────────────────────────────────────────
  function animate() {
    ctx.clearRect(0, 0, W, H);
    time += 0.016;

    drawDotGrid();
    drawRiverGlow(time);

    // Ambient background particles
    for (const p of ambientParticles) { p.update(time); p.draw(); }

    // Trail particles — render oldest first (they're below newer ones)
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      trailParticles[i].update();
      trailParticles[i].draw();
      if (trailParticles[i].isDead()) trailParticles.splice(i, 1);
    }

    // Ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].update();
      ripples[i].draw();
      if (ripples[i].isDead()) ripples.splice(i, 1);
    }

    // Cap trail pool size to avoid memory bloat
    if (trailParticles.length > 1200) trailParticles.splice(0, 200);

    animId = requestAnimationFrame(animate);
  }

  // ─── Events ─────────────────────────────────────────────────────────────────
  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (lastMouseX !== null) {
      const dx = x - lastMouseX;
      const dy = y - lastMouseY;
      mouseVelocity = Math.sqrt(dx * dx + dy * dy);
      spawnTrail(lastMouseX, lastMouseY, x, y, mouseVelocity);
    }

    lastMouseX = mouseX = x;
    lastMouseY = mouseY = y;
  });

  hero.addEventListener('mouseleave', () => {
    mouseX = mouseY = lastMouseX = lastMouseY = null;
    mouseVelocity = 0;
  });

  hero.addEventListener('click', e => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ripples.push(new Ripple(x, y));
    setTimeout(() => ripples.push(new Ripple(x, y)), 90);
    setTimeout(() => ripples.push(new Ripple(x, y)), 180);
  });

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    resize();
    animate();
  });

  resize();
  animate();
})();