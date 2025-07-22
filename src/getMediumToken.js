/**
 * Medium会话令牌获取指南 - 增强版
 * 提供多种方法获取更持久的Medium认证令牌
 */

console.log(`
🔐 Medium API会话令牌获取指南 - 增强版
==========================================

Medium API发布方式比浏览器自动化更稳定、更快速，无需处理验证码和复杂登录。
以下提供多种方法获取更持久的认证令牌。

📊 认证方式对比:

🥇 Method 1: 官方Integration Token (最推荐)
   ✅ 持续时间：永久有效（除非手动撤销）
   ✅ 稳定性：最高，不会过期
   ✅ 安全性：官方支持，可控制权限
   
🥈 Method 2: 长期Session Cookie (推荐)
   ✅ 持续时间：2-6个月
   ✅ 稳定性：较高，需定期更新
   ⚠️  安全性：需妥善保管
   
🥉 Method 3: 普通Session Cookie (备用)
   ⚠️  持续时间：1-4周
   ⚠️  稳定性：一般，容易过期
   ⚠️  安全性：需频繁更新

=== Method 1: 官方Integration Token (永久有效) ===

📋 获取步骤:

1️⃣  登录Medium账户
   • 访问: https://medium.com
   • 确保您有Medium账户并已登录

2️⃣  进入设置页面
   • 点击右上角头像 → Settings
   • 或直接访问: https://medium.com/me/settings

3️⃣  获取Integration Token
   • 滚动到页面底部找到 "Integration tokens" 部分
   • 点击 "Get integration token"
   • 输入token描述 (如: "RSS Auto Publisher")
   • 复制生成的token (形如: 2505c4de9c4b7...)

4️⃣  设置环境变量
   • 在 .env 文件中添加:
     MEDIUM_INTEGRATION_TOKEN=你的integration_token
     MEDIUM_PUBLISH_METHOD=integration

💡 Integration Token优势:
   ✅ 永久有效，除非手动撤销
   ✅ 无需担心过期问题
   ✅ 官方API支持，稳定可靠
   ✅ 权限可控，更安全

=== Method 2: 长期Session Cookie (高持久性) ===

📋 获取步骤:

1️⃣  优化登录策略
   • 使用 "Remember me" 或保持登录状态
   • 避免使用无痕模式登录
   • 定期访问Medium保持活跃

2️⃣  选择最佳登录时机
   • 在稳定网络环境下登录
   • 避免频繁切换设备/浏览器
   • 建议在工作日登录 (服务器负载较低)

3️⃣  获取高质量Cookie
   方法A: Chrome DevTools
   • 登录Medium后，按F12打开开发者工具
   • Application → Storage → Cookies → https://medium.com
   • 找到 "sid" cookie，检查：
     - Expires: 应显示较远的未来日期
     - SameSite: 应为 Lax 或 None
     - Secure: 应为 true
   
   方法B: Network面板 (更准确)
   • Network → 刷新页面
   • 找到任意请求 → Headers → Request Headers
   • 复制完整的Cookie字符串中的sid值

4️⃣  验证Cookie质量
   • Cookie长度应 > 50字符
   • 包含多个段落 (用点分隔)
   • 设置后测试发布功能

=== Method 3: Cookie持久性优化技巧 ===

🔧 延长Cookie寿命:

1️⃣  保持会话活跃
   • 每周至少访问一次Medium
   • 定期阅读文章或互动
   • 避免长时间不活动

2️⃣  浏览器设置优化
   • 允许Medium存储Cookie
   • 不要自动清理Cookie
   • 添加Medium到受信任站点

3️⃣  网络环境稳定
   • 使用固定IP地址
   • 避免频繁更换网络
   • 启用HTTPS (自动)

4️⃣  多重备份策略
   • 保存多个有效的sid token
   • 定期更新token
   • 设置监控提醒

=== 设置环境变量 ===

创建或更新 .env 文件:

# Method 1: Integration Token (推荐)
MEDIUM_INTEGRATION_TOKEN=2505c4de9c4b7...
MEDIUM_PUBLISH_METHOD=integration

# Method 2: Session Cookie (备用)
MEDIUM_SESSION_TOKEN=你的长期sid值
MEDIUM_PUBLISH_METHOD=api

# 通用配置
MEDIUM_USER_ID=你的用户ID (可选)

=== 测试和验证 ===

⚡ 验证令牌有效性:
   pnpm start medium

📊 检查令牌状态:
   pnpm start status

🔄 自动轮换策略:
   • 设置多个备用token
   • 监控token状态
   • 自动切换失效token

=== 故障排除 ===

🚨 常见问题:

Token过期快:
   → 检查是否使用了无痕模式
   → 确保启用了"保持登录"
   → 增加Medium使用频率

认证失败:
   → 验证token格式正确
   → 检查网络连接
   → 尝试重新获取token

权限不足:
   → 确认账户类型支持API
   → 检查账户状态正常
   → 验证token权限设置

=== 安全建议 ===

🔒 安全最佳实践:

1. 定期轮换token (建议3个月)
2. 不要在公共代码中硬编码token
3. 使用环境变量存储敏感信息
4. 监控token使用情况
5. 发现异常立即撤销token

💡 监控设置:
   • 设置token过期提醒
   • 记录API调用日志
   • 定期备份配置

📞 需要帮助?
   如果遇到问题，请检查:
   1. Medium账户状态是否正常
   2. 是否有发布权限
   3. Token格式是否正确
   4. 网络连接是否稳定

现在选择最适合您的方法开始吧！ 🚀

推荐顺序: Integration Token → 长期Session Cookie → 普通Session Cookie
`);

// 提供交互式token验证
if (import.meta.url === `file://${process.argv[1]}`) {
   console.log('\n🔍 想要验证当前token有效性？运行: pnpm start status');
   console.log('📤 想要测试发布功能？运行: pnpm start medium');
   console.log('\n按任意键退出...');
   process.stdin.setRawMode(true);
   process.stdin.resume();
   process.stdin.on('data', () => process.exit(0));
} 