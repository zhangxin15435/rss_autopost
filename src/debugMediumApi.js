import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs-extra';

// 加载环境变量
dotenv.config();

/**
 * Medium API 调试器 - 使用有头浏览器测试
 * 用于诊断 API 问题和验证认证状态
 */
class MediumApiDebugger {
    constructor() {
        this.sessionToken = process.env.MEDIUM_SESSION_TOKEN;
        this.integrationToken = process.env.MEDIUM_INTEGRATION_TOKEN;
        this.browser = null;
        this.page = null;
    }

    /**
     * 启动有头浏览器
     */
    async initBrowser() {
        console.log('🚀 启动有头浏览器...');

        this.browser = await chromium.launch({
            headless: false,  // 有头模式
            slowMo: 1000,     // 放慢操作速度便于观察
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();

        // 设置用户代理
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('✅ 浏览器启动成功');
    }

    /**
     * 设置 Session Cookie
     */
    async setSessionCookie() {
        if (!this.sessionToken) {
            console.log('❌ 未设置 MEDIUM_SESSION_TOKEN');
            return false;
        }

        console.log('🍪 设置 Medium Session Cookie...');

        try {
            // 首先访问 Medium 主页
            await this.page.goto('https://medium.com', { waitUntil: 'networkidle' });

            // 设置 sid cookie
            await this.page.context().addCookies([{
                name: 'sid',
                value: this.sessionToken,
                domain: '.medium.com',
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax'
            }]);

            console.log('✅ Session Cookie 设置成功');
            return true;
        } catch (error) {
            console.error('❌ 设置 Cookie 失败:', error.message);
            return false;
        }
    }

    /**
     * 验证登录状态
     */
    async verifyLoginStatus() {
        console.log('🔍 验证登录状态...');

        try {
            // 重新加载页面以应用 cookie
            await this.page.reload({ waitUntil: 'networkidle' });

            // 等待页面加载完成
            await this.page.waitForTimeout(3000);

            // 检查是否已登录 - 寻找用户菜单或头像
            const isLoggedIn = await this.page.locator('[data-testid="headerAvatar"], [data-testid="user-menu"], .avatar, .user-image').count() > 0;

            if (isLoggedIn) {
                console.log('✅ 用户已登录');

                // 尝试获取用户信息
                const userInfo = await this.page.evaluate(() => {
                    // 尝试从页面中提取用户信息
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        if (script.textContent && script.textContent.includes('currentUser')) {
                            try {
                                const match = script.textContent.match(/window\["__APOLLO_STATE__"\]\s*=\s*({.*?});/);
                                if (match) {
                                    const apolloState = JSON.parse(match[1]);
                                    return apolloState;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                    return null;
                });

                if (userInfo) {
                    console.log('📋 用户信息获取成功');
                    await fs.writeJson('debug_user_info.json', userInfo, { spaces: 2 });
                }

                return true;
            } else {
                console.log('❌ 用户未登录，可能 Session Token 已过期');
                return false;
            }
        } catch (error) {
            console.error('❌ 验证登录状态失败:', error.message);
            return false;
        }
    }

    /**
     * 测试 Medium 内部 API
     */
    async testInternalApi() {
        console.log('🔬 测试 Medium 内部 API...');

        // 监听网络请求
        const apiCalls = [];
        this.page.on('response', response => {
            const url = response.url();
            if (url.includes('medium.com') && (url.includes('/_/api') || url.includes('/api/') || url.includes('graphql'))) {
                apiCalls.push({
                    url: url,
                    status: response.status(),
                    method: response.request().method(),
                    headers: response.headers()
                });
            }
        });

        try {
            // 访问一些页面来触发 API 调用
            console.log('📝 访问用户设置页面...');
            await this.page.goto('https://medium.com/me/settings', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            console.log('📊 访问用户统计页面...');
            await this.page.goto('https://medium.com/me/stats', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            console.log('✍️ 访问写作页面...');
            await this.page.goto('https://medium.com/new-story', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // 保存API调用记录
            if (apiCalls.length > 0) {
                console.log(`📡 捕获到 ${apiCalls.length} 个 API 调用`);
                await fs.writeJson('debug_api_calls.json', apiCalls, { spaces: 2 });

                // 显示主要API端点
                const uniqueEndpoints = [...new Set(apiCalls.map(call => {
                    const url = new URL(call.url);
                    return `${call.method} ${url.pathname}`;
                }))];

                console.log('🔍 发现的API端点:');
                uniqueEndpoints.forEach(endpoint => {
                    console.log(`  • ${endpoint}`);
                });
            } else {
                console.log('❌ 未捕获到任何 API 调用');
            }

            return apiCalls;
        } catch (error) {
            console.error('❌ 测试内部 API 失败:', error.message);
            return [];
        }
    }

    /**
     * 手动测试 API 调用
     */
    async testManualApiCalls() {
        console.log('🧪 手动测试 API 调用...');

        const testUrls = [
            'https://medium.com/_/api/users/self',
            'https://medium.com/_/api/me',
            'https://medium.com/me',
            'https://api.medium.com/v1/me',
            'https://medium.com/_/graphql'
        ];

        const results = [];

        for (const url of testUrls) {
            try {
                console.log(`🔗 测试: ${url}`);

                const response = await this.page.evaluate(async (testUrl) => {
                    try {
                        const resp = await fetch(testUrl, {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });

                        const text = await resp.text();
                        let data;
                        try {
                            data = JSON.parse(text);
                        } catch {
                            data = text.substring(0, 200) + '...';
                        }

                        return {
                            url: testUrl,
                            status: resp.status,
                            statusText: resp.statusText,
                            headers: Object.fromEntries(resp.headers.entries()),
                            data: data
                        };
                    } catch (error) {
                        return {
                            url: testUrl,
                            error: error.message
                        };
                    }
                }, url);

                results.push(response);

                if (response.error) {
                    console.log(`  ❌ 错误: ${response.error}`);
                } else {
                    console.log(`  📊 状态: ${response.status} ${response.statusText}`);
                    if (response.status === 200) {
                        console.log(`  ✅ 成功!`);
                    }
                }

            } catch (error) {
                console.error(`  ❌ 请求失败: ${error.message}`);
                results.push({ url, error: error.message });
            }

            await this.page.waitForTimeout(1000);
        }

        // 保存测试结果
        await fs.writeJson('debug_manual_api_tests.json', results, { spaces: 2 });

        return results;
    }

    /**
     * 获取正确的用户 ID
     */
    async extractUserId() {
        console.log('🆔 提取用户 ID...');

        try {
            await this.page.goto('https://medium.com/me/settings', { waitUntil: 'networkidle' });

            const userId = await this.page.evaluate(() => {
                // 方法1: 从Apollo State提取
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    if (script.textContent && script.textContent.includes('currentUser')) {
                        try {
                            const match = script.textContent.match(/window\["__APOLLO_STATE__"\]\s*=\s*({.*?});/);
                            if (match) {
                                const apolloState = JSON.parse(match[1]);
                                for (const key in apolloState) {
                                    if (key.startsWith('User:') && apolloState[key].id) {
                                        return apolloState[key].id;
                                    }
                                }
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }

                // 方法2: 从页面URL或其他元素提取
                const profileLinks = document.querySelectorAll('a[href*="/me/"], a[href*="/@"]');
                for (const link of profileLinks) {
                    const href = link.href;
                    const match = href.match(/@([^/]+)/);
                    if (match) {
                        return match[1];
                    }
                }

                return null;
            });

            if (userId) {
                console.log(`✅ 用户 ID: ${userId}`);
                return userId;
            } else {
                console.log('❌ 无法提取用户 ID');
                return null;
            }
        } catch (error) {
            console.error('❌ 提取用户 ID 失败:', error.message);
            return null;
        }
    }

    /**
     * 运行完整的调试流程
     */
    async runDebug() {
        try {
            console.log('🔧 开始 Medium API 调试...\n');

            // 1. 启动浏览器
            await this.initBrowser();

            // 2. 设置 Session Cookie
            const cookieSet = await this.setSessionCookie();
            if (!cookieSet) {
                throw new Error('Session Cookie 设置失败');
            }

            // 3. 验证登录状态
            const isLoggedIn = await this.verifyLoginStatus();
            if (!isLoggedIn) {
                console.log('\n❌ 登录验证失败，请检查 Session Token 是否有效');
                console.log('💡 建议重新获取 Session Token');
                return;
            }

            // 4. 提取用户 ID
            const userId = await this.extractUserId();
            if (userId) {
                console.log(`\n🔑 建议在 .env 中设置: MEDIUM_USER_ID=${userId}`);
            }

            // 5. 测试内部 API
            await this.testInternalApi();

            // 6. 手动测试 API 调用
            const apiResults = await this.testManualApiCalls();

            // 7. 分析结果
            console.log('\n📊 调试结果分析:');
            const successfulApis = apiResults.filter(r => r.status === 200);
            if (successfulApis.length > 0) {
                console.log('✅ 发现可用的 API 端点:');
                successfulApis.forEach(api => {
                    console.log(`  • ${api.url}`);
                });
            } else {
                console.log('❌ 所有 API 端点都返回错误');
                console.log('💡 可能需要使用官方 Integration Token');
            }

            console.log('\n📁 调试文件已保存:');
            console.log('  • debug_user_info.json - 用户信息');
            console.log('  • debug_api_calls.json - API 调用记录');
            console.log('  • debug_manual_api_tests.json - 手动测试结果');

            // 保持浏览器打开以便手动检查
            console.log('\n🔍 浏览器将保持打开状态，您可以手动检查...');
            console.log('按 Enter 键关闭浏览器并退出');

            // 等待用户输入
            await new Promise(resolve => {
                process.stdin.once('data', resolve);
            });

        } catch (error) {
            console.error('❌ 调试过程失败:', error.message);
        } finally {
            if (this.browser) {
                await this.browser.close();
                console.log('✅ 浏览器已关闭');
            }
        }
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    const debugger = new MediumApiDebugger();
    debugger.runDebug().catch(console.error);
}

export default MediumApiDebugger; 