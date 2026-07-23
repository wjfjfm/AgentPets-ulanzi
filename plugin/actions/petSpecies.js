/**
 * PetSpecies —— 新增物种的像素渲染器注册表(window.PetSpecies)
 * ----------------------------------------------------------------------------
 * 10 个主题各异、构型各异的新物种。每个物种一个独立 render 函数,силуэт(轮廓)刻意区分:
 * 蘑菇(伞+柄)/ 甲蟹(宽甲+双螯)/ 甲虫(甲壳+独角+六足)/ 幽灯(火焰水滴,悬浮)/
 * 灵蛇(盘蜷+颈盾)/ 石魄(方块岩体)/ 羽禽(直立+喙+尾羽)/ 机偶(方体机械)/
 * 渊妖(头足+触手)/ 星辉构装(人形+光环+多翼)。
 *
 * 反「圆形通用体」:主体用 rect/triangle 拼角,而非单一 ellipse。
 * 反「仅调色分支」:variant 既换配色,也改结构细节(伞斑/颈盾/角形/尾羽/触手尖…)。
 * 稀有度越高的物种,基础装饰越华丽(镶边/光环/浮片),配合 bake 的顶级特效分级。
 *
 * drawPet 在 stage>1 且 species 属于本注册表时调用:render[species](ctx,cx,cy,unit,pal,g,behavior,phase,tk)
 *   tk = { makePen, hexA, eyes(drawEyesPx), mouth(drawMouthPx) }
 * 蛋阶段(stage<=1)仍由 petArt.drawEgg 统一绘制(用 pal(species,variant) 着色)。
 */
