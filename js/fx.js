window.FX = (() => {
  let muted = false, ctx;
  try { muted = localStorage.getItem('qa-muted') === '1'; } catch (_) {}
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function tone(f, d = .12, type = 'sine', v = .1, delay = 0) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + delay;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(.001, t0 + d);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + d);
    } catch (_) {}
  }
  const seq = (notes, step, d, type, v) => notes.forEach((f, i) => tone(f, d, type, v, i * step));
  const sfx = name => ({
    click: () => tone(520, .06, 'square', .04),
    pop: () => seq([500, 760], .06, .1, 'sine', .09),
    tick: () => tone(900, .04, 'square', .035),
    warn: () => tone(1200, .09, 'square', .07),
    buzzer: () => { tone(160, .6, 'sawtooth', .12); tone(120, .6, 'square', .08); },
    correct: () => seq([523, 659, 784, 1047], .09, .2, 'triangle', .12),
    fanfare: () => seq([523, 523, 523, 659, 784, 659, 784, 1047], .13, .24, 'triangle', .12)
  }[name]?.());

  function confetti(count = 150) {
    if (reduce) return;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200';
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const c = cv.getContext('2d'), colors = ['#ffcf33', '#ef4444', '#2d7ff9', '#29a36a', '#ff8ad8', '#151515'];
    const ps = Array.from({ length: count }, () => ({
      x: cv.width / 2 + (Math.random() - .5) * 220, y: cv.height * .62,
      vx: (Math.random() - .5) * 17, vy: -8 - Math.random() * 13,
      s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
      col: colors[Math.floor(Math.random() * colors.length)]
    }));
    let frames = 0;
    (function loop() {
      c.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(p => {
        p.vy += .38; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); c.restore();
      });
      if (++frames < 170) requestAnimationFrame(loop); else cv.remove();
    })();
  }

  function countUp(el, from, to, ms = 700) {
    if (!el) return;
    const t0 = performance.now();
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    (function step(now) {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  const bump = (i, from, to) => countUp(document.querySelector(`.team-score[data-team="${i}"] .score`), from, to);

  function bg() {
    if (reduce || document.querySelector('.bg-float')) return;
    const box = document.createElement('div'); box.className = 'bg-float';
    '🧠🔬🏛️🎯🎬⭐🚀🏆❓💡🎲🎵'.match(/./gu).forEach((e, i) => {
      const s = document.createElement('span'); s.textContent = e;
      s.style.cssText = `left:${(i * 8.7 + 3) % 96}%;font-size:${26 + (i * 7) % 28}px;animation-duration:${16 + (i * 3) % 14}s;animation-delay:${-i * 2.3}s`;
      box.appendChild(s);
    });
    document.body.prepend(box);
  }

  document.addEventListener('click', e => { if (e.target.closest('button')) sfx('click'); });

  return {
    sfx, confetti, countUp, bump, bg,
    isMuted: () => muted,
    toggleMute() { muted = !muted; try { localStorage.setItem('qa-muted', muted ? '1' : '0'); } catch (_) {} return muted; }
  };
})();
