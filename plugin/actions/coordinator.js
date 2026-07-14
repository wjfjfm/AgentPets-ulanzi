/**
 * Coordinator —— 全局宠物协调器(单例)
 * ----------------------------------------------------------------------------
 * 只有主服务(app.html)里存在一份。它统一维护「宠物池」——一组会话宠物,
 * 每只宠物的全部 meta 都在这里:agent(claude/codex/…) · session id · 当前对话 ·
 * 运行时长 · token 消耗 · 宠物类型 · 当前状态。
 *
 * Demo 阶段:按「随占用槽位数指数增长后随机」的节奏自动生成新宠物追加到池尾
 * (0 只时随机 0-10s,1 只 0-20s,2 只 0-40s…越拥挤越慢);每只宠物按对数随机
 * 节奏切换状态并更新对话,运行时长持续累加(驱动成长与 token 估算)。
 *
 * 按键侧不再各自持有宠物,只保存一个 slot 索引;渲染时从这里 get(slot) 取 meta。
 * 池结构会写入「全局设置」,以便 PI(配置面板)读取并列出可选槽位。
 */
(function () {
  const Demo = window.PetDemo;
  const Art = window.PetArt;
  const S = window.PetStages;
  const Ev = window.PetEvolution;

  const MAX_POOL = 32;                   // 软上限,避免无限增长

  function newMeta(slot, now) {
    const id = Demo.genIdentity();
    const turn = Demo.pickTurn();
    const species = Art.pickSpecies(); // 按稀有度倒数加权随机分配物种
    return {
      slot: slot,
      species: species,
      form: Ev.rootForm(species), // 当前进化形态(树根 = 蛋),随成长级联进化并持久化
      petName: id.petName,
      agent: id.agent,
      sid: id.sid,
      bornAt: now,
      accumSec: 0,          // 累计运行时长(秒)—— 驱动成长
      status: 'running',
      userMsg: turn.userMsg,   // 本轮我对 Agent 说的话(整回合不变)
      agentMsg: turn.agentMsg, // Agent 最新反馈(回合内可更新)
      turnStart: now,       // 本轮开始时间(我对 Agent 说话的时刻)
      turnFrozenMs: null,   // 完成时冻结的本轮持续时长(ms);进行中为 null
      nextSwitchAt: now + Demo.logRandInterval(),
    };
  }

  function Coordinator() {
    this.pool = [];
    this.nextSpawnAt = 0;
    this.dirty = false; // 结构或数据变化,提示上层需要持久化到全局设置
  }

  // 依据当前占用槽位数,安排下一次生成时间(指数增长后随机)
  Coordinator.prototype.scheduleNextSpawn = function (now) {
    this.nextSpawnAt = now + Demo.spawnRandInterval(this.pool.length);
  };

  Coordinator.prototype.init = function (now) {
    if (this.pool.length === 0) {
      this.pool.push(newMeta(0, now));
    }
    if (!this.nextSpawnAt) this.scheduleNextSpawn(now);
    this.dirty = true;
  };

  Coordinator.prototype.spawn = function (now) {
    if (this.pool.length >= MAX_POOL) return;
    this.pool.push(newMeta(this.pool.length, now));
    this.dirty = true;
  };

  // 主循环调用:推进时间(生成新宠物 + 每只宠物成长/回合状态推进)
  Coordinator.prototype.tick = function (now, dtSec) {
    if (now >= this.nextSpawnAt && this.pool.length < MAX_POOL) {
      this.spawn(now);
      this.scheduleNextSpawn(now);
    }
    for (let i = 0; i < this.pool.length; i++) {
      const m = this.pool[i];
      m.accumSec += dtSec; // 会话存续 -> 持续消耗 token / 成长

      // 进化:累计 token 达阈值则按珍稀度倒数加权选子形态前进(级联补进化)并持久化
      const nextForm = Ev.advance(m.form, S.tokensFromSeconds(m.accumSec), m.species);
      if (nextForm !== m.form) { m.form = nextForm; this.dirty = true; }

      if (now < m.nextSwitchAt) continue;

      if (m.status === 'completed') {
        // 上一回合已结束 -> 开启新的一回合(我又对 Agent 说话)
        const t = Demo.pickTurn();
        m.status = 'running';
        m.turnStart = now;
        m.turnFrozenMs = null;
        m.userMsg = t.userMsg;   // 新回合:换一句我说的话
        m.agentMsg = t.agentMsg;
        m.nextSwitchAt = now + Demo.logRandInterval();
      } else if (Demo.rand(2) === 0) {
        // 本回合完成 -> 冻结本轮持续时长,给出最终回复(我说的话不变)
        m.status = 'completed';
        m.turnFrozenMs = Math.max(0, now - m.turnStart);
        m.agentMsg = Demo.pickTurn().agentMsg;
        m.nextSwitchAt = now + Demo.logRandInterval();
      } else {
        // 回合内在 运行/暂停 之间切换(计时继续,我说的话不变,仅更新反馈)
        m.status = (m.status === 'running') ? 'waiting' : 'running';
        m.agentMsg = Demo.pickTurn().agentMsg;
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
  Coordinator.prototype.summaries = function (now) {
    const t = (typeof now === 'number') ? now : 0;
    return this.pool.map((m) => {
      let turnMs = (m.status === 'completed' && typeof m.turnFrozenMs === 'number')
        ? m.turnFrozenMs : (t - m.turnStart);
      if (!(turnMs >= 0)) turnMs = 0;
      return {
        slot: m.slot,
        species: m.species,
        form: m.form,
        petName: m.petName,
        agent: m.agent,
        sid: m.sid,
        status: m.status,
        accumSec: Math.round(m.accumSec),
        turnSec: Math.round(turnMs / 1000),
        tokens: Math.round(S.tokensFromSeconds(m.accumSec)),
      };
    });
  };

  Coordinator.prototype.reset = function (now) {
    this.pool = [];
    this.nextSpawnAt = 0;
    this.init(now);
  };

  // ---- 持久化(全局设置)----
  Coordinator.prototype.serialize = function () {
    return {
      pool: this.pool,
      nextSpawnAt: this.nextSpawnAt,
    };
  };

  Coordinator.prototype.restore = function (data, now) {
    if (!data || !Array.isArray(data.pool) || data.pool.length === 0) return false;
    this.pool = data.pool.map((m, i) => {
      const status = (Demo.STATES.includes(m.status) ? m.status : 'running');
      const species = (Art.species.includes(m.species) ? m.species : Art.species[0]);
      // 形态:优先沿用持久化的 form(需属于同物种树),否则按累计 token 重新推导
      const accumSec = (typeof m.accumSec === 'number' && m.accumSec >= 0) ? m.accumSec : 0;
      let form = m.form;
      const valid = Ev.isValidForm(form) && Ev.get(form).species === species;
      if (!valid) form = Ev.advance(Ev.rootForm(species), S.tokensFromSeconds(accumSec), species);
      return {
        slot: i,
        species: species,
        form: form,
        petName: m.petName || 'Pet',
        agent: m.agent || 'Codex',
        sid: m.sid || '000000',
        bornAt: m.bornAt || now,
        accumSec: accumSec,
        status: status,
        userMsg: m.userMsg || '',
        agentMsg: m.agentMsg || '',
        turnStart: (typeof m.turnStart === 'number') ? m.turnStart : now,
        turnFrozenMs: (status === 'completed' && typeof m.turnFrozenMs === 'number') ? m.turnFrozenMs : null,
        nextSwitchAt: (typeof m.nextSwitchAt === 'number') ? m.nextSwitchAt : now,
      };
    });
    this.nextSpawnAt = (typeof data.nextSpawnAt === 'number') ? data.nextSpawnAt : now;
    return true;
  };

  window.PetCoordinator = new Coordinator();
  window.PetCoordinator.MAX_POOL = MAX_POOL;
})();
