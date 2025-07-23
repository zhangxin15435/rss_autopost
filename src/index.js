#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import CsvToBlog from './csvToBlog.js';
import RSSGenerator from './rssGenerator.js';
import MediumApiPublisher from './mediumApiPublisher.js';
import MediumPlaywrightPublisher from './mediumPlaywrightPublisher.js';

// 加载环境变量
dotenv.config();

/**
 * RSS到Medium发布系统主程序
 * 整合CSV解析、博客生成、RSS生成和Medium发布功能
 */
class RSSToMediumSystem {
    constructor() {
        this.config = this.loadConfig();
        this.csvToBlog = new CsvToBlog(this.config.blog);
        this.rssGenerator = new RSSGenerator(this.config.rss);

        // 根据配置选择Medium发布方式
        const publishMethod = this.config.medium.publishMethod || 'playwright';

        if (publishMethod === 'api') {
            // 使用Medium API发布方式
            this.mediumPublisher = new MediumApiPublisher(this.config.medium);
            console.log('✅ 使用Medium API发布方式');
        } else {
            // 使用Playwright自动化发布方式 (默认)
            this.mediumPublisher = new MediumPlaywrightPublisher(this.config.medium);
            console.log('✅ 使用Playwright自动化发布方式');
        }
    }



    /**
     * 加载配置
     */
    loadConfig() {
        const defaultConfig = {
            blog: {
                articlesDir: process.env.ARTICLES_DIR || 'articles',
                inputFile: process.env.CSV_FILE || path.join('articles', '内容库_发布数据@zc_发布情况 (2).csv'),
                outputDir: '_posts',
                siteDir: '_site',
                baseUrl: process.env.SITE_URL || 'https://zhangxin15435.github.io/rss_autopost',
                allowRepublish: process.env.ALLOW_REPUBLISH === 'true' || false
            },
            rss: {
                postsDir: '_posts',
                outputFile: 'feed.xml',
                title: process.env.BLOG_TITLE || '技术博客',
                description: process.env.BLOG_DESCRIPTION || 'Context Engineering and AI Development Blog',
                feed_url: process.env.RSS_URL || 'https://zhangxin15435.github.io/rss_autopost/feed.xml',
                site_url: process.env.SITE_URL || 'https://zhangxin15435.github.io/rss_autopost',
                author: process.env.BLOG_AUTHOR || 'Blog Author'
            },
            medium: {
                rssUrl: process.env.RSS_URL || 'https://zhangxin15435.github.io/rss_autopost/feed.xml',
                // 发布方式选择: 'playwright' (默认) 或 'api'
                publishMethod: process.env.MEDIUM_PUBLISH_METHOD || 'playwright',
                // Playwright方式的登录凭据
                email: process.env.MEDIUM_EMAIL,
                password: process.env.MEDIUM_PASSWORD,
                // API方式的认证信息
                integrationToken: process.env.MEDIUM_INTEGRATION_TOKEN,
                sessionToken: process.env.MEDIUM_SESSION_TOKEN,
                userId: process.env.MEDIUM_USER_ID,
                // 文章管理配置
                articlesDir: process.env.ARTICLES_DIR || 'articles',
                csvFile: process.env.CSV_FILE || path.join('articles', '内容库_发布数据@zc_发布情况 (2).csv'),
                deleteAfterPublish: process.env.DELETE_AFTER_PUBLISH === 'true' || false,
                // 通用配置
                publishedFile: 'published_articles.json',
                headless: process.env.MEDIUM_HEADLESS !== 'false', // 默认无头模式
                timeout: parseInt(process.env.MEDIUM_TIMEOUT) || 30000,
                retries: parseInt(process.env.MEDIUM_RETRIES) || 3
            }
        };

        // 尝试加载自定义配置文件
        const configFile = 'config.json';
        if (fs.existsSync(configFile)) {
            try {
                const customConfig = fs.readJsonSync(configFile);
                return this.mergeConfig(defaultConfig, customConfig);
            } catch (error) {
                console.warn('读取配置文件失败，使用默认配置:', error.message);
            }
        }

        return defaultConfig;
    }

    /**
     * 合并配置
     */
    mergeConfig(defaultConfig, customConfig) {
        const merged = { ...defaultConfig };
        Object.keys(customConfig).forEach(key => {
            if (typeof customConfig[key] === 'object' && !Array.isArray(customConfig[key])) {
                merged[key] = { ...merged[key], ...customConfig[key] };
            } else {
                merged[key] = customConfig[key];
            }
        });
        return merged;
    }

    /**
     * 运行完整流程：CSV → Blog → RSS → Medium
     */
    async runFullPipeline() {
        try {
            console.log('🚀 开始完整发布流程...\n');

            // 步骤1: CSV转换为博客文章
            console.log('📝 步骤1: 转换CSV到博客文章');
            const articleCount = await this.csvToBlog.convertCsvToBlog();

            if (articleCount === 0) {
                console.log('❌ 没有找到待发布的文章');
                return { success: false, message: '没有待发布的文章' };
            }

            console.log(`✅ 成功生成 ${articleCount} 篇博客文章\n`);

            // 步骤2: 生成RSS Feed
            console.log('📡 步骤2: 生成RSS Feed');
            const rssResult = await this.rssGenerator.generateRSS();
            console.log(`✅ RSS Feed已生成: ${rssResult.feedPath} (${rssResult.postsCount} 篇文章)\n`);

            // 验证RSS
            const isValidRSS = await this.rssGenerator.validateRSS();
            if (!isValidRSS) {
                throw new Error('RSS验证失败');
            }

            // 生成Atom feed
            await this.rssGenerator.generateAtomFeed();

            // 步骤3: 发布到Medium（可选）
            if (this.shouldPublishToMedium()) {
                console.log('📤 步骤3: 发布到Medium');
                const publishResult = await this.mediumPublisher.run();
                console.log(`✅ Medium发布完成: ${publishResult.published} 篇成功, ${publishResult.skipped} 篇跳过\n`);

                return {
                    success: true,
                    articles: articleCount,
                    rss: rssResult,
                    medium: publishResult
                };
            } else {
                console.log('⏭️  跳过Medium发布（未配置登录信息）\n');

                return {
                    success: true,
                    articles: articleCount,
                    rss: rssResult,
                    medium: { skipped: true }
                };
            }

        } catch (error) {
            console.error('❌ 发布流程失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 只运行CSV到RSS的流程
     */
    async runBlogGeneration() {
        try {
            console.log('📝 开始博客生成流程...\n');

            const articleCount = await this.csvToBlog.convertCsvToBlog();
            if (articleCount === 0) {
                console.log('❌ 没有找到待发布的文章');
                return { success: false, message: '没有待发布的文章' };
            }

            const rssResult = await this.rssGenerator.generateRSS();
            await this.rssGenerator.generateAtomFeed();

            console.log(`✅ 博客生成完成: ${articleCount} 篇文章, RSS: ${rssResult.feedPath}`);

            return {
                success: true,
                articles: articleCount,
                rss: rssResult
            };

        } catch (error) {
            console.error('❌ 博客生成失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 只运行Medium发布流程
     */
    async runMediumPublishing() {
        try {
            if (!this.shouldPublishToMedium()) {
                throw new Error('Medium登录信息未配置');
            }

            console.log('📤 开始Medium发布流程...\n');
            const publishResult = await this.mediumPublisher.run();

            console.log(`✅ Medium发布完成: ${publishResult.published} 篇成功`);
            return { success: true, medium: publishResult };

        } catch (error) {
            console.error('❌ Medium发布失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 发布单篇文章到Medium
     */
    async runSingleArticlePublishing() {
        try {
            if (!this.shouldPublishToMedium()) {
                throw new Error('Medium登录信息未配置');
            }

            console.log('📝 开始单文章发布流程...\n');

            // 获取下一篇待发布的文章
            const article = await this.csvToBlog.getNextUnpublishedArticle();
            if (!article) {
                console.log('📭 没有待发布的文章');
                return {
                    success: true,
                    message: '没有待发布的文章',
                    published: 0
                };
            }

            console.log(`📄 准备发布文章: ${article.title}`);

            // 确保文章已生成
            await this.csvToBlog.convertCsvToBlog();
            await this.rssGenerator.generateRSS();

            // 启动Medium发布器
            await this.mediumPublisher.initBrowser();

            // 尝试登录
            let isLoggedIn = false;
            const cookiesLoaded = await this.mediumPublisher.loadCookies();
            if (cookiesLoaded) {
                isLoggedIn = await this.mediumPublisher.checkLoginStatus();
            }

            if (!isLoggedIn && this.mediumPublisher.config.sessionToken) {
                await this.mediumPublisher.setSessionToken();
                isLoggedIn = await this.mediumPublisher.checkLoginStatus();
            }

            if (!isLoggedIn && this.mediumPublisher.config.email && this.mediumPublisher.config.password) {
                await this.mediumPublisher.login();
            }

            // 发布单篇文章
            const publishResult = await this.mediumPublisher.publishSingleArticle(article.url, article);

            // 清理资源
            await this.mediumPublisher.cleanup();

            if (publishResult.success && !publishResult.skipped) {
                // 更新CSV文件状态
                await this.csvToBlog.updateArticleStatus(article.title, '已发布');
                console.log(`✅ 文章发布成功: ${article.title}`);

                return {
                    success: true,
                    published: 1,
                    article: article.title,
                    url: article.url
                };
            } else if (publishResult.skipped) {
                console.log(`⏭️ 文章已发布，跳过: ${article.title}`);
                return {
                    success: true,
                    published: 0,
                    skipped: 1,
                    message: '文章已发布'
                };
            } else {
                throw new Error(publishResult.error || '发布失败');
            }

        } catch (error) {
            console.error('❌ 单文章发布失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 检查是否应该发布到Medium
     */
    shouldPublishToMedium() {
        const { publishMethod, integrationToken, sessionToken, email, password } = this.config.medium;

        if (publishMethod === 'api') {
            // API方式需要token
            return !!(integrationToken || sessionToken);
        } else {
            // Playwright方式需要邮箱密码或session token
            return !!(email && password) || !!sessionToken;
        }
    }

    /**
     * 获取系统状态
     */
    async getSystemStatus() {
        try {
            const csvExists = await fs.pathExists(this.config.blog.inputFile);
            const rssExists = await fs.pathExists(this.config.rss.outputFile);
            const postsDir = await fs.pathExists(this.config.blog.outputDir);

            let postsCount = 0;
            if (postsDir) {
                const files = await fs.readdir(this.config.blog.outputDir);
                postsCount = files.filter(f => f.endsWith('.md')).length;
            }

            const rssStats = await this.rssGenerator.getFeedStats();
            const mediumStats = await this.mediumPublisher.getPublishStats();

            return {
                csv: { exists: csvExists, path: this.config.blog.inputFile },
                posts: { count: postsCount, dir: this.config.blog.outputDir },
                rss: { exists: rssExists, stats: rssStats },
                medium: { configured: this.shouldPublishToMedium(), stats: mediumStats },
                config: {
                    blog: this.config.blog,
                    rss: this.config.rss,
                    medium: {
                        hasIntegrationToken: !!this.config.medium.integrationToken,
                        hasSessionToken: !!this.config.medium.sessionToken,
                        publishedFile: this.config.medium.publishedFile
                    }
                }
            };

        } catch (error) {
            console.error('获取系统状态失败:', error.message);
            return { error: error.message };
        }
    }

    /**
     * 生成示例配置文件
     */
    async generateSampleConfig() {
        const sampleConfig = {
            blog: {
                inputFile: "内容库_发布数据@zc_发布情况.csv",
                outputDir: "_posts",
                baseUrl: "https://yourusername.github.io"
            },
            rss: {
                title: "我的技术博客",
                description: "分享技术见解和开发经验",
                author: "Your Name",
                feed_url: "https://yourusername.github.io/feed.xml",
                site_url: "https://yourusername.github.io"
            },
            medium: {
                rssUrl: "https://yourusername.github.io/feed.xml",
                publishedFile: "published_articles.json",
                integrationToken: "your_token_here",
                sessionToken: "your_session_token_here"
            }
        };

        await fs.writeJson('config.sample.json', sampleConfig, { spaces: 2 });
        console.log('✅ 示例配置文件已生成: config.sample.json');
    }

    /**
     * 生成环境变量模板
     */
    async generateEnvTemplate() {
        const envTemplate = `# 博客配置
SITE_URL=https://yourusername.github.io
RSS_URL=https://yourusername.github.io/feed.xml
BLOG_TITLE=我的技术博客
BLOG_DESCRIPTION=分享技术见解和开发经验
BLOG_AUTHOR=Your Name

# Medium发布配置
# 发布方式选择: 'playwright' (默认) 或 'api'
MEDIUM_PUBLISH_METHOD=playwright

# Playwright自动化方式 (推荐)
MEDIUM_EMAIL=your_email@example.com
MEDIUM_PASSWORD=your_password
MEDIUM_HEADLESS=true
MEDIUM_TIMEOUT=30000
MEDIUM_RETRIES=3

# Medium API方式 (备用)
MEDIUM_INTEGRATION_TOKEN=your_integration_token_here
MEDIUM_SESSION_TOKEN=your_session_token_here
MEDIUM_USER_ID=your_user_id

# 运行环境
NODE_ENV=production
`;

        await fs.writeFile('.env.example', envTemplate, 'utf8');
        console.log('✅ 环境变量模板已生成: .env.example');
    }
}

/**
 * 命令行接口
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'full';

    const system = new RSSToMediumSystem();

    try {
        switch (command) {
            case 'full':
                console.log('🔄 运行完整发布流程\n');
                await system.runFullPipeline();
                break;

            case 'blog':
                console.log('📝 仅生成博客和RSS\n');
                await system.runBlogGeneration();
                break;

            case 'medium':
                console.log('📤 仅发布到Medium (完整RSS导入)\n');
                await system.runMediumPublishing();
                break;

            case 'single':
                console.log('📝 发布单篇文章到Medium\n');
                await system.runSingleArticlePublishing();
                break;

            case 'status':
                console.log('📊 系统状态检查\n');
                const status = await system.getSystemStatus();
                console.log(JSON.stringify(status, null, 2));
                break;

            case 'config':
                console.log('⚙️  生成配置文件\n');
                await system.generateSampleConfig();
                await system.generateEnvTemplate();
                break;

            case 'help':
            default:
                console.log(`
📚 RSS到Medium发布系统

使用方法:
  npm start [command]

命令:
  full      运行完整流程: CSV → Blog → RSS → Medium (默认)
  blog      仅生成博客和RSS
  medium    仅发布到Medium (完整RSS导入)
  single    发布单篇文章到Medium (推荐)
  status    检查系统状态
  config    生成示例配置文件
  help      显示此帮助信息

环境变量:
  MEDIUM_PUBLISH_METHOD    Medium发布方式: 'playwright' (默认) 或 'api'
  MEDIUM_EMAIL             Medium邮箱 (Playwright方式)
  MEDIUM_PASSWORD          Medium密码 (Playwright方式)
  MEDIUM_INTEGRATION_TOKEN Medium Integration Token (API方式)
  MEDIUM_SESSION_TOKEN     Medium Session Token (API/Playwright方式)
  MEDIUM_USER_ID           Medium用户ID (API方式)
  MEDIUM_HEADLESS          是否无头模式: true/false (默认true)
  MEDIUM_TIMEOUT           操作超时时间毫秒 (默认30000)
  MEDIUM_RETRIES           重试次数 (默认3)
  SITE_URL                 博客网站URL
  RSS_URL                  RSS Feed URL
  BLOG_TITLE               博客标题
  BLOG_AUTHOR              博客作者

示例:
  npm start single    # 发布单篇文章 (推荐)
  npm start blog      # 只生成博客
  npm start status    # 检查状态
  npm start full      # 完整发布流程
`);
                break;
        }
    } catch (error) {
        console.error('❌ 程序执行失败:', error.message);
        process.exit(1);
    }
}

// 如果是直接运行此文件
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const currentFile = path.resolve(__filename);
const scriptFile = path.resolve(process.argv[1]);

if (currentFile === scriptFile) {
    main();
}

export default RSSToMediumSystem; 