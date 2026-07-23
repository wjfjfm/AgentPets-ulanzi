/**
 * PetGif —— 运行时 GIF 动图引擎(window.PetGif;仅服务端解码)
 * ----------------------------------------------------------------------------
 * 设备按键图像由服务端合成:背景 + 宠物当前帧 + UI 文字层。宠物层从真实 GIF 取帧。
 * @napi-rs/canvas 不解多帧 GIF,故用 gifuct-js 纯 JS 解码 + 按 disposal 合成每帧到
 * 独立 canvas,按文件缓存(懒加载 + LRU,仅活跃宠物的 GIF 进内存)。
 *
 * API:
 *   setBase(dir)                    —— 设置 pets/ 根目录(服务端启动时调用)
 *   available()                     —— 是否可用(有 base + 依赖就绪)
 *   frameAt(species, file, nowMs)   —— 取该 GIF 在 now 时刻应显示的合成帧 canvas;
 *                                       缺失/解码失败返回 null(调用方回退程序化绘制)
 *
 * 浏览器端不加载本模块(网页用原生 <img> 播放 GIF)。
 */
(function () {
  let fs = null, path = null, canvasLib = null, gifuct = null, hasNode = false;
  try {
    if (typeof require === 'function' && typeof process !== 'undefined') {
      fs = require('fs'); path = require('path');
      hasNode = true;
      // 依赖(gifuct-js/@napi-rs/canvas)可能不在本模块目录可解析(dev 时 shared 在插件目录,
      // npm 包在 agentpets/)。此处尽力自解析;失败则由服务端 setDeps 注入。
      try { canvasLib = require('@napi-rs/canvas'); } catch (_) {}
      try { gifuct = require('gifuct-js'); } catch (_) {}
    }
  } catch (e) { hasNode = false; }

  let BASE = null;
  const LRU_MAX = 64;                 // 最多缓存的 GIF 文件数(每只活跃宠物当前 1 个)
  const cache = new Map();            // absPath -> { frames:[canvas], cum:[ms累计], total:ms } | null(解码失败)

  function setBase(dir) { BASE = dir || null; }
  // 服务端注入依赖(dev 环境本模块目录无法解析这些 npm 包时使用)
  function setDeps(canvasMod, gifuctMod) { if (canvasMod) canvasLib = canvasMod; if (gifuctMod) gifuct = gifuctMod; }
  function available() { return !!(hasNode && BASE && gifuct && canvasLib); }

  // 解码并合成一个 GIF 的全部帧(按 disposalType 处理帧间清除)
  function decode(absPath) {
    const buf = fs.readFileSync(absPath);
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const gif = gifuct.parseGIF(u8);
    const raw = gifuct.decompressFrames(gif, true);
    const W = gif.lsd.width, H = gif.lsd.height;
    const full = canvasLib.createCanvas(W, H);
    const fctx = full.getContext('2d');
    const frames = [];
    const cum = [];
    let total = 0;
    for (let i = 0; i < raw.length; i++) {
      const f = raw[i];
      const d = f.dims;
      // patch → 临时 canvas → drawImage(带 alpha 合成,保留已画内容的透明区)
      const patch = canvasLib.createCanvas(d.width, d.height);
      const pctx = patch.getContext('2d');
      const id = pctx.createImageData(d.width, d.height);
      id.data.set(f.patch);
      pctx.putImageData(id, 0, 0);
      fctx.drawImage(patch, d.left, d.top);
      // 快照当前合成结果为该帧
      const snap = canvasLib.createCanvas(W, H);
      snap.getContext('2d').drawImage(full, 0, 0);
      frames.push(snap);
      const delay = (typeof f.delay === 'number' && f.delay > 0) ? f.delay : 100;
      total += delay;
      cum.push(total);
      // disposal=2:下一帧前清除本帧区域(恢复背景=透明)
      if (f.disposalType === 2) fctx.clearRect(d.left, d.top, d.width, d.height);
    }
    if (!frames.length) return null;
    return { frames: frames, cum: cum, total: total };
  }

  function ensure(absPath) {
    if (cache.has(absPath)) {
      // LRU:命中挪到队尾
      const v = cache.get(absPath);
      cache.delete(absPath); cache.set(absPath, v);
      return v;
    }
    let v = null;
    try { v = decode(absPath); }
    catch (e) { v = null; try { window.PetLog && window.PetLog.warn('petGif decode failed', { file: absPath, err: String((e && e.message) || e) }); } catch (_) {} }
    cache.set(absPath, v);
    if (cache.size > LRU_MAX) { const first = cache.keys().next().value; cache.delete(first); }
    return v;
  }

  // 取 now 时刻应显示的帧 canvas;单帧 GIF 直接返回该帧;失败返回 null
  function frameAt(species, file, nowMs) {
    if (!available() || !species || !file) return null;
    const abs = path.join(BASE, species, file);
    const g = ensure(abs);
    if (!g) return null;
    if (g.frames.length === 1 || g.total <= 0) return g.frames[0];
    const t = ((nowMs % g.total) + g.total) % g.total;
    for (let i = 0; i < g.cum.length; i++) {
      if (t < g.cum[i]) return g.frames[i];
    }
    return g.frames[g.frames.length - 1];
  }

  window.PetGif = {
    setBase: setBase,
    setDeps: setDeps,
    available: available,
    frameAt: frameAt,
    _cache: cache,
  };
})();
