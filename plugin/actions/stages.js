/**
 * Token 成长模型
 * ----------------------------------------------------------------------------
 * - 真实场景：pet 的成长由累计 Token 用量驱动。
 * - Demo 场景：Token 无法直接拿到，按 “运行时长 * 固定系数” 估算，
 *   估算标准为每小时消耗 0.2M(=200,000) tokens。
 * - 成长曲线：阶段阈值近似几何级(约翻倍)递增，因此 “阶段数 ~ log2(tokens)”，
 *   即 Token 越多、进入下一阶段所需的增量越大 —— 对数级别增长。
 * - 阶段内部：用对数插值得到 0~1 的 “部分成长进度”，让宠物在两个形态之间
 *   连续地长大一点点(基于上一阶段逐步长向下一阶段)。
 */

const TOKENS_PER_HOUR = 200000;              // Demo：每小时 0.2M tokens
const TOKENS_PER_SEC = TOKENS_PER_HOUR / 3600; // ≈ 55.56 tokens/s

/**
 * 每级进化需求(累计「成长点」)。口径:成长点 = 日志字节数 × 每源系数(见 sources.js TOKEN_SCALE)。
 * 数值写死于此,单位 K(=1000),整数。数组下标 i 即等级 Lv_i,Lv0=蛋(0)。
 * 锚点(用户拍定):Lv1=0.5M、Lv5=2.5M,其后每 5 级 ×10 ——
 *   Lv10=25M、Lv15=250M、Lv20=2.5G、Lv25=25G …… 延续至 Lv50。
 * 说明:日志字节数常达数百 KB;膨胀严重的源(如 Kimi wire.jsonl)由每源系数归一到基准尺度,
 *   故早期阈值整体抬高,避免「一句话直接高等级」。里程碑精确对齐,段内按几何级插值。
 */
const LEVEL_TOKENS_K = [
  0, 500, 750, 1120, 1670, 2500,
  3960, 6280, 9955, 15775, 25000,
  39620, 62795, 99525, 157740, 250000,
  396225, 627970, 995270, 1577395, 2500000,
  3962235, 6279715, 9952680, 15773935, 25000000,
  39622330, 62797160, 99526795, 157739335, 250000000,
  396223300, 627971610, 995267925, 1577393360, 2500000000,
  3962232980, 6279716080, 9952679265, 15773933610, 25000000000,
  39622329810, 62797160790, 99526792640, 157739336120, 250000000000,
  396223298115, 627971607875, 995267926385, 1577393361200, 2500000000000,
];

/**
 * 阶段美术元数据(仅装饰:体型 scale / 部件 feature / 展示名)。渲染实际由形态树(evolution.js)驱动,
 * 此处仅供 growthFromTokens 返回结构使用;高于最深形态的等级沿用最后一档美术。
 */
const STAGE_ART = [
  { key: 'egg',    nameEn: 'Egg',       nameZh: '虫卵',   scale: 0.62, feature: 0 },
  { key: 'crack',  nameEn: 'Cracking',  nameZh: '破壳',   scale: 0.66, feature: 1 },
  { key: 'hatch',  nameEn: 'Hatchling', nameZh: '初生',   scale: 0.70, feature: 2 },
  { key: 'stand',  nameEn: 'Standing',  nameZh: '站立',   scale: 0.78, feature: 3 },
  { key: 'grow',   nameEn: 'Growing',   nameZh: '长大',   scale: 0.88, feature: 4 },
  { key: 'organ',  nameEn: 'New Organ', nameZh: '长器官', scale: 0.98, feature: 5 },
  { key: 'tail',   nameEn: 'Tail',      nameZh: '长尾巴', scale: 1.06, feature: 6 },
  { key: 'trait',  nameEn: 'Awakening', nameZh: '觉醒',   scale: 1.14, feature: 7 },
  { key: 'cheek',  nameEn: 'Blooming',  nameZh: '绽放',   scale: 1.22, feature: 8 },
  { key: 'collar', nameEn: 'Adorned',   nameZh: '佩饰',   scale: 1.30, feature: 9 },
  { key: 'arms',   nameEn: 'Teen',      nameZh: '少年',   scale: 1.40, feature: 10 },
  { key: 'crown',  nameEn: 'Adult',     nameZh: '成年',   scale: 1.50, feature: 11 },
  { key: 'aura',   nameEn: 'Elder',     nameZh: '长者',   scale: 1.60, feature: 12 },
  { key: 'mythic', nameEn: 'Mythic',    nameZh: '秘境',   scale: 1.72, feature: 13 },
  { key: 'legend', nameEn: 'Legend',    nameZh: '传说',   scale: 1.85, feature: 14 },
];

