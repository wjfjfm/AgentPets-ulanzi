/**
 * Pet 实例：一个按键上的一只宠物。
 * 负责：状态机(运行/等待/完成) · 运行计时 · 成长计算 · 合成画面 · 推送图标。
 *
 * 顶部“黄金带”布局(144 x 144)——两种文字用彩色标签区分说话人:
 *   ┌────────────────────┐
 *   │ ● Candy      5h 33m 20s │  头部:状态点 + 名字 + 运行时间
 *   │ [You] Refactor the auth │  我这轮说的话(两行)
 *   │       module for tests  │
 *   │ [Codex 3a5b3f] Done —   │  agent 这轮最新反馈(两行,标签用 agent 色)
 *   │       all tests pass     │
 *   │        (宠物,下沉)      │
 *   └────────────────────┘
 */
(function () {
  const S = window.PetStages;
  const Art = window.PetArt;
  const Demo = window.PetDemo;

  const SIZE = 144;
  const CX = 72;
  const BASE_UNIT = 22;
  const HOLD_RESET_MS = 3000; // 长按 3 秒重置
  const SCRIM_H = 84;     // 顶部信息带遮罩高度
  const MARGIN_L = 12, MARGIN_R = 132; // 文字左右安全边界
  // 宠物默认贴“可用区域”上边缘(信息带下方),优先完整显示(含脚);
  // 长得非常大时自然向下延伸、被下边缘裁掉。
  const AREA_TOP = 78;   // 可用区域上边缘(信息带之下)
  const TOP_UNIT = 1.35; // 宠物顶端(冠/角)相对中心约 1.35 个 unit

  // 状态视觉映射(demo: running/waiting/completed)
  const STATUS = {
    running:   { behavior: 'work',  color: '#37c057', label: { en: 'Working', zh: '工作中' } },
    waiting:   { behavior: 'idle',  color: '#f0a83a', label: { en: 'Waiting', zh: '等待中' } },
    completed: { behavior: 'alert', color: '#4a9df0', label: { en: 'Done!',   zh: '完成' } },
  };

  // Agent 主题色(用于反馈标签,和状态色区分开)
  const AGENT_COLORS = {
    Codex: '#19c37d', Claude: '#d9a441', Qoder: '#7b6cf6', Pi: '#ec6a5e',
  };

  function Pet(context) {
    this.context = context;
    this.species = 'slime';
    this.accumSec = 0;      // 累计运行秒数(驱动成长)
    this.lang = 'zh';

    // ---- demo 身份/状态 ----
    const id = Demo.genIdentity();
    this.petName = id.petName;
    this.agent = id.agent;
    this.sid = id.sid;
    const turn = Demo.pickTurn();
    this.userMsg = turn.userMsg;   // 本轮我说的话
    this.agentMsg = turn.agentMsg; // 本轮 agent 最新反馈
    this.demoStatus = 'running';
    this.nextSwitchAt = 0;  // 首次 render/tick 时按 now 初始化

    this.holdStart = 0;
    this.lastPushIcon = '';

    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d');
  }

  Pet.prototype.applySettings = function (s) {
    if (!s) return;
    if (s.species && Art.species.includes(s.species)) this.species = s.species;
    if (typeof s.accumSec === 'number' && s.accumSec >= 0) this.accumSec = s.accumSec;
    if (typeof s.petName === 'string' && s.petName.trim()) this.petName = s.petName.trim();
    if (typeof s.agent === 'string' && s.agent.trim()) this.agent = s.agent.trim();
    if (typeof s.sid === 'string' && s.sid.trim()) this.sid = s.sid.trim();
    if (typeof s.demoStatus === 'string' && STATUS[s.demoStatus]) this.demoStatus = s.demoStatus;
  };

  Pet.prototype.serialize = function () {
    return {
      species: this.species,
      accumSec: Math.round(this.accumSec),
      petName: this.petName, agent: this.agent, sid: this.sid,
      demoStatus: this.demoStatus,
    };
  };

  Pet.prototype.setLang = function (ln) {
    this.lang = (ln && ln.indexOf('zh') === 0) ? 'zh' : 'en';
  };

  Pet.prototype.growth = function () { return S.growthFromSeconds(this.accumSec); };
  Pet.prototype.status = function () { return this.demoStatus; };

  // ---- demo 状态切换 ----
  Pet.prototype._newTurn = function () {
    const t = Demo.pickTurn();
    this.userMsg = t.userMsg;
    this.agentMsg = t.agentMsg;
  };
  Pet.prototype.maybeSwitch = function (now) {
    if (!this.nextSwitchAt) { this.nextSwitchAt = now + Demo.logRandInterval(); return; }
    if (now >= this.nextSwitchAt) {
      this.demoStatus = Demo.pickState();
      this._newTurn();
      this.nextSwitchAt = now + Demo.logRandInterval();
    }
  };
  // 单击:立即随机切换一次(新状态 + 新一轮对话)
  Pet.prototype.forceSwitch = function (now) {
    this.demoStatus = Demo.pickState();
    this._newTurn();
    this.nextSwitchAt = now + Demo.logRandInterval();
  };

  // 长按满 3 秒:重置(重新生成身份、清零计时)
  Pet.prototype.reset = function () {
    const id = Demo.genIdentity();
    this.petName = id.petName;
    this.agent = id.agent;
    this.sid = id.sid;
    this._newTurn();
    this.demoStatus = 'running';
    this.accumSec = 0;
    this.nextSwitchAt = 0;
    this.holdStart = 0;
  };

  Pet.prototype.tick = function (dtSec) { this.accumSec += dtSec; };

  // ---- 长按状态 ----
  Pet.prototype.beginHold = function (now) { this.holdStart = now; };
  Pet.prototype.holdProgress = function (now) {
    if (!this.holdStart) return 0;
    return Math.min(1, (now - this.holdStart) / HOLD_RESET_MS);
  };
  Pet.prototype.endHold = function () { this.holdStart = 0; };
  Pet.prototype.HOLD_RESET_MS = HOLD_RESET_MS;

  function fmtTime(totalSec) {
    const s = Math.floor(totalSec % 60);
    const m = Math.floor((totalSec / 60) % 60);
    const h = Math.floor(totalSec / 3600);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
    if (m > 0) return `${m}m ${pad(s)}s`;
    return `${s}s`;
  }

  // 头部用紧凑时钟格式(节省横向空间,给 id 让位),仍保留秒
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
        // 第二行放不下,追加并稍后截断
        lines[li] = lines[li] + ' ' + w;
      }
    }
    // 末行截断
    let last = lines[1];
    if (ctx.measureText(last).width > restMaxW) {
      while (last.length > 1 && ctx.measureText(last + '…').width > restMaxW) last = last.slice(0, -1);
      lines[1] = last + '…';
    }
    return lines;
  }

  // 用户头像小图标(圆底 + 人形剪影),作为“我说的话”的前导标记
  function drawUserBadge(ctx, x, y, r) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#5a6675';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef2f7';
    // 头
    ctx.beginPath(); ctx.arc(x, y - r * 0.22, r * 0.30, 0, Math.PI * 2); ctx.fill();
    // 肩(上半圆)
    ctx.beginPath(); ctx.arc(x, y + r * 0.72, r * 0.5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 前导图标 + 两行内容(图标由 iconFn(ctx,x,y,r) 绘制)
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

  // 我这轮说的话:用户头像图标 + 两行内容
  Pet.prototype.drawAsk = function (ctx, text, textColor, line1Y, line2Y) {
    drawIconLines(ctx, drawUserBadge, text, textColor, line1Y, line2Y);
  };

  // agent 这轮反馈:运行状态图标 + 两行内容
  Pet.prototype.drawReply = function (ctx, st, meta, phase, text, textColor, line1Y, line2Y) {
    const self = this;
    drawIconLines(ctx, function (c, x, y, r) {
      self.drawStatusBadge(c, x, y, r, st, meta, phase);
    }, text, textColor, line1Y, line2Y);
  };

  Pet.prototype.render = function (now, phase) {
    const ctx = this.ctx;
    const g = this.growth();
    const st = this.status();
    const meta = STATUS[st];

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
    bg.addColorStop(0, '#24262b');
    bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 宠物本体:顶端贴可用区域上边缘,尽量完整显示;过大则向下溢出被裁
    const unit = BASE_UNIT * g.scale;
    const cy = AREA_TOP + TOP_UNIT * unit;
    Art.drawPet(ctx, {
      species: this.species,
      growth: g,
      behavior: meta.behavior,
      phase: phase,
      cx: CX, cy: cy,
      unit: unit,
    });

    // 顶部信息带遮罩
    const scrim = ctx.createLinearGradient(0, 0, 0, SCRIM_H);
    scrim.addColorStop(0, 'rgba(9,10,13,0.85)');
    scrim.addColorStop(0.75, 'rgba(9,10,13,0.6)');
    scrim.addColorStop(1, 'rgba(9,10,13,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, SIZE, SCRIM_H);

    // ---- 头部:agent 名(缩小,靠左)+ session id + 运行时间 ----
    const headY = 13;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 3;
    ctx.textBaseline = 'alphabetic';
    // 运行时间右对齐
    ctx.font = `600 11px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillStyle = '#aeb6c2'; ctx.textAlign = 'right';
    ctx.fillText(fmtClock(this.accumSec), MARGIN_R, headY);
    // agent 名(缩小,agent 主题色,靠左边缘)
    ctx.textAlign = 'left';
    ctx.font = `bold 10px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillStyle = AGENT_COLORS[this.agent] || '#c8cfda';
    ctx.fillText(this.agent, MARGIN_L, headY);
    const aw = ctx.measureText(this.agent).width;
    // session id(更小,浅灰,保证可读)
    ctx.font = `9px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillStyle = '#c2c9d4';
    ctx.fillText(' ' + this.sid, MARGIN_L + aw, headY);
    ctx.restore();

    // ---- 我这轮说的话(用户头像图标)----
    this.drawAsk(ctx, this.userMsg, '#e8edf4', 30, 42);

    // ---- agent 这轮最新反馈(用运行状态图标作为前导标记)----
    this.drawReply(ctx, st, meta, phase, this.agentMsg, '#c6cdd9', 58, 70);

    // ---- 长按重置进度环 ----
    const hp = this.holdProgress(now);
    if (hp > 0) this.drawHoldRing(ctx, hp);

    return this.canvas.toDataURL();
  };

  Pet.prototype.drawStatusBadge = function (ctx, x, y, r, st, meta, phase) {
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

  Pet.prototype.drawHoldRing = function (ctx, p) {
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

  window.Pet = Pet;
})();
