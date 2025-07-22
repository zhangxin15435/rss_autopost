# 🚀 GitHub Actions 自动发布配置指南

本指南将帮助您设置完整的GitHub Actions工作流，实现从CSV数据到Medium发布的全自动化流程。

## 📋 功能特性

✅ **自动生成博客**: 从CSV数据生成Jekyll博客文章  
✅ **RSS Feed生成**: 自动生成RSS/Atom feed  
✅ **GitHub Pages部署**: 自动部署到GitHub Pages  
✅ **Playwright自动发布**: 使用浏览器自动化发布到Medium  
✅ **API发布备用**: 支持Medium官方API发布  
✅ **智能重试**: 发布失败时自动重试  

## 🔧 GitHub Secrets 配置

### 必需的Secrets (Playwright方式 - 推荐)

进入您的GitHub仓库 → Settings → Secrets and variables → Actions，添加以下Secrets：

#### 1. Medium账户信息
```
MEDIUM_EMAIL          # 您的Medium邮箱
MEDIUM_PASSWORD       # 您的Medium密码  
```

#### 2. 发布方式配置 (可选)
```
MEDIUM_PUBLISH_METHOD # 'playwright' 或 'api'，默认为 'playwright'
```

### 可选的Secrets (API方式备用)

如果您选择使用Medium API方式，需要额外配置：

```
MEDIUM_INTEGRATION_TOKEN  # Medium官方Integration Token
MEDIUM_SESSION_TOKEN      # Medium Session Token (需定期更新)
MEDIUM_USER_ID            # 您的Medium用户ID
```

## 🎯 触发方式

### 1. 自动触发
- **CSV文件更新**: 当 `内容库_发布数据@zc_发布情况.csv` 文件有变化时
- **代码更新**: 当 `src/` 目录下的代码有变化时  
- **定时运行**: 每天凌晨2点自动检查并发布

### 2. 手动触发
进入 Actions → 选择 "📡 RSS到Medium自动发布" → Run workflow

#### 运行模式选项：
- **full**: 完整流程 (生成博客 + Playwright发布到Medium + 部署)
- **blog**: 仅生成博客和RSS Feed
- **medium**: 仅使用Playwright发布到Medium  
- **status**: 仅检查系统状态

#### 发布方式选项：
- **playwright**: Playwright自动化 (推荐，稳定性高)
- **api**: Medium API (需要有效的API Token)

## 🔐 获取Medium认证信息

### Playwright方式 (推荐)
只需要您的Medium登录邮箱和密码：
1. 在GitHub Secrets中设置 `MEDIUM_EMAIL` 和 `MEDIUM_PASSWORD`
2. 系统会自动处理登录和发布流程

### API方式 (备用)
1. **Integration Token**: 
   - 访问 https://medium.com/me/settings/security
   - 生成 Integration Token
   - 设置到 `MEDIUM_INTEGRATION_TOKEN`

2. **User ID**:
   - 使用项目中的 `pnpm run get-token` 获取
   - 设置到 `MEDIUM_USER_ID`

## 📊 工作流状态监控

### 查看运行状态
1. 进入仓库的 **Actions** 标签页
2. 选择最新的工作流运行
3. 查看各个步骤的执行状态和日志

### 常见状态说明
- ✅ **成功**: 所有步骤正常完成
- ⚠️ **警告**: Medium发布失败但其他步骤成功 (设置为可忽略错误)
- ❌ **失败**: 关键步骤失败，需要检查日志

### 发布报告
每次运行完成后，会自动生成包含以下信息的报告：
- 📝 生成的文章数量
- 📡 RSS文件状态  
- 🌐 站点部署状态
- 🔗 最终网站和RSS链接

## 🚨 故障排除

### Medium发布失败
1. **检查认证信息**: 确认邮箱密码正确
2. **检查RSS URL**: 确认GitHub Pages正常工作
3. **查看详细日志**: Actions中的"发布到Medium"步骤
4. **重试机制**: 系统会自动重试3次

### GitHub Pages 404错误
1. **检查仓库设置**: Settings → Pages → Source设置为"GitHub Actions"
2. **检查Jekyll配置**: 确认 `_config.yml` 配置正确
3. **检查Gemfile**: 确认Jekyll依赖完整

### 权限问题
确保仓库设置中：
- Settings → Actions → General → Workflow permissions → "Read and write permissions"
- Settings → Pages → Source → "GitHub Actions"

## 🔄 自动发布流程详解

1. **📥 代码检出**: 获取最新代码
2. **📦 依赖安装**: 安装Node.js依赖和Playwright浏览器
3. **📊 状态检查**: 验证系统配置
4. **📝 博客生成**: 从CSV生成Markdown文章和RSS feed
5. **🚀 Jekyll构建**: 构建静态网站
6. **🖥️ 环境准备**: 为Playwright设置虚拟显示器
7. **📤 Medium发布**: 使用Playwright自动发布RSS到Medium
8. **🔄 代码提交**: 提交生成的文件
9. **🌐 Pages部署**: 部署到GitHub Pages
10. **📢 结果通知**: 发送完成通知

## 📈 优化建议

### 提高成功率
1. **定期更新密码**: Medium密码变更时及时更新Secrets
2. **监控发布状态**: 定期检查Actions运行结果
3. **备用方案**: 配置API方式作为Playwright的备用

### 性能优化
1. **选择性触发**: 只在真正需要时运行完整流程
2. **缓存依赖**: pnpm缓存加速依赖安装
3. **并行执行**: 多个任务并行提高效率

## 📱 移动端监控

您可以通过GitHub手机App监控Actions运行状态：
1. 下载GitHub App
2. 登录您的账户
3. 导航到仓库 → Actions
4. 接收推送通知了解运行结果

---

## 🆘 获取帮助

如果遇到问题：
1. 查看Actions运行日志中的详细错误信息
2. 检查本文档的故障排除部分
3. 确认所有Secrets配置正确
4. 验证Medium账户状态正常

记住：首次设置可能需要调试，但一旦配置正确，整个流程将完全自动化！🎉 