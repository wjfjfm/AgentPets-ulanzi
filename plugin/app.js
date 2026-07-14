/**
 * 主服务:Agent Pets(Coordinator + 显示槽位)
 * ----------------------------------------------------------------------------
 * - 全局单例 Coordinator 维护「宠物池」(Demo 每 10 分钟生成一只),统一维护所有
 *   宠物的 meta(agent/session/对话/运行时长/token/类型/状态)。
 * - 每个按键持有一个 PetView,只保存一个 slot 索引;渲染时从 Coordinator 取该
 *   slot 的 meta 快照画出图标。多个按键可指向同一 slot,显示同一只宠物。
 * - 手势:短按 = 切换到下一个槽位(浏览池中宠物);长按 3 秒 = 重置 demo 宠物池。
 * - 宠物池写入「全局设置」,供 PI(配置面板)读取并列出可选槽位。
 */
const Coord = window.PetCoordinator;
const VIEWS = {};

const FPS = 6;                 // 每秒推送帧数
const SAVE_EVERY_MS = 8000;    // 全局池持久化间隔
const CLICK_MAX_MS = 400;      // 短按阈值

let lastFrame = 0;
let lastSave = 0;

$UD.connect('com.ulanzi.ulanzistudio.tokenpet');

$UD.onConnected(() => {
  Coord.init(nowMs());
  $UD.getGlobalSettings();  // 尝试恢复已保存的宠物池
  startLoop();
});

// 恢复全局宠物池
$UD.onDidReceiveGlobalSettings((jsn) => {
  const data = jsn && (jsn.settings || jsn.param);
  if (data && Coord.restore(data, nowMs())) {
    for (const c in VIEWS) pushIcon(VIEWS[c]);
  }
});

// 配置到按键
$UD.onAdd((jsn) => {
  const context = jsn.context;
  let isNew = false;
  if (!VIEWS[context]) {
    const view = new PetView(context);
    view.setLang($UD.language);
    // 新拖入的按键:默认指向最小的未用槽位 + 随机一个背景
    view.slot = firstUnusedSlot(context);
    view.bg = randomBg();
    VIEWS[context] = view;
    isNew = true;
  }
  const view = VIEWS[context];
  if (jsn.param) view.applySettings(jsn.param); // 已保存配置覆盖默认
  if (isNew) save(view);                          // 持久化默认分配
  $UD.getSettings(context); // 拉取该按键已保存的 slot/bg
});

// 最小的、当前未被其它按键占用的槽位
function firstUnusedSlot(exceptContext) {
  const used = {};
  for (const c in VIEWS) {
    if (c === exceptContext) continue;
    used[VIEWS[c].slot] = true;
  }
  let s = 0;
  while (used[s]) s++;
  return s;
}

// 随机背景(排除“无”)
function randomBg() {
  const list = window.PetBackgrounds.themes.filter((t) => t !== 'none');
  return list[Math.floor(Math.random() * list.length)] || 'none';
}

// 上位机回传该按键已保存参数(slot)
$UD.onDidReceiveSettings((jsn) => {
  const view = VIEWS[jsn.context];
  if (view && jsn.param) { view.applySettings(jsn.param); pushIcon(view); }
});

// 活跃状态
$UD.onSetActive((jsn) => {
  const view = VIEWS[jsn.context];
  if (view && jsn.active && jsn.active.toString() === 'true') pushIcon(view);
});

// PI 修改了 slot
$UD.onParamFromApp((jsn) => applyParam(jsn));
$UD.onParamFromPlugin((jsn) => applyParam(jsn));

function applyParam(jsn) {
  const view = VIEWS[jsn.context];
  if (!view || !jsn.param) return;
  view.applySettings(jsn.param);
  save(view);
  pushIcon(view);
}

// PI 请求当前宠物池摘要(用于列出槽位)
$UD.onSendToPlugin((jsn) => {
  const p = jsn && jsn.payload;
  if (p && p.type === 'getPool') {
    $UD.sendToPropertyInspector({ type: 'pool', pool: Coord.summaries(nowMs()) }, jsn.context);
  }
});

// ---- 手势:短按切槽 / 长按重置池 ----
$UD.onKeyDown((jsn) => {
  const view = VIEWS[jsn.context];
  if (view) view.beginHold(nowMs());
});

$UD.onKeyUp((jsn) => {
  const view = VIEWS[jsn.context];
  if (!view) return;
  const held = nowMs() - view.holdStart;
  view.endHold();
  if (held >= view.HOLD_RESET_MS) {
    // 已在循环中触发重置
  } else {
    // 短按:切换到下一个槽位(在池范围内循环)
    const n = Coord.slotCount();
    if (n > 0) view.slot = (view.slot + 1) % n;
    save(view);
  }
  pushIcon(view);
});

// 移除配置
$UD.onClear((jsn) => {
  if (!jsn.param) return;
  for (let i = 0; i < jsn.param.length; i++) {
    delete VIEWS[jsn.param[i].context];
  }
});

// ---- 渲染主循环 ----
function startLoop() {
  lastFrame = nowMs();
  lastSave = nowMs();
  setInterval(() => {
    const now = nowMs();
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    const phase = now / 1000;

    // 长按满 3 秒 -> 重置整个 demo 宠物池
    let resetTriggered = false;
    const contexts = Object.keys(VIEWS);
    for (let i = 0; i < contexts.length; i++) {
      const v = VIEWS[contexts[i]];
      if (v.holdStart && v.holdProgress(now) >= 1) { resetTriggered = true; break; }
    }
    if (resetTriggered) {
      Coord.reset(now);
      for (let i = 0; i < contexts.length; i++) VIEWS[contexts[i]].endHold();
    } else {
      Coord.tick(now, dt); // 推进宠物池(生成/成长/状态切换)
    }

    // 池结构变化(生成新宠物/重置) -> 持久化到全局设置,让 PI 能看到
    if (Coord.dirty) { Coord.dirty = false; saveGlobal(); }

    for (let i = 0; i < contexts.length; i++) {
      pushIcon(VIEWS[contexts[i]], phase);
    }

    // 周期持久化(成长进度)
    if (now - lastSave >= SAVE_EVERY_MS) {
      lastSave = now;
      saveGlobal();
      for (let i = 0; i < contexts.length; i++) save(VIEWS[contexts[i]]);
    }
  }, Math.round(1000 / FPS));
}

function pushIcon(view, phase) {
  const p = phase != null ? phase : nowMs() / 1000;
  const meta = Coord.get(view.slot);
  const data = view.render(meta, nowMs(), p);
  $UD.setBaseDataIcon(view.context, data, '');
}

function save(view) {
  $UD.setSettings(view.serialize(), view.context);
}

function saveGlobal() {
  $UD.setGlobalSettings(Coord.serialize());
}

function nowMs() { return Date.now(); }