// 由「K 阈值 + 美术元数据」组装阶段表;tok 为原始 token(= K×1000 字节),t 为反查用“秒”阈值。
const STAGES = LEVEL_TOKENS_K.map(function (k, i) {
  const art = STAGE_ART[i] || STAGE_ART[STAGE_ART.length - 1];
  const tok = k * 1000;
  return {
    tok: tok,
    tokK: k,
    t: tok / TOKENS_PER_SEC,
    key: art.key, nameEn: art.nameEn, nameZh: art.nameZh,
    scale: art.scale, feature: art.feature,
  };
});

const MAX_STAGE = STAGES.length - 1;

// 累计 token 阈值阶梯(取自 STAGES.tok),供 evolution.js 复用,保持形态树与等级阈值对齐。
const TOKEN_LADDER = STAGES.map(function (s) { return s.tok; });

/** Demo：运行秒数 -> 估算 tokens */
function tokensFromSeconds(sec) {
  return Math.max(0, sec) * TOKENS_PER_SEC;
}

/** tokens -> 对应阶段的“秒”阈值(用于反查阶段) */
function secondsFromTokens(tok) {
  return tok / TOKENS_PER_SEC;
}

/**
 * 由累计 tokens 计算成长状态。
 * 返回：
 *  - stage：当前阶段索引(整数)
 *  - p：阶段内部进度 0~1(对数插值,体现“部分成长”)
 *  - scale：连续体型系数(在本阶段与下一阶段之间按 p 插值)
 *  - stageInfo：当前阶段元数据
 *  - feature：当前解锁部件等级
 *  - isMax：是否已达最终形态
 */
function growthFromTokens(tok) {
  const sec = secondsFromTokens(tok);
  let stage = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (sec >= STAGES[i].t) stage = i;
    else break;
  }
  const cur = STAGES[stage];
  const next = STAGES[stage + 1];

  let p = 1;
  if (next) {
    // 对数插值：进入下一阶段所需 token 随阶段递增 -> 前期长得快、后期长得慢
    const lo = Math.max(cur.t, 0.5);
    const hi = next.t;
    const s = Math.max(sec, lo);
    p = (Math.log(s) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    p = Math.min(1, Math.max(0, p));
  }

  const targetScale = next ? cur.scale + (next.scale - cur.scale) * p : cur.scale;

  return {
    stage,
    p,
    scale: targetScale,
    feature: cur.feature,
    stageInfo: cur,
    isMax: stage >= MAX_STAGE,
  };
}

/** 组合便捷方法：由运行秒数直接得到成长状态 */
function growthFromSeconds(sec) {
  return growthFromTokens(tokensFromSeconds(sec));
}

/** 距离下一阶段还需多少秒(用于 UI 提示，可选) */
function secondsToNextStage(sec) {
  const g = growthFromSeconds(sec);
  const next = STAGES[g.stage + 1];
  return next ? Math.max(0, next.t - sec) : 0;
}

window.PetStages = {
  TOKENS_PER_HOUR,
  TOKENS_PER_SEC,
  STAGES,
  TOKEN_LADDER,
  MAX_STAGE,
  tokensFromSeconds,
  secondsFromTokens,
  growthFromTokens,
  growthFromSeconds,
  secondsToNextStage,
};
