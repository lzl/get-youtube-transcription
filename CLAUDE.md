# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Get Youtube Transcription (just one click) - 一个 Chrome 浏览器扩展，用于从 YouTube 视频中一键提取转录文本。扩展使用 Manifest V3 规范，采用纯原生 JavaScript 开发，无外部依赖。

## 开发命令

由于这是一个纯静态的 Chrome 扩展项目，没有构建或测试脚本：

- **安装扩展**：在 `chrome://extensions/` 开启开发者模式，点击"加载已解压的扩展程序"，选择项目根目录
- **调试扩展**：在 YouTube 视频页面打开 Chrome DevTools，查看 Console 输出
- **重新加载**：修改代码后，在 `chrome://extensions/` 页面点击扩展的刷新按钮

## 核心架构

### 主要组件

1. **YoutubeTranscriptionExtension 类** (content.js:2-714)
   - 扩展的核心类，管理整个生命周期
   - 处理按钮注入、用户交互和转录提取
   - 采用清晰的方法命名和模块化设计

2. **数据流程**
   ```
   页面加载 → 初始化扩展 → 监听页面变化 → 注入按钮 → 用户点击 → 提取转录 → 复制到剪贴板
   ```

3. **关键方法（重构后）**
   - `initializeExtension()`: 初始化扩展的主入口
   - `setupDataCapture()`: 设置 DOM 监听和数据捕获机制
   - `observePageNavigation()`: 监听页面导航变化
   - `attemptToAddButton()`: 尝试添加转录按钮
   - `handleTranscriptButtonClick()`: 处理按钮点击事件
   - `extractTranscriptFromPage()`: 从页面提取转录的主流程

### YouTube DOM 结构依赖

扩展依赖以下 YouTube 元素选择器：
- 按钮容器: `#top-level-buttons-computed`, `#actions-inner`
- 转录按钮: `button[aria-label*="转录"]`, `button[aria-label*="Transcript"]`
- 转录内容: `ytd-transcript-segment-renderer`
- 描述区域: `#expand`, `tp-yt-paper-button#expand`

### 样式适配

- 使用 YouTube CSS 变量自动适配明暗主题
- 响应式设计：移动端显示图标，桌面端显示完整按钮
- 样式文件: styles.css

## 开发注意事项

1. **DOM 依赖性**：扩展高度依赖 YouTube 的 DOM 结构，YouTube 更新可能导致功能失效，需要及时更新选择器

2. **调试技巧**：
   - 使用 `window.getTranscript()` 在控制台手动检查转录面板
   - 查看控制台输出了解详细执行流程
   - 发生错误时会输出调试信息帮助定位问题

3. **错误处理**：
   - 所有用户操作都有视觉反馈（通知或按钮状态）
   - 捕获并处理各种异常情况（无转录、网络错误等）

4. **性能考虑**：
   - 使用防抖处理频繁的 DOM 变化
   - 智能等待元素出现，避免过度轮询
   - 及时清理不需要的观察器

5. **兼容性**：
   - 支持 Chrome 88+ 及基于 Chromium 的浏览器
   - 兼容 YouTube 的各种布局变化