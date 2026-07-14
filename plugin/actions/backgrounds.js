/**
 * 背景主题 —— 每个按键可独立设置。
 * ----------------------------------------------------------------------------
 * 一套背景内部分「背景层(back)」和「前景层(front)」:
 *   - back  在宠物之后绘制(天空/星空/网格…)
 *   - front 在宠物之后、UI 文字之前绘制(雨/雪/花瓣/边框…),盖在宠物身上
 * 背景在「没有宠物」时也照常显示;有宠物时与宠物一同显示。
 * 主题可为动态(用 phase 驱动动画)或静态。前景/背景不单独设置,选一套即可。
 *
 * 【文字安全区】顶部约 0~84px(SCRIM_H)承载 UI 文字(表头/问题行/反馈行)。
 *   设计背景时,「房子/狗窝/篱笆/太阳」等主要实心物件应放在下方 Pet 区
 *   (y ≳ PET_TOP),避免压住文字导致难以辨识;天空渐变、粒子等低对比氛围
 *   元素可铺满整块(顶部另有遮罩压暗)。
 *
 * 用法:
 *   PetBackgrounds.drawBack(ctx, key, {phase, w, h})
 *   PetBackgrounds.drawFront(ctx, key, {phase, w, h})
 */
(function () {
  // 主要物件的顶边下限:低于此线才不会压到顶部文字
  const PET_TOP = 84;
  // 稳定伪随机(按索引,保证每帧位置不跳变)
  function rnd(i) {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  function vgrad(ctx, w, h, c0, c1) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function cloud(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const THEMES = {
    none: { back: null, front: null },

    // 星空:背景层动态闪烁星星
    stars: {
      back: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        vgrad(ctx, w, h, '#0e1430', '#05070f');
        for (let i = 0; i < 26; i++) {
          const x = rnd(i) * w;
          const y = rnd(i + 7) * h * 0.85;
          const a = 0.25 + 0.75 * Math.abs(Math.sin(phase * (1 + rnd(i + 3)) + i));
          const r = 0.6 + rnd(i + 11) * 1.3;
          ctx.globalAlpha = a; ctx.fillStyle = '#eaf0ff';
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
      front: null,
    },

    // 极光:背景层动态飘动光带
    aurora: {
      back: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        vgrad(ctx, w, h, '#071018', '#02060a');
        const bands = [['#39ffb0', 0.20, 0], ['#7b8cff', 0.16, 1.7], ['#ff7be0', 0.12, 3.3]];
        bands.forEach(([col, alpha, off]) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          const grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
          grad.addColorStop(0, col); grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 8) {
            const y = h * 0.32 + Math.sin(x * 0.03 + phase * 1.2 + off) * 14 + Math.sin(x * 0.011 + phase * 0.6) * 10;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
      },
      front: null,
    },

    // 雨:前景层斜向雨丝(盖在宠物前面)
    rain: {
      back: function (ctx, cfg) { vgrad(ctx, cfg.w, cfg.h, '#2a3340', '#141a22'); },
      front: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        ctx.save();
        ctx.strokeStyle = 'rgba(170,200,235,0.55)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 40; i++) {
          const speed = 260 + rnd(i + 5) * 160;
          const x = rnd(i) * (w + 20) - 10 + Math.sin(phase + i) * 2;
          const y = (rnd(i + 2) * h + phase * speed) % (h + 20);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke();
        }
        ctx.restore();
      },
    },

    // 雪:前景层缓降雪花,带横向摆动
    snow: {
      back: function (ctx, cfg) { vgrad(ctx, cfg.w, cfg.h, '#3a4457', '#20293a'); },
      front: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 34; i++) {
          const speed = 26 + rnd(i + 4) * 34;
          const sway = Math.sin(phase * (0.6 + rnd(i) * 0.8) + i) * 8;
          const x = (rnd(i) * w + sway + w) % w;
          const y = (rnd(i + 2) * h + phase * speed) % (h + 8);
          const r = 1 + rnd(i + 9) * 2;
          ctx.globalAlpha = 0.5 + rnd(i + 6) * 0.5;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.restore();
      },
    },

    // 樱花:前景层飘落花瓣
    sakura: {
      back: function (ctx, cfg) { vgrad(ctx, cfg.w, cfg.h, '#3b2a3a', '#241a26'); },
      front: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        ctx.save();
        for (let i = 0; i < 22; i++) {
          const speed = 30 + rnd(i + 4) * 30;
          const sway = Math.sin(phase * (0.8 + rnd(i)) + i) * 12;
          const x = (rnd(i) * w + sway + w) % w;
          const y = (rnd(i + 2) * h + phase * speed) % (h + 10);
          const r = 2 + rnd(i + 9) * 2.5;
          ctx.globalAlpha = 0.7 + rnd(i + 6) * 0.3;
          ctx.fillStyle = i % 2 ? '#ffc2dd' : '#ff9ec4';
          ctx.save(); ctx.translate(x, y); ctx.rotate(phase + i);
          ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.restore();
      },
    },

    // 合成波网格:背景层透视网格(动态向前滚动)
    grid: {
      back: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2a1246'); g.addColorStop(0.5, '#4a1e63'); g.addColorStop(0.5, '#12060f'); g.addColorStop(1, '#050208');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const hy = h * 0.5;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,60,160,0.55)'; ctx.lineWidth = 1;
        // 纵向透视线
        for (let i = -6; i <= 6; i++) {
          ctx.beginPath(); ctx.moveTo(w / 2 + i * 6, hy); ctx.lineTo(w / 2 + i * 34, h); ctx.stroke();
        }
        // 横向线(向下加速滚动)
        for (let k = 0; k < 9; k++) {
          const t = ((k + (phase * 0.4) % 1) / 9);
          const y = hy + t * t * (h - hy);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        ctx.restore();
      },
      front: null,
    },

    // 相框:背景层柔和渐变 + 前景层静态圆角边框(演示静态前景)
    frame: {
      back: function (ctx, cfg) { vgrad(ctx, cfg.w, cfg.h, '#2b2f3a', '#171a22'); },
      front: function (ctx, cfg) {
        const { w, h } = cfg;
        ctx.save();
        ctx.strokeStyle = 'rgba(230,200,120,0.85)'; ctx.lineWidth = 4;
        const m = 6, r = 12;
        ctx.beginPath();
        ctx.moveTo(m + r, m);
        ctx.arcTo(w - m, m, w - m, h - m, r);
        ctx.arcTo(w - m, h - m, m, h - m, r);
        ctx.arcTo(m, h - m, m, m, r);
        ctx.arcTo(m, m, w - m, m, r);
        ctx.closePath(); ctx.stroke();
        ctx.restore();
      },
    },

    // 草原:蓝天 + 起伏山丘 + 飘云 + 太阳;前景摇曳青草
    meadow: {
      back: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.62, '#cdeeff');
        g.addColorStop(0.62, '#a6e07a'); g.addColorStop(1, '#79c052');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // 太阳:低垂近地平线,落在 Pet 区(不压顶部文字)
        ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle = '#fff2b0';
        ctx.beginPath(); ctx.arc(w - 26, PET_TOP + 12, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        // 远山(位于地平线以下)
        ctx.fillStyle = '#8ccf63';
        ctx.beginPath(); ctx.moveTo(0, h * 0.72);
        ctx.quadraticCurveTo(w * 0.3, h * 0.62, w * 0.6, h * 0.72);
        ctx.quadraticCurveTo(w * 0.85, h * 0.8, w, h * 0.68);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
        // 飘云:压低到地平线附近,避开文字区
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 3; i++) {
          const cx = ((i * 58 + phase * 6) % (w + 60)) - 30;
          cloud(ctx, cx, PET_TOP + 2 + i * 6, 6 + i * 1.5);
        }
      },
      front: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        ctx.save();
        ctx.strokeStyle = '#4f9e39'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i <= 26; i++) {
          const x = i * (w / 26); const sway = Math.sin(phase * 2 + i * 0.6) * 3;
          ctx.beginPath(); ctx.moveTo(x, h);
          ctx.quadraticCurveTo(x + sway, h - 9, x + sway * 1.6, h - 15); ctx.stroke();
        }
        ctx.restore();
      },
    },

    // 篱笆:蓝天 + 绿地 + 白色尖桩篱笆
    fence: {
      back: function (ctx, cfg) {
        const { w, h } = cfg;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#a9dbff'); g.addColorStop(0.6, '#dff2c4');
        g.addColorStop(0.6, '#8ccf5c'); g.addColorStop(1, '#6bb544');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const topY = PET_TOP + 8, botY = 128;
        ctx.fillStyle = '#f4f1e7'; ctx.strokeStyle = '#c9c2ad'; ctx.lineWidth = 1;
        ctx.fillRect(0, topY + 8, w, 5); ctx.fillRect(0, botY - 12, w, 5);
        for (let x = 2; x < w; x += 18) {
          ctx.beginPath();
          ctx.moveTo(x, botY); ctx.lineTo(x, topY + 5); ctx.lineTo(x + 6, topY);
          ctx.lineTo(x + 12, topY + 5); ctx.lineTo(x + 12, botY); ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
      },
      front: null,
    },

    // 房子:暖色墙面 + 采光窗 + 木地板(窗户下移到 Pet 区)
    house: {
      back: function (ctx, cfg) {
        const { w, h } = cfg;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#f0d3a0'); g.addColorStop(0.82, '#e6bd78');
        g.addColorStop(0.82, '#b3783f'); g.addColorStop(1, '#9c6533');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const wx = 12, wy = PET_TOP + 4, ww = 40, wh = 34;
        ctx.fillStyle = '#bfe6ff'; ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 3; ctx.strokeRect(wx, wy, ww, wh);
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
      },
      front: null,
    },

    // 狗窝:昏暗暖调 + 带屋顶和拱形门洞的小窝(整体位于 Pet 区,宠物坐在门口)
    kennel: {
      back: function (ctx, cfg) {
        const { w, h } = cfg;
        vgrad(ctx, w, h, '#3a2c22', '#241a14');
        const bx = 30, bw = w - 60, by = PET_TOP + 12, bh = h - by;
        ctx.fillStyle = '#c98a4e'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#8b4f2a';
        ctx.beginPath(); ctx.moveTo(bx - 8, by); ctx.lineTo(w / 2, by - 16);
        ctx.lineTo(bx + bw + 8, by); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1c130d';
        const dw = bw * 0.5, dx = w / 2 - dw / 2, dy = by + bh, dtop = by + 12;
        ctx.beginPath();
        ctx.moveTo(dx, dy); ctx.lineTo(dx, dtop + dw / 2);
        ctx.quadraticCurveTo(w / 2, dtop - 6, dx + dw, dtop + dw / 2);
        ctx.lineTo(dx + dw, dy); ctx.closePath(); ctx.fill();
      },
      front: null,
    },

    // 花园:粉彩天空 + 绿地 + 灌木;前景飘落花粉 + 一排小花
    garden: {
      back: function (ctx, cfg) {
        const { w, h } = cfg;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#ffd9ec'); g.addColorStop(0.55, '#fff0d0');
        g.addColorStop(0.55, '#9fd873'); g.addColorStop(1, '#7cc255');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#6fb84a';
        [[20, 112, 17], [w - 24, 118, 20], [w / 2, 126, 15]].forEach((b) => {
          ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); ctx.fill();
        });
      },
      front: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        ctx.save();
        ctx.fillStyle = 'rgba(255,250,200,0.9)';
        for (let i = 0; i < 14; i++) {
          const x = (rnd(i) * w + Math.sin(phase * 0.6 + i) * 10 + w) % w;
          const y = (rnd(i + 3) * h * 0.8 + phase * 8) % h;
          ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(phase + i));
          ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const cols = ['#ff7ba0', '#ffd166', '#c08bff'];
        for (let i = 0; i < 7; i++) {
          const x = 12 + i * (w - 24) / 6, y = h - 7;
          ctx.fillStyle = cols[i % 3];
          for (let k = 0; k < 5; k++) {
            const a = k / 5 * Math.PI * 2;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#fff2b0';
          ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },
    },

    // 壁炉:昏暗暖室 + 火光辉晕 + 炉膛 + 跳动火焰
    fireplace: {
      back: function (ctx, cfg) {
        const { phase, w, h } = cfg;
        vgrad(ctx, w, h, '#3a2620', '#1a1210');
        const gl = 0.5 + Math.sin(phase * 6) * 0.14;
        const rg = ctx.createRadialGradient(w / 2, h * 0.82, 8, w / 2, h * 0.82, 92);
        rg.addColorStop(0, `rgba(255,150,60,${0.38 * gl})`);
        rg.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#5a3a2a'; ctx.fillRect(18, h - 26, w - 36, 26);
        for (let i = 0; i < 5; i++) {
          const fx = w / 2 + (i - 2) * 10;
          const fh = 12 + Math.abs(Math.sin(phase * 8 + i)) * 12;
          ctx.fillStyle = i % 2 ? '#ff9a3c' : '#ffd23c';
          ctx.beginPath(); ctx.moveTo(fx - 5, h - 12);
          ctx.quadraticCurveTo(fx, h - 12 - fh, fx + 5, h - 12); ctx.closePath(); ctx.fill();
        }
      },
      front: null,
    },
  };

  const ORDER = ['none', 'stars', 'aurora', 'rain', 'snow', 'sakura', 'grid', 'frame',
    'meadow', 'fence', 'house', 'kennel', 'garden', 'fireplace'];
  const NAMES = {
    none:   { en: 'None',   zh: '无' },
    stars:  { en: 'Stars',  zh: '星空' },
    aurora: { en: 'Aurora', zh: '极光' },
    rain:   { en: 'Rain',   zh: '雨' },
    snow:   { en: 'Snow',   zh: '雪' },
    sakura: { en: 'Sakura', zh: '樱花' },
    grid:   { en: 'Grid',   zh: '网格' },
    frame:  { en: 'Frame',  zh: '相框' },
    meadow: { en: 'Meadow', zh: '草原' },
    fence:  { en: 'Fence',  zh: '篱笆' },
    house:  { en: 'House',  zh: '房子' },
    kennel: { en: 'Kennel', zh: '狗窝' },
    garden: { en: 'Garden', zh: '花园' },
    fireplace: { en: 'Fireplace', zh: '壁炉' },
  };

  function drawBack(ctx, key, cfg) {
    const t = THEMES[key] || THEMES.none;
    if (t.back) t.back(ctx, cfg);
  }
  function drawFront(ctx, key, cfg) {
    const t = THEMES[key] || THEMES.none;
    if (t.front) t.front(ctx, cfg);
  }

  window.PetBackgrounds = {
    themes: ORDER,
    names: NAMES,
    has: function (k) { return !!THEMES[k]; },
    drawBack: drawBack,
    drawFront: drawFront,
  };
})();