(function () {
  // ---- 基础调色(每物种独立色系,避免与既有 slime/cat/dragon 及彼此雷同)----
  const PAL = {
    mushroom:  { body: '#d6452f', shade: '#a82f1e', belly: '#f3e4cf', accent: '#5e1a10', eye: '#2c0d08', glow: '#ff8a6a' },
    crab:      { body: '#e2683a', shade: '#b34620', belly: '#ffd9b0', accent: '#5f210c', eye: '#2b0e05', glow: '#ffb072' },
    beetle:    { body: '#4f9e57', shade: '#337038', belly: '#cdeeb0', accent: '#173d1c', eye: '#0d2410', glow: '#9be86a' },
    wisp:      { body: '#f0a23a', shade: '#c8761c', belly: '#ffe6a8', accent: '#6e3a08', eye: '#fff3c8', glow: '#ffd06a' },
    serpent:   { body: '#3fae7a', shade: '#278857', belly: '#dff7e0', accent: '#134a30', eye: '#0c2d1c', glow: '#8affc0' },
    golem:     { body: '#8a8378', shade: '#5f5a50', belly: '#c8c0b2', accent: '#2f2c26', eye: '#f0e0a0', glow: '#c9b98a' },
    avian:     { body: '#5aa6e6', shade: '#3577b8', belly: '#e6f2ff', accent: '#1c3f66', eye: '#12283f', glow: '#a8d6ff' },
    automaton: { body: '#6b7480', shade: '#464e58', belly: '#c2ccd6', accent: '#20262e', eye: '#2fd6e6', glow: '#7fe6ff' },
    kraken:    { body: '#2f7d8a', shade: '#1c5560', belly: '#bfe6ea', accent: '#0c2c33', eye: '#eaffff', glow: '#6fe0d0' },
    seraph:    { body: '#f0e2c0', shade: '#cdb98a', belly: '#fffdf3', accent: '#8a6a2f', eye: '#5a4a2a', glow: '#ffe98a' },
    qilin:     { body: '#e6b45a', shade: '#b8842f', belly: '#fff0cf', accent: '#6e4410', eye: '#2e1c06', glow: '#ffd884' },
    genbu:     { body: '#4f8a6a', shade: '#316048', belly: '#d0ecd8', accent: '#153a28', eye: '#0c2418', glow: '#8fe0b0' },
    chaos:     { body: '#5a4a72', shade: '#3a2e50', belly: '#c8b8e0', accent: '#1e142e', eye: '#fff0ff', glow: '#c79bff' },
  };
  // ---- 分支变体:换色 + 结构标记(结构差异在各 render 内按 variant 分流)----
  const VAR = {
    // mushroom
    spore:    { body: '#8a5cd6', shade: '#5f3aa8', belly: '#eadcff', accent: '#33195e', eye: '#180a2e', glow: '#c79bff' },
    toxin:    { body: '#7bbf3a', shade: '#548f22', belly: '#e8ffbe', accent: '#2f5410', eye: '#142f0a', glow: '#c8ff5a' },
    lumen:    { body: '#34d6c2', shade: '#1e9e8e', belly: '#d6fff8', accent: '#0d4a42', eye: '#062e29', glow: '#8affee' },
    webnet:   { body: '#c98a5a', shade: '#96602f', belly: '#f0dcc0', accent: '#4a2e12', eye: '#2a1808', glow: '#ffd89a' },
    worldwood:{ body: '#6f8a4a', shade: '#4a5f2a', belly: '#d6e6b0', accent: '#2a3a16', eye: '#f0ffcf', glow: '#b8ff7a' },
    // crab
    reef:     { body: '#e2683a', shade: '#b34620', belly: '#ffd9b0', accent: '#5f210c', eye: '#2b0e05', glow: '#ffb072' },
    riptide:  { body: '#2fb6c4', shade: '#1c8090', belly: '#cff6fb', accent: '#0c3d45', eye: '#052a30', glow: '#7fe8f2' },
    abyssal:  { body: '#3a4a8f', shade: '#243063', belly: '#c8cff0', accent: '#12183a', eye: '#eaf0ff', glow: '#8fa0ff' },
    sandshell:{ body: '#e0c079', shade: '#b3934a', belly: '#fff2cf', accent: '#6e5420', eye: '#2e2408', glow: '#ffe6a0' },
    kingcrab: { body: '#c43a2f', shade: '#8f241c', belly: '#ffcdb0', accent: '#5a140c', eye: '#fff0e0', glow: '#ff8a5a' },
    // beetle
    forest:   { body: '#4f9e57', shade: '#337038', belly: '#cdeeb0', accent: '#173d1c', eye: '#0d2410', glow: '#9be86a' },
    iron:     { body: '#8a94a0', shade: '#5c646e', belly: '#dfe4ea', accent: '#262b31', eye: '#e6f0ff', glow: '#c8d4e0' },
    volt:     { body: '#e6c22f', shade: '#b8951c', belly: '#fff4bf', accent: '#5f4a08', eye: '#2e2606', glow: '#fff07a' },
    goldbug:  { body: '#f0c847', shade: '#c2971c', belly: '#fff6c8', accent: '#6e5410', eye: '#3a2c06', glow: '#fff2a0' },
    goliath:  { body: '#3f6b3a', shade: '#264a22', belly: '#c0e0a8', accent: '#122e10', eye: '#e0ffc8', glow: '#9be86a' },
    // wisp
    ember:    { body: '#f0723a', shade: '#c8451c', belly: '#ffd0a0', accent: '#6e2408', eye: '#fff3c8', glow: '#ffb06a' },
    hoarfrost:{ body: '#7fc6ee', shade: '#4f96c8', belly: '#eafaff', accent: '#204a6e', eye: '#0c2c3f', glow: '#cdefff' },
    nether:   { body: '#8a3ad0', shade: '#5f22a0', belly: '#e6d0ff', accent: '#2e0d5e', eye: '#f0e0ff', glow: '#c79bff' },
    // serpent
    gale:     { body: '#3faea0', shade: '#278878', belly: '#dff7f2', accent: '#134a42', eye: '#0c2d28', glow: '#8affe6' },
    venom:    { body: '#9bcf2f', shade: '#6f9e1c', belly: '#eeffbf', accent: '#3f5f08', eye: '#1e2e06', glow: '#d6ff5a' },
    levin:    { body: '#e6d23a', shade: '#b8a41c', belly: '#fff8bf', accent: '#5f5008', eye: '#2e2606', glow: '#fff08a' },
    // golem
    granite:  { body: '#8a8378', shade: '#5f5a50', belly: '#c8c0b2', accent: '#2f2c26', eye: '#f0e0a0', glow: '#c9b98a' },
    geode:    { body: '#9a6cf0', shade: '#6f47c0', belly: '#e6dcff', accent: '#33195e', eye: '#fff0c8', glow: '#c9a4ff' },
    magmacore:{ body: '#6b5048', shade: '#452f2a', belly: '#e8955a', accent: '#1f120e', eye: '#ffd06a', glow: '#ff7a2f' },
    // avian
    falcon:   { body: '#5a78b8', shade: '#3a5288', belly: '#dfe6ff', accent: '#1c2f5e', eye: '#12203a', glow: '#a8c0ff' },
    tempest:  { body: '#7a6cd0', shade: '#4f47a0', belly: '#e0dcff', accent: '#28205e', eye: '#12123a', glow: '#b7a4ff' },
    phoenix:  { body: '#f0803a', shade: '#c8501c', belly: '#ffd89a', accent: '#6e2c08', eye: '#3a1404', glow: '#ffb84f' },
    // automaton
    cog:      { body: '#8a7a4a', shade: '#5f5220', belly: '#e0d0a0', accent: '#2e2608', eye: '#ffe06a', glow: '#ffd884' },
    arc:      { body: '#3a6b80', shade: '#244a5c', belly: '#c8ecf6', accent: '#0c2630', eye: '#2fd6e6', glow: '#7fe6ff' },
    plasma:   { body: '#7a4a80', shade: '#52305c', belly: '#f0d0f6', accent: '#2e0e33', eye: '#ff8af0', glow: '#e88aff' },
    // kraken
    tidal:    { body: '#2f7d8a', shade: '#1c5560', belly: '#bfe6ea', accent: '#0c2c33', eye: '#eaffff', glow: '#6fe0d0' },
    caustic:  { body: '#6f3ad0', shade: '#4a22a0', belly: '#e0ccff', accent: '#220d5e', eye: '#f0e0ff', glow: '#b79bff' },
    voidsea:  { body: '#26303f', shade: '#161d28', belly: '#5f6f80', accent: '#080c12', eye: '#8affe6', glow: '#4f8f8a' },
    // seraph
    sacred:   { body: '#f0e2c0', shade: '#cdb98a', belly: '#fffdf3', accent: '#8a6a2f', eye: '#5a4a2a', glow: '#fff2b0' },
    astralite:{ body: '#8a9cf0', shade: '#5f6fd0', belly: '#e0e6ff', accent: '#28306e', eye: '#12183a', glow: '#c0ccff' },
    auric:    { body: '#f2c94a', shade: '#c99a1f', belly: '#fff2c2', accent: '#6b5410', eye: '#3a2e06', glow: '#fff0a0' },
    // qilin
    qflame:   { body: '#e6693a', shade: '#b8401c', belly: '#ffcfa0', accent: '#6e2408', eye: '#2e0c04', glow: '#ffb06a' },
    qjade:    { body: '#4fbf7a', shade: '#2f8f52', belly: '#dcfbe0', accent: '#134a2c', eye: '#0c2d1a', glow: '#8affc0' },
    qstorm:   { body: '#c9a4f0', shade: '#9a6cd6', belly: '#efe4ff', accent: '#3f2a6e', eye: '#1e1237', glow: '#e0c8ff' },
    // genbu
    gstone:   { body: '#7a8a7a', shade: '#4f5f4f', belly: '#cdd8cd', accent: '#26302a', eye: '#e0f0e0', glow: '#b8d0b8' },
    gtide:    { body: '#2f8aa0', shade: '#1c5f70', belly: '#c8ecf2', accent: '#0c343f', eye: '#eaffff', glow: '#7fe0ee' },
    gastral:  { body: '#5a6cc0', shade: '#3a4890', belly: '#dce2ff', accent: '#1e285e', eye: '#fff0c8', glow: '#b0c0ff' },
    // chaos
    cvoid:    { body: '#332b4a', shade: '#1e1830', belly: '#6f6690', accent: '#0c0818', eye: '#8affe6', glow: '#8f7fd0' },
    cflux:    { body: '#a03a72', shade: '#6f224f', belly: '#f0c0dc', accent: '#2e0d20', eye: '#fff0ff', glow: '#ff8ad0' },
    cgold:    { body: '#c9a43a', shade: '#96761c', belly: '#fff0bf', accent: '#4a3808', eye: '#fffce0', glow: '#ffe884' },
  };

  const SPECIES = ['mushroom', 'crab', 'beetle', 'wisp', 'serpent', 'golem', 'avian', 'automaton', 'kraken', 'seraph', 'qilin', 'genbu', 'chaos'];

  function has(sp) { return SPECIES.indexOf(sp) >= 0; }
  function pal(sp, variant) { return (variant && VAR[variant]) ? VAR[variant] : (PAL[sp] || PAL.mushroom); }
  function foot(sp, g, unit) { return (g.stage <= 1) ? unit * 0.9 * 1.05 : unit * 0.98; }

  // 行为动画量:四种状态的动作性格明显不同(而非千篇一律的上下浮)。
  //   work=干劲十足的轻快弹跳+快速摆动;sleep=缓慢深呼吸并微沉;idle=轻柔起伏+偶尔眨眼张望;alert=受惊上蹿+睁大。
  function anim(behavior, t, unit) {
    const blink = (Math.sin(t * 2.3) > 0.9);
    if (behavior === 'work') { const hop = Math.abs(Math.sin(t * 4)); return { bob: -hop * unit * 0.11, eyeMode: 'open', mouth: 'work', blink, wave: Math.sin(t * 7) }; }
    if (behavior === 'sleep') { return { bob: unit * 0.02 + Math.sin(t * 1.3) * unit * 0.05, eyeMode: 'closed', mouth: 'sleep', blink: true, wave: Math.sin(t * 1.3) * 0.4 }; }
    if (behavior === 'idle') { return { bob: Math.sin(t * 1.8) * unit * 0.04, eyeMode: (Math.sin(t * 0.8) > 0.82) ? 'closed' : 'open', mouth: 'line', blink, wave: Math.sin(t * 1.6) }; }
    const j = Math.max(0, Math.sin(t * 6)); return { bob: -j * unit * 0.18, eyeMode: 'wide', mouth: 'open', blink: false, wave: Math.sin(t * 9) }; // alert 受惊上蹿
  }

  // 通用环绕装饰(光点花环/圣光大晕)已移除:避免滥用、避免掩盖宠物真实轮廓。
  // 高等级的华丽感只由「顶级形态的专属特效」(bake premium FX)承担,不再逐形态套通用环。
  function aura() { /* no-op */ }
  // 皇冠不再作为通用成长装饰(避免滥用:非顶级形态不应戴冠)。
  // 顶级皇冠仅由 bake 的 royal/gild 顶级特效按需绘制。此处保留空函数以兼容各渲染器调用。
  function crown() { /* no-op */ }

  const GROUND = 0.98; // 脚/底接地相对 unit

  // ============================================================
  // 1) 蘑菇菌灵 —— 宽伞 + 细柄(非圆形)
  function mushroom(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob); const gy = cy + unit * GROUND; const v = g.variant;
    pen.ell(cx, gy, unit * 0.62, unit * 0.14, 'rgba(0,0,0,0.3)');
    aura(pen, tk.hexA, cx, cy + bob, unit * 0.95, unit * 0.95, f, p.glow, t);
    // 柄(浅色,略束腰)
    const stalkTop = cy + bob - unit * 0.02, stalkBot = gy - unit * 0.02;
    pen.rect(cx - unit * 0.3, stalkTop, cx + unit * 0.3, stalkBot, p.accent);
    pen.rect(cx - unit * 0.24, stalkTop, cx + unit * 0.24, stalkBot, p.belly);
    pen.rect(cx - unit * 0.24, stalkTop, cx - unit * 0.12, stalkBot, tk.hexA(p.shade, 0.5));
    // 菌褶裙(f>=7)
    if (f >= 7) { pen.rect(cx - unit * 0.44, stalkTop + unit * 0.02, cx + unit * 0.44, stalkTop + unit * 0.14, p.shade); }
    // 伞盖:宽扁梯形穹顶
    const capY = cy + bob - unit * 0.4, capW = unit * (0.78 + Math.min(f, 8) * 0.02);
    pen.ell(cx, capY, capW + blk, unit * 0.5 + blk, p.accent);
    pen.ell(cx, capY, capW, unit * 0.5, p.body);
    pen.rect(cx - capW, capY + unit * 0.34, cx + capW, capY + unit * 0.5, p.shade); // 伞下缘压平
    pen.ell(cx, capY - unit * 0.16, capW * 0.6, unit * 0.16, tk.hexA(p.glow, 0.3)); // 顶高光
    // 伞斑(结构随 variant:spore=环形斑,toxin=竖条,lumen=发光点)
    const spot = tk.hexA(v === 'toxin' ? p.accent : p.belly, 0.92);
    if (v === 'toxin') { for (let i = -1; i <= 1; i++) pen.rect(cx + i * capW * 0.5 - blk, capY - unit * 0.2, cx + i * capW * 0.5 + blk, capY + unit * 0.18, spot); }
    else { const sp = [[-0.45, 0.02], [0.4, -0.1], [0.02, -0.22], [-0.1, 0.2], [0.5, 0.16]]; for (let i = 0; i < (f >= 5 ? 5 : 3); i++) { const s = sp[i]; pen.dot(cx + s[0] * capW, capY + s[1] * unit, v === 'lumen' ? tk.hexA(p.glow, 0.9) : spot); } }
    // 脸(在柄上)
    const fy = cy + bob + unit * 0.18;
    tk.eyes(pen, cx, fy, unit * 0.09, unit * 0.16, p.eye, A.eyeMode, A.blink);
    tk.mouth(pen, cx, fy + unit * 0.16, unit, p.eye, A.mouth);
    // 小脚(f>=3)
    if (f >= 3) { pen.rect(cx - unit * 0.24, gy - unit * 0.08, cx - unit * 0.06, gy, p.accent); pen.rect(cx + unit * 0.06, gy - unit * 0.08, cx + unit * 0.24, gy, p.accent); }
    if (f >= 11) crown(pen, cx, capY - unit * 0.5, unit);
    // 孢子飘散
    for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.4) % 1; pen.dot(cx + (i - 1) * capW * 0.5, capY - unit * 0.3 - ph * unit * 0.5, tk.hexA(p.glow, 0.5 * (1 - ph))); }
  }

  // ============================================================
  // 2) 甲蟹 —— 宽扁甲壳 + 双螯 + 柄眼(非圆形)
  function crab(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.9, unit * 0.14, 'rgba(0,0,0,0.3)');
    aura(pen, tk.hexA, cx, cyb, unit * 1.05, unit * 0.8, f, p.glow, t);
    // 步足(f>=3):两侧各 2-3 节
    if (f >= 3) { const legs = f >= 6 ? 3 : 2; for (let d = -1; d <= 1; d += 2) for (let i = 0; i < legs; i++) { const lx = cx + d * (unit * 0.7 + i * unit * 0.16); pen.rect(cx + d * unit * 0.55, cyb + unit * 0.18, lx, cyb + unit * 0.26, p.shade); pen.rect(lx - blk, cyb + unit * 0.24, lx + blk, gy, p.accent); } }
    // 双螯(大钳:方块臂 + 开合)
    const claw = snap((behavior === 'alert' ? 0.16 : (behavior === 'work' ? Math.abs(A.wave) * 0.12 : 0.06)) * unit);
    for (let d = -1; d <= 1; d += 2) {
      const ax = cx + d * unit * 0.86;
      pen.rect(cx + d * unit * 0.6, cyb - unit * 0.02, ax, cyb + unit * 0.16, p.shade); // 臂
      pen.rect(ax - unit * 0.2, cyb - unit * 0.28, ax + unit * 0.24, cyb - unit * 0.02, p.body); // 钳上
      pen.rect(ax - unit * 0.2, cyb + unit * 0.02 + claw, ax + unit * 0.24, cyb + unit * 0.2 + claw, p.body); // 钳下(开合)
      pen.rect(ax - unit * 0.22, cyb - unit * 0.3, ax + unit * 0.26, cyb - unit * 0.28 + blk, p.accent);
    }
    // 甲壳:宽扁六边(用两层 rect 叠角)
    pen.rect(cx - unit * 0.7, cyb - unit * 0.18, cx + unit * 0.7, cyb + unit * 0.22, p.accent);
    pen.rect(cx - unit * 0.66, cyb - unit * 0.22, cx + unit * 0.66, cyb + unit * 0.2, p.body);
    pen.rect(cx - unit * 0.52, cyb - unit * 0.3, cx + unit * 0.52, cyb - unit * 0.2, p.body); // 甲壳隆起
    pen.rect(cx - unit * 0.5, cyb + unit * 0.06, cx + unit * 0.5, cyb + unit * 0.2, p.belly);
    // 甲纹(结构随 variant:reef=横棱, riptide=波点, abyssal=中央棱脊+发光)
    if (v === 'abyssal') { pen.rect(cx - blk, cyb - unit * 0.28, cx + blk, cyb + unit * 0.16, tk.hexA(p.glow, 0.7)); }
    else if (v === 'riptide') { for (let i = -1; i <= 1; i++) pen.dot(cx + i * unit * 0.34, cyb - unit * 0.06, tk.hexA(p.belly, 0.9)); }
    else { for (let i = -1; i <= 1; i++) pen.rect(cx + i * unit * 0.34 - blk * 0.5, cyb - unit * 0.16, cx + i * unit * 0.34 + blk * 0.5, cyb + unit * 0.14, tk.hexA(p.accent, 0.5)); }
    // 柄眼(两根短柄立在甲上)
    const ey = cyb - unit * 0.42;
    for (let d = -1; d <= 1; d += 2) { pen.rect(cx + d * unit * 0.22 - blk * 0.5, cyb - unit * 0.3, cx + d * unit * 0.22 + blk * 0.5, ey, p.accent); }
    tk.eyes(pen, cx, ey - unit * 0.02, unit * 0.08, unit * 0.22, p.eye, A.eyeMode, A.blink);
    tk.mouth(pen, cx, cyb + unit * 0.04, unit, p.accent, A.mouth === 'open' ? 'open' : 'line');
    if (f >= 11) crown(pen, cx, cyb - unit * 0.56, unit);
  }

  // ============================================================
  // 3) 甲虫 —— 圆甲壳 + 独角 + 六足(角形随 variant)
  function beetle(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.7, unit * 0.13, 'rgba(0,0,0,0.3)');
    aura(pen, tk.hexA, cx, cyb, unit * 0.9, unit * 0.95, f, p.glow, t);
    // 六足(f>=3)
    if (f >= 3) for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const yy = cyb - unit * 0.1 + i * unit * 0.22; const kick = snap(behavior === 'work' ? Math.sin(t * 6 + i) * unit * 0.05 : 0); pen.rect(cx + d * unit * 0.34, yy, cx + d * (unit * 0.66 + i * 0.02), yy + blk, p.accent); pen.rect(cx + d * (unit * 0.6), yy, cx + d * unit * 0.72, yy + unit * 0.16 + kick, p.accent); }
    // 头(前端小圆)
    const hy = cyb - unit * 0.56;
    pen.ell(cx, hy, unit * 0.3, unit * 0.24, p.shade);
    // 独角(结构随 variant:forest=单直角, iron=双叉角, volt=闪电折角)
    if (v === 'iron') { for (let d = -1; d <= 1; d += 2) pen.triangle(cx + d * unit * 0.1, hy - unit * 0.02, unit * 0.07, cx + d * unit * 0.22, hy - unit * 0.6, p.body); }
    else if (v === 'volt') { pen.rect(cx - blk * 0.5, hy - unit * 0.55, cx + blk * 0.5, hy, p.glow); pen.rect(cx - unit * 0.14, hy - unit * 0.36, cx + blk * 0.5, hy - unit * 0.24, p.glow); }
    else { pen.triangle(cx, hy - unit * 0.02, unit * 0.09, cx, hy - unit * 0.62, p.body); pen.triangle(cx, hy - unit * 0.4, unit * 0.05, cx - unit * 0.14, hy - unit * 0.5, p.body); }
    // 甲壳(椭圆但有中缝 + 鞘翅分界 → 非通用blob)
    pen.ell(cx, cyb, unit * 0.62 + blk, unit * 0.7 + blk, p.accent);
    pen.ell(cx, cyb, unit * 0.62, unit * 0.7, p.body);
    pen.rect(cx - blk * 0.5, cyb - unit * 0.6, cx + blk * 0.5, cyb + unit * 0.6, p.accent); // 中缝
    pen.ell(cx, cyb - unit * 0.4, unit * 0.34, unit * 0.16, tk.hexA(p.glow, 0.28)); // 高光
    // 鞘翅斑点(f>=5)
    if (f >= 5) { for (let d = -1; d <= 1; d += 2) { pen.dot(cx + d * unit * 0.3, cyb - unit * 0.1, tk.hexA(p.accent, 0.6)); pen.dot(cx + d * unit * 0.26, cyb + unit * 0.24, tk.hexA(p.accent, 0.6)); } }
    // 眼
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.14, p.eye, A.eyeMode, A.blink);
    if (f >= 11) crown(pen, cx, hy - unit * 0.64, unit);
  }

  // ============================================================
  // 4) 幽灯 —— 火焰水滴(尖顶悬浮,无腿)+ 核心
  function wisp(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const hover = snap(Math.sin(t * (2.2 + gf * 1.5)) * unit * 0.08); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + hover;
    pen.ell(cx, gy, unit * 0.34, unit * 0.1, 'rgba(0,0,0,0.28)'); // 悬浮小影
    // 摇曳幅度/频率随成长增强(动作演进)
    const sway = snap(Math.sin(t * (3 + gf)) * unit * 0.08);
    // 侧火苗(st1:两簇随成长冒出并摇曳)
    if (st >= 1) [-1, 1].forEach((d) => { const s2 = snap(Math.sin(t * 4 + d) * unit * 0.06); pen.triangle(cx + d * unit * 0.36, cyb + unit * 0.34, unit * 0.1, cx + d * unit * 0.44 + s2, cyb - unit * (0.06 + 0.1 * gf), tk.hexA(p.glow, 0.85)); });
    // 火焰体:下宽上尖(随成长更高)
    pen.triangle(cx, cyb + unit * 0.6, unit * 0.5, cx + sway, cyb - unit * (0.72 + 0.12 * gf), p.accent);
    pen.triangle(cx, cyb + unit * 0.56, unit * 0.42, cx + sway, cyb - unit * 0.66, p.body);
    pen.triangle(cx, cyb + unit * 0.5, unit * 0.24, cx + sway * 0.6, cyb - unit * 0.5, tk.hexA(p.glow, 0.7)); // 内焰
    pen.ell(cx, cyb + unit * 0.5, unit * 0.5 + blk, unit * 0.24, p.accent);
    pen.ell(cx, cyb + unit * 0.5, unit * 0.5, unit * 0.24, p.body);
    // 核心(结构随 variant:ember=火星环, hoarfrost=冰核晶, nether=双核眼)
    if (v === 'hoarfrost') { pen.triangle(cx, cyb + unit * 0.1, unit * 0.1, cx, cyb - unit * 0.24, tk.hexA(p.belly, 0.95)); }
    else if (v === 'nether') { pen.dot(cx - unit * 0.12, cyb - unit * 0.05, tk.hexA(p.glow, 0.9)); pen.dot(cx + unit * 0.12, cyb - unit * 0.05, tk.hexA(p.glow, 0.9)); }
    else { pen.ell(cx, cyb + unit * 0.02, unit * 0.14, unit * 0.16, tk.hexA(p.glow, 0.8)); }
    // 脸(核心处)
    tk.eyes(pen, cx, cyb + unit * 0.14, unit * 0.08, unit * 0.15, p.eye, A.eyeMode, A.blink);
    tk.mouth(pen, cx, cyb + unit * 0.3, unit, p.eye, A.mouth);
    // 提灯环(st2:环绕光点,数量随成长)
    if (st >= 2) { const n = 4 + Math.round(gf * 2); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * unit * 0.6, cyb + unit * 0.2 + Math.sin(a) * unit * 0.3, tk.hexA(p.glow, 0.7)); } }
    // 上升火星流(st3)
    if (st >= 3) for (let i = 0; i < 4; i++) { const ph = (t * 0.6 + i * 0.25) % 1; pen.dot(cx + sway + Math.sin(i * 2 + t) * unit * 0.2, cyb - unit * 0.72 - ph * unit * 0.5, tk.hexA(p.glow, 0.7 * (1 - ph))); }
  }

  // ============================================================
  // 5) 灵蛇 —— 盘蜷身 + 立起颈盾(无腿)
  function serpent(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.7, unit * 0.13, 'rgba(0,0,0,0.3)');
    aura(pen, tk.hexA, cx, cyb, unit * 0.95, unit * 0.95, f, p.glow, t);
    // 盘蜷(两层同心扁环)
    pen.ell(cx, gy - unit * 0.1, unit * 0.72, unit * 0.34, p.accent);
    pen.ell(cx, gy - unit * 0.1, unit * 0.64, unit * 0.28, p.body);
    pen.ell(cx, gy - unit * 0.16, unit * 0.44, unit * 0.2, p.accent);
    pen.ell(cx, gy - unit * 0.16, unit * 0.36, unit * 0.16, p.shade);
    // 蜷纹(菱形背纹)
    for (let i = -1; i <= 1; i++) pen.triangle(cx + i * unit * 0.34, gy - unit * 0.02, unit * 0.06, cx + i * unit * 0.34, gy - unit * 0.24, tk.hexA(p.belly, 0.8));
    // 立起的躯干(竖 S)
    const neckX = cx + snap(Math.sin(t * 2) * unit * 0.06);
    pen.rect(cx - unit * 0.14, cyb - unit * 0.1, cx + unit * 0.14, gy - unit * 0.16, p.accent);
    pen.rect(cx - unit * 0.1, cyb - unit * 0.1, cx + unit * 0.1, gy - unit * 0.16, p.body);
    // 颈盾(眼镜蛇兜帽,结构随 variant:gale=尖帽, venom=宽帽带纹, levin=锯齿帽)
    const hy = cyb - unit * 0.3;
    if (v === 'levin') { for (let d = -1; d <= 1; d += 2) pen.triangle(neckX + d * unit * 0.1, hy + unit * 0.1, unit * 0.08, neckX + d * unit * 0.5, hy - unit * 0.06, p.glow); }
    else { const hw = v === 'venom' ? 0.5 : 0.4; pen.triangle(neckX, hy + unit * 0.2, unit * hw, neckX, hy - unit * 0.14, p.shade); if (v === 'venom') pen.dot(neckX, hy, tk.hexA(p.glow, 0.9)); }
    // 头
    pen.ell(neckX, hy, unit * 0.24, unit * 0.2, p.body);
    pen.ell(neckX, hy, unit * 0.24 + blk, unit * 0.2 + blk, p.accent); pen.ell(neckX, hy, unit * 0.24, unit * 0.2, p.body);
    tk.eyes(pen, neckX, hy - unit * 0.02, unit * 0.07, unit * 0.13, p.eye, A.eyeMode, A.blink);
    // 吐信
    if (Math.sin(t * 4) > 0) { pen.rect(neckX - blk * 0.5, hy + unit * 0.12, neckX + blk * 0.5, hy + unit * 0.32, '#e5484d'); pen.triangle(neckX, hy + unit * 0.36, blk, neckX, hy + unit * 0.28, '#e5484d'); }
    if (f >= 11) crown(pen, neckX, hy - unit * 0.2, unit);
  }

  // ============================================================
  // 6) 石魄 —— 方块岩体(纯直角堆叠)+ 裂纹发光
  function golem(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.14)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob * 0.6); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.8, unit * 0.14, 'rgba(0,0,0,0.32)');
    aura(pen, tk.hexA, cx, cyb, unit * 0.9, unit * 0.95, f, p.glow, t);
    // 腿(方块,f>=3)
    if (f >= 3) { pen.rect(cx - unit * 0.4, gy - unit * 0.3, cx - unit * 0.1, gy, p.shade); pen.rect(cx + unit * 0.1, gy - unit * 0.3, cx + unit * 0.4, gy, p.shade); }
    // 手臂(方块块,f>=10)
    if (f >= 10) { const sw = snap(behavior === 'work' ? A.wave * unit * 0.12 : 0); pen.rect(cx - unit * 0.86, cyb - unit * 0.1 + sw, cx - unit * 0.56, cyb + unit * 0.34 + sw, p.shade); pen.rect(cx + unit * 0.56, cyb - unit * 0.1 - sw, cx + unit * 0.86, cyb + unit * 0.34 - sw, p.shade); }
    // 躯干(大方块 + 台阶肩)
    pen.rect(cx - unit * 0.56, cyb - unit * 0.34, cx + unit * 0.56, cyb + unit * 0.5, p.accent);
    pen.rect(cx - unit * 0.5, cyb - unit * 0.3, cx + unit * 0.5, cyb + unit * 0.46, p.body);
    pen.rect(cx - unit * 0.5, cyb - unit * 0.3, cx - unit * 0.2, cyb + unit * 0.1, tk.hexA(p.shade, 0.6)); // 侧阴影
    // 头(小方块坐在躯干上)
    const hy = cyb - unit * 0.56;
    pen.rect(cx - unit * 0.3, hy - unit * 0.2, cx + unit * 0.3, hy + unit * 0.24, p.accent);
    pen.rect(cx - unit * 0.26, hy - unit * 0.16, cx + unit * 0.26, hy + unit * 0.2, p.body);
    // 裂纹发光(结构随 variant:granite=浅裂, geode=镶嵌晶簇, magmacore=熔岩裂缝)
    if (v === 'geode') { for (let i = 0; i < 3; i++) pen.triangle(cx + (i - 1) * unit * 0.3, cyb + unit * 0.1, unit * 0.08, cx + (i - 1) * unit * 0.3, cyb - unit * 0.16, tk.hexA(p.glow, 0.85)); }
    else if (v === 'magmacore') { pen.rect(cx - unit * 0.4, cyb + unit * 0.02, cx + unit * 0.1, cyb + unit * 0.06, tk.hexA(p.glow, 0.9)); pen.rect(cx - unit * 0.05, cyb - unit * 0.2, cx + unit * 0.02, cyb + unit * 0.3, tk.hexA(p.glow, 0.9)); }
    else { pen.rect(cx - unit * 0.2, cyb - unit * 0.1, cx - unit * 0.15, cyb + unit * 0.3, tk.hexA(p.accent, 0.7)); pen.rect(cx + unit * 0.05, cyb + unit * 0.06, cx + unit * 0.3, cyb + unit * 0.1, tk.hexA(p.accent, 0.7)); }
    // 眼(发光横条)
    pen.rect(cx - unit * 0.18, hy, cx - unit * 0.04, hy + (A.eyeMode === 'closed' ? blk : unit * 0.09), tk.hexA(p.eye, 0.95));
    pen.rect(cx + unit * 0.04, hy, cx + unit * 0.18, hy + (A.eyeMode === 'closed' ? blk : unit * 0.09), tk.hexA(p.eye, 0.95));
    if (f >= 11) crown(pen, cx, hy - unit * 0.24, unit);
  }

  // ============================================================
  // 7) 羽禽 —— 直立鸟身 + 喙 + 折/展翼 + 尾羽扇
  function avian(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const bob = snap(A.bob); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 尾羽扇(数量随成长增多;结构随 variant)
    const tailN = (v === 'tempest' ? 5 : 3) + (st >= 2 ? 2 : 0); const tailLen = (v === 'phoenix' ? 0.9 : 0.6) + 0.15 * gf;
    for (let i = 0; i < tailN; i++) { const a = -Math.PI / 2 + (i - (tailN - 1) / 2) * 0.3; const tx = cx + Math.cos(a) * unit * tailLen, ty = cyb + unit * 0.5 - Math.sin(a) * unit * tailLen * 0.5 + unit * 0.4; pen.triangle(cx, cyb + unit * 0.4, unit * 0.1, tx, ty, i % 2 ? p.shade : (v === 'phoenix' ? p.glow : p.body)); }
    // 腿(st1)
    if (st >= 1) { pen.rect(cx - unit * 0.16, cyb + unit * 0.42, cx - unit * 0.08, gy, p.accent); pen.rect(cx + unit * 0.08, cyb + unit * 0.42, cx + unit * 0.16, gy, p.accent); pen.rect(cx - unit * 0.24, gy - blk, cx - unit * 0.02, gy, p.accent); pen.rect(cx + unit * 0.02, gy - blk, cx + unit * 0.24, gy, p.accent); }
    // 翼(st2 展开,振翅随成长/行为更大)
    const spread = st >= 2 ? (behavior === 'alert' || behavior === 'work' ? snap(Math.abs(A.wave) * unit * (0.3 + 0.2 * gf)) : snap((0.1 + 0.08 * gf) * unit)) : 0;
    for (let d = -1; d <= 1; d += 2) { pen.triangle(cx + d * unit * 0.3, cyb + unit * 0.1, unit * 0.14, cx + d * (unit * 0.5 + spread), cyb - unit * 0.3 - spread, p.shade); if (st >= 2) pen.triangle(cx + d * unit * 0.3, cyb + unit * 0.14, unit * 0.09, cx + d * (unit * 0.5 + spread), cyb - unit * 0.1 - spread, tk.hexA(p.belly, 0.9)); if (st >= 3) pen.triangle(cx + d * unit * 0.3, cyb + unit * 0.06, unit * 0.07, cx + d * (unit * 0.66 + spread), cyb - unit * 0.5 - spread, tk.hexA(p.glow, 0.85)); }
    // 身体(卵立,略瘦高)
    pen.ell(cx, cyb, unit * 0.4 + blk, unit * 0.56 + blk, p.accent);
    pen.ell(cx, cyb, unit * 0.4, unit * 0.56, p.body);
    pen.ell(cx, cyb + unit * 0.12, unit * 0.3, unit * 0.36, p.belly);
    // 头(上端)+ 冠羽(st1,随成长增高)
    const hy = cyb - unit * 0.5;
    pen.ell(cx, hy, unit * 0.28, unit * 0.26, p.body);
    if (st >= 1) { pen.triangle(cx, hy - unit * 0.2, unit * 0.06, cx + unit * 0.02, hy - unit * (0.44 + 0.14 * gf), v === 'phoenix' ? p.glow : p.shade); if (v === 'tempest') pen.triangle(cx - unit * 0.08, hy - unit * 0.18, unit * 0.05, cx - unit * 0.12, hy - unit * 0.44, p.shade); }
    // 喙(三角)
    pen.triangle(cx + unit * 0.24, hy - unit * 0.02, unit * 0.07, cx + unit * 0.46, hy + unit * 0.02, '#ffca3a');
    tk.eyes(pen, cx + unit * 0.02, hy - unit * 0.02, unit * 0.07, unit * 0.12, p.eye, A.eyeMode, A.blink);
    // 尾梢流光 + 光羽环(st3)
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + t * 0.8; pen.dot(cx + Math.cos(a) * unit * 0.7, cyb + Math.sin(a) * unit * 0.5, tk.hexA(p.glow, 0.5 + 0.35 * Math.sin(t * 4 + i))); }
  }

  // ============================================================
  // 8) 机偶 —— 方体机械 + 天线 + 单目护罩 + 分段臂
  function automaton(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const bob = snap(A.bob * 0.7); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.62, unit * 0.13, 'rgba(0,0,0,0.32)');
    // 腿(st1)
    if (st >= 1) { pen.rect(cx - unit * 0.36, gy - unit * 0.3, cx - unit * 0.12, gy, p.shade); pen.rect(cx + unit * 0.12, gy - unit * 0.3, cx + unit * 0.36, gy, p.shade); pen.rect(cx - unit * 0.4, gy - blk, cx - unit * 0.08, gy, p.accent); pen.rect(cx + unit * 0.08, gy - blk, cx + unit * 0.4, gy, p.accent); }
    // 分段臂(st2,work 摆动)
    if (st >= 2) { const sw = snap(behavior === 'work' ? A.wave * unit * 0.14 : 0); for (let d = -1; d <= 1; d += 2) { pen.rect(cx + d * unit * 0.5, cyb - unit * 0.1, cx + d * unit * 0.66, cyb + unit * 0.06, p.shade); pen.rect(cx + d * unit * 0.6, cyb + unit * 0.02 + (d < 0 ? sw : -sw), cx + d * unit * 0.78, cyb + unit * 0.3 + (d < 0 ? sw : -sw), p.body); } }
    // 躯干(方箱 + 面板线)
    pen.rect(cx - unit * 0.46, cyb - unit * 0.28, cx + unit * 0.46, cyb + unit * 0.44, p.accent);
    pen.rect(cx - unit * 0.4, cyb - unit * 0.24, cx + unit * 0.4, cyb + unit * 0.4, p.body);
    pen.rect(cx - unit * 0.3, cyb + unit * 0.06, cx + unit * 0.3, cyb + unit * 0.1, tk.hexA(p.accent, 0.6));
    // 肩部推进器(st3:喷口 + 脉动光)
    if (st >= 3) [-1, 1].forEach((d) => { pen.rect(cx + d * unit * 0.46, cyb - unit * 0.26, cx + d * unit * 0.6, cyb - unit * 0.1, p.shade); pen.dot(cx + d * unit * 0.53, cyb - unit * 0.06, tk.hexA(p.glow, 0.6 + 0.35 * Math.abs(Math.sin(t * 5)))); });
    // 胸口指示(结构随 variant:cog=齿轮点, arc=电弧竖线, plasma=菱形核;脉动随成长)
    const cg = tk.hexA(p.glow, 0.7 + 0.25 * Math.sin(t * (3 + gf * 2)));
    if (v === 'arc') { pen.rect(cx - blk * 0.5, cyb - unit * 0.16, cx + blk * 0.5, cyb + unit * 0.3, cg); }
    else if (v === 'plasma') { pen.triangle(cx, cyb + unit * 0.2, unit * 0.1, cx, cyb - unit * 0.12, cg); pen.triangle(cx, cyb - unit * 0.12, unit * 0.1, cx, cyb + unit * 0.2, cg); }
    else { pen.ell(cx, cyb + unit * 0.06, unit * 0.1, unit * 0.1, cg); }
    // 头(方 + 单目护罩,扫描位移)
    const hy = cyb - unit * 0.48; const scan = snap(Math.sin(t * 3) * unit * 0.05);
    pen.rect(cx - unit * 0.3, hy - unit * 0.2, cx + unit * 0.3, hy + unit * 0.2, p.accent);
    pen.rect(cx - unit * 0.26, hy - unit * 0.16, cx + unit * 0.26, hy + unit * 0.16, p.body);
    pen.rect(cx - unit * 0.2, hy - unit * 0.02, cx + unit * 0.2, hy + (A.eyeMode === 'closed' ? blk : unit * 0.08), tk.hexA(p.eye, 0.3)); // 目条底
    pen.rect(cx - unit * 0.06 + scan, hy - unit * 0.02, cx + unit * 0.06 + scan, hy + (A.eyeMode === 'closed' ? blk : unit * 0.08), tk.hexA(p.eye, 0.95)); // 扫描目
    // 天线(st1,顶灯脉动)
    if (st >= 1) { pen.rect(cx - blk * 0.5, hy - unit * 0.44, cx + blk * 0.5, hy - unit * 0.18, p.shade); pen.dot(cx, hy - unit * 0.48, tk.hexA(p.glow, 0.6 + 0.35 * Math.abs(Math.sin(t * 6)))); }
    // 天线增列(st3)
    if (st >= 3) [-1, 1].forEach((d) => { pen.rect(cx + d * unit * 0.16 - blk * 0.4, hy - unit * 0.36, cx + d * unit * 0.16 + blk * 0.4, hy - unit * 0.18, p.shade); pen.dot(cx + d * unit * 0.16, hy - unit * 0.38, tk.hexA(p.glow, 0.7)); });
  }

  // ============================================================
  // 9) 渊妖 —— 头足(套膜穹顶 + 多触手垂坠)
  function kraken(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const hover = snap(Math.sin(t * 2) * unit * 0.05); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + hover;
    pen.ell(cx, gy, unit * 0.7, unit * 0.12, 'rgba(0,0,0,0.28)');
    // 触手(多条竖波带,数量随成长;摆动随成长更活)
    const arms = Math.min(3 + Math.floor(f / 3), 7);
    for (let i = 0; i < arms; i++) {
      const bx = cx + (i - (arms - 1) / 2) * (unit * 1.2 / arms);
      const wig = snap(Math.sin(t * (3 + gf) + i) * unit * 0.08);
      pen.rect(bx - blk * 0.6, cyb + unit * 0.1, bx + blk * 0.6, cyb + unit * 0.4, p.shade);
      pen.rect(bx - blk * 0.6 + wig, cyb + unit * 0.36, bx + blk * 0.6 + wig, cyb + unit * 0.62, p.body);
      pen.triangle(bx + wig, gy, blk, bx + wig, cyb + unit * 0.58, p.shade);
      if (st >= 2 || v === 'voidsea') pen.dot(bx + wig * 0.5, cyb + unit * 0.5, tk.hexA(p.glow, 0.8)); // 发光吸盘(st2)
    }
    // 套膜(尖顶钟形)
    pen.triangle(cx, cyb + unit * 0.2, unit * 0.6, cx, cyb - unit * 0.6, p.accent);
    pen.triangle(cx, cyb + unit * 0.16, unit * 0.52, cx, cyb - unit * 0.54, p.body);
    pen.ell(cx, cyb + unit * 0.14, unit * 0.52 + blk, unit * 0.24 + blk, p.accent); pen.ell(cx, cyb + unit * 0.14, unit * 0.52, unit * 0.24, p.body);
    // 冠须(st1:头顶两根感须,摆动)
    if (st >= 1) [-1, 1].forEach((d) => { const cw = snap(Math.sin(t * 2.5 + d) * unit * 0.06); pen.rect(cx + d * unit * 0.14, cyb - unit * 0.56, cx + d * unit * 0.18, cyb - unit * 0.3, p.shade); pen.dot(cx + d * unit * 0.16 + cw, cyb - unit * 0.58, tk.hexA(p.glow, 0.8)); });
    // 膜纹(结构随 variant)
    if (v === 'caustic') { for (let i = -1; i <= 1; i++) pen.dot(cx + i * unit * 0.24, cyb - unit * 0.2, tk.hexA(p.glow, 0.85)); }
    else if (v === 'tidal') { pen.rect(cx - unit * 0.4, cyb - unit * 0.1, cx + unit * 0.4, cyb - unit * 0.06, tk.hexA(p.belly, 0.7)); }
    // 大眼
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.11, unit * 0.2, p.eye, A.eyeMode === 'closed' ? 'closed' : 'wide', A.blink);
    // 膜顶发光斑冠(st3)
    if (st >= 3) for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.5 + (i - 2) * 0.4; pen.dot(cx + Math.cos(a) * unit * 0.4, cyb - unit * 0.42 + Math.sin(a) * unit * 0.18, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 4 + i))); }
    // 墨雾涌动(st3,work/alert)
    if (st >= 3 && (behavior === 'work' || behavior === 'alert')) for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.33) % 1; pen.dot(cx + (i - 1) * unit * 0.3, cyb + unit * 0.66 + ph * unit * 0.2, tk.hexA(p.glow, 0.4 * (1 - ph))); }
  }

  // ============================================================
  // 10) 星辉构装 —— 人形核心 + 头顶光环 + 多翼 + 浮片(最华丽)
  function seraph(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const hover = snap(Math.sin(t * 2) * unit * (0.05 + 0.04 * gf)); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + hover;
    pen.ell(cx, gy, unit * 0.5, unit * 0.11, 'rgba(0,0,0,0.26)');
    // 多翼(基础 2 片;st2 +1;astralite/st3 再 +1;振翅随成长)
    const wings = 2 + (st >= 2 ? 1 : 0) + ((v === 'astralite' || st >= 3) ? 1 : 0);
    const wf = snap(Math.abs(Math.sin(t * 2.5)) * unit * (0.04 + 0.06 * gf));
    for (let d = -1; d <= 1; d += 2) for (let w = 0; w < wings; w++) { const up = unit * (0.1 + w * 0.24) + wf; pen.triangle(cx + d * unit * 0.24, cyb + unit * 0.1, unit * 0.12, cx + d * (unit * 0.7), cyb - up, w === 0 ? p.shade : p.body); pen.triangle(cx + d * unit * 0.24, cyb + unit * 0.08, unit * 0.07, cx + d * (unit * 0.62), cyb - up + unit * 0.04, tk.hexA(p.belly, 0.95)); }
    // 浮片(环绕水晶碎片,st2;数量/转速随成长)
    if (st >= 2) { const n = 4 + Math.round(gf * 2); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + t * (0.8 + gf * 0.5); pen.triangle(cx + Math.cos(a) * unit * 0.85, cyb + Math.sin(a) * unit * 0.5 + unit * 0.05, unit * 0.06, cx + Math.cos(a) * unit * 0.85, cyb + Math.sin(a) * unit * 0.5 - unit * 0.1, tk.hexA(p.glow, 0.85)); } }
    // 下摆/裙裾
    pen.triangle(cx, gy, unit * 0.4, cx, cyb - unit * 0.1, p.accent);
    pen.triangle(cx, gy - blk, unit * 0.34, cx, cyb - unit * 0.06, p.body);
    pen.triangle(cx, gy - blk, unit * 0.18, cx, cyb, tk.hexA(p.belly, 0.8));
    // 躯干(细长)
    pen.rect(cx - unit * 0.16, cyb - unit * 0.22, cx + unit * 0.16, cyb + unit * 0.24, p.accent);
    pen.rect(cx - unit * 0.12, cyb - unit * 0.2, cx + unit * 0.12, cyb + unit * 0.22, p.body);
    pen.dot(cx, cyb - unit * 0.02, tk.hexA('#ffd54a', 0.95)); // 镶金胸饰
    // 头(小 + 面纱)
    const hy = cyb - unit * 0.4;
    pen.ell(cx, hy, unit * 0.2 + blk, unit * 0.22 + blk, p.accent); pen.ell(cx, hy, unit * 0.2, unit * 0.22, p.body);
    tk.eyes(pen, cx, hy, unit * 0.06, unit * 0.1, p.eye, A.eyeMode, A.blink);
    // 头顶光环(结构随 variant:sacred=单环, astral=星环, auric=双环)
    const ry = hy - unit * 0.36;
    const ringCol = v === 'astralite' ? p.glow : '#ffe27a';
    pen.ell(cx, ry, unit * 0.26, unit * 0.09, tk.hexA(ringCol, 0.95));
    pen.ell(cx, ry, unit * 0.2, unit * 0.06, 'rgba(0,0,0,0)');
    if (v === 'auric') { pen.ell(cx, ry - unit * 0.06, unit * 0.16, unit * 0.06, tk.hexA(ringCol, 0.9)); }
    if (v === 'astralite') for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * unit * 0.26, ry + Math.sin(a) * unit * 0.09, tk.hexA(p.glow, 0.9)); }
    // 圣光符文环(st3:头顶外圈缓转硬边光点)
    if (st >= 3) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 0.6; pen.rect(cx + Math.cos(a) * unit * 0.36 - blk * 0.4, ry + Math.sin(a) * unit * 0.13 - blk * 0.4, cx + Math.cos(a) * unit * 0.36 + blk * 0.4, ry + Math.sin(a) * unit * 0.13 + blk * 0.4, tk.hexA(ringCol, 0.6)); }
  }

  // ============================================================
  // 11) 麒麟 Qilin —— 四足 + 鹿角 + 背脊火鬃(非圆形四足兽)
  function qilin(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob * 0.6); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.72, unit * 0.12, 'rgba(0,0,0,0.3)');
    aura(pen, tk.hexA, cx, cyb, unit * 0.95, unit * 0.9, f, p.glow, t);
    // 四足
    if (f >= 3) [-0.5, -0.2, 0.28, 0.56].forEach((dx, i) => { const lx = cx + dx * unit; const kick = snap(behavior === 'work' ? Math.sin(t * 6 + i) * unit * 0.04 : 0); pen.rect(lx - blk * 0.6, cyb + unit * 0.16, lx + blk * 0.6, gy + kick, i % 2 ? p.accent : p.shade); });
    // 羽尾(火鬃)
    const tsw = snap(Math.sin(t * 3) * unit * 0.1);
    pen.triangle(cx - unit * 0.55, cyb + unit * 0.05, unit * 0.1, cx - unit * 0.92 + tsw, cyb - unit * 0.36, v === 'qflame' ? tk.hexA(p.glow, 0.9) : p.shade);
    // 躯干(横向长卵)
    pen.ell(cx, cyb + unit * 0.05, unit * 0.6 + blk, unit * 0.32 + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.05, unit * 0.6, unit * 0.32, p.body);
    pen.ell(cx, cyb + unit * 0.16, unit * 0.44, unit * 0.18, p.belly);
    // 背脊鬃(结构随 variant)
    for (let i = 0; i < 4; i++) { const mx = cx - unit * 0.28 + i * unit * 0.2; const col = v === 'qjade' ? p.glow : tk.hexA(p.glow, 0.88); pen.triangle(mx, cyb - unit * 0.24, unit * 0.05, mx + snap(Math.sin(t * 4 + i) * unit * 0.03), cyb - unit * 0.46 - ((i === 1 || i === 2) ? unit * 0.06 : 0), col); }
    // 颈 + 头(前抬)
    const hx = cx + unit * 0.5, hy = cyb - unit * 0.3;
    pen.rect(cx + unit * 0.3, cyb - unit * 0.28, cx + unit * 0.5, cyb + unit * 0.1, p.accent);
    pen.rect(cx + unit * 0.33, cyb - unit * 0.25, cx + unit * 0.47, cyb + unit * 0.06, p.body);
    pen.ell(hx, hy, unit * 0.24 + blk, unit * 0.2 + blk, p.accent); pen.ell(hx, hy, unit * 0.24, unit * 0.2, p.body);
    // 鹿角(f>=5:分叉)
    if (f >= 5) [-1, 1].forEach((d) => { pen.triangle(hx + d * unit * 0.08, hy - unit * 0.1, unit * 0.05, hx + d * unit * 0.16, hy - unit * 0.5, p.shade); pen.triangle(hx + d * unit * 0.14, hy - unit * 0.34, unit * 0.03, hx + d * unit * 0.32, hy - unit * 0.44, p.shade); });
    tk.eyes(pen, hx + unit * 0.04, hy, unit * 0.06, unit * 0.11, p.eye, A.eyeMode, A.blink);
    if (f >= 11) crown(pen, hx, hy - unit * 0.52, unit);
  }

  // ============================================================
  // 12) 玄武 Genbu —— 龟甲穹顶 + 四短足 + 蛇尾 + 前伸头
  function genbu(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const bob = snap(A.bob * 0.5); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.85, unit * 0.13, 'rgba(0,0,0,0.32)');
    aura(pen, tk.hexA, cx, cyb, unit * 1.0, unit * 0.85, f, p.glow, t);
    // 四短足
    if (f >= 3) [-0.58, -0.32, 0.32, 0.58].forEach((dx) => pen.rect(cx + dx * unit - blk, cyb + unit * 0.2, cx + dx * unit + blk, gy, p.shade));
    // 蛇尾(后方卷曲,末端尖)
    const tsw = snap(Math.sin(t * 2.5) * unit * 0.08);
    pen.rect(cx - unit * 0.72, cyb + unit * 0.1, cx - unit * 0.5, cyb + unit * 0.24, p.shade);
    pen.rect(cx - unit * 0.86 + tsw, cyb - unit * 0.04, cx - unit * 0.6, cyb + unit * 0.12, p.shade);
    pen.triangle(cx - unit * 0.86 + tsw, cyb - unit * 0.04, blk, cx - unit * 1.0 + tsw, cyb - unit * 0.2, p.accent);
    // 头(前伸)
    const hx = cx + unit * 0.62, hy = cyb + unit * 0.02;
    pen.rect(cx + unit * 0.42, cyb - unit * 0.02, cx + unit * 0.62, cyb + unit * 0.14, p.shade);
    pen.ell(hx, hy, unit * 0.2 + blk, unit * 0.16 + blk, p.accent); pen.ell(hx, hy, unit * 0.2, unit * 0.16, p.body);
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.05, unit * 0.09, p.eye, A.eyeMode, A.blink);
    // 龟甲(大穹顶)
    pen.ell(cx, cyb - unit * 0.05, unit * 0.66 + blk, unit * 0.5 + blk, p.accent);
    pen.ell(cx, cyb - unit * 0.05, unit * 0.66, unit * 0.5, p.shade);
    pen.ell(cx, cyb - unit * 0.1, unit * 0.5, unit * 0.38, p.body);
    pen.ell(cx, cyb - unit * 0.22, unit * 0.3, unit * 0.14, tk.hexA(p.glow, 0.28));
    // 甲纹(结构随 variant)
    if (v === 'gastral') { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 0.3; pen.dot(cx + Math.cos(a) * unit * 0.32, cyb - unit * 0.1 + Math.sin(a) * unit * 0.24, tk.hexA(p.glow, 0.85)); } }
    else if (v === 'gtide') { pen.ell(cx, cyb - unit * 0.1, unit * 0.3, unit * 0.2, tk.hexA(p.glow, 0.35)); }
    else { for (let i = 0; i < 3; i++) { pen.rect(cx - unit * 0.4 + i * unit * 0.4 - blk * 0.5, cyb - unit * 0.42, cx - unit * 0.4 + i * unit * 0.4 + blk * 0.5, cyb + unit * 0.18, tk.hexA(p.accent, 0.5)); } pen.rect(cx - unit * 0.46, cyb - unit * 0.12, cx + unit * 0.46, cyb - unit * 0.08, tk.hexA(p.accent, 0.5)); }
    if (f >= 11) crown(pen, cx, cyb - unit * 0.62, unit);
  }

  // ============================================================
  // 13) 混沌 Chaos —— 旋转菱形核体 + 多眼 + 能量环 + 触须(诡奇抽象体)
  function chaos(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const A = anim(behavior, t, unit);
    const hover = snap(Math.sin(t * 2) * unit * 0.05); const gy = cy + unit * GROUND; const v = g.variant; const cyb = cy + hover;
    pen.ell(cx, gy, unit * 0.45, unit * 0.1, 'rgba(0,0,0,0.26)');
    aura(pen, tk.hexA, cx, cyb, unit * 0.85, unit * 0.95, Math.max(f, 12), p.glow, t);
    function diam(px, py, R, color) { pen.triangle(px, py, R, px, py - R, color); pen.triangle(px, py, R, px, py + R, color); }
    // 触须(下垂多条,扭动)
    const arms = Math.min(3 + Math.floor(f / 3), 6);
    for (let i = 0; i < arms; i++) { const bx = cx + (i - (arms - 1) / 2) * (unit * 1.0 / arms); const wig = snap(Math.sin(t * 3 + i) * unit * 0.1); pen.rect(bx - blk * 0.5, cyb + unit * 0.24, bx + blk * 0.5, cyb + unit * 0.5, p.shade); pen.rect(bx - blk * 0.5 + wig, cyb + unit * 0.46, bx + blk * 0.5 + wig, gy, p.accent); }
    // 核体(层叠旋转菱形)
    diam(cx, cyb, unit * 0.55 + blk, p.accent);
    diam(cx, cyb, unit * 0.55, p.body);
    diam(cx, cyb, unit * 0.3, tk.hexA(p.glow, 0.6));
    // 多眼(f 越高越多)
    const eyeN = Math.min(2 + Math.floor(f / 4), 5);
    for (let i = 0; i < eyeN; i++) { const a = i * 1.9 + t * 0.15; const ex = cx + Math.cos(a) * unit * 0.28, ey = cyb + Math.sin(a) * unit * 0.24; pen.rect(ex - blk, ey - blk, ex + blk, ey + blk, p.belly); pen.dot(ex + (A.eyeMode === 'closed' ? 99 : 0), ey, p.eye); }
    // 主眼
    tk.eyes(pen, cx, cyb - unit * 0.04, unit * 0.09, unit * 0.16, p.eye, A.eyeMode, A.blink);
    // 能量环(旋转点环)
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 0.6; pen.dot(cx + Math.cos(a) * unit * 0.9, cyb + Math.sin(a) * unit * 0.55, tk.hexA(p.glow, 0.45 + 0.4 * Math.sin(t * 3 + i))); }
    if (f >= 11) crown(pen, cx, cyb - unit * 0.7, unit);
  }

  // ============================================================
  // ==== 分支专属构型(look):同一物种进化分叉后,不同分支是完全不同的生物 ====
  // 龙分支三型:西方火龙(drake,四足+蝠翼)/ 冰翼飞龙(wyvern,双足+巨翼+长颈)/ 东方雷蛟(ryu,盘蜷长身+鹿角须)
  function drake(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const bob = snap(A.bob * 0.7); const gy = cy + unit * GROUND; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.78, unit * 0.13, 'rgba(0,0,0,0.32)');
    // 蝠翼(翼幅随成长增大;st3 长翼爪)
    const flap = snap(Math.abs(Math.sin(t * 3)) * unit * (0.12 + 0.1 * gf));
    [-1, 1].forEach((d) => {
      pen.triangle(cx + d * unit * 0.3, cyb - unit * 0.08, unit * 0.2, cx + d * unit * 1.15, cyb - unit * 0.56 - flap, p.shade);
      pen.triangle(cx + d * unit * 0.3, cyb - unit * 0.02, unit * 0.12, cx + d * unit * 0.92, cyb - unit * 0.12 - flap, tk.hexA(p.belly, 0.9));
      pen.rect(cx + d * unit * 1.08, cyb - unit * 0.6 - flap, cx + d * unit * 1.16, cyb - unit * 0.42 - flap, p.accent);
      if (st >= 3) pen.triangle(cx + d * unit * 1.12, cyb - unit * 0.6 - flap, unit * 0.05, cx + d * unit * 1.26, cyb - unit * 0.74 - flap, p.accent);
    });
    // 四足
    [-0.5, -0.22, 0.22, 0.5].forEach((dx, i) => { const lx = cx + dx * unit; pen.rect(lx - blk, cyb + unit * 0.2, lx + blk, gy, i % 2 ? p.accent : p.shade); pen.rect(lx - blk * 1.3, gy - blk, lx + blk * 1.3, gy, p.accent); });
    // 粗尾 + 尾刺(st2:尾刺排)
    const tsw = snap(Math.sin(t * 2.5) * unit * 0.1);
    pen.rect(cx - unit * 0.68, cyb + unit * 0.12, cx - unit * 0.4, cyb + unit * 0.3, p.shade);
    pen.triangle(cx - unit * 0.68, cyb + unit * 0.2, unit * 0.1, cx - unit * 1.02 + tsw, cyb - unit * 0.04, p.accent);
    if (st >= 2) for (let i = 0; i < 3; i++) pen.triangle(cx - unit * (0.5 + i * 0.14), cyb + unit * 0.16, unit * 0.04, cx - unit * (0.5 + i * 0.14), cyb + unit * 0.04, p.accent);
    // 粗壮横躯
    pen.ell(cx, cyb + unit * 0.05, unit * 0.56 + blk, unit * 0.4 + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.05, unit * 0.56, unit * 0.4, p.body);
    pen.ell(cx, cyb + unit * 0.16, unit * 0.4, unit * 0.22, p.belly);
    // 腹甲(st3)
    if (st >= 3) for (let i = 0; i < 3; i++) pen.rect(cx - unit * 0.2 + i * unit * 0.16 - blk * 0.5, cyb + unit * 0.24, cx - unit * 0.2 + i * unit * 0.16 + blk * 0.5, cyb + unit * 0.3, tk.hexA(p.belly, 0.9));
    // 背脊刺(st1:数量随成长增多变长)
    if (st >= 1) { const n = 3 + Math.round(gf * 3); for (let i = 0; i < n; i++) { const mx = cx - unit * 0.24 + i * (unit * 0.5 / (n - 1 || 1)); pen.triangle(mx, cyb - unit * 0.28, unit * 0.05, mx, cyb - unit * (0.46 + 0.08 * gf), p.accent); } }
    // 颈 + 头
    const hx = cx + unit * 0.48, hy = cyb - unit * 0.3;
    pen.rect(cx + unit * 0.3, cyb - unit * 0.28, cx + unit * 0.5, cyb + unit * 0.04, p.accent);
    pen.rect(cx + unit * 0.33, cyb - unit * 0.25, cx + unit * 0.47, cyb, p.body);
    pen.ell(hx, hy, unit * 0.26 + blk, unit * 0.2 + blk, p.accent); pen.ell(hx, hy, unit * 0.26, unit * 0.2, p.body);
    pen.rect(hx + unit * 0.14, hy + unit * 0.02, hx + unit * 0.34, hy + unit * 0.14, p.body); // 吻
    // 角(st1 起,随成长增高)
    if (st >= 1) [-1, 1].forEach((d) => pen.triangle(hx + d * unit * 0.1, hy - unit * 0.1, unit * 0.05, hx + d * unit * 0.22, hy - unit * (0.34 + 0.16 * gf), p.shade));
    // 吐息(st3 且 work/alert)
    if (st >= 3 && (behavior === 'work' || behavior === 'alert')) { const pf = Math.abs(Math.sin(t * 5)); for (let i = 0; i < 3; i++) pen.dot(hx + unit * (0.34 + i * 0.12), hy + unit * 0.08, tk.hexA(p.glow, 0.85 * pf * (1 - i * 0.25))); }
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.06, unit * 0.11, p.eye, A.eyeMode, A.blink);
  }

  function wyvern(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const bob = snap(A.bob); const gy = cy + unit * GROUND; const cyb = cy + bob;
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 巨翼(翼幅随成长;翼骨条随 st 增多)
    const flap = snap(Math.abs(Math.sin(t * 3.5)) * unit * (0.16 + 0.12 * gf));
    [-1, 1].forEach((d) => {
      pen.triangle(cx + d * unit * 0.24, cyb + unit * 0.02, unit * 0.24, cx + d * unit * 1.3, cyb - unit * 0.7 - flap, p.shade);
      pen.triangle(cx + d * unit * 0.24, cyb + unit * 0.06, unit * 0.14, cx + d * unit * 1.02, cyb - unit * 0.18 - flap, tk.hexA(p.belly, 0.9));
      const ribs = st >= 1 ? 3 : 2; for (let r = 1; r <= ribs; r++) pen.rect(cx + d * unit * (0.4 + r * 0.24), cyb - unit * (0.05 + r * 0.16) - flap, cx + d * unit * (0.4 + r * 0.24) + blk, cyb + unit * 0.02 - flap, tk.hexA(p.accent, 0.55));
    });
    // 双后足
    [-1, 1].forEach((d) => { const lx = cx + d * unit * 0.22; pen.rect(lx - blk, cyb + unit * 0.26, lx + blk, gy, p.accent); pen.rect(lx - blk * 1.3, gy - blk, lx + blk * 1.3, gy, p.shade); });
    // 长鞭尾(st2:尾鳍)
    const tsw = snap(Math.sin(t * 2) * unit * 0.14);
    pen.rect(cx - unit * 0.16, cyb + unit * 0.3, cx + unit * 0.1, cyb + unit * 0.44, p.shade);
    pen.rect(cx - unit * 0.5 + tsw, cyb + unit * 0.34, cx - unit * 0.12, cyb + unit * 0.48, p.shade);
    pen.triangle(cx - unit * 0.5 + tsw, cyb + unit * 0.41, blk, cx - unit * 0.74 + tsw, cyb + unit * 0.28, p.accent);
    if (st >= 2) pen.triangle(cx - unit * 0.5 + tsw, cyb + unit * 0.41, unit * 0.06, cx - unit * 0.66 + tsw, cyb + unit * 0.5, tk.hexA(p.belly, 0.9));
    // 立身(瘦高)
    pen.ell(cx, cyb + unit * 0.08, unit * 0.34 + blk, unit * 0.46 + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.08, unit * 0.34, unit * 0.46, p.body);
    pen.ell(cx, cyb + unit * 0.18, unit * 0.24, unit * 0.28, p.belly);
    // 长颈 + 小头
    pen.rect(cx - unit * 0.08, cyb - unit * 0.5, cx + unit * 0.12, cyb - unit * 0.02, p.accent);
    pen.rect(cx - unit * 0.04, cyb - unit * 0.5, cx + unit * 0.12, cyb - unit * 0.05, p.body);
    const hx = cx + unit * 0.06, hy = cyb - unit * 0.6;
    // 颈鳞脊(st3)
    if (st >= 3) for (let i = 0; i < 3; i++) pen.triangle(cx + unit * 0.02, cyb - unit * (0.12 + i * 0.14), unit * 0.03, cx - unit * 0.08, cyb - unit * (0.16 + i * 0.14), tk.hexA(p.accent, 0.6));
    pen.ell(hx, hy, unit * 0.18 + blk, unit * 0.15 + blk, p.accent); pen.ell(hx, hy, unit * 0.18, unit * 0.15, p.body);
    pen.rect(hx + unit * 0.1, hy + unit * 0.02, hx + unit * 0.3, hy + unit * 0.1, p.body);
    // 头冠角(st1 起,随成长增高)
    if (st >= 1) pen.triangle(hx, hy - unit * 0.1, unit * 0.04, hx + unit * 0.06, hy - unit * (0.3 + 0.14 * gf), p.shade);
    if (st >= 2) [-1, 1].forEach((d) => pen.triangle(hx + d * unit * 0.08, hy - unit * 0.02, unit * 0.03, hx + d * unit * 0.16, hy - unit * 0.16, p.shade));
    // 冰晶环(st3)
    if (st >= 3) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + t; pen.dot(hx + Math.cos(a) * unit * 0.3, hy + Math.sin(a) * unit * 0.22, tk.hexA(p.glow, 0.7)); }
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.01, unit * 0.05, unit * 0.09, p.eye, A.eyeMode, A.blink);
  }

  function ryu(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy;
    pen.ell(cx, gy, unit * 0.6, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 盘蜷长身(段数随成长:6 → 8;摆速随成长)
    const segs = 6 + (st >= 3 ? 2 : 0);
    for (let i = 0; i < segs; i++) { const ph = i / segs; const sx = cx + Math.sin(ph * Math.PI * 2 + t * (1.5 + gf)) * unit * 0.46 * (1 - ph * 0.3); const sy = gy - unit * 0.1 - ph * unit * 0.72; const rr = unit * (0.32 - ph * 0.12); pen.ell(sx, sy, rr + blk, rr * 0.82 + blk, p.accent); pen.ell(sx, sy, rr, rr * 0.82, p.body); if (i % 2 === 0) pen.ell(sx, sy + rr * 0.3, rr * 0.6, rr * 0.4, p.belly); }
    // 小爪(st1)
    if (st >= 1) [-1, 1].forEach((d) => { pen.rect(cx + d * unit * 0.38, cyb + unit * 0.28, cx + d * unit * 0.58, cyb + unit * 0.36, p.accent); pen.triangle(cx + d * unit * 0.58, cyb + unit * 0.34, blk, cx + d * unit * 0.72, cyb + unit * 0.24, p.shade); });
    // 头(顶段)
    const hx = cx + Math.sin(t * 1.5) * unit * 0.1, hy = cyb - unit * 0.34;
    pen.ell(hx, hy, unit * 0.24 + blk, unit * 0.18 + blk, p.accent); pen.ell(hx, hy, unit * 0.24, unit * 0.18, p.body);
    pen.rect(hx - unit * 0.08, hy + unit * 0.04, hx + unit * 0.2, hy + unit * 0.12, p.body); // 吻
    // 鹿角(st2,随成长分叉更长)
    if (st >= 2) [-1, 1].forEach((d) => { pen.triangle(hx + d * unit * 0.08, hy - unit * 0.1, unit * 0.04, hx + d * unit * 0.18, hy - unit * (0.4 + 0.1 * gf), p.shade); pen.triangle(hx + d * unit * 0.13, hy - unit * 0.32, unit * 0.03, hx + d * unit * 0.3, hy - unit * 0.38, p.shade); });
    // 龙须
    [-1, 1].forEach((d) => { pen.rect(hx + d * unit * 0.14, hy + unit * 0.06, hx + d * unit * 0.46, hy + unit * 0.06 + blk, tk.hexA(p.glow, 0.85)); });
    // 鬃(沿身背,st1 起随成长更多)
    const mane = 3 + (st >= 1 ? Math.round(gf * 3) : 0);
    for (let i = 0; i < mane; i++) pen.triangle(cx - unit * 0.1, cyb - unit * 0.05 + i * unit * 0.16, unit * 0.05, cx - unit * 0.24, cyb - unit * 0.1 + i * unit * 0.16, tk.hexA(p.glow, 0.7));
    // 追逐宝珠(st3)
    if (st >= 3) { const bx = cx + Math.cos(t * 1.2) * unit * 0.5, by = cyb - unit * 0.5 + Math.sin(t * 1.2) * unit * 0.12; pen.dot(bx, by, tk.hexA(p.glow, 0.7 + 0.3 * Math.sin(t * 4))); }
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.06, unit * 0.12, p.eye, A.eyeMode, A.blink);
  }

  // ==== 史莱姆三分支异构:水滴 / 熔岩块 / 毒液瘫 ====
  // 成长里程碑:随等级「长出新部件 + 动作演进」,而非单纯变大。stage 0/1/2/3。
  function gstage(f) { return f >= 12 ? 3 : (f >= 9 ? 2 : (f >= 6 ? 1 : 0)); }
  function aquaslime(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + Math.round(A.bob / blk) * blk;
    pen.ell(cx, gy, unit * 0.6, unit * 0.13, 'rgba(0,0,0,0.3)');
    // 动作演进:挤压回弹幅度/频率随成长增强(幼体呆萌,成体灵动)
    const sq = 1 + Math.sin(t * (2 + gf * 2.5)) * (0.03 + 0.07 * gf);
    const bw = unit * (0.5 + 0.12 * gf), bh = unit * (0.5 + 0.12 * gf) * sq;
    // 尾鳍(st>=3:游动摆尾)
    if (st >= 3) { const sw = Math.round(Math.sin(t * 3) * unit * 0.08 / blk) * blk; pen.triangle(cx - bw * 0.7, cyb + unit * 0.14, unit * 0.09, cx - bw * 1.12, cyb - unit * 0.12 + sw, tk.hexA(p.belly, 0.9)); pen.triangle(cx - bw * 0.7, cyb + unit * 0.14, unit * 0.09, cx - bw * 1.12, cyb + unit * 0.36 + sw, tk.hexA(p.belly, 0.9)); }
    // 水滴体
    pen.triangle(cx, cyb - bh + unit * 0.16, bw * 0.5, cx, cyb - bh - unit * 0.3, p.accent);
    pen.ell(cx, cyb + unit * 0.12, bw + blk, bh + blk, p.accent);
    pen.triangle(cx, cyb - bh + unit * 0.16, bw * 0.42, cx, cyb - bh - unit * 0.22, p.body);
    pen.ell(cx, cyb + unit * 0.12, bw, bh, p.body);
    pen.ell(cx - bw * 0.22, cyb - bh * 0.1, bw * 0.28, bh * 0.4, tk.hexA(p.glow, 0.4));
    pen.ell(cx, cyb + unit * 0.3, bw * 0.62, bh * 0.5, p.belly);
    // 部件演进:st1 侧鳍;st2 背鳍冠(多片,随成长增多);st3 环绕水珠
    if (st >= 1) [-1, 1].forEach((d) => pen.triangle(cx + d * bw * 0.9, cyb + unit * 0.22, unit * 0.06, cx + d * (bw + unit * 0.3), cyb - unit * 0.02, tk.hexA(p.belly, 0.9)));
    if (st >= 2) { const fins = 2 + Math.round(gf * 2); for (let i = 0; i < fins; i++) { const fx = cx - bw * 0.4 + i * (bw * 0.8 / (fins - 1 || 1)); pen.triangle(fx, cyb - bh + unit * 0.14, unit * 0.05, fx, cyb - bh - unit * (0.02 + 0.12 * gf), tk.hexA(p.glow, 0.85)); } }
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * bw * 1.25, cyb + unit * 0.1 + Math.sin(a) * bh * 0.9, tk.hexA(p.glow, 0.45 + 0.3 * Math.sin(t * 3 + i))); }
    const fy = cyb + unit * 0.08;
    tk.eyes(pen, cx, fy, unit * 0.09, unit * 0.16, p.eye, A.eyeMode, A.blink);
    tk.mouth(pen, cx, fy + unit * 0.2, unit, p.eye, A.mouth);
    // 内部气泡(数量随成长)
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) { const ph = (t * 0.6 + i * 0.35) % 1; pen.dot(cx + Math.sin(i * 2 + t) * bw * 0.4, cyb + bh * 0.3 - ph * bh * 1.2, tk.hexA('#ffffff', 0.4 * (1 - ph) + 0.15)); }
  }
  function magmaslime(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.14)); const pen = tk.makePen(ctx, cx, cy, blk);
    const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + Math.round(A.bob * 0.5 / blk) * blk;
    pen.ell(cx, gy, unit * 0.66, unit * 0.13, 'rgba(0,0,0,0.32)');
    const bw = unit * (0.56 + 0.1 * gf);
    // 喷发(st>=3:顶部周期性熔岩柱)
    const erupt = st >= 3 ? Math.max(0, Math.sin(t * 2.2)) : 0;
    if (erupt > 0.1) { pen.rect(cx - blk, cyb - unit * 0.4 - erupt * unit * 0.4, cx + blk, cyb - unit * 0.24, tk.hexA(p.glow, 0.9)); for (let i = 0; i < 3; i++) pen.dot(cx + (i - 1) * unit * 0.12, cyb - unit * 0.44 - erupt * unit * (0.3 + i * 0.2), tk.hexA(p.glow, 0.8 * erupt)); }
    // 肩部岩块(st>=1)
    if (st >= 1) { pen.rect(cx - bw - unit * 0.1, cyb - unit * 0.02, cx - bw + unit * 0.14, cyb + unit * 0.22, p.accent); pen.rect(cx + bw - unit * 0.14, cyb - unit * 0.02, cx + bw + unit * 0.1, cyb + unit * 0.22, p.accent); }
    // 阶梯岩壳
    pen.rect(cx - bw, cyb - unit * 0.08, cx + bw, cyb + unit * 0.44, p.accent);
    pen.rect(cx - bw + blk, cyb - unit * 0.04, cx + bw - blk, cyb + unit * 0.42, p.body);
    pen.rect(cx - bw * 0.7, cyb - unit * 0.24, cx + bw * 0.5, cyb - unit * 0.04, p.accent);
    pen.rect(cx - bw * 0.66, cyb - unit * 0.2, cx + bw * 0.46, cyb - unit * 0.04, p.body);
    pen.rect(cx - bw * 0.36, cyb - unit * 0.36, cx + bw * 0.22, cyb - unit * 0.2, p.body);
    // 背脊岩刺(st>=2:随成长增多)
    if (st >= 2) { const spikes = 2 + Math.round(gf * 3); for (let i = 0; i < spikes; i++) { const sx = cx - bw * 0.6 + i * (bw * 1.2 / (spikes - 1 || 1)); pen.triangle(sx, cyb - unit * 0.24, unit * 0.06, sx, cyb - unit * (0.36 + 0.1 * gf), p.accent); } }
    // 熔岩裂缝(发光脉动,亮度随成长)+ 裂缝数
    const gl = tk.hexA(p.glow, 0.55 + 0.35 * Math.abs(Math.sin(t * (3 + gf * 2))));
    pen.rect(cx - bw * 0.5, cyb + unit * 0.06, cx - bw * 0.1, cyb + unit * 0.1, gl);
    pen.rect(cx + bw * 0.04, cyb - unit * 0.04, cx + bw * 0.12, cyb + unit * 0.32, gl);
    pen.rect(cx - bw * 0.24, cyb + unit * 0.18, cx + bw * 0.24, cyb + unit * 0.22, gl);
    if (st >= 1) pen.rect(cx + bw * 0.2, cyb + unit * 0.02, cx + bw * 0.5, cyb + unit * 0.06, gl);
    const embers = 3 + Math.round(gf * 4);
    for (let i = 0; i < embers; i++) { const a = (i / embers) * Math.PI * 2 + t * 1.5; pen.dot(cx + Math.cos(a) * bw * 0.95, cyb - unit * 0.06 + Math.sin(a) * unit * 0.28, tk.hexA(p.glow, 0.5 + 0.35 * Math.sin(t * 5 + i))); }
    const fy = cyb + unit * 0.06;
    pen.rect(cx - unit * 0.22, fy, cx - unit * 0.06, fy + (A.eyeMode === 'closed' ? blk : unit * 0.09), gl);
    pen.rect(cx + unit * 0.06, fy, cx + unit * 0.22, fy + (A.eyeMode === 'closed' ? blk : unit * 0.09), gl);
  }
  function toxicslime(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + Math.round(A.bob / blk) * blk;
    pen.ell(cx, gy, unit * 0.78, unit * 0.13, 'rgba(0,0,0,0.3)');
    // 动作演进:整体冒泡起伏(随成长更活跃)
    const bub = 1 + Math.sin(t * (2.4 + gf * 2)) * (0.03 + 0.05 * gf);
    const bw = unit * (0.66 + 0.1 * gf), bh = unit * 0.46 * bub;
    pen.ell(cx, cyb + unit * 0.14, bw + blk, bh + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.14, bw, bh, p.body);
    pen.ell(cx, cyb + unit * 0.26, bw * 0.7, bh * 0.6, p.belly);
    pen.ell(cx - bw * 0.3, cyb - bh * 0.5 + unit * 0.14, unit * 0.15, unit * 0.12, p.body);
    pen.ell(cx + bw * 0.26, cyb - bh * 0.42 + unit * 0.14, unit * 0.12, unit * 0.1, p.body);
    // 背部脓泡(st>=1:数量随成长,鼓动)
    if (st >= 1) { const pus = 2 + Math.round(gf * 3); for (let i = 0; i < pus; i++) { const px = cx - bw * 0.5 + i * (bw / (pus - 1 || 1)); const pr = unit * (0.08 + 0.03 * Math.sin(t * 3 + i)); pen.ell(px, cyb - bh * 0.4 + unit * 0.12, pr, pr * 0.9, tk.hexA(p.glow, 0.7)); } }
    // 毒棘(st>=2)
    if (st >= 2) [-1, 1].forEach((d) => { for (let i = 0; i < 2 + Math.round(gf * 2); i++) pen.triangle(cx + d * (bw * 0.5 + i * unit * 0.16), cyb - bh * 0.2 + unit * 0.14, unit * 0.05, cx + d * (bw * 0.5 + i * unit * 0.16), cyb - bh * 0.2 - unit * (0.1 + 0.06 * gf), p.accent); });
    // 底缘滴液(数量随成长)
    const drips = 3 + Math.round(gf * 2);
    for (let i = 0; i < drips; i++) { const dx = cx + (i - (drips - 1) / 2) * bw * 0.9 / (drips - 1 || 1) * 2; const ph = (t * 0.5 + i * 0.35) % 1; const dl = unit * (0.08 + ph * 0.3); pen.rect(dx - blk * 0.6, cyb + unit * 0.14 + bh * 0.66, dx + blk * 0.6, cyb + unit * 0.14 + bh * 0.66 + dl, p.body); pen.ell(dx, cyb + unit * 0.14 + bh * 0.66 + dl, blk * 0.9, blk, tk.hexA(p.glow, 0.7)); }
    // 毒雾(st>=3)
    if (st >= 3) for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i * 0.33) % 1; pen.dot(cx + (i - 1) * bw * 0.5, cyb - bh - ph * unit * 0.5, tk.hexA(p.glow, 0.5 * (1 - ph))); }
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.4) % 1; pen.dot(cx + (i - 1) * bw * 0.4, cyb - bh * 0.3 + unit * 0.14 - ph * unit * 0.3, tk.hexA(p.glow, 0.6 * (1 - ph))); }
    const fy = cyb + unit * 0.1;
    tk.eyes(pen, cx, fy, unit * 0.09, unit * 0.18, p.eye, A.eyeMode, A.blink);
    tk.mouth(pen, cx, fy + unit * 0.18, unit, p.eye, A.mouth);
  }

  // ==== 喵仔三分支异构:潜影忍猫 / 剑齿猛猫 / 焰缠灵猫(部件+动作随成长演进)====
  function shadowcat(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 幽影残像(st3:身后淡色偏移轮廓)
    if (st >= 3) pen.ell(cx - unit * 0.18, cyb + unit * 0.08, unit * 0.34, unit * 0.48, tk.hexA(p.body, 0.22));
    // 尾(摆动随成长更快)
    const tsw = snap(Math.sin(t * (3 + gf)) * unit * 0.22);
    pen.rect(cx + unit * 0.34, cyb + unit * 0.1, cx + unit * 0.56, cyb + unit * 0.24, p.shade);
    pen.rect(cx + unit * 0.5, cyb - unit * 0.24 + tsw, cx + unit * 0.68, cyb + unit * 0.12 + tsw, p.shade);
    pen.rect(cx + unit * 0.5, cyb - unit * 0.28 + tsw, cx + unit * 0.66, cyb - unit * 0.1 + tsw, p.accent);
    // 双尾(st2)
    if (st >= 2) { const t2 = snap(Math.sin(t * 3 + 1) * unit * 0.18); pen.rect(cx + unit * 0.34, cyb + unit * 0.16, cx + unit * 0.6, cyb + unit * 0.28, tk.hexA(p.shade, 0.85)); pen.rect(cx + unit * 0.54, cyb + unit * 0.02 + t2, cx + unit * 0.7, cyb + unit * 0.2 + t2, tk.hexA(p.shade, 0.85)); }
    [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.2 - blk, cyb + unit * 0.4, cx + d * unit * 0.2 + blk, gy, p.accent));
    pen.ell(cx, cyb + unit * 0.08, unit * 0.34 + blk, unit * 0.48 + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.08, unit * 0.34, unit * 0.48, p.body);
    pen.ell(cx, cyb + unit * 0.2, unit * 0.22, unit * 0.28, p.belly);
    // 忍巾(st1)
    if (st >= 1) { pen.rect(cx - unit * 0.28, cyb - unit * 0.12, cx + unit * 0.28, cyb - unit * 0.02, '#e5484d'); pen.rect(cx + unit * 0.18, cyb - unit * 0.02, cx + unit * 0.32, cyb + unit * 0.22 + snap(Math.sin(t * 4) * unit * 0.04), '#e5484d'); }
    // 腕刃(st2)
    if (st >= 2) [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.24, cyb + unit * 0.36, unit * 0.05, cx + d * unit * 0.3, cyb + unit * 0.56, tk.hexA(p.glow, 0.8)));
    const hy = cyb - unit * 0.42;
    [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.16, hy - unit * 0.12, unit * 0.09, cx + d * unit * 0.3, hy - unit * 0.46, p.shade));
    pen.ell(cx, hy, unit * 0.26 + blk, unit * 0.23 + blk, p.accent); pen.ell(cx, hy, unit * 0.26, unit * 0.23, p.body);
    pen.rect(cx - unit * 0.26, hy - unit * 0.02, cx + unit * 0.26, hy + unit * 0.06, p.accent); // 忍者眼罩
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.13, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
    // 手里剑环绕(st3)
    if (st >= 3) for (let i = 0; i < 2; i++) { const a = t * 2 + i * Math.PI; pen.dot(cx + Math.cos(a) * unit * 0.5, hy + Math.sin(a) * unit * 0.3, tk.hexA(p.glow, 0.85)); }
  }
  function sabercat(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.7);
    // 潜行摆动(动作演进:成长后步态更沉稳有力)
    const prowl = snap(Math.sin(t * 2) * unit * 0.03 * (0.5 + gf));
    pen.ell(cx, gy, unit * 0.8, unit * 0.13, 'rgba(0,0,0,0.32)');
    [-0.44, -0.18, 0.18, 0.44].forEach((dx, i) => { const lx = cx + dx * unit + prowl; pen.rect(lx - blk * 1.2, cyb + unit * 0.22, lx + blk * 1.2, gy, i % 2 ? p.accent : p.shade); });
    pen.rect(cx - unit * 0.62, cyb + unit * 0.04, cx - unit * 0.4, cyb + unit * 0.18, p.shade);
    pen.ell(cx, cyb + unit * 0.08, unit * 0.58 + blk, unit * 0.42 + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.08, unit * 0.58, unit * 0.42, p.body);
    pen.ell(cx, cyb + unit * 0.2, unit * 0.42, unit * 0.24, p.belly);
    // 斑纹(st1)
    if (st >= 1) [-0.3, 0, 0.3].forEach((o) => pen.rect(cx + o * unit - blk * 0.5, cyb - unit * 0.2, cx + o * unit + blk * 0.5, cyb + unit * 0.08, tk.hexA(p.accent, 0.5)));
    // 肩甲板(st3)
    if (st >= 3) { pen.rect(cx - unit * 0.1, cyb - unit * 0.24, cx + unit * 0.3, cyb - unit * 0.12, p.accent); [-1, 1].forEach((d) => pen.triangle(cx + unit * 0.1 + d * unit * 0.16, cyb - unit * 0.24, unit * 0.05, cx + unit * 0.1 + d * unit * 0.16, cyb - unit * 0.36, p.accent)); }
    const hx = cx + unit * 0.4, hy = cyb - unit * 0.22;
    // 鬃毛(st2:随成长更密更长)
    if (st >= 2) { const n = 6 + Math.round(gf * 4); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pen.triangle(hx + Math.cos(a) * unit * 0.24, hy + Math.sin(a) * unit * 0.22, unit * 0.05, hx + Math.cos(a) * unit * (0.4 + 0.1 * gf), hy + Math.sin(a) * unit * (0.38 + 0.1 * gf), p.shade); } }
    pen.ell(hx, hy, unit * 0.27 + blk, unit * 0.24 + blk, p.accent); pen.ell(hx, hy, unit * 0.27, unit * 0.24, p.body);
    [-1, 1].forEach((d) => pen.triangle(hx + d * unit * 0.14, hy - unit * 0.16, unit * 0.08, hx + d * unit * 0.2, hy - unit * 0.32, p.shade));
    // 剑齿(长度随成长增长)
    const fang = unit * (0.22 + 0.16 * gf);
    pen.triangle(hx - unit * 0.09, hy + unit * 0.16, blk * 0.9, hx - unit * 0.09, hy + unit * 0.16 + fang, '#fff7ea');
    pen.triangle(hx + unit * 0.09, hy + unit * 0.16, blk * 0.9, hx + unit * 0.09, hy + unit * 0.16 + fang, '#fff7ea');
    tk.eyes(pen, hx, hy - unit * 0.02, unit * 0.07, unit * 0.13, p.eye, A.eyeMode, A.blink);
  }
  function flamecat(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 火焰更旺随成长(摆动更快 + 火舌更多)
    const fl = snap(Math.abs(Math.sin(t * (4 + gf * 2))) * unit * 0.1);
    const tail = 3 + (st >= 2 ? 2 : 0);
    for (let i = 0; i < tail; i++) pen.triangle(cx + unit * 0.4, cyb + unit * 0.1, unit * 0.1, cx + unit * 0.54 + i * unit * 0.04, cyb - unit * 0.3 - fl - i * unit * 0.05, i % 2 ? tk.hexA(p.glow, 0.9) : p.body);
    [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.2 - blk, cyb + unit * 0.36, cx + d * unit * 0.2 + blk, gy, p.accent));
    pen.ell(cx, cyb + unit * 0.08, unit * 0.38 + blk, unit * 0.46 + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.08, unit * 0.38, unit * 0.46, p.body);
    pen.ell(cx, cyb + unit * 0.2, unit * 0.26, unit * 0.28, p.belly);
    // 环绕火种(st3)
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 - t * 1.5; pen.dot(cx + Math.cos(a) * unit * 0.6, cyb + unit * 0.06 + Math.sin(a) * unit * 0.4, tk.hexA(p.glow, 0.5 + 0.35 * Math.sin(t * 4 + i))); }
    // 背焰鬃(st1 起,随成长更多)
    const mane = 3 + (st >= 1 ? Math.round(gf * 3) : 0);
    for (let i = 0; i < mane; i++) { const mx = cx - unit * 0.2 + i * (unit * 0.44 / (mane - 1 || 1)); pen.triangle(mx, cyb - unit * 0.2, unit * 0.05, mx + snap(Math.sin(t * 5 + i) * unit * 0.03), cyb - unit * (0.42 + 0.12 * gf) - fl, tk.hexA(p.glow, 0.85)); }
    const hy = cyb - unit * 0.42;
    // 火耳(st2 起更高)
    [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.14, hy - unit * 0.08, unit * 0.07, cx + d * unit * 0.22, hy - unit * (0.4 + (st >= 2 ? 0.14 * gf : 0)) - fl, tk.hexA(p.glow, 0.9)));
    pen.ell(cx, hy, unit * 0.24 + blk, unit * 0.22 + blk, p.accent); pen.ell(cx, hy, unit * 0.24, unit * 0.22, p.body);
    tk.eyes(pen, cx, hy, unit * 0.07, unit * 0.12, p.eye, A.eyeMode, A.blink);
  }

  function phantomcat(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * (0.06 + 0.05 * gf)); // 漂浮幅度随成长
    pen.ell(cx, gy, unit * 0.34, unit * 0.1, 'rgba(0,0,0,0.24)');
    // 相位分身(st3:淡色偏移)
    if (st >= 3) pen.ell(cx + unit * 0.16, cyb, unit * 0.32, unit * 0.44, tk.hexA(p.body, 0.2));
    // 幽灵多尾(数量随成长:3 → 5)
    const tails = 3 + (st >= 2 ? 2 : 0);
    for (let i = 0; i < tails; i++) { const tw = snap(Math.sin(t * 2.5 + i) * unit * 0.1); pen.triangle(cx + unit * 0.18, cyb + unit * 0.2, unit * 0.06, cx + unit * 0.5 + tw, cyb + unit * 0.32 + (i - tails / 2) * unit * 0.08, tk.hexA(p.body, 0.7)); }
    pen.ell(cx, cyb, unit * 0.34 + blk, unit * 0.46 + blk, p.accent);
    pen.ell(cx, cyb, unit * 0.34, unit * 0.46, p.body);
    pen.ell(cx, cyb - unit * 0.1, unit * 0.24, unit * 0.3, tk.hexA(p.belly, 0.7));
    for (let i = 0; i < 3; i++) { const dx = cx + (i - 1) * unit * 0.2; const ph = (t * 0.5 + i * 0.3) % 1; pen.triangle(dx, cyb + unit * 0.3, unit * 0.05, dx + snap(Math.sin(t * 3 + i) * unit * 0.05), cyb + unit * 0.5 + ph * unit * 0.1, tk.hexA(p.body, 0.5 * (1 - ph))); }
    const hy = cyb - unit * 0.4;
    [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.16, hy - unit * 0.1, unit * 0.08, cx + d * unit * 0.3, hy - unit * 0.44, tk.hexA(p.shade, 0.85)));
    pen.ell(cx, hy, unit * 0.24 + blk, unit * 0.22 + blk, p.accent); pen.ell(cx, hy, unit * 0.24, unit * 0.22, p.body);
    tk.eyes(pen, cx, hy, unit * 0.08, unit * 0.13, tk.hexA(p.glow, 0.95), A.eyeMode === 'closed' ? 'closed' : 'wide', A.blink);
    // 灵球环绕(st1 起 3 个,st2+ 增多)
    if (st >= 1) { const orbs = 3 + (st >= 2 ? Math.round(gf * 3) : 0); for (let i = 0; i < orbs; i++) { const a = (i / orbs) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * unit * 0.6, cyb + Math.sin(a) * unit * 0.4, tk.hexA(p.glow, 0.6)); } }
  }

  // 成长因子:把 feature(≈lv+1)映射到 0..1,让「同分支线性成长」体型/部件逐级质变
  function grow(f) { return Math.min(1, Math.max(0, (f - 4) / 10)); }

  // ==== 甲虫三分支异构:独角犀甲 / 巨颚锹甲 / 双角雷甲(体型/甲缝/角/腿随成长累进)====
  function rhinobeetle(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    const bw = unit * (0.48 + 0.2 * gf), bh = unit * (0.5 + 0.2 * gf);       // 体型随成长增大
    pen.ell(cx, gy, bw + unit * 0.08, unit * 0.12, 'rgba(0,0,0,0.3)');
    const legs = 3;                                                          // 三对足;work 蹬地
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < legs; i++) { const yy = cyb - unit * 0.06 + i * unit * 0.2; const kick = snap(behavior === 'work' ? Math.sin(t * 7 + i) * unit * 0.05 : 0); pen.rect(cx + d * bw * 0.6, yy, cx + d * (bw + unit * 0.12), yy + blk, p.accent); pen.rect(cx + d * (bw + unit * 0.06), yy, cx + d * (bw + unit * 0.18), yy + unit * 0.16 + kick, p.accent); }
    const hy = cyb - bh - unit * 0.02;
    pen.ell(cx, hy, unit * 0.3, unit * 0.22, p.shade);
    // 独角:长度随成长增长,高阶前端分叉
    const hornLen = unit * (0.4 + 0.34 * gf);
    pen.triangle(cx, hy + unit * 0.02, unit * 0.1, cx + unit * 0.05, hy - hornLen, p.body);
    if (gf > 0.35) pen.triangle(cx + unit * 0.03, hy - hornLen * 0.68, unit * 0.05, cx + unit * (0.18 + 0.12 * gf), hy - hornLen * 0.86, p.body);
    if (gf > 0.7) pen.triangle(cx - unit * 0.03, hy - hornLen * 0.6, unit * 0.05, cx - unit * 0.16, hy - hornLen * 0.78, p.body);
    // 圆穹甲壳 + 中缝 + 成长横棱
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent);
    pen.ell(cx, cyb, bw, bh, p.body);
    pen.rect(cx - blk * 0.5, cyb - bh, cx + blk * 0.5, cyb + bh, p.accent);
    const ridges = 1 + Math.round(gf * 3);
    for (let r = 0; r < ridges; r++) { const ry = cyb - bh * 0.5 + r * (bh / (ridges + 1)); pen.rect(cx - bw * 0.7, ry, cx + bw * 0.7, ry + blk, tk.hexA(p.accent, 0.5)); }
    pen.ell(cx, cyb - bh * 0.6, bw * 0.5, unit * 0.14, tk.hexA(p.glow, 0.22));
    if (st >= 3) [-1, 1].forEach((d) => { for (let i = 0; i < 3; i++) pen.dot(cx + d * bw * 0.72, cyb - bh * 0.3 + i * unit * 0.22, tk.hexA(p.glow, 0.4 + 0.4 * Math.sin(t * 4 + i))); });
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.14, p.eye, A.eyeMode, A.blink);
  }
  function stagbeetle(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.7);
    const bw = unit * (0.5 + 0.24 * gf), bh = unit * (0.38 + 0.12 * gf);
    pen.ell(cx, gy, bw + unit * 0.14, unit * 0.12, 'rgba(0,0,0,0.32)');
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const yy = cyb - unit * 0.02 + i * unit * 0.18; pen.rect(cx + d * bw * 0.5, yy, cx + d * (bw + unit * 0.08), yy + blk, p.accent); }
    // 巨颚:长度随成长增长,高阶内侧长出锯齿;开合动画
    const open = snap((behavior === 'alert' ? 0.14 : (behavior === 'work' ? Math.abs(A.wave) * 0.1 : 0.04)) * unit);
    const hx = cx, hy = cyb - bh - unit * 0.06; const jaw = unit * (0.4 + 0.34 * gf);
    for (let d = -1; d <= 1; d += 2) {
      pen.rect(hx + d * unit * 0.06, hy - jaw, hx + d * unit * 0.14, hy - unit * 0.02, p.shade);
      pen.triangle(hx + d * unit * 0.1, hy - jaw, unit * 0.05, hx + d * (unit * 0.02 + open), hy - jaw - unit * 0.22, p.body);
      const teeth = Math.round(gf * 3);
      for (let k = 0; k < teeth; k++) { const ty = hy - unit * 0.1 - k * (jaw / (teeth + 1)); pen.triangle(hx + d * unit * 0.1, ty, unit * 0.035, hx + d * unit * 0.24, ty, p.body); }
    }
    pen.ell(hx, hy, unit * 0.26, unit * 0.18, p.shade);
    pen.ell(cx, cyb + unit * 0.04, bw + blk, bh + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.04, bw, bh, p.body);
    pen.rect(cx - blk * 0.5, cyb - bh * 0.9, cx + blk * 0.5, cyb + bh + unit * 0.04, p.accent);
    pen.rect(cx - bw * 0.8, cyb - bh * 0.4, cx - bw * 0.3, cyb + bh * 0.5, tk.hexA(p.glow, 0.16));
    if (st >= 3) { const shx = cx - bw * 0.6 + ((t * 0.25) % 1) * bw * 1.2; pen.ell(shx, cyb + unit * 0.02, unit * 0.1, bh * 0.55, tk.hexA(p.glow, 0.3)); }
    tk.eyes(pen, hx, hy + unit * 0.01, unit * 0.06, unit * 0.14, p.eye, A.eyeMode, A.blink);
  }
  function voltbeetle(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    const bw = unit * (0.42 + 0.16 * gf), bh = unit * (0.56 + 0.22 * gf);    // 修长竖甲,随成长拔高
    pen.ell(cx, gy, bw + unit * 0.1, unit * 0.12, 'rgba(0,0,0,0.3)');
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const yy = cyb - unit * 0.04 + i * unit * 0.2; pen.rect(cx + d * bw * 0.6, yy, cx + d * (bw + unit * 0.12), yy + blk, p.accent); }
    const hy = cyb - bh - unit * 0.02; const hornLen = unit * (0.42 + 0.22 * gf);
    pen.triangle(cx, hy - unit * 0.02, unit * 0.06, cx + unit * 0.04, hy - hornLen, p.body);
    pen.triangle(cx, hy + unit * 0.16, unit * 0.06, cx + unit * 0.02, hy - hornLen * 0.5, p.shade);
    // 角间电弧:数量随成长增加
    const arcs = 1 + Math.round(gf * 2);
    for (let a2 = 0; a2 < arcs; a2++) if (Math.sin(t * 8 + a2 * 2) > 0) { ctx.strokeStyle = tk.hexA(p.glow, 0.95); ctx.lineWidth = Math.max(2, unit * 0.06); ctx.beginPath(); ctx.moveTo(cx + unit * 0.03, hy - hornLen * (0.9 - a2 * 0.2)); ctx.lineTo(cx + unit * 0.1, hy - hornLen * 0.6); ctx.lineTo(cx, hy - hornLen * 0.4); ctx.stroke(); }
    pen.ell(cx, hy, unit * 0.26, unit * 0.2, p.shade);
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent);
    pen.ell(cx, cyb, bw, bh, p.body);
    pen.rect(cx - blk * 0.5, cyb - bh, cx + blk * 0.5, cyb + bh, p.accent);
    const sparks = 2 + Math.round(gf * 3);
    for (let i = 0; i < sparks; i++) { if (Math.sin(t * 9 + i * 2) < 0.3) continue; pen.dot(cx + ((i % 3) - 1) * bw * 0.5, cyb - bh * 0.4 + (i % 4) * unit * 0.18, tk.hexA(p.glow, 0.9)); }
    if (st >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 2; pen.dot(cx + Math.cos(a) * (bw + unit * 0.16), cyb + Math.sin(a) * (bh + unit * 0.1), tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 6 + i))); }
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.13, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
  }

  // ==== 灵蛇三分支异构:羽翼风蛇 / 兜帽毒眼镜蛇 / 电棘雷蛇 ====
  function windserpent(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy;
    pen.ell(cx, gy, unit * 0.6, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 羽翼:层数随成长增加(扑动)
    const flap = snap(Math.abs(Math.sin(t * 3.5)) * unit * 0.18);
    const feath = 2 + Math.round(gf * 3);
    [-1, 1].forEach((d) => { for (let r = 0; r < feath; r++) pen.triangle(cx + d * unit * 0.2, cyb - unit * 0.02, unit * 0.1, cx + d * (unit * (0.6 + 0.12 * gf) + r * 0.12), cyb - unit * 0.3 - flap - r * unit * 0.12, r % 2 ? tk.hexA(p.belly, 0.9) : p.shade); });
    // 盘身:随成长变粗
    const coil = unit * (0.5 + 0.16 * gf);
    pen.ell(cx, gy - unit * 0.12, coil + unit * 0.08, unit * 0.28, p.accent);
    pen.ell(cx, gy - unit * 0.12, coil, unit * 0.22, p.body);
    pen.ell(cx, gy - unit * 0.18, coil * 0.6, unit * 0.14, p.belly);
    const nx = cx + snap(Math.sin(t * 2) * unit * 0.06);
    pen.rect(cx - unit * 0.1, cyb - unit * 0.16, cx + unit * 0.1, gy - unit * 0.2, p.body);
    const hy = cyb - unit * 0.3;
    pen.ell(nx, hy, unit * 0.22 + blk, unit * 0.18 + blk, p.accent); pen.ell(nx, hy, unit * 0.22, unit * 0.18, p.body);
    // 羽冠:随成长增高
    const crest = 1 + Math.round(gf * 2);
    for (let i = -crest; i <= crest; i++) pen.triangle(nx + i * unit * 0.05, hy - unit * 0.14, unit * 0.04, nx + i * unit * 0.1, hy - unit * (0.34 + 0.14 * gf), tk.hexA(p.glow, 0.85));
    if (st >= 3) for (let i = 0; i < 5; i++) { const a = t * 1.5 + i * 1.3; pen.dot(cx + Math.cos(a) * coil * 1.2, gy - unit * 0.2 + Math.sin(a) * unit * 0.4, tk.hexA(p.glow, 0.35)); }
    tk.eyes(pen, nx, hy - unit * 0.01, unit * 0.06, unit * 0.12, p.eye, A.eyeMode, A.blink);
    if (Math.sin(t * 4) > 0) { pen.rect(nx - blk * 0.5, hy + unit * 0.1, nx + blk * 0.5, hy + unit * 0.28, '#e5484d'); pen.triangle(nx, hy + unit * 0.32, blk, nx, hy + unit * 0.24, '#e5484d'); }
  }
  function cobra(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy;
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    pen.ell(cx, gy - unit * 0.08, unit * 0.5, unit * 0.22, p.accent);
    pen.ell(cx, gy - unit * 0.08, unit * 0.42, unit * 0.16, p.shade);
    const sway = snap(Math.sin(t * 2) * unit * 0.07);
    pen.rect(cx - unit * 0.13, cyb - unit * 0.1, cx + unit * 0.13, gy - unit * 0.12, p.accent);
    pen.rect(cx - unit * 0.09 + sway, cyb - unit * 0.1, cx + unit * 0.11 + sway, gy - unit * 0.14, p.body);
    const nx = cx + sway, hy = cyb - unit * 0.28;
    // 兜帽:基宽随成长变大 + 呼吸脉动
    const hood = unit * (0.34 + 0.14 * gf + 0.06 * Math.sin(t * 2.5));
    pen.triangle(nx, hy + unit * 0.22, hood, nx, hy - unit * 0.12, p.shade);
    pen.triangle(nx, hy + unit * 0.16, hood * 0.7, nx, hy - unit * 0.06, tk.hexA(p.belly, 0.6));
    // 兜帽纹样:随成长出现眼斑
    if (gf > 0.3) pen.dot(nx, hy - unit * 0.02, tk.hexA(p.glow, 0.9));
    if (gf > 0.6) { pen.dot(nx - hood * 0.5, hy + unit * 0.06, tk.hexA(p.glow, 0.7)); pen.dot(nx + hood * 0.5, hy + unit * 0.06, tk.hexA(p.glow, 0.7)); }
    pen.ell(nx, hy, unit * 0.22 + blk, unit * 0.16 + blk, p.accent); pen.ell(nx, hy, unit * 0.22, unit * 0.16, p.body);
    tk.eyes(pen, nx, hy - unit * 0.02, unit * 0.06, unit * 0.12, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
    pen.triangle(nx - unit * 0.06, hy + unit * 0.1, blk * 0.7, nx - unit * 0.06, hy + unit * 0.24, '#fff7ea');
    pen.triangle(nx + unit * 0.06, hy + unit * 0.1, blk * 0.7, nx + unit * 0.06, hy + unit * 0.24, '#fff7ea');
    if (st >= 3) { pen.dot(nx, hy + unit * 0.3, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 3))); [-1, 1].forEach((d) => pen.dot(nx + d * hood * 0.8, hy - unit * 0.06, tk.hexA(p.glow, 0.6))); }
    if (Math.sin(t * 5) > 0.2) { pen.rect(nx - blk * 0.4, hy + unit * 0.16, nx + blk * 0.4, hy + unit * 0.34, '#e5484d'); }
  }
  function levinserpent(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy;
    pen.ell(cx, gy, unit * 0.62, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 之字形身段:段数随成长增加(身体更长更曲折)
    const segs = 5 + Math.round(gf * 4); let px = cx, py = gy - unit * 0.12;
    const totalH = unit * (0.6 + 0.24 * gf);
    for (let i = 0; i < segs; i++) { const dir = (i % 2 ? 1 : -1); const nx2 = cx + dir * unit * 0.34 * (1 - i / segs); const ny2 = py - totalH / segs - unit * 0.02; const rr = unit * (0.26 - i * 0.03 * (5 / segs)); pen.ell((px + nx2) / 2, (py + ny2) / 2, rr + blk, rr * 0.9 + blk, p.accent); pen.ell((px + nx2) / 2, (py + ny2) / 2, rr, rr * 0.9, p.body); px = nx2; py = ny2; if (Math.sin(t * 8 + i) > 0.2) pen.dot((px + cx) / 2, py, tk.hexA(p.glow, 0.9)); }
    const hx = px, hy = py - unit * 0.02;
    pen.ell(hx, hy, unit * 0.22 + blk, unit * 0.16 + blk, p.accent); pen.ell(hx, hy, unit * 0.22, unit * 0.16, p.body);
    [-1, 1].forEach((d) => pen.triangle(hx + d * unit * 0.08, hy - unit * 0.1, unit * 0.04, hx + d * unit * (0.16 + 0.1 * gf), hy - unit * (0.32 + 0.12 * gf), tk.hexA(p.glow, 0.85)));
    if (gf > 0.3) [-1, 1].forEach((d) => pen.triangle(hx + d * unit * 0.16, hy, unit * 0.05, hx + d * unit * (0.3 + 0.1 * gf), hy - unit * 0.06, tk.hexA(p.belly, 0.85)));
    if (st >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 2; pen.dot(hx + Math.cos(a) * unit * 0.42, hy + Math.sin(a) * unit * 0.32, tk.hexA(p.glow, 0.4 + 0.4 * Math.sin(t * 7 + i))); }
    tk.eyes(pen, hx, hy - unit * 0.01, unit * 0.06, unit * 0.12, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
  }

  // ==== 石魄三分支异构:巨砾 / 棱晶 / 熔核(体量/岩块/晶簇/熔缝随成长累进)====
  function boulder(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.14)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.5);
    const bw = unit * (0.52 + 0.2 * gf), bh = unit * (0.42 + 0.16 * gf);
    pen.ell(cx, gy, bw + unit * 0.18, unit * 0.13, 'rgba(0,0,0,0.32)');
    pen.rect(cx - bw * 0.7, gy - unit * 0.28, cx - bw * 0.16, gy, p.shade); pen.rect(cx + bw * 0.16, gy - unit * 0.28, cx + bw * 0.7, gy, p.shade);
    // 手臂:成长后期长出(work 摆动)
    if (gf > 0.5) { const sw = snap(behavior === 'work' ? A.wave * unit * 0.12 : 0); pen.rect(cx - bw - unit * 0.24, cyb - unit * 0.08 + sw, cx - bw + unit * 0.06, cyb + unit * 0.34 + sw, p.shade); pen.rect(cx + bw - unit * 0.06, cyb - unit * 0.08 - sw, cx + bw + unit * 0.24, cyb + unit * 0.34 - sw, p.shade); }
    pen.ell(cx, cyb + unit * 0.08, bw + blk, bh + blk, p.accent);
    pen.ell(cx, cyb + unit * 0.08, bw, bh, p.body);
    // 岩块凸起:数量随成长增加
    const chunks = 2 + Math.round(gf * 3);
    for (let i = 0; i < chunks; i++) { const ang = i * 2.3; pen.ell(cx + Math.cos(ang) * bw * 0.5, cyb - unit * 0.06 + Math.sin(ang) * bh * 0.4, unit * (0.16 + 0.06 * (i % 2)), unit * 0.14, p.shade); }
    pen.rect(cx - bw * 0.55, cyb - unit * 0.1, cx + bw * 0.55, cyb - unit * 0.04, p.accent);
    if (st >= 3) [-1, 1].forEach((d) => { for (let i = 0; i < 2; i++) pen.triangle(cx + d * bw * (0.4 + i * 0.32), cyb - bh * 0.5, unit * 0.08, cx + d * bw * (0.4 + i * 0.32), cyb - bh - unit * 0.16, p.accent); });
    pen.rect(cx - unit * 0.2, cyb, cx - unit * 0.06, cyb + (A.eyeMode === 'closed' ? blk : unit * 0.09), tk.hexA(p.eye, 0.95));
    pen.rect(cx + unit * 0.06, cyb, cx + unit * 0.2, cyb + (A.eyeMode === 'closed' ? blk : unit * 0.09), tk.hexA(p.eye, 0.95));
  }
  function crystalgolem(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.5);
    const bh = unit * (0.42 + 0.16 * gf), bw = unit * (0.4 + 0.1 * gf);
    pen.ell(cx, gy, bw + unit * 0.24, unit * 0.13, 'rgba(0,0,0,0.32)');
    pen.rect(cx - bw * 0.85, gy - unit * 0.26, cx - bw * 0.24, gy, p.shade); pen.rect(cx + bw * 0.24, gy - unit * 0.26, cx + bw * 0.85, gy, p.shade);
    // 棱晶主体(菱形叠):随成长拔高
    pen.triangle(cx, cyb + bh + unit * 0.04, bw + blk, cx, cyb - bh - unit * 0.06, p.accent);
    pen.triangle(cx, cyb + bh, bw, cx, cyb - bh, p.body);
    pen.triangle(cx, cyb + bh + unit * 0.04, bw + blk, cx, cyb + bh + unit * 0.12, p.accent);
    pen.triangle(cx, cyb + bh, bw, cx, cyb + bh + unit * 0.08, p.body);
    // 外凸晶簇:数量/大小随成长增加
    const shards = 1 + Math.round(gf * 3);
    [-1, 1].forEach((d) => { for (let s = 0; s < shards; s++) { const sy = cyb + unit * (0.1 + s * 0.18); pen.triangle(cx + d * bw * 0.7, sy, unit * (0.06 + 0.03 * s), cx + d * (bw + unit * (0.18 + 0.06 * s)), sy - unit * 0.16, p.shade); } });
    // 内部光核:随成长增亮增大
    pen.triangle(cx, cyb + unit * (0.14 + 0.06 * gf), unit * (0.1 + 0.06 * gf), cx, cyb - unit * (0.14 + 0.06 * gf), tk.hexA(p.glow, 0.5 + 0.3 * gf + 0.2 * Math.sin(t * 3)));
    if (st >= 3) { const bm = unit * (0.2 + 0.2 * Math.abs(Math.sin(t * 2))); pen.rect(cx - blk * 0.5, cyb - bh - bm, cx + blk * 0.5, cyb - bh, tk.hexA(p.glow, 0.7)); pen.dot(cx, cyb - bh - bm, tk.hexA(p.glow, 0.9)); }
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.06, unit * 0.13, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
  }
  function magmagolem(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.14)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.5); const gl = tk.hexA(p.glow, 0.65 + 0.3 * Math.abs(Math.sin(t * 4)));
    const bw = unit * (0.48 + 0.16 * gf), bh = unit * (0.28 + 0.1 * gf);
    pen.ell(cx, gy, bw + unit * 0.24, unit * 0.13, 'rgba(0,0,0,0.34)');
    pen.rect(cx - bw * 0.72, gy - unit * 0.3, cx - bw * 0.2, gy, p.shade); pen.rect(cx + bw * 0.2, gy - unit * 0.3, cx + bw * 0.72, gy, p.shade);
    // 参差熔岩巨体 + 肩尖(数量随成长)
    pen.rect(cx - bw, cyb - bh, cx + bw, cyb + unit * 0.5, p.accent);
    pen.rect(cx - bw + blk * 0.5, cyb - bh + blk * 0.5, cx + bw - blk * 0.5, cyb + unit * 0.46, p.body);
    const spikes = 1 + Math.round(gf * 2);
    for (let s = 0; s < spikes; s++) { const off = s * unit * 0.16; pen.triangle(cx - bw + off, cyb - bh, unit * 0.12, cx - bw - unit * 0.08 + off, cyb - bh - unit * (0.2 + 0.1 * s), p.accent); pen.triangle(cx + bw - off, cyb - bh, unit * 0.12, cx + bw + unit * 0.08 - off, cyb - bh - unit * (0.2 + 0.1 * s), p.accent); }
    // 熔缝:随成长更密
    pen.rect(cx - bw * 0.7, cyb + unit * 0.04, cx + unit * 0.05, cyb + unit * 0.08, gl);
    pen.rect(cx - unit * 0.05, cyb - bh + unit * 0.04, cx + unit * 0.02, cyb + unit * 0.4, gl);
    pen.rect(cx + unit * 0.1, cyb + unit * 0.16, cx + bw * 0.7, cyb + unit * 0.2, gl);
    if (gf > 0.5) pen.rect(cx - bw * 0.4, cyb + unit * 0.24, cx + bw * 0.2, cyb + unit * 0.28, gl);
    const embers = 2 + Math.round(gf * 3);
    for (let i = 0; i < embers; i++) { const a = (i / embers) * Math.PI * 2 + t * 1.5; pen.dot(cx + Math.cos(a) * (bw + unit * 0.12), cyb - unit * 0.1 + Math.sin(a) * unit * 0.3, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 5 + i))); }
    if (st >= 3) for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.33) % 1; pen.dot(cx + (i - 1) * unit * 0.12, cyb - bh - unit * 0.22 - ph * unit * 0.4, tk.hexA(p.glow, 0.55 * (1 - ph))); }
    pen.rect(cx - unit * 0.26, cyb - bh - unit * 0.2, cx + unit * 0.26, cyb - bh + unit * 0.04, p.accent);
    pen.rect(cx - unit * 0.2, cyb - bh - unit * 0.14, cx - unit * 0.06, cyb - bh - unit * 0.14 + (A.eyeMode === 'closed' ? blk : unit * 0.08), gl);
    pen.rect(cx + unit * 0.06, cyb - bh - unit * 0.14, cx + unit * 0.2, cyb - bh - unit * 0.14 + (A.eyeMode === 'closed' ? blk : unit * 0.08), gl);
  }

  // ==== 菌灵五分支异构:圆伞孢菇 / 尖锥毒伞 / 扁盘夜光 / 丛生菌网 / 世界树(深支)====
  function capshroom(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.6, unit * 0.14, 'rgba(0,0,0,0.3)');
    const sh = unit * (0.24 + 0.06 * gf); const stalkTop = cyb - unit * 0.02;
    pen.rect(cx - sh, stalkTop, cx + sh, gy - unit * 0.02, p.accent); pen.rect(cx - sh + blk, stalkTop, cx + sh - blk, gy - unit * 0.02, p.belly);
    const capW = unit * (0.58 + 0.28 * gf), capH = unit * (0.4 + 0.1 * gf), capY = cyb - unit * 0.3;
    pen.ell(cx, capY, capW + blk, capH + blk, p.accent); pen.ell(cx, capY, capW, capH, p.body);
    pen.rect(cx - capW, capY + capH * 0.6, cx + capW, capY + capH, p.shade);
    pen.ell(cx, capY - capH * 0.4, capW * 0.55, unit * 0.14, tk.hexA(p.glow, 0.3));
    const spots = 2 + Math.round(gf * 4);
    for (let i = 0; i < spots; i++) { const a = (i / (spots - 1 || 1)) * Math.PI - Math.PI; pen.dot(cx + Math.cos(a) * capW * 0.62, capY + Math.sin(a) * capH * 0.55, tk.hexA(p.belly, 0.92)); }
    const fy = cyb + unit * 0.16; tk.eyes(pen, cx, fy, unit * 0.09, unit * 0.15, p.eye, A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.15, unit, p.eye, A.mouth);
    const sp = 2 + Math.round(gf * 3);
    for (let i = 0; i < sp; i++) { const ph = (t * 0.5 + i * 0.33) % 1; pen.dot(cx + (i - sp / 2) * capW * 0.4, capY - capH - ph * unit * 0.5, tk.hexA(p.glow, 0.5 * (1 - ph))); }
    if (st >= 3) { pen.ell(cx, capY - capH - unit * 0.06, capW * 0.5 + blk, capH * 0.5 + blk, p.accent); pen.ell(cx, capY - capH - unit * 0.06, capW * 0.5, capH * 0.5, p.body); }
  }
  function toxcap(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.5, unit * 0.13, 'rgba(0,0,0,0.3)');
    const sh = unit * 0.2; const stalkTop = cyb - unit * 0.04;
    pen.rect(cx - sh, stalkTop, cx + sh, gy - unit * 0.02, p.accent); pen.rect(cx - sh + blk, stalkTop, cx + sh - blk, gy - unit * 0.02, p.belly);
    // 尖锥毒伞(随成长拔高)
    const capW = unit * (0.42 + 0.16 * gf), capH = unit * (0.5 + 0.26 * gf), capY = cyb - unit * 0.28;
    pen.triangle(cx, capY + unit * 0.14, capW + blk, cx, capY - capH - blk, p.accent);
    pen.triangle(cx, capY + unit * 0.1, capW, cx, capY - capH, p.body);
    for (let i = -1; i <= 1; i++) pen.rect(cx + i * capW * 0.5 - blk * 0.5, capY - capH * 0.6, cx + i * capW * 0.5 + blk * 0.5, capY + unit * 0.06, tk.hexA(p.accent, 0.55));
    pen.rect(cx - capW, capY + unit * 0.06, cx + capW, capY + unit * 0.16, p.shade);
    const drips = 1 + Math.round(gf * 3);
    for (let i = 0; i < drips; i++) { const dx = cx + ((i % 3) - 1) * capW * 0.55; const ph = (t * 0.6 + i * 0.4) % 1; pen.dot(dx, capY + unit * 0.16 + ph * unit * 0.4, tk.hexA(p.glow, 0.85 * (1 - ph * 0.5))); }
    if (st >= 3) for (let i = -2; i <= 2; i++) { const dx = cx + i * capW * 0.35; pen.rect(dx - blk * 0.4, capY + unit * 0.16, dx + blk * 0.4, capY + unit * (0.3 + 0.1 * Math.abs(Math.sin(t * 2 + i))), tk.hexA(p.glow, 0.55)); }
    const fy = cyb + unit * 0.16; tk.eyes(pen, cx, fy, unit * 0.08, unit * 0.16, p.eye, A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.15, unit, p.eye, A.mouth);
  }
  function lumocap(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.58, unit * 0.14, 'rgba(0,0,0,0.3)');
    const sh = unit * (0.22 + 0.05 * gf); const stalkTop = cyb - unit * 0.02;
    pen.rect(cx - sh, stalkTop, cx + sh, gy - unit * 0.02, p.accent); pen.rect(cx - sh + blk, stalkTop, cx + sh - blk, gy - unit * 0.02, p.belly);
    // 扁平发光伞 + 菌褶光条
    const capW = unit * (0.6 + 0.26 * gf), capH = unit * (0.28 + 0.06 * gf), capY = cyb - unit * 0.26;
    pen.ell(cx, capY, capW + blk, capH + blk, p.accent); pen.ell(cx, capY, capW, capH, p.body);
    const gills = 3 + Math.round(gf * 4);
    for (let i = 0; i < gills; i++) { const gx = cx - capW + (i + 0.5) * (2 * capW / gills); pen.rect(gx - blk * 0.4, capY + capH * 0.2, gx + blk * 0.4, capY + capH, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 3 + i))); }
    // 发光斑点(脉动)
    const dots = 3 + Math.round(gf * 4);
    for (let i = 0; i < dots; i++) { const a = (i / dots) * Math.PI * 2; pen.dot(cx + Math.cos(a) * capW * 0.55, capY + Math.sin(a) * capH * 0.5, tk.hexA(p.glow, 0.6 + 0.35 * Math.sin(t * 4 + i))); }
    if (st >= 3) for (let i = 0; i < 3; i++) pen.rect(cx - sh, cyb + unit * (0.1 + i * 0.18), cx + sh, cyb + unit * (0.13 + i * 0.18), tk.hexA(p.glow, 0.5 + 0.3 * Math.sin(t * 3 + i)));
    const fy = cyb + unit * 0.16; tk.eyes(pen, cx, fy, unit * 0.09, unit * 0.15, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.15, unit, p.eye, A.mouth);
  }
  function webcap(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.66, unit * 0.14, 'rgba(0,0,0,0.3)');
    // 丛生:主伞 + 随成长增多的小伞
    const clusters = 2 + Math.round(gf * 3);
    for (let i = 0; i < clusters; i++) {
      const side = (i % 2 ? 1 : -1); const dx = cx + side * (unit * 0.28 + (i >> 1) * unit * 0.16); const dh = unit * (0.2 + 0.05 * (i)); const topY = cyb - unit * 0.06 - (i >> 1) * unit * 0.1;
      pen.rect(dx - unit * 0.06, topY, dx + unit * 0.06, gy - unit * 0.02, p.accent);
      pen.ell(dx, topY - unit * 0.02, unit * (0.2 + 0.03 * i), dh, p.shade); pen.ell(dx, topY - unit * 0.02, unit * (0.16 + 0.03 * i), dh * 0.8, p.body);
    }
    // 主伞
    const capW = unit * (0.5 + 0.2 * gf), capY = cyb - unit * 0.3;
    pen.rect(cx - unit * 0.18, cyb - unit * 0.02, cx + unit * 0.18, gy - unit * 0.02, p.accent);
    pen.ell(cx, capY, capW + blk, unit * 0.34 + blk, p.accent); pen.ell(cx, capY, capW, unit * 0.34, p.body);
    // 网幕(伞下垂网,随成长更密)
    const veil = 3 + Math.round(gf * 4);
    for (let i = 0; i <= veil; i++) { const vx = cx - capW + i * (2 * capW / veil); pen.rect(vx - blk * 0.3, capY + unit * 0.24, vx + blk * 0.3, capY + unit * (0.4 + 0.14 * gf), tk.hexA(p.glow, 0.5)); }
    if (st >= 3) for (let i = -1; i <= 1; i++) { const vx = cx + i * capW * 0.5; pen.ell(vx, capY + unit * (0.44 + 0.06 * Math.sin(t * 2 + i)), unit * 0.07, unit * 0.09, tk.hexA(p.glow, 0.6)); }
    const fy = cyb + unit * 0.14; tk.eyes(pen, cx, fy, unit * 0.08, unit * 0.14, p.eye, A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.14, unit, p.eye, A.mouth);
  }
  function worldtree(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const sway = snap(Math.sin(t * 1.6) * unit * 0.04);
    pen.ell(cx, gy, unit * 0.6, unit * 0.14, 'rgba(0,0,0,0.3)');
    // 细高树干(随成长拔高变粗)
    const trunkW = unit * (0.16 + 0.08 * gf), topY = cy - unit * (0.3 + 0.5 * gf);
    pen.rect(cx - trunkW, topY, cx + trunkW, gy - unit * 0.02, p.accent);
    pen.rect(cx - trunkW + blk, topY, cx + trunkW - blk, gy - unit * 0.02, p.belly);
    // 根爪
    pen.rect(cx - trunkW - unit * 0.14, gy - unit * 0.1, cx - trunkW + blk, gy, p.shade); pen.rect(cx + trunkW - blk, gy - unit * 0.1, cx + trunkW + unit * 0.14, gy, p.shade);
    // 枝桠(层数随成长增加)+ 冠层菌帽
    const arms = 1 + Math.round(gf * 3);
    for (let i = 0; i < arms; i++) { const ay = topY + unit * 0.2 + i * unit * 0.26; const d = (i % 2 ? 1 : -1); const ax = cx + d * (unit * 0.3 + sway); pen.rect(cx, ay, ax, ay + blk, p.accent); pen.ell(ax, ay - unit * 0.06, unit * 0.16, unit * 0.12, p.body); pen.dot(ax, ay - unit * 0.06, tk.hexA(p.glow, 0.7)); }
    // 顶冠(世界树菌盖)
    const capW = unit * (0.44 + 0.22 * gf);
    pen.ell(cx + sway, topY, capW + blk, unit * (0.3 + 0.08 * gf) + blk, p.accent); pen.ell(cx + sway, topY, capW, unit * (0.3 + 0.08 * gf), p.body);
    for (let i = 0; i < 3 + Math.round(gf * 3); i++) { const a = (i / (3 + gf * 3)) * Math.PI - Math.PI; pen.dot(cx + sway + Math.cos(a) * capW * 0.6, topY + Math.sin(a) * unit * 0.16, tk.hexA(p.glow, 0.8)); }
    if (st >= 3) [-1, 1].forEach((d) => { for (let i = 0; i < 3; i++) pen.dot(cx + d * trunkW * 1.7, gy - unit * (0.12 + i * 0.18) - snap(Math.sin(t * 1.5 + i) * unit * 0.03), tk.hexA(p.glow, 0.6)); });
    // 脸(树干上)
    const fy = cy + unit * 0.24; tk.eyes(pen, cx, fy, unit * 0.08, unit * 0.14, p.eye, A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.14, unit, p.eye, A.mouth);
  }

  // ==== 甲蟹五分支异构:厚甲礁蟹 / 流线激流 / 长钳深海 / 招潮沙蟹 / 帝王蟹(深支)====
  function reefcrab(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.6);
    const bw = unit * (0.62 + 0.16 * gf), bh = unit * (0.3 + 0.08 * gf);
    pen.ell(cx, gy, bw + unit * 0.2, unit * 0.14, 'rgba(0,0,0,0.3)');
    const legs = 3;
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < legs; i++) { const lx = cx + d * (bw * 0.9 + i * unit * 0.14); pen.rect(cx + d * bw * 0.7, cyb + unit * 0.16, lx, cyb + unit * 0.24, p.shade); pen.rect(lx - blk, cyb + unit * 0.22, lx + blk, gy, p.accent); }
    // 粗厚双螯(随成长变大)
    const claw = snap((behavior === 'alert' ? 0.16 : (behavior === 'work' ? Math.abs(A.wave) * 0.12 : 0.06)) * unit); const cw = unit * (0.24 + 0.08 * gf);
    for (let d = -1; d <= 1; d += 2) { const ax = cx + d * (bw + unit * 0.16); pen.rect(cx + d * bw * 0.8, cyb, ax, cyb + unit * 0.16, p.shade); pen.rect(ax - cw, cyb - unit * 0.26, ax + cw, cyb - unit * 0.02, p.body); pen.rect(ax - cw, cyb + unit * 0.02 + claw, ax + cw, cyb + unit * 0.2 + claw, p.body); }
    // 厚重甲(高隆)
    pen.rect(cx - bw, cyb - bh, cx + bw, cyb + unit * 0.2, p.accent); pen.rect(cx - bw + blk, cyb - bh, cx + bw - blk, cyb + unit * 0.18, p.body);
    pen.rect(cx - bw * 0.7, cyb - bh - unit * 0.1, cx + bw * 0.7, cyb - bh + unit * 0.02, p.body);
    const ridges = 1 + Math.round(gf * 3);
    for (let i = 0; i < ridges; i++) pen.rect(cx - bw * 0.8, cyb - bh * 0.4 + i * (bh / (ridges + 1)), cx + bw * 0.8, cyb - bh * 0.4 + i * (bh / (ridges + 1)) + blk, tk.hexA(p.accent, 0.5));
    if (st >= 3) for (let i = 0; i < 3; i++) { const cxp = cx - bw * 0.4 + i * bw * 0.4; pen.triangle(cxp, cyb - bh, unit * 0.05, cxp, cyb - bh - unit * 0.14, tk.hexA(p.glow, 0.55)); }
    const ey = cyb - bh - unit * 0.14;
    for (let d = -1; d <= 1; d += 2) pen.rect(cx + d * unit * 0.2 - blk * 0.5, cyb - bh - unit * 0.02, cx + d * unit * 0.2 + blk * 0.5, ey, p.accent);
    tk.eyes(pen, cx, ey, unit * 0.08, unit * 0.2, p.eye, A.eyeMode, A.blink);
  }
  function riptidecrab(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.7);
    const bw = unit * (0.58 + 0.16 * gf), bh = unit * (0.26 + 0.06 * gf);
    pen.ell(cx, gy, bw + unit * 0.18, unit * 0.13, 'rgba(0,0,0,0.3)');
    // 桨足(划水,数量随成长)
    const paddles = 2 + Math.round(gf * 2);
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < paddles; i++) { const kick = snap(Math.sin(t * 5 + i + (d > 0 ? 1 : 0)) * unit * 0.08); const lx = cx + d * (bw * 0.85 + i * unit * 0.16); pen.rect(cx + d * bw * 0.66, cyb + unit * 0.1, lx, cyb + unit * 0.18 + kick, p.shade); pen.ell(lx, cyb + unit * 0.22 + kick, unit * 0.1, unit * 0.08, p.body); }
    // 细钳
    const claw = snap((behavior === 'work' ? Math.abs(A.wave) * 0.12 : 0.05) * unit);
    for (let d = -1; d <= 1; d += 2) { const ax = cx + d * (bw + unit * 0.1); pen.rect(cx + d * bw * 0.8, cyb, ax, cyb + unit * 0.1, p.shade); pen.triangle(ax, cyb - unit * 0.16, unit * 0.12, ax + d * unit * 0.12, cyb - unit * 0.02, p.body); pen.triangle(ax, cyb + unit * 0.06 + claw, unit * 0.1, ax + d * unit * 0.12, cyb + unit * 0.14 + claw, p.body); }
    // 流线甲(前尖后圆)
    pen.triangle(cx, cyb - bh - unit * 0.12, bw, cx - bw, cyb + unit * 0.16, p.accent);
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb, bw, bh, p.body);
    pen.triangle(cx, cyb - bh - unit * 0.06, bw * 0.7, cx, cyb + unit * 0.12, tk.hexA(p.belly, 0.5));
    // 波点纹
    for (let i = -1; i <= 1; i++) pen.dot(cx + i * bw * 0.4, cyb - unit * 0.04, tk.hexA(p.glow, 0.85));
    if (st >= 3) for (let i = -1; i <= 1; i++) pen.triangle(cx + i * bw * 0.3, cyb - bh, unit * 0.05, cx + i * bw * 0.3, cyb - bh - unit * (0.12 + 0.06 * gf), tk.hexA(p.belly, 0.8));
    const ey = cyb - bh - unit * 0.12;
    for (let d = -1; d <= 1; d += 2) pen.rect(cx + d * unit * 0.18 - blk * 0.5, cyb - bh, cx + d * unit * 0.18 + blk * 0.5, ey, p.accent);
    tk.eyes(pen, cx, ey, unit * 0.07, unit * 0.18, p.eye, A.eyeMode, A.blink);
  }
  function abysscrab(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.6);
    const bw = unit * (0.5 + 0.14 * gf), bh = unit * (0.24 + 0.06 * gf);
    pen.ell(cx, gy, bw + unit * 0.24, unit * 0.13, 'rgba(0,0,0,0.3)');
    // 细长步足
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const lx = cx + d * (bw + unit * (0.2 + i * 0.16)); pen.rect(cx + d * bw * 0.7, cyb + unit * 0.1, lx, cyb + unit * 0.14, p.shade); pen.rect(lx - blk * 0.6, cyb + unit * 0.12, lx + blk * 0.6, gy, p.accent); }
    // 长钳(细长,随成长更长)
    const claw = snap((behavior === 'alert' ? 0.14 : 0.05) * unit); const armL = unit * (0.5 + 0.2 * gf);
    for (let d = -1; d <= 1; d += 2) { const ax = cx + d * (bw * 0.6 + armL); pen.rect(cx + d * bw * 0.7, cyb + unit * 0.02, ax, cyb + unit * 0.08, p.shade); pen.triangle(ax, cyb - unit * 0.14, unit * 0.1, ax + d * unit * 0.16, cyb, p.body); pen.triangle(ax, cyb + unit * 0.04 + claw, unit * 0.08, ax + d * unit * 0.16, cyb + unit * 0.1 + claw, p.body); }
    // 窄甲
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb, bw, bh, p.body);
    pen.rect(cx - blk, cyb - bh, cx + blk, cyb + bh, tk.hexA(p.glow, 0.6)); // 中央发光棱脊
    // 发光眼柄(长,末端亮)
    const ey = cyb - bh - unit * (0.24 + 0.12 * gf);
    for (let d = -1; d <= 1; d += 2) { pen.rect(cx + d * unit * 0.16 - blk * 0.4, cyb - bh, cx + d * unit * 0.16 + blk * 0.4, ey, p.accent); pen.dot(cx + d * unit * 0.16, ey, tk.hexA(p.glow, 0.95)); }
    tk.eyes(pen, cx, ey + unit * 0.02, unit * 0.06, unit * 0.16, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
    // 生物光点
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) { const a = t + i * 2; pen.dot(cx + Math.cos(a) * bw, cyb + Math.sin(a) * bh, tk.hexA(p.glow, 0.5 + 0.3 * Math.sin(t * 3 + i))); }
    if (st >= 3) { pen.rect(cx - blk * 0.4, ey - unit * 0.02, cx + blk * 0.4, ey - unit * 0.16, p.accent); pen.dot(cx, ey - unit * 0.18, tk.hexA(p.glow, 0.7 + 0.3 * Math.sin(t * 3))); }
  }
  function sandcrab(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.7);
    const bw = unit * (0.44 + 0.12 * gf), bh = unit * (0.24 + 0.05 * gf);
    pen.ell(cx, gy, bw + unit * 0.4, unit * 0.13, 'rgba(0,0,0,0.3)');
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const lx = cx + d * (bw * 0.9 + i * unit * 0.12); pen.rect(cx + d * bw * 0.7, cyb + unit * 0.12, lx, cyb + unit * 0.18, p.shade); pen.rect(lx - blk * 0.6, cyb + unit * 0.16, lx + blk * 0.6, gy, p.accent); }
    // 招潮蟹:一大螯(随成长巨大,挥舞) + 一小螯
    const wave = snap((behavior === 'work' || behavior === 'alert' ? Math.abs(Math.sin(t * 4)) : 0.2) * unit * 0.3);
    const bigL = unit * (0.36 + 0.2 * gf); const ax = cx + bw + bigL * 0.4;
    pen.rect(cx + bw * 0.6, cyb - wave, ax, cyb + unit * 0.1 - wave, p.shade);
    pen.rect(ax - unit * 0.02, cyb - bigL * 0.5 - wave, ax + bigL * 0.6, cyb + unit * 0.06 - wave, p.body);
    pen.rect(ax - unit * 0.02, cyb - bigL * 0.7 - wave, ax + bigL * 0.6, cyb - bigL * 0.5 - wave + blk, p.accent);
    // 小螯
    pen.rect(cx - bw - unit * 0.12, cyb, cx - bw * 0.6, cyb + unit * 0.08, p.shade); pen.rect(cx - bw - unit * 0.16, cyb - unit * 0.08, cx - bw - unit * 0.02, cyb + unit * 0.02, p.body);
    // 甲
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb, bw, bh, p.body);
    if (st >= 3) { pen.rect(cx - bw * 0.24, cyb + unit * 0.02, cx - bw * 0.06, cyb + unit * 0.1, p.shade); pen.rect(cx - bw * 0.3, cyb - unit * 0.04, cx - bw * 0.12, cyb + unit * 0.04, p.body); }
    const ey = cyb - bh - unit * 0.12;
    for (let d = -1; d <= 1; d += 2) pen.rect(cx + d * unit * 0.16 - blk * 0.5, cyb - bh, cx + d * unit * 0.16 + blk * 0.5, ey, p.accent);
    tk.eyes(pen, cx, ey, unit * 0.07, unit * 0.18, p.eye, A.eyeMode, A.blink);
  }
  function kingcrab(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.5);
    const bw = unit * (0.58 + 0.22 * gf), bh = unit * (0.32 + 0.12 * gf);
    pen.ell(cx, gy, bw + unit * 0.3, unit * 0.15, 'rgba(0,0,0,0.32)');
    // 多长足(随成长增多变长)
    const legs = 3 + Math.round(gf * 1);
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < legs; i++) { const kick = snap(behavior === 'work' ? Math.sin(t * 4 + i) * unit * 0.05 : 0); const lx = cx + d * (bw + unit * (0.18 + i * 0.18)); const ly = cyb - unit * 0.06 + i * unit * 0.12; pen.rect(cx + d * bw * 0.7, ly, lx, ly + blk, p.shade); pen.rect(lx - blk, ly, lx + blk, gy - i * unit * 0.02 + kick, p.accent); pen.triangle(lx, gy - i * unit * 0.02 + kick, unit * 0.05, lx + d * unit * 0.08, gy + kick, p.accent); }
    // 巨螯
    const claw = snap((behavior === 'alert' ? 0.18 : (behavior === 'work' ? Math.abs(A.wave) * 0.12 : 0.06)) * unit); const cw = unit * (0.24 + 0.1 * gf);
    for (let d = -1; d <= 1; d += 2) { const ax = cx + d * (bw + unit * 0.22); pen.rect(cx + d * bw * 0.8, cyb, ax, cyb + unit * 0.16, p.shade); pen.rect(ax - cw, cyb - unit * 0.28, ax + cw, cyb - unit * 0.02, p.body); pen.rect(ax - cw, cyb + unit * 0.02 + claw, ax + cw, cyb + unit * 0.22 + claw, p.body); pen.triangle(ax, cyb - unit * 0.28, unit * 0.08, ax, cyb - unit * 0.44, p.accent); }
    // 多刺重甲
    pen.rect(cx - bw, cyb - bh, cx + bw, cyb + unit * 0.2, p.accent); pen.rect(cx - bw + blk, cyb - bh + blk * 0.5, cx + bw - blk, cyb + unit * 0.18, p.body);
    const spikes = 3 + Math.round(gf * 4);
    for (let i = 0; i <= spikes; i++) { const sx = cx - bw + i * (2 * bw / spikes); pen.triangle(sx, cyb - bh, unit * 0.08, sx, cyb - bh - unit * (0.14 + 0.08 * gf), p.accent); }
    if (st >= 3) for (let i = 0; i <= spikes; i++) { const sx = cx - bw + i * (2 * bw / spikes); pen.dot(sx, cyb - bh - unit * (0.14 + 0.08 * gf), tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 3 + i))); }
    pen.rect(cx - bw * 0.7, cyb - unit * 0.02, cx + bw * 0.7, cyb + unit * 0.06, tk.hexA(p.glow, 0.4));
    const ey = cyb - bh - unit * (0.18 + 0.08 * gf);
    for (let d = -1; d <= 1; d += 2) pen.rect(cx + d * unit * 0.22 - blk * 0.5, cyb - bh, cx + d * unit * 0.22 + blk * 0.5, ey, p.accent);
    tk.eyes(pen, cx, ey, unit * 0.08, unit * 0.2, p.eye, A.eyeMode, A.blink);
  }

  // ==== 甲虫新增两分支:圆润圣金甲 / 巨兜(深支)====
  function scarabgold(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    const bw = unit * (0.48 + 0.16 * gf), bh = unit * (0.5 + 0.14 * gf);
    pen.ell(cx, gy, bw + unit * 0.08, unit * 0.12, 'rgba(0,0,0,0.3)');
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const yy = cyb - unit * 0.06 + i * unit * 0.2; const kick = snap(behavior === 'work' ? Math.sin(t * 7 + i) * unit * 0.05 : 0); pen.rect(cx + d * bw * 0.7, yy, cx + d * (bw + unit * 0.14), yy + blk, p.accent); pen.rect(cx + d * (bw + unit * 0.08), yy, cx + d * (bw + unit * 0.2), yy + unit * 0.14 + kick, p.accent); }
    const hy = cyb - bh - unit * 0.02;
    pen.ell(cx, hy, unit * 0.28, unit * 0.2, p.shade);
    // 双触须(随成长增长,摆动)
    const ant = snap(Math.sin(t * 3) * unit * 0.05);
    [-1, 1].forEach((d) => { pen.rect(cx + d * unit * 0.06, hy - unit * 0.1, cx + d * unit * (0.14 + 0.06 * gf), hy - unit * (0.36 + 0.12 * gf) + ant, p.body); pen.dot(cx + d * unit * (0.14 + 0.06 * gf), hy - unit * (0.36 + 0.12 * gf) + ant, tk.hexA(p.glow, 0.9)); });
    // 圆润金甲(高光强)
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb, bw, bh, p.body);
    pen.rect(cx - blk * 0.5, cyb - bh, cx + blk * 0.5, cyb + bh, p.accent);
    pen.ell(cx - bw * 0.3, cyb - bh * 0.4, bw * 0.34, bh * 0.28, tk.hexA(p.glow, 0.45)); // 大高光
    const rings = 1 + Math.round(gf * 3);
    for (let r = 0; r < rings; r++) { const ry = cyb - bh * 0.2 + r * (bh / (rings + 1)); pen.rect(cx - bw * 0.7, ry, cx + bw * 0.7, ry + blk, tk.hexA(p.belly, 0.5)); }
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.13, p.eye, A.eyeMode, A.blink);
  }
  function goliathbeetle(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.14)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.8);
    const bw = unit * (0.56 + 0.22 * gf), bh = unit * (0.54 + 0.22 * gf);
    pen.ell(cx, gy, bw + unit * 0.1, unit * 0.13, 'rgba(0,0,0,0.32)');
    // 粗壮六足
    for (let d = -1; d <= 1; d += 2) for (let i = 0; i < 3; i++) { const yy = cyb - unit * 0.04 + i * unit * 0.2; const kick = snap(behavior === 'work' ? Math.sin(t * 6 + i) * unit * 0.05 : 0); pen.rect(cx + d * bw * 0.62, yy, cx + d * (bw + unit * 0.16), yy + blk * 1.2, p.accent); pen.rect(cx + d * (bw + unit * 0.08), yy, cx + d * (bw + unit * 0.24), yy + unit * 0.2 + kick, p.accent); }
    const hy = cyb - bh - unit * 0.04;
    pen.ell(cx, hy, unit * 0.32, unit * 0.22, p.shade);
    // 巨型 Y 形叉角(上颚二叉,随成长增大)
    const hornLen = unit * (0.5 + 0.4 * gf);
    pen.triangle(cx, hy, unit * 0.14, cx, hy - hornLen, p.body);
    [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.04, hy - hornLen * 0.6, unit * 0.08, cx + d * (unit * 0.24 + 0.14 * gf * unit), hy - hornLen - unit * 0.06, p.body));
    // 下颚小叉
    [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.1, hy + unit * 0.02, unit * 0.06, cx + d * unit * 0.28, hy - unit * 0.14, p.shade));
    // 厚背甲(高隆 + 中缝 + 层棱)
    pen.ell(cx, cyb, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb, bw, bh, p.body);
    pen.rect(cx - blk * 0.6, cyb - bh, cx + blk * 0.6, cyb + bh, p.accent);
    pen.ell(cx, cyb - bh * 0.5, bw * 0.5, unit * 0.16, tk.hexA(p.glow, 0.24));
    const ridges = 2 + Math.round(gf * 3);
    for (let r = 0; r < ridges; r++) { const ry = cyb - bh * 0.4 + r * (bh / (ridges + 1)); pen.rect(cx - bw * 0.75, ry, cx + bw * 0.75, ry + blk, tk.hexA(p.accent, 0.5)); }
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.14, p.eye, A.eyeMode, A.blink);
  }

  // ==== 史莱姆新增两分支:棱角晶凝 / 帝胶(深支)====
  function crystalslime(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + Math.round(A.bob / blk) * blk;
    pen.ell(cx, gy, unit * 0.6, unit * 0.13, 'rgba(0,0,0,0.3)');
    const bw = unit * (0.48 + 0.14 * gf), bh = unit * (0.48 + 0.12 * gf);
    // 棱角凝胶体(菱形上尖 + 方底)
    pen.triangle(cx, cyb + bh * 0.4, bw + blk, cx, cyb - bh - blk, p.accent);
    pen.triangle(cx, cyb + bh * 0.4, bw, cx, cyb - bh, p.body);
    pen.rect(cx - bw, cyb, cx + bw, cyb + bh * 0.5, p.accent); pen.rect(cx - bw + blk, cyb, cx + bw - blk, cyb + bh * 0.42, p.body);
    // 内含晶体(随成长增多增亮)
    const shards = 1 + Math.round(gf * 3);
    for (let i = 0; i < shards; i++) { const sx = cx + ((i % 3) - 1) * bw * 0.42; const sy = cyb - bh * 0.2 + (i % 2) * bh * 0.3; pen.triangle(sx, sy + unit * 0.12, unit * 0.07, sx, sy - unit * 0.16, tk.hexA(p.glow, 0.5 + 0.3 * Math.sin(t * 3 + i))); }
    // 外凸小晶
    [-1, 1].forEach((d) => pen.triangle(cx + d * bw * 0.7, cyb + unit * 0.02, unit * 0.06, cx + d * (bw + unit * (0.12 + 0.06 * gf)), cyb - unit * 0.14, p.shade));
    const fy = cyb + unit * 0.04; tk.eyes(pen, cx, fy, unit * 0.08, unit * 0.15, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.18, unit, p.eye, A.mouth);
  }
  function kingslime(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.14)); const pen = tk.makePen(ctx, cx, cy, blk);
    const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const sq = 1 + Math.sin(t * 2) * 0.05; const cyb = cy + Math.round(A.bob * 0.5 / blk) * blk;
    const bw = unit * (0.58 + 0.24 * gf), bh = unit * (0.54 + 0.2 * gf) * sq;
    pen.ell(cx, gy, bw + unit * 0.06, unit * 0.14, 'rgba(0,0,0,0.32)');
    // 巨型主体
    pen.ell(cx, cyb + unit * 0.14, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb + unit * 0.14, bw, bh, p.body);
    pen.ell(cx, cyb + unit * 0.34, bw * 0.7, bh * 0.5, p.belly);
    pen.ell(cx - bw * 0.28, cyb - bh * 0.2, bw * 0.3, bh * 0.32, tk.hexA(p.glow, 0.32));
    // 被吞噬的小核(随成长增多)
    const cores = Math.round(gf * 3);
    for (let i = 0; i < cores; i++) { const a = (i / (cores || 1)) * Math.PI - Math.PI * 0.5; const kx = cx + Math.cos(a) * bw * 0.5, ky = cyb + unit * 0.16 + Math.sin(a) * bh * 0.4; pen.ell(kx, ky, unit * 0.1, unit * 0.1, tk.hexA(p.belly, 0.8)); pen.dot(kx, ky, p.eye); }
    // 头顶叠一只小史莱姆(取代皇冠)
    const topY = cyb - bh + unit * 0.06;
    pen.ell(cx, topY, bw * 0.34 + blk, bh * 0.3 + blk, p.accent); pen.ell(cx, topY, bw * 0.32, bh * 0.28, p.body);
    tk.eyes(pen, cx, topY, unit * 0.05, unit * 0.09, p.eye, A.eyeMode, A.blink);
    // 大脸
    const fy = cyb + unit * 0.12; tk.eyes(pen, cx, fy, unit * 0.11, unit * 0.2, p.eye, A.eyeMode, A.blink); tk.mouth(pen, cx, fy + unit * 0.22, unit, p.eye, A.mouth);
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) { const dx = cx + (i - 1) * bw * 0.5; const ph = (t * 0.5 + i * 0.4) % 1; pen.dot(dx, cyb + unit * 0.14 + bh * 0.7 + ph * unit * 0.2, tk.hexA(p.glow, 0.5 * (1 - ph))); }
  }

  // ==== 喵仔新增深支:雷霆猫(cap15)====
  function thundercat(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    const bw = unit * (0.36 + 0.12 * gf), bh = unit * (0.42 + 0.12 * gf);
    pen.ell(cx, gy, unit * 0.55, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 雷环尾(带电火花,数量随成长)
    const tsw = snap(Math.sin(t * 3) * unit * 0.2); const sparks = 2 + Math.round(gf * 2);
    pen.rect(cx + unit * 0.3, cyb + unit * 0.1, cx + unit * 0.5, cyb + unit * 0.22, p.shade);
    for (let i = 0; i < sparks; i++) { pen.rect(cx + unit * (0.46 + i * 0.06), cyb - unit * (0.1 + i * 0.08) + tsw, cx + unit * (0.58 + i * 0.06), cyb - unit * (0.02 + i * 0.08) + tsw, i % 2 ? tk.hexA(p.glow, 0.9) : p.accent); }
    // 后腿
    [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.2 - blk, cyb + bh * 0.7, cx + d * unit * 0.2 + blk, gy, p.accent));
    // 身体
    pen.ell(cx, cyb + unit * 0.08, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb + unit * 0.08, bw, bh, p.body);
    pen.ell(cx, cyb + unit * 0.2, bw * 0.66, bh * 0.5, p.belly);
    // 闪电纹(随成长增多)
    const bolts = 1 + Math.round(gf * 2);
    for (let i = 0; i < bolts; i++) { const bx = cx + ((i % 2) ? 1 : -1) * bw * 0.4; ctx.strokeStyle = tk.hexA(p.glow, 0.9); ctx.lineWidth = Math.max(2, unit * 0.05); ctx.beginPath(); ctx.moveTo(bx, cyb - unit * 0.1); ctx.lineTo(bx + unit * 0.06, cyb + unit * 0.04); ctx.lineTo(bx - unit * 0.04, cyb + unit * 0.1); ctx.lineTo(bx + unit * 0.04, cyb + unit * 0.22); ctx.stroke(); }
    // 头 + 竖长耳(带电)
    const hy = cyb - bh - unit * 0.02;
    [-1, 1].forEach((d) => { pen.triangle(cx + d * unit * 0.16, hy - unit * 0.08, unit * 0.08, cx + d * unit * 0.22, hy - unit * (0.4 + 0.14 * gf), p.shade); pen.dot(cx + d * unit * 0.22, hy - unit * (0.4 + 0.14 * gf), tk.hexA(p.glow, 0.8 + 0.2 * Math.sin(t * 6))); });
    pen.ell(cx, hy, unit * 0.26 + blk, unit * 0.23 + blk, p.accent); pen.ell(cx, hy, unit * 0.26, unit * 0.23, p.body);
    // 雷鬃(成长后期)
    if (gf > 0.5) for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; pen.triangle(cx + Math.cos(a) * unit * 0.26, hy + Math.sin(a) * unit * 0.23, unit * 0.05, cx + Math.cos(a) * unit * 0.44, hy + Math.sin(a) * unit * 0.4, tk.hexA(p.glow, 0.7)); }
    tk.eyes(pen, cx, hy + unit * 0.02, unit * 0.07, unit * 0.13, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
  }

  // ==== 麒麟三分支异构:炎麒(烈焰鬃尾)/ 瑞麒(祥云玉鳞)/ 雷麒(锯齿电鬃)====
  function qilinflame(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.6);
    const bw = unit * (0.56 + 0.12 * gf), bh = unit * (0.3 + 0.06 * gf);
    pen.ell(cx, gy, bw + unit * 0.12, unit * 0.12, 'rgba(0,0,0,0.3)');
    [-0.5, -0.2, 0.28, 0.56].forEach((dx, i) => { const lx = cx + dx * unit; const kick = snap(behavior === 'work' ? Math.sin(t * 6 + i) * unit * 0.04 : 0); pen.rect(lx - blk * 0.6, cyb + unit * 0.16, lx + blk * 0.6, gy + kick, i % 2 ? p.accent : p.shade); pen.rect(lx - blk * 0.7, gy - blk, lx + blk * 0.7, gy + kick, tk.hexA(p.glow, 0.55)); });
    // 烈焰尾(多舌,随成长增多)
    const fl = snap(Math.abs(Math.sin(t * 4)) * unit * 0.14);
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) pen.triangle(cx - bw * 0.9, cyb + unit * 0.05, unit * 0.1, cx - bw * 1.05 - i * unit * 0.06, cyb - unit * (0.28 + 0.12 * i) - fl, i % 2 ? tk.hexA(p.glow, 0.95) : p.body);
    pen.ell(cx, cyb + unit * 0.05, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb + unit * 0.05, bw, bh, p.body); pen.ell(cx, cyb + unit * 0.14, bw * 0.72, bh * 0.6, p.belly);
    // 燃烧背鬃(数量随成长)
    const mane = 3 + Math.round(gf * 3);
    for (let i = 0; i < mane; i++) { const mx = cx - bw * 0.5 + i * (bw / mane); pen.triangle(mx, cyb - bh * 0.7, unit * 0.05, mx + snap(Math.sin(t * 5 + i) * unit * 0.03), cyb - bh - unit * (0.16 + 0.1 * gf) - ((i % 2) ? unit * 0.05 : 0), tk.hexA(p.glow, 0.9)); }
    const hx = cx + bw * 0.85, hy = cyb - unit * 0.3;
    pen.rect(cx + bw * 0.5, cyb - unit * 0.28, cx + bw * 0.85, cyb + unit * 0.08, p.accent); pen.rect(cx + bw * 0.54, cyb - unit * 0.24, cx + bw * 0.8, cyb + unit * 0.04, p.body);
    pen.ell(hx, hy, unit * 0.22 + blk, unit * 0.18 + blk, p.accent); pen.ell(hx, hy, unit * 0.22, unit * 0.18, p.body);
    // 火焰鹿角(上冲,随成长增高分叉)
    [-1, 1].forEach((d) => { pen.triangle(hx + d * unit * 0.08, hy - unit * 0.08, unit * 0.05, hx + d * unit * 0.12, hy - unit * (0.4 + 0.16 * gf), tk.hexA(p.glow, 0.92)); if (gf > 0.4) pen.triangle(hx + d * unit * 0.1, hy - unit * 0.3, unit * 0.03, hx + d * unit * 0.26, hy - unit * 0.44, tk.hexA(p.glow, 0.85)); });
    if (st >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - t * 1.5; pen.dot(cx + Math.cos(a) * bw * 1.2, cyb + Math.sin(a) * bh * 1.1, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 5 + i))); }
    tk.eyes(pen, hx + unit * 0.04, hy, unit * 0.06, unit * 0.11, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
  }
  function qilinjade(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.5);
    const bw = unit * (0.58 + 0.12 * gf), bh = unit * (0.34 + 0.06 * gf);   // 更圆润
    pen.ell(cx, gy, bw + unit * 0.12, unit * 0.12, 'rgba(0,0,0,0.3)');
    [-0.5, -0.2, 0.28, 0.56].forEach((dx, i) => { const lx = cx + dx * unit; pen.rect(lx - blk * 0.7, cyb + unit * 0.18, lx + blk * 0.7, gy, i % 2 ? p.accent : p.shade); });
    // 祥云卷尾(叠圆弧,轻摆)
    const sw = snap(Math.sin(t * 2) * unit * 0.05);
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) pen.ell(cx - bw * 0.85 - i * unit * 0.12, cyb - unit * (0.02 + 0.1 * i) + sw, unit * (0.16 - 0.02 * i), unit * 0.13, i % 2 ? p.belly : p.body);
    pen.ell(cx, cyb + unit * 0.05, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb + unit * 0.05, bw, bh, p.body); pen.ell(cx, cyb + unit * 0.16, bw * 0.74, bh * 0.6, p.belly);
    // 玉鳞点(随成长增多)
    for (let i = 0; i < 3 + Math.round(gf * 3); i++) { const a = (i / (3 + gf * 3)) * Math.PI; pen.dot(cx - bw * 0.4 + Math.cos(a) * bw * 0.5, cyb + unit * 0.02 - Math.sin(a) * bh * 0.4, tk.hexA(p.glow, 0.8)); }
    // 叶状背鬃(圆润)
    const mane = 3 + Math.round(gf * 2);
    for (let i = 0; i < mane; i++) { const mx = cx - bw * 0.4 + i * (bw * 0.8 / mane); pen.ell(mx, cyb - bh - unit * 0.06, unit * 0.08, unit * (0.12 + 0.05 * gf), tk.hexA(p.glow, 0.85)); }
    const hx = cx + bw * 0.85, hy = cyb - unit * 0.28;
    pen.rect(cx + bw * 0.52, cyb - unit * 0.26, cx + bw * 0.85, cyb + unit * 0.08, p.accent); pen.rect(cx + bw * 0.56, cyb - unit * 0.22, cx + bw * 0.8, cyb + unit * 0.04, p.body);
    pen.ell(hx, hy, unit * 0.24 + blk, unit * 0.2 + blk, p.accent); pen.ell(hx, hy, unit * 0.24, unit * 0.2, p.body);
    // 短鹿角(圆钝) + 额宝珠
    [-1, 1].forEach((d) => pen.triangle(hx + d * unit * 0.1, hy - unit * 0.1, unit * 0.05, hx + d * unit * 0.18, hy - unit * (0.28 + 0.1 * gf), p.shade));
    pen.dot(hx, hy - unit * 0.16, tk.hexA(p.glow, 0.95));
    if (st >= 3) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + t * 0.8; pen.ell(cx + Math.cos(a) * bw * 1.1, cyb - unit * 0.1 + Math.sin(a) * bh * 0.6, unit * 0.1, unit * 0.07, tk.hexA(p.belly, 0.6)); }
    tk.eyes(pen, hx + unit * 0.04, hy + unit * 0.01, unit * 0.06, unit * 0.11, p.eye, A.eyeMode, A.blink);
  }
  function qilinstorm(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.7);
    const bw = unit * (0.54 + 0.12 * gf), bh = unit * (0.28 + 0.06 * gf);   // 更瘦削
    pen.ell(cx, gy, bw + unit * 0.12, unit * 0.12, 'rgba(0,0,0,0.3)');
    [-0.5, -0.2, 0.28, 0.56].forEach((dx, i) => { const lx = cx + dx * unit; const kick = snap(behavior === 'work' ? Math.sin(t * 7 + i) * unit * 0.05 : 0); pen.rect(lx - blk * 0.5, cyb + unit * 0.16, lx + blk * 0.5, gy + kick, i % 2 ? p.accent : p.shade); });
    // 电尾(锯齿分段 + 火花)
    let px = cx - bw * 0.85, py = cyb + unit * 0.05;
    for (let i = 0; i < 3 + Math.round(gf * 2); i++) { const nx = px - unit * 0.14, ny = py + (i % 2 ? 1 : -1) * unit * 0.12; pen.rect(Math.min(px, nx) - blk * 0.4, Math.min(py, ny) - blk * 0.4, Math.max(px, nx) + blk * 0.4, Math.max(py, ny) + blk * 0.4, tk.hexA(p.glow, 0.9)); px = nx; py = ny; }
    pen.ell(cx, cyb + unit * 0.05, bw + blk, bh + blk, p.accent); pen.ell(cx, cyb + unit * 0.05, bw, bh, p.body); pen.ell(cx, cyb + unit * 0.14, bw * 0.7, bh * 0.55, p.belly);
    // 尖锐电鬃(顶端火花,随成长增多)
    const mane = 4 + Math.round(gf * 3);
    for (let i = 0; i < mane; i++) { const mx = cx - bw * 0.5 + i * (bw / mane); const th = cyb - bh - unit * (0.18 + 0.12 * gf) - ((i % 2) ? unit * 0.06 : 0); pen.triangle(mx, cyb - bh * 0.7, unit * 0.04, mx, th, p.shade); if (Math.sin(t * 8 + i) > 0.3) pen.dot(mx, th, tk.hexA(p.glow, 0.95)); }
    const hx = cx + bw * 0.85, hy = cyb - unit * 0.3;
    pen.rect(cx + bw * 0.5, cyb - unit * 0.26, cx + bw * 0.85, cyb + unit * 0.06, p.accent); pen.rect(cx + bw * 0.54, cyb - unit * 0.22, cx + bw * 0.8, cyb + unit * 0.02, p.body);
    pen.ell(hx, hy, unit * 0.22 + blk, unit * 0.18 + blk, p.accent); pen.ell(hx, hy, unit * 0.22, unit * 0.18, p.body);
    // 之字形雷角 + 角间电弧
    [-1, 1].forEach((d) => { pen.triangle(hx + d * unit * 0.08, hy - unit * 0.08, unit * 0.04, hx + d * unit * 0.2, hy - unit * (0.36 + 0.14 * gf), p.shade); });
    if (Math.sin(t * 9) > 0) { ctx.strokeStyle = tk.hexA(p.glow, 0.95); ctx.lineWidth = Math.max(2, unit * 0.05); ctx.beginPath(); ctx.moveTo(hx - unit * 0.14, hy - unit * 0.36); ctx.lineTo(hx, hy - unit * 0.2); ctx.lineTo(hx + unit * 0.14, hy - unit * 0.36); ctx.stroke(); }
    if (st >= 3) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + t * 2; pen.dot(cx + Math.cos(a) * bw * 1.15, cyb + Math.sin(a) * bh * 1.1, tk.hexA(p.glow, 0.4 + 0.4 * Math.sin(t * 7 + i))); }
    tk.eyes(pen, hx + unit * 0.04, hy, unit * 0.06, unit * 0.11, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
  }

  // ==== 玄武三分支异构:岩甲龟(棱角石甲+尖刺)/ 潮甲龟(光滑波甲+鳍)/ 星甲龟(星座甲+环星)====
  function genbustone(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.4);
    const sw = unit * (0.58 + 0.16 * gf), sh = unit * (0.44 + 0.14 * gf);
    pen.ell(cx, gy, sw + unit * 0.16, unit * 0.13, 'rgba(0,0,0,0.32)');
    [-0.58, -0.32, 0.32, 0.58].forEach((dx) => pen.rect(cx + dx * unit - blk * 1.2, cyb + unit * 0.2, cx + dx * unit + blk * 1.2, gy, p.shade));
    pen.rect(cx - sw * 0.9, cyb + unit * 0.08, cx - sw * 0.6, cyb + unit * 0.22, p.shade); pen.triangle(cx - sw * 0.9, cyb + unit * 0.15, blk, cx - sw * 1.06, cyb + unit * 0.02, p.accent);
    const hx = cx + sw * 0.92, hy = cyb + unit * 0.02;
    pen.rect(cx + sw * 0.6, cyb - unit * 0.02, cx + sw * 0.92, cyb + unit * 0.14, p.shade);
    pen.ell(hx, hy, unit * 0.2 + blk, unit * 0.16 + blk, p.accent); pen.ell(hx, hy, unit * 0.2, unit * 0.16, p.body);
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.05, unit * 0.09, p.eye, A.eyeMode, A.blink);
    // 棱角石甲 + 板块 + 甲缘尖刺(随成长增多)
    pen.ell(cx, cyb - unit * 0.05, sw + blk, sh + blk, p.accent); pen.ell(cx, cyb - unit * 0.05, sw, sh, p.shade); pen.ell(cx, cyb - unit * 0.1, sw * 0.7, sh * 0.68, p.body);
    const plates = 3 + Math.round(gf * 3);
    for (let i = 0; i < plates; i++) { const a = (i / plates) * Math.PI * 2; const px = cx + Math.cos(a) * sw * 0.42, py = cyb - unit * 0.08 + Math.sin(a) * sh * 0.42; pen.rect(px - blk, py - blk, px + blk, py + blk, tk.hexA(p.accent, 0.6)); }
    for (let i = 0; i <= plates; i++) { const sx = cx - sw + i * (2 * sw / plates); pen.triangle(sx, cyb - sh * 0.2, unit * 0.06, sx, cyb - sh - unit * (0.06 + 0.06 * gf), p.accent); }
    if (st >= 3) for (let i = 0; i < 3; i++) pen.rect(cx - sw * 0.4 + i * sw * 0.4 - blk * 0.4, cyb - sh * 0.5, cx - sw * 0.4 + i * sw * 0.4 + blk * 0.4, cyb + sh * 0.2, tk.hexA(p.glow, 0.35 + 0.25 * Math.sin(t * 3 + i)));
  }
  function genbutide(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.5);
    const sw = unit * (0.6 + 0.16 * gf), sh = unit * (0.42 + 0.12 * gf);
    pen.ell(cx, gy, sw + unit * 0.16, unit * 0.13, 'rgba(0,0,0,0.3)');
    // 前足 + 后鳍(划水)
    [-0.5, 0.34].forEach((dx) => pen.rect(cx + dx * unit - blk, cyb + unit * 0.2, cx + dx * unit + blk, gy, p.shade));
    const fin = snap(Math.sin(t * 3) * unit * 0.08);
    [-0.62, 0.6].forEach((dx) => { pen.triangle(cx + dx * unit, cyb + unit * 0.16, unit * 0.1, cx + dx * unit * 1.3, cyb + unit * 0.3 + fin, tk.hexA(p.belly, 0.9)); });
    // 流线尾
    pen.triangle(cx - sw * 0.85, cyb + unit * 0.06, unit * 0.12, cx - sw * 1.15 + fin, cyb - unit * 0.08, p.shade);
    const hx = cx + sw * 0.9, hy = cyb + unit * 0.0;
    pen.rect(cx + sw * 0.58, cyb - unit * 0.04, cx + sw * 0.9, cyb + unit * 0.12, p.shade);
    pen.ell(hx, hy, unit * 0.2 + blk, unit * 0.16 + blk, p.accent); pen.ell(hx, hy, unit * 0.2, unit * 0.16, p.body);
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.05, unit * 0.1, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
    // 光滑波甲(高光 + 波纹环,随成长增多)
    pen.ell(cx, cyb - unit * 0.05, sw + blk, sh + blk, p.accent); pen.ell(cx, cyb - unit * 0.05, sw, sh, p.body);
    const rings = 1 + Math.round(gf * 3);
    for (let i = 0; i < rings; i++) pen.ell(cx, cyb - unit * 0.08, sw * (0.3 + i * 0.2), sh * (0.28 + i * 0.18), tk.hexA(p.glow, 0.3));
    pen.ell(cx - sw * 0.28, cyb - sh * 0.4, sw * 0.28, sh * 0.24, tk.hexA(p.belly, 0.55));
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) { const ph = (t * 0.6 + i * 0.4) % 1; pen.dot(cx + (i - 1) * sw * 0.3, cyb - sh - ph * unit * 0.3, tk.hexA(p.glow, 0.6 * (1 - ph))); }
    if (st >= 3) for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.33) % 1; pen.dot(cx + (i - 1) * sw * 0.24, cyb - sh - unit * 0.14 - ph * unit * 0.4, tk.hexA(p.glow, 0.55 * (1 - ph))); }
  }
  function genbuastral(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.4);
    const sw = unit * (0.58 + 0.14 * gf), sh = unit * (0.46 + 0.14 * gf);
    pen.ell(cx, gy, sw + unit * 0.14, unit * 0.13, 'rgba(0,0,0,0.3)');
    [-0.56, -0.3, 0.3, 0.56].forEach((dx) => pen.rect(cx + dx * unit - blk, cyb + unit * 0.2, cx + dx * unit + blk, gy, p.shade));
    // 长颈(星甲龟颈更长)+ 头
    pen.rect(cx - sw * 0.9, cyb + unit * 0.06, cx - sw * 0.62, cyb + unit * 0.2, p.shade);
    const hx = cx + sw * 0.98, hy = cyb - unit * 0.08;
    pen.rect(cx + sw * 0.55, cyb - unit * 0.06, cx + sw * 0.82, cyb + unit * 0.12, p.shade);
    pen.rect(cx + sw * 0.72, cyb - unit * 0.1, cx + sw * 0.9, cyb + unit * 0.04, p.shade);
    pen.ell(hx, hy, unit * 0.2 + blk, unit * 0.16 + blk, p.accent); pen.ell(hx, hy, unit * 0.2, unit * 0.16, p.body);
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.05, unit * 0.1, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
    // 星座甲(深色穹顶 + 星点连线,随成长增多)
    pen.ell(cx, cyb - unit * 0.05, sw + blk, sh + blk, p.accent); pen.ell(cx, cyb - unit * 0.05, sw, sh, p.shade); pen.ell(cx, cyb - unit * 0.1, sw * 0.72, sh * 0.68, p.body);
    const stars = 4 + Math.round(gf * 4);
    for (let i = 0; i < stars; i++) { const a = (i / stars) * Math.PI * 2 + t * 0.2; pen.dot(cx + Math.cos(a) * sw * 0.44, cyb - unit * 0.08 + Math.sin(a) * sh * 0.44, tk.hexA(p.glow, 0.7 + 0.3 * Math.sin(t * 3 + i))); }
    pen.dot(cx, cyb - unit * 0.1, tk.hexA(p.glow, 0.95));
    // 环绕星(随成长)
    for (let i = 0; i < 3 + Math.round(gf * 3); i++) { const a = (i / (3 + gf * 3)) * Math.PI * 2 - t * 0.6; pen.dot(cx + Math.cos(a) * (sw + unit * 0.16), cyb - unit * 0.06 + Math.sin(a) * (sh * 0.7), tk.hexA(p.glow, 0.5)); }
    if (st >= 3) { pen.dot(cx, cyb - sh - unit * 0.14, tk.hexA(p.glow, 0.9)); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; pen.dot(cx + Math.cos(a) * unit * 0.16, cyb - sh - unit * 0.14 + Math.sin(a) * unit * 0.12, tk.hexA(p.glow, 0.6)); } }
  }

  // ==== 混沌三分支异构:虚(坍缩裂隙+长触须)/ 乱(抖动多菱+繁眼)/ 辉(对称几何金框)====
  function chaosdiam(pen, px, py, R, color) { pen.triangle(px, py, R, px, py - R, color); pen.triangle(px, py, R, px, py + R, color); }
  function chaosvoid(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * 0.05);
    pen.ell(cx, gy, unit * 0.42, unit * 0.1, 'rgba(0,0,0,0.26)');
    // 少而长的触须(缓慢扭动)
    const arms = 2 + Math.round(gf * 2);
    for (let i = 0; i < arms; i++) { const bx = cx + (i - (arms - 1) / 2) * (unit * 0.7 / arms); const wig = snap(Math.sin(t * 2 + i) * unit * 0.12); pen.rect(bx - blk * 0.5, cyb + unit * 0.22, bx + blk * 0.5, cyb + unit * 0.5, p.shade); pen.rect(bx - blk * 0.5 + wig, cyb + unit * 0.44, bx + blk * 0.5 + wig, gy + unit * 0.06, p.accent); }
    // 坍缩核(菱形 + 内陷暗隙)
    chaosdiam(pen, cx, cyb, unit * (0.5 + 0.12 * gf) + blk, p.accent);
    chaosdiam(pen, cx, cyb, unit * (0.5 + 0.12 * gf), p.body);
    chaosdiam(pen, cx, cyb, unit * 0.24, p.shade);
    // 裂隙(竖直发光缝)+ 冷星
    pen.rect(cx - blk * 0.5, cyb - unit * (0.36 + 0.1 * gf), cx + blk * 0.5, cyb + unit * (0.36 + 0.1 * gf), tk.hexA(p.glow, 0.85));
    for (let i = 0; i < 2 + Math.round(gf * 2); i++) { const a = i * 2.3 + t * 0.3; pen.dot(cx + Math.cos(a) * unit * 0.7, cyb + Math.sin(a) * unit * 0.5, tk.hexA(p.glow, 0.4)); }
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 - t * 0.8; pen.rect(cx + Math.cos(a) * unit * 0.8 - blk * 0.5, cyb + Math.sin(a) * unit * 0.55 - blk * 0.5, cx + Math.cos(a) * unit * 0.8 + blk * 0.5, cyb + Math.sin(a) * unit * 0.55 + blk * 0.5, tk.hexA(p.shade, 0.7)); }
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.1, unit * 0.17, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
  }
  function chaosflux(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 3) * unit * 0.06);
    pen.ell(cx, gy, unit * 0.48, unit * 0.1, 'rgba(0,0,0,0.26)');
    // 繁多乱触须(快速抖动,随成长更多)
    const arms = 4 + Math.round(gf * 3);
    for (let i = 0; i < arms; i++) { const bx = cx + (i - (arms - 1) / 2) * (unit * 1.1 / arms); const wig = snap(Math.sin(t * 5 + i * 1.7) * unit * 0.14); pen.rect(bx - blk * 0.5, cyb + unit * 0.22, bx + blk * 0.5, cyb + unit * 0.46, p.shade); pen.rect(bx - blk * 0.5 + wig, cyb + unit * 0.42, bx + blk * 0.5 + wig, gy + unit * 0.04, p.accent); }
    // 抖动多菱核(偏移叠层)
    const j = snap(Math.sin(t * 7) * unit * 0.05);
    chaosdiam(pen, cx, cyb, unit * (0.5 + 0.12 * gf) + blk, p.accent);
    chaosdiam(pen, cx + j, cyb - j, unit * (0.42 + 0.1 * gf), p.body);
    chaosdiam(pen, cx - j, cyb + j, unit * 0.28, tk.hexA(p.glow, 0.6));
    // 繁眼(随成长更多)+ 主眼
    const eyeN = 3 + Math.round(gf * 3);
    for (let i = 0; i < eyeN; i++) { const a = i * 1.9 + t * 0.3; const ex = cx + Math.cos(a) * unit * 0.3, ey = cyb + Math.sin(a) * unit * 0.26; pen.rect(ex - blk, ey - blk, ex + blk, ey + blk, p.belly); pen.dot(ex + (A.eyeMode === 'closed' ? 99 : 0), ey, p.eye); }
    for (let i = 0; i < 4 + Math.round(gf * 3); i++) { const a = i * 1.3 + t * 2; pen.dot(cx + Math.cos(a) * unit * 0.8, cyb + Math.sin(a) * unit * 0.5, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 4 + i))); }
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = i * 1.7 + t * 3; chaosdiam(pen, cx + Math.cos(a) * unit * 0.85, cyb + Math.sin(a) * unit * 0.6, unit * 0.08, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 6 + i))); }
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.09, unit * 0.16, p.eye, A.eyeMode, A.blink);
  }
  function chaosgold(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 1.8) * unit * 0.04);
    pen.ell(cx, gy, unit * 0.46, unit * 0.1, 'rgba(0,0,0,0.26)');
    // 对称触须(工整,成对)
    const pairs = 1 + Math.round(gf * 2);
    for (let i = 1; i <= pairs; i++) [-1, 1].forEach((d) => { const bx = cx + d * i * (unit * 0.28); pen.rect(bx - blk * 0.5, cyb + unit * 0.22, bx + blk * 0.5, gy + unit * 0.02, p.accent); });
    // 几何金框(菱形边框,替代柔光大晕:硬边、对称、高级)
    const R = unit * (0.62 + 0.14 * gf);
    ctx.strokeStyle = tk.hexA(p.glow, 0.8); ctx.lineWidth = Math.max(2, unit * 0.05);
    ctx.beginPath(); ctx.moveTo(cx, cyb - R); ctx.lineTo(cx + R, cyb); ctx.lineTo(cx, cyb + R); ctx.lineTo(cx - R, cyb); ctx.closePath(); ctx.stroke();
    if (gf > 0.4) { const R2 = R * 0.72; ctx.beginPath(); ctx.moveTo(cx, cyb - R2); ctx.lineTo(cx + R2, cyb); ctx.lineTo(cx, cyb + R2); ctx.lineTo(cx - R2, cyb); ctx.closePath(); ctx.stroke(); }
    // 分层金菱核(工整)
    chaosdiam(pen, cx, cyb, unit * (0.48 + 0.1 * gf) + blk, p.accent);
    chaosdiam(pen, cx, cyb, unit * (0.48 + 0.1 * gf), p.body);
    chaosdiam(pen, cx, cyb, unit * 0.3, tk.hexA(p.belly, 0.9));
    chaosdiam(pen, cx, cyb, unit * 0.16, tk.hexA(p.glow, 0.7 + 0.25 * Math.sin(t * 3)));
    // 四方光点(对称)
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; pen.dot(cx + Math.cos(a) * R, cyb + Math.sin(a) * R, tk.hexA(p.glow, 0.9)); }
    if (st >= 3) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 0.8; pen.rect(cx + Math.cos(a) * R * 1.15 - blk * 0.4, cyb + Math.sin(a) * R * 1.15 - blk * 0.4, cx + Math.cos(a) * R * 1.15 + blk * 0.4, cyb + Math.sin(a) * R * 1.15 + blk * 0.4, tk.hexA(p.glow, 0.6)); }
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.09, unit * 0.16, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
  }

  // ==== 幽灯三分支异构:炎魂(升腾烈焰)/ 霜魂(悬浮冰晶)/ 冥魂(幽冥鬼火)====
  function emberwisp(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * (2.4 + gf)) * unit * 0.07);
    pen.ell(cx, gy, unit * 0.34, unit * 0.1, 'rgba(0,0,0,0.28)');
    const sway = snap(Math.sin(t * (3.5 + gf)) * unit * 0.08);
    // 多层升腾火舌(随成长增多、跳动)
    const tips = 3 + Math.round(gf * 3);
    for (let i = 0; i < tips; i++) { const dx = cx + (i - (tips - 1) / 2) * unit * 0.16; pen.triangle(dx, cyb + unit * 0.3, unit * 0.09, dx + snap(Math.sin(t * 5 + i) * unit * 0.05), cyb - unit * (0.36 + 0.4 * Math.abs(Math.sin(t * 3 + i)) + 0.1 * gf), i % 2 ? tk.hexA(p.glow, 0.9) : p.body); }
    pen.triangle(cx, cyb + unit * 0.6, unit * 0.5, cx + sway, cyb - unit * (0.66 + 0.12 * gf), p.accent);
    pen.triangle(cx, cyb + unit * 0.56, unit * 0.4, cx + sway, cyb - unit * 0.56, p.body);
    pen.triangle(cx, cyb + unit * 0.5, unit * 0.22, cx + sway * 0.6, cyb - unit * 0.4, tk.hexA(p.glow, 0.75));
    pen.ell(cx, cyb + unit * 0.5, unit * 0.5 + blk, unit * 0.24, p.accent); pen.ell(cx, cyb + unit * 0.5, unit * 0.5, unit * 0.24, p.body);
    pen.ell(cx, cyb + unit * 0.02, unit * 0.14, unit * 0.16, tk.hexA(p.glow, 0.85));
    tk.eyes(pen, cx, cyb + unit * 0.12, unit * 0.08, unit * 0.15, p.eye, A.eyeMode, A.blink);
    tk.mouth(pen, cx, cyb + unit * 0.3, unit, p.eye, A.mouth);
    if (st >= 2) for (let i = 0; i < 3 + Math.round(gf * 2); i++) { const ph = (t * 0.7 + i * 0.3) % 1; pen.dot(cx + Math.sin(i * 2 + t) * unit * 0.4, cyb - unit * 0.4 - ph * unit * 0.6, tk.hexA(p.glow, 0.7 * (1 - ph))); }
    if (st >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 1.5; pen.dot(cx + Math.cos(a) * unit * 0.5, cyb + unit * 0.2 + Math.sin(a) * unit * 0.28, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 5 + i))); }
  }
  function frostwisp(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 1.8) * unit * 0.06);
    pen.ell(cx, gy, unit * 0.32, unit * 0.1, 'rgba(0,0,0,0.26)');
    // 悬浮冰晶主体(上下双菱,非火焰)
    const bh = unit * (0.5 + 0.14 * gf);
    pen.triangle(cx, cyb + unit * 0.5, unit * 0.4, cx, cyb - bh, p.accent);
    pen.triangle(cx, cyb + unit * 0.44, unit * 0.32, cx, cyb - bh + unit * 0.06, p.body);
    pen.triangle(cx, cyb + unit * 0.5, unit * 0.4, cx, cyb + unit * 0.66, p.accent);
    pen.triangle(cx, cyb + unit * 0.44, unit * 0.32, cx, cyb + unit * 0.6, p.body);
    pen.triangle(cx, cyb + unit * 0.1, unit * 0.14, cx, cyb - unit * 0.2, tk.hexA(p.belly, 0.9));
    // 侧冰棱(st1,随成长增多)
    if (st >= 1) [-1, 1].forEach((d) => { for (let i = 0; i < 1 + Math.round(gf * 2); i++) pen.triangle(cx + d * unit * 0.2, cyb + unit * (0.06 + i * 0.18), unit * 0.06, cx + d * unit * (0.4 + 0.1 * gf), cyb - unit * 0.1 + i * unit * 0.18, tk.hexA(p.belly, 0.85)); });
    tk.eyes(pen, cx, cyb + unit * 0.02, unit * 0.07, unit * 0.13, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
    if (st >= 2) for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i * 0.33) % 1; pen.dot(cx + (i - 1) * unit * 0.3, cyb + unit * 0.4 - ph * unit * 0.4, tk.hexA(p.belly, 0.5 * (1 - ph))); }
    if (st >= 3) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - t * 1.2; pen.triangle(cx + Math.cos(a) * unit * 0.6, cyb + Math.sin(a) * unit * 0.4 - unit * 0.06, unit * 0.05, cx + Math.cos(a) * unit * 0.6, cyb + Math.sin(a) * unit * 0.4 - unit * 0.18, tk.hexA(p.glow, 0.7)); }
  }
  function netherwisp(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 1.6) * unit * 0.06);
    pen.ell(cx, gy, unit * 0.3, unit * 0.09, 'rgba(0,0,0,0.24)');
    // 幽冥拖尾(下垂烟须,飘动)
    for (let i = 0; i < 3 + (st >= 2 ? 2 : 0); i++) { const dx = cx + (i - (2 + (st >= 2 ? 1 : 0))) * unit * 0.16; const wig = snap(Math.sin(t * 2 + i) * unit * 0.08); pen.triangle(dx, cyb + unit * 0.16, unit * 0.06, dx + wig, cyb + unit * 0.6, tk.hexA(p.body, 0.6)); }
    // 幽体(顶尖泪滴)
    pen.triangle(cx, cyb + unit * 0.34, unit * 0.34, cx, cyb - unit * (0.56 + 0.12 * gf), p.accent);
    pen.ell(cx, cyb + unit * 0.16, unit * 0.4 + blk, unit * 0.3 + blk, p.accent); pen.ell(cx, cyb + unit * 0.16, unit * 0.34, unit * 0.26, p.body);
    // 角状冥焰(st1)
    if (st >= 1) [-1, 1].forEach((d) => pen.triangle(cx + d * unit * 0.2, cyb - unit * 0.26, unit * 0.06, cx + d * unit * (0.3 + 0.1 * gf), cyb - unit * (0.48 + 0.14 * gf), tk.hexA(p.glow, 0.85)));
    // 空洞发光眼(wraith)
    tk.eyes(pen, cx, cyb + unit * 0.08, unit * 0.09, unit * 0.16, tk.hexA(p.glow, 0.95), A.eyeMode === 'closed' ? 'closed' : 'wide', A.blink);
    if (st >= 2) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * unit * 0.5, cyb + unit * 0.12 + Math.sin(a) * unit * 0.3, tk.hexA(p.glow, 0.6)); }
    if (st >= 3) for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.33) % 1; pen.dot(cx + (i - 1) * unit * 0.34, cyb - unit * 0.5 - ph * unit * 0.4, tk.hexA(p.glow, 0.6 * (1 - ph))); }
  }

  // ==== 羽禽三分支异构:游隼(前倾尖翼)/ 雷鸟(宽翼扇尾)/ 火凤(火羽长尾)====
  function falconbird(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob); const lean = unit * 0.12;
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 尖削后掠翼(振翅随成长/行为)
    const sp = st >= 2 ? (behavior === 'work' || behavior === 'alert' ? snap(Math.abs(A.wave) * unit * (0.3 + 0.2 * gf)) : snap((0.08 + 0.08 * gf) * unit)) : 0;
    for (let d = -1; d <= 1; d += 2) { pen.triangle(cx + d * unit * 0.24, cyb - unit * 0.02, unit * 0.12, cx + d * (unit * 0.72 + sp), cyb + unit * 0.24 - sp, p.shade); pen.triangle(cx + d * unit * 0.24, cyb - unit * 0.02, unit * 0.08, cx - unit * 0.06 + d * (unit * 0.5 + sp), cyb - unit * 0.24 - sp, tk.hexA(p.belly, 0.9)); }
    // 尖三尾羽
    for (let i = -1; i <= 1; i++) pen.triangle(cx - unit * 0.3, cyb + unit * 0.2, unit * 0.07, cx - unit * (0.66 + 0.1 * gf), cyb + unit * 0.34 + i * unit * 0.12, i % 2 ? p.shade : p.body);
    if (st >= 1) [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.06 + lean - blk, cyb + unit * 0.34, cx + d * unit * 0.06 + lean + blk, gy, p.accent));
    // 流线躯干(前倾)
    pen.ell(cx + lean * 0.5, cyb + unit * 0.06, unit * 0.34 + blk, unit * 0.44 + blk, p.accent); pen.ell(cx + lean * 0.5, cyb + unit * 0.06, unit * 0.34, unit * 0.44, p.body);
    pen.ell(cx + lean * 0.5, cyb + unit * 0.16, unit * 0.24, unit * 0.28, p.belly);
    // 头(前伸)+ 短冠 + 钩喙
    const hx = cx + lean + unit * 0.28, hy = cyb - unit * 0.32;
    pen.ell(hx, hy, unit * 0.22, unit * 0.2, p.body);
    if (st >= 1) pen.triangle(hx - unit * 0.1, hy - unit * 0.14, unit * 0.05, hx - unit * 0.22, hy - unit * (0.24 + 0.08 * gf), p.shade);
    pen.triangle(hx + unit * 0.16, hy, unit * 0.06, hx + unit * 0.4, hy + unit * 0.06, '#ffca3a'); pen.triangle(hx + unit * 0.3, hy + unit * 0.04, unit * 0.04, hx + unit * 0.4, hy + unit * 0.14, '#ffca3a');
    tk.eyes(pen, hx + unit * 0.02, hy - unit * 0.02, unit * 0.06, unit * 0.1, p.eye, A.eyeMode, A.blink);
    // 疾风线(st3)
    if (st >= 3) for (let i = 0; i < 3; i++) { const ph = (t * 1.2 + i * 0.33) % 1; pen.rect(cx - unit * 0.7 - ph * unit * 0.3, cyb - unit * 0.1 + i * unit * 0.12, cx - unit * 0.5 - ph * unit * 0.3, cyb - unit * 0.08 + i * unit * 0.12, tk.hexA(p.glow, 0.5 * (1 - ph))); }
  }
  function tempestbird(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob);
    pen.ell(cx, gy, unit * 0.54, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 宽大双翼(带翼骨,展开随成长)
    const spw = st >= 2 ? (behavior === 'work' || behavior === 'alert' ? snap(Math.abs(A.wave) * unit * (0.36 + 0.2 * gf)) : snap((0.14 + 0.08 * gf) * unit)) : unit * 0.1;
    for (let d = -1; d <= 1; d += 2) { pen.triangle(cx + d * unit * 0.26, cyb + unit * 0.06, unit * 0.2, cx + d * (unit * 0.9 + spw), cyb - unit * 0.4 - spw, p.shade); pen.triangle(cx + d * unit * 0.26, cyb + unit * 0.1, unit * 0.12, cx + d * (unit * 0.7 + spw), cyb - unit * 0.05 - spw, tk.hexA(p.belly, 0.9)); for (let r = 1; r <= 2 + (st >= 3 ? 1 : 0); r++) pen.rect(cx + d * unit * (0.4 + r * 0.2), cyb - unit * (0.05 + r * 0.14) - spw, cx + d * unit * (0.4 + r * 0.2) + blk, cyb + unit * 0.02 - spw, tk.hexA(p.accent, 0.6)); }
    // 宽尾羽扇
    const tn = 5; for (let i = 0; i < tn; i++) { const a = -Math.PI / 2 + (i - (tn - 1) / 2) * 0.28; pen.triangle(cx, cyb + unit * 0.4, unit * 0.1, cx + Math.cos(a) * unit * (0.7 + 0.15 * gf), cyb + unit * 0.7 - Math.sin(a) * unit * 0.3, i % 2 ? p.shade : p.body); }
    if (st >= 1) [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.1 - blk, cyb + unit * 0.44, cx + d * unit * 0.1 + blk, gy, p.accent));
    // 粗壮躯干
    pen.ell(cx, cyb + unit * 0.04, unit * 0.42 + blk, unit * 0.56 + blk, p.accent); pen.ell(cx, cyb + unit * 0.04, unit * 0.42, unit * 0.56, p.body);
    pen.ell(cx, cyb + unit * 0.16, unit * 0.3, unit * 0.34, p.belly);
    // 头 + 立冠(st1)
    const hy = cyb - unit * 0.5; pen.ell(cx, hy, unit * 0.28, unit * 0.26, p.body);
    if (st >= 1) for (let i = -1; i <= 1; i++) pen.triangle(cx + i * unit * 0.08, hy - unit * 0.18, unit * 0.05, cx + i * unit * 0.12, hy - unit * (0.4 + 0.12 * gf), p.shade);
    pen.triangle(cx + unit * 0.24, hy - unit * 0.02, unit * 0.07, cx + unit * 0.46, hy + unit * 0.02, '#ffca3a');
    tk.eyes(pen, cx + unit * 0.02, hy - unit * 0.02, unit * 0.07, unit * 0.12, tk.hexA(p.glow, 0.9), A.eyeMode, A.blink);
    // 电弧(st2)/ 雷环(st3)
    if (st >= 2 && Math.sin(t * 7) > 0) { ctx.strokeStyle = tk.hexA(p.glow, 0.95); ctx.lineWidth = Math.max(2, unit * 0.05); ctx.beginPath(); ctx.moveTo(cx - unit * 0.3, cyb); ctx.lineTo(cx - unit * 0.1, cyb + unit * 0.1); ctx.lineTo(cx - unit * 0.2, cyb + unit * 0.24); ctx.stroke(); }
    if (st >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 2; pen.dot(cx + Math.cos(a) * unit * 0.7, cyb + Math.sin(a) * unit * 0.5, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 6 + i))); }
  }
  function phoenixbird(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob); const fl = snap(Math.abs(Math.sin(t * 4)) * unit * 0.1);
    pen.ell(cx, gy, unit * 0.5, unit * 0.12, 'rgba(0,0,0,0.3)');
    // 长火尾(多条飘带,随成长增多)
    for (let i = 0; i < 3 + Math.round(gf * 2); i++) { const dy = cyb + unit * 0.4; pen.triangle(cx - unit * 0.1, dy, unit * 0.08, cx - unit * (0.6 + 0.2 * gf) - i * unit * 0.05, dy + unit * 0.3 - i * unit * 0.12 + fl, i % 2 ? tk.hexA(p.glow, 0.9) : p.body); }
    // 火翼(层数随成长)
    const sp = (st >= 2 ? snap((0.14 + 0.1 * gf) * unit) + (behavior === 'alert' || behavior === 'work' ? snap(Math.abs(A.wave) * unit * 0.24) : 0) : unit * 0.08);
    for (let d = -1; d <= 1; d += 2) for (let r = 0; r < 2 + (st >= 3 ? 1 : 0); r++) pen.triangle(cx + d * unit * 0.24, cyb + unit * 0.06, unit * 0.12, cx + d * (unit * 0.7 + sp + r * 0.1), cyb - unit * (0.2 + r * 0.24) - sp - fl, r % 2 ? tk.hexA(p.glow, 0.9) : p.shade);
    if (st >= 1) [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.1 - blk, cyb + unit * 0.44, cx + d * unit * 0.1 + blk, gy, p.accent));
    pen.ell(cx, cyb + unit * 0.04, unit * 0.38 + blk, unit * 0.5 + blk, p.accent); pen.ell(cx, cyb + unit * 0.04, unit * 0.38, unit * 0.5, p.body);
    pen.ell(cx, cyb + unit * 0.16, unit * 0.28, unit * 0.3, p.belly);
    const hy = cyb - unit * 0.46; pen.ell(cx, hy, unit * 0.26, unit * 0.24, p.body);
    // 火冠(高,随成长)
    for (let i = -1; i <= 1; i++) pen.triangle(cx + i * unit * 0.07, hy - unit * 0.16, unit * 0.05, cx + i * unit * 0.1, hy - unit * (0.4 + 0.16 * gf) - fl, tk.hexA(p.glow, 0.9));
    pen.triangle(cx + unit * 0.22, hy - unit * 0.02, unit * 0.06, cx + unit * 0.42, hy + unit * 0.02, '#ffca3a');
    tk.eyes(pen, cx + unit * 0.02, hy - unit * 0.02, unit * 0.06, unit * 0.11, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
    if (st >= 3) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - t * 1.5; pen.dot(cx + Math.cos(a) * unit * 0.7, cyb + Math.sin(a) * unit * 0.5, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 5 + i))); }
  }

  // ==== 机偶三分支异构:齿轮机(黄铜齿轮)/ 电弧机(特斯拉线圈)/ 等离机(悬浮能核)====
  function cogbot(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.6);
    pen.ell(cx, gy, unit * 0.56, unit * 0.13, 'rgba(0,0,0,0.32)');
    if (st >= 1) { pen.rect(cx - unit * 0.3, gy - unit * 0.26, cx - unit * 0.08, gy, p.shade); pen.rect(cx + unit * 0.08, gy - unit * 0.26, cx + unit * 0.3, gy, p.shade); }
    // 活塞臂(st2,work 伸缩)
    if (st >= 2) [-1, 1].forEach((d) => { const ext = snap(behavior === 'work' ? Math.abs(A.wave) * unit * 0.08 : 0); pen.rect(cx + d * unit * 0.4, cyb - unit * 0.04, cx + d * (unit * 0.58 + (d > 0 ? ext : -ext) / 1), cyb + unit * 0.08, p.shade); pen.rect(cx + d * unit * 0.54, cyb - unit * 0.08, cx + d * unit * 0.7, cyb + unit * 0.12, p.body); });
    // 圆润黄铜躯干
    pen.ell(cx, cyb + unit * 0.06, unit * 0.44 + blk, unit * 0.42 + blk, p.accent); pen.ell(cx, cyb + unit * 0.06, unit * 0.44, unit * 0.42, p.body);
    // 大齿轮(胸口,旋转;齿数随成长)
    const teeth = 8 + Math.round(gf * 4); const gr = unit * 0.24;
    for (let i = 0; i < teeth; i++) { const a = t * 1.5 + (i / teeth) * Math.PI * 2; pen.rect(cx + Math.cos(a) * gr - blk * 0.5, cyb + unit * 0.04 + Math.sin(a) * gr - blk * 0.5, cx + Math.cos(a) * gr + blk * 0.5, cyb + unit * 0.04 + Math.sin(a) * gr + blk * 0.5, p.shade); }
    pen.ell(cx, cyb + unit * 0.04, gr * 0.8, gr * 0.8, p.accent); pen.ell(cx, cyb + unit * 0.04, unit * 0.08, unit * 0.08, tk.hexA(p.glow, 0.7));
    // 头(圆罩)+ 目
    const hy = cyb - unit * 0.44; pen.ell(cx, hy, unit * 0.24 + blk, unit * 0.2 + blk, p.accent); pen.ell(cx, hy, unit * 0.24, unit * 0.2, p.body);
    pen.rect(cx - unit * 0.14, hy - unit * 0.02, cx + unit * 0.14, hy + (A.eyeMode === 'closed' ? blk : unit * 0.07), tk.hexA(p.eye, 0.95));
    // 侧齿轮(st3)
    if (st >= 3) [-1, 1].forEach((d) => { for (let i = 0; i < 6; i++) { const a = -t * 2 + (i / 6) * Math.PI * 2; pen.dot(cx + d * unit * 0.5 + Math.cos(a) * unit * 0.1, cyb + unit * 0.2 + Math.sin(a) * unit * 0.1, p.shade); } });
  }
  function arcbot(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(A.bob * 0.7);
    pen.ell(cx, gy, unit * 0.46, unit * 0.12, 'rgba(0,0,0,0.32)');
    if (st >= 1) { pen.rect(cx - unit * 0.22, gy - unit * 0.28, cx - unit * 0.06, gy, p.shade); pen.rect(cx + unit * 0.06, gy - unit * 0.28, cx + unit * 0.22, gy, p.shade); }
    // 瘦高机身
    pen.rect(cx - unit * 0.32, cyb - unit * 0.34, cx + unit * 0.32, cyb + unit * 0.46, p.accent);
    pen.rect(cx - unit * 0.26, cyb - unit * 0.3, cx + unit * 0.26, cyb + unit * 0.42, p.body);
    // 肩部线圈节点 + 之间电弧(st2 起,随成长更强)
    [-1, 1].forEach((d) => { pen.ell(cx + d * unit * 0.34, cyb - unit * 0.2, unit * 0.1, unit * 0.1, p.shade); pen.dot(cx + d * unit * 0.34, cyb - unit * 0.2, tk.hexA(p.glow, 0.9)); });
    if (st >= 2 && Math.sin(t * 8) > 0) { ctx.strokeStyle = tk.hexA(p.glow, 0.95); ctx.lineWidth = Math.max(2, unit * 0.05); ctx.beginPath(); ctx.moveTo(cx - unit * 0.34, cyb - unit * 0.2); ctx.lineTo(cx - unit * 0.1, cyb - unit * 0.28); ctx.lineTo(cx + unit * 0.1, cyb - unit * 0.14); ctx.lineTo(cx + unit * 0.34, cyb - unit * 0.2); ctx.stroke(); }
    // 胸口电弧竖条
    pen.rect(cx - blk * 0.5, cyb - unit * 0.12, cx + blk * 0.5, cyb + unit * 0.3, tk.hexA(p.glow, 0.7 + 0.25 * Math.sin(t * (4 + gf * 2))));
    // 头(窄)+ 特斯拉塔天线
    const hy = cyb - unit * 0.5; pen.rect(cx - unit * 0.2, hy - unit * 0.18, cx + unit * 0.2, hy + unit * 0.18, p.accent); pen.rect(cx - unit * 0.16, hy - unit * 0.14, cx + unit * 0.16, hy + unit * 0.14, p.body);
    pen.rect(cx - unit * 0.12, hy - unit * 0.02, cx + unit * 0.12, hy + (A.eyeMode === 'closed' ? blk : unit * 0.07), tk.hexA(p.eye, 0.95));
    const tower = 1 + Math.round(gf * 2);
    for (let i = 0; i < tower; i++) pen.rect(cx - blk * (0.5 - i * 0.1), hy - unit * (0.18 + i * 0.14) - unit * 0.14, cx + blk * (0.5 - i * 0.1), hy - unit * (0.18 + i * 0.14), p.shade);
    pen.dot(cx, hy - unit * (0.18 + tower * 0.14), tk.hexA(p.glow, 0.7 + 0.3 * Math.abs(Math.sin(t * 6))));
    // 环绕电球(st3)
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + t * 2; pen.dot(cx + Math.cos(a) * unit * 0.5, cyb + Math.sin(a) * unit * 0.3, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 7 + i))); }
  }
  function plasmabot(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * (0.06 + 0.04 * gf)); // 悬浮
    pen.ell(cx, gy, unit * 0.4, unit * 0.1, 'rgba(0,0,0,0.26)');
    // 悬浮分体环(上下两段,绕核旋转开合)
    const gap = unit * (0.12 + 0.05 * Math.sin(t * 2));
    pen.rect(cx - unit * 0.38, cyb - unit * 0.4, cx + unit * 0.38, cyb - gap, p.accent);
    pen.rect(cx - unit * 0.32, cyb - unit * 0.36, cx + unit * 0.32, cyb - gap - blk, p.body);
    pen.rect(cx - unit * 0.38, cyb + gap, cx + unit * 0.38, cyb + unit * 0.4, p.accent);
    pen.rect(cx - unit * 0.32, cyb + gap + blk, cx + unit * 0.32, cyb + unit * 0.36, p.body);
    // 等离子核(脉动菱形)
    const cr = unit * (0.14 + 0.04 * Math.sin(t * 5));
    pen.triangle(cx, cyb + cr + unit * 0.06, unit * 0.16, cx, cyb - cr - unit * 0.1, tk.hexA(p.glow, 0.6));
    pen.ell(cx, cyb, cr, cr, tk.hexA(p.glow, 0.9));
    // 环绕碎片(st1 起,数量/转速随成长)
    const shards = 2 + Math.round(gf * 3);
    for (let i = 0; i < shards; i++) { const a = (i / shards) * Math.PI * 2 + t * (1.5 + gf); pen.rect(cx + Math.cos(a) * unit * 0.5 - blk * 0.5, cyb + Math.sin(a) * unit * 0.34 - blk * 0.5, cx + Math.cos(a) * unit * 0.5 + blk * 0.5, cyb + Math.sin(a) * unit * 0.34 + blk * 0.5, p.shade); }
    // 目(核上)
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.07, unit * 0.12, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
    // 外能量环(st3)
    if (st >= 3) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - t * 1.2; pen.dot(cx + Math.cos(a) * unit * 0.66, cyb + Math.sin(a) * unit * 0.44, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 5 + i))); }
  }

  // ==== 渊妖四异构:潮妖(柔水钟罩)/ 毒妖(瘤突滴毒)/ 虚渊(棱角星膜)/ 噬渊(巨口)====
  function tidalkraken(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * 0.05);
    pen.ell(cx, gy, unit * 0.7, unit * 0.12, 'rgba(0,0,0,0.28)');
    const arms = 4 + Math.round(gf * 3);
    for (let i = 0; i < arms; i++) { const bx = cx + (i - (arms - 1) / 2) * (unit * 1.2 / arms); const wig = snap(Math.sin(t * 2.5 + i) * unit * 0.12); pen.rect(bx - blk * 0.5, cyb + unit * 0.14, bx + blk * 0.5, cyb + unit * 0.42, p.body); pen.triangle(bx + wig, gy + unit * 0.04, blk, bx + wig * 0.6, cyb + unit * 0.4, tk.hexA(p.belly, 0.8)); }
    pen.ell(cx, cyb, unit * (0.5 + 0.1 * gf) + blk, unit * (0.44 + 0.08 * gf) + blk, p.accent); pen.ell(cx, cyb, unit * (0.5 + 0.1 * gf), unit * (0.44 + 0.08 * gf), p.body);
    const frn = 6; for (let i = 0; i < frn; i++) { const fx = cx - unit * 0.44 + i * (unit * 0.88 / (frn - 1)); pen.triangle(fx, cyb + unit * 0.32, unit * 0.06, fx, cyb + unit * (0.44 + 0.04 * Math.sin(t * 3 + i)), tk.hexA(p.belly, 0.7)); }
    pen.ell(cx, cyb - unit * 0.14, unit * 0.3, unit * 0.14, tk.hexA(p.glow, 0.25));
    if (st >= 2) for (let i = 0; i < 3; i++) { const ph = (t * 0.6 + i * 0.33) % 1; pen.dot(cx + (i - 1) * unit * 0.1, cyb - unit * 0.44 - ph * unit * 0.4, tk.hexA(p.belly, 0.6 * (1 - ph))); }
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.1, unit * 0.18, p.eye, A.eyeMode === 'closed' ? 'closed' : 'wide', A.blink);
    if (st >= 3) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * unit * 0.66, cyb + Math.sin(a) * unit * 0.4, tk.hexA(p.glow, 0.5 + 0.3 * Math.sin(t * 4 + i))); }
  }
  function caustickraken(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2.2) * unit * 0.05);
    pen.ell(cx, gy, unit * 0.68, unit * 0.12, 'rgba(0,0,0,0.28)');
    const arms = 4 + Math.round(gf * 2);
    for (let i = 0; i < arms; i++) { const bx = cx + (i - (arms - 1) / 2) * (unit * 1.2 / arms); const wig = snap(Math.sin(t * 3 + i) * unit * 0.08); pen.rect(bx - blk * 0.6, cyb + unit * 0.14, bx + blk * 0.6, cyb + unit * 0.42, p.shade); pen.rect(bx - blk * 0.6 + wig, cyb + unit * 0.38, bx + blk * 0.6 + wig, cyb + unit * 0.6, p.body); const ph = (t * 0.6 + i * 0.4) % 1; pen.dot(bx + wig, cyb + unit * 0.6 + ph * unit * 0.14, tk.hexA(p.glow, 0.7 * (1 - ph))); }
    pen.triangle(cx, cyb + unit * 0.18, unit * 0.56, cx, cyb - unit * 0.56, p.accent);
    pen.triangle(cx, cyb + unit * 0.14, unit * 0.48, cx, cyb - unit * 0.5, p.body);
    pen.ell(cx, cyb + unit * 0.14, unit * 0.5 + blk, unit * 0.24 + blk, p.accent); pen.ell(cx, cyb + unit * 0.14, unit * 0.5, unit * 0.24, p.body);
    if (st >= 1) for (let i = 0; i < 3 + Math.round(gf * 3); i++) { const a = -Math.PI * 0.5 + (i - 2) * 0.5; const r = unit * (0.07 + 0.02 * Math.sin(t * 3 + i)); pen.ell(cx + Math.cos(a) * unit * 0.3, cyb - unit * 0.14 + Math.sin(a) * unit * 0.16, r, r, tk.hexA(p.glow, 0.75)); }
    if (st >= 2) for (let i = -2; i <= 2; i++) pen.triangle(cx + i * unit * 0.16, cyb - unit * 0.5, unit * 0.05, cx + i * unit * 0.16, cyb - unit * (0.62 + 0.08 * gf), p.accent);
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.1, unit * 0.18, p.eye, A.eyeMode === 'closed' ? 'closed' : 'wide', A.blink);
    if (st >= 3) for (let i = 0; i < 4; i++) { const ph = (t * 0.4 + i * 0.25) % 1; pen.dot(cx + (i - 1.5) * unit * 0.3, cyb - unit * 0.5 - ph * unit * 0.4, tk.hexA(p.glow, 0.5 * (1 - ph))); }
  }
  function voidkraken(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 1.8) * unit * 0.04);
    pen.ell(cx, gy, unit * 0.66, unit * 0.12, 'rgba(0,0,0,0.28)');
    const arms = 3 + Math.round(gf * 2);
    for (let i = 0; i < arms; i++) { const bx = cx + (i - (arms - 1) / 2) * (unit * 1.1 / arms); const wig = snap(Math.sin(t * 1.8 + i) * unit * 0.06); pen.rect(bx - blk * 0.6, cyb + unit * 0.14, bx + blk * 0.6, cyb + unit * 0.44, p.accent); pen.triangle(bx + wig, gy, blk, bx + wig, cyb + unit * 0.42, p.shade); pen.dot(bx, cyb + unit * 0.5, tk.hexA(p.glow, 0.7)); }
    pen.triangle(cx, cyb + unit * 0.2, unit * 0.6, cx, cyb - unit * (0.62 + 0.1 * gf), p.accent);
    pen.triangle(cx, cyb + unit * 0.16, unit * 0.5, cx, cyb - unit * 0.56, p.body);
    pen.ell(cx, cyb + unit * 0.14, unit * 0.5 + blk, unit * 0.22 + blk, p.accent); pen.ell(cx, cyb + unit * 0.14, unit * 0.5, unit * 0.22, p.body);
    for (let i = 0; i < 4 + Math.round(gf * 4); i++) { const a = i * 1.7 + t * 0.2; pen.dot(cx + Math.cos(a) * unit * 0.34, cyb - unit * 0.16 + Math.sin(a) * unit * 0.24, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 3 + i))); }
    if (st >= 2) pen.rect(cx - blk * 0.5, cyb - unit * 0.5, cx + blk * 0.5, cyb + unit * 0.1, tk.hexA(p.glow, 0.8));
    tk.eyes(pen, cx, cyb - unit * 0.02, unit * 0.1, unit * 0.18, tk.hexA(p.glow, 0.95), A.eyeMode === 'closed' ? 'closed' : 'wide', A.blink);
    if (st >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 - t * 0.8; pen.rect(cx + Math.cos(a) * unit * 0.7 - blk * 0.5, cyb + Math.sin(a) * unit * 0.44 - blk * 0.5, cx + Math.cos(a) * unit * 0.7 + blk * 0.5, cyb + Math.sin(a) * unit * 0.44 + blk * 0.5, p.shade); }
  }
  function mawkraken(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.13)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * 0.04);
    pen.ell(cx, gy, unit * 0.72, unit * 0.13, 'rgba(0,0,0,0.3)');
    // 环绕冠状触手
    const arms = 6 + Math.round(gf * 2);
    for (let i = 0; i < arms; i++) { const a = Math.PI + (i / (arms - 1)) * Math.PI; const bx = cx + Math.cos(a) * unit * 0.5; const by = cyb + unit * 0.06 + Math.sin(a) * unit * 0.2; const wig = snap(Math.sin(t * 3 + i) * unit * 0.08); pen.rect(bx - blk * 0.5, by, bx + blk * 0.5, by + unit * 0.3, p.shade); pen.triangle(bx + wig, by + unit * 0.4, blk, bx + wig, by + unit * 0.28, p.accent); }
    // 巨口主体
    const bw = unit * (0.52 + 0.1 * gf);
    pen.ell(cx, cyb, bw + blk, unit * (0.5 + 0.1 * gf) + blk, p.accent); pen.ell(cx, cyb, bw, unit * (0.5 + 0.1 * gf), p.body);
    const gape = unit * (0.14 + 0.06 * Math.abs(Math.sin(t * 3)) + 0.04 * gf);
    pen.ell(cx, cyb + unit * 0.12, unit * 0.34, gape + unit * 0.14, p.accent);
    pen.ell(cx, cyb + unit * 0.12, unit * 0.28, gape + unit * 0.08, '#2a0a14');
    // 上下利齿(随成长增多)
    const teeth = 4 + Math.round(gf * 3);
    for (let i = 0; i < teeth; i++) { const tx = cx - unit * 0.26 + i * (unit * 0.52 / (teeth - 1)); pen.triangle(tx, cyb + unit * 0.02, unit * 0.04, tx, cyb + unit * 0.14, '#fff7ea'); pen.triangle(tx, cyb + unit * 0.22 + gape, unit * 0.04, tx, cyb + unit * 0.12 + gape, '#fff7ea'); }
    if (st >= 2) pen.dot(cx, cyb + unit * 0.12, tk.hexA(p.glow, 0.6 + 0.3 * Math.sin(t * 4)));
    tk.eyes(pen, cx, cyb - unit * 0.26, unit * 0.08, unit * 0.13, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
    if (st >= 1) [-1, 1].forEach((d) => pen.dot(cx + d * unit * 0.2, cyb - unit * 0.3, tk.hexA(p.glow, 0.8)));
    if (st >= 3) for (let i = 0; i < 5; i++) { const ph = (t * 0.7 + i * 0.2) % 1; const a = i * 1.3; pen.dot(cx + Math.cos(a) * unit * 0.7 * (1 - ph * 0.5), cyb + unit * 0.12 + Math.sin(a) * unit * 0.4 * (1 - ph * 0.5), tk.hexA(p.glow, 0.5 * (1 - ph))); }
  }

  // ==== 星辉四异构:圣辉(羽翼天使)/ 星使(星屑星环)/ 金辉(镀金重甲)/ 神辉(太阳圣座)====
  function sacredseraph(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * (0.05 + 0.04 * gf));
    pen.ell(cx, gy, unit * 0.46, unit * 0.11, 'rgba(0,0,0,0.26)');
    const wings = 2 + (st >= 2 ? 1 : 0) + (st >= 3 ? 1 : 0); const wf = snap(Math.abs(Math.sin(t * 2.5)) * unit * (0.04 + 0.06 * gf));
    for (let d = -1; d <= 1; d += 2) for (let w = 0; w < wings; w++) { const up = unit * (0.1 + w * 0.24) + wf; pen.triangle(cx + d * unit * 0.22, cyb + unit * 0.1, unit * 0.12, cx + d * unit * 0.68, cyb - up, w === 0 ? p.shade : p.body); pen.triangle(cx + d * unit * 0.22, cyb + unit * 0.08, unit * 0.07, cx + d * unit * 0.6, cyb - up + unit * 0.04, tk.hexA(p.belly, 0.95)); }
    pen.triangle(cx, gy, unit * 0.36, cx, cyb - unit * 0.1, p.accent); pen.triangle(cx, gy - blk, unit * 0.3, cx, cyb - unit * 0.06, p.body);
    pen.rect(cx - unit * 0.14, cyb - unit * 0.2, cx + unit * 0.14, cyb + unit * 0.22, p.accent); pen.rect(cx - unit * 0.1, cyb - unit * 0.18, cx + unit * 0.1, cyb + unit * 0.2, p.body);
    pen.dot(cx, cyb - unit * 0.02, tk.hexA('#ffd54a', 0.95));
    const hy = cyb - unit * 0.38; pen.ell(cx, hy, unit * 0.18 + blk, unit * 0.2 + blk, p.accent); pen.ell(cx, hy, unit * 0.18, unit * 0.2, p.body);
    tk.eyes(pen, cx, hy, unit * 0.06, unit * 0.1, p.eye, A.eyeMode, A.blink);
    const ry = hy - unit * 0.32; pen.ell(cx, ry, unit * 0.24, unit * 0.08, tk.hexA('#ffe27a', 0.95)); pen.ell(cx, ry, unit * 0.18, unit * 0.05, 'rgba(0,0,0,0)');
    if (st >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 0.6; pen.dot(cx + Math.cos(a) * unit * 0.3, ry + Math.sin(a) * unit * 0.1, tk.hexA('#ffe27a', 0.7)); }
  }
  function astralseraph(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit);
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 1.8) * unit * (0.05 + 0.04 * gf));
    pen.ell(cx, gy, unit * 0.44, unit * 0.11, 'rgba(0,0,0,0.26)');
    // 星屑翼(碎块沿翼向散布)
    const wings = 2 + (st >= 2 ? 1 : 0); const wf = snap(Math.abs(Math.sin(t * 2.5)) * unit * 0.06);
    for (let d = -1; d <= 1; d += 2) for (let w = 0; w < wings; w++) { const up = unit * (0.1 + w * 0.26) + wf; for (let s = 0; s < 3; s++) { const fr2 = 0.4 + s * 0.22; pen.triangle(cx + d * (unit * (0.3 + fr2 * 0.5)), cyb - up * fr2 + unit * 0.06, unit * (0.06 - s * 0.01), cx + d * (unit * (0.36 + fr2 * 0.5)), cyb - up * fr2 - unit * 0.06, tk.hexA(p.glow, 0.85)); } }
    pen.triangle(cx, gy, unit * 0.34, cx, cyb - unit * 0.1, p.accent); pen.triangle(cx, gy - blk, unit * 0.28, cx, cyb - unit * 0.06, p.body);
    pen.rect(cx - unit * 0.14, cyb - unit * 0.2, cx + unit * 0.14, cyb + unit * 0.22, p.accent); pen.rect(cx - unit * 0.1, cyb - unit * 0.18, cx + unit * 0.1, cyb + unit * 0.2, p.body);
    // 星座点(躯干,随成长增多)
    for (let i = 0; i < 3 + Math.round(gf * 3); i++) pen.dot(cx + Math.sin(i * 2) * unit * 0.08, cyb - unit * 0.14 + i * unit * 0.08, tk.hexA(p.glow, 0.8));
    const hy = cyb - unit * 0.38; pen.ell(cx, hy, unit * 0.18 + blk, unit * 0.2 + blk, p.accent); pen.ell(cx, hy, unit * 0.18, unit * 0.2, p.body);
    tk.eyes(pen, cx, hy, unit * 0.06, unit * 0.1, tk.hexA(p.glow, 0.95), A.eyeMode, A.blink);
    // 星环(点组成,旋转)
    const ry = hy - unit * 0.32; const rn = 8; for (let i = 0; i < rn; i++) { const a = (i / rn) * Math.PI * 2 + t * 0.8; pen.dot(cx + Math.cos(a) * unit * 0.24, ry + Math.sin(a) * unit * 0.08, tk.hexA(p.glow, 0.9)); }
    // 环绕星屑(st2/3)
    if (st >= 2) for (let i = 0; i < 4 + (st >= 3 ? 3 : 0); i++) { const a = (i / 6) * Math.PI * 2 + t; pen.dot(cx + Math.cos(a) * unit * 0.7, cyb + Math.sin(a) * unit * 0.44, tk.hexA(p.glow, 0.5 + 0.4 * Math.sin(t * 4 + i))); }
  }
  function auricseraph(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit); const gold = '#ffe27a';
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 2) * unit * 0.04);
    pen.ell(cx, gy, unit * 0.48, unit * 0.11, 'rgba(0,0,0,0.26)');
    const wings = 2 + (st >= 2 ? 1 : 0); const wf = snap(Math.abs(Math.sin(t * 2.5)) * unit * 0.05);
    for (let d = -1; d <= 1; d += 2) for (let w = 0; w < wings; w++) { const up = unit * (0.1 + w * 0.26) + wf; pen.triangle(cx + d * unit * 0.22, cyb + unit * 0.1, unit * 0.12, cx + d * unit * 0.72, cyb - up, p.shade); pen.triangle(cx + d * unit * 0.22, cyb + unit * 0.08, unit * 0.07, cx + d * unit * 0.64, cyb - up + unit * 0.04, tk.hexA(gold, 0.9)); }
    // 镀金重甲躯干(裙+胸甲+肩章)
    pen.triangle(cx, gy, unit * 0.4, cx, cyb - unit * 0.1, p.accent); pen.triangle(cx, gy - blk, unit * 0.32, cx, cyb - unit * 0.06, p.body);
    pen.rect(cx - unit * 0.18, cyb - unit * 0.22, cx + unit * 0.18, cyb + unit * 0.24, p.accent); pen.rect(cx - unit * 0.14, cyb - unit * 0.2, cx + unit * 0.14, cyb + unit * 0.22, p.body);
    pen.rect(cx - unit * 0.14, cyb - unit * 0.12, cx + unit * 0.14, cyb - unit * 0.04, tk.hexA(gold, 0.9)); // 胸甲
    [-1, 1].forEach((d) => pen.rect(cx + d * unit * 0.14, cyb - unit * 0.22, cx + d * unit * 0.26, cyb - unit * 0.12, tk.hexA(gold, 0.85))); // 肩章
    pen.dot(cx, cyb + unit * 0.04, tk.hexA(gold, 0.95));
    const hy = cyb - unit * 0.4; pen.ell(cx, hy, unit * 0.18 + blk, unit * 0.2 + blk, p.accent); pen.ell(cx, hy, unit * 0.18, unit * 0.2, p.body);
    tk.eyes(pen, cx, hy, unit * 0.06, unit * 0.1, p.eye, A.eyeMode, A.blink);
    // 双金环
    const ry = hy - unit * 0.32; pen.ell(cx, ry, unit * 0.26, unit * 0.09, tk.hexA(gold, 0.95)); pen.ell(cx, ry, unit * 0.2, unit * 0.06, 'rgba(0,0,0,0)');
    if (st >= 1) { pen.ell(cx, ry - unit * 0.07, unit * 0.17, unit * 0.06, tk.hexA(gold, 0.9)); }
    if (st >= 3) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 0.6; pen.rect(cx + Math.cos(a) * unit * 0.34 - blk * 0.4, ry + Math.sin(a) * unit * 0.12 - blk * 0.4, cx + Math.cos(a) * unit * 0.34 + blk * 0.4, ry + Math.sin(a) * unit * 0.12 + blk * 0.4, tk.hexA(gold, 0.6)); }
  }
  function throneseraph(ctx, cx, cy, unit, p, g, behavior, phase, tk) {
    const blk = Math.max(2, Math.round(unit * 0.12)); const pen = tk.makePen(ctx, cx, cy, blk);
    const snap = (v) => Math.round(v / blk) * blk; const t = phase; const f = g.feature; const gf = grow(f); const st = gstage(f); const A = anim(behavior, t, unit); const gold = '#ffe27a';
    const gy = cy + unit * GROUND; const cyb = cy + snap(Math.sin(t * 1.6) * unit * 0.04);
    pen.ell(cx, gy, unit * 0.5, unit * 0.11, 'rgba(0,0,0,0.26)');
    // 身后大日轮 + 放射光线(随成长更多更长)
    const rays = 8 + Math.round(gf * 8); const rr = unit * (0.62 + 0.16 * gf);
    for (let i = 0; i < rays; i++) { const a = (i / rays) * Math.PI * 2 + t * 0.3; pen.triangle(cx + Math.cos(a) * unit * 0.42, cyb - unit * 0.1 + Math.sin(a) * unit * 0.42, unit * 0.05, cx + Math.cos(a) * rr, cyb - unit * 0.1 + Math.sin(a) * rr, tk.hexA(gold, 0.55 + 0.25 * Math.sin(t * 3 + i))); }
    pen.ell(cx, cyb - unit * 0.1, unit * 0.42 + blk, unit * 0.42 + blk, tk.hexA(gold, 0.9)); pen.ell(cx, cyb - unit * 0.1, unit * 0.36, unit * 0.36, p.body);
    // 端坐圣座(方座)
    pen.rect(cx - unit * 0.34, gy - unit * 0.24, cx + unit * 0.34, gy, p.accent); pen.rect(cx - unit * 0.28, gy - unit * 0.2, cx + unit * 0.28, gy, p.body);
    // 端坐人形(裙+躯干)
    pen.triangle(cx, gy - unit * 0.16, unit * 0.28, cx, cyb - unit * 0.02, p.accent); pen.triangle(cx, gy - unit * 0.18, unit * 0.22, cx, cyb, p.body);
    pen.rect(cx - unit * 0.14, cyb - unit * 0.16, cx + unit * 0.14, cyb + unit * 0.18, p.accent); pen.rect(cx - unit * 0.1, cyb - unit * 0.14, cx + unit * 0.1, cyb + unit * 0.16, p.body);
    pen.rect(cx - unit * 0.12, cyb - unit * 0.08, cx + unit * 0.12, cyb - unit * 0.02, tk.hexA(gold, 0.9));
    const hy = cyb - unit * 0.32; pen.ell(cx, hy, unit * 0.17 + blk, unit * 0.19 + blk, p.accent); pen.ell(cx, hy, unit * 0.17, unit * 0.19, p.body);
    tk.eyes(pen, cx, hy, unit * 0.06, unit * 0.1, tk.hexA(gold, 0.95), A.eyeMode, A.blink);
    // 日冕尖冠(st1,随成长增高)
    if (st >= 1) for (let i = -2; i <= 2; i++) pen.triangle(cx + i * unit * 0.08, hy - unit * 0.14, unit * 0.04, cx + i * unit * 0.1, hy - unit * (0.28 + 0.12 * gf), tk.hexA(gold, 0.9));
  }

  window.PetSpecies = {
    has: has,
    pal: pal,
    foot: foot,
    look: {
      drake: drake, wyvern: wyvern, ryu: ryu,
      aquaslime: aquaslime, magmaslime: magmaslime, toxicslime: toxicslime,
      shadowcat: shadowcat, sabercat: sabercat, flamecat: flamecat, phantomcat: phantomcat,
      rhinobeetle: rhinobeetle, stagbeetle: stagbeetle, voltbeetle: voltbeetle,
      windserpent: windserpent, cobra: cobra, levinserpent: levinserpent,
      boulder: boulder, crystalgolem: crystalgolem, magmagolem: magmagolem,
      capshroom: capshroom, toxcap: toxcap, lumocap: lumocap, webcap: webcap, worldtree: worldtree,
      reefcrab: reefcrab, riptidecrab: riptidecrab, abysscrab: abysscrab, sandcrab: sandcrab, kingcrab: kingcrab,
      scarabgold: scarabgold, goliathbeetle: goliathbeetle,
      crystalslime: crystalslime, kingslime: kingslime, thundercat: thundercat,
      qilinflame: qilinflame, qilinjade: qilinjade, qilinstorm: qilinstorm,
      genbustone: genbustone, genbutide: genbutide, genbuastral: genbuastral,
      chaosvoid: chaosvoid, chaosflux: chaosflux, chaosgold: chaosgold,
      emberwisp: emberwisp, frostwisp: frostwisp, netherwisp: netherwisp,
      falconbird: falconbird, tempestbird: tempestbird, phoenixbird: phoenixbird,
      cogbot: cogbot, arcbot: arcbot, plasmabot: plasmabot,
      tidalkraken: tidalkraken, caustickraken: caustickraken, voidkraken: voidkraken, mawkraken: mawkraken,
      sacredseraph: sacredseraph, astralseraph: astralseraph, auricseraph: auricseraph, throneseraph: throneseraph,
    },
    render: {
      mushroom: mushroom, crab: crab, beetle: beetle, wisp: wisp, serpent: serpent,
      golem: golem, avian: avian, automaton: automaton, kraken: kraken, seraph: seraph,
      qilin: qilin, genbu: genbu, chaos: chaos,
    },
  };
})();
