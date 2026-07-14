# Agent Pets

在 UlanziStudio 按键上养一只随 Agent token 用量成长的桌面宠物。挑一只宠物(史莱姆 / 喵仔 / 小龙),它会随累计用量(Demo 模式下按运行时长估算,约 0.2M tokens/小时)历经 15 个阶段孵化、成长。按键实时显示 Agent 类型、session、本轮时长与状态(工作 / 休息 / 完成);短按暂停/恢复,长按 3 秒重置。

## 结构

- `plugin/` —— 主服务(单例)与渲染逻辑
  - `app.html` / `app.js` —— 主服务、按键事件、持久化
  - `actions/coordinator.js` —— 全局宠物池协调器
  - `actions/Pet.js` —— 按键渲染视图(布局 / 地面基线 / Agent 图标)
  - `actions/backgrounds.js` —— 背景主题(前景/背景层、地平线规范)
  - `actions/petArt.js` —— 像素风宠物美术与着地点
  - `actions/stages.js` / `actions/demo.js` —— 成长模型与 Demo 数据
- `property-inspector/` —— 配置面板(槽位 / 背景选择)
- `manifest.json` —— 插件清单

## 设计规约

渲染、布局与背景的设计规约(文字安全区、地面基线、地平线、背景层、Agent 图标、成长/协调器等)统一记录在:

**[docs/DESIGN.md](docs/DESIGN.md)** — 新增背景 / 宠物 / 布局前请先阅读。

## 发布

见 [PUBLISHING.md](PUBLISHING.md)。
