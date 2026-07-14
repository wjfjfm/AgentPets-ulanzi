# Ulanzi Studio 插件发布备忘

> 发布平台：ugc.ulanzistudio.com → Upload works
> 注意：本文件是开发备忘，打包上传前请勿把它压进插件包。

## 一、发布前准备 3 类资源

| 资源 | 是否必需 | 要求 |
|---|---|---|
| 主插件文件 | 必需 | 压缩包，单文件最大 50MB |
| Cover image 封面图 | 必需 | 比例 **2:1**，用于 Marketplace 封面 |
| Banner 01 | 必需 | 比例 **3:2**，用于详情页轮播/推荐位 |
| Banner 02 / 03 | 可选 | 比例 3:2，建议补充配置界面、设备场景、核心功能状态 |

流程：拖拽主插件文件 → Ulanzi Studio 解析包内 `manifest.json` → 解析成功后再传封面/Banner，并填名称、概要、详细介绍。

## 二、插件包结构建议

```
com.ulanzi.{插件名}.ulanziPlugin/
├── manifest.json
├── plugin/
│   ├── app.html 或 app.js
│   └── actions/
├── property-inspector/
│   └── action/inspector.html
├── assets/
│   ├── icons/
│   ├── actions/
│   └── banners/
├── en.json
└── zh_CN.json
```

- 文件夹命名：`com.ulanzi.{插件名}.ulanziPlugin`
- 主服务 UUID：**4 段**，如 `com.ulanzi.ulanzistudio.example`
- Action UUID：以主 UUID 为前缀，且 **多于 4 段**，如 `com.ulanzi.ulanzistudio.example.toggle`

## 三、manifest.json 顶层字段

| 字段 | 必需 | 说明 |
|---|---|---|
| Author | 必需 | 开发者/组织名 |
| Name | 必需 | 插件名称 |
| Overview | 推荐(新增) | 一句话概要，用于市场列表/卡片 |
| Description | 必需 | 详细描述(功能、配置、注意事项) |
| Icon | 必需 | 插件图标路径(相对根目录) |
| Version | 必需 | 版本号，如 1.0.0 |
| Category | 推荐 | 分类名称 |
| CategoryIcon | 推荐 | 分类图标路径 |
| Banner | 推荐(新增) | Banner 路径数组，第一张为主 Banner |
| UUID | 必需 | 主服务 UUID，建议 4 段 |
| Type | 必需 | 固定 `JavaScript` |
| CodePath | 必需 | 主入口，`.html` 或 `.js` |
| Actions | 必需 | 功能列表 |
| OS | 推荐 | 支持平台及最低系统版本 |
| Software.MinVersion | 推荐 | 最低 Ulanzi Studio 版本；**用新字段 `MinVersion`，勿用旧的 `MinimumVersion`** |
| ApplicationsToMonitor | 可选 | 监听启动/退出的外部应用 |
| Inspect | 可选 | Node 远程调试参数，如 `--inspect=127.0.0.1:9201` |
| PrivateAPI | 可选 | 确实用到私有接口才配置 |
| Profiles | 可选 | 随插件安装的预设配置 |
| InstallToDepsApp | 可选 | 安装到第三方应用的脚本配置 |

新增发布字段示例：

```json
{
  "Overview": "Control OBS recording, scenes, and streaming from your Ulanzi device.",
  "Banner": [
    "assets/banners/banner-1.png",
    "assets/banners/banner-2.png",
    "assets/banners/banner-3.png"
  ]
}
```

## 四、Action 字段

| 字段 | 必需 | 说明 |
|---|---|---|
| Name | 必需 | 功能名称 |
| Icon | 必需 | Action 图标路径 |
| UUID | 必需 | 以主 UUID 为前缀 |
| PropertyInspectorPath | 可选 | 配置界面 HTML 路径 |
| state | 可选 | 默认状态索引 |
| States | 必需 | 状态列表，每项含 Name 和 Image |
| Tooltip | 推荐 | 功能提示 |
| SupportedInMultiActions | 可选 | 是否支持多项操作 |
| DisableAutomaticStates | 可选 | true = 由插件自己控制状态切换 |
| Controllers | 推荐 | Keypad / Encoder，未设按 Keypad |
| Encoder | Encoder 必需 | 旋钮布局，如 `{ "layout": "$UA1" }` |
| Devices | 可选 | 型号如 D200/D200H/Dial/D200X；`~Dial` 表示排除 |

## 五、图标与封面格式

**插件内 Icon**(Icon / CategoryIcon / Action Icon / States[].Image，均相对根目录路径)
- 尺寸：**196 × 196 px**
- 格式：优先 **PNG**(协议支持 svg/png/jpg，发布建议统一 PNG)
- 内容：居中、高对比、少文字

**Cover image**：比例 **2:1**，PNG/JPG，关键信息勿贴边(可能被裁)。

**Banner**：比例 **3:2**，至少 1 张、最多 3 张。
- Banner 01：图标 + 名称 + 一句核心价值
- Banner 02/03：真实设备使用、配置界面、功能状态、典型工作流
- 包内 Banner 放 `assets/banners/`，与上传素材风格一致。

## 六、上传发布流程

1. 打包插件文件夹(含 manifest.json、入口、图标、配置页、语言文件)。
2. 打开 ugc.ulanzistudio.com → Upload works。
3. Main work file 区域上传压缩包。
4. 等自动解析，核对名称/版本/入口/Action。
5. 上传 2:1 Cover image。
6. 上传 ≥1 张 3:2 Banner(建议 2-3 张)。
7. 填名称、概要、详细介绍；多语言同步填写并在包内放语言 JSON。
8. 右侧 Auto check 全通过后上传。

## 七、发布前检查清单

- [ ] manifest.json 是合法 JSON(无注释、无多余逗号)
- [ ] CodePath 指向真实存在的 .html / .js
- [ ] 主 UUID 4 段；Action UUID 继承前缀且多于 4 段
- [ ] Overview 已填一句话概要
- [ ] Banner 路径数组存在且图片文件真实存在
- [ ] Software.MinVersion 用新字段(非 MinimumVersion)
- [ ] 所有 Icon / Action Icon / State Image 路径在包内可找到
- [ ] 插件内图标建议 196 × 196 PNG
- [ ] Cover image 为 2:1
- [ ] Banner 为 3:2，至少 Banner 01
- [ ] Node 插件若用 dist/，上传前已重新构建
- [ ] Property Inspector 页面背景设为透明

> 终检：用上传页的自动解析做一次真实校验，主文件解析成功 + 封面/Banner 比例正确，后续填写会顺畅很多。
