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
  const Ev = window.PetEvolution;
  const Bg = window.PetBackgrounds;
  const ArtSets = window.PetArtSets;
  const Gif = window.PetGif; // 运行时 GIF 引擎(仅服务端;浏览器为 undefined)

  // 美工 id → 程序化兜底 behavior(GIF 缺失时用)
  const ART_BEHAVIOR = { idle: 'idle', work: 'work', rest: 'sleep', cheer: 'alert' };

  const SIZE = 144;
  const CX = 72;
  const BASE_UNIT = 22;
  const HOLD_DELETE_MS = 1000; // 长按满 1 秒删除当前 Pet
  const HOLD_SHOW_MS = 250;    // 长按满 0.25 秒才显示倒计时框(滚轮);短于此的快速点击 = 单击(打开宠物个人页)
  const ACTIVATE_SUPPRESS_MS = 500; // 翻页激活后 0.5s 内的 keyup 视为翻页残留,不触发单击
  const SCRIM_H = 84;     // 顶部信息带遮罩高度
  const MARGIN_L = 12, MARGIN_R = 132; // 文字左右安全边界
  // 地面基线:宠物的脚(地面阴影)固定落在此 Y,避免小体型(蛋)悬空;
  // 体型变大时向上生长(头部被顶部遮罩压暗,不遮挡文字)。
  const GROUND_Y = 132;

  const STATUS = {
    running:   { behavior: 'work',  color: '#37c057' },
    waiting:   { behavior: 'idle',  color: '#f0a83a' },
    completed: { behavior: 'alert', color: '#4a9df0' },
  };

  // 品牌色(取自各家官方主色):
  //   Codex→OpenAI 绿 · Claude→Anthropic 陶土橙 · Qoder→官方紫 · Pi→珊瑚
  const AGENT_COLORS = {
    Codex: '#10a37f', Claude: '#d97757', Qoder: '#8b5cf6', Pi: '#ec6a5e', Kimi: '#12b5a5', Demo: '#5a6675',
  };

  function PetView(context) {
    this.context = context;
    this.slot = 0;         // 该按键显示池中的第几只
    this.bg = 'none';      // 背景主题(每按键独立)
    this.lang = 'zh';
    this.holdStart = 0;
    this.activatedAt = 0; // 最近一次因翻页/激活(setactive)而显现的时刻,用于过滤翻页误触

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
  // 长按进度 0~1(满 1 = 到达删除时间)
  PetView.prototype.holdProgress = function (now) {
    if (!this.holdStart) return 0;
    return Math.min(1, (now - this.holdStart) / HOLD_DELETE_MS);
  };
  // 是否已达到「显示倒计时框」的时长(0.5s)
  PetView.prototype.holdVisible = function (now) {
    return this.holdStart > 0 && (now - this.holdStart) >= HOLD_SHOW_MS;
  };
  PetView.prototype.heldMs = function (now) {
    return this.holdStart ? (now - this.holdStart) : 0;
  };
  PetView.prototype.endHold = function () { this.holdStart = 0; };
  // ---- 翻页误触过滤(与 SummaryView 一致)----
  PetView.prototype.markActive = function (now) { this.activatedAt = now; };
  PetView.prototype.justActivated = function (now) {
    return this.activatedAt > 0 && (now - this.activatedAt) < ACTIVATE_SUPPRESS_MS;
  };
  PetView.prototype.ACTIVATE_SUPPRESS_MS = ACTIVATE_SUPPRESS_MS;
  PetView.prototype.HOLD_DELETE_MS = HOLD_DELETE_MS;
  PetView.prototype.HOLD_SHOW_MS = HOLD_SHOW_MS;

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

  // Agent 工具图标:品牌色圆角方块 + 白色简笔标记(参考各家真实 logo,按显示尺寸简化)
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
    if (agent === 'Demo') {
      // Demo:白色简笔锥形瓶(与 PI 的 demo 图标一致)
      ctx.save(); ctx.translate(cx, cy);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.58);
      ctx.lineTo(-r * 0.22, -r * 0.06);
      ctx.lineTo(-r * 0.62, r * 0.6);
      ctx.lineTo(r * 0.62, r * 0.6);
      ctx.lineTo(r * 0.22, -r * 0.06);
      ctx.lineTo(r * 0.22, -r * 0.58);
      ctx.stroke();
      // 瓶口边沿
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, -r * 0.58); ctx.lineTo(r * 0.34, -r * 0.58); ctx.stroke();
      // 液面
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.22); ctx.lineTo(r * 0.4, r * 0.22); ctx.stroke();
      ctx.restore();
    } else if (agent === 'Claude') {
      // Anthropic「星芒」:一圈由中心向外渐尖的填充射线
      ctx.save(); ctx.translate(cx, cy);
      const rays = 12, inner = r * 0.14, outer = r * 0.84, wBase = size * 0.06;
      for (let i = 0; i < rays; i++) {
        ctx.rotate(Math.PI * 2 / rays);
        ctx.beginPath();
        ctx.moveTo(-wBase, -inner); ctx.lineTo(wBase, -inner); ctx.lineTo(0, -outer);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    } else if (agent === 'Codex') {
      // OpenAI「花结」:六片花瓣绕中心成环,中心留孔呈镂空结
      ctx.save(); ctx.translate(cx, cy);
      const petals = 6;
      for (let i = 0; i < petals; i++) {
        const a = Math.PI * 2 / petals * i;
        ctx.save();
        ctx.translate(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34);
        ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = col; // 回填中心成镂空
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (agent === 'Qoder') {
      // Qoder:白色「Q」字标
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

  // 统一会话状态提示:画在头部文字带以下、宠物右上侧的角标。
  //   waiting(暂停/等待输入) -> 红色感叹号(脉动,提示需关注)
  //   completed(完成/休眠)   -> zzZ(轻微上浮)
  //   running(工作中)        -> 不额外提示(避免干扰)
  // 语义与左上角彩色状态徽标一致(双重提示);宠物美工层已移除重复的 ! / zzZ 特效。
  PetView.prototype.drawStatusHint = function (ctx, st, phase) {
    if (st === 'waiting') {
      const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(phase * 4));
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#e5484d';
      ctx.font = `900 30px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText('!', 120, 110);
      ctx.restore();
    } else if (st === 'completed') {
      const bob = Math.sin(phase * 2) * 1.5;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      ctx.fillStyle = '#d3dbe8';
      ctx.font = `800 11px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText('z', 104, 106 + bob);
      ctx.font = `800 15px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText('z', 114, 97 + bob);
      ctx.font = `800 20px 'Source Han Sans SC', system-ui, sans-serif`;
      ctx.fillText('Z', 125, 87 + bob);
      ctx.restore();
    }
  };

  function drawBackground(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
    bg.addColorStop(0, '#24262b');
    bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // 长按环状态解析:优先用显式 hold(服务端渲染时手势态在插件),否则用本实例的 holdStart。
  PetView.prototype._holdView = function (now, hold) {
    if (hold && typeof hold.progress === 'number') return { visible: !!hold.visible, progress: hold.progress };
    return { visible: this.holdVisible(now), progress: this.holdProgress(now) };
  };

  // 空槽位占位:该按键选中的 slot 尚无宠物(还没生成);背景照常显示
  PetView.prototype.renderEmpty = function (now, phase, hold) {
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
    const h = this._holdView(now, hold);
    if (h.visible) this.drawHoldRing(ctx, h.progress);
    return this.canvas.toDataURL();
  };

  // 重复占用占位:该按键选中的 slot 已由另一(主)按键显示同一宠物;
  // 此处不重复画宠物,改为提示「重复占用」,避免同一宠物出现在多个窗口。
  PetView.prototype.renderDuplicate = function (now, phase, hold) {
    const ctx = this.ctx;
    const cfg = { phase: phase, w: SIZE, h: SIZE };
    drawBackground(ctx);
    Bg.drawBack(ctx, this.bg, cfg);
    Bg.drawFront(ctx, this.bg, cfg);
    ctx.fillStyle = 'rgba(9,10,13,0.55)'; // 暗层弱化背景,突出提示
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    ctx.fillStyle = '#c7a94a';
    ctx.font = `600 40px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText('#' + (this.slot + 1), CX, 74);
    ctx.fillStyle = '#e6be4a';
    ctx.font = `700 16px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(this.lang === 'zh' ? '重复占用' : 'Duplicate', CX, 102);
    ctx.fillStyle = '#9aa3b0';
    ctx.font = `500 11px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(this.lang === 'zh' ? '已在其它键显示' : 'shown on another key', CX, 120);
    ctx.restore();
    const h = this._holdView(now, hold);
    if (h.visible) this.drawHoldRing(ctx, h.progress);
    return this.canvas.toDataURL();
  };

  // 静态卡片渲染(供网页缩略图):完全复用 render 主体,固定静态 phase=0、无长按滚轮、无 dup。
  // 调用方需先把 this.bg 设为 'none'(空白背景,不画场景装饰)。
  // opts.skipPet=true:只画背景+文字层、留空宠物区(网页用原生 <img> GIF 叠加在其上)。
  PetView.prototype.renderCard = function (meta, opts) {
    this.holdStart = 0;
    return this.render(meta, 0, 0, false, null, opts);
  };

  PetView.prototype.render = function (meta, now, phase, dup, hold, opts) {
    if (!meta) return this.renderEmpty(now, phase, hold);
    if (dup) return this.renderDuplicate(now, phase, hold);
    // 分层模式(供网页把「背景 / GIF 宠物 / 文字层」拆开叠放,层序与设备一致):
    //   only='scene'  只画背景场景(不画宠物、不画文字层)—— 最底层
    //   only='chrome' 透明底,只画顶部信息带 + 名字带 + 状态角标 —— 最顶层
    //   skipPet       画背景与文字层,但留空宠物区(宠物由外层 <img> GIF 叠加)
    const only = (opts && opts.only) || null;
    const sceneOnly = only === 'scene';
    const chromeOnly = only === 'chrome';
    const skipPet = !!(opts && opts.skipPet) || sceneOnly || chromeOnly;
    const ctx = this.ctx;
    // 成长由「当前进化形态 + 累计 token」派生(形态决定等级/兜底体型,token 决定形态内进度)
    const _tok = (typeof meta.tokens === 'number' && meta.tokens >= 0) ? meta.tokens : 0;
    const g = Ev.growth(meta.form, _tok, meta.species);
    const st = STATUS[meta.status] ? meta.status : 'running';
    const smeta = STATUS[st];
    // 当前美工:优先持久化的 artSet;缺失/无效则取该状态默认美工(idle 优先)
    let art = ArtSets.get(meta.form, meta.artSet);
    if (!art) art = ArtSets.defaultArt(meta.form, st);
    const cfg = { phase: phase, w: SIZE, h: SIZE };

    if (chromeOnly) {
      ctx.clearRect(0, 0, SIZE, SIZE); // 透明底,仅叠文字层
    } else {
      drawBackground(ctx);
      Bg.drawBack(ctx, this.bg, cfg);
    }

    // 宠物本体:优先真实 GIF 当前帧;缺失或浏览器端(skipPet)则程序化兜底。
    if (!skipPet) {
      let drew = false;
      if (art && Gif && Gif.available()) {
        const fr = Gif.frameAt(meta.species, art.file, now);
        if (fr) {
          const prevSmooth = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(fr, 0, 0, SIZE, SIZE);
          ctx.imageSmoothingEnabled = prevSmooth;
          drew = true;
        }
      }
      if (!drew) {
        // 程序化兜底(GIF 不可用):美工 id 映射 behavior,脚固定在地面基线
        const behavior = (art && ART_BEHAVIOR[art.id]) || smeta.behavior;
        const unit = BASE_UNIT * g.scale;
        const cy = GROUND_Y - Art.footOffset(meta.species, g, unit);
        Art.drawPet(ctx, {
          species: meta.species,
          growth: g,
          behavior: behavior,
          variant: g.variant,
          phase: phase,
          cx: CX, cy: cy,
          unit: unit,
        });
      }
    }

    // 前景层(盖在宠物之上,UI 文字之下)
    if (!chromeOnly) Bg.drawFront(ctx, this.bg, cfg);
    if (sceneOnly) return this.canvas.toDataURL(); // 背景层到此为止(文字/宠物不画)

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
    const isDemoPet = meta.location === 'demo' || (meta.key && meta.key.indexOf('demo:') === 0);
    drawAgentIcon(ctx, MARGIN_L + iconSize / 2, headY - 4, iconSize, isDemoPet ? 'Demo' : meta.agent);
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
    ctx.fillText((function (s) { s = String(s || ''); return s.length <= 6 ? s : s.slice(-6); })(meta.sid), sidX, headY);
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

    // ---- 底部信息带:物种 · 宠物名 · 等级 ----
    const bScrim = ctx.createLinearGradient(0, SIZE - 26, 0, SIZE);
    bScrim.addColorStop(0, 'rgba(9,10,13,0)');
    bScrim.addColorStop(1, 'rgba(9,10,13,0.82)');
    ctx.fillStyle = bScrim;
    ctx.fillRect(0, SIZE - 26, SIZE, 26);

    // 等级由软件端权威下发(meta.level);缺失时(旧数据/离线)本地兜底走同一 levelOf。
    let level = (typeof meta.level === 'number') ? meta.level : Ev.levelOf(g.form || meta.form, _tok, meta.species);
    const species = Ev.formName(g.form || meta.form, this.lang) || (meta.species || '');
    const petName = meta.petName || meta.agent || 'Pet';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
    ctx.font = `600 11px 'Source Han Sans SC', system-ui, sans-serif`;
    // 组合行:名字亮、物种/等级次亮;超宽时对名字做截断
    const lvStr = ' · Lv' + level;
    const spStr = species ? (species + ' · ') : '';
    const maxW = SIZE - 16;
    let nm = petName;
    while (nm.length > 1 && ctx.measureText(spStr + nm + lvStr).width > maxW) nm = nm.slice(0, -1);
    if (nm !== petName) nm += '…';
    const full = spStr + nm + lvStr;
    const totalW = ctx.measureText(full).width;
    let x = CX - totalW / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa3b0';
    ctx.fillText(spStr, x, SIZE - 8); x += ctx.measureText(spStr).width;
    ctx.fillStyle = '#eef2f7';
    ctx.fillText(nm, x, SIZE - 8); x += ctx.measureText(nm).width;
    // 满级(已达终态、无法再进化)等级显示为红色,否则绿色。
    ctx.fillStyle = g.isMax ? '#e5544b' : '#7fd39a';
    ctx.fillText(lvStr, x, SIZE - 8);
    ctx.restore();

    // ---- 统一会话状态提示(文字带以下、宠物右上侧):waiting=红色感叹号 / completed=zzZ ----
    // 与左上角彩色状态徽标同义,构成双重提示(颜色 + 符号)。
    this.drawStatusHint(ctx, st, phase);

    // ---- 断开连接标记(叠加在已渲染的「最后已知状态」之上,不改动其内容) ----
    if (meta.disconnected) this.drawDisconnected(ctx, phase);

    // ---- 长按删除进度环(满 0.5s 才显示) ----
    const _h = this._holdView(now, hold);
    if (_h.visible) this.drawHoldRing(ctx, _h.progress);

    return this.canvas.toDataURL();
  };

  // 断开连接叠加层:在「最后已知状态」之上加离线提示,不覆盖头/名信息带。
  PetView.prototype.drawDisconnected = function (ctx, phase) {
    const AMBER = '#e5a13a';
    const pulse = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(phase * 3));
    ctx.save();
    // (1) 仅对宠物本体区域做冷色压暗(头部信息带 y<20、底部名带 y>SIZE-26 保持清晰)
    ctx.fillStyle = 'rgba(18,22,30,0.34)';
    ctx.fillRect(0, 20, SIZE, SIZE - 26 - 20);
    // (2) 琥珀色内缩边框:整键离线信号
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 3;
    roundRect(ctx, 3, 3, SIZE - 6, SIZE - 6, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // (3) 右上角琥珀胶囊:断链图标 + 短标签
    const label = this.lang === 'zh' ? '离线' : 'OFF';
    ctx.save();
    ctx.font = `700 9px 'Source Han Sans SC', system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    const padX = 5, gap = 4, iconW = 9;
    const pillH = 15;
    const pillW = padX + iconW + gap + tw + padX;
    const px = SIZE - 4 - pillW;
    const py = 3;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
    ctx.fillStyle = AMBER;
    roundRect(ctx, px, py, pillW, pillH, pillH / 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 断链图标(两段圆角短杠 + 断口斜线)
    const ix = px + padX, iy = py + pillH / 2;
    ctx.strokeStyle = '#1a1205'; ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ix, iy + 2.5); ctx.lineTo(ix + 3, iy - 0.5);
    ctx.moveTo(ix + iconW - 3, iy + 0.5); ctx.lineTo(ix + iconW, iy - 2.5);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ix + iconW / 2 - 2, iy - 3.5); ctx.lineTo(ix + iconW / 2 + 2, iy + 3.5);
    ctx.stroke();
    // 标签
    ctx.fillStyle = '#1a1205';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, ix + iconW + gap, iy + 0.5);
    ctx.restore();
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
    ctx.fillText(Math.ceil((1 - p) * (HOLD_DELETE_MS / 1000)) + '', 0, 1);
    ctx.font = `11px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(this.lang === 'zh' ? '松手取消' : 'release', 0, 20);
    ctx.restore();
  };

  window.PetView = PetView;
})();
