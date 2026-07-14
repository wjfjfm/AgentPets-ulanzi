/**
 * 宠物美术(像素风)—— 3 个物种 + 分阶段累进部件 + 行为层(工作/睡觉/等待/呼喊)
 * ----------------------------------------------------------------------------
 * 所有形状都以“方块像素”绘制:低分辨率栅格 + 平涂色 + 深色描边 + 阶梯边缘,
 * 运动量按方块步进(bob/摆动量对齐到像素),呈现复古像素质感。
 *
 * drawPet(ctx, cfg) 与旧接口保持一致:
 *   cfg = { species, growth{stage,feature,scale,...}, behavior, phase, cx, cy, unit }
 *
 * 部件按 growth.feature 累进:
 *   0 蛋 · 1 破壳 · 2 初生(蛋壳碎片) · 3 腿 · 4 变大 · 5 器官(耳/角/触角)
 *   6 尾巴 · 7 觉醒(翅膀/胡须/气泡) · 8 腮红+大眼 · 9 项圈 · 10 手臂
 *   11 王冠 · 12 光环 · 13 花纹 · 14 全身辉光
 */
(function () {
  const PALETTES = {
    slime: { body: '#6fcf72', shade: '#4aa84f', belly: '#d7f7c8', accent: '#215c27', eye: '#173d18', glow: '#a6ff88' },
    cat:   { body: '#f5a25b', shade: '#dd7f38', belly: '#ffe6c7', accent: '#8a4718', eye: '#3a2a12', glow: '#ffd08a' },
    dragon:{ body: '#9b6cf0', shade: '#7a4bd0', belly: '#e7d9ff', accent: '#47228f', eye: '#241237', glow: '#c3a4ff' },
  };

  // 物种体型比例(相对 unit)
  const SHAPE = {
    slime:  { w: 1.20, h: 0.98 },
    cat:    { w: 1.02, h: 1.08 },
    dragon: { w: 0.94, h: 1.22 },
  };

  // 把 #rrggbb + alpha -> rgba()
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    return `rgba(${parseInt(h.substr(0, 2), 16)},${parseInt(h.substr(2, 2), 16)},${parseInt(h.substr(4, 2), 16)},${a})`;
  }

  // ---- 像素画笔:栅格锚定在 (ox,oy),边界为 ox + k*blk ----
  function makePen(ctx, ox, oy, blk) {
    function edgeX(k) { return Math.round(ox + k * blk); }
    function edgeY(k) { return Math.round(oy + k * blk); }
    function rect(x0, y0, x1, y1, color) {
      const kx0 = Math.floor((Math.min(x0, x1) - ox) / blk);
      const kx1 = Math.ceil((Math.max(x0, x1) - ox) / blk);
      const ky0 = Math.floor((Math.min(y0, y1) - oy) / blk);
      const ky1 = Math.ceil((Math.max(y0, y1) - oy) / blk);
      ctx.fillStyle = color;
      for (let ky = ky0; ky < ky1; ky++) {
        const py = edgeY(ky), ph = edgeY(ky + 1) - py;
        for (let kx = kx0; kx < kx1; kx++) {
          const px = edgeX(kx);
          ctx.fillRect(px, py, edgeX(kx + 1) - px, ph);
        }
      }
    }
    function ell(x, y, rx, ry, color) {
      const kx0 = Math.floor((x - rx - ox) / blk), kx1 = Math.ceil((x + rx - ox) / blk);
      const ky0 = Math.floor((y - ry - oy) / blk), ky1 = Math.ceil((y + ry - oy) / blk);
      ctx.fillStyle = color;
      for (let ky = ky0; ky < ky1; ky++) {
        const py = edgeY(ky), ph = edgeY(ky + 1) - py, my = py + ph / 2;
        for (let kx = kx0; kx < kx1; kx++) {
          const px = edgeX(kx), pw = edgeX(kx + 1) - px, mx = px + pw / 2;
          const nx = (mx - x) / rx, ny = (my - y) / ry;
          if (nx * nx + ny * ny <= 1.0) ctx.fillRect(px, py, pw, ph);
        }
      }
    }
    function dot(x, y, color) {
      const kx = Math.round((x - ox) / blk), ky = Math.round((y - oy) / blk);
      const px = edgeX(kx), py = edgeY(ky);
      ctx.fillStyle = color;
      ctx.fillRect(px, py, edgeX(kx + 1) - px, edgeY(ky + 1) - py);
    }
    // 阶梯三角:底边中心 (bx,by),半宽 halfBase,顶点 (ax,ay)
    function triangle(bx, by, halfBase, ax, ay, color) {
      const steps = Math.max(1, Math.round(Math.abs(by - ay) / blk));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = by + (ay - by) * t;
        const xc = bx + (ax - bx) * t;
        const hw = halfBase * (1 - t);
        rect(xc - hw, y - blk * 0.5, xc + hw, y + blk * 0.5, color);
      }
    }
    return { blk, rect, ell, dot, triangle };
  }

  // ---- 蛋 / 破壳(像素)----
  function drawEgg(ctx, cx, cy, r, pal, cracked, phase) {
    const blk = Math.max(2, Math.round(r * 0.14));
    let wob = Math.sin(phase * 4) * (cracked ? r * 0.06 : r * 0.02);
    wob = Math.round(wob / blk) * blk;
    const pen = makePen(ctx, cx, cy, blk);
    // 阴影
    pen.ell(cx, cy + r * 1.05, r * 0.8, r * 0.2, 'rgba(0,0,0,0.32)');
    const ex = cx + wob;
    // 描边 + 蛋体
    pen.ell(ex, cy, r * 0.82 + blk, r * 1.0 + blk, pal.accent);
    pen.ell(ex, cy, r * 0.82, r * 1.0, '#fff7ea');
    pen.ell(ex, cy - r * 0.1, r * 0.66, r * 0.72, pal.belly);
    // 斑点
    pen.dot(ex - r * 0.3, cy + r * 0.25, pal.shade);
    pen.dot(ex + r * 0.28, cy + r * 0.05, pal.shade);
    pen.dot(ex + r * 0.05, cy + r * 0.5, pal.shade);
    // 裂纹
    if (cracked) {
      pen.rect(ex - r * 0.45, cy - blk * 0.5, ex - r * 0.1, cy + blk * 0.5, pal.accent);
      pen.rect(ex - r * 0.1, cy - blk * 0.5, ex + r * 0.05, cy + r * 0.22, pal.accent);
      pen.rect(ex + r * 0.05, cy + r * 0.18, ex + r * 0.45, cy + r * 0.18 + blk, pal.accent);
    }
  }

  // ---- 眼睛(像素)----
  function drawEyesPx(pen, x, y, s, gap, eyeColor, mode, blink) {
    [-gap, gap].forEach((dx) => {
      const ex = x + dx;
      if (mode === 'closed' || blink) {
        pen.rect(ex - s, y - pen.blk * 0.5, ex + s, y + pen.blk * 0.5, eyeColor); // ‿ 闭眼
      } else {
        const h = (mode === 'wide') ? s * 1.7 : s * 1.15;
        pen.rect(ex - s, y - h, ex + s, y + h, eyeColor);
        pen.dot(ex + s * 0.5, y - h * 0.55, '#ffffff'); // 高光
      }
    });
  }

  // ---- 嘴(像素)----
  function drawMouthPx(pen, cx, y, unit, color, mode) {
    if (mode === 'open') {
      pen.rect(cx - unit * 0.09, y - unit * 0.02, cx + unit * 0.09, y + unit * 0.16, color);
    } else if (mode === 'sleep') {
      pen.rect(cx - unit * 0.1, y, cx + unit * 0.1, y + pen.blk, color);
    } else if (mode === 'work') {
      pen.rect(cx - unit * 0.11, y, cx + unit * 0.11, y + pen.blk, color);
    } else {
      pen.rect(cx - unit * 0.07, y - unit * 0.02, cx + unit * 0.07, y + unit * 0.1, color);
    }
  }

  // ---- 主体:孵化后的生物(像素)----
  function drawCreature(ctx, cx, cy, unit, sp, g, behavior, phase) {
    const pal = PALETTES[sp.key];
    const shape = SHAPE[sp.key];
    const f = g.feature;
    const t = phase;
    const blk = Math.max(2, Math.round(unit * 0.13));
    const pen = makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk;

    // 行为驱动的动画量(对齐到像素,呈阶梯运动)
    let bobRaw = 0, squash = 1, eyeMode = 'open', mouth = 'line';
    const blink = (Math.sin(t * 2.3) > 0.96);
    if (behavior === 'work') {
      bobRaw = Math.sin(t * 6) * unit * 0.06; squash = 1 + Math.sin(t * 6) * 0.03;
      eyeMode = 'open'; mouth = 'work';
    } else if (behavior === 'sleep') {
      bobRaw = Math.sin(t * 1.5) * unit * 0.03; squash = 1 + Math.sin(t * 1.5) * 0.04;
      eyeMode = 'closed'; mouth = 'sleep';
    } else if (behavior === 'idle') {
      bobRaw = Math.sin(t * 2) * unit * 0.03; squash = 1 + Math.sin(t * 2) * 0.02;
      eyeMode = (Math.sin(t * 1.7) > 0.9) ? 'closed' : 'open'; mouth = 'line';
    } else { // alert
      bobRaw = -Math.abs(Math.sin(t * 5)) * unit * 0.14; squash = 1 - Math.abs(Math.sin(t * 5)) * 0.05;
      eyeMode = 'wide'; mouth = 'open';
    }
    const bob = snap(bobRaw);

    const bw = unit * shape.w;
    const bh = unit * shape.h * squash;
    const bodyY = cy + bob;

    // 地面阴影
    pen.ell(cx, cy + bh * 0.95, bw * 0.7, unit * 0.14, 'rgba(0,0,0,0.32)');

    // 12 光环(身体后,散点)
    if (f >= 12) {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.4;
        const gx = cx + Math.cos(a) * bw * 1.18;
        const gy = bodyY + Math.sin(a) * bh * 1.02;
        pen.dot(gx, gy, hexA(pal.glow, 0.22 + 0.16 * Math.sin(t * 3 + i)));
      }
    }
    // 14 辉光光晕(身体后,更大的身形)
    if (f >= 14) {
      pen.ell(cx, bodyY, bw + blk * 2, bh + blk * 2, hexA(pal.glow, 0.28 + 0.18 * Math.sin(t * 4)));
    }

    // 6 尾巴 / 7 翅膀(身体后)
    if (f >= 6) drawTail(pen, cx, bodyY, bw, bh, unit, pal, sp.key, snap(Math.sin(t * 3) * unit * 0.18));
    if (f >= 7 && sp.key === 'dragon') drawWings(pen, cx, bodyY, unit, bw, bh, pal, snap(Math.abs(Math.sin(t * 4)) * unit * 0.18));

    // 3 腿
    if (f >= 3) {
      const ly = bodyY + bh * 0.7;
      pen.rect(cx - bw * 0.42, ly, cx - bw * 0.16, ly + unit * 0.3, pal.accent);
      pen.rect(cx + bw * 0.16, ly, cx + bw * 0.42, ly + unit * 0.3, pal.accent);
      pen.rect(cx - bw * 0.4, ly, cx - bw * 0.18, ly + unit * 0.26, pal.shade);
      pen.rect(cx + bw * 0.18, ly, cx + bw * 0.4, ly + unit * 0.26, pal.shade);
    }

    // 10 手臂(身体后侧)
    if (f >= 10) {
      let sw = (behavior === 'work') ? Math.sin(t * 6) * unit * 0.16 : (behavior === 'alert' ? -unit * 0.34 : 0);
      sw = snap(sw);
      const ay = bodyY + bh * 0.08;
      pen.rect(cx - bw - blk, ay + sw, cx - bw * 0.82, ay + sw + unit * 0.34, pal.accent);
      pen.rect(cx + bw * 0.82, ay - sw, cx + bw + blk, ay - sw + unit * 0.34, pal.accent);
      pen.rect(cx - bw - blk, ay + sw, cx - bw * 0.86, ay + sw + unit * 0.3, pal.shade);
      pen.rect(cx + bw * 0.86, ay - sw, cx + bw + blk, ay - sw + unit * 0.3, pal.shade);
    }

    // 身体:描边 + 平涂 + 肚皮
    pen.ell(cx, bodyY, bw + blk, bh + blk, pal.accent);
    pen.ell(cx, bodyY, bw, bh, pal.body);
    // 顶部高光带(浅色一行,增加体积)
    pen.ell(cx, bodyY - bh * 0.45, bw * 0.6, bh * 0.28, hexA(pal.glow, 0.28));
    pen.ell(cx, bodyY + bh * 0.22, bw * 0.52, bh * 0.5, pal.belly);

    // 13 花纹
    if (f >= 13) drawPattern(pen, cx, bodyY, bw, bh, pal, sp.key);

    // 头部器官(耳/角/触角):身体顶端
    const headY = bodyY - bh * 0.58;
    if (f >= 5) drawHeadOrgan(pen, cx, headY, bw, unit, pal, sp.key, snap(Math.sin(t * 4) * unit * 0.08));

    // 脸
    const faceY = bodyY - bh * 0.06;
    if (f >= 8) { // 腮红
      pen.rect(cx - bw * 0.56, faceY + unit * 0.08, cx - bw * 0.34, faceY + unit * 0.2, 'rgba(255,120,120,0.55)');
      pen.rect(cx + bw * 0.34, faceY + unit * 0.08, cx + bw * 0.56, faceY + unit * 0.2, 'rgba(255,120,120,0.55)');
    }
    const eyeS = unit * (f >= 8 ? 0.1 : 0.08);
    drawEyesPx(pen, cx, faceY, eyeS, bw * 0.32, pal.eye, eyeMode, blink);
    drawMouthPx(pen, cx, faceY + unit * 0.24, unit, pal.eye, mouth);

    // 7 胡须(猫) / 气泡(史莱姆)
    if (f >= 7 && sp.key === 'cat') drawWhiskers(pen, cx, faceY + unit * 0.12, bw, unit, pal);
    if (f >= 7 && sp.key === 'slime') drawBubbles(pen, cx, bodyY, bw, bh, unit, pal, t);

    // 9 项圈
    if (f >= 9) {
      const cy2 = bodyY + bh * 0.44;
      pen.rect(cx - bw * 0.6, cy2, cx + bw * 0.6, cy2 + unit * 0.12, pal.accent);
      pen.dot(cx, cy2 + unit * 0.04, '#ffd54a');
    }

    // 11 王冠
    if (f >= 11) drawCrown(pen, cx, headY - unit * 0.12, unit);

    // 2 初生:蛋壳碎片
    if (g.stage === 2) {
      const sy = cy + bh * 0.85;
      pen.ell(cx - bw * 0.5, sy, unit * 0.26, unit * 0.14, '#fff7ea');
      pen.ell(cx + bw * 0.55, sy + unit * 0.1, unit * 0.24, unit * 0.13, '#fff7ea');
    }
  }

  // ---- 物种部件(像素)----
  function drawTail(pen, cx, cy, bw, bh, unit, pal, key, sway) {
    if (key === 'cat') {
      pen.rect(cx + bw * 0.7, cy + bh * 0.1, cx + bw * 1.05, cy + bh * 0.4, pal.shade);
      pen.rect(cx + bw * 0.95, cy - bh * 0.3 + sway, cx + bw * 1.25, cy + bh * 0.15 + sway, pal.shade);
      pen.rect(cx + bw * 0.95, cy - bh * 0.35 + sway, cx + bw * 1.22, cy - bh * 0.15 + sway, pal.accent);
    } else if (key === 'dragon') {
      pen.rect(cx - bw * 1.05, cy + bh * 0.2 + sway, cx - bw * 0.6, cy + bh * 0.5, pal.shade);
      pen.triangle(cx - bw * 1.05, cy + bh * 0.35 + sway, unit * 0.22, cx - bw * 1.4, cy + bh * 0.05 + sway, pal.accent);
    } else { // slime 小水滴尾
      pen.ell(cx + bw * 0.86, cy + bh * 0.5, unit * 0.16, unit * 0.2, pal.shade);
    }
  }

  function drawWings(pen, cx, cy, unit, bw, bh, pal, flap) {
    [-1, 1].forEach((d) => {
      const baseX = cx + d * bw * 0.5;
      const topY = cy - bh * 0.5 - flap;
      pen.triangle(baseX, cy + bh * 0.1, unit * 0.16, cx + d * (bw + unit * 0.5), topY, pal.accent);
      pen.triangle(baseX, cy + bh * 0.05, unit * 0.11, cx + d * (bw + unit * 0.36), topY + unit * 0.08, hexA(pal.belly, 0.95));
    });
  }

  function drawHeadOrgan(pen, cx, y, bw, unit, pal, key, sway) {
    if (key === 'cat') {
      [-1, 1].forEach((d) => {
        pen.triangle(cx + d * bw * 0.42, y + unit * 0.05, unit * 0.16, cx + d * bw * 0.62, y - unit * 0.42, pal.shade);
        pen.triangle(cx + d * bw * 0.42, y + unit * 0.02, unit * 0.08, cx + d * bw * 0.56, y - unit * 0.3, 'rgba(255,150,150,0.8)');
      });
    } else if (key === 'dragon') {
      [-1, 1].forEach((d) => {
        pen.triangle(cx + d * bw * 0.3, y + unit * 0.05, unit * 0.11, cx + d * bw * 0.44, y - unit * 0.5, pal.shade);
      });
    } else { // slime 触角
      pen.rect(cx - blkHalf(pen), y - unit * 0.42, cx + blkHalf(pen), y + unit * 0.05, pal.shade);
      pen.dot(cx + sway, y - unit * 0.5, pal.glow);
    }
  }
  function blkHalf(pen) { return pen.blk * 0.5; }

  function drawWhiskers(pen, cx, y, bw, unit, pal) {
    [-1, 1].forEach((d) => {
      pen.rect(cx + d * bw * 0.34, y, cx + d * bw * 0.9, y + pen.blk, hexA(pal.eye, 0.6));
      pen.rect(cx + d * bw * 0.34, y + unit * 0.12, cx + d * bw * 0.9, y + unit * 0.12 + pen.blk, hexA(pal.eye, 0.6));
    });
  }

  function drawBubbles(pen, cx, cy, bw, bh, unit, pal, t) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.6 + i * 0.4) % 1;
      const bx = cx + Math.sin(i * 2 + t) * bw * 0.3;
      const by = cy + bh * 0.4 - ph * bh * 1.2;
      pen.dot(bx, by, hexA('#ffffff', 0.4 * (1 - ph) + 0.15));
    }
  }

  function drawPattern(pen, cx, cy, bw, bh, pal, key) {
    const c = hexA(pal.accent, 0.5);
    if (key === 'cat') {
      [-0.3, 0, 0.3].forEach((o) => pen.rect(cx + o * bw - pen.blk * 0.5, cy - bh * 0.5, cx + o * bw + pen.blk * 0.5, cy - bh * 0.28, c));
    } else if (key === 'dragon') {
      for (let i = 0; i < 3; i++) pen.ell(cx, cy + bh * (0.02 + i * 0.22), bw * (0.24 - i * 0.05), bh * 0.07, c);
    } else {
      [[-0.32, -0.08], [0.3, 0.12], [0.02, 0.36]].forEach(([dx, dy]) => pen.dot(cx + dx * bw, cy + dy * bh, c));
    }
  }

  function drawCrown(pen, cx, y, unit) {
    const w = unit * 0.5, h = unit * 0.34;
    pen.rect(cx - w, y, cx + w, y + h * 0.5, '#ffd54a');
    pen.triangle(cx - w * 0.66, y, unit * 0.1, cx - w, y - h, '#ffd54a');
    pen.triangle(cx, y, unit * 0.1, cx, y - h * 1.15, '#ffd54a');
    pen.triangle(cx + w * 0.66, y, unit * 0.1, cx + w, y - h, '#ffd54a');
    pen.dot(cx, y + h * 0.2, '#e5484d');
  }

  // ---- 行为氛围特效(Zzz / … / ! ) ----
  function drawBehaviorFx(ctx, cx, cy, unit, behavior, phase) {
    const clampX = (x) => Math.max(30, Math.min(114, x));
    const clampY = (y) => Math.max(64, Math.min(122, y));
    if (behavior === 'sleep') {
      ctx.fillStyle = '#cfd3dc'; ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const ph = (phase * 0.5 + i * 0.33) % 1;
        const zx = clampX(cx + unit * 0.5 + i * unit * 0.18);
        const zy = clampY(cy - unit * 0.35 - ph * unit * 0.6);
        ctx.globalAlpha = 1 - ph;
        ctx.font = `bold ${unit * (0.26 + i * 0.09)}px 'Source Han Sans SC', sans-serif`;
        ctx.fillText('Z', zx, zy);
      }
      ctx.globalAlpha = 1;
    } else if (behavior === 'idle') {
      const bx = clampX(cx + unit * 0.55), by = clampY(cy - unit * 0.55);
      for (let i = 0; i < 3; i++) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(phase * 3 - i * 0.7));
        ctx.globalAlpha = a; ctx.fillStyle = '#cfd3dc';
        ctx.fillRect(Math.round(bx + (i - 1) * unit * 0.22), Math.round(by), Math.max(2, Math.round(unit * 0.1)), Math.max(2, Math.round(unit * 0.1)));
      }
      ctx.globalAlpha = 1;
    } else if (behavior === 'alert') {
      const pop = 0.85 + Math.abs(Math.sin(phase * 5)) * 0.3;
      const bx = clampX(cx + unit * 0.55), by = clampY(cy - unit * 0.5);
      const s = unit * 0.26 * pop;
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(Math.round(bx - s * 0.5), Math.round(by - s), Math.round(s), Math.round(s * 1.4));
      ctx.fillRect(Math.round(bx - s * 0.5), Math.round(by + s * 0.7), Math.round(s), Math.round(s * 0.5));
    }
  }

  function drawPet(ctx, cfg) {
    const { species, growth, behavior, phase, cx, cy, unit } = cfg;
    const pal = PALETTES[species] || PALETTES.slime;
    const sp = { key: species, ...pal, ...SHAPE[species] };

    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (growth.stage <= 1) {
      drawEgg(ctx, cx, cy, unit * 0.9, pal, growth.stage === 1, phase);
    } else {
      drawCreature(ctx, cx, cy, unit, sp, growth, behavior, phase);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    drawBehaviorFx(ctx, cx, cy, unit, behavior, phase);
  }

  window.PetArt = {
    drawPet,
    palettes: PALETTES,
    species: ['slime', 'cat', 'dragon'],
    speciesName: {
      slime: { en: 'Slime', zh: '史莱姆' },
      cat: { en: 'Kitcat', zh: '喵仔' },
      dragon: { en: 'Draco', zh: '小龙' },
    },
  };
})();
