/**
 * 背景主题 —— 每个按键可独立设置。
 * ----------------------------------------------------------------------------
 * 一套背景内部分「背景层(back)」和「前景层(front)」:
 *   - back  在宠物之后绘制(天空/星空/网格…)
 *   - front 在宠物之后、UI 文字之前绘制(雨/雪/花瓣/边框…),盖在宠物身上
 * 背景在「没有宠物」时也照常显示;有宠物时与宠物一同显示。
 * 主题可为动态(用 phase 驱动动画)或静态。前景/背景不单独设置,选一套即可。
 *
 * 用法:
 *   PetBackgrounds.drawBack(ctx, key, {phase, w, h})
 *   PetBackgrounds.drawFront(ctx, key, {phase, w, h})
 */
(function () {
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
  };

  const ORDER = ['none', 'stars', 'aurora', 'rain', 'snow', 'sakura', 'grid', 'frame'];
  const NAMES = {
    none:   { en: 'None',   zh: '无' },
    stars:  { en: 'Stars',  zh: '星空' },
    aurora: { en: 'Aurora', zh: '极光' },
    rain:   { en: 'Rain',   zh: '雨' },
    snow:   { en: 'Snow',   zh: '雪' },
    sakura: { en: 'Sakura', zh: '樱花' },
    grid:   { en: 'Grid',   zh: '网格' },
    frame:  { en: 'Frame',  zh: '相框' },
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
