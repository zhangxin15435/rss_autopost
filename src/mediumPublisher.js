import { chromium } from 'playwright';
import fs from 'fs-extra';
import xml2js from 'xml2js';
import fetch from 'node-fetch';
import { format } from 'date-fns';

/**
 * RSS到Medium发布器
 * 监控RSS feed并自动发布新文章到Medium
 */
class MediumPublisher {
    constructor(options = {}) {
        this.rssUrl = options.rssUrl || 'http://localhost:8080/feed.xml';
        this.mediumEmail = options.mediumEmail || process.env.MEDIUM_EMAIL;
        this.mediumPassword = options.mediumPassword || process.env.MEDIUM_PASSWORD;
        this.publishedFile = options.publishedFile || 'published_articles.json';
        this.headless = options.headless !== false;
        this.timeout = options.timeout || 30000;

        this.browser = null;
        this.page = null;
        this.publishedArticles = new Set();

        this.loadPublishedArticles();
    }

    /**
     * 加载已发布文章记录
     */
    async loadPublishedArticles() {
        try {
            if (await fs.pathExists(this.publishedFile)) {
                const data = await fs.readJson(this.publishedFile);
                this.publishedArticles = new Set(data.published || []);
                console.log(`加载了 ${this.publishedArticles.size} 条已发布记录`);
            }
        } catch (error) {
            console.warn('加载已发布记录失败:', error.message);
            this.publishedArticles = new Set();
        }
    }

    /**
     * 保存已发布文章记录
     */
    async savePublishedArticles() {
        try {
            const data = {
                published: Array.from(this.publishedArticles),
                lastUpdated: new Date().toISOString()
            };
            await fs.writeJson(this.publishedFile, data, { spaces: 2 });
        } catch (error) {
            console.error('保存已发布记录失败:', error.message);
        }
    }

    /**
     * 启动浏览器
     */
    async launchBrowser() {
        try {
            console.log('启动浏览器...');
            this.browser = await chromium.launch({
                headless: this.headless,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--no-sandbox'
                ]
            });

            const context = await this.browser.newContext({
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            this.page = await context.newPage();
            this.page.setDefaultTimeout(this.timeout);

            console.log('浏览器启动成功');
        } catch (error) {
            throw new Error(`浏览器启动失败: ${error.message}`);
        }
    }

    /**
     * 关闭浏览器
     */
    async closeBrowser() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            console.log('浏览器已关闭');
        } catch (error) {
            console.error('关闭浏览器时出错:', error.message);
        }
    }

    /**
     * 登录Medium
     */
    async loginToMedium() {
        try {
            console.log('开始登录Medium...');

            if (!this.mediumEmail || !this.mediumPassword) {
                throw new Error('请设置Medium登录凭据');
            }

            await this.page.goto('https://medium.com/m/signin');
            await this.page.waitForLoadState('networkidle');

            // 查找并填写邮箱
            const emailSelectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="email" i]'
            ];

            let emailInput = null;
            for (const selector of emailSelectors) {
                try {
                    emailInput = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (emailInput) break;
                } catch (e) {
                    continue;
                }
            }

            if (!emailInput) {
                throw new Error('未找到邮箱输入框');
            }

            await emailInput.fill(this.mediumEmail);
            await this.page.waitForTimeout(1000);

            // 点击继续按钮
            const continueButtons = [
                'button:has-text("Continue")',
                'button:has-text("Next")',
                'button[type="submit"]'
            ];

            for (const selector of continueButtons) {
                try {
                    const button = await this.page.locator(selector).first();
                    if (await button.isVisible()) {
                        await button.click();
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            await this.page.waitForTimeout(3000);

            // 查找并填写密码
            const passwordInput = await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
            await passwordInput.fill(this.mediumPassword);
            await this.page.waitForTimeout(1000);

            // 点击登录按钮
            const loginButtons = [
                'button:has-text("Sign in")',
                'button:has-text("Log in")',
                'button[type="submit"]'
            ];

            for (const selector of loginButtons) {
                try {
                    const button = await this.page.locator(selector).first();
                    if (await button.isVisible()) {
                        await button.click();
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // 等待登录完成
            await this.page.waitForTimeout(5000);

            // 验证登录状态
            const isLoggedIn = await this.checkLoginStatus();
            if (isLoggedIn) {
                console.log('Medium登录成功');
                return true;
            } else {
                throw new Error('登录验证失败');
            }

        } catch (error) {
            console.error('Medium登录失败:', error.message);
            return false;
        }
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        try {
            const indicators = [
                'a:has-text("Write")',
                '[data-testid="user-menu"]',
                '.avatar'
            ];

            for (const indicator of indicators) {
                try {
                    const element = await this.page.locator(indicator).first();
                    if (await element.isVisible({ timeout: 5000 })) {
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }

            // 检查URL
            const currentUrl = this.page.url();
            return !currentUrl.includes('/signin') && !currentUrl.includes('/login');

        } catch (error) {
            console.error('检查登录状态失败:', error.message);
            return false;
        }
    }

    /**
     * 获取RSS feed内容
     */
    async fetchRSSFeed() {
        try {
            console.log(`获取RSS feed: ${this.rssUrl}`);

            const response = await fetch(this.rssUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const xmlText = await response.text();
            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
            const result = await parser.parseStringPromise(xmlText);

            const items = result.rss?.channel?.item || [];
            const feedItems = Array.isArray(items) ? items : [items];

            console.log(`RSS feed包含 ${feedItems.length} 篇文章`);
            return feedItems;

        } catch (error) {
            console.error('获取RSS feed失败:', error.message);
            return [];
        }
    }

    /**
     * 发布文章到Medium
     */
    async publishArticleToMedium(article) {
        try {
            console.log(`开始发布文章: ${article.title}`);

            // 导航到写文章页面
            await this.page.goto('https://medium.com/new-story');
            await this.page.waitForLoadState('networkidle');
            await this.page.waitForTimeout(3000);

            // 查找标题输入框
            const titleSelectors = [
                '[data-testid="richTextTitle"]',
                '[placeholder*="Title" i]',
                'h1[contenteditable="true"]',
                '.graf--title'
            ];

            let titleInput = null;
            for (const selector of titleSelectors) {
                try {
                    titleInput = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (titleInput) break;
                } catch (e) {
                    continue;
                }
            }

            if (!titleInput) {
                throw new Error('未找到标题输入框');
            }

            // 输入标题
            await titleInput.click();
            await titleInput.fill(article.title);
            await this.page.waitForTimeout(1000);

            // 查找内容输入框
            const contentSelectors = [
                '[data-testid="richTextContent"]',
                '.section-content',
                '.graf--p',
                '[contenteditable="true"]:not(h1)'
            ];

            let contentInput = null;
            for (const selector of contentSelectors) {
                try {
                    const elements = await this.page.$$(selector);
                    for (const element of elements) {
                        if (await element.isVisible()) {
                            contentInput = element;
                            break;
                        }
                    }
                    if (contentInput) break;
                } catch (e) {
                    continue;
                }
            }

            if (!contentInput) {
                throw new Error('未找到内容输入框');
            }

            // 输入内容
            await contentInput.click();
            await this.page.waitForTimeout(500);

            // 处理内容格式
            const processedContent = this.processContentForMedium(article.description || article.content);
            await contentInput.fill(processedContent);
            await this.page.waitForTimeout(2000);

            // 添加标签（如果支持）
            await this.addTagsIfPossible(article);

            // 保存为草稿
            await this.saveDraft();

            console.log(`文章已保存为草稿: ${article.title}`);

            // 记录已发布
            this.publishedArticles.add(article.guid || article.link);
            await this.savePublishedArticles();

            return true;

        } catch (error) {
            console.error(`发布文章失败 "${article.title}":`, error.message);
            return false;
        }
    }

    /**
     * 处理内容格式以适配Medium
     */
    processContentForMedium(content) {
        if (!content) return '';

        // 清理HTML标签
        let processed = content.replace(/<[^>]*>/g, '');

        // 处理特殊字符
        processed = processed.replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        // 添加段落分隔
        processed = processed.replace(/\n\s*\n/g, '\n\n');

        // 限制长度
        if (processed.length > 2000) {
            processed = processed.substring(0, 2000) + '...\n\n[阅读原文请访问我们的博客]';
        }

        return processed.trim();
    }

    /**
     * 添加标签（如果可能）
     */
    async addTagsIfPossible(article) {
        try {
            // 尝试查找标签输入或添加标签的按钮
            const tagSelectors = [
                '[data-testid="tag-input"]',
                'input[placeholder*="tag" i]',
                'button:has-text("Add tag")'
            ];

            for (const selector of tagSelectors) {
                try {
                    const element = await this.page.locator(selector).first();
                    if (await element.isVisible({ timeout: 2000 })) {
                        // 这里可以添加标签逻辑
                        console.log('找到标签输入，暂不实现');
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (error) {
            console.log('添加标签时出错:', error.message);
        }
    }

    /**
     * 保存草稿
     */
    async saveDraft() {
        try {
            // 使用快捷键保存
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('s');
            await this.page.keyboard.up('Control');
            await this.page.waitForTimeout(2000);

            // 或者查找保存按钮
            const saveSelectors = [
                'button:has-text("Save")',
                '[data-testid="save-button"]',
                '.save-button'
            ];

            for (const selector of saveSelectors) {
                try {
                    const button = await this.page.locator(selector).first();
                    if (await button.isVisible({ timeout: 1000 })) {
                        await button.click();
                        await this.page.waitForTimeout(1000);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            console.log('草稿已保存');
        } catch (error) {
            console.log('保存草稿时出错:', error.message);
        }
    }

    /**
     * 检查文章是否已发布
     */
    isArticlePublished(article) {
        const guid = article.guid || article.link;
        return this.publishedArticles.has(guid);
    }

    /**
     * 运行发布流程
     */
    async run() {
        try {
            console.log('开始RSS到Medium发布流程...');

            // 启动浏览器
            await this.launchBrowser();

            // 登录Medium
            const loginSuccess = await this.loginToMedium();
            if (!loginSuccess) {
                throw new Error('Medium登录失败');
            }

            // 获取RSS feed
            const articles = await this.fetchRSSFeed();
            if (articles.length === 0) {
                console.log('RSS feed中没有文章');
                return { published: 0, skipped: 0 };
            }

            // 筛选未发布的文章
            const newArticles = articles.filter(article => !this.isArticlePublished(article));
            console.log(`找到 ${newArticles.length} 篇新文章待发布`);

            let publishedCount = 0;
            let skippedCount = 0;

            // 发布新文章
            for (const article of newArticles.slice(0, 3)) { // 限制每次最多发布3篇
                const success = await this.publishArticleToMedium(article);
                if (success) {
                    publishedCount++;
                    console.log(`✓ 发布成功: ${article.title}`);
                } else {
                    skippedCount++;
                    console.log(`✗ 发布失败: ${article.title}`);
                }

                // 间隔时间，避免被限制
                await this.page.waitForTimeout(5000);
            }

            console.log(`发布完成: ${publishedCount} 篇成功, ${skippedCount} 篇失败`);

            return {
                published: publishedCount,
                skipped: skippedCount,
                total: newArticles.length
            };

        } catch (error) {
            console.error('发布流程出错:', error.message);
            throw error;
        } finally {
            await this.closeBrowser();
        }
    }

    /**
     * 获取发布统计
     */
    async getPublishStats() {
        return {
            totalPublished: this.publishedArticles.size,
            publishedList: Array.from(this.publishedArticles),
            lastRun: new Date().toISOString()
        };
    }
}

export default MediumPublisher; 