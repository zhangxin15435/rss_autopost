# 🧪 GitHub Actions 测试指南

## 快速测试步骤

### 1. 配置GitHub Secrets
前往仓库 Settings → Secrets and variables → Actions，添加：

```
MEDIUM_EMAIL=你的Medium邮箱
MEDIUM_PASSWORD=你的Medium密码
```

### 2. 手动触发测试
1. 进入仓库的 **Actions** 标签页
2. 选择 "📡 RSS到Medium自动发布" 工作流
3. 点击 **Run workflow** 按钮
4. 选择参数：
   - **运行模式**: `status` (仅检查状态，不执行发布)
   - **发布方式**: `playwright`
5. 点击 **Run workflow** 执行

### 3. 检查运行结果
查看Actions运行日志，关注以下步骤：
- ✅ **验证环境配置**: 确认所有Secrets正确读取
- ✅ **检查系统状态**: 确认Medium发布配置有效
- ✅ **Playwright浏览器安装**: 确认浏览器依赖正常

### 4. 完整流程测试
确认状态检查无误后，可以运行完整流程：
- **运行模式**: `full`
- **发布方式**: `playwright`

## 🔍 故障排除

### 常见问题
1. **环境验证失败**: 检查Secrets是否正确设置
2. **Playwright安装失败**: 通常是网络问题，重试即可
3. **Medium登录失败**: 检查邮箱密码是否正确
4. **RSS URL 404**: 等待GitHub Pages部署完成

### 调试技巧
1. 先用 `status` 模式测试配置
2. 再用 `blog` 模式测试博客生成
3. 最后用 `medium` 模式测试发布
4. 完成调试后使用 `full` 模式

## 📊 成功标志
- 环境验证: 所有必需配置显示 ✅
- 系统状态: Medium发布显示 "✅ 可用"
- 完整流程: 所有步骤成功，网站正常访问

---

**提示**: 首次设置建议逐步测试，确保每个环节都正常工作后再启用自动触发。 