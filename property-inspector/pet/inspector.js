let ACTION_SETTING = { slot: 0, bg: 'none' };
let form = '';
let previewT = 0;
let POOL = [];   // 当前宠物池摘要
let lang = 'en';

const STATUS_COLOR = { running: '#37c057', waiting: '#f0a83a', completed: '#4a9df0' };

$UD.connect();

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  lang = ($UD.language && $UD.language.indexOf('zh') === 0) ? 'zh' : 'en';

  document.querySelector('.uspi-wrapper').classList.remove('hidden');
  document.querySelector('#slotLabel').textContent = (lang === 'zh') ? '槽位' : 'Slot';
  document.querySelector('#bgLabel').textContent = (lang === 'zh') ? '背景' : 'Background';
  document.querySelector('#slotHint').textContent = (lang === 'zh')
    ? '可指向尚未出现的槽位' : 'may point to a future slot';

  // 槽位数字输入(1 起,内部 0 起)
  const slotEl = document.querySelector('#slot');
  slotEl.addEventListener('input', () => {
    const v = Math.max(1, Math.floor(Number(slotEl.value) || 1));
    ACTION_SETTING.slot = v - 1;
    markActive();
    send();
  });

  // 背景选项
  const bgRow = document.querySelector('#bgRow');
  PetBackgrounds.themes.forEach((key) => {
    const div = document.createElement('div');
    div.className = 'bg-opt';
    div.dataset.bg = key;
    div.textContent = PetBackgrounds.names[key][lang];
    div.addEventListener('click', () => selectBg(key));
    bgRow.appendChild(div);
  });

  requestPool();
  setInterval(requestPool, 5000); // 池随时间增长,定期刷新列表
  startPreview();
});

// 初始化参数
$UD.onAdd((o) => { if (o && o.param) restore(o.param); });
$UD.onParamFromApp((o) => { if (o && o.param) restore(o.param); });

// 主服务回传宠物池摘要
$UD.onSendToPropertyInspector((o) => {
  const p = o && o.payload;
  if (p && p.type === 'pool' && Array.isArray(p.pool)) { POOL = p.pool; renderList(); }
});
// 兜底:也接受全局设置里的池
$UD.onDidReceiveGlobalSettings((o) => {
  const data = o && (o.settings || o.param);
  if (data && Array.isArray(data.pool)) {
    POOL = data.pool.map((m, i) => ({
      slot: i, species: m.species, agent: m.agent, sid: m.sid,
      petName: m.petName, status: m.status, accumSec: Math.round(m.accumSec || 0),
    }));
    renderList();
  }
});

function requestPool() {
  $UD.sendToPlugin({ type: 'getPool' });
  $UD.getGlobalSettings();
}

function restore(p) {
  ACTION_SETTING = Object.assign({ slot: 0, bg: 'none' }, p);
  if (form) {
    document.querySelector('#slot').value = (ACTION_SETTING.slot || 0) + 1;
    document.querySelector('#bg').value = ACTION_SETTING.bg || 'none';
  }
  markActive();
}

function selectSlot(slot) {
  ACTION_SETTING.slot = slot;
  document.querySelector('#slot').value = slot + 1;
  markActive();
  send();
}

function selectBg(key) {
  ACTION_SETTING.bg = key;
  document.querySelector('#bg').value = key;
  markActive();
  send();
}

function send() { $UD.sendParamFromPlugin(ACTION_SETTING); }

function fmtClock(sec) {
  const s = Math.floor(sec % 60), m = Math.floor((sec / 60) % 60), h = Math.floor(sec / 3600);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (m > 0) return `${m}:${pad(s)}`;
  return `0:${pad(s)}`;
}

function renderList() {
  const list = document.querySelector('#slotList');
  list.innerHTML = '';
  POOL.forEach((m) => {
    const div = document.createElement('div');
    div.className = 'slot-opt';
    div.dataset.slot = m.slot;
    const spName = (PetArt.speciesName[m.species] || {})[lang] || m.species;
    div.innerHTML =
      `<div class="slot-dot" style="background:${STATUS_COLOR[m.status] || '#888'}"></div>` +
      `<div class="slot-idx">#${m.slot + 1}</div>` +
      `<div class="slot-main">` +
        `<div class="slot-title">${m.agent} · ${spName}</div>` +
        `<div class="slot-sub">${m.sid} · ${fmtClock(m.accumSec)}</div>` +
      `</div>`;
    div.addEventListener('click', () => selectSlot(m.slot));
    list.appendChild(div);
  });
  markActive();
}

function markActive() {
  document.querySelectorAll('.slot-opt').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.slot) === Number(ACTION_SETTING.slot));
  });
  document.querySelectorAll('.bg-opt').forEach((el) => {
    el.classList.toggle('active', el.dataset.bg === ACTION_SETTING.bg);
  });
}

// 预览:背景 + 所选槽位宠物(或空槽占位) + 前景
function startPreview() {
  const cv = document.querySelector('#preview');
  const ctx = cv.getContext('2d');
  setInterval(() => {
    previewT += 0.12;
    const cfg = { phase: previewT, w: 144, h: 144 };
    const bg = ctx.createLinearGradient(0, 0, 0, 144);
    bg.addColorStop(0, '#24262b'); bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 144, 144);
    PetBackgrounds.drawBack(ctx, ACTION_SETTING.bg, cfg);

    const m = POOL.find((x) => Number(x.slot) === Number(ACTION_SETTING.slot));
    if (m) {
      const g = PetStages.growthFromSeconds(m.accumSec);
      const behavior = m.status === 'waiting' ? 'idle' : (m.status === 'completed' ? 'alert' : 'work');
      PetArt.drawPet(ctx, {
        species: m.species, growth: g, behavior: behavior,
        phase: previewT, cx: 72, cy: 78, unit: 26,
      });
    }
    PetBackgrounds.drawFront(ctx, ACTION_SETTING.bg, cfg);

    if (!m) {
      ctx.save(); ctx.textAlign = 'center';
      ctx.fillStyle = '#7c8698'; ctx.font = `600 40px 'Source Han Sans SC', sans-serif`;
      ctx.fillText('#' + (Number(ACTION_SETTING.slot) + 1), 72, 90);
      ctx.restore();
    }
  }, 120);
}
