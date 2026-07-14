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
 * 成长阶段表(阈值用“秒”表达，方便对照需求里的时间点；
 * 内部真正驱动的是 tokens，见 tokensFromSeconds）。
 * scale：该阶段目标体型系数(相对基准)。
 * feature：解锁到的部位等级，petArt 依此决定画哪些部件(累进)。
 */
const STAGES = [
  { t: 0,      key: 'egg',       nameEn: 'Egg',        nameZh: '虫卵',   scale: 0.62, feature: 0 },
  { t: 10,     key: 'crack',     nameEn: 'Cracking',   nameZh: '破壳',   scale: 0.66, feature: 1 },
  { t: 30,     key: 'hatch',     nameEn: 'Hatchling',  nameZh: '初生',   scale: 0.70, feature: 2 },
  { t: 60,     key: 'stand',     nameEn: 'Standing',   nameZh: '站立',   scale: 0.78, feature: 3 },
  { t: 120,    key: 'grow',      nameEn: 'Growing',    nameZh: '长大',   scale: 0.88, feature: 4 },
  { t: 300,    key: 'organ',     nameEn: 'New Organ',  nameZh: '长器官', scale: 0.98, feature: 5 },
  { t: 600,    key: 'tail',      nameEn: 'Tail',       nameZh: '长尾巴', scale: 1.06, feature: 6 },
  { t: 1200,   key: 'trait',     nameEn: 'Awakening',  nameZh: '觉醒',   scale: 1.14, feature: 7 },
  { t: 2400,   key: 'cheek',     nameEn: 'Blooming',   nameZh: '绽放',   scale: 1.22, feature: 8 },
  { t: 3600,   key: 'collar',    nameEn: 'Adorned',    nameZh: '佩饰',   scale: 1.30, feature: 9 },
  { t: 7200,   key: 'arms',      nameEn: 'Teen',       nameZh: '少年',   scale: 1.40, feature: 10 },
  { t: 14400,  key: 'crown',     nameEn: 'Adult',      nameZh: '成年',   scale: 1.50, feature: 11 },
  { t: 28800,  key: 'aura',      nameEn: 'Elder',      nameZh: '长者',   scale: 1.60, feature: 12 },
  { t: 57600,  key: 'mythic',    nameEn: 'Mythic',     nameZh: '秘境',   scale: 1.72, feature: 13 },
  { t: 115200, key: 'legend',    nameEn: 'Legend',     nameZh: '传说',   scale: 1.85, feature: 14 },
];

const MAX_STAGE = STAGES.length - 1;

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
  MAX_STAGE,
  tokensFromSeconds,
  secondsFromTokens,
  growthFromTokens,
  growthFromSeconds,
  secondsToNextStage,
};
