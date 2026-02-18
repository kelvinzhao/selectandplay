# Select & Play

选中网页文本即可听到AI语音朗读，自动检测中英日文语言。

## 版本

- **版本号**: 2.0.0
- **重构日期**: 2025年2月

## 新版特性

### 🎨 全新UI设计
- 选中文本后显示优雅的浮窗面板
- 实时显示检测到的语言
- 播放状态可视化（音频波形动画）
- 加载状态提示
- 友好的错误信息展示

### ✨ 核心功能
- **智能语言检测**：自动识别中文、英文、日文
- **浮窗播放控制**：播放、暂停、停止
- **Azure TTS集成**：使用微软高质量语音合成
- **多语言支持**：为每种语言单独配置语音和语速
- **文本预览**：浮窗显示选中的文本内容

### 🔧 改进体验
- 一键切换启用/禁用状态
- 拖拽式popup快捷设置
- 完善的配置页面
- 连接测试功能
- Toast通知反馈

## 安装方法

### 1. 准备图标文件

在 `icons/` 目录下放置以下图标文件：

```
icons/
├── icon16.png           # 16x16 启用状态
├── icon16-disabled.png  # 16x16 禁用状态
├── icon48.png           # 48x48 启用状态
├── icon48-disabled.png  # 48x48 禁用状态
├── icon128.png          # 128x128 启用状态
└── icon128-disabled.png # 128x128 禁用状态
```

可以从原项目复制图标，或自行设计。

### 2. 加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目目录

## 使用说明

### 首次配置

1. 点击扩展图标，选择"打开设置"
2. 在"Azure TTS 服务配置"中填写：
   - **区域**：选择你的服务区域（如 eastasia）
   - **API 密钥**：输入你的 Azure 语音服务密钥
3. 点击"测试连接"确认配置正确
4. 在"语音设置"中为每种语言选择语音和语速

### 日常使用

1. 在任意网页选中要朗读的文本
2. 点击出现的浮窗中的"播放"按钮
3. 使用"暂停"/"停止"按钮控制播放

### 获取 Azure 密钥

1. 访问 [Azure 语音服务](https://azure.microsoft.com/zh-cn/services/cognitive-services/text-to-speech/)
2. 创建免费账户（每月5小时免费额度）
3. 创建"语音服务"资源
4. 在"密钥和终结点"页面获取密钥和区域

## 文件结构

```
select-and-play/
├── manifest.json       # 扩展配置文件
├── background.js       # 后台服务脚本
├── content.js          # 内容脚本（核心功能）
├── content.css         # 浮窗UI样式
├── popup.html          # 弹出页面
├── options.html        # 设置页面
├── options.js          # 设置页面脚本
├── options.css         # 设置页面样式
├── icons/              # 图标资源
└── README.md           # 说明文档
```

## 技术栈

- **Manifest V3**：最新的Chrome扩展标准
- **Vanilla JS**：无依赖的纯JavaScript实现
- **CSS Variables**：主题化和样式复用
- **Azure TTS API**：微软语音合成服务

## 更新日志

### v2.0.0 (2025-02)
- 重构UI，增加浮窗播放控制
- 添加可视化状态反馈
- 优化用户体验
- 重新设计设置页面

### v1.0 (原版)
- 基础TTS功能
- 语言检测
- Azure集成

## 许可证

MIT License

## 致谢

本项目重构自原版 [chrome-tts-extension](https://github.com/selectandplay/chrome-tts-extension)
