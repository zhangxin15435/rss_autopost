#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs-extra';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * Medium Cookie提取器
 * 手动登录Medium后提取并保存cookies
 */
class MediumCookieExtractor {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cookiesFile = 'medium_cookies.json';
    }

    /**
     * 启动浏览器并等待手动登录
     */
    async extractCookies() {
        try {
            console.log('🎭 启动浏览器进行手动登录...');

            // 启动有头浏览器
            this.browser = await chromium.launch({
                headless: false,
                slowMo: 500,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security'
                ]
            });

            const context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 720 }
            });

            this.page = await context.newPage();

            // 访问Medium首页
            console.log('🌐 正在访问Medium首页...');
            await this.page.goto('https://medium.com', { waitUntil: 'networkidle' });

            console.log('\n📋 请按照以下步骤操作:');
            console.log('1. 在打开的浏览器中手动登录您的Medium账户');
            console.log('2. 确保登录成功后可以看到您的个人头像');
            console.log('3. 登录完成后回到控制台，按 Enter 键继续');

            // 等待用户按Enter键
            await this.waitForUserInput();

            // 检查登录状态
            console.log('🔍 检查登录状态...');
            const isLoggedIn = await this.checkLoginStatus();

            if (!isLoggedIn) {
                console.log('❌ 检测到未登录状态，请确保已完成登录');
                console.log('💡 请刷新页面并重新登录，然后重新运行此脚本');
                return false;
            }

            // 提取并保存cookies
            console.log('🍪 提取cookies...');
            const cookies = await context.cookies();

            // 过滤重要的cookies
            const importantCookies = cookies.filter(cookie =>
                ['sid', 'uid', '__cfduid', '_ga', '_gid', 'lightstep_guid/medium-web'].includes(cookie.name) ||
                cookie.name.includes('medium') ||
                cookie.name.includes('session')
            );

            console.log(`✅ 找到 ${cookies.length} 个cookies，其中 ${importantCookies.length} 个重要cookies`);

            // 保存cookies
            await fs.writeJson(this.cookiesFile, cookies, { spaces: 2 });
            console.log(`💾 Cookies已保存到: ${this.cookiesFile}`);

            // 显示重要的cookie信息
            console.log('\n📊 重要Cookies:');
            importantCookies.forEach(cookie => {
                const value = cookie.value.length > 20 ? cookie.value.substring(0, 20) + '...' : cookie.value;
                console.log(`  • ${cookie.name}: ${value}`);
            });

            // 测试cookies有效性
            console.log('\n🧪 测试cookies有效性...');
            await this.testCookies(cookies);

            console.log('\n🎉 Cookie提取完成！');
            console.log('💡 现在可以运行 pnpm run test-playwright 测试自动发布功能');

            return true;

        } catch (error) {
            console.error('❌ 提取cookies失败:', error.message);
            return false;
        } finally {
            if (this.browser) {
                await this.browser.close();
                console.log('🧹 浏览器已关闭');
            }
        }
    }

    /**
     * 等待用户输入
     */
    async waitForUserInput() {
        return new Promise((resolve) => {
            process.stdin.once('data', () => {
                resolve();
            });
        });
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        try {
            // 检查登录指示器
            const loginIndicators = [
                '[data-testid="headerAvatar"]',
                '[data-testid="user-menu"]',
                '.avatar',
                '.user-image',
                'button[aria-label*="user menu"]',
                'img[alt*="avatar"]',
                'svg[data-testid="userProfileIcon"]'
            ];

            for (const selector of loginIndicators) {
                const element = await this.page.$(selector);
                if (element) {
                    console.log(`✅ 找到登录指示器: ${selector}`);
                    return true;
                }
            }

            // 检查URL是否包含用户相关路径
            const currentUrl = this.page.url();
            if (currentUrl.includes('/me/') || currentUrl.includes('/@')) {
                console.log('✅ URL显示已登录状态');
                return true;
            }

            // 检查页面是否有写作按钮等登录后才有的功能
            const writeButton = await this.page.$('a[href="/new-story"], button:has-text("Write"), a:has-text("Write")');
            if (writeButton) {
                console.log('✅ 找到写作按钮，确认已登录');
                return true;
            }

            return false;

        } catch (error) {
            console.error('检查登录状态时出错:', error.message);
            return false;
        }
    }

    /**
     * 测试cookies有效性
     */
    async testCookies(cookies) {
        try {
            // 创建新的浏览器上下文来测试cookies
            const testContext = await this.browser.newContext();
            await testContext.addCookies(cookies);

            const testPage = await testContext.newPage();
            await testPage.goto('https://medium.com', { waitUntil: 'networkidle' });

            // 检查是否仍然处于登录状态
            const isStillLoggedIn = await this.checkLoginStatusInPage(testPage);

            if (isStillLoggedIn) {
                console.log('✅ Cookies测试成功，登录状态已保持');
            } else {
                console.log('⚠️ Cookies测试警告，可能需要重新登录');
            }

            await testContext.close();

        } catch (error) {
            console.error('⚠️ 测试cookies时出错:', error.message);
        }
    }

    /**
     * 在指定页面检查登录状态
     */
    async checkLoginStatusInPage(page) {
        try {
            const avatar = await page.$('[data-testid="headerAvatar"], .avatar, img[alt*="avatar"]');
            return !!avatar;
        } catch (error) {
            return false;
        }
    }

    /**
     * 显示已保存的cookies信息
     */
    async showSavedCookies() {
        try {
            if (!await fs.pathExists(this.cookiesFile)) {
                console.log('❌ 没有找到保存的cookies文件');
                return;
            }

            const cookies = await fs.readJson(this.cookiesFile);
            console.log(`📊 已保存的cookies (${cookies.length}个):`);

            const importantCookies = cookies.filter(cookie =>
                ['sid', 'uid', '__cfduid'].includes(cookie.name) ||
                cookie.name.includes('medium')
            );

            importantCookies.forEach(cookie => {
                const value = cookie.value.length > 30 ? cookie.value.substring(0, 30) + '...' : cookie.value;
                console.log(`  • ${cookie.name}: ${value}`);
                console.log(`    域名: ${cookie.domain}, 过期: ${cookie.expires ? new Date(cookie.expires * 1000).toLocaleString() : '会话'}`);
            });

        } catch (error) {
            console.error('读取cookies文件失败:', error.message);
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'extract';

    const extractor = new MediumCookieExtractor();

    try {
        switch (command) {
            case 'extract':
                console.log('🔐 Medium Cookie 提取器\n');
                await extractor.extractCookies();
                break;

            case 'show':
                console.log('📊 显示已保存的Cookies\n');
                await extractor.showSavedCookies();
                break;

            case 'help':
            default:
                console.log(`
🔐 Medium Cookie 提取器

使用方法:
  node src/extractMediumCookies.js [command]

命令:
  extract   提取Medium cookies (默认)
  show      显示已保存的cookies
  help      显示此帮助信息

步骤:
  1. 运行 extract 命令
  2. 在打开的浏览器中手动登录Medium
  3. 登录完成后按Enter键保存cookies
  4. 运行测试脚本验证功能

示例:
  node src/extractMediumCookies.js extract
  pnpm run test-playwright
`);
                break;
        }
    } catch (error) {
        console.error('❌ 程序执行失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此文件
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const currentFile = path.resolve(__filename);
const scriptFile = path.resolve(process.argv[1]);

if (currentFile === scriptFile) {
    main();
}

export default MediumCookieExtractor; 