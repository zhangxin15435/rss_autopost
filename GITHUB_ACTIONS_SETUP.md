# 🚀 GitHub Actions 单文章发布设置指南

## 📋 概览

此GitHub Actions工作流实现了**单文章增量发布**到Medium的自动化，每次只发布一篇未发布的文章，避免重复发布和API限制问题。

## 🔧 必需的GitHub Secrets配置

在您的GitHub仓库中设置以下Secrets（`Settings` → `Secrets and variables` → `Actions`）：

### 🎭 Playwright方式（推荐）

```bash
MEDIUM_EMAIL=your-medium-email@example.com
MEDIUM_PASSWORD=your-medium-password
```

### 📡 API方式（备用）

```bash
MEDIUM_INTEGRATION_TOKEN=your-integration-token
MEDIUM_SESSION_TOKEN=your-session-token  
MEDIUM_USER_ID=your-user-id
```

## 🚀 触发方式

### 1. 自动触发

- **CSV文件更新**: 当您更新`内容库_发布数据@zc_发布情况.csv`时自动运行
- **代码更新**: 当`src/`或`_posts/`目录有变化时触发
- **定时运行**: 每6小时自动检查一次待发布文章

### 2. 手动触发

在GitHub仓库的`Actions`标签页点击`Run workflow`，选择运行模式：

- **single** 📝 单文章发布（推荐）
- **full** 🔄 完整流程（生成博客 + 发布 + 部署）
- **blog** 📚 仅生成博客和RSS
- **status** 📊 仅检查系统状态

## 📊 工作流程详解

### 1. 环境准备
```yaml
✅ 安装Node.js 18 + pnpm
✅ 安装Playwright浏览器
✅ 设置虚拟显示器（无头模式）
```

### 2. 单文章发布流程
```yaml
🔍 检查CSV中的待发布文章
📝 生成博客文章和RSS Feed  
🚀 启动Playwright自动化
🌐 访问Medium导入页面
📤 导入单篇文章URL
👆 自动点击"See your story"（如需要）
🎯 自动点击发布按钮
📋 更新CSV状态为"已发布"
```

### 3. 部署到GitHub Pages
```yaml
🏗️ 构建Jekyll站点
🌐 部署到GitHub Pages
📡 更新RSS Feed
```

## 🔄 CSV文件格式要求

确保您的CSV文件包含以下字段：

| 字段名 | 说明 | 示例值 |
|--------|------|--------|
| 主题 | 文章标题 | "Building Developer Tools..." |
| 发布 | 发布状态 | "进入发布流程" |
| 渠道&账号 | 发布渠道 | "medium,hashnode,DEV community" |
| 发布完成 | 完成状态 | "否" → "已发布" |
| 提出人 | 作者 | "张三" |
| 标签 | 文章标签 | "技术,AI,工具" |

## 📈 发布策略

### ✅ 智能跳过机制
- 自动跳过`发布完成`为"已发布"的文章
- 只处理`发布`为"进入发布流程"的文章
- 只发布`渠道&账号`包含"medium"的文章

### 🎯 单文章模式优势
- **避免重复发布**: 每次只发布一篇文章
- **降低API风险**: 减少Medium的频率限制
- **精确状态追踪**: 实时更新CSV发布状态
- **错误隔离**: 单篇失败不影响其他文章

## 🔍 监控和调试

### 查看发布报告
每次运行后在`Actions`页面查看详细报告：
- 📤 Medium发布状态
- 📊 站点构建状态  
- 🔗 网站和RSS链接
- ✅ 发布详情（如成功）

### 常见问题排查

#### 1. 发布失败
- 检查Medium登录凭据
- 确认网络连接
- 查看Playwright错误日志

#### 2. 无待发布文章
- 检查CSV文件格式
- 确认文章标记为"进入发布流程"
- 验证渠道包含"medium"

#### 3. GitHub Pages部署失败
- 检查Jekyll语法
- 确认`_config.yml`配置
- 查看构建日志

## 🎛️ 高级配置

### 自定义超时时间
```yaml
env:
  MEDIUM_TIMEOUT: '90000'  # 90秒
```

### 重试次数配置
```yaml
env:
  MEDIUM_RETRIES: '3'      # 重试3次
```

### 测试模式
```yaml
env:
  ALLOW_REPUBLISH: 'true'  # 允许重新发布（测试用）
```

## 🔗 相关链接

- 🌐 **网站**: https://{{github.repository_owner}}.github.io/{{repository_name}}
- 📡 **RSS**: https://{{github.repository_owner}}.github.io/{{repository_name}}/feed.xml
- 📖 **使用文档**: [QUICKSTART.md](./QUICKSTART.md)
- 🎭 **Playwright文档**: [PLAYWRIGHT_MEDIUM_SETUP.md](./PLAYWRIGHT_MEDIUM_SETUP.md)

---

🎉 **享受自动化的Medium发布体验！** 每当您在CSV中标记新文章为"进入发布流程"，系统就会自动为您发布到Medium并更新状态。 