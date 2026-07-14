/**
 * 进化树系统(Evolution Tree)
 * ----------------------------------------------------------------------------
 * 每个物种是一棵「进化树」:从蛋(根)出发,随累计 token 增长逐级进化,
 * 每一步可能分叉成多个子形态。发生进化时,若子形态有多个,按「珍稀度倒数
 * 加权随机」决定进化方向 —— 珍稀度越高(数值越大)越罕见。
 *
 * 每个形态节点(form)的配置:
 *   id       形态唯一标识
 *   species  所属物种(slime/cat/dragon)—— 与树根一致,决定调色板/体型
 *   rarity   珍稀度(默认 10);仅在「作为某形态的子形态之一」时参与加权
 *   at       进入该形态的累计 token 阈值(用于形态内体型对数插值起点)
 *   to       离开该形态的累计 token 阈值(≥ 时若有子形态则进化;也是插值终点)
 *   children 子形态 id 列表(空 = 终态)
 *   stage    渲染阶段(≤1 视为蛋;=2 带蛋壳碎片;驱动 petArt 分支)
 *   feature  部件等级 0-14(petArt 依此累进绘制部件)
 *   scale    该形态起始体型系数
 *   scaleTo  该形态终点体型系数(在 at→to 间对数插值)
 *
 * 设计原则:越稀有的物种(dragon>cat>slime)进化树越深、分叉越多、上限越高。
 * 当前「引擎优先」:分叉暂用既有 feature/stage 渲染区分,精细美术后续补。
 */
(function () {
  // 累计 token 阶梯(与 stages.js 的秒阈值 × 55.56 对齐,便于形态阈值取整参考)
  const T = [0, 556, 1667, 3333, 6667, 16667, 33333, 66667, 133333, 200000,
    400000, 800000, 1600000, 3200000, 6400000];

  // 便捷:构造一个形态节点(rarity 默认 10)
  function F(id, species, at, to, stage, feature, scale, scaleTo, children, rarity) {
    return {
      id: id,
      species: species,
      rarity: (typeof rarity === 'number') ? rarity : 10,
      at: at,
      to: to,
      stage: stage,
      feature: feature,
      scale: scale,
      scaleTo: scaleTo,
      children: children || [],
    };
  }

  // ---- 史莱姆(rarity 9,最常见 → 树最浅、上限最低)----
  const SLIME = [
    F('slime_egg',   'slime', T[0], T[1], 0, 0, 0.62, 0.66, ['slime_baby']),
    F('slime_baby',  'slime', T[1], T[3], 2, 2, 0.70, 0.78, ['slime_ooze']),
    F('slime_ooze',  'slime', T[3], T[5], 4, 4, 0.88, 0.98, ['slime_horn']),
    F('slime_horn',  'slime', T[5], T[7], 6, 6, 1.06, 1.14, ['slime_aqua', 'slime_magma']),
    F('slime_aqua',  'slime', T[7], T[9], 8, 8, 1.22, 1.30, ['slime_guard'], 8),   // 常见分支
    F('slime_magma', 'slime', T[7], T[9], 8, 9, 1.24, 1.34, ['slime_king'], 12),   // 稀有分支
    F('slime_guard', 'slime', T[9], T[12], 10, 10, 1.40, 1.46, []),                // 终态(常见)
    F('slime_king',  'slime', T[9], T[12], 11, 11, 1.45, 1.52, []),                // 终态(稀有)
  ];

  // ---- 喵仔(rarity 10,中等 → 更深、分叉更多、上限居中)----
  const CAT = [
    F('cat_egg',     'cat', T[0], T[1], 0, 0, 0.62, 0.66, ['cat_kit']),
    F('cat_kit',     'cat', T[1], T[3], 2, 2, 0.70, 0.78, ['cat_young']),
    F('cat_young',   'cat', T[3], T[5], 4, 4, 0.88, 0.98, ['cat_hunter']),
    F('cat_hunter',  'cat', T[5], T[7], 6, 6, 1.06, 1.14, ['cat_shadow', 'cat_lynx']),
    F('cat_shadow',  'cat', T[7], T[9], 8, 8, 1.22, 1.30, ['cat_ninja'], 9),
    F('cat_lynx',    'cat', T[7], T[9], 8, 8, 1.22, 1.32, ['cat_sabre'], 11),
    F('cat_ninja',   'cat', T[9], T[10], 10, 10, 1.40, 1.45, ['cat_master', 'cat_phantom']),
    F('cat_sabre',   'cat', T[9], T[10], 10, 10, 1.40, 1.46, ['cat_tiger']),
    F('cat_master',  'cat', T[10], T[12], 11, 11, 1.50, 1.56, [], 8),  // 终态(常见)
    F('cat_phantom', 'cat', T[10], T[12], 12, 12, 1.55, 1.62, [], 13), // 终态(稀有)
    F('cat_tiger',   'cat', T[10], T[12], 11, 11, 1.50, 1.58, []),     // 终态
  ];

  // ---- 小龙(rarity 11,最稀有 → 树最深、分叉最多、上限最高)----
  const DRAGON = [
    F('dragon_egg',       'dragon', T[0], T[1], 0, 0, 0.62, 0.66, ['dragon_wyrmling']),
    F('dragon_wyrmling',  'dragon', T[1], T[3], 2, 2, 0.70, 0.78, ['dragon_juvenile']),
    F('dragon_juvenile',  'dragon', T[3], T[5], 4, 4, 0.88, 0.98, ['dragon_winged']),
    F('dragon_winged',    'dragon', T[5], T[7], 7, 7, 1.06, 1.14, ['dragon_fire', 'dragon_frost', 'dragon_storm']),
    F('dragon_fire',      'dragon', T[7], T[9], 8, 8, 1.22, 1.30, ['dragon_infernal'], 9),
    F('dragon_frost',     'dragon', T[7], T[9], 8, 8, 1.22, 1.31, ['dragon_glacial'], 11),
    F('dragon_storm',     'dragon', T[7], T[9], 8, 9, 1.24, 1.34, ['dragon_tempest'], 14),
    F('dragon_infernal',  'dragon', T[9], T[10], 10, 10, 1.40, 1.45, ['dragon_ancient']),
    F('dragon_glacial',   'dragon', T[9], T[10], 10, 10, 1.40, 1.46, ['dragon_ancient']),
    F('dragon_tempest',   'dragon', T[9], T[10], 10, 11, 1.42, 1.48, ['dragon_leviathan']),
    F('dragon_ancient',   'dragon', T[10], T[12], 12, 12, 1.50, 1.60, ['dragon_celestial', 'dragon_void']),
    F('dragon_leviathan', 'dragon', T[10], T[12], 12, 12, 1.52, 1.62, ['dragon_kraken']),
    F('dragon_celestial', 'dragon', T[12], T[13], 13, 13, 1.72, 1.78, ['dragon_eternal'], 10),
    F('dragon_void',      'dragon', T[12], T[14], 13, 13, 1.74, 1.82, ['dragon_abyss'], 16),
    F('dragon_kraken',    'dragon', T[12], T[13], 13, 13, 1.72, 1.80, []),   // 终态
    F('dragon_eternal',   'dragon', T[13], T[14], 14, 14, 1.85, 1.95, []),   // 神话终态
    F('dragon_abyss',     'dragon', T[13], T[14], 14, 14, 1.88, 2.00, []),   // 深渊终态(最稀有,最高上限)
  ];

  // 形态注册表:id -> form
  const FORMS = {};
  [SLIME, CAT, DRAGON].forEach((tree) => tree.forEach((f) => { FORMS[f.id] = f; }));

  // 每物种的树根(蛋)
  const ROOTS = { slime: 'slime_egg', cat: 'cat_egg', dragon: 'dragon_egg' };

  function get(formId) { return FORMS[formId] || null; }
  function rootForm(species) { return ROOTS[species] || ROOTS.slime; }
  function isValidForm(formId) { return !!FORMS[formId]; }

  // 对数插值:token 在 [lo,hi] 内映射到 0~1(前期长得快、后期慢)
  function logInterp(tok, lo, hi) {
    if (!(hi > lo)) return 1;
    const l = Math.max(lo, 0.5);
    const s = Math.max(tok, l);
    let p = (Math.log(s) - Math.log(l)) / (Math.log(hi) - Math.log(l));
    return Math.min(1, Math.max(0, p));
  }

  // 由「当前形态 + 累计 token」派生渲染所需的成长状态(与 stages.growth 同形)
  function growth(formId, tokens, species) {
    let f = FORMS[formId];
    if (!f) f = FORMS[rootForm(species)];
    const p = logInterp(tokens, f.at, f.to);
    const scale = f.scale + (f.scaleTo - f.scale) * p;
    return {
      stage: f.stage,
      feature: f.feature,
      scale: scale,
      p: p,
      form: f.id,
      isMax: f.children.length === 0,
    };
  }

  // 珍稀度倒数加权随机:从子形态列表里选一个(珍稀度越高越少见)
  function pickChild(formId) {
    const f = FORMS[formId];
    if (!f || f.children.length === 0) return null;
    if (f.children.length === 1) return f.children[0];
    const weights = f.children.map((id) => 1 / ((FORMS[id] && FORMS[id].rarity) || 10));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < f.children.length; i++) {
      if ((r -= weights[i]) < 0) return f.children[i];
    }
    return f.children[f.children.length - 1];
  }

  // 级联进化:只要「累计 token ≥ 当前形态 to」且仍有子形态,就加权选子并前进,
  // 直到追平(处理长时间未刷新/恢复后的补进化)。返回最终 formId。
  function advance(formId, tokens, species) {
    let cur = FORMS[formId] ? formId : rootForm(species);
    let guard = 0;
    while (guard++ < 64) {
      const f = FORMS[cur];
      if (!f || f.children.length === 0) break;      // 终态
      if (tokens < f.to) break;                      // 尚未达到进化阈值
      const next = pickChild(cur);
      if (!next) break;
      cur = next;
    }
    return cur;
  }

  window.PetEvolution = {
    T: T,
    FORMS: FORMS,
    ROOTS: ROOTS,
    get: get,
    rootForm: rootForm,
    isValidForm: isValidForm,
    growth: growth,
    pickChild: pickChild,
    advance: advance,
  };
})();
