/**
 * PetSummaryView —— Overview(全局总览)按键上的「实时总览仪表盘」。
 * ----------------------------------------------------------------------------
 * render(model, now) -> dataURL(144x144)
 *   model = {
 *     slots:   [ 'running'|'waiting'|'completed'|null, ... ]  // 按 slot 序号,null=空洞
 *     sources: [ { agent, location, enabled, ok, error, petCount }, ... ]
 *   }
 *
 * 布局:
 *   - 顶部:PETS + 占用数;右侧三态计数(绿/橙/蓝)
 *   - 中部:GitHub activity 风格「豆豆」网格,每格一个 slot,颜色表状态,每行 10 个
 *   - 底部:各数据源 + 对应宠物数(色块 + 名称 + 计数)
 */
(function () {
  const SIZE = 144;
  const FONT = "'Source Han Sans SC', system-ui, sans-serif";
  const PAD = 13;                 // 向中心聚拢:避开设备边缘不可见区域

  const STATUS_COLOR = {
    running: '#37c057',
    waiting: '#f0a83a',
    completed: '#4a9df0',
  };
  const EMPTY_COLOR = '#565d69';
  const AGENT_COLOR = { Codex: '#10a37f', Claude: '#d97757', Qoder: '#8b5cf6', Pi: '#ec6a5e', Kimi: '#12b5a5', Demo: '#5a6675' };

  const PER_ROW = 10;
  const HALF = 5;                 // 每 5 个一组
  const GROUP_GAP = 5;            // 第 5、6 个之间的分组空隙(px),便于定位 6-10
  const MAX_ROWS = 10;            // 豆点优先:最多 10 行(100 格)
  const MAX_SLOTS = PER_ROW * MAX_ROWS;
  const HOLD_SHOW_MS = 500;       // 长按 0.5s 起显示进度环
  const HOLD_ACTION_MS = 1500;    // 长按满 1.5s 触发自动重排(顺序不变,填充空位)
  const ACTIVATE_SUPPRESS_MS = 500; // 翻页激活后 0.5s 内的 keyup 视为翻页残留,不触发单击

  function SummaryView(context) {
    this.context = context;
    this.page = 0; // 0=豆豆主屏, 1=数据源详情屏(单击切换)
    this.holdStart = 0; // 长按起始时刻(0=未按住)
    this.activatedAt = 0; // 最近一次因翻页/激活(setactive)而显现的时刻,用于过滤翻页误触
    this.lang = 'zh';
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d');
  }

  SummaryView.prototype.togglePage = function () {
    this.page = this.page ? 0 : 1;
  };

  SummaryView.prototype.setLang = function (ln) {
    this.lang = (ln && ln.indexOf('zh') === 0) ? 'zh' : 'en';
  };

  // ---- 长按状态(自动重排手势)----
  SummaryView.prototype.beginHold = function (now) { this.holdStart = now; };
  SummaryView.prototype.endHold = function () { this.holdStart = 0; };
  SummaryView.prototype.heldMs = function (now) { return this.holdStart ? (now - this.holdStart) : 0; };
  SummaryView.prototype.holdProgress = function (now) {
    if (!this.holdStart) return 0;
    return Math.min(1, (now - this.holdStart) / HOLD_ACTION_MS);
  };
  SummaryView.prototype.holdVisible = function (now) {
    return this.holdStart > 0 && (now - this.holdStart) >= HOLD_SHOW_MS;
  };
  // ---- 翻页误触过滤 ----
  // 翻页时,触发翻页的那次物理按压会连带把 keydown/keyup 投递给刚显现的目标键,
  // 造成"单击"误触发。记录激活时刻,若 keyup 距激活过近则判定为翻页残留,忽略。
  SummaryView.prototype.markActive = function (now) { this.activatedAt = now; };
  SummaryView.prototype.justActivated = function (now) {
    return this.activatedAt > 0 && (now - this.activatedAt) < ACTIVATE_SUPPRESS_MS;
  };
  SummaryView.prototype.ACTIVATE_SUPPRESS_MS = ACTIVATE_SUPPRESS_MS;
  SummaryView.prototype.HOLD_SHOW_MS = HOLD_SHOW_MS;
  SummaryView.prototype.HOLD_ACTION_MS = HOLD_ACTION_MS;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
    bg.addColorStop(0, '#24262b');
    bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  function dot(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  SummaryView.prototype.render = function (model, now, hold) {
    if (this.page === 1) this.renderSourcesPage(model, now);
    else this.renderMain(model, now);
    const visible = (hold && typeof hold.progress === 'number') ? !!hold.visible : this.holdVisible(now);
    const progress = (hold && typeof hold.progress === 'number') ? hold.progress : this.holdProgress(now);
    if (visible) this.drawHoldRing(this.ctx, progress);
    return this.canvas.toDataURL();
  };

  // 长按自动重排进度环(绿色,建设性操作;区别于宠物键的红色删除环)
  SummaryView.prototype.drawHoldRing = function (ctx, p) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.translate(SIZE / 2, 62);
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#37c057';
    ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 22px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(Math.ceil((1 - p) * (HOLD_ACTION_MS / 1000)) + '', 0, 1);
    ctx.font = `600 12px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillText(this.lang === 'zh' ? '松手重排' : 'release to sort', 0, 44);
    ctx.font = `500 10px 'Source Han Sans SC', system-ui, sans-serif`;
    ctx.fillStyle = '#c6cdd9';
    ctx.fillText(this.lang === 'zh' ? '顺序不变 · 填充空位' : 'compact slots', 0, 62);
    ctx.restore();
  };

  SummaryView.prototype.renderMain = function (model, now) {
    const ctx = this.ctx;
    model = model || {};
    const slots = model.slots || [];
    const sources = model.sources || [];

    let running = 0, waiting = 0, completed = 0, occupied = 0;
    for (const s of slots) {
      if (!s) continue;
      occupied++;
      if (s === 'running') running++;
      else if (s === 'waiting') waiting++;
      else if (s === 'completed') completed++;
    }

    drawBackground(ctx);

    // ---- 顶部:PETS + 占用数 | 右侧三态计数 ----
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b93a1';
    ctx.font = `600 9px ${FONT}`;
    ctx.fillText('PETS', PAD, 15);
    ctx.fillStyle = '#eef2f7';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(String(occupied), PAD + 30, 16);

    // 右侧三态:completed / waiting / running(从右往左)
    const trio = [
      { c: STATUS_COLOR.running, n: running },
      { c: STATUS_COLOR.waiting, n: waiting },
      { c: STATUS_COLOR.completed, n: completed },
    ];
    ctx.font = `600 10px ${FONT}`;
    ctx.textBaseline = 'middle';
    let rx = SIZE - PAD;
    for (let i = 0; i < trio.length; i++) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#c6cdd9';
      ctx.fillText(String(trio[i].n), rx, 11);
      const nw = ctx.measureText(String(trio[i].n)).width;
      dot(ctx, rx - nw - 6, 11, 3.5, trio[i].c);
      rx -= nw + 6 + 3.5 * 2 + 8;
    }
    ctx.restore();

    // ---- 中部:slot 占用网格(GitHub 风格豆豆,豆点优先展示)----
    const gridTop = 25;
    // 仅显示到「最后一个被占用的槽位」为止(不为尾部空洞多画空行);至少一行
    let lastFilled = -1;
    for (let i = 0; i < slots.length; i++) { if (slots[i]) lastFilled = i; }
    let shown = Math.min(lastFilled + 1, MAX_SLOTS);
    const drawCount = Math.max(shown, PER_ROW);
    const rows = Math.max(1, Math.ceil(drawCount / PER_ROW));

    // 底部数据源按宠物数降序;间隔收窄,信息密度更高
    const srcSorted = sources.slice().sort((a, b) => (b.petCount || 0) - (a.petCount || 0));
    const srcLineH = 12;
    const dividerGap = 6;

    // 垂直分配:豆点优先占用,数据源用剩余空间
    const availV = SIZE - PAD - gridTop;
    const wantSrcLines = Math.min(srcSorted.length, 5);
    const srcReserve = wantSrcLines > 0 ? (wantSrcLines * srcLineH + dividerGap) : 0;
    let rowH = (availV - srcReserve) / rows;
    if (rowH > 12) rowH = 12;
    if (rowH < 8) rowH = 8;
    const gridH = rows * rowH;

    // 网格宽度扣掉一个分组空隙,使 5|6 之间留白
    const gridW = SIZE - PAD * 2 - GROUP_GAP;
    const cellW = gridW / PER_ROW;
    const cell = Math.min(cellW, rowH) * 0.66;   // 圆角方块边长
    const half = cell / 2;
    for (let i = 0; i < drawCount; i++) {
      const row = Math.floor(i / PER_ROW);
      const col = i % PER_ROW;
      const cx = PAD + col * cellW + cellW / 2 + (col >= HALF ? GROUP_GAP : 0);
      const cy = gridTop + row * rowH + rowH / 2;
      const st = (i < slots.length) ? slots[i] : null;
      const color = st ? (STATUS_COLOR[st] || EMPTY_COLOR) : EMPTY_COLOR;
      roundRect(ctx, cx - half, cy - half, cell, cell, 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // 若超出显示上限,右上角提示 +N
    if (lastFilled + 1 > MAX_SLOTS) {
      ctx.save();
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#6d7683'; ctx.font = `500 8px ${FONT}`;
      ctx.fillText('+' + (lastFilled + 1 - MAX_SLOTS), SIZE - PAD, gridTop + gridH - 1);
      ctx.restore();
    }

    // 分隔线
    let y = gridTop + gridH + dividerGap / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke();
    ctx.restore();
    y += dividerGap / 2;

    // ---- 底部:数据源(按宠物数降序)+ 对应宠物数 ----
    const srcSpace = SIZE - PAD - y;
    const maxLines = Math.max(0, Math.floor(srcSpace / srcLineH));
    const list = srcSorted.slice(0, maxLines);
    ctx.save();
    ctx.textBaseline = 'middle';
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const cy = y + srcLineH / 2 + i * srcLineH;
      const col = AGENT_COLOR[s.agent] || '#8b93a1';
      // 色块
      roundRect(ctx, PAD, cy - 3.5, 7, 7, 2);
      ctx.fillStyle = s.enabled ? col : '#3a3d44';
      ctx.fill();
      // 名称
      const label = (s.agent === 'Demo') ? 'Demo' : ((s.agent || 'Src') + '·' + (s.location || ''));
      ctx.textAlign = 'left';
      ctx.font = `500 10px ${FONT}`;
      ctx.fillStyle = s.enabled ? '#c6cdd9' : '#6d7683';
      ctx.fillText(label, PAD + 12, cy);
      // 右侧:计数 / 错误 / off
      ctx.textAlign = 'right';
      if (!s.enabled) {
        ctx.fillStyle = '#6d7683'; ctx.font = `500 9px ${FONT}`;
        ctx.fillText('off', SIZE - PAD, cy);
      } else if (s.error) {
        ctx.fillStyle = '#e5544b'; ctx.font = `600 10px ${FONT}`;
        ctx.fillText('!', SIZE - PAD, cy);
      } else {
        // 大字宠物数(主) + 小字会话数(次,'s' 后缀);排序已按宠物数降序
        const pc = String(s.petCount || 0);
        ctx.fillStyle = '#eef2f7'; ctx.font = `700 12px ${FONT}`;
        ctx.fillText(pc, SIZE - PAD, cy);
        const pcw = ctx.measureText(pc).width;
        ctx.fillStyle = '#7a828e'; ctx.font = `500 9px ${FONT}`;
        ctx.fillText((s.count || 0) + 's', SIZE - PAD - pcw - 5, cy);
      }
    }
    if (srcSorted.length > maxLines) {
      const cy = y + srcLineH / 2 + maxLines * srcLineH;
      if (cy < SIZE - 2) {
        ctx.textAlign = 'left'; ctx.fillStyle = '#6d7683'; ctx.font = `500 9px ${FONT}`;
        ctx.fillText('+' + (srcSorted.length - maxLines) + ' more', PAD + 12, cy);
      }
    }
    ctx.restore();


    return this.canvas.toDataURL();
  };

  // 单击切换到的「数据源详情屏」:全屏列出所有源,超出一屏则上下自动滚动
  SummaryView.prototype.renderSourcesPage = function (model, now) {
    const ctx = this.ctx;
    model = model || {};
    const sources = (model.sources || []).slice()
      .sort((a, b) => (b.petCount || 0) - (a.petCount || 0));

    drawBackground(ctx);

    // 顶部标题 + 右侧宠物总数
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b93a1';
    ctx.font = `600 9px ${FONT}`;
    ctx.fillText('DATA SOURCES', PAD, 15);
    let totalPets = 0;
    for (const s of sources) totalPets += (s.petCount || 0);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c6cdd9';
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(String(totalPets), SIZE - PAD, 16);
    ctx.restore();

    // 分隔线
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, 21); ctx.lineTo(SIZE - PAD, 21); ctx.stroke();
    ctx.restore();

    const vpTop = 22;
    const vpBottom = SIZE - 4;
    const vpH = vpBottom - vpTop;
    const rowH = 15;
    const n = Math.max(sources.length, 1);
    const contentH = n * rowH;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, vpTop, SIZE, vpH); ctx.clip();

    const scroll = contentH > vpH;
    let offset = 0;
    if (scroll) {
      const pad = rowH;               // 循环之间留一段空隙,视觉停顿
      const loop = contentH + pad;
      offset = (now * 0.012) % loop;  // ≈12px/s
      // 无源时不滚动
      for (let c = 0; c < 2; c++) {
        const base = vpTop - offset + c * loop;
        for (let i = 0; i < sources.length; i++) {
          const cy = base + i * rowH + rowH / 2;
          if (cy < vpTop - rowH || cy > vpBottom + rowH) continue;
          this._srcRow(ctx, sources[i], cy);
        }
      }
    } else {
      // 一屏放得下:垂直居中
      const base = vpTop + (vpH - contentH) / 2;
      for (let i = 0; i < sources.length; i++) {
        this._srcRow(ctx, sources[i], base + i * rowH + rowH / 2);
      }
      if (!sources.length) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#6d7683'; ctx.font = `500 11px ${FONT}`;
        ctx.fillText('No sources', SIZE / 2, (vpTop + vpBottom) / 2);
      }
    }
    ctx.restore();

    return this.canvas.toDataURL();
  };

  SummaryView.prototype._srcRow = function (ctx, s, cy) {
    const col = AGENT_COLOR[s.agent] || '#8b93a1';
    // 色块
    roundRect(ctx, PAD, cy - 4, 8, 8, 2);
    ctx.fillStyle = s.enabled ? col : '#3a3d44';
    ctx.fill();
    // 名称(裁剪,避免与右侧数字重叠)
    const label = (s.agent === 'Demo') ? 'Demo' : ((s.agent || 'Src') + '·' + (s.location || ''));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = s.enabled ? '#e8edf4' : '#6d7683';
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD + 13, cy - 8, SIZE - PAD - 13 - 46, 16); ctx.clip();
    ctx.fillText(label, PAD + 13, cy);
    ctx.restore();
    // 右侧:宠物数(粗) + 会话数(灰,小)/ off / err
    ctx.textAlign = 'right';
    if (!s.enabled) {
      ctx.fillStyle = '#6d7683'; ctx.font = `600 10px ${FONT}`;
      ctx.fillText('off', SIZE - PAD, cy);
    } else if (s.error) {
      ctx.fillStyle = '#e5544b'; ctx.font = `600 10px ${FONT}`;
      ctx.fillText('err', SIZE - PAD, cy);
    } else {
      const pc = String(s.petCount || 0);
      ctx.fillStyle = '#eef2f7'; ctx.font = `700 12px ${FONT}`;
      ctx.fillText(pc, SIZE - PAD, cy);
      const pcw = ctx.measureText(pc).width;
      ctx.fillStyle = '#7a828e'; ctx.font = `500 9px ${FONT}`;
      ctx.fillText((s.count || 0) + 's', SIZE - PAD - pcw - 5, cy);
    }
  };

  window.PetSummaryView = SummaryView;
})();
