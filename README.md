# Get Youtube Transcription (just one click)

一个简单实用的 Chrome 扩展，只需一次点击即可获取 YouTube 视频的转录文本。

## 功能特点

- ✅ 一键获取 YouTube 视频转录
- ✅ 优先获取原始语言转录（而非自动翻译）
- ✅ 自动复制转录内容到剪贴板
- ✅ 按钮样式与 YouTube 界面和谐融合
- ✅ 支持明暗主题
- ✅ 响应式设计，适配移动端
- ✅ 智能错误处理

## 安装方法

### 快速安装（3 步完成）

1. **打开扩展管理页面**
   - 在 Chrome 地址栏输入：`chrome://extensions/`
   - 或通过菜单：更多工具 → 扩展程序

2. **启用开发者模式**
   - 打开页面右上角的"开发者模式"开关

3. **加载扩展**
   - 点击"加载已解压的扩展程序"按钮
   - 选择本项目文件夹（包含 `manifest.json` 的目录）
   - 扩展会立即安装并自动启用

### 安装验证

安装成功后，你会看到：
- 扩展出现在扩展列表中，显示为"已启用"状态
- 打开 YouTube 视频页面，在视频下方操作按钮区会出现"Transcript"按钮

### 关于图标（可选）

扩展包含一个 SVG 图标模板。如需 PNG 格式图标：
1. 使用在线工具（如 [Convertio](https://convertio.co/svg-png/)）转换 `icon.svg`
2. 生成 16x16、48x48、128x128 三种尺寸
3. 分别命名为 `icon16.png`、`icon48.png`、`icon128.png`

**注意：** 扩展可以在没有图标的情况下正常工作

## 使用方法

1. 打开任意 YouTube 视频页面
2. 在视频下方的操作按钮区域找到"Transcript"按钮
3. 点击按钮，扩展会自动获取转录并复制到剪贴板
4. 粘贴到任何需要的地方使用

## 功能说明

### 转录获取策略

扩展使用多种方法获取转录：

1. **页面方法**：通过模拟点击转录按钮获取转录内容
2. **智能检测**：自动检测并展开视频描述区域查找转录按钮

### 语言优先级

- 优先获取视频的原始语言转录
- 如果是英文视频，获取英文转录
- 如果是中文视频，获取中文转录
- 避免获取自动翻译的版本

### 错误处理

- 如果视频没有转录，会显示友好的提示信息
- 如果获取失败，会显示错误提示
- 所有操作都有适当的用户反馈

## 技术特点

- 使用 Manifest V3 规范
- 纯 JavaScript 实现，无外部依赖
- 响应式设计，适配各种屏幕尺寸
- 兼容 YouTube 的明暗主题
- 智能检测页面变化，支持 SPA 导航

## 文件结构

```
├── manifest.json         # 扩展配置文件
├── content.js            # 主要功能脚本
├── styles.css            # 样式文件
└── README.md             # 说明文档
```

## 兼容性

- ✅ Chrome 88+
- ✅ Microsoft Edge 88+
- ✅ Opera 74+
- ✅ Brave 浏览器
- ✅ 其他基于 Chromium 的浏览器
- ❌ Firefox (使用不同的扩展系统)
- ❌ Safari (使用不同的扩展系统)

## 更新与卸载

### 更新扩展
当有新版本时：
1. 下载最新的扩展文件
2. 替换本地文件夹中的旧文件
3. 在 `chrome://extensions/` 页面点击扩展的刷新按钮

### 卸载扩展
1. 打开 `chrome://extensions/`
2. 找到 "Get Youtube Transcription"
3. 点击"移除"按钮
4. 确认移除即可

## 开发说明

### 执行流程图

```mermaid
graph TD
    A[页面加载] --> B[创建 YoutubeTranscriptionExtension 实例]
    B --> C[constructor 构造函数]
    C --> D[initializeExtension 初始化扩展]
    
    D --> D1[setupDataCapture 设置数据捕获]
    D --> D2[setupGlobalDebugTool 设置全局调试工具]
    D --> D3[observePageNavigation 监听页面导航]
    D --> D4[startObservingButtonContainer 开始观察按钮容器]
    
    D3 --> F[监听 URL 变化]
    D3 --> G[监听浏览器历史变化]
    D3 --> H[监听 YouTube 事件]
    
    F --> I[页面导航检测]
    G --> I
    H --> I
    I --> J[cleanupPreviousButton 清理之前的按钮]
    J --> D4
    
    D4 --> K{是否为视频页面?}
    K -->|否| L[结束]
    K -->|是| M[attemptToAddButton 尝试添加按钮]
    
    M --> N{按钮是否已存在?}
    N -->|是| O[结束]
    N -->|否| P[findSuitableButtonContainer 查找合适的按钮容器]
    
    P --> Q{找到有效容器?}
    Q -->|否| R[等待容器出现]
    R --> P
    Q -->|是| S[createAndInsertButton 创建并插入按钮]
    
    S --> T[创建按钮元素]
    T --> U[添加点击事件监听]
    U --> V[插入到容器]
    V --> W[monitorButtonRemoval 监听按钮移除]
    
    U --> X[用户点击按钮]
    X --> Y[handleTranscriptButtonClick 处理转录按钮点击]
    Y --> Z[updateButtonState 更新按钮状态为 loading]
    Z --> AA[extractTranscript 提取转录]
    
    AA --> BB[extractTranscriptFromPage 从页面提取转录]
    BB --> CC[expandVideoDescription 展开视频描述]
    CC --> DD[findTranscriptButton 查找转录按钮]
    
    DD --> EE{找到转录按钮?}
    EE -->|否| FF[显示错误通知]
    EE -->|是| GG[点击转录按钮]
    
    GG --> HH[等待转录面板加载]
    HH --> II[extractTranscriptContent 提取转录内容]
    
    II --> JJ[查找转录段落元素]
    JJ --> KK[提取并清理文本]
    KK --> LL[合并转录段落]
    
    LL --> MM{转录获取成功?}
    MM -->|是| NN[copyTextToClipboard 复制文本到剪贴板]
    MM -->|否| OO[showDebugInformation 显示调试信息]
    
    NN --> PP[showUserNotification 显示用户通知]
    OO --> QQ[showUserNotification 显示错误通知]
    
    PP --> RR[updateButtonState 恢复按钮状态]
    QQ --> RR
    FF --> RR
    
    RR --> SS[流程结束]
    
    classDef initClass fill:#e1f5fe
    classDef processClass fill:#f3e5f5
    classDef uiClass fill:#e8f5e8
    classDef errorClass fill:#ffebee
    
    class A,B,C,D,E initClass
    class Y,Z,AA,BB,CC,DD,GG,HH,II,JJ,KK,LL processClass
    class M,N,P,Q,S,T,U,V,W,X uiClass
    class FF,OO,QQ errorClass
```

### 主要组件

1. **YoutubeTranscriptionExtension 类**
   - 处理按钮注入和转录获取
   - 监听页面导航变化
   - 管理用户界面交互

2. **核心方法说明**
   - `setupDataCapture()`: 设置数据捕获机制，监听 DOM 变化和脚本注入
   - `observePageNavigation()`: 监听页面导航变化，支持 SPA 单页应用
   - `startObservingButtonContainer()`: 智能检测按钮容器出现时机
   - `attemptToAddButton()`: 尝试添加转录按钮到合适位置
   - `handleTranscriptButtonClick()`: 处理转录按钮点击事件
   - `extractTranscriptFromPage()`: 从页面提取转录的主要流程
   - `extractTranscriptContent()`: 从转录面板提取具体内容

3. **用户界面**
   - 自适应按钮设计
   - 通知系统
   - 错误处理和调试信息

### 关键技术实现

#### 页面变化监听
- 使用 MutationObserver 监听 DOM 变化
- 监听 `popstate` 事件和 YouTube 自定义事件
- 支持单页应用的路由变化

#### 按钮智能插入
- 多种容器查找策略
- 按钮有效性验证
- 自动重新插入机制

#### 转录提取策略
- 优先尝试页面方法（模拟点击）
- 多种转录内容选择器
- 智能文本清理和时间戳处理

#### 错误处理
- 详细的调试信息输出
- 用户友好的错误提示
- 全局调试方法支持

### 自定义样式

扩展使用 CSS 变量来适配 YouTube 的主题系统：

```css
background: var(--yt-spec-button-chip-background-hover, #f1f1f1);
color: var(--yt-spec-text-primary, #0f0f0f);
```

## 注意事项

1. 确保视频有转录功能可用
2. 某些受版权保护的视频可能无法获取转录
3. 扩展仅在 YouTube 视频页面工作
4. 需要网络连接来获取转录数据

## 故障排除

### 常见问题及解决方案

#### 扩展无法加载
**症状：** 点击"加载已解压的扩展程序"后出现错误

**解决方案：**
- 确保选择的是包含 `manifest.json` 的文件夹（不是文件）
- 检查 `manifest.json` 文件语法是否正确
- 确认所有必需文件（content.js、styles.css）都存在

#### 按钮不显示
**症状：** YouTube 页面上看不到"Transcript"按钮

**解决方案：**
1. 刷新 YouTube 页面（F5 或 Ctrl+R）
2. 确认当前是视频页面（URL 应包含 `/watch?v=`）
3. 等待页面完全加载（特别是视频下方的操作按钮区）
4. 打开浏览器控制台（F12）查看是否有错误信息

#### 无法获取转录
**症状：** 点击按钮后显示"未找到转录文本"

**解决方案：**
1. 确认视频确实提供转录功能（手动点击 YouTube 的转录按钮验证）
2. 某些直播、私密或受限视频可能没有转录
3. 检查网络连接是否正常
4. 尝试其他确定有转录的视频测试

#### 权限问题
**症状：** 扩展提示权限不足或无法访问页面

**解决方案：**
1. 在 `chrome://extensions/` 找到本扩展
2. 点击"详细信息"
3. 确保"在特定网站上"权限已启用 YouTube
4. 如仍有问题，尝试移除并重新安装扩展

### 调试技巧

1. **控制台调试**
   - 按 F12 打开开发者工具
   - 在控制台运行 `window.getTranscript()` 手动测试转录获取
   - 查看控制台输出了解执行流程和错误信息

2. **扩展重载**
   - 修改代码后，在 `chrome://extensions/` 点击扩展的刷新图标
   - 或使用 Ctrl+R 重新加载扩展

3. **清理缓存**
   - 如遇样式问题，清除浏览器缓存
   - 重启浏览器可解决大部分临时问题

## 更新日志

### v1.0
- 初始版本发布
- 基本转录获取功能
- 响应式设计
- 主题支持

## 许可证

MIT License

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。