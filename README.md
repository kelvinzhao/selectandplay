# Select & Play

> 选中即听，智能语音朗读 Chrome 扩展

选中网页上的文字，通过 Azure TTS 进行语音朗读。自动识别中、英、日三种语言。

## 功能特性

- **两种交互模式** - 简洁版自动播放，标准版手动控制
- **选中即读** - 选中任意文字，立即开始朗读
- **智能语言检测** - 自动识别中文、英文、日文
- **多语音支持** - 使用 Azure Neural TTS 高质量语音
- **播放控制** - 支持播放、暂停、继续、停止
- **语速调节** - 可自定义不同语言的朗读语速（0.5x - 2.0x）
- **状态可视化** - 清晰的加载和播放状态动画

## 安装

### 从源码安装

1. 克隆仓库
   ```bash
   git clone https://github.com/kelvinzhao/selectandplay.git
   ```

2. 打开 Chrome 扩展管理页面 (`chrome://extensions/`)

3. 开启「开发者模式」

4. 点击「加载已解压的扩展程序」，选择项目目录

## 配置

### 获取 Azure TTS 密钥

1. 访问 [Azure Portal](https://portal.azure.com/)
2. 创建「语音服务」资源
3. 获取**密钥**和**区域**

### 配置扩展

1. 点击扩展图标 →「打开设置」
2. 选择**交互模式**：
   - **简洁版**：选中文字自动播放，仅显示暂停/继续按钮，点击空白处关闭
   - **标准版**：选中文字弹出面板，显示文本预览，可手动控制播放/暂停/停止
3. 填写 Azure 配置：
   - **区域**：如 `eastasia`、`westus`
   - **密钥**：你的订阅密钥
4. 点击「测试连接」验证
5. 点击「保存」

### 语音设置

切换到「语音设置」选项卡，为不同语言配置：
- **语音**：选择 Neural Voice
- **语速**：0.5x - 2.0x（精度 0.1x）

## 使用方法

### 简洁版模式

1. 在网页上选中要朗读的文字
2. 自动开始播放，弹出简洁控制条
3. 可点击暂停/继续按钮控制播放
4. 点击空白处或关闭按钮退出

### 标准版模式

1. 在网页上选中要朗读的文字
2. 弹出朗读面板，显示文本预览
3. 点击「播放」按钮开始朗读
4. 播放中可暂停/继续或停止

## 默认语音

| 语言 | 默认语音 |
|------|----------|
| 中文 | `zh-CN-XiaoxiaoNeural` |
| 英文 | `en-US-JennyNeural` |
| 日文 | `ja-JP-NanamiNeural` |

## 常用区域

- `eastasia` - 东亚（香港）
- `southeastasia` - 东南亚（新加坡）
- `westus` - 美国西部
- `eastus` - 美国东部
- `westeurope` - 西欧

[完整区域列表](https://docs.microsoft.com/azure/cognitive-services/speech-service/regions)

## 文件结构

```
select-and-play/
├── manifest.json       # 扩展配置
├── content.js          # 内容脚本（核心）
├── content.css         # 浮窗样式
├── background.js       # 后台脚本
├── popup.html/js       # 弹出窗口
├── options.html/js/css # 设置页面
└── icons/              # 图标资源
```

## 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **Vanilla JS** - 无依赖纯 JavaScript
- **Azure TTS API** - 微软语音合成

## 更新日志

### v2.0.0 (2025-02)
- 新增两种交互模式：简洁版（自动播放）和标准版（手动控制）
- 重构代码，简化架构
- 新增浮窗播放控制
- 可视化状态反馈
- 优化用户体验
- 添加 Buy Me A Coffee 支持按钮

## 许可

MIT License

## 致谢

- [Microsoft Azure Speech Services](https://azure.microsoft.com/services/cognitive-services/speech-services/)
