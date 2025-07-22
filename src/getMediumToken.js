/**
 * Medium会话令牌获取指南
 * 帮助用户获取Medium API所需的会话令牌
 */

console.log(`
🔐 Medium API会话令牌获取指南
=================================

Medium API发布方式比浏览器自动化更稳定、更快速，无需处理验证码和复杂登录。

📋 获取步骤:

1️⃣  登录Medium
   • 打开浏览器访问: https://medium.com
   • 使用您的账号登录（Google或邮箱均可）

2️⃣  打开开发者工具
   • 按 F12 键，或右键点击页面选择"检查"
   • 确保您在登录状态下操作

3️⃣  获取Cookie
   方法A: Application面板
   • 点击 "Application" 标签
   • 左侧找到 "Storage" → "Cookies" → "https://medium.com"
   • 找到名为 "sid" 的cookie，复制其Value值

   方法B: Network面板
   • 点击 "Network" 标签
   • 刷新页面 (F5)
   • 找到任意请求，查看 Request Headers
   • 在Cookie中找到 sid=xxxxx 的部分，复制sid的值

4️⃣  设置环境变量
   • 将获取的sid值设置为 MEDIUM_SESSION_TOKEN
   • 在 .env 文件中添加: MEDIUM_SESSION_TOKEN=您的sid值

⚡ 自动测试令牌有效性:
   运行: npm start medium

🔄 令牌过期处理:
   • Medium会话令牌通常有效期较长（几周到几个月）
   • 如果提示认证失败，重新获取新的令牌即可

💡 提示:
   • 保持Medium登录状态可延长令牌有效期
   • 不要分享您的会话令牌给他人
   • 令牌具有与您账号相同的权限

🆚 API vs 浏览器方式对比:

API方式 (推荐):
✅ 稳定可靠，不受页面变化影响
✅ 无需处理验证码和复杂登录
✅ 更快速，直接HTTP请求
✅ 适合服务器环境
✅ 支持批量发布

浏览器方式:
❌ 可能需要处理验证码
❌ 受Medium页面改版影响
❌ 需要图形界面或手动干预
❌ 速度较慢

📞 需要帮助?
   如果遇到问题，请检查:
   1. 是否正确登录Medium
   2. Cookie值是否完整复制
   3. 环境变量是否正确设置

现在就试试吧！ 🚀
`);

// 如果作为模块直接运行，显示交互式指导
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('\n按任意键退出...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(0));
} 