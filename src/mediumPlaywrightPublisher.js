import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

// 加载环境变量
dotenv.config();

/**
 * Medium Playwright发布器
 * 使用浏览器自动化实现Medium博客导入
 * 通过访问 https://medium.com/p/import 来导入RSS feed
 */
class MediumPlaywrightPublisher {
    constructor(options = {}) {
        this.config = {
            email: options.email || process.env.MEDIUM_EMAIL,
            password: options.password || process.env.MEDIUM_PASSWORD,
            sessionToken: options.sessionToken || process.env.MEDIUM_SESSION_TOKEN,
            rssUrl: options.rssUrl || process.env.RSS_URL || 'https://yourblog.github.io/feed.xml',
            headless: options.headless !== undefined ? options.headless : true,
            slowMo: options.slowMo || 1000,
            timeout: options.timeout || 30000,
            retries: options.retries || 3
        };

        this.browser = null;
        this.page = null;
        this.cookiesFile = 'medium_cookies.json';
        this.publishedFile = options.publishedFile || 'published_articles.json';
        this.publishedArticles = new Set();

        // 加载已发布记录
        this.loadPublishedArticles();

        console.log('🎭 初始化 Medium Playwright 发布器');
        console.log(`📡 RSS URL: ${this.config.rssUrl}`);
    }

    /**
     * 加载已发布文章记录
     */
    async loadPublishedArticles() {
        try {
            if (await fs.pathExists(this.publishedFile)) {
                const data = await fs.readJson(this.publishedFile);
                this.publishedArticles = new Set(data.published || []);
                console.log(`📚 加载了 ${this.publishedArticles.size} 条已发布记录`);
            }
        } catch (error) {
            console.error('⚠️ 加载已发布记录失败:', error.message);
        }
    }

    /**
     * 保存已发布文章记录
     */
    async savePublishedArticles() {
        try {
            const data = {
                published: Array.from(this.publishedArticles),
                lastUpdated: new Date().toISOString(),
                lastImportUrl: this.config.rssUrl
            };
            await fs.writeJson(this.publishedFile, data, { spaces: 2 });
        } catch (error) {
            console.error('⚠️ 保存已发布记录失败:', error.message);
        }
    }

    /**
     * 启动浏览器
     */
    async initBrowser() {
        console.log('🚀 启动浏览器...');

        this.browser = await chromium.launch({
            headless: this.config.headless,
            slowMo: this.config.slowMo,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--disable-dev-shm-usage',
                '--disable-extensions'
            ]
        });

        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            locale: 'zh-CN'
        });

        this.page = await context.newPage();

        // 设置默认超时
        this.page.setDefaultTimeout(this.config.timeout);

        // 拦截不必要的资源以提高速度
        await this.page.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        console.log('✅ 浏览器启动成功');
    }

    /**
     * 加载保存的cookies
     */
    async loadCookies() {
        try {
            if (await fs.pathExists(this.cookiesFile)) {
                const cookies = await fs.readJson(this.cookiesFile);
                await this.page.context().addCookies(cookies);
                console.log('🍪 已加载保存的cookies');
                return true;
            }
        } catch (error) {
            console.error('⚠️ 加载cookies失败:', error.message);
        }
        return false;
    }

    /**
     * 保存cookies
     */
    async saveCookies() {
        try {
            const cookies = await this.page.context().cookies();
            await fs.writeJson(this.cookiesFile, cookies, { spaces: 2 });
            console.log('💾 cookies已保存');
        } catch (error) {
            console.error('⚠️ 保存cookies失败:', error.message);
        }
    }

    /**
     * 设置Session Token (如果提供)
     */
    async setSessionToken() {
        if (!this.config.sessionToken) {
            return false;
        }

        console.log('🔑 设置Session Token...');

        try {
            await this.page.goto('https://medium.com', { waitUntil: 'networkidle' });

            await this.page.context().addCookies([{
                name: 'sid',
                value: this.config.sessionToken,
                domain: '.medium.com',
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax'
            }]);

            console.log('✅ Session Token设置成功');
            return true;
        } catch (error) {
            console.error('❌ 设置Session Token失败:', error.message);
            return false;
        }
    }

    /**
 * 检查登录状态
 */
    async checkLoginStatus() {
        console.log('🔍 检查登录状态...');

        try {
            await this.page.goto('https://medium.com', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000); // 增加等待时间

            // 更全面的登录指示器检查
            const loginIndicators = [
                // 用户头像和菜单
                '[data-testid="headerAvatar"]',
                '[data-testid="user-menu"]',
                '.avatar',
                '.user-image',
                'button[aria-label*="user menu"]',
                'img[alt*="avatar"]',
                'svg[data-testid="userProfileIcon"]',

                // 写作相关按钮
                'a[href="/new-story"]',
                'button:has-text("Write")',
                'a:has-text("Write")',

                // 用户菜单按钮
                'button[data-testid="avatar-button"]',
                'button[aria-expanded]',

                // 个人页面链接
                'a[href*="/me/"]',
                'a[href*="/@"]'
            ];

            console.log('🔍 检查登录指示器...');
            for (const selector of loginIndicators) {
                try {
                    const element = await this.page.$(selector);
                    if (element && await element.isVisible()) {
                        console.log(`✅ 找到登录指示器: ${selector}`);
                        console.log('✅ 用户已登录');
                        return true;
                    }
                } catch (e) {
                    // 忽略个别选择器的错误
                }
            }

            // 检查页面内容是否包含登录后才有的文本
            const pageContent = await this.page.content();
            const loggedInTexts = [
                'Write',
                'Your stories',
                'Following',
                'Notifications'
            ];

            for (const text of loggedInTexts) {
                if (pageContent.includes(text)) {
                    console.log(`✅ 页面包含登录文本: "${text}"`);
                    console.log('✅ 用户已登录');
                    return true;
                }
            }

            // 检查当前URL是否显示已登录状态
            const currentUrl = this.page.url();
            console.log(`🌐 当前URL: ${currentUrl}`);

            if (currentUrl.includes('/me/') || currentUrl.includes('/@')) {
                console.log('✅ URL显示已登录状态');
                return true;
            }

            // 最后检查是否有明显的未登录指示器
            const loginButton = await this.page.$('a[href="/m/signin"], button:has-text("Sign in"), a:has-text("Sign in")');
            if (loginButton && await loginButton.isVisible()) {
                console.log('❌ 找到登录按钮，用户未登录');
                return false;
            }

            // 如果没有找到明确的未登录指示器，可能已经登录
            console.log('✅ 未找到登录按钮，推测用户已登录');
            return true;

        } catch (error) {
            console.error('⚠️ 检查登录状态失败:', error.message);
            // 发生错误时假设已登录，继续执行
            return true;
        }
    }

    /**
     * 自动登录
     */
    async login() {
        if (!this.config.email || !this.config.password) {
            throw new Error('未设置Medium登录凭据 (MEDIUM_EMAIL, MEDIUM_PASSWORD)');
        }

        console.log('🔐 开始自动登录...');

        try {
            await this.page.goto('https://medium.com/m/signin', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(2000);

            // 查找邮箱输入框
            const emailSelectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="email" i]',
                'input[data-testid="email"]'
            ];

            let emailInput = null;
            for (const selector of emailSelectors) {
                emailInput = await this.page.$(selector);
                if (emailInput) {
                    console.log(`📧 找到邮箱输入框: ${selector}`);
                    break;
                }
            }

            if (!emailInput) {
                throw new Error('无法找到邮箱输入框');
            }

            // 输入邮箱
            await emailInput.fill(this.config.email);
            console.log('📧 已输入邮箱');

            // 查找并点击继续按钮
            const continueSelectors = [
                'button:has-text("Continue")',
                'button:has-text("Sign in")',
                'button[type="submit"]',
                'button:has-text("下一步")',
                'button:has-text("继续")'
            ];

            let continueButton = null;
            for (const selector of continueSelectors) {
                continueButton = await this.page.$(selector);
                if (continueButton && await continueButton.isVisible()) {
                    break;
                }
            }

            if (continueButton) {
                await continueButton.click();
                console.log('👆 点击继续按钮');
                await this.page.waitForTimeout(3000);
            }

            // 查找密码输入框
            const passwordSelectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[placeholder*="password" i]',
                'input[data-testid="password"]'
            ];

            let passwordInput = null;
            for (const selector of passwordSelectors) {
                passwordInput = await this.page.$(selector);
                if (passwordInput && await passwordInput.isVisible()) {
                    console.log(`🔒 找到密码输入框: ${selector}`);
                    break;
                }
            }

            if (!passwordInput) {
                throw new Error('无法找到密码输入框');
            }

            // 输入密码
            await passwordInput.fill(this.config.password);
            console.log('🔒 已输入密码');

            // 查找并点击登录按钮
            const loginSelectors = [
                'button:has-text("Sign in")',
                'button:has-text("Log in")',
                'button[type="submit"]',
                'button:has-text("登录")',
                'button:has-text("Sign In")'
            ];

            let loginButton = null;
            for (const selector of loginSelectors) {
                loginButton = await this.page.$(selector);
                if (loginButton && await loginButton.isVisible()) {
                    break;
                }
            }

            if (!loginButton) {
                throw new Error('无法找到登录按钮');
            }

            await loginButton.click();
            console.log('👆 点击登录按钮');

            // 等待登录完成
            await this.page.waitForTimeout(5000);

            // 验证登录成功
            const isLoggedIn = await this.checkLoginStatus();
            if (isLoggedIn) {
                console.log('✅ 登录成功');
                await this.saveCookies();
                return true;
            } else {
                throw new Error('登录失败，请检查凭据');
            }

        } catch (error) {
            console.error('❌ 自动登录失败:', error.message);
            throw error;
        }
    }

    /**
     * 发布单个文章到Medium
     * @param {string} articleUrl - 文章的GitHub Pages URL
     * @param {Object} articleInfo - 文章信息（标题、作者等）
     */
    async publishSingleArticle(articleUrl, articleInfo = {}) {
        console.log('📝 开始单文章发布流程...');
        console.log(`📄 文章URL: ${articleUrl}`);
        console.log(`📝 文章标题: ${articleInfo.title || '未知标题'}`);

        // 保存文章信息供后续使用
        this.currentArticleInfo = articleInfo;

        // 检查是否已发布
        if (this.publishedArticles.has(articleUrl)) {
            console.log('⏭️ 文章已发布，跳过');
            return {
                success: true,
                skipped: true,
                message: '文章已发布'
            };
        }

        // 使用相同的导入逻辑，但替换URL
        const originalRssUrl = this.config.rssUrl;
        this.config.rssUrl = articleUrl;

        try {
            const result = await this.importFromRSS();

            if (result.success && !result.skipped) {
                // 标记为已发布
                this.publishedArticles.add(articleUrl);
                await this.savePublishedArticles();
                console.log(`✅ 文章发布成功: ${articleInfo.title || articleUrl}`);
            }

            // 如果需要更新CSV状态，在这里处理
            if (this.shouldUpdateCSV && this.currentArticleInfo && this.currentArticleInfo.title) {
                try {
                    console.log('📝 更新CSV发布状态...');
                    const csvUpdater = require('./csvToBlog');
                    const csvManager = new csvUpdater({
                        inputFile: this.config.csvFile || '内容库_发布数据@zc_发布情况.csv'
                    });
                    await csvManager.updateArticleStatus(this.currentArticleInfo.title, '已发布');
                    console.log('✅ CSV状态更新成功');
                    this.shouldUpdateCSV = false; // 重置标志
                } catch (csvError) {
                    console.error('❌ CSV状态更新失败:', csvError.message);
                }
            }

            return result;
        } finally {
            // 恢复原始RSS URL
            this.config.rssUrl = originalRssUrl;
        }
    }

    /**
     * 访问Medium导入页面并执行导入
     */
    async importFromRSS() {
        console.log('📥 开始RSS导入流程...');

        try {
            // 访问导入页面
            console.log('🌐 访问Medium导入页面...');
            await this.page.goto('https://medium.com/p/import', {
                waitUntil: 'networkidle',
                timeout: this.config.timeout
            });

            await this.page.waitForTimeout(3000);

            // 检查是否需要重新登录
            const currentUrl = this.page.url();
            if (currentUrl.includes('signin') || currentUrl.includes('login')) {
                console.log('🔄 检测到需要重新登录');
                const isLoggedIn = await this.checkLoginStatus();
                if (!isLoggedIn) {
                    await this.login();
                    await this.page.goto('https://medium.com/p/import', { waitUntil: 'networkidle' });
                }
            }

            // 查找RSS URL输入区域 (富文本编辑器)
            console.log('🔍 查找RSS URL输入区域...');

            let urlInput = null;

            // 方法1: 使用提供的XPath
            try {
                urlInput = await this.page.$('//*[@id="editor_7"]/p/span');
                if (urlInput && await urlInput.isVisible()) {
                    console.log('✅ 通过XPath找到富文本编辑器: //*[@id="editor_7"]/p/span');
                }
            } catch (e) {
                console.log('⚠️ XPath选择器失败，尝试其他方法');
            }

            // 方法2: 通过编辑器ID模式匹配
            if (!urlInput) {
                const editorSelectors = [
                    '[id^="editor_"] p span',
                    '[id^="editor_"] span',
                    '[id^="editor_"] p',
                    '.editor p span',
                    '.editor span',
                    '[contenteditable="true"]',
                    '[data-testid*="editor"]'
                ];

                for (const selector of editorSelectors) {
                    try {
                        urlInput = await this.page.$(selector);
                        if (urlInput && await urlInput.isVisible()) {
                            console.log(`✅ 找到编辑器区域: ${selector}`);
                            break;
                        }
                    } catch (e) {
                        // 继续尝试下一个选择器
                    }
                }
            }

            // 方法3: 尝试通用的内容可编辑区域
            if (!urlInput) {
                const editableElements = await this.page.$$('[contenteditable="true"], [role="textbox"], .editor, [data-slate-editor="true"]');
                for (const element of editableElements) {
                    if (await element.isVisible()) {
                        urlInput = element;
                        console.log('✅ 找到可编辑区域');
                        break;
                    }
                }
            }

            if (!urlInput) {
                // 截图用于调试
                await this.page.screenshot({ path: 'debug_import_page.png' });
                console.log('📸 已保存页面截图: debug_import_page.png');
                throw new Error('无法找到RSS URL输入区域');
            }

            // 在富文本编辑器中输入RSS URL
            console.log(`📝 在富文本编辑器中输入RSS URL: ${this.config.rssUrl}`);

            // 使用重试机制来处理DOM更新
            let inputSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!inputSuccess && retryCount < maxRetries) {
                try {
                    // 重新查找元素以确保它仍然附加到DOM
                    if (retryCount > 0) {
                        console.log(`🔄 重试输入 (第${retryCount + 1}次)...`);
                        urlInput = await this.page.$('//*[@id="editor_7"]/p/span');
                        if (!urlInput) {
                            // 尝试其他选择器
                            const selectors = ['[id^="editor_"] p span', '[contenteditable="true"]'];
                            for (const selector of selectors) {
                                urlInput = await this.page.$(selector);
                                if (urlInput && await urlInput.isVisible()) break;
                            }
                        }
                    }

                    if (!urlInput) {
                        throw new Error('无法重新找到输入元素');
                    }

                    // 点击编辑器获得焦点
                    await urlInput.click();
                    await this.page.waitForTimeout(1500);

                    // 使用更稳定的JavaScript设置方法
                    const urlSet = await this.page.evaluate((url) => {
                        // 查找编辑器元素
                        const editor = document.querySelector('#editor_7 p span') ||
                            document.querySelector('[id^="editor_"] p span') ||
                            document.querySelector('[contenteditable="true"]');

                        if (editor) {
                            console.log('找到编辑器元素，开始设置URL');

                            // 清空现有内容
                            editor.textContent = '';
                            editor.innerHTML = '';
                            editor.innerText = '';

                            // 等待一下确保清空完成
                            setTimeout(() => {
                                // 设置新内容
                                editor.textContent = url;
                                editor.innerText = url;

                                // 创建文本节点并插入
                                while (editor.firstChild) {
                                    editor.removeChild(editor.firstChild);
                                }
                                const textNode = document.createTextNode(url);
                                editor.appendChild(textNode);

                                // 触发事件
                                ['focus', 'input', 'change', 'keydown', 'keyup', 'blur'].forEach(eventType => {
                                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                                    editor.dispatchEvent(event);
                                });

                                console.log('URL设置完成:', editor.textContent);
                            }, 100);

                            return url;
                        }
                        return null;
                    }, this.config.rssUrl);

                    if (!urlSet) {
                        throw new Error('JavaScript URL设置失败');
                    }

                    // 等待JavaScript完成
                    await this.page.waitForTimeout(1000);

                    // 使用更精准的键盘输入作为备用
                    await this.page.keyboard.press('Control+A');
                    await this.page.waitForTimeout(500);

                    // 逐字符慢速输入确保完整性
                    await this.page.keyboard.type(this.config.rssUrl, { delay: 100 });

                    // 验证输入是否成功
                    await this.page.waitForTimeout(1000);
                    const inputValue = await this.page.evaluate(() => {
                        const editor = document.querySelector('#editor_7 p span') ||
                            document.querySelector('[id^="editor_"] p span') ||
                            document.querySelector('[contenteditable="true"]');
                        return editor ? editor.textContent || editor.innerText : '';
                    });

                    if (inputValue.includes(this.config.rssUrl)) {
                        console.log('✅ 文章URL输入成功');
                        inputSuccess = true;
                    } else {
                        throw new Error(`输入验证失败，当前值: "${inputValue}"`);
                    }

                } catch (error) {
                    console.log(`⚠️ 输入尝试 ${retryCount + 1} 失败:`, error.message);
                    retryCount++;

                    if (retryCount < maxRetries) {
                        await this.page.waitForTimeout(2000); // 等待页面稳定
                    }
                }
            }

            if (!inputSuccess) {
                throw new Error(`RSS URL输入失败，已重试 ${maxRetries} 次`);
            }

            // 等待一下让页面响应
            await this.page.waitForTimeout(2000);

            // 查找并点击导入按钮
            console.log('🔍 查找导入按钮...');

            // 使用已验证有效的精确选择器
            const submitButton = await this.page.$('button[data-action="import-url"]');

            if (!submitButton || !await submitButton.isVisible() || !await submitButton.isEnabled()) {
                await this.page.screenshot({ path: 'debug_no_submit_button.png' });
                console.log('📸 已保存页面截图: debug_no_submit_button.png');
                throw new Error('无法找到或访问导入按钮');
            }

            console.log('✅ 找到导入按钮: button[data-action="import-url"]');

            // 点击导入按钮
            console.log('👆 点击导入按钮...');
            await submitButton.click();

            // 等待导入结果
            console.log('⏳ 等待导入处理...');
            await this.page.waitForTimeout(10000);

            // 检查导入结果
            const result = await this.checkImportResult();

            if (result.success) {
                console.log('✅ RSS导入成功');
                if (result.articlesCount > 0) {
                    console.log(`📚 导入了 ${result.articlesCount} 篇文章`);
                }

                // 如果在编辑页面，自动发布文章
                if (result.isEditPage) {
                    console.log('🚀 开始自动发布文章...');
                    const publishResult = await this.autoPublishArticle();
                    if (publishResult.success) {
                        console.log('✅ 文章发布成功');

                        // 标记需要更新CSV状态
                        this.shouldUpdateCSV = true;
                    } else {
                        console.log('❌ 文章发布失败:', publishResult.error);
                    }
                }

                // 记录导入成功
                this.publishedArticles.add(this.config.rssUrl);
                this.publishedArticles.add(`import_${new Date().toISOString()}`);
                await this.savePublishedArticles();

                return {
                    success: true,
                    importedCount: result.articlesCount,
                    message: 'RSS导入成功完成'
                };
            } else {
                console.log('❌ RSS导入失败');
                return {
                    success: false,
                    error: result.error || '导入过程中出现未知错误'
                };
            }

        } catch (error) {
            console.error('❌ RSS导入失败:', error.message);

            // 保存错误截图
            try {
                await this.page.screenshot({ path: 'debug_import_error.png' });
                console.log('📸 已保存错误截图: debug_import_error.png');
            } catch (e) {
                // 忽略截图错误
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 检查导入结果
     */
    async checkImportResult() {
        try {
            // 等待页面加载和可能的重定向
            await this.page.waitForTimeout(5000);

            const currentUrl = this.page.url();
            console.log(`🌐 当前页面: ${currentUrl}`);

            // 检查成功指示器
            const successIndicators = [
                ':has-text("imported successfully")',
                ':has-text("Successfully imported")',
                ':has-text("Import completed")',
                ':has-text("导入成功")',
                ':has-text("导入完成")',
                ':has-text("Imported the story")',
                ':has-text("imported the story")',
                ':has-text("Change your story")',
                ':has-text("Click Publish to share")',
                '.success',
                '.import-success',
                '[data-testid*="success"]'
            ];

            for (const selector of successIndicators) {
                const element = await this.page.$(selector);
                if (element) {
                    console.log(`✅ 找到成功指示器: ${selector}`);

                    // 尝试提取文章数量
                    const text = await element.textContent();
                    const countMatch = text.match(/(\d+)/);
                    const articlesCount = countMatch ? parseInt(countMatch[1]) : 1;

                    // 检查是否需要点击"See your story"按钮
                    await this.clickSeeYourStoryButton();

                    return { success: true, articlesCount, isEditPage: true };
                }
            }

            // 检查页面内容是否包含导入成功的文本
            const pageContent = await this.page.content();
            const successTexts = [
                'Imported the story',
                'imported the story',
                'Change your story as needed',
                'Click Publish to share',
                'See your story'
            ];

            for (const text of successTexts) {
                if (pageContent.includes(text)) {
                    console.log(`✅ 页面包含成功文本: "${text}"`);

                    // 检查是否需要点击"See your story"按钮
                    await this.clickSeeYourStoryButton();

                    return { success: true, articlesCount: 1, isEditPage: true };
                }
            }

            // 检查错误指示器
            const errorIndicators = [
                ':has-text("error")',
                ':has-text("failed")',
                ':has-text("Error")',
                ':has-text("Failed")',
                ':has-text("错误")',
                ':has-text("失败")',
                '.error',
                '.import-error',
                '[data-testid*="error"]'
            ];

            for (const selector of errorIndicators) {
                const element = await this.page.$(selector);
                if (element) {
                    const errorText = await element.textContent();
                    console.log(`❌ 找到错误指示器: ${errorText}`);
                    return { success: false, error: errorText };
                }
            }

            // 检查是否跳转到了编辑页面
            if (currentUrl.includes('/edit')) {
                console.log('✅ 页面跳转到编辑页面，导入成功');
                return { success: true, articlesCount: 1, isEditPage: true };
            }

            // 检查是否跳转到了文章列表或仪表板
            if (currentUrl.includes('/me/') || currentUrl.includes('/stories/') ||
                currentUrl.includes('/dashboard')) {
                console.log('✅ 页面跳转到仪表板，可能导入成功');
                return { success: true, articlesCount: 0 };
            }

            // 如果没有明确的指示器，返回不确定状态
            console.log('❓ 无法确定导入结果');
            return { success: false, error: '无法确定导入状态' };

        } catch (error) {
            console.error('⚠️ 检查导入结果时出错:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 点击"See your story"按钮进入编辑页面
     */
    async clickSeeYourStoryButton() {
        try {
            // 检查当前URL，如果已经在编辑页面就跳过
            const currentUrl = this.page.url();
            if (currentUrl.includes('/edit')) {
                console.log('✅ 已在编辑页面，无需点击"See your story"');
                return true;
            }

            console.log('🔍 尝试点击"See your story"按钮...');

            // 尝试多种"See your story"按钮选择器
            const seeStorySelectors = [
                'xpath=/html/body/div[5]/div/button', // 用户提供的XPath
                'button:has-text("See your story")',
                'button:has-text("查看你的故事")',
                '[data-testid="see-story-button"]',
                'button[aria-label*="story"]',
                '.see-story-button',
                'a:has-text("See your story")',
                'a:has-text("查看你的故事")',
                'button:visible'  // 通用可见按钮选择器
            ];

            let seeStoryClicked = false;

            // 尝试每个选择器
            for (const selector of seeStorySelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        // 检查按钮是否可见且可点击
                        const isVisible = await button.isVisible();
                        if (isVisible) {
                            console.log(`✅ 找到"See your story"按钮: ${selector}`);

                            // 滚动到按钮位置
                            await button.scrollIntoViewIfNeeded();
                            await this.page.waitForTimeout(1000);

                            // 点击按钮
                            await button.click();
                            console.log('👆 点击"See your story"按钮...');
                            seeStoryClicked = true;
                            break;
                        }
                    }
                } catch (error) {
                    // 继续尝试下一个选择器
                    console.log(`⚠️ 选择器 ${selector} 失败: ${error.message}`);
                }
            }

            if (seeStoryClicked) {
                // 等待页面跳转到编辑页面
                console.log('⏳ 等待页面跳转到编辑页面...');

                // 等待URL变化，最多等待15秒
                for (let i = 0; i < 15; i++) {
                    await this.page.waitForTimeout(1000);
                    const newUrl = this.page.url();
                    if (newUrl.includes('/edit')) {
                        console.log('✅ 成功跳转到编辑页面');
                        return true;
                    }
                }

                console.log('⚠️ 等待编辑页面跳转超时');
                return false;
            } else {
                console.log('❌ 未找到"See your story"按钮');
                return false;
            }

        } catch (error) {
            console.error('❌ 点击"See your story"按钮失败:', error.message);
            return false;
        }
    }

    /**
     * 自动发布文章
     */
    async autoPublishArticle() {
        try {
            console.log('📝 在编辑页面，开始自动发布...');

            // 等待页面完全加载
            await this.page.waitForTimeout(3000);

            // 尝试多种发布按钮选择器
            const publishButtonSelectors = [
                // 用户提供的XPath转换为CSS选择器（如果可能）
                '[data-testid="publish-button"]',
                'button:has-text("Publish")',
                'button:has-text("发布")',
                '[aria-label*="publish"]',
                '[aria-label*="发布"]',
                '.publish-button',
                'button[type="submit"]',
                // 通用发布按钮选择器
                'button:visible'
            ];

            let publishButton = null;

            // 尝试直接使用用户提供的XPath
            try {
                const userProvidedXPath = '//*[@id="_obv.shell._surface_1753237596298"]/div/div[2]/div[2]/div[2]/div[1]';
                publishButton = await this.page.$(`xpath=${userProvidedXPath}`);
                if (publishButton && await publishButton.isVisible()) {
                    console.log('✅ 找到发布按钮 (用户提供的XPath)');
                }
            } catch (e) {
                console.log('⚠️ 用户提供的XPath无效，尝试其他选择器...');
            }

            // 如果用户XPath无效，尝试其他选择器
            if (!publishButton) {
                for (const selector of publishButtonSelectors) {
                    try {
                        const elements = await this.page.$$(selector);
                        for (const element of elements) {
                            if (await element.isVisible()) {
                                const text = await element.textContent();
                                if (text && (text.toLowerCase().includes('publish') || text.includes('发布'))) {
                                    publishButton = element;
                                    console.log(`✅ 找到发布按钮: ${selector}`);
                                    break;
                                }
                            }
                        }
                        if (publishButton) break;
                    } catch (e) {
                        // 继续尝试下一个选择器
                    }
                }
            }

            if (!publishButton) {
                console.log('❌ 未找到发布按钮');
                return { success: false, error: '未找到发布按钮' };
            }

            // 点击发布按钮
            console.log('👆 点击发布按钮...');
            await publishButton.click();

            // 等待发布选项页面出现
            await this.page.waitForTimeout(3000);

            // 查找并点击"Publish Now"按钮
            console.log('🔍 查找"Publish Now"按钮...');

            const publishNowSelectors = [
                // 用户提供的XPath
                'xpath=/html/body/div[5]/div/div/div/div[2]/div[6]/div[1]/div/button/span',
                // 通用选择器
                'button:has-text("Publish now")',
                'button:has-text("立即发布")',
                'button:has-text("发布")',
                '[data-testid="publish-now"]',
                '[aria-label*="publish now"]',
                'button[type="submit"]:visible'
            ];

            let publishNowButton = null;

            for (const selector of publishNowSelectors) {
                try {
                    if (selector.startsWith('xpath=')) {
                        publishNowButton = await this.page.$(selector);
                    } else {
                        publishNowButton = await this.page.$(selector);
                    }

                    if (publishNowButton && await publishNowButton.isVisible()) {
                        console.log(`✅ 找到"Publish Now"按钮: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // 继续尝试下一个选择器
                }
            }

            if (!publishNowButton) {
                // 如果找不到特定按钮，尝试找任何可见的提交按钮
                const submitButtons = await this.page.$$('button:visible');
                for (const button of submitButtons) {
                    const text = await button.textContent();
                    if (text && (text.includes('Publish') || text.includes('发布') || text.includes('Submit'))) {
                        publishNowButton = button;
                        console.log(`✅ 找到可能的发布按钮: "${text}"`);
                        break;
                    }
                }
            }

            if (!publishNowButton) {
                console.log('❌ 未找到"Publish Now"按钮');
                return { success: false, error: '未找到"Publish Now"按钮' };
            }

            // 点击"Publish Now"按钮
            console.log('👆 点击"Publish Now"按钮...');
            await publishNowButton.click();

            // 等待发布完成
            console.log('⏳ 等待发布完成...');
            await this.page.waitForTimeout(5000);

            // 检查发布结果
            const currentUrl = this.page.url();
            console.log(`🌐 发布后页面: ${currentUrl}`);

            // 检查是否成功发布
            if (currentUrl.includes('/p/') && !currentUrl.includes('/edit')) {
                console.log('✅ 文章发布成功！');
                return { success: true, publishedUrl: currentUrl };
            } else {
                console.log('❓ 发布状态不确定');
                return { success: true, message: '发布可能成功，请手动确认' };
            }

        } catch (error) {
            console.error('❌ 自动发布失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 运行完整的发布流程
     */
    async run() {
        let retryCount = 0;
        const maxRetries = this.config.retries;

        while (retryCount < maxRetries) {
            try {
                console.log(`🎭 开始Medium Playwright发布流程 (尝试 ${retryCount + 1}/${maxRetries})...`);

                // 1. 启动浏览器
                await this.initBrowser();

                // 2. 尝试加载保存的cookies或设置Session Token
                let isLoggedIn = false;

                // 优先使用保存的cookies
                const cookiesLoaded = await this.loadCookies();
                if (cookiesLoaded) {
                    isLoggedIn = await this.checkLoginStatus();
                    if (isLoggedIn) {
                        console.log('✅ 使用保存的cookies成功登录');
                    }
                }

                // 如果cookies无效，尝试Session Token
                if (!isLoggedIn && this.config.sessionToken) {
                    await this.setSessionToken();
                    isLoggedIn = await this.checkLoginStatus();
                    if (isLoggedIn) {
                        console.log('✅ 使用Session Token成功登录');
                    }
                }

                // 3. 如果仍未登录，尝试自动登录
                if (!isLoggedIn) {
                    console.log('🔐 需要登录...');
                    if (this.config.email && this.config.password) {
                        await this.login();
                    } else {
                        throw new Error('登录失败：请先运行 pnpm run extract-cookies 手动登录并提取cookies，或设置MEDIUM_EMAIL和MEDIUM_PASSWORD');
                    }
                }

                // 4. 执行RSS导入
                const result = await this.importFromRSS();

                // 5. 清理资源
                await this.cleanup();

                if (result.success) {
                    console.log('🎉 Medium发布流程完成');
                    return {
                        success: true,
                        published: result.importedCount || 0,
                        skipped: 0,
                        method: 'RSS导入',
                        message: result.message
                    };
                } else {
                    throw new Error(result.error);
                }

            } catch (error) {
                console.error(`❌ 发布流程失败 (尝试 ${retryCount + 1}):`, error.message);

                await this.cleanup();

                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`🔄 将在5秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    console.error('❌ 所有重试都失败了');
                    return {
                        success: false,
                        error: error.message,
                        retries: maxRetries
                    };
                }
            }
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                console.log('🧹 浏览器资源已清理');
            }
        } catch (error) {
            console.error('⚠️ 清理资源时出错:', error.message);
        }
    }

    /**
     * 获取发布统计信息
     */
    async getPublishStats() {
        return {
            totalPublished: this.publishedArticles.size,
            lastUpdate: new Date().toISOString(),
            method: 'Playwright自动化',
            rssUrl: this.config.rssUrl
        };
    }
}

export default MediumPlaywrightPublisher; 