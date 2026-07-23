/**
 * Agent Pet PI —— 槽位选择器(唯一的每键设置 = slot)
 * 背景由软件端决定,这里不再选择。宠物池摘要直接从 AgentPets 软件 HTTP 拉取
 * (插件不再代理 pool);预览用随页加载的渲染模块在浏览器内绘制。
 */
let ACTION_SETTING = { slot: 0 };
let form = '';
let previewT = 0;
let POOL = [];       // 宠物池摘要(来自软件 /api/state,用于预览所选槽位)
let lang = 'en';
let serverUrl = null;

$UD.connect();

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  lang = ($UD.language && $UD.language.indexOf('zh') === 0) ? 'zh' : 'en';

  document.querySelector('.uspi-wrapper').classList.remove('hidden');
  document.querySelector('#slotLabel').textContent = (lang === 'zh') ? '槽位' : 'Slot';

  const slotEl = document.querySelector('#slot');
  slotEl.addEventListener('input', () => {
    const v = Math.max(1, Math.floor(Number(slotEl.value) || 1));
    ACTION_SETTING.slot = v - 1;
    send();
  });

  // 向插件要软件地址,然后直接连软件取池
  $UD.sendToPlugin({ type: 'getServerInfo' });
  setInterval(() => { if (!serverUrl) $UD.sendToPlugin({ type: 'getServerInfo' }); }, 5000);
  setInterval(fetchPool, 2500);
  startPreview();
});

$UD.onAdd((o) => { if (o && o.param) restore(o.param); });
$UD.onParamFromApp((o) => { if (o && o.param) restore(o.param); });

// 插件回传软件地址
$UD.onSendToPropertyInspector((o) => {
  const p = o && o.payload;
  if (p && p.type === 'serverInfo') { serverUrl = p.url || null; if (serverUrl) fetchPool(); }
});

function fetchPool() {
  if (!serverUrl) return;
  fetch(serverUrl.replace(/\/$/, '') + '/api/state?since=-1', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : null)
    .then((d) => { if (d && Array.isArray(d.pool)) POOL = d.pool; })
    .catch(() => {});
}

function restore(p) {
  ACTION_SETTING = { slot: (p && typeof p.slot === 'number' && p.slot >= 0) ? Math.floor(p.slot) : 0 };
  if (form) document.querySelector('#slot').value = (ACTION_SETTING.slot || 0) + 1;
}

function send() { $UD.sendParamFromPlugin(ACTION_SETTING); }

// 预览:所选槽位的宠物(空白底 + 宠物图 / 空槽占位)
function startPreview() {
  const cv = document.querySelector('#preview');
  const ctx = cv.getContext('2d');
  setInterval(() => {
    previewT += 0.12;
    const bg = ctx.createLinearGradient(0, 0, 0, 144);
    bg.addColorStop(0, '#24262b'); bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 144, 144);

    const m = POOL.find((x) => x && Number(x.slot) === Number(ACTION_SETTING.slot));
    if (m && m.species != null && m.form != null) {
      const _tok = (typeof m.tokens === 'number' && m.tokens >= 0) ? m.tokens : PetStages.tokensFromSeconds(m.accumSec || 0);
      const g = PetEvolution.growth(m.form, _tok, m.species);
      const behavior = m.status === 'waiting' ? 'idle' : (m.status === 'completed' ? 'alert' : 'work');
      PetArt.drawPet(ctx, { species: m.species, growth: g, behavior: behavior, phase: previewT, cx: 72, cy: 78, unit: 26 });
    } else {
      ctx.save(); ctx.textAlign = 'center';
      ctx.fillStyle = '#7c8698'; ctx.font = `600 40px 'Source Han Sans SC', sans-serif`;
      ctx.fillText('#' + (Number(ACTION_SETTING.slot) + 1), 72, 90);
      ctx.restore();
    }
  }, 120);
}
