#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import CsvToBlog from './csvToBlog.js';
import RSSGenerator from './rssGenerator.js';
import MediumPublisher from './mediumPublisher.js';
import MediumApiPublisher from './mediumApiPublisher.js';

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
        if (this.config.medium.publishMethod === 'api') {
            this.mediumPublisher = new MediumApiPublisher(this.config.medium);
            console.log('✅ 使用Medium API发布方式 (推荐)');
        } else {
            this.mediumPublisher = new MediumPublisher(this.config.medium);
            console.log('⚠️  使用浏览器发布方式 (可能需要手动干预)');
        }
    }

    /**
     * 判断是否应该以无头模式运行浏览器
     */
    shouldRunHeadless() {
        // 在以下情况下强制使用无头模式:
        // 1. 生产环境
        // 2. GitHub Actions环境 (CI=true)
        // 3. Linux服务器环境且没有DISPLAY
        // 4. 明确设置了HEADLESS=true

        if (process.env.HEADLESS === 'true') return true;
        if (process.env.HEADLESS === 'false') return false;
        if (process.env.NODE_ENV === 'production') return true;
        if (process.env.CI === 'true') return true;
        if (process.platform === 'linux' && !process.env.DISPLAY) return true;

        // 默认情况下，在开发环境使用有界面模式
        return false;
    }

    /**
     * 加载配置
     */
    loadConfig() {
        const defaultConfig = {
            blog: {
                inputFile: '内容库_发布数据@zc_发布情况.csv',
                outputDir: '_posts',
                siteDir: '_site',
                baseUrl: process.env.SITE_URL || 'https://yourblog.github.io',
                allowRepublish: process.env.ALLOW_REPUBLISH === 'true' || false
            },
            rss: {
                postsDir: '_posts',
                outputFile: 'feed.xml',
                title: process.env.BLOG_TITLE || '技术博客',
                description: process.env.BLOG_DESCRIPTION || 'Context Engineering and AI Development Blog',
                feed_url: process.env.RSS_URL || 'https://yourblog.github.io/feed.xml',
                site_url: process.env.SITE_URL || 'https://yourblog.github.io',
                author: process.env.BLOG_AUTHOR || 'Blog Author'
            },
            medium: {
                rssUrl: process.env.RSS_URL || 'http://localhost:8080/feed.xml',
                // 优先使用Integration Token (永久有效，最推荐)
                integrationToken: process.env.MEDIUM_INTEGRATION_TOKEN,
                // 备用Session Token (需定期更新)
                sessionToken: process.env.MEDIUM_SESSION_TOKEN,
                userId: process.env.MEDIUM_USER_ID,
                publishedFile: 'published_articles.json',
                // 传统浏览器方式配置 (最后备用)
                mediumEmail: process.env.MEDIUM_EMAIL,
                mediumPassword: process.env.MEDIUM_PASSWORD,
                headless: this.shouldRunHeadless(),
                // 发布方式选择: 'api' 或 'browser'
                publishMethod: process.env.MEDIUM_PUBLISH_METHOD || 'api'
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
     * 检查是否应该发布到Medium
     */
    shouldPublishToMedium() {
        return !!(this.config.medium.mediumEmail && this.config.medium.mediumPassword);
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
                config: this.config
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
                headless: true
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

# Medium登录信息
MEDIUM_EMAIL=your_email@example.com
MEDIUM_PASSWORD=your_password

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
                console.log('📤 仅发布到Medium\n');
                await system.runMediumPublishing();
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
  medium    仅发布到Medium
  status    检查系统状态
  config    生成示例配置文件
  help      显示此帮助信息

环境变量:
  MEDIUM_EMAIL     Medium登录邮箱
  MEDIUM_PASSWORD  Medium登录密码  
  SITE_URL         博客网站URL
  RSS_URL          RSS Feed URL
  BLOG_TITLE       博客标题
  BLOG_AUTHOR      博客作者

示例:
  npm start full      # 完整发布流程
  npm start blog      # 只生成博客
  npm start status    # 检查状态
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