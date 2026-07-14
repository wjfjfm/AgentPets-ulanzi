/**
 * Demo 数据与随机驱动
 * ----------------------------------------------------------------------------
 * - 随机身份：英文宠物名 + Agent(Codex/Claude/Qoder/Pi) + 6 位 session id
 *   展示形如：Candy (Codex 3a5b3f)
 * - 随机任务：100 条预设“当前任务状态”,未来可替换为真实运行状态
 * - 随机状态：running(运行) / waiting(等待) / completed(完成)
 * - 切换节奏：每隔一个“0~10 分钟对数随机分布”的间隔,随机切一次状态并换一条任务
 */
(function () {
  const PET_NAMES = [
    'Candy', 'Mochi', 'Pixel', 'Biscuit', 'Coco', 'Ziggy', 'Nova', 'Pepper',
    'Waffle', 'Nugget', 'Bean', 'Tofu', 'Bubbles', 'Gizmo', 'Peanut', 'Mango',
    'Yuki', 'Cinny', 'Zorro', 'Cookie', 'Muffin', 'Olive', 'Suki', 'Bolt',
    'Fig', 'Hazel', 'Kiwi', 'Loki', 'Miso', 'Noodle', 'Pumpkin', 'Ravi',
    'Sushi', 'Taco', 'Umi', 'Waldo', 'Yoyo', 'Ziti', 'Berry', 'Dash',
    'Ember', 'Fudge', 'Ginger', 'Honey', 'Jelly', 'Latte', 'Marble', 'Pesto',
  ];

  const AGENTS = ['Codex', 'Claude', 'Qoder', 'Pi'];

  // 本轮“我”对 agent 说的话(用户指令/提问)
  const USER_SAYS = [
    'Add a dark mode toggle to the settings page',
    'Fix the login bug that only happens on Safari',
    'Refactor the auth module so it is easier to test',
    'Write unit tests for the markdown parser',
    'Why is the build failing on CI right now?',
    'Optimize the dashboard, it loads too slowly',
    'Add pagination to the search results list',
    'Update the README with the new setup steps',
    'Migrate the database from SQLite to Postgres',
    'Explain what this reducer function actually does',
    'Can you deduplicate the API client code?',
    'Add input validation to the signup form',
    'Investigate the memory leak in the worker',
    'Convert these class components to hooks',
    'Set up a GitHub Action to run the tests',
    'Make the header sticky on scroll',
    'Cache the results of the expensive query',
    'Add retry logic to the network requests',
    'Rename userId to accountId everywhere',
    'Split this giant file into smaller modules',
    'Add a loading spinner while data is fetched',
    'Handle the empty state for the table',
    'Write a script to seed the local database',
    'Improve the error message for bad input',
    'Add TypeScript types to the utils folder',
    'Debounce the search box input by 300ms',
    'Fix the flaky test in the checkout flow',
    'Add a confirmation dialog before deleting',
    'Extract the theme colors into variables',
    'Make this endpoint return paginated data',
    'Document the public API in the wiki',
    'Add keyboard shortcuts to the editor',
    'Reduce the bundle size, it is too big',
    'Support drag and drop for file uploads',
    'Add a health check endpoint to the server',
    'Localize the app into Chinese and English',
    'Fix the layout on small mobile screens',
    'Add rate limiting to the public API',
    'Write an integration test for the webhook',
    'Clean up the unused imports across the repo',
  ];

  // 本轮 agent 的最新反馈(结果/进展/追问)
  const AGENT_SAYS = [
    'Done — updated 3 files and all tests pass',
    'Found the root cause in the router config',
    'Added the feature, ready for your review',
    'Tests are green, opening a pull request now',
    'I need a bit more context on the API shape',
    'Fixed the null check, verifying the fix now',
    'Refactor complete with no behavior change',
    'Looking into the failing CI step, one moment',
    'Applied the migration to the local database',
    'Here is a short summary of what I changed',
    'Reproduced the bug, working on a fix',
    'Split it into four smaller focused modules',
    'Which environment should this point to?',
    'Added types, the compiler is happy now',
    'Deployed to staging, please take a look',
    'Left the old path in place for compatibility',
    'The slow query is now cached, 4x faster',
    'Could you confirm the expected behavior?',
    'Renamed the symbol across 12 files',
    'Added tests, coverage went up to 87%',
    'Removed the dead code and unused deps',
    'The layout is fixed on mobile now',
    'I will need write access to that folder',
    'Committed the changes on a new branch',
    'Benchmarked it — load time dropped by half',
    'Added validation and friendly error text',
    'Rebased onto main, conflicts resolved',
    'Waiting on the API key to continue',
    'Documented the endpoints in the wiki',
    'Bundle is 30% smaller after tree-shaking',
    'Wired up the webhook and tested it locally',
    'Added the confirmation dialog as requested',
    'Everything looks good, wrapping up now',
    'Hit a rate limit, backing off and retrying',
    'Extracted the theme into shared variables',
    'Added drag and drop with a preview thumbnail',
    'The health check is live at /healthz',
    'Localized the strings for zh and en',
    'One test is still flaky, digging deeper',
    'All set — merged and closed the issue',
  ];

  const STATES = ['running', 'waiting', 'completed'];

  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rand(arr.length)]; }

  function sessionId() {
    const hex = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < 6; i++) s += hex[rand(16)];
    return s;
  }

  function genIdentity() {
    return { petName: pick(PET_NAMES), agent: pick(AGENTS), sid: sessionId() };
  }

  // 一“轮”对话:我说的话 + agent 的最新反馈
  function pickTurn() {
    return { userMsg: pick(USER_SAYS), agentMsg: pick(AGENT_SAYS) };
  }
  function pickState() { return pick(STATES); }

  // 0~10 分钟的对数随机间隔(毫秒):短间隔更常见,偶发长间隔
  function logRandInterval() {
    const minS = 3, maxS = 600;
    const r = Math.random();
    const sec = minS * Math.pow(maxS / minS, r);
    return sec * 1000;
  }

  // 生成新宠物的间隔(毫秒):随已占用槽位数指数增长后取随机
  //   count 只时 -> random(0, 10 * 2^count) 秒(0→0-10,1→0-20,2→0-40…)
  function spawnRandInterval(count) {
    const maxS = 10 * Math.pow(2, count);
    return Math.random() * maxS * 1000;
  }

  window.PetDemo = {
    PET_NAMES, AGENTS, USER_SAYS, AGENT_SAYS, STATES,
    genIdentity, pickTurn, pickState, logRandInterval, spawnRandInterval, pick, rand,
  };
})();
