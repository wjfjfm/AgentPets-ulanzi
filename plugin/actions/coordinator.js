/**
 * Coordinator —— 全局宠物协调器(单例)
 * ----------------------------------------------------------------------------
 * 只有主服务(app.html)里存在一份。它统一维护「宠物池」——一组会话宠物,
 * 每只宠物的全部 meta 都在这里:agent(claude/codex/…) · session id · 当前对话 ·
 * 运行时长 · token 消耗 · 宠物类型 · 当前状态。
 *
 * Demo 阶段:每 10 分钟自动生成一只新宠物追加到池尾;每只宠物按对数随机节奏
 * 切换状态并更新对话,运行时长持续累加(驱动成长与 token 估算)。
 *
 * 按键侧不再各自持有宠物,只保存一个 slot 索引;渲染时从这里 get(slot) 取 meta。
 * 池结构会写入「全局设置」,以便 PI(配置面板)读取并列出可选槽位。
 */
(function () {
  const Demo = window.PetDemo;
  const Art = window.PetArt;
  const S = window.PetStages;

  const SPAWN_EVERY_MS = 10 * 60 * 1000; // Demo:每 10 分钟生成一只
  const MAX_POOL = 32;                   // 软上限,避免无限增长

  function newMeta(slot, now) {
    const id = Demo.genIdentity();
    const turn = Demo.pickTurn();
    return {
      slot: slot,
      species: Demo.pick(Art.species),
      petName: id.petName,
      agent: id.agent,
      sid: id.sid,
      bornAt: now,
      accumSec: 0,          // 运行时长(秒)—— 驱动成长
      status: 'running',
      userMsg: turn.userMsg,
      agentMsg: turn.agentMsg,
      nextSwitchAt: now + Demo.logRandInterval(),
    };
  }

  function Coordinator() {
    this.pool = [];
    this.lastSpawnAt = 0;
    this.dirty = false; // 结构或数据变化,提示上层需要持久化到全局设置
  }

  Coordinator.prototype.init = function (now) {
    if (this.pool.length === 0) {
      this.pool.push(newMeta(0, now));
    }
    if (!this.lastSpawnAt) this.lastSpawnAt = now;
    this.dirty = true;
  };

  Coordinator.prototype.spawn = function (now) {
    if (this.pool.length >= MAX_POOL) return;
    this.pool.push(newMeta(this.pool.length, now));
    this.dirty = true;
  };

  // 主循环调用:推进时间(生成新宠物 + 每只宠物成长/状态切换)
  Coordinator.prototype.tick = function (now, dtSec) {
    if (now - this.lastSpawnAt >= SPAWN_EVERY_MS && this.pool.length < MAX_POOL) {
      this.lastSpawnAt = now;
      this.spawn(now);
    }
    for (let i = 0; i < this.pool.length; i++) {
      const m = this.pool[i];
      m.accumSec += dtSec; // 会话存续 -> 持续消耗 token / 成长
      if (now >= m.nextSwitchAt) {
        m.status = Demo.pickState();
        const t = Demo.pickTurn();
        m.userMsg = t.userMsg;
        m.agentMsg = t.agentMsg;
        m.nextSwitchAt = now + Demo.logRandInterval();
      }
    }
  };

  Coordinator.prototype.slotCount = function () { return this.pool.length; };

  Coordinator.prototype.get = function (slot) {
    if (slot == null || slot < 0 || slot >= this.pool.length) return null;
    return this.pool[slot];
  };

  // 供 PI 列出可选槽位的精简摘要
  Coordinator.prototype.summaries = function () {
    return this.pool.map((m) => ({
      slot: m.slot,
      species: m.species,
      petName: m.petName,
      agent: m.agent,
      sid: m.sid,
      status: m.status,
      accumSec: Math.round(m.accumSec),
      tokens: Math.round(S.tokensFromSeconds(m.accumSec)),
    }));
  };

  Coordinator.prototype.reset = function (now) {
    this.pool = [];
    this.lastSpawnAt = 0;
    this.init(now);
  };

  // ---- 持久化(全局设置)----
  Coordinator.prototype.serialize = function () {
    return {
      pool: this.pool,
      lastSpawnAt: this.lastSpawnAt,
    };
  };

  Coordinator.prototype.restore = function (data, now) {
    if (!data || !Array.isArray(data.pool) || data.pool.length === 0) return false;
    this.pool = data.pool.map((m, i) => ({
      slot: i,
      species: (Art.species.includes(m.species) ? m.species : Art.species[0]),
      petName: m.petName || 'Pet',
      agent: m.agent || 'Codex',
      sid: m.sid || '000000',
      bornAt: m.bornAt || now,
      accumSec: (typeof m.accumSec === 'number' && m.accumSec >= 0) ? m.accumSec : 0,
      status: (Demo.STATES.includes(m.status) ? m.status : 'running'),
      userMsg: m.userMsg || '',
      agentMsg: m.agentMsg || '',
      // 恢复后的下次切换时间落在过去也无妨(会立即切一次)
      nextSwitchAt: (typeof m.nextSwitchAt === 'number') ? m.nextSwitchAt : now,
    }));
    this.lastSpawnAt = (typeof data.lastSpawnAt === 'number') ? data.lastSpawnAt : now;
    return true;
  };

  window.PetCoordinator = new Coordinator();
  window.PetCoordinator.SPAWN_EVERY_MS = SPAWN_EVERY_MS;
  window.PetCoordinator.MAX_POOL = MAX_POOL;
})();
