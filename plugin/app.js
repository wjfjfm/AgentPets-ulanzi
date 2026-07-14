/**
 * 主服务：Token 电子宠物
 * - 维护每个按键(context)一只 Pet
 * - 全局渲染循环:按 FPS 重绘并推送图标;运行中的宠物累加运行时间(驱动成长)
 * - 手势:用 keyDown/keyUp 自行判定 —— 短按=运行/暂停切换,长按 3 秒=重置
 *   (因此忽略 onRun,避免与自定义单击判定重复触发)
 * - 定期把运行进度持久化到上位机(setSettings)
 */
const PETS = {};
const FPS = 6;                 // 每秒推送帧数(兼顾流畅与流量)
const SAVE_EVERY_MS = 5000;    // 持久化间隔
const CLICK_MAX_MS = 400;      // 短按阈值

let lastFrame = 0;
let lastSave = 0;

$UD.connect('com.ulanzi.ulanzistudio.tokenpet');

$UD.onConnected(() => {
  startLoop();
});

// 配置到按键
$UD.onAdd((jsn) => {
  const context = jsn.context;
  if (!PETS[context]) {
    const pet = new Pet(context);
    pet.setLang($UD.language);
    PETS[context] = pet;
  }
  const pet = PETS[context];
  if (jsn.param) pet.applySettings(jsn.param);
  $UD.getSettings(context); // 拉取已保存的运行进度
});

// 上位机回传已保存参数
$UD.onDidReceiveSettings((jsn) => {
  const pet = PETS[jsn.context];
  if (pet && jsn.param) { pet.applySettings(jsn.param); pushIcon(pet); }
});

// 活跃状态
$UD.onSetActive((jsn) => {
  const pet = PETS[jsn.context];
  if (pet && jsn.active && jsn.active.toString() === 'true') pushIcon(pet);
});

// PI 修改了物种 / 名字
$UD.onParamFromApp((jsn) => applyParam(jsn));
$UD.onParamFromPlugin((jsn) => applyParam(jsn));

function applyParam(jsn) {
  const pet = PETS[jsn.context];
  if (!pet || !jsn.param) return;
  pet.applySettings(jsn.param);
  save(pet);
  pushIcon(pet);
}

// ---- 手势:短按/长按 ----
$UD.onKeyDown((jsn) => {
  const pet = PETS[jsn.context];
  if (pet) pet.beginHold(nowMs());
});

$UD.onKeyUp((jsn) => {
  const pet = PETS[jsn.context];
  if (!pet) return;
  const held = nowMs() - pet.holdStart;
  pet.endHold();
  if (held >= pet.HOLD_RESET_MS) {
    // 已在循环中触发重置
  } else if (held <= CLICK_MAX_MS || held < pet.HOLD_RESET_MS) {
    pet.forceSwitch(nowMs());   // 短按:立即随机切换状态+任务
    save(pet);
  }
  pushIcon(pet);
});

// 移除配置
$UD.onClear((jsn) => {
  if (!jsn.param) return;
  for (let i = 0; i < jsn.param.length; i++) {
    const context = jsn.param[i].context;
    delete PETS[context];
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

    const contexts = Object.keys(PETS);
    for (let i = 0; i < contexts.length; i++) {
      const pet = PETS[contexts[i]];

      // 长按满 3 秒 -> 重置
      if (pet.holdStart && pet.holdProgress(now) >= 1) {
        pet.reset();
        save(pet);
      } else {
        pet.maybeSwitch(now); // 到点随机切换状态+任务
        pet.tick(dt);         // 持续累加时间(驱动成长)
      }
      pushIcon(pet, phase);
    }

    // 周期持久化
    if (now - lastSave >= SAVE_EVERY_MS) {
      lastSave = now;
      for (let i = 0; i < contexts.length; i++) save(PETS[contexts[i]]);
    }
  }, Math.round(1000 / FPS));
}

function pushIcon(pet, phase) {
  const p = phase != null ? phase : nowMs() / 1000;
  const data = pet.render(nowMs(), p);
  $UD.setBaseDataIcon(pet.context, data, ''); // 名字/时间已画在画布上,不用上位机叠字
}

function save(pet) {
  $UD.setSettings(pet.serialize(), pet.context);
}

function nowMs() { return Date.now(); }
