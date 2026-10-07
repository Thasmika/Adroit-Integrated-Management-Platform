import React, { useEffect, useRef } from 'react';

// Illustrated Dubai night skyline drawn on canvas: Burj Khalifa, Burj Al Arab, Dubai Frame,
// Emirates Towers, the Sheikh Zayed Road towers and their reflection on the creek.
// Replace with a licensed photo (data URI) if preferred.
export default function DubaiSkyline() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      cv.width = W * dpr; cv.height = H * dpr;
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 7;
      const horizon = H * 0.66;

      // sky: dusk over the Gulf
      const sky = c.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#07131a'); sky.addColorStop(0.5, '#10303a'); sky.addColorStop(0.82, '#2c5d63'); sky.addColorStop(1, '#c9895a');
      c.fillStyle = sky; c.fillRect(0, 0, W, horizon);
      for (let i = 0; i < 110; i++) { c.fillStyle = `rgba(230,240,240,${0.15 + rnd() * 0.5})`; c.fillRect(rnd() * W, rnd() * horizon * 0.55, rnd() < 0.1 ? 1.6 : 1, rnd() < 0.1 ? 1.6 : 1); }
      const glow = c.createRadialGradient(W * 0.62, horizon, 0, W * 0.62, horizon, W * 0.55);
      glow.addColorStop(0, 'rgba(240,170,100,.35)'); glow.addColorStop(1, 'rgba(240,170,100,0)');
      c.fillStyle = glow; c.fillRect(0, 0, W, horizon);

      const s = Math.min(W / 800, H / 900) * 1.15; // scale
      const layer = (col) => { c.fillStyle = col; };
      const windows = (x, y, w, h, dens = 0.35) => {
        for (let yy = y + 6 * s; yy < horizon - 4; yy += 7 * s) for (let xx = x + 3 * s; xx < x + w - 3 * s; xx += 5 * s) {
          if (rnd() < dens) { c.fillStyle = rnd() < 0.8 ? 'rgba(255,214,150,.75)' : 'rgba(170,220,230,.7)'; c.fillRect(xx, yy, 1.6 * s, 2.4 * s); }
        }
      };

      // far layer of towers
      layer('#0d242b');
      for (let x = 0; x < W; ) { const w = (18 + rnd() * 30) * s; const h = (60 + rnd() * 140) * s; c.fillRect(x, horizon - h, w, h); x += w + rnd() * 6 * s; }

      // mid layer with lit windows
      for (let x = -10; x < W; ) {
        const w = (22 + rnd() * 34) * s; const h = (90 + rnd() * 190) * s;
        if (Math.abs(x - W * 0.62) > 70 * s) {
          layer('#0a1a20'); c.fillRect(x, horizon - h, w, h);
          if (rnd() < 0.35) { c.beginPath(); c.moveTo(x, horizon - h); c.lineTo(x + w / 2, horizon - h - 22 * s); c.lineTo(x + w, horizon - h); c.fill(); }
          windows(x, horizon - h, w, h, 0.28);
        }
        x += w + (4 + rnd() * 10) * s;
      }

      // Emirates Towers (twin triangular tops)
      const et = (x, h) => { layer('#08161b'); c.beginPath(); c.moveTo(x, horizon); c.lineTo(x, horizon - h); c.lineTo(x + 26 * s, horizon - h - 34 * s); c.lineTo(x + 30 * s, horizon); c.fill(); windows(x, horizon - h, 26 * s, h, 0.3); };
      et(W * 0.30, 250 * s); et(W * 0.30 + 38 * s, 215 * s);

      // Burj Khalifa: stepped tapering spire
      const bx = W * 0.62, base = 64 * s, total = 560 * s;
      layer('#061216');
      c.beginPath();
      const steps = 11;
      c.moveTo(bx - base / 2, horizon);
      for (let i = 0; i < steps; i++) { const y = horizon - (total * 0.78) * (i / steps); const w = base * (1 - i / steps) * 0.95 + 3 * s; c.lineTo(bx - w / 2, y); c.lineTo(bx - w / 2 + 2 * s, y - 4 * s); }
      c.lineTo(bx - 1.6 * s, horizon - total); c.lineTo(bx + 1.6 * s, horizon - total);
      for (let i = steps - 1; i >= 0; i--) { const y = horizon - (total * 0.78) * (i / steps); const w = base * (1 - i / steps) * 0.95 + 3 * s; c.lineTo(bx + w / 2 - 2 * s, y - 4 * s); c.lineTo(bx + w / 2, y); }
      c.lineTo(bx + base / 2, horizon); c.closePath(); c.fill();
      c.save(); c.clip();
      for (let yy = horizon - total * 0.78; yy < horizon; yy += 5 * s) for (let xx = bx - base / 2; xx < bx + base / 2; xx += 4 * s) if (rnd() < 0.33) { c.fillStyle = 'rgba(255,220,160,.8)'; c.fillRect(xx, yy, 1.4 * s, 2 * s); }
      c.restore();
      c.fillStyle = 'rgba(255,90,70,.95)'; c.beginPath(); c.arc(bx, horizon - total + 2 * s, 2.2 * s, 0, 7); c.fill();

      // Dubai Frame
      const fx = W * 0.14, fw = 58 * s, fh = 170 * s;
      layer('#0b1d22'); c.fillRect(fx, horizon - fh, fw, fh);
      c.fillStyle = sky; c.fillRect(fx + 11 * s, horizon - fh + 16 * s, fw - 22 * s, fh - 16 * s);
      c.fillStyle = 'rgba(201,164,90,.55)'; c.fillRect(fx, horizon - fh, fw, 3 * s);

      // Burj Al Arab sail on the right shore
      const ax = W * 0.9;
      layer('#08171c');
      c.beginPath(); c.moveTo(ax, horizon); c.lineTo(ax, horizon - 230 * s); c.quadraticCurveTo(ax + 70 * s, horizon - 140 * s, ax + 58 * s, horizon); c.fill();
      c.fillStyle = 'rgba(210,235,240,.18)'; c.beginPath(); c.moveTo(ax + 4 * s, horizon - 8 * s); c.lineTo(ax + 4 * s, horizon - 210 * s); c.quadraticCurveTo(ax + 58 * s, horizon - 138 * s, ax + 50 * s, horizon - 8 * s); c.fill();
      c.fillStyle = '#08171c'; c.fillRect(ax - 4 * s, horizon - 244 * s, 3 * s, 244 * s);

      // water and reflections
      const sea = c.createLinearGradient(0, horizon, 0, H);
      sea.addColorStop(0, '#16353b'); sea.addColorStop(1, '#070f12');
      c.fillStyle = sea; c.fillRect(0, horizon, W, H - horizon);
      c.save(); c.globalAlpha = 0.22; c.translate(0, horizon * 2); c.scale(1, -1);
      c.drawImage(cv, 0, 0, W * dpr, horizon * dpr, 0, 0, W, horizon); c.restore();
      for (let i = 0; i < 70; i++) { const y = horizon + rnd() * (H - horizon); c.fillStyle = `rgba(255,210,150,${0.05 + rnd() * 0.12})`; c.fillRect(rnd() * W, y, (10 + rnd() * 50) * s, 1); }
      c.fillStyle = 'rgba(255,200,140,.45)'; c.fillRect(0, horizon, W, 1);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);
  return <canvas ref={ref} className="skyline" role="img" aria-label="Illustrated Dubai skyline at dusk with Burj Khalifa, Burj Al Arab and the Dubai Frame" />;
}
