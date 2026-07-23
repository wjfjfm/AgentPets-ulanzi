/**
 * 进化树系统(Evolution Tree)—— 数据驱动版
 * ----------------------------------------------------------------------------
 * 形态树不再硬编码,而是从 window.PetData(pets/<species>/pet.json 归一化模型)加载。
 * 本模块保留稳定对外 API(growth/advance/pickChild/formName/rootForm/isValidForm),
 * 内部查表结构(FORMS/ROOTS/FORM_NAMES)由 reload() 依据最新 PetData.MODEL 重建。
 *
 * 每个形态节点(来自 PetData 归一化):
 *   id/species/name/atLv/rarity/variant/children/at/to/stage/feature/scale/scaleTo/arts
 * 其中 stage/feature/scale/scaleTo 仅用于「GIF 缺失时的程序化兜底绘制」。
 *
 * 进化:累计 token ≥ 当前形态 to 且仍有子形态时,按珍稀度倒数加权随机选子并前进
 * (单向、级联补进化);分叉结果固化在持久化的 form id 里,不重随、不回退。
 */
(function () {
  // 累计 token 阶梯(复用 stages.js,保证形态阈值与等级对齐)
  const T = (window.PetStages && window.PetStages.TOKEN_LADDER)
    ? window.PetStages.TOKEN_LADDER
    : [0, 500000, 750000, 1120000, 1670000, 2500000];

  // 查表结构(稳定引用;reload 时原地清空重填,外部持有者如 codex 可感知更新)
  const FORMS = {};
  const ROOTS = {};
  const FORM_NAMES = {};

  const SPECIES_FALLBACK = {
    slime: { en: 'Slime', zh: '史莱姆' },
    cat:   { en: 'Kitcat', zh: '喵仔' },
    dragon:{ en: 'Draco', zh: '龙仔' },
  };

  // 依据 PetData.MODEL 重建查表结构
  function reload() {
    for (const k in FORMS) delete FORMS[k];
    for (const k in ROOTS) delete ROOTS[k];
    for (const k in FORM_NAMES) delete FORM_NAMES[k];
    const model = (window.PetData && window.PetData.MODEL) ? window.PetData.MODEL : null;
    if (!model) return;
    for (const id in model.forms) {
      const f = model.forms[id];
      FORMS[id] = f;
      if (f.name) FORM_NAMES[id] = f.name;
    }
    for (const sp in model.roots) ROOTS[sp] = model.roots[sp];
  }

  function get(formId) { return FORMS[formId] || null; }
  function rootForm(species) { return ROOTS[species] || ROOTS[Object.keys(ROOTS)[0]] || ''; }
  function isValidForm(formId) { return !!FORMS[formId]; }

  // 取形态展示名(中英)。优先形态自带名;其次「基名+序号」;再次物种兜底。
  function formName(formId, lang) {
    const l = lang === 'zh' ? 'zh' : 'en';
    const n = FORM_NAMES[formId];
    if (n) return n[l] || n.en;
    const m = String(formId).match(/^(.*?)(\d+)$/);
    if (m && FORM_NAMES[m[1]]) {
      const b = FORM_NAMES[m[1]];
      const base = b[l] || b.en;
      return l === 'zh' ? (base + m[2]) : (base + ' ' + m[2]);
    }
    const f = FORMS[formId];
    const sp = f ? f.species : null;
    const fb = sp && SPECIES_FALLBACK[sp];
    return fb ? (fb[l] || fb.en) : (formId || '');
  }

  // 对数插值:token 在 [lo,hi] 内映射到 0~1(前期长得快、后期慢)
  function logInterp(tok, lo, hi) {
    if (!(hi > lo)) return 1;
    const l = Math.max(lo, 0.5);
    const s = Math.max(tok, l);
    let p = (Math.log(s) - Math.log(l)) / (Math.log(hi) - Math.log(l));
    return Math.min(1, Math.max(0, p));
  }

  // 由「当前形态 + 累计 token」派生渲染/等级所需状态。
  //  - form/atLv/level/isMax:GIF 选取 + 等级显示(level 受形态终态封顶由 levelOf 处理)
  //  - stage/feature/scale/variant:GIF 缺失时的程序化兜底绘制
  function growth(formId, tokens, species) {
    let f = FORMS[formId];
    if (!f) f = FORMS[rootForm(species)];
    if (!f) return { form: formId || '', atLv: 0, level: 0, stage: 0, feature: 0, scale: 0.62, p: 0, variant: '', look: '', isMax: true };
    const p = logInterp(tokens, f.at, f.to);
    const scale = f.scale + ((f.scaleTo != null ? f.scaleTo : f.scale) - f.scale) * p;
    return {
      form: f.id,
      atLv: f.atLv,
      level: f.atLv,
      stage: f.stage,         // 兜底绘制(蛋判定/蛋壳碎片)
      feature: f.feature,     // 兜底绘制(部件累进)
      scale: scale,           // 兜底绘制(体型)
      p: p,
      variant: f.variant || '',
      look: f.look || '',     // 轮廓/构型标识(分支专属渲染器)
      isMax: !f.children || f.children.length === 0,
    };
  }

  // 珍稀度倒数加权随机:从子形态列表里选一个(珍稀度越高越少见)
  function pickChild(formId) {
    const f = FORMS[formId];
    if (!f || !f.children || f.children.length === 0) return null;
    if (f.children.length === 1) return f.children[0];
    const weights = f.children.map((id) => 1 / ((FORMS[id] && FORMS[id].rarity) || 10));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < f.children.length; i++) {
      if ((r -= weights[i]) < 0) return f.children[i];
    }
    return f.children[f.children.length - 1];
  }

  // 级联进化:累计 token ≥ 当前形态 to 且仍有子形态时加权选子前进,直到追平。
  function advance(formId, tokens, species) {
    let cur = FORMS[formId] ? formId : rootForm(species);
    let guard = 0;
    while (guard++ < 64) {
      const f = FORMS[cur];
      if (!f || !f.children || f.children.length === 0) break;
      if (tokens < f.to) break;
      const next = pickChild(cur);
      if (!next) break;
      cur = next;
    }
    return cur;
  }

  // 权威等级(唯一真相源):token 阶梯 stage,受当前形态封顶。
  //  - 非终态:等级 = token 阶梯 stage(达阈值即进化,故不会超过下一分叉)。
  //  - 终态:封顶到该形态自身的等级 atLv(顶级形态不再随 token 虚涨)。
  // 修正历史 off-by-one:封顶用 atLv(真实等级),而非 stage(=stageFor(atLv) 绘制桶)。
  function levelOf(formId, tokens, species) {
    const S = window.PetStages;
    let level = S ? S.growthFromTokens(tokens || 0).stage : 0;
    const f = FORMS[formId] || FORMS[rootForm(species)];
    if (f && (!f.children || f.children.length === 0)) level = Math.min(level, f.atLv);
    return level;
  }

  window.PetEvolution = {
    T: T,
    FORMS: FORMS,
    ROOTS: ROOTS,
    FORM_NAMES: FORM_NAMES,
    reload: reload,
    get: get,
    rootForm: rootForm,
    isValidForm: isValidForm,
    formName: formName,
    growth: growth,
    levelOf: levelOf,
    pickChild: pickChild,
    advance: advance,
  };
})();
