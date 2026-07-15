/**
 * 主服务:Agent Pets(Coordinator + 显示槽位)
 * ----------------------------------------------------------------------------
 * - 全局单例 Coordinator 维护「宠物池」(Demo 每 10 分钟生成一只),统一维护所有
 *   宠物的 meta(agent/session/对话/运行时长/token/类型/状态)。
 * - 每个按键持有一个 PetView,只保存一个 slot 索引;渲染时从 Coordinator 取该
 *   slot 的 meta 快照画出图标。多个按键可指向同一 slot,显示同一只宠物。
 * - 手势(仅 KeyDown/KeyUp):短按暂不处理(预留跳转 Agent);长按 0.5s 起显示倒计时,满 2s 删除当前 Pet。
 * - 宠物池写入「全局设置」,供 PI(配置面板)读取并列出可选槽位。
 */
const Coord = window.PetCoordinator;
const VIEWS = {};

const PLUGIN_UUID = 'com.ulanzi.ulanzistudio.tokenpet';
const FPS = 2;                 // 统一 2fps 推送,降低编码/传输开销与设备刷新排队
const SAVE_EVERY_MS = 8000;    // 全局池持久化间隔
const CLICK_MAX_MS = 400;      // 短按阈值

const RECONNECT_MIN_MS = 1000; // 断链重连起始退避
const RECONNECT_MAX_MS = 15000;// 断链重连最大退避

let lastFrame = 0;
let lastSave = 0;
let loopStarted = false;       // 循环单例守卫:重连会再次触发 onConnected,防止叠加多个 setInterval
let reconnectTimer = null;
let reconnectDelay = 0;

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => {
  reconnectDelay = 0;         // 连接成功,重置退避
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } // 取消可能残留的重连,避免误关健康连接
  Coord.init(nowMs());        // 池已在内存则不重建(init 内部按 occupancy 判空)
  $UD.getGlobalSettings();    // 尝试恢复/刷新已保存的宠物池
  startLoop();                // 幂等:已启动则跳过
  for (const c in VIEWS) pushIcon(VIEWS[c]); // 重连后立即重绘,尽快追平设备画面
});

// Studio 重启/断链:官方 SDK 无自动重连,这里指数退避重连以恢复推送。
// 否则渲染循环(Web Worker 计时器)仍在跑,但 send 发往已死 socket,设备画面会冻结在最后一帧。
$UD.onClose(() => scheduleReconnect());

function scheduleReconnect() {
  if (reconnectTimer) return; // 已在等待重连
  const rs = $UD.websocket && $UD.websocket.readyState;
  if (rs === 0 || rs === 1) return; // CONNECTING/OPEN:无需重连(避免与进行中的连接互相打断)
  reconnectDelay = Math.min(reconnectDelay ? reconnectDelay * 2 : RECONNECT_MIN_MS, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    $UD.connect(PLUGIN_UUID); // 重建 websocket;成功后 onopen -> CONNECTED -> onConnected 恢复推送
  }, reconnectDelay);
}

// websocket 是否处于可发送状态(OPEN=1);断链/重连中跳过发送,避免 InvalidStateError 与无效帧
function socketReady() {
  return !!($UD.websocket && $UD.websocket.readyState === 1);
}

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
    view.bg = randomBg(context);
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

// 背景随机:在「同屏其它按键未使用」的集合里随机选取,保证同屏尽量不重复;
// 若该集合为空(按键数超过主题数,无法避免重复),再从全部主题里完整随机。
function bgsInUse(exceptContext) {
  const used = {};
  for (const c in VIEWS) {
    if (c === exceptContext) continue;
    used[VIEWS[c].bg] = true;
  }
  return used;
}
function randomBg(exceptContext) {
  const all = window.PetBackgrounds.themes.filter((t) => t !== 'none');
  if (all.length === 0) return 'none';
  const used = bgsInUse(exceptContext);
  const free = all.filter((t) => !used[t]);
  const pool = free.length ? free : all; // 无不重复集合则完整随机
  return pool[Math.floor(Math.random() * pool.length)];
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

// ---- 手势(只用 KeyDown / KeyUp,不使用 onRun)----
// 短按(< 0.5s):暂不处理,预留未来「跳转到该 Agent」语义。
// 长按 0.5s 起显示倒计时框;满 2s 删除当前 Pet(在主循环中触发,单只、不影响其它)。
// 处于倒计时中松手(0.5s~2s):视为取消,不删除。
$UD.onKeyDown((jsn) => {
  const view = VIEWS[jsn.context];
  if (view) view.beginHold(nowMs());
});

$UD.onKeyUp((jsn) => {
  const view = VIEWS[jsn.context];
  if (!view) return;
  view.endHold();
  // 短按:预留未来「跳转到该 Agent」,当前不做任何处理。
  // 倒计时中松手 / 满 2s 删除均无需在此处理(删除已在主循环触发)。
  pushIcon(view); // 重绘以清除可能残留的倒计时环
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
  if (loopStarted) return; // 幂等:重连再次触发 onConnected 时不再叠加循环
  loopStarted = true;
  lastFrame = nowMs();
  lastSave = nowMs();
  setInterval(() => {
    const now = nowMs();
    const dt = (now - lastFrame) / 1000;
    lastFrame = now; // 始终推进,断链恢复时避免一次性巨大 dt 跳变
    const phase = now / 1000;

    // 断链/重连中:跳过本帧(计时器在 Web Worker 里仍会跑,但发送无意义)
    if (!socketReady()) return;

    // 长按满 2 秒 -> 删除该按键当前槽位的单只 Pet(仅置空该槽,不影响其它)
    const contexts = Object.keys(VIEWS);
    for (let i = 0; i < contexts.length; i++) {
      const v = VIEWS[contexts[i]];
      if (v.holdStart && v.holdProgress(now) >= 1) {
        Coord.removeAt(v.slot);
        v.endHold();
      }
    }
    Coord.tick(now, dt); // 推进宠物池(生成/成长/状态切换)

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
  if (!socketReady()) return; // 断链/重连中不发送,避免 InvalidStateError
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
