/**
 * 宠物美术 —— 3 个物种 + 分阶段累进部件 + 行为层(工作/睡觉/呼喊)
 * ----------------------------------------------------------------------------
 * drawPet(ctx, cfg)：把一只宠物画到 ctx 上。
 *   cfg = {
 *     species: 'slime' | 'cat' | 'dragon',
 *     growth:  stages.js 的 growthFromTokens 结果 {stage,p,scale,feature,...},
 *     behavior:'work' | 'sleep' | 'alert',   // 运行中 / 暂停 / 完成
 *     phase:   number,   // 动画时间(秒),用于呼吸/跳动/眨眼
 *     cx, cy:  宠物中心,
 *     unit:    基础尺寸(已含成长 scale)
 *   }
 *
 * 部件解锁按 growth.feature 累进(基于上一阶段继续长):
 *   0 蛋 · 1 破壳 · 2 初生(带蛋壳碎片) · 3 腿 · 4 变大 · 5 器官(耳/角/触角)
 *   6 尾巴 · 7 觉醒(翅膀/胡须/气泡) · 8 腮红+大眼 · 9 项圈 · 10 手臂
 *   11 王冠 · 12 光环 · 13 花纹 · 14 全身辉光(最终形态)
 */
(function () {
  const PALETTES = {
    slime: { body: '#6fcf72', shade: '#4aa84f', belly: '#d7f7c8', accent: '#2e7d32', eye: '#20331d', glow: '#8dff90' },
    cat:   { body: '#f5a25b', shade: '#dd7f38', belly: '#ffe6c7', accent: '#a85a1f', eye: '#3a2a12', glow: '#ffd08a' },
    dragon:{ body: '#9b6cf0', shade: '#7a4bd0', belly: '#e7d9ff', accent: '#5a2fb0', eye: '#241237', glow: '#c3a4ff' },
  };

  // 物种体型比例(相对 unit)
  const SHAPE = {
    slime:  { w: 1.18, h: 1.00, flat: 0.30 },
    cat:    { w: 1.02, h: 1.06, flat: 0.05 },
    dragon: { w: 0.92, h: 1.22, flat: 0.02 },
  };

  function lerp(a, b, t) { return a + (b - a) * t; }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }

  // ---- 蛋 / 破壳 ----
  function drawEgg(ctx, cx, cy, r, sp, cracked, phase) {
    const wob = Math.sin(phase * 4) * (cracked ? r * 0.05 : r * 0.02);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(ctx, cx, cy + r * 1.02, r * 0.85, r * 0.22); ctx.fill();
    // 蛋体
    ctx.save();
    ctx.translate(cx + wob, cy);
    ctx.rotate(wob * 0.01);
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, '#fff7ea');
    grad.addColorStop(1, sp.belly);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = sp.shade; ctx.stroke();
    // 斑点
    ctx.fillStyle = sp.accent;
    [[-0.3, -0.2, 0.14], [0.28, 0.1, 0.11], [-0.1, 0.4, 0.1]].forEach(([dx, dy, s]) => {
      ellipse(ctx, dx * r, dy * r, r * s, r * s * 0.85); ctx.fill();
    });
    // 裂纹
    if (cracked) {
      ctx.strokeStyle = sp.accent; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.05);
      ctx.lineTo(-r * 0.2, r * 0.12);
      ctx.lineTo(-r * 0.28, r * 0.3);
      ctx.lineTo(r * 0.05, r * 0.18);
      ctx.lineTo(r * 0.5, r * 0.28);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- 眼睛 ----
  function drawEyes(ctx, x, y, rx, gap, eyeColor, mode, blink) {
    const drawOne = (ex) => {
      if (mode === 'closed' || blink) {
        ctx.strokeStyle = eyeColor; ctx.lineWidth = Math.max(2, rx * 0.5);
        ctx.beginPath();
        ctx.arc(ex, y, rx * 1.1, Math.PI * 0.15, Math.PI * 0.85); // ‿ 闭眼
        ctx.stroke();
      } else {
        const r = mode === 'wide' ? rx * 1.35 : rx;
        ctx.fillStyle = eyeColor;
        ellipse(ctx, ex, y, r, r * 1.15); ctx.fill();
        ctx.fillStyle = '#fff';
        ellipse(ctx, ex + r * 0.28, y - r * 0.35, r * 0.35, r * 0.35); ctx.fill();
      }
    };
    drawOne(x - gap); drawOne(x + gap);
  }

  // ---- 主体：孵化后的生物 ----
  function drawCreature(ctx, cx, cy, unit, sp, g, behavior, phase) {
    const pal = PALETTES[sp.key];
    const shape = SHAPE[sp.key];
    const f = g.feature;
    const t = phase;

    // 行为驱动的动画量
    let bob = 0, squash = 1, eyeMode = 'open', mouth = 'line';
    const blink = (Math.sin(t * 2.3) > 0.96); // 偶尔眨眼
    if (behavior === 'work') {
      bob = Math.sin(t * 6) * unit * 0.05;
      squash = 1 + Math.sin(t * 6) * 0.03;
      eyeMode = 'open'; mouth = 'work';
    } else if (behavior === 'sleep') {
      bob = Math.sin(t * 1.5) * unit * 0.02;
      squash = 1 + Math.sin(t * 1.5) * 0.04;
      eyeMode = 'closed'; mouth = 'sleep';
    } else if (behavior === 'idle') { // 等待:轻微摇摆、睁眼、发呆
      bob = Math.sin(t * 2) * unit * 0.03;
      squash = 1 + Math.sin(t * 2) * 0.02;
      eyeMode = (Math.sin(t * 1.7) > 0.9) ? 'closed' : 'open';
      mouth = 'line';
    } else { // alert 呼喊提醒
      bob = -Math.abs(Math.sin(t * 5)) * unit * 0.14;
      squash = 1 - Math.abs(Math.sin(t * 5)) * 0.05;
      eyeMode = 'wide'; mouth = 'open';
    }

    const bw = unit * shape.w;
    const bh = unit * shape.h * squash;
    const bodyY = cy + bob;

    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(ctx, cx, cy + bh * 0.92, bw * 0.72, unit * 0.16); ctx.fill();

    // 12 光环(在身体后)
    if (f >= 12) {
      const ga = 0.35 + Math.sin(t * 3) * 0.12;
      const rg = ctx.createRadialGradient(cx, bodyY, unit * 0.3, cx, bodyY, unit * 1.5);
      rg.addColorStop(0, `rgba(255,255,255,0)`);
      rg.addColorStop(0.7, hexA(pal.glow, ga * 0.5));
      rg.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = rg;
      ellipse(ctx, cx, bodyY, unit * 1.5, unit * 1.5); ctx.fill();
    }

    // 6 尾巴(身体后)
    if (f >= 6) drawTail(ctx, cx, bodyY, bw, bh, unit, pal, sp.key, t);

    // 7 觉醒特征之翅膀(龙,身体后)
    if (f >= 7 && sp.key === 'dragon') drawWings(ctx, cx, bodyY, unit, pal, t);

    // 3 腿
    if (f >= 3) {
      ctx.fillStyle = pal.shade;
      const ly = bodyY + bh * 0.78;
      const lw = unit * 0.16, lh = unit * 0.22;
      ellipse(ctx, cx - bw * 0.32, ly, lw, lh); ctx.fill();
      ellipse(ctx, cx + bw * 0.32, ly, lw, lh); ctx.fill();
    }

    // 身体
    const bg = ctx.createLinearGradient(cx, bodyY - bh, cx, bodyY + bh);
    bg.addColorStop(0, pal.body);
    bg.addColorStop(1, pal.shade);
    ctx.fillStyle = bg;
    if (sp.key === 'slime') {
      drawSlimeBody(ctx, cx, bodyY, bw, bh, t);
    } else {
      ellipse(ctx, cx, bodyY, bw, bh);
      ctx.fill();
    }
    ctx.lineWidth = 2; ctx.strokeStyle = hexA(pal.accent, 0.5); ctx.stroke();

    // 肚皮
    ctx.fillStyle = hexA(pal.belly, 0.9);
    ellipse(ctx, cx, bodyY + bh * 0.18, bw * 0.5, bh * 0.55); ctx.fill();

    // 13 花纹
    if (f >= 13) drawPattern(ctx, cx, bodyY, bw, bh, pal, sp.key);

    // 10 手臂
    if (f >= 10) {
      ctx.fillStyle = pal.shade;
      const armY = bodyY + bh * 0.15;
      const swing = (behavior === 'work') ? Math.sin(t * 6) * unit * 0.12 : (behavior === 'alert' ? -unit * 0.3 : 0);
      ellipse(ctx, cx - bw * 0.92, armY + swing, unit * 0.13, unit * 0.28); ctx.fill();
      ellipse(ctx, cx + bw * 0.92, armY - swing, unit * 0.13, unit * 0.28); ctx.fill();
    }

    // 头部特征区(耳/角/触角)——身体顶端
    const headY = bodyY - bh * 0.55;
    if (f >= 5) drawHeadOrgan(ctx, cx, headY, bw, unit, pal, sp.key, t);

    // 脸
    const faceY = bodyY - bh * 0.08;
    // 8 腮红
    if (f >= 8) {
      ctx.fillStyle = 'rgba(255,120,120,0.5)';
      ellipse(ctx, cx - bw * 0.5, faceY + unit * 0.12, unit * 0.13, unit * 0.09); ctx.fill();
      ellipse(ctx, cx + bw * 0.5, faceY + unit * 0.12, unit * 0.13, unit * 0.09); ctx.fill();
    }
    const eyeR = unit * (f >= 8 ? 0.14 : 0.11);
    drawEyes(ctx, cx, faceY, eyeR, bw * 0.34, pal.eye, eyeMode, blink);
    drawMouth(ctx, cx, faceY + unit * 0.28, unit, pal.eye, mouth);

    // 7 觉醒之胡须(猫)
    if (f >= 7 && sp.key === 'cat') drawWhiskers(ctx, cx, faceY + unit * 0.15, bw, unit, pal);
    // 7 觉醒之气泡(史莱姆)
    if (f >= 7 && sp.key === 'slime') drawBubbles(ctx, cx, bodyY, bw, bh, unit, pal, t);

    // 9 项圈
    if (f >= 9) {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + bh * 0.42, bw * 0.62, bh * 0.14, 0, 0, Math.PI);
      ctx.lineTo(cx - bw * 0.62, bodyY + bh * 0.42);
      ctx.fill();
      ctx.fillStyle = '#ffd54a';
      ellipse(ctx, cx, bodyY + bh * 0.52, unit * 0.09, unit * 0.09); ctx.fill();
    }

    // 11 王冠
    if (f >= 11) drawCrown(ctx, cx, headY - unit * 0.18, unit);

    // 14 最终辉光描边
    if (f >= 14) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.25;
      ctx.strokeStyle = pal.glow; ctx.lineWidth = 3;
      ellipse(ctx, cx, bodyY, bw + 3, bh + 3); ctx.stroke();
      ctx.restore();
    }

    // 2 初生：蛋壳碎片
    if (g.stage === 2) {
      ctx.fillStyle = '#fff7ea';
      ctx.strokeStyle = sp.shade || pal.shade; ctx.lineWidth = 1.5;
      const sy = cy + bh * 0.9;
      [[-1, 0], [1, 0.2]].forEach(([dir, o]) => {
        ctx.beginPath();
        ctx.ellipse(cx + dir * bw * 0.5, sy + o * unit, unit * 0.28, unit * 0.16, dir * 0.3, Math.PI, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      });
    }
  }

  // ---- 物种部件 ----
  function drawSlimeBody(ctx, cx, cy, bw, bh, t) {
    const wob = Math.sin(t * 3) * bw * 0.04;
    ctx.beginPath();
    ctx.moveTo(cx - bw, cy + bh * 0.7);
    ctx.bezierCurveTo(cx - bw - wob, cy - bh * 0.7, cx - bw * 0.3, cy - bh, cx, cy - bh);
    ctx.bezierCurveTo(cx + bw * 0.3, cy - bh, cx + bw + wob, cy - bh * 0.7, cx + bw, cy + bh * 0.7);
    ctx.bezierCurveTo(cx + bw * 0.6, cy + bh, cx - bw * 0.6, cy + bh, cx - bw, cy + bh * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  function drawTail(ctx, cx, cy, bw, bh, unit, pal, key, t) {
    ctx.save();
    ctx.fillStyle = pal.shade;
    ctx.strokeStyle = pal.shade;
    const sway = Math.sin(t * 3) * 0.3;
    if (key === 'cat') {
      ctx.lineWidth = unit * 0.16; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + bw * 0.85, cy + bh * 0.4);
      ctx.quadraticCurveTo(cx + bw * 1.5, cy + bh * (0.1 + sway), cx + bw * 1.2, cy - bh * (0.4 - sway));
      ctx.stroke();
    } else if (key === 'dragon') {
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.7, cy + bh * 0.5);
      ctx.quadraticCurveTo(cx - bw * 1.6, cy + bh * (0.3 + sway), cx - bw * 1.5, cy - bh * 0.1);
      ctx.lineTo(cx - bw * 1.75, cy - bh * 0.25);
      ctx.lineTo(cx - bw * 1.35, cy - bh * 0.28);
      ctx.quadraticCurveTo(cx - bw * 1.2, cy + bh * 0.2, cx - bw * 0.7, cy + bh * 0.5);
      ctx.fill();
    } else { // slime 水滴小尾
      ellipse(ctx, cx + bw * 0.9, cy + bh * 0.55, unit * 0.18, unit * 0.22); ctx.fill();
    }
    ctx.restore();
  }

  function drawWings(ctx, cx, cy, unit, pal, t) {
    const flap = Math.abs(Math.sin(t * 4)) * 0.35;
    ctx.fillStyle = hexA(pal.belly, 0.9);
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5;
    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.translate(cx + dir * unit * 0.55, cy - unit * 0.2);
      ctx.rotate(dir * (0.5 + flap));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dir * unit * 1.2, -unit * 0.5, dir * unit * 1.1, unit * 0.5);
      ctx.quadraticCurveTo(dir * unit * 0.7, unit * 0.3, 0, 0);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  }

  function drawHeadOrgan(ctx, cx, y, bw, unit, pal, key, t) {
    ctx.fillStyle = pal.shade;
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5;
    if (key === 'cat') {
      [-1, 1].forEach((d) => {
        ctx.beginPath();
        ctx.moveTo(cx + d * bw * 0.35, y);
        ctx.lineTo(cx + d * bw * 0.62, y - unit * 0.5);
        ctx.lineTo(cx + d * bw * 0.08, y - unit * 0.12);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,150,150,0.7)';
        ctx.beginPath();
        ctx.moveTo(cx + d * bw * 0.32, y - unit * 0.02);
        ctx.lineTo(cx + d * bw * 0.5, y - unit * 0.32);
        ctx.lineTo(cx + d * bw * 0.18, y - unit * 0.1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.shade;
      });
    } else if (key === 'dragon') {
      [-1, 1].forEach((d) => {
        ctx.beginPath();
        ctx.moveTo(cx + d * bw * 0.22, y);
        ctx.lineTo(cx + d * bw * 0.36, y - unit * 0.55);
        ctx.lineTo(cx + d * bw * 0.05, y - unit * 0.1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    } else { // slime 触角
      const sw = Math.sin(t * 4) * unit * 0.08;
      ctx.lineWidth = unit * 0.08; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, y + unit * 0.1);
      ctx.quadraticCurveTo(cx + sw, y - unit * 0.4, cx + sw * 1.5, y - unit * 0.55);
      ctx.stroke();
      ctx.fillStyle = pal.glow;
      ellipse(ctx, cx + sw * 1.5, y - unit * 0.6, unit * 0.12, unit * 0.12); ctx.fill();
    }
  }

  function drawWhiskers(ctx, cx, y, bw, unit, pal) {
    ctx.strokeStyle = hexA(pal.eye, 0.7); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    [-1, 1].forEach((d) => {
      [-0.06, 0.04].forEach((oy) => {
        ctx.beginPath();
        ctx.moveTo(cx + d * bw * 0.32, y + unit * oy);
        ctx.lineTo(cx + d * bw * 0.85, y + unit * (oy - 0.05));
        ctx.stroke();
      });
    });
  }

  function drawBubbles(ctx, cx, cy, bw, bh, unit, pal, t) {
    ctx.fillStyle = hexA('#ffffff', 0.35);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.6 + i * 0.4) % 1;
      const bx = cx + Math.sin(i * 2 + t) * bw * 0.3;
      const by = cy + bh * 0.4 - ph * bh * 1.2;
      ellipse(ctx, bx, by, unit * (0.06 + i * 0.02), unit * (0.06 + i * 0.02)); ctx.fill();
    }
  }

  function drawPattern(ctx, cx, cy, bw, bh, pal, key) {
    ctx.strokeStyle = hexA(pal.accent, 0.6); ctx.fillStyle = hexA(pal.accent, 0.55);
    if (key === 'cat') {
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      [-0.3, 0, 0.3].forEach((o) => {
        ctx.beginPath();
        ctx.moveTo(cx + o * bw, cy - bh * 0.55);
        ctx.lineTo(cx + o * bw * 1.3, cy - bh * 0.3);
        ctx.stroke();
      });
    } else if (key === 'dragon') {
      for (let i = 0; i < 3; i++) {
        ellipse(ctx, cx, cy + bh * (0.05 + i * 0.22), bw * (0.28 - i * 0.05), bh * 0.08); ctx.fill();
      }
    } else {
      [[-0.35, -0.1], [0.3, 0.15], [0.05, 0.4]].forEach(([dx, dy]) => {
        ellipse(ctx, cx + dx * bw, cy + dy * bh, bw * 0.12, bh * 0.1); ctx.fill();
      });
    }
  }

  function drawCrown(ctx, cx, y, unit) {
    ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = '#c99a17'; ctx.lineWidth = 1.2;
    const w = unit * 0.6, h = unit * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - w, y + h);
    ctx.lineTo(cx - w, y - h * 0.2);
    ctx.lineTo(cx - w * 0.5, y + h * 0.2);
    ctx.lineTo(cx, y - h);
    ctx.lineTo(cx + w * 0.5, y + h * 0.2);
    ctx.lineTo(cx + w, y - h * 0.2);
    ctx.lineTo(cx + w, y + h);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e5484d';
    ellipse(ctx, cx, y + h * 0.35, unit * 0.08, unit * 0.08); ctx.fill();
  }

  function drawMouth(ctx, cx, y, unit, color, mode) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (mode === 'open') {
      ellipse(ctx, cx, y + unit * 0.05, unit * 0.1, unit * 0.13); ctx.fill();
    } else if (mode === 'sleep') {
      ctx.beginPath(); ctx.arc(cx, y - unit * 0.05, unit * 0.09, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    } else if (mode === 'work') {
      ctx.beginPath(); ctx.moveTo(cx - unit * 0.1, y); ctx.lineTo(cx + unit * 0.1, y); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx, y - unit * 0.02, unit * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  // ---- 行为氛围特效(Zzz / ! ) ----
  function drawBehaviorFx(ctx, cx, cy, unit, behavior, phase) {
    // 设备视角下顶部留给文字、下部与两侧看不见,把行为特效限制在中央可见带内
    const clampX = (x) => Math.max(32, Math.min(112, x));
    const clampY = (y) => Math.max(64, Math.min(122, y));
    if (behavior === 'sleep') {
      ctx.fillStyle = '#cfd3dc';
      ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const ph = (phase * 0.5 + i * 0.33) % 1;
        const zx = clampX(cx + unit * 0.42 + i * unit * 0.18);
        const zy = clampY(cy - unit * 0.25 - ph * unit * 0.6);
        ctx.globalAlpha = 1 - ph;
        ctx.font = `bold ${unit * (0.26 + i * 0.09)}px 'Source Han Sans SC', sans-serif`;
        ctx.fillText('Z', zx, zy);
      }
      ctx.globalAlpha = 1;
    } else if (behavior === 'idle') {
      // 等待:头顶“…”思考点
      const bx = clampX(cx + unit * 0.5), by = clampY(cy - unit * 0.45);
      for (let i = 0; i < 3; i++) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(phase * 3 - i * 0.7));
        ctx.globalAlpha = a; ctx.fillStyle = '#cfd3dc';
        ellipse(ctx, bx + (i - 1) * unit * 0.22, by, unit * 0.06, unit * 0.06); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (behavior === 'alert') {
      const pop = 0.85 + Math.abs(Math.sin(phase * 5)) * 0.3;
      const bx = clampX(cx + unit * 0.5), by = clampY(cy - unit * 0.45);
      const rad = unit * 0.26 * pop;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2;
      ellipse(ctx, bx, by, rad, rad); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - rad * 0.35, by + rad * 0.7); ctx.lineTo(bx - rad * 0.05, by + rad * 1.25); ctx.lineTo(bx + rad * 0.15, by + rad * 0.6); ctx.fill();
      ctx.fillStyle = '#e5484d';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${rad * 1.3}px 'Source Han Sans SC', sans-serif`;
      ctx.fillText('!', bx, by + rad * 0.05);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // 把 #rrggbb + alpha -> rgba()
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawPet(ctx, cfg) {
    const { species, growth, behavior, phase, cx, cy, unit } = cfg;
    const pal = PALETTES[species] || PALETTES.slime;
    const sp = { key: species, ...pal, ...SHAPE[species] };

    if (growth.stage <= 1) {
      drawEgg(ctx, cx, cy, unit * 0.9, pal, growth.stage === 1, phase);
    } else {
      drawCreature(ctx, cx, cy, unit, sp, growth, behavior, phase);
    }
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
