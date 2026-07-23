/**
 * PetData —— 宠物数据加载器(window.PetData)
 * ----------------------------------------------------------------------------
 * 数据驱动宠物架构的「唯一真相源」加载层:读取
 *   pets/all_pets.json            —— 物种文件夹名列表(保持顺序)
 *   pets/<species>/pet.json       —— 物种名/稀有度/root/形态 list
 * 归一化为内存模型 MODEL,供 evolution / artSets / petArt / codex 消费。
 *
 * 两种入口:
 *   - 服务端:load(petsDir) 用 fs 读文件,构建 MODEL 后触发各消费者 reload。
 *   - 浏览器:ingest(model) 接收服务端 /api/petdata 下发的同一 MODEL(无 fs)。
 *
 * 形态归一化(由 atLv 派生,替代旧 evolution 硬编码):
 *   at/to      —— 进入/离开该形态的累计 token 阈值(取自 stages.TOKEN_LADDER)
 *   stage/feature/scale/scaleTo —— 程序化「缺图兜底」绘制用(GIF 缺失时回退)
 *   children   —— = next(进化后续形态 id list)
 */
(function () {
  let fs = null, path = null, hasNode = false;
  try {
    if (typeof require === 'function' && typeof process !== 'undefined') {
      fs = require('fs'); path = require('path'); hasNode = true;
    }
  } catch (e) { hasNode = false; }

  function ladder() {
    return (window.PetStages && window.PetStages.TOKEN_LADDER)
      ? window.PetStages.TOKEN_LADDER
      : [0, 500000, 750000, 1120000, 1670000, 2500000];
  }
  // 等级 → 程序化美术属性(与旧 evolution 完全一致,保证缺图兜底外观不变)
  function stageFor(lv) { return lv === 0 ? 0 : (lv === 1 ? 2 : Math.min(lv + 1, 14)); }
  function featFor(lv) { return lv === 0 ? 0 : Math.min(lv + 1, 14); }
  function scaleFor(lv) { return Math.round((0.62 + Math.min(lv, 14) * 0.099) * 1000) / 1000; }
  function Tof(T, lv) { return T[Math.min(Math.max(lv, 0), T.length - 1)]; }

  // 空模型
  const MODEL = { speciesList: [], speciesRarity: {}, speciesName: {}, roots: {}, forms: {} };

  function reset() {
    MODEL.speciesList = [];
    MODEL.speciesRarity = {};
    MODEL.speciesName = {};
    MODEL.roots = {};
    MODEL.forms = {};
  }

  // 把一份 pet.json 数据并入 MODEL(species 级)
  function ingestSpecies(pet) {
    if (!pet || !pet.species || !Array.isArray(pet.forms)) return;
    const sp = pet.species;
    const T = ladder();
    MODEL.speciesList.push(sp);
    MODEL.speciesRarity[sp] = (typeof pet.rarity === 'number') ? pet.rarity : 10;
    MODEL.speciesName[sp] = pet.name || { zh: sp, en: sp };
    MODEL.roots[sp] = pet.root || (pet.forms[0] && pet.forms[0].id);

    // 先建索引(拿到每个形态的 atLv,便于计算 to)
    const byId = {};
    for (const f of pet.forms) byId[f.id] = f;

    for (const f of pet.forms) {
      const atLv = (typeof f.atLv === 'number') ? f.atLv : 0;
      const children = Array.isArray(f.next) ? f.next.slice() : [];
      // to:有后续形态则取「最早后续形态的 at」,否则取下一级(终态用不到,给个上界)
      let to;
      if (children.length) {
        let minChildLv = Infinity;
        for (const cid of children) {
          const c = byId[cid];
          const clv = c && typeof c.atLv === 'number' ? c.atLv : (atLv + 1);
          if (clv < minChildLv) minChildLv = clv;
        }
        to = Tof(T, isFinite(minChildLv) ? minChildLv : atLv + 1);
      } else {
        to = Tof(T, atLv + 1);
      }
      MODEL.forms[f.id] = {
        id: f.id,
        species: sp,
        name: f.name || null,
        atLv: atLv,
        rarity: (typeof f.rarity === 'number') ? f.rarity : 10,
        variant: f.variant || '',
        look: f.look || '',
        children: children,
        at: Tof(T, atLv),
        to: to,
        stage: stageFor(atLv),
        feature: featFor(atLv),
        scale: scaleFor(atLv),
        scaleTo: scaleFor(atLv + 1),
        arts: Array.isArray(f.arts) ? f.arts.map((a) => ({
          id: a.id, file: a.file,
          states: Array.isArray(a.states) ? a.states.slice() : [],
          rarity: (typeof a.rarity === 'number') ? a.rarity : 10,
        })) : [],
      };
    }
  }

  // 通知各消费者依据最新 MODEL 重建其查表结构
  function notify() {
    try { if (window.PetEvolution && window.PetEvolution.reload) window.PetEvolution.reload(); } catch (_) {}
    try { if (window.PetArtSets && window.PetArtSets.reload) window.PetArtSets.reload(); } catch (_) {}
    try { if (window.PetArt && window.PetArt.setSpecies) window.PetArt.setSpecies(MODEL.speciesList, MODEL.speciesRarity, MODEL.speciesName); } catch (_) {}
  }

  // 服务端:从磁盘加载 pets/ 目录
  function load(petsDir) {
    reset();
    if (!hasNode || !petsDir) { notify(); return MODEL; }
    try {
      const idxPath = path.join(petsDir, 'all_pets.json');
      const list = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
      for (const name of (Array.isArray(list) ? list : [])) {
        try {
          const pj = JSON.parse(fs.readFileSync(path.join(petsDir, name, 'pet.json'), 'utf8'));
          ingestSpecies(pj);
        } catch (e) {
          try { window.PetLog && window.PetLog.error('petData load species failed', { name: name, err: String((e && e.message) || e) }); } catch (_) {}
        }
      }
    } catch (e) {
      try { window.PetLog && window.PetLog.error('petData load index failed', String((e && e.message) || e)); } catch (_) {}
    }
    notify();
    return MODEL;
  }

  // 浏览器:接收服务端下发的归一化 MODEL(逐 species 已算好,直接替换)
  function ingest(model) {
    reset();
    if (model && typeof model === 'object') {
      MODEL.speciesList = Array.isArray(model.speciesList) ? model.speciesList.slice() : [];
      MODEL.speciesRarity = model.speciesRarity || {};
      MODEL.speciesName = model.speciesName || {};
      MODEL.roots = model.roots || {};
      MODEL.forms = model.forms || {};
    }
    notify();
    return MODEL;
  }

  window.PetData = {
    MODEL: MODEL,
    load: load,
    ingest: ingest,
    serialize: function () { return MODEL; },
    get: function () { return MODEL; },
  };
})();
