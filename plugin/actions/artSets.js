/**
 * 美工组注册表(Art Sets)—— 数据驱动版
 * ----------------------------------------------------------------------------
 * 每个形态(form)在 pet.json 里带一组「美工」(arts):
 *   id      动图美工 id(idle/work/rest/cheer …),对应一个 GIF 文件
 *   file    GIF 文件名(相对 pets/<species>/)
 *   states  允许出现的宠物状态(running/waiting/completed)—— 状态门控
 *   rarity  珍稀度(越大越罕见;按倒数加权随机)
 *
 * 选择流程:宠物处于某状态 → artsFor(form,status) 取允许的美工 → pick 按珍稀度倒数
 * 加权随机进入一个;每次进入随机保持时长(5–15s,错开各宠物换装节奏);保持到期后
 * 换到同状态下的另一美工。GIF 自带帧时序,循环周期即 GIF 时长(无需 loopSec)。
 *
 * 数据来源:window.PetData.MODEL.forms[formId].arts;reload() 重建索引。
 */
(function () {
  const HOLD_MIN_MS = 5000;
  const HOLD_MAX_MS = 15000;

  let ARTS = {}; // formId -> [{id,file,states,rarity}]

  function reload() {
    ARTS = {};
    const model = (window.PetData && window.PetData.MODEL) ? window.PetData.MODEL : null;
    if (!model) return;
    for (const id in model.forms) {
      const f = model.forms[id];
      ARTS[id] = Array.isArray(f.arts) ? f.arts : [];
    }
  }

  // 某形态某状态下允许出现的美工
  function artsFor(formId, status) {
    const list = ARTS[formId] || [];
    return list.filter((a) => a.states && a.states.indexOf(status) >= 0);
  }

  // 取某形态的具体美工对象(按 art id)
  function get(formId, artId) {
    if (!artId) return null;
    const list = ARTS[formId] || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === artId) return list[i];
    return null;
  }

  // 珍稀度倒数加权随机:在该状态允许的美工里选一个 id;无候选返回 null
  function pick(formId, status) {
    const cands = artsFor(formId, status);
    if (cands.length === 0) return null;
    if (cands.length === 1) return cands[0].id;
    const weights = cands.map((a) => 1 / (a.rarity || 10));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < cands.length; i++) {
      if ((r -= weights[i]) < 0) return cands[i].id;
    }
    return cands[cands.length - 1].id;
  }

  // 确定性默认美工(渲染兜底,不随机):优先 idle,其次该状态首个允许美工
  function defaultArt(formId, status) {
    const cands = artsFor(formId, status);
    if (!cands.length) return null;
    for (let i = 0; i < cands.length; i++) if (cands[i].id === 'idle') return cands[i];
    return cands[0];
  }

  // 本次美工的随机保持时长(5–15s),错开各宠物换装节奏
  function randomHoldMs() {
    return HOLD_MIN_MS + Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS);
  }

  // 保持到期换装的时刻(GIF 自带循环,不再对齐 loop 边界)
  function switchAtMs(startMs, holdMs) {
    return (startMs || 0) + (holdMs || HOLD_MIN_MS);
  }

  window.PetArtSets = {
    HOLD_MIN_MS: HOLD_MIN_MS,
    HOLD_MAX_MS: HOLD_MAX_MS,
    reload: reload,
    artsFor: artsFor,
    get: get,
    pick: pick,
    defaultArt: defaultArt,
    randomHoldMs: randomHoldMs,
    switchAtMs: switchAtMs,
  };
})();
