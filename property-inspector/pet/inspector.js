let ACTION_SETTING = { species: 'slime' };
let form = '';
let previewT = 0;

$UD.connect();

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');

  const lang = ($UD.language && $UD.language.indexOf('zh') === 0) ? 'zh' : 'en';

  // 渲染物种选择(名字为自动随机生成,PI 只选物种)
  const row = document.querySelector('#speciesRow');
  PetArt.species.forEach((sp) => {
    const div = document.createElement('div');
    div.className = 'species-opt';
    div.dataset.species = sp;
    div.textContent = PetArt.speciesName[sp][lang];
    div.addEventListener('click', () => selectSpecies(sp));
    row.appendChild(div);
  });

  document.querySelector('.uspi-wrapper').classList.remove('hidden');

  markActive();
  startPreview();
});

function selectSpecies(sp) {
  ACTION_SETTING.species = sp;
  document.querySelector('#species').value = sp;
  markActive();
  send();
}

function markActive() {
  document.querySelectorAll('.species-opt').forEach((el) => {
    el.classList.toggle('active', el.dataset.species === ACTION_SETTING.species);
  });
}

function send() {
  $UD.sendParamFromPlugin(ACTION_SETTING);
}

// 初始化参数
$UD.onAdd((o) => { if (o && o.param) restore(o.param); });
$UD.onParamFromApp((o) => { if (o && o.param) restore(o.param); });

function restore(p) {
  ACTION_SETTING = Object.assign({ species: 'slime' }, p);
  if (form) {
    document.querySelector('#species').value = ACTION_SETTING.species || 'slime';
    markActive();
  }
}

// 配置面板里的实时预览(展示当前物种在“成年”阶段、工作状态的样子)
function startPreview() {
  const cv = document.querySelector('#preview');
  const ctx = cv.getContext('2d');
  const growth = PetStages.growthFromSeconds(20000); // 预览一个成长较高的形态
  setInterval(() => {
    previewT += 0.12;
    ctx.clearRect(0, 0, 144, 144);
    const bg = ctx.createLinearGradient(0, 0, 0, 144);
    bg.addColorStop(0, '#24262b'); bg.addColorStop(1, '#15161a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 144, 144);
    PetArt.drawPet(ctx, {
      species: ACTION_SETTING.species || 'slime',
      growth: growth,
      behavior: 'work',
      phase: previewT,
      cx: 72, cy: 74, unit: 30,
    });
  }, 120);
}
