/**
 * Overview PI —— 占位页
 * 该按键为「全局总览」:设备上显示所有宠物汇总,单击打开主页、长按重排槽位。
 * 数据源 / 宠物管理 / 会话等在 AgentPets 软件主体(标签页)内操作。
 * 本页只提供一个跳转按钮:向插件主服务询问软件 HTTP 地址(getServerInfo),
 * 点击后经上位机在系统浏览器打开软件主页。
 */
(function () {
  let serverUrl = null;

  $UD.connect();

  $UD.onConnected(() => {
    document.querySelector('.uspi-wrapper').classList.remove('hidden');
    document.querySelector('#openSettings').addEventListener('click', () => {
      if (serverUrl) {
        $UD.openUrl(serverUrl.replace(/\/$/, '') + '/', false); // 打开软件主页
      } else {
        document.querySelector('#offlineTip').classList.remove('hidden');
      }
    });
    $UD.sendToPlugin({ type: 'getServerInfo' });
    // 软件可能稍后才启动,定期重询,按钮状态随之恢复
    setInterval(() => $UD.sendToPlugin({ type: 'getServerInfo' }), 5000);
  });

  $UD.onSendToPropertyInspector((o) => {
    const p = o && o.payload;
    if (!p || p.type !== 'serverInfo') return;
    serverUrl = p.url || null;
    document.querySelector('#offlineTip').classList.toggle('hidden', !!serverUrl);
  });
})();
