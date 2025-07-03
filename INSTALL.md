# 安装指南

## 快速安装

### 步骤 1: 准备图标文件（可选）

扩展已经包含了一个 SVG 图标模板。如果你想要 PNG 图标，可以：

1. 使用在线工具将 `icon.svg` 转换为 PNG 格式
2. 创建 16x16、48x48、128x128 三个尺寸的 PNG 文件
3. 分别命名为 `icon16.png`、`icon48.png`、`icon128.png`

**注意：** 图标文件不是必需的，扩展可以在没有图标的情况下正常工作。

### 步骤 2: 安装扩展

1. **打开 Chrome 扩展管理页面**
   - 在地址栏输入：`chrome://extensions/`
   - 或者：菜单 → 更多工具 → 扩展程序

2. **启用开发者模式**
   - 点击右上角的"开发者模式"开关

3. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择包含扩展文件的文件夹（包含 `manifest.json` 的文件夹）

4. **验证安装**
   - 扩展应该出现在扩展列表中
   - 状态显示为"已启用"

### 步骤 3: 测试功能

1. 打开 YouTube 并播放任意视频
2. 在视频下方的操作按钮区域寻找"获取转录"按钮
3. 点击按钮测试功能

## 创建图标文件

如果你想要自定义图标，可以使用以下方法：

### 方法 1: 在线转换工具

1. 访问 [Convertio](https://convertio.co/svg-png/) 或类似网站
2. 上传 `icon.svg` 文件
3. 分别生成 16x16、48x48、128x128 的 PNG 文件
4. 将文件放在扩展根目录下

### 方法 2: 使用命令行工具

如果你安装了 ImageMagick：

```bash
# 转换为不同尺寸的 PNG
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### 方法 3: 移除图标引用

如果你不想使用图标，可以编辑 `manifest.json`，删除 `icons` 部分：

```json
{
  "manifest_version": 3,
  "name": "YouTube Transcription Extractor",
  "version": "1.0",
  "description": "Extract YouTube video transcriptions with one click",
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_end"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["styles.css"],
      "matches": ["https://www.youtube.com/*"]
    }
  ]
}
```

## 故障排除

### 扩展无法加载

**问题**: 点击"加载已解压的扩展程序"后出现错误

**解决方案**:
1. 确保选择了包含 `manifest.json` 的文件夹
2. 检查 `manifest.json` 语法是否正确
3. 确保所有引用的文件都存在

### 按钮不显示

**问题**: 在 YouTube 页面上看不到"获取转录"按钮

**解决方案**:
1. 刷新 YouTube 页面
2. 确保是在视频页面（URL 包含 `/watch?v=`）
3. 等待页面完全加载
4. 检查浏览器控制台是否有错误信息

### 无法获取转录

**问题**: 点击按钮后显示"未找到转录文本"

**解决方案**:
1. 确认视频确实有转录功能
2. 尝试手动点击 YouTube 的转录按钮验证
3. 检查网络连接
4. 尝试其他有转录的视频

### 权限问题

**问题**: 扩展提示权限不足

**解决方案**:
1. 在 `chrome://extensions/` 中找到扩展
2. 点击"详细信息"
3. 确保"在网站上"权限已启用

## 更新扩展

当扩展有更新时：

1. 下载新的扩展文件
2. 替换原有文件
3. 在 `chrome://extensions/` 中点击扩展的刷新按钮

## 卸载扩展

1. 打开 `chrome://extensions/`
2. 找到 "YouTube Transcription Extractor"
3. 点击"移除"按钮

## 技术支持

如果遇到问题，可以：

1. 检查浏览器控制台的错误信息
2. 尝试重新加载扩展
3. 重启浏览器
4. 提交 GitHub Issue（如果有的话）

## 浏览器兼容性

- ✅ Chrome 88+
- ✅ Microsoft Edge 88+
- ✅ Opera 74+
- ✅ Brave 浏览器
- ❌ Firefox (使用不同的扩展系统)
- ❌ Safari (使用不同的扩展系统) 