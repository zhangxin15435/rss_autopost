# 🚀 快速开始指南

## 1️⃣ 安装依赖并配置

```bash
# 1. 安装Node.js依赖
npm install

# 2. 安装Playwright浏览器
npx playwright install chromium

# 3. 生成配置文件模板
npm start config

# 4. 配置环境变量（复制并编辑）
cp .env.example .env
```

## 2️⃣ 编辑配置文件

### 编辑 `.env` 文件：

```env
# 博客配置 - 替换为您的GitHub Pages URL
SITE_URL=https://你的用户名.github.io/项目名
RSS_URL=https://你的用户名.github.io/项目名/feed.xml
BLOG_TITLE=我的技术博客
BLOG_AUTHOR=Your Name

# Medium登录信息（可选 - 如果要自动发布到Medium）
MEDIUM_EMAIL=your_email@example.com
MEDIUM_PASSWORD=your_password
```

## 3️⃣ 测试运行

```bash
# 检查系统状态
npm start status

# 仅生成博客和RSS（推荐先测试这个）
npm start blog

# 查看生成的文件
Get-ChildItem _posts    # Windows PowerShell
ls _posts               # macOS/Linux
```

## 4️⃣ 查看结果

运行成功后，您会看到：

- `_posts/` 目录下生成的Markdown文章文件
- `feed.xml` RSS订阅源
- `atom.xml` Atom订阅源
- `_config.yml` Jekyll配置文件
- `index.md` 网站首页

## 5️⃣ 部署到GitHub Pages

### 配置仓库：

1. **推送代码到GitHub**
   ```bash
   git add .
   git commit -m "初始化RSS到Medium发布系统"
   git push origin main
   ```

2. **启用GitHub Pages**
   - 进入GitHub仓库设置
   - Settings → Pages
   - 选择 "GitHub Actions" 作为源

3. **配置Secrets（可选）**
   - Settings → Secrets and variables → Actions
   - 添加 `MEDIUM_EMAIL` 和 `MEDIUM_PASSWORD`

### 自动触发：

✅ 每次推送CSV文件更新会自动运行  
✅ 每天凌晨2点自动检查更新  
✅ 可以手动触发Actions

## 📊 查看运行状态

访问您的网站：`https://你的用户名.github.io/项目名`

查看RSS：`https://你的用户名.github.io/项目名/feed.xml`

## 🔧 常见命令

```bash
# 完整发布流程（包括Medium）
npm start full

# 仅生成博客和RSS
npm start blog

# 仅发布到Medium
npm start medium

# 检查系统状态
npm start status

# 显示帮助
npm start help
```

## 🎯 下一步

1. **自定义博客外观**：编辑 `_config.yml` 和 Jekyll主题
2. **添加更多功能**：修改 `src/` 目录下的代码
3. **监控RSS订阅**：使用工具如 [Blogtrottr](https://blogtrottr.com) 将RSS转为邮件通知

## 📋 CSV数据格式提醒

确保您的CSV文件包含以下必要列：

- `主题` - 文章标题
- `发布内容` - 文章内容  
- `发布` - 必须包含 "进入发布流程"
- `渠道&账号` - 必须包含 "medium"
- `发布完成` - 设为空或非"是"的值

## 🆘 遇到问题？

1. 查看 [README.md](./README.md) 的故障排除部分
2. 运行 `npm start status` 检查系统状态
3. 查看GitHub Actions运行日志
4. 在Issues中提问

---

🎉 **恭喜！您的RSS到Medium自动发布系统已经ready！** 