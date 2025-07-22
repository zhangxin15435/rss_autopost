import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 验证GitHub Actions环境配置
 */
function validateEnvironment() {
    console.log('🔍 验证GitHub Actions环境配置...\n');

    const checks = [];

    // RSS URL检查
    const rssUrl = process.env.RSS_URL;
    const isCI = process.env.CI;
    checks.push({
        name: 'RSS_URL',
        value: rssUrl,
        status: rssUrl ? '✅' : (isCI ? '❌' : '⚠️'),
        note: rssUrl || (isCI ? '未设置 - CI环境必需' : '未设置 - 将使用默认值')
    });

    // Medium发布方式检查
    const publishMethod = process.env.MEDIUM_PUBLISH_METHOD || 'playwright';
    checks.push({
        name: 'MEDIUM_PUBLISH_METHOD',
        value: publishMethod,
        status: '✅',
        note: `使用 ${publishMethod} 方式`
    });

    // Playwright方式检查
    if (publishMethod === 'playwright') {
        const mediumEmail = process.env.MEDIUM_EMAIL;
        const mediumPassword = process.env.MEDIUM_PASSWORD;
        const sessionToken = process.env.MEDIUM_SESSION_TOKEN;

        checks.push({
            name: 'MEDIUM_EMAIL',
            value: mediumEmail ? '***设置***' : undefined,
            status: mediumEmail ? '✅' : (sessionToken ? '⚠️' : '❌'),
            note: mediumEmail ? '已设置邮箱' : (sessionToken ? '未设置邮箱，但有Session Token备用' : '未设置 - Playwright方式需要邮箱或Session Token')
        });

        checks.push({
            name: 'MEDIUM_PASSWORD',
            value: mediumPassword ? '***设置***' : undefined,
            status: mediumPassword ? '✅' : (sessionToken ? '⚠️' : '❌'),
            note: mediumPassword ? '已设置密码' : (sessionToken ? '未设置密码，但有Session Token备用' : '未设置 - Playwright方式需要密码或Session Token')
        });

        // Session Token作为备用或主要认证方式
        checks.push({
            name: 'MEDIUM_SESSION_TOKEN',
            value: sessionToken ? '***设置***' : undefined,
            status: sessionToken ? '✅' : '⚠️',
            note: sessionToken ? '已设置 (可作为主要或备用认证)' : '未设置 - 可作为备用认证方式'
        });
    }

    // API方式检查
    else if (publishMethod === 'api') {
        const integrationToken = process.env.MEDIUM_INTEGRATION_TOKEN;
        const sessionToken = process.env.MEDIUM_SESSION_TOKEN;
        const userId = process.env.MEDIUM_USER_ID;

        checks.push({
            name: 'MEDIUM_INTEGRATION_TOKEN',
            value: integrationToken ? '***设置***' : undefined,
            status: integrationToken ? '✅' : '❌',
            note: integrationToken ? '已设置' : '未设置 - API方式需要'
        });

        checks.push({
            name: 'MEDIUM_SESSION_TOKEN',
            value: sessionToken ? '***设置***' : undefined,
            status: sessionToken ? '✅' : '⚠️',
            note: sessionToken ? '已设置' : '未设置 - 可作为API备用'
        });

        checks.push({
            name: 'MEDIUM_USER_ID',
            value: userId,
            status: userId ? '✅' : '❌',
            note: userId || '未设置 - API方式需要'
        });
    }

    // 其他配置检查
    const ciEnv = process.env.CI;
    checks.push({
        name: 'CI',
        value: ciEnv,
        status: ciEnv ? '✅' : '⚠️',
        note: ciEnv ? 'GitHub Actions环境' : '本地开发环境'
    });

    const headless = process.env.MEDIUM_HEADLESS;
    checks.push({
        name: 'MEDIUM_HEADLESS',
        value: headless || 'true',
        status: '✅',
        note: `浏览器${headless !== 'false' ? '无头' : '有头'}模式`
    });

    const timeout = process.env.MEDIUM_TIMEOUT;
    checks.push({
        name: 'MEDIUM_TIMEOUT',
        value: timeout || '30000',
        status: '✅',
        note: `超时: ${timeout || '30000'}ms`
    });

    const retries = process.env.MEDIUM_RETRIES;
    checks.push({
        name: 'MEDIUM_RETRIES',
        value: retries || '3',
        status: '✅',
        note: `重试次数: ${retries || '3'}`
    });

    // 输出结果
    console.log('📋 环境变量检查结果:\n');
    checks.forEach(check => {
        console.log(`${check.status} ${check.name}: ${check.value || '未设置'}`);
        if (check.note) {
            console.log(`   ${check.note}`);
        }
        console.log('');
    });

    // 总结
    const errors = checks.filter(c => c.status === '❌').length;
    const warnings = checks.filter(c => c.status === '⚠️').length;

    console.log('📊 检查总结:');
    console.log(`✅ 正常: ${checks.length - errors - warnings} 项`);
    if (warnings > 0) {
        console.log(`⚠️ 警告: ${warnings} 项`);
    }
    if (errors > 0) {
        console.log(`❌ 错误: ${errors} 项`);
    }

    // 发布状态判断
    console.log('\n🚀 发布状态:');
    if (publishMethod === 'playwright') {
        const canPublish = (process.env.MEDIUM_EMAIL && process.env.MEDIUM_PASSWORD) || process.env.MEDIUM_SESSION_TOKEN;
        console.log(`📤 Playwright发布: ${canPublish ? '✅ 可用' : '❌ 缺少认证信息'}`);
        if (canPublish) {
            const authMethod = process.env.MEDIUM_SESSION_TOKEN ? 'Session Token' : '邮箱密码';
            console.log(`🔐 认证方式: ${authMethod}`);
        }
    } else if (publishMethod === 'api') {
        const canPublish = process.env.MEDIUM_INTEGRATION_TOKEN || process.env.MEDIUM_SESSION_TOKEN;
        console.log(`📤 API发布: ${canPublish ? '✅ 可用' : '❌ 缺少认证信息'}`);
        if (canPublish) {
            const authMethod = process.env.MEDIUM_INTEGRATION_TOKEN ? 'Integration Token' : 'Session Token';
            console.log(`🔐 认证方式: ${authMethod}`);
        }
    }

    const rssAvailable = process.env.RSS_URL || 'localhost默认URL';
    console.log(`📡 RSS源: ${rssAvailable}`);

    return {
        totalChecks: checks.length,
        errors,
        warnings,
        canPublish: publishMethod === 'playwright'
            ? (process.env.MEDIUM_EMAIL && process.env.MEDIUM_PASSWORD) || process.env.MEDIUM_SESSION_TOKEN
            : process.env.MEDIUM_INTEGRATION_TOKEN || process.env.MEDIUM_SESSION_TOKEN
    };
}

// 如果直接运行此文件
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const currentFile = path.resolve(__filename);
const scriptFile = path.resolve(process.argv[1] || '');

if (currentFile === scriptFile || process.argv[1]?.endsWith('validateEnvironment.js')) {
    const result = validateEnvironment();

    // 设置退出码：只有在CI环境或者有严重错误时才返回错误码
    const hasSerousErrors = result.errors > 0 && (process.env.CI || !result.canPublish);
    process.exit(hasSerousErrors ? 1 : 0);
}

export { validateEnvironment }; 