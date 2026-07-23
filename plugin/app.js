/**
 * 主服务(Node 运行时):Agent Pets —— 瘦代理(仅展示 + 槽位 + 手势)
 * ----------------------------------------------------------------------------
 * 由 UlanziStudio 用自带 Node 运行时启动(CodePath=plugin/app.js);连接参数从
 * process.argv[2..4] = address/port/language 传入(由 vendored SDK 处理)。
 *
 * 架构:所有「宠物相关逻辑」——渲染、背景、仪表盘、等级、进化、美工组——都在独立的
 * AgentPets 软件里。本插件退化为纯代理,只做四件事:
 *   1) 按键注册 + 每键唯一设置「槽位 slot」(设备布局,非宠物逻辑);
 *   2) 每帧向软件 HTTP 取图(POST /api/frames)→ setBaseDataIcon 推送到设备;
 *   3) 单击 / 长按手势:单击开网页(宠物页 / 主页)或启动软件,长按触发删除 / 重排;
 *   4) 软件不可达时推静态「未连接」占位图。
 * 插件不加载任何渲染模块、不依赖 canvas、不懂宠物数据。
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { createRequire } from 'module';
import UlanziApi from './lib/ulanzi-api/index.js';

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url)); // <root>/plugin
const ROOT = dirname(PLUGIN_DIR);                            // 插件根目录

// 轻量日志(仅诊断,不涉宠物逻辑)。log.js 是浏览器风格 IIFE,需先备好 window。
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(join(PLUGIN_DIR, 'actions', 'log.js')); // 写 window.PetLog
const Log = window.PetLog || { info() {}, warn() {}, error() {}, debug() {} };

process.on('uncaughtException', (e) => { try { Log.error('uncaughtException', (e && e.stack) || String(e)); } catch (_) {} });
process.on('unhandledRejection', (e) => { try { Log.error('unhandledRejection', (e && e.stack) || String(e)); } catch (_) {} });

const $UD = new UlanziApi();

// action UUID:据 jsn.uuid 区分按键属于哪个 action(jsn.actionid 是每键随机 GUID,不能用于分流)
const PET_ACTION = 'com.ulanzi.ulanzistudio.tokenpet.pet';
const SETTINGS_ACTION = 'com.ulanzi.ulanzistudio.tokenpet.settings';
const PLUGIN_UUID = 'com.ulanzi.ulanzistudio.tokenpet';

// ---- 离线占位图(软件不可达时推送;读静态 PNG 转 dataURL,无需 canvas)----
let OFFLINE_DATAURL = null;
try {
  const buf = readFileSync(join(ROOT, 'assets', 'icons', 'offline.png'));
  OFFLINE_DATAURL = 'data:image/png;base64,' + buf.toString('base64');
} catch (e) { Log.warn('offline.png 读取失败', String(e && e.message || e)); }

// ============================================================================
// 按键注册表:context -> { type:'pet'|'settings', slot, hold, key }
//   slot:该 pet 键显示池中的第几只(唯一的每键设置);
//   hold:长按手势状态(本地实时判定,随帧下发给软件画环);
//   key :软件回传的该槽位宠物 key(供单击/长按手势用)。
// ============================================================================
const KEYS = {};

// 手势阈值(本地判定;渲染在软件端)
const PET_HOLD_SHOW_MS = 250;      // 快速点击 < 此值 = 单击;≥ 显示删除环
const PET_HOLD_DELETE_MS = 1000;   // 长按满 1s 删除
const SET_HOLD_SHOW_MS = 500;      // settings 单击阈值
const SET_HOLD_ACTION_MS = 1500;   // settings 长按满 1.5s 重排
const ACTIVATE_SUPPRESS_MS = 500;  // 翻页激活 0.5s 内的 keyup 视为翻页误触

// ============================================================================
// ApiClient —— 连接 AgentPets 软件(本机 HTTP)
// 端口发现:软件启动后写 ~/.agentpets/server.json {port,pid,app};读失败/请求失败
// 退避重试;软件重启换端口后 poll 失败会重新 locate。
// ============================================================================
const AGENTPETS_HOME = process.env.AGENTPETS_HOME || join(homedir(), '.agentpets');
const SERVER_FILE = join(AGENTPETS_HOME, 'server.json');
let baseUrl = null;
let online = false;      // 最近一次帧请求是否成功
let wasOffline = true;

function locate() {
  try {
    const info = JSON.parse(readFileSync(SERVER_FILE, 'utf8'));
    if (info && info.port) { baseUrl = 'http://127.0.0.1:' + info.port; return true; }
  } catch (_) {}
  baseUrl = null;
  return false;
}

function noteOnline(ok) {
  online = ok;
  if (ok === !wasOffline) return;
  wasOffline = !ok;
  if (ok) Log.info('AgentPets 在线', baseUrl);
  else Log.warn('AgentPets 离线');
}

// 取一批按键的渲染帧;失败返回 null(离线)
async function fetchFrames(keys) {
  if (!baseUrl && !locate()) { noteOnline(false); return null; }
  try {
    const r = await fetch(baseUrl + '/api/frames', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys }),
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    noteOnline(true);
    return data && data.frames;
  } catch (e) {
    baseUrl = null; noteOnline(false);
    return null;
  }
}

// 提交一个变更动作(deletePet / compact 等)
async function act(type, payload) {
  if (!baseUrl && !locate()) return false;
  try {
    const r = await fetch(baseUrl + '/api/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ type: type }, payload || {})),
    });
    return r.ok;
  } catch (e) { baseUrl = null; return false; }
}

// 启动软件(离线时单击行为):优先用 server.json 记录的 .app 路径,否则按名启动
function launchApp() {
  const { execFile } = require('child_process');
  let appPath = null;
  try { const info = JSON.parse(readFileSync(SERVER_FILE, 'utf8')); appPath = info && info.app; } catch (_) {}
  const done = (e) => { if (e) Log.warn('launchApp failed', String((e && e.message) || e)); };
  if (appPath) { Log.info('launchApp', appPath); execFile('open', [appPath], done); }
  else { Log.info('launchApp by name', 'AgentPets'); execFile('open', ['-a', 'AgentPets'], done); }
}

function homeUrl() { if (!baseUrl) locate(); return baseUrl; }

// ---- Ulanzi 连接 ----
const FPS = 2;
const HOLD_REFRESH_MS = 100;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15000;

let loopStarted = false;
let holdTimer = null;
let reconnectTimer = null;
let reconnectDelay = 0;
let lang = 'zh';

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => {
  lang = ($UD.language && $UD.language.indexOf('zh') === 0) ? 'zh' : (($UD.language) ? 'en' : 'zh');
  Log.info('onConnected', { readyState: $UD.websocket && $UD.websocket.readyState });
  reconnectDelay = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  startLoop();
  renderAll();
});

$UD.onClose(() => { Log.warn('ws close'); scheduleReconnect(); });
$UD.onError((err) => { Log.error('ws error', String(err)); });

function scheduleReconnect() {
  if (reconnectTimer) return;
  const rs = $UD.websocket && $UD.websocket.readyState;
  if (rs === 0 || rs === 1) return;
  reconnectDelay = Math.min(reconnectDelay ? reconnectDelay * 2 : RECONNECT_MIN_MS, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; $UD.connect(PLUGIN_UUID); }, reconnectDelay);
}
function socketReady() { return !!($UD.websocket && $UD.websocket.readyState === 1); }
function nowMs() { return Date.now(); }

// ---- 按键注册 ----
$UD.onAdd((jsn) => {
  const context = jsn.context;
  if (jsn.uuid === SETTINGS_ACTION) {
    if (!KEYS[context]) KEYS[context] = { type: 'settings', slot: 0, hold: null, key: null, activatedAt: 0 };
    renderKeys([context]);
    return;
  }
  // Agent Pet 键
  let isNew = false;
  if (!KEYS[context]) {
    KEYS[context] = { type: 'pet', slot: firstUnusedSlot(context), hold: null, key: null, activatedAt: 0 };
    isNew = true;
  }
  const k = KEYS[context];
  if (jsn.param && typeof jsn.param.slot === 'number' && jsn.param.slot >= 0) k.slot = Math.floor(jsn.param.slot);
  if (isNew) $UD.setSettings({ slot: k.slot }, context); // 持久化默认槽位
  $UD.getSettings(context);
  renderKeys([context]);
});

// 最小的、当前未被其它 pet 键占用的槽位
function firstUnusedSlot(exceptContext) {
  const used = {};
  for (const c in KEYS) { if (c === exceptContext) continue; if (KEYS[c].type === 'pet') used[KEYS[c].slot] = true; }
  let s = 0; while (used[s]) s++; return s;
}

// 上位机回传该按键已保存的 slot
$UD.onDidReceiveSettings((jsn) => {
  const k = KEYS[jsn.context];
  if (k && k.type === 'pet' && jsn.param && typeof jsn.param.slot === 'number' && jsn.param.slot >= 0) {
    k.slot = Math.floor(jsn.param.slot);
    renderKeys([jsn.context]);
  }
});

// PI 修改了 slot
$UD.onParamFromApp((jsn) => applyParam(jsn));
$UD.onParamFromPlugin((jsn) => applyParam(jsn));
function applyParam(jsn) {
  const k = KEYS[jsn.context];
  if (!k || k.type !== 'pet' || !jsn.param) return;
  if (typeof jsn.param.slot === 'number' && jsn.param.slot >= 0) { k.slot = Math.floor(jsn.param.slot); $UD.setSettings({ slot: k.slot }, jsn.context); }
  renderAll(); // slot 变化影响 dup 判定,整体重绘
}

// 活跃状态(翻页):记录激活时刻用于误触过滤 + 重绘
$UD.onSetActive((jsn) => {
  const active = jsn.active && jsn.active.toString() === 'true';
  if (!active) return;
  const k = KEYS[jsn.context];
  if (k) { k.activatedAt = nowMs(); renderKeys([jsn.context]); }
});

// PI 消息:settings 占位 PI 询问软件地址;pet PI 也可询问(自行直连软件取池)
$UD.onSendToPlugin((jsn) => {
  const p = jsn && jsn.payload;
  if (!p) return;
  if (p.type === 'getServerInfo') {
    if (!baseUrl) locate();
    $UD.sendToPropertyInspector({ type: 'serverInfo', url: baseUrl || null, offline: !online }, jsn.context);
    return;
  }
});

$UD.onClear((jsn) => {
  if (!jsn.param) return;
  for (let i = 0; i < jsn.param.length; i++) delete KEYS[jsn.param[i].context];
});

// ---- 手势 ----
$UD.onKeyDown((jsn) => {
  const k = KEYS[jsn.context];
  if (!k) return;
  k.hold = { start: nowMs() };
  startHoldTimer();
});

$UD.onKeyUp((jsn) => {
  const k = KEYS[jsn.context];
  if (!k) return;
  const now = nowMs();
  const hold = k.hold; k.hold = null;
  const held = hold ? (now - hold.start) : 0;
  const flipTouch = k.activatedAt > 0 && (now - k.activatedAt) < ACTIVATE_SUPPRESS_MS;
  const showMs = k.type === 'settings' ? SET_HOLD_SHOW_MS : PET_HOLD_SHOW_MS;
  // 单击:有配对 keydown、松手早于环出现、且非翻页误触
  if (hold && held < showMs) {
    if (flipTouch) Log.info('keyUp suppressed (page-flip touch)', { type: k.type, held });
    else handleSingleClick(k);
  }
  renderKeys([jsn.context]);
});

// 单击语义:软件未启动 -> 启动软件;已启动 -> settings 开主页、pet 开该宠物个人页
function handleSingleClick(k) {
  if (!online) { Log.info('single-click: 离线,启动软件'); launchApp(); return; }
  const url = homeUrl();
  if (!url) { launchApp(); return; }
  if (k.type === 'settings') { Log.info('single-click -> 主页', url); $UD.openUrl(url, false); return; }
  if (k.key) { const u = url + '/pet/?key=' + encodeURIComponent(k.key); Log.info('single-click -> 宠物页', u); $UD.openUrl(u, false); }
  else { $UD.openUrl(url, false); }
}

// 长按满阈值:pet 删除、settings 重排。返回是否仍有键在长按。
function processHolds(now) {
  let holding = false;
  for (const c in KEYS) {
    const k = KEYS[c];
    if (!k.hold) continue;
    const held = now - k.hold.start;
    const actionMs = k.type === 'settings' ? SET_HOLD_ACTION_MS : PET_HOLD_DELETE_MS;
    if (held >= actionMs) {
      if (k.type === 'pet') { if (k.key) act('deletePet', { key: k.key }); }
      else act('compact');
      k.hold = null;
    } else {
      holding = true;
    }
  }
  return holding;
}

// 计算某键的长按环状态(供帧请求下发软件画环)
function holdOf(k, now) {
  if (!k.hold) return null;
  const held = now - k.hold.start;
  const showMs = k.type === 'settings' ? SET_HOLD_SHOW_MS : PET_HOLD_SHOW_MS;
  const actionMs = k.type === 'settings' ? SET_HOLD_ACTION_MS : PET_HOLD_DELETE_MS;
  return { visible: held >= showMs, progress: Math.min(1, held / actionMs) };
}

// dup:多个 pet 键指向同一 slot 时,除最早注册者外为「重复占用」次要键(纯设备布局)
function isDupSecondary(context) {
  const k = KEYS[context];
  if (!k || k.type !== 'pet') return false;
  for (const c in KEYS) {
    if (KEYS[c].type === 'pet' && KEYS[c].slot === k.slot) return c !== context; // 第一个匹配即主键
  }
  return false;
}

// ---- 渲染:取图 + 推送 ----
function keyReq(context, now) {
  const k = KEYS[context];
  const req = { context: context, type: k.type, lang: lang };
  if (k.type === 'pet') { req.slot = k.slot; req.dup = isDupSecondary(context); }
  const h = holdOf(k, now);
  if (h) req.hold = h;
  return req;
}

async function renderKeys(contexts) {
  if (!socketReady()) return;
  const now = nowMs();
  const reqs = contexts.filter((c) => KEYS[c]).map((c) => keyReq(c, now));
  if (!reqs.length) return;
  const frames = await fetchFrames(reqs);
  if (!frames) { // 离线:推占位图
    for (const c of contexts) if (KEYS[c] && OFFLINE_DATAURL) $UD.setBaseDataIcon(c, OFFLINE_DATAURL, '');
    return;
  }
  for (const c of contexts) {
    const f = frames[c];
    if (!f) continue;
    KEYS[c].key = f.key || null; // 缓存宠物 key 供手势
    if (f.img) $UD.setBaseDataIcon(c, f.img, '');
  }
}

function renderAll() { renderKeys(Object.keys(KEYS)); }

// ---- 主循环(2fps)+ 长按高频计时器(100ms)----
function startLoop() {
  if (loopStarted) return;
  loopStarted = true;
  setInterval(() => {
    try {
      if (!socketReady()) return;
      processHolds(nowMs());
      renderAll();
    } catch (e) { Log.error('frame error', (e && e.stack) || String(e)); }
  }, Math.round(1000 / FPS));
}

function startHoldTimer() {
  if (holdTimer) return;
  holdTimer = setInterval(() => {
    const now = nowMs();
    if (!socketReady()) return;
    const holding = processHolds(now);
    const held = [];
    for (const c in KEYS) if (KEYS[c].hold) held.push(c);
    if (held.length) renderKeys(held);
    if (!holding && !held.length) { clearInterval(holdTimer); holdTimer = null; }
  }, HOLD_REFRESH_MS);
}
