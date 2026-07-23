/**
 * 轻量文件日志(window.PetLog)
 * ----------------------------------------------------------------------------
 * 复杂度上升后,在异常/关键路径打点,便于事后排查。UlanziStudio 会吞掉 stdout,
 * 故落地到文件:默认 <os.tmpdir>/agentpets.log(便于 `tail -f` 与工具读取)。
 *
 * - 同步 append(低频、单进程,简单可靠;避免异步丢日志)。
 * - 超过 MAX_BYTES 轮转一份 .1(仅保留一代,防止无限增长)。
 * - 级别:debug/info/warn/error;warn/error 同时打到 console(供有终端时可见)。
 * - 绝不抛错:日志失败不能拖垮主流程(整体 try/catch 吞掉)。
 */
(function () {
  // Node 环境才有 require/process;浏览器(软件 Web 页经 /shared/log.js 加载)下回退为纯 console。
  let fs = null, os = null, path = null, hasNode = false;
  try {
    if (typeof require === 'function' && typeof process !== 'undefined') {
      fs = require('fs'); os = require('os'); path = require('path');
      hasNode = true;
    }
  } catch (e) { hasNode = false; }

  // UlanziStudio 会关闭插件进程的 stdout/stderr:此后 console.warn/error 写入触发
  // 异步 'error'(EPIPE)事件 -> uncaughtException -> 又调 Log.error(内部再写 console)
  // -> 再 EPIPE -> 无限递归,把日志刷爆。这里对两个流挂空 error 监听,静默吞掉即可。
  if (hasNode) {
    try { process.stdout.on('error', () => {}); } catch (_) {}
    try { process.stderr.on('error', () => {}); } catch (_) {}
  }

  const MAX_BYTES = 1024 * 1024; // 1MB 轮转
  // 允许环境变量覆盖日志路径;默认 tmp 目录下,方便读取(仅 Node 环境有文件)
  const envFile = (hasNode && process.env && process.env.AGENTPETS_LOG) ? process.env.AGENTPETS_LOG : null;
  const FILE = hasNode ? (envFile || path.join(os.tmpdir(), 'agentpets.log')) : null;

  function ts() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function fmt(level, msg, extra) {
    let line = `${ts()} [${level}] ${msg}`;
    if (extra !== undefined) {
      let s;
      try { s = typeof extra === 'string' ? extra : JSON.stringify(extra); }
      catch (e) { s = String(extra); }
      line += ' ' + s;
    }
    return line + '\n';
  }

  function rotateIfNeeded() {
    if (!hasNode) return;
    try {
      const st = fs.statSync(FILE);
      if (st.size > MAX_BYTES) {
        try { fs.renameSync(FILE, FILE + '.1'); } catch (e) { /* 覆盖旧的一代 */ }
      }
    } catch (e) { /* 文件不存在:无需轮转 */ }
  }

  function write(level, msg, extra) {
    const line = fmt(level, msg, extra);
    if (hasNode) {
      try {
        rotateIfNeeded();
        fs.appendFileSync(FILE, line);
      } catch (e) { /* 落盘失败不影响主流程 */ }
    }
    if (level === 'ERROR') { try { console.error(line.trimEnd()); } catch (e) {} }
    else if (level === 'WARN') { try { console.warn(line.trimEnd()); } catch (e) {} }
  }

  const PetLog = {
    file: FILE,
    debug: (msg, extra) => write('DEBUG', msg, extra),
    info: (msg, extra) => write('INFO', msg, extra),
    warn: (msg, extra) => write('WARN', msg, extra),
    error: (msg, extra) => write('ERROR', msg, extra),
  };

  // 启动分隔线,便于区分每次进程生命周期(仅 Node 落盘)
  try { if (hasNode) PetLog.info('=== AgentPets log start ==='); } catch (e) {}

  window.PetLog = PetLog;
})();
