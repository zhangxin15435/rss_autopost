#!/usr/bin/env node

import dotenv from 'dotenv';
import MediumPlaywrightPublisher from './mediumPlaywrightPublisher.js';

// 加载环境变量
dotenv.config();

/**
 * Playwright发布器测试脚本
 * 用于独立测试Medium Playwright发布功能
 */

async function testPlaywrightPublisher() {
    console.log('🧪 开始测试 Medium Playwright 发布器...\n');

    // 配置选项
    const testConfig = {
        email: process.env.MEDIUM_EMAIL,
        password: process.env.MEDIUM_PASSWORD,
        sessionToken: process.env.MEDIUM_SESSION_TOKEN,
        rssUrl: process.env.RSS_URL || 'https://your-github-pages.github.io/feed.xml',
        headless: process.env.MEDIUM_HEADLESS !== 'false', // 可以设为false查看过程
        slowMo: process.env.MEDIUM_SLOW_MO ? parseInt(process.env.MEDIUM_SLOW_MO) : 1000,
        timeout: 60000, // 测试时使用更长的超时时间
        retries: 1 // 测试时减少重试次数
    };

    console.log('📋 测试配置:');
    console.log(`  • RSS URL: ${testConfig.rssUrl}`);
    console.log(`  • 无头模式: ${testConfig.headless}`);
    console.log(`  • 邮箱认证: ${testConfig.email ? '✅' : '❌'}`);
    console.log(`  • Session Token: ${testConfig.sessionToken ? '✅' : '❌'}`);
    console.log('');

    // 检查必要的配置
    if (!testConfig.email && !testConfig.sessionToken) {
        console.error('❌ 错误: 需要设置 MEDIUM_EMAIL 和 MEDIUM_PASSWORD，或者 MEDIUM_SESSION_TOKEN');
        console.log('\n💡 请在 .env 文件中设置:');
        console.log('   MEDIUM_EMAIL=your_email@example.com');
        console.log('   MEDIUM_PASSWORD=your_password');
        console.log('   或');
        console.log('   MEDIUM_SESSION_TOKEN=your_session_token');
        process.exit(1);
    }

    if (testConfig.email && !testConfig.password) {
        console.error('❌ 错误: 设置了邮箱但没有设置密码');
        console.log('💡 请设置 MEDIUM_PASSWORD=your_password');
        process.exit(1);
    }

    try {
        // 创建发布器实例
        const publisher = new MediumPlaywrightPublisher(testConfig);

        // 运行测试
        console.log('🎭 开始执行发布测试...\n');
        const result = await publisher.run();

        // 显示结果
        console.log('\n📊 测试结果:');
        console.log(`  • 成功: ${result.success ? '✅' : '❌'}`);
        console.log(`  • 方法: ${result.method || 'N/A'}`);
        console.log(`  • 导入数量: ${result.published || 0}`);

        if (result.message) {
            console.log(`  • 消息: ${result.message}`);
        }

        if (result.error) {
            console.log(`  • 错误: ${result.error}`);
        }

        // 获取统计信息
        console.log('\n📈 发布统计:');
        const stats = await publisher.getPublishStats();
        console.log(`  • 总发布数: ${stats.totalPublished}`);
        console.log(`  • 最后更新: ${stats.lastUpdate}`);
        console.log(`  • RSS地址: ${stats.rssUrl}`);

        if (result.success) {
            console.log('\n🎉 测试成功完成!');
            console.log('💡 现在可以在主程序中使用 Playwright 发布方式');
        } else {
            console.log('\n❌ 测试失败');
            console.log('💡 请检查配置和网络连接，查看截图文件以了解详细错误');
        }

    } catch (error) {
        console.error('\n❌ 测试过程中发生错误:', error.message);
        console.log('\n🔍 故障排除建议:');
        console.log('  1. 检查网络连接');
        console.log('  2. 验证Medium登录凭据');
        console.log('  3. 确认RSS URL可访问');
        console.log('  4. 查看生成的截图文件');
        console.log('  5. 尝试设置 MEDIUM_HEADLESS=false 观察执行过程');

        process.exit(1);
    }
}

// 执行测试
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const currentFile = path.resolve(__filename);
const scriptFile = path.resolve(process.argv[1] || '');

if (currentFile === scriptFile || process.argv[1]?.endsWith('testPlaywrightPublisher.js')) {
    testPlaywrightPublisher().catch(console.error);
}

export default testPlaywrightPublisher; 