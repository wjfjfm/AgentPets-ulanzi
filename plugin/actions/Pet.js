/**
 * PetView —— 一个按键上的「显示视图」。
 * ----------------------------------------------------------------------------
 * 不再持有宠物数据(数据全部由 Coordinator 维护)。每个按键只保存一个 slot 索引,
 * 渲染时从外部传入该 slot 对应的宠物 meta 快照,负责把它画成 144x144 图标。
 *
 *   render(meta, now, phase):
 *     meta = { species, petName, agent, sid, accumSec, status, userMsg, agentMsg }
 *     meta 为 null 时画「空槽位」占位。
 *
 * 顶部“黄金带”布局(144 x 144):
 *   ┌────────────────────┐
 *   │ Codex 3a5b3f     5:33 │  头部:agent 名 + session id + 运行时间
 *   │ 🙂 Refactor the auth  │  我这轮说的话(两行)
 *   │    module for tests   │
 *   │ ▶ Done — all tests    │  agent 这轮反馈(状态图标 + 两行)
 *   │    pass               │
 *   │        (宠物,下沉)   │
 *   └────────────────────┘
 */
(function () {
  const S = window.PetStages;
  const Art = window.PetArt;
  const Bg = window.PetBackgrounds;

  const SIZE = 144;
  const CX = 72;
  const BASE_UNIT = 22;
  const HOLD_RESET_MS = 3000; // 长按 3 秒重置 demo 宠物池
  const SCRIM_H = 84;     // 顶部信息带遮罩高度
  const MARGIN_L = 12, MARGIN_R = 132; // 文字左右安全边界
  const AREA_TOP = 78;   // 宠物可用区域上边缘(信息带之下)
  const TOP_UNIT = 1.35; // 宠物顶端(冠/角)相对中心约 1.35 个 unit

  const STATUS = {
    running:   { behavior: 'work',  color: '#37c057' },
    waiting:   { behavior: 'idle',  color: '#f0a83a' },
    completed: { behavior: 'alert', color: '#4a9df0' },
  };

  const AGENT_COLORS = {
    Codex: '#19c37d', Claude: '#d9a441', Qoder: '#7b6cf6', Pi: '#ec6a5e',
  };

  function PetView(context) {
    this.context = context;
    this.slot = 0;         // 该按键显示池中的第几只
    this.bg = 'none';      // 背景主题(每按键独立)
    this.lang = 'zh';
    this.holdStart = 0;

    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d');
  }

  PetView.prototype.applySettings = function (s) {
    if (!s) return;
    if (typeof s.slot === 'number' && s.slot >= 0) this.slot = Math.floor(s.slot);
    if (typeof s.bg === 'string' && Bg.has(s.bg)) this.bg = s.bg;
  };

  PetView.prototype.serialize = function () {
    return { slot: this.slot, bg: this.bg };
  };

  PetView.prototype.setLang = function (ln) {
    this.lang = (ln && ln.indexOf('zh') === 0) ? 'zh' : 'en';
  };

  // ---- 长按状态 ----
  PetView.prototype.beginHold = function (now) { this.holdStart = now; };
  PetView.prototype.holdProgress = function (now) {
    if (!this.holdStart) return 0;
    return Math.min(1, (now - this.holdStart) / HOLD_RESET_MS);
  };
  PetView.prototype.endHold = function () { this.holdStart = 0; };
  PetView.prototype.HOLD_RESET_MS = HOLD_RESET_MS;

  // 头部紧凑时钟格式(H:MM:SS / M:SS / 0:SS)
  function fmtClock(totalSec) {
    const s = Math.floor(totalSec % 60);
    const m = Math.floor((totalSec / 60) % 60);
    const h = Math.floor(totalSec / 3600);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    if (m > 0) return `${m}:${pad(s)}`;
    return `0:${pad(s)}`;
  }

  // 折成两行:第一行宽度 firstMaxW,第二行宽度 restMaxW;超出末行加省略号
  function wrap2(ctx, text, firstMaxW, restMaxW, font) {
    ctx.font = font;
    const words = (text || '').split(' ');
    const l1widths = [firstMaxW, restMaxW];
    const lines = ['', ''];
    let li = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const test = lines[li] ? lines[li] + ' ' + w : w;
      if (ctx.measureText(test).width <= l1widths[li] || !lines[li]) {
        lines[li] = test;
      } else if (li === 0) {
        li = 1; lines[li] = w;
      } else {
        lines[li] = lines[li] + ' ' + w;
      }
    }
    let last = lines[1];
    if (ctx.measureText(last).width > restMaxW) {
      while (last.length > 1 && ctx.measureText(last + '…').width > restMaxW) last = last.slice(0, -1);
      lines[1] = last + '…';
    }
    return lines;
  }

  // 用户头像小图标(圆底 + 人形剪影)
  function drawUserBadge(ctx, x, y, r) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#5a6675';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef2f7';
    ctx.beginPath(); ctx.arc(x, y - r * 0.22, r * 0.30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + r * 0.72, r * 0.5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 本轮对话持续时长(秒):完成时取冻结值,否则 = now - turnStart
  function turnElapsedSec(meta, now) {
    if (meta.status === 'completed' && typeof meta.turnFrozenMs === 'number') {
      return Math.max(0, meta.turnFrozenMs / 1000);
    }
    const start = (typeof meta.turnStart === 'number') ? meta.turnStart : now;
    return Math.max(0, (now - start) / 1000);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Agent 工具图标:品牌色圆角方块 + 白色简笔标记
  function drawAgentIcon(ctx, cx, cy, size, agent) {
    const col = AGENT_COLORS[agent] || '#8b93a1';
    const r = size / 2;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = col;
    roundRect(ctx, cx - r, cy - r, size, size, size * 0.28); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.3, size * 0.11); ctx.lineCap = 'round';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (agent === 'Claude') {
      ctx.save(); ctx.translate(cx, cy);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(0, -size * 0.10); ctx.lineTo(0, -r * 0.72); ctx.stroke();
      }
      ctx.restore();
    } else if (agent === 'Codex') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6;
        const px = cx + Math.cos(a) * r * 0.62, py = cy + Math.sin(a) * r * 0.62;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    } else if (agent === 'Qoder') {
      ctx.font = `bold ${size * 0.72}px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText('Q', cx, cy + size * 0.03);
    } else if (agent === 'Pi') {
      ctx.font = `bold ${size * 0.72}px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText('π', cx, cy + size * 0.03);
    } else {
      ctx.font = `bold ${size * 0.62}px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText((agent || '?').charAt(0), cx, cy + size * 0.03);
    }
    ctx.restore();
  }

  // 前导图标 + 两行内容
  function drawIconLines(ctx, iconFn, text, textColor, line1Y, line2Y) {
    const iconR = 6;
    const iconX = MARGIN_L + iconR;
    iconFn(ctx, iconX, line1Y - 4, iconR);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 3;
    const l1x = iconX + iconR + 5;
    const font = `500 11px 'Source Han Sans SC', system-ui, sans-serif`;
    const lines = wrap2(ctx, text, MARGIN_R - l1x, MARGIN_R - MARGIN_L, font);
    ctx.font = font; ctx.fillStyle = textColor;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(lines[0] || '', l1x, line1Y);
    if (lines[1]) ctx.fillText(lines[1], MARGIN_L, line2Y);
    ctx.restore();
  }

  PetView.prototype.drawStatusBadge = function (ctx, x, y, r, st, meta, phase) {
    let pulse = 1;
    if (st === 'completed') pulse = 1 + Math.sin(phase * 5) * 0.12;
    ctx.save();
    ctx.fillStyle = meta.color;
    ctx.shadowColor = meta.color; ctx.shadowBlur = st === 'completed' ? 8 : 0;
    ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    if (st === 'running') {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.32, y - r * 0.42);
      ctx.lineTo(x - r * 0.32, y + r * 0.42);
      ctx.lineTo(x + r * 0.48, y);
      ctx.closePath(); ctx.fill();
    } else if (st === 'waiting') {
      ctx.fillRect(x - r * 0.4, y - r * 0.42, r * 0.3, r * 0.84);
      ctx.fillRect(x + r * 0.1, y - r * 0.42, r * 0.3, r * 0.84);
    } else {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.48, y + r * 0.26);
      ctx.quadraticCurveTo(x - r * 0.48, y - r * 0.48, x, y - r * 0.48);
      ctx.quadraticCurveTo(x + r * 0.48, y - r * 0.48, x + r * 0.48, y + r * 0.26);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + r * 0.42, r * 0.15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  function drawBackground(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
    bg.addColorStop(0, '#24262b');
    bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // 空槽位占位:该按键选中的 slot 尚无宠物(还没生成);背景照常显示
  PetView.prototype.renderEmpty = function (now, phase) {
    const ctx = this.ctx;
    const cfg = { phase: phase, w: SIZE, h: SIZE };
    drawBackground(ctx);
    Bg.drawBack(ctx, this.bg, cfg);
    Bg.drawFront(ctx, this.bg, cfg);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
    ctx.fillStyle = '#7c8698';
    ctx.font = `600 44px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText('#' + (this.slot + 1), CX, 92);
    ctx.restore();
    const hp = this.holdProgress(now);
    if (hp > 0) this.drawHoldRing(ctx, hp);
    return this.canvas.toDataURL();
  };

  PetView.prototype.render = function (meta, now, phase) {
    if (!meta) return this.renderEmpty(now, phase);
    const ctx = this.ctx;
    const g = S.growthFromSeconds(meta.accumSec);
    const st = STATUS[meta.status] ? meta.status : 'running';
    const smeta = STATUS[st];
    const cfg = { phase: phase, w: SIZE, h: SIZE };

    drawBackground(ctx);
    Bg.drawBack(ctx, this.bg, cfg);

    // 宠物本体:顶端贴可用区域上边缘,尽量完整显示;过大则向下溢出被裁
    const unit = BASE_UNIT * g.scale;
    const cy = AREA_TOP + TOP_UNIT * unit;
    Art.drawPet(ctx, {
      species: meta.species,
      growth: g,
      behavior: smeta.behavior,
      phase: phase,
      cx: CX, cy: cy,
      unit: unit,
    });

    // 前景层(盖在宠物之上,UI 文字之下)
    Bg.drawFront(ctx, this.bg, cfg);

    // 顶部信息带遮罩
    const scrim = ctx.createLinearGradient(0, 0, 0, SCRIM_H);
    scrim.addColorStop(0, 'rgba(9,10,13,0.85)');
    scrim.addColorStop(0.75, 'rgba(9,10,13,0.6)');
    scrim.addColorStop(1, 'rgba(9,10,13,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, SIZE, SCRIM_H);

    // ---- 头部:Agent 工具图标 + session id(靠左固定宽) + 本轮时长(右侧余量居中) ----
    const headY = 13;
    const iconSize = 14;
    const sidX = MARGIN_L + iconSize + 5;   // session id 起始 x
    const sidW = 44;                        // session id 固定占位宽度
    const timeLeft = sidX + sidW;           // 时间可用区域左界
    drawAgentIcon(ctx, MARGIN_L + iconSize / 2, headY - 4, iconSize, meta.agent);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 3;
    ctx.textBaseline = 'alphabetic';
    // session id 靠左(紧跟图标,固定宽度,超出裁剪)
    ctx.save();
    ctx.beginPath();
    ctx.rect(sidX, 0, sidW, SCRIM_H);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.font = `9px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillStyle = '#c2c9d4';
    ctx.fillText(meta.sid, sidX, headY);
    ctx.restore();
    // 本轮对话时长 在 session id 右侧的剩余空间居中
    ctx.textAlign = 'center';
    ctx.font = `600 11px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillStyle = '#aeb6c2';
    ctx.fillText(fmtClock(turnElapsedSec(meta, now)), (timeLeft + MARGIN_R) / 2, headY);
    ctx.restore();

    // ---- 我这轮说的话(用户头像图标)----
    drawIconLines(ctx, drawUserBadge, meta.userMsg, '#e8edf4', 30, 42);

    // ---- agent 这轮反馈(运行状态图标作为前导)----
    const self = this;
    drawIconLines(ctx, function (c, x, y, r) {
      self.drawStatusBadge(c, x, y, r, st, smeta, phase);
    }, meta.agentMsg, '#c6cdd9', 58, 70);

    // ---- 长按重置进度环 ----
    const hp = this.holdProgress(now);
    if (hp > 0) this.drawHoldRing(ctx, hp);

    return this.canvas.toDataURL();
  };

  PetView.prototype.drawHoldRing = function (ctx, p) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.translate(CX, 96);
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e5484d';
    ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 22px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(Math.ceil((1 - p) * (HOLD_RESET_MS / 1000)) + '', 0, 1);
    ctx.font = `11px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(this.lang === 'zh' ? '松手重置' : 'reset', 0, 20);
    ctx.restore();
  };

  window.PetView = PetView;
  // 兼容旧引用
  window.Pet = PetView;
})();
