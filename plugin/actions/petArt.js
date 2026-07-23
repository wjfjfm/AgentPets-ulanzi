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

  // 元素变体:分支专属配色 + 点缀(motif),让同物种不同分支一眼可分。
  // variant 由形态树(evolution.js)注入 growth.variant;为空/未知则用物种本色。
  const VARIANTS = {
    aqua:    { motif: 'bubbles', pal: { body: '#45b6e6', shade: '#2b86b8', belly: '#cdeeff', accent: '#124a6b', eye: '#0b2b3d', glow: '#9fe6ff' } },
    magma:   { motif: 'embers',  pal: { body: '#e8622f', shade: '#b53a15', belly: '#ffcf9a', accent: '#6b1c08', eye: '#2e0d05', glow: '#ffb15a' } },
    fire:    { motif: 'embers',  pal: { body: '#f0603a', shade: '#c23617', belly: '#ffcba0', accent: '#6e1c07', eye: '#2e0c04', glow: '#ffab55' } },
    toxic:   { motif: 'drip',    pal: { body: '#84c24a', shade: '#548f2c', belly: '#e6ffbe', accent: '#365c12', eye: '#142f0a', glow: '#c8ff5a' } },
    frost:   { motif: 'ice',     pal: { body: '#8fd0ea', shade: '#5aa6c9', belly: '#eafaff', accent: '#2f6a86', eye: '#14323f', glow: '#d7f4ff' } },
    storm:   { motif: 'spark',   pal: { body: '#f2d34a', shade: '#c9a41f', belly: '#fff4c2', accent: '#6b5410', eye: '#2e2606', glow: '#fff08a' } },
    shadow:  { motif: 'smoke',   pal: { body: '#6b6480', shade: '#45415a', belly: '#b8b2cc', accent: '#221f30', eye: '#0d0b14', glow: '#a99fd0' } },
    crystal: { motif: 'shards',  pal: { body: '#b79cf0', shade: '#8f6fd6', belly: '#efe6ff', accent: '#4a2f8f', eye: '#241237', glow: '#d9c7ff' } },
    astral:  { motif: 'stars',   pal: { body: '#6f8cf0', shade: '#4a63d0', belly: '#dfe4ff', accent: '#223a8f', eye: '#12203a', glow: '#b7c4ff' } },
    void:    { motif: 'stars',   pal: { body: '#3a3550', shade: '#241f38', belly: '#7a749a', accent: '#120f22', eye: '#05040a', glow: '#8f7fd0' } },
    wild:    { motif: '',        pal: { body: '#d8b06a', shade: '#b0854a', belly: '#f6e6c8', accent: '#6b4a1a', eye: '#2e2010', glow: '#f0d8a0' } },
    crystalgel:{ motif: 'shards', pal: { body: '#4fd6e0', shade: '#2f9fb0', belly: '#d6fbff', accent: '#0d5560', eye: '#062e33', glow: '#a8fff2' } },
    kinggel: { motif: 'bubbles',  pal: { body: '#4a6cd6', shade: '#2f47a0', belly: '#cdd8ff', accent: '#182a6e', eye: '#f0f4ff', glow: '#9fb6ff' } },
    royalgel:{ motif: 'shards',   pal: { body: '#f0d879', shade: '#c2a63f', belly: '#fff8d8', accent: '#6e5410', eye: '#3a2c06', glow: '#fff2a0' } },
    catstorm:{ motif: 'spark',    pal: { body: '#7a5cc9', shade: '#4f3a96', belly: '#e0d6f6', accent: '#2e1e5e', eye: '#fff08a', glow: '#ffe14a' } },
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
    const variant = g.variant && VARIANTS[g.variant] ? VARIANTS[g.variant] : null;
    const pal = variant ? variant.pal : PALETTES[sp.key];
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

    // 通用「光点花环 / 圣光大晕」已移除(避免滥用 + 遮挡轮廓);高等级华丽感交由顶级专属特效。

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

    // 王冠不再作为通用成长装饰(避免滥用);顶级皇冠仅由顶级专属特效按需绘制。

    // 2 初生:蛋壳碎片
    if (g.stage === 2) {
      const sy = cy + bh * 0.85;
      pen.ell(cx - bw * 0.5, sy, unit * 0.26, unit * 0.14, '#fff7ea');
      pen.ell(cx + bw * 0.55, sy + unit * 0.1, unit * 0.24, unit * 0.13, '#fff7ea');
    }

    // 元素点缀(分支特性):在最上层叠加,轻微随 phase 动
    if (variant && variant.motif) drawMotif(pen, variant.motif, cx, bodyY, bw, bh, unit, pal, t);
  }

  // ---- 元素点缀(motif):像素风小装饰,复用 pen 基元 ----
  function drawMotif(pen, motif, cx, cy, bw, bh, unit, pal, t) {
    const topY = cy - bh * 0.9;
    if (motif === 'bubbles') {
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.6 + i * 0.7) % 1;
        const bx = cx + (i - 1.5) * bw * 0.4;
        const by = cy - bh * 0.2 - ph * bh * 1.2;
        pen.ell(bx, by, unit * (0.06 + 0.03 * i % 2), unit * (0.06 + 0.03 * i % 2), hexA(pal.glow, 0.5));
      }
    } else if (motif === 'embers') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 1.5;
        const ex = cx + Math.cos(a) * bw * (0.9 + 0.15 * Math.sin(t * 3 + i));
        const ey = cy - bh * 0.3 + Math.sin(a) * bh * 0.7;
        pen.dot(ex, ey, hexA(pal.glow, 0.55 + 0.3 * Math.sin(t * 5 + i)));
      }
    } else if (motif === 'drip') {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.5 + i * 0.4) % 1;
        const dx = cx + (i - 1) * bw * 0.5;
        pen.ell(dx, cy + bh * 0.5 + ph * unit * 0.5, unit * 0.06, unit * 0.1, hexA(pal.glow, 0.6));
      }
    } else if (motif === 'ice') {
      for (let i = 0; i < 3; i++) {
        const ix = cx + (i - 1) * bw * 0.6;
        pen.triangle(ix, topY + unit * 0.16, unit * 0.08, ix, topY - unit * 0.16, hexA(pal.belly, 0.9));
      }
    } else if (motif === 'spark') {
      for (let i = 0; i < 4; i++) {
        if (Math.sin(t * 8 + i * 1.7) < 0.3) continue;
        const a = (i / 4) * Math.PI * 2;
        const sx = cx + Math.cos(a) * bw * 1.05;
        const sy = cy + Math.sin(a) * bh * 0.8;
        pen.rect(sx - pen.blk * 0.5, sy - pen.blk, sx + pen.blk * 0.5, sy + pen.blk, hexA(pal.glow, 0.9));
      }
    } else if (motif === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.4 + i * 0.5) % 1;
        pen.ell(cx + (i - 1) * bw * 0.35, cy - bh * 0.3 - ph * bh, unit * (0.12 + ph * 0.1), unit * (0.1 + ph * 0.08), hexA(pal.glow, 0.28 * (1 - ph)));
      }
    } else if (motif === 'shards') {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.7;
        const sx = cx + Math.cos(a) * bw * 0.9, sy = cy + Math.sin(a) * bh * 0.9;
        pen.triangle(sx, sy + unit * 0.12, unit * 0.07, sx, sy - unit * 0.14, hexA(pal.glow, 0.85));
      }
    } else if (motif === 'leaf') {
      for (let i = 0; i < 3; i++) {
        const lx = cx + (i - 1) * bw * 0.5;
        pen.ell(lx, topY + unit * 0.05, unit * 0.1, unit * 0.05, pal.glow);
      }
    } else if (motif === 'stars') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.5;
        const sx = cx + Math.cos(a) * bw * 1.1, sy = cy + Math.sin(a) * bh * 0.95;
        pen.dot(sx, sy, hexA(pal.glow, 0.4 + 0.5 * Math.abs(Math.sin(t * 3 + i))));
      }
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

  // ---- 行为氛围特效 ----
  // 注:zzZ(sleep)与 !(alert)已上移为 PetView 的「统一会话状态提示」角标,
  // 美工层不再重复绘制,避免与状态角标撞图;此处仅保留 idle 的「…」呼吸点作氛围。
  function drawBehaviorFx(ctx, cx, cy, unit, behavior, phase) {
    const clampX = (x) => Math.max(30, Math.min(114, x));
    const clampY = (y) => Math.max(64, Math.min(122, y));
    if (behavior === 'idle') {
      const bx = clampX(cx + unit * 0.55), by = clampY(cy - unit * 0.55);
      for (let i = 0; i < 3; i++) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(phase * 3 - i * 0.7));
        ctx.globalAlpha = a; ctx.fillStyle = '#cfd3dc';
        ctx.fillRect(Math.round(bx + (i - 1) * unit * 0.22), Math.round(by), Math.max(2, Math.round(unit * 0.1)), Math.max(2, Math.round(unit * 0.1)));
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPet(ctx, cfg) {
    const { species, growth, behavior, phase, cx, cy, unit } = cfg;
    const reg = window.PetSpecies;
    const isNew = !!(reg && reg.has && reg.has(species));
    // 分支专属渲染器(look):与配色解耦,进化分叉时不同 look → 完全不同的构型
    const look = growth.look || '';
    const lookFn = (look && reg && reg.look && reg.look[look]) ? reg.look[look] : null;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (growth.stage <= 1) {
      // 蛋阶段:新老物种统一用蛋绘制(按物种/分支基色着色)
      const eggPal = isNew ? reg.pal(species, growth.variant) : ((growth.variant && VARIANTS[growth.variant]) ? VARIANTS[growth.variant].pal : (PALETTES[species] || PALETTES.slime));
      drawEgg(ctx, cx, cy, unit * 0.9, eggPal, growth.stage === 1, phase);
    } else if (lookFn) {
      // 分支专属构型:优先(palette 由 look 自解析或用变体/物种色)
      const pal = (reg.pal && reg.has(species)) ? reg.pal(species, growth.variant)
        : ((growth.variant && VARIANTS[growth.variant]) ? VARIANTS[growth.variant].pal : (PALETTES[species] || PALETTES.slime));
      lookFn(ctx, cx, cy, unit, pal, growth, behavior, phase, { makePen: makePen, hexA: hexA, eyes: drawEyesPx, mouth: drawMouthPx });
    } else if (isNew) {
      const pal = reg.pal(species, growth.variant);
      reg.render[species](ctx, cx, cy, unit, pal, growth, behavior, phase, { makePen: makePen, hexA: hexA, eyes: drawEyesPx, mouth: drawMouthPx });
    } else {
      const pal = PALETTES[species] || PALETTES.slime;
      const sp = { key: species, ...pal, ...SHAPE[species] };
      drawCreature(ctx, cx, cy, unit, sp, growth, behavior, phase);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    drawBehaviorFx(ctx, cx, cy, unit, behavior, phase);
  }

  // 从中心 cy 到「着地点(地面阴影)」的垂直距离,供上层把脚固定在地面基线。
  function footOffset(species, growth, unit) {
    const reg = window.PetSpecies;
    // look 分支渲染器统一采用 petSpecies 的接地约定(0.98),蛋沿用蛋偏移
    if (growth.look && reg && reg.look && reg.look[growth.look]) return (growth.stage <= 1) ? unit * 0.9 * 1.05 : unit * 0.98;
    if (reg && reg.has && reg.has(species) && reg.foot) return reg.foot(species, growth, unit);
    const shape = SHAPE[species] || SHAPE.slime;
    if (growth.stage <= 1) return unit * 0.9 * 1.05;
    return unit * shape.h * 0.95;
  }

  // ---- 稀有度 ----
  // 每个物种一个「珍稀度」数值:越大越稀有。分配新宠物时按「珍稀度的倒数」
  // 加权随机 —— 珍稀度 N 的出现概率是珍稀度 1 的 1/N。
  const SPECIES = ['slime', 'cat', 'dragon'];
  const RARITY = { slime: 9, cat: 10, dragon: 11 };
  const SPECIES_NAME = {
    slime: { en: 'Slime', zh: '史莱姆' },
    cat: { en: 'Kitcat', zh: '喵仔' },
    dragon: { en: 'Draco', zh: '小龙' },
  };
  function rarityOf(key) { return RARITY[key] || 1; }

  // 数据驱动:由 PetData 下发的物种列表/稀有度/名称覆盖(原地更新导出引用,保持顺序=权重顺序)。
  // 顺序必须与 all_pets.json 一致,才能让 speciesForSeed 对既有会话产生稳定结果。
  function setSpecies(list, rarityMap, nameMap) {
    if (Array.isArray(list) && list.length) { SPECIES.length = 0; list.forEach((s) => SPECIES.push(s)); }
    if (rarityMap) { for (const k in RARITY) delete RARITY[k]; Object.assign(RARITY, rarityMap); }
    if (nameMap) { for (const k in SPECIES_NAME) delete SPECIES_NAME[k]; Object.assign(SPECIES_NAME, nameMap); }
  }

  // 倒数加权随机,返回一个物种 key(稀有度越高越少见)
  function pickSpecies() {
    const weights = SPECIES.map((k) => 1 / rarityOf(k));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SPECIES.length; i++) {
      if ((r -= weights[i]) < 0) return SPECIES[i];
    }
    return SPECIES[SPECIES.length - 1];
  }

  // FNV-1a 字符串哈希 -> uint32,再叠加 32-bit 雪崩混合,改善相似 seed 的分布均匀度
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    s = String(s || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  // 由 seed(会话 key/sid)确定性派生物种:同一会话每次结果一致,
  // 且沿用「珍稀度倒数」的加权分布(稀有物种依旧少见)。避免重建宠物时形态漂移。
  function speciesForSeed(seed) {
    const weights = SPECIES.map((k) => 1 / rarityOf(k));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = (hashStr(seed) / 4294967296) * total; // hash/2^32 ∈ [0,1) -> [0,total)
    for (let i = 0; i < SPECIES.length; i++) {
      if ((r -= weights[i]) < 0) return SPECIES[i];
    }
    return SPECIES[SPECIES.length - 1];
  }

  window.PetArt = {
    drawPet,
    footOffset,
    palettes: PALETTES,
    species: SPECIES,
    rarity: RARITY,
    rarityOf,
    setSpecies,
    pickSpecies,
    speciesForSeed,
    speciesName: SPECIES_NAME,
  };
})();
