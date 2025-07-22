import fetch from 'node-fetch';
import fs from 'fs-extra';
import xml2js from 'xml2js';
import { format } from 'date-fns';

/**
 * Medium API发布器 - 增强版
 * 支持官方Integration Token和Session Cookie两种认证方式
 * Integration Token: 永久有效，更稳定
 * Session Cookie: 临时有效，需定期更新
 */
class MediumApiPublisher {
    constructor(options = {}) {
        this.rssUrl = options.rssUrl || 'http://localhost:8080/feed.xml';

        // 支持两种认证方式
        this.integrationToken = options.integrationToken || process.env.MEDIUM_INTEGRATION_TOKEN;
        this.sessionToken = options.sessionToken || process.env.MEDIUM_SESSION_TOKEN;
        this.userId = options.userId || process.env.MEDIUM_USER_ID;
        this.publishedFile = options.publishedFile || 'published_articles.json';

        // 根据可用的token选择API方式
        this.useOfficialApi = !!this.integrationToken;
        this.baseUrl = 'https://medium.com';
        this.apiUrl = this.useOfficialApi ? 'https://api.medium.com/v1' : 'https://medium.com/_/api';
        this.publishedArticles = new Set();

        // 根据认证方式设置请求头
        this.defaultHeaders = this.useOfficialApi ? {
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8',
            'Content-Type': 'application/json',
            'User-Agent': 'RSS-to-Medium-Publisher/1.0.0'
        } : {
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://medium.com',
            'Referer': 'https://medium.com/',
            'X-Requested-With': 'XMLHttpRequest'
        };

        this.loadPublishedArticles();

        // 打印使用的认证方式
        if (this.useOfficialApi) {
            console.log('🔑 使用官方Integration Token (永久有效)');
        } else if (this.sessionToken) {
            console.log('🍪 使用Session Cookie (需定期更新)');
        } else {
            console.log('❌ 未配置Medium认证信息');
        }
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
            console.error('加载已发布记录失败:', error.message);
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
     * 获取认证信息
     */
    getAuthHeaders() {
        if (!this.sessionToken && !this.integrationToken) {
            throw new Error('请设置MEDIUM_SESSION_TOKEN或MEDIUM_INTEGRATION_TOKEN环境变量');
        }

        const headers = { ...this.defaultHeaders };

        if (this.sessionToken) {
            headers['Cookie'] = `sid=${this.sessionToken}`;
            headers['Authorization'] = `Bearer ${this.sessionToken}`;
        } else if (this.integrationToken) {
            headers['Authorization'] = `Bearer ${this.integrationToken}`;
        }

        return headers;
    }

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        try {
            const response = await fetch(`${this.apiUrl}/users/self`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`获取用户信息失败: ${response.status}`);
            }

            const data = await response.json();
            this.userId = data.payload.user.id;
            console.log(`获取用户信息成功: ${data.payload.user.name} (${this.userId})`);

            return data.payload.user;
        } catch (error) {
            console.error('获取用户信息失败:', error.message);
            throw error;
        }
    }

    /**
     * 创建文章草稿
     */
    async createDraft(article) {
        try {
            const payload = {
                title: article.title,
                content: this.convertToMediumContent(article.content),
                contentFormat: 'markdown',
                tags: article.tags || [],
                publishStatus: 'draft',
                notifyFollowers: false
            };

            console.log(`创建文章草稿: ${article.title}`);

            const response = await fetch(`${this.apiUrl}/posts`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`创建草稿失败: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log(`✅ 文章草稿创建成功: ${data.payload.post.id}`);

            return data.payload.post;
        } catch (error) {
            console.error(`创建草稿失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 转换内容为Medium格式
     */
    convertToMediumContent(content) {
        // 清理和优化内容格式
        let processedContent = content
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // 添加Medium特定的格式
        processedContent = `${processedContent}\n\n---\n\n*本文由RSS自动发布系统生成*`;

        return processedContent;
    }

    /**
     * 获取RSS文章列表
     */
    async fetchRSSFeed() {
        try {
            console.log(`获取RSS Feed: ${this.rssUrl}`);

            const response = await fetch(this.rssUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'RSS-to-Medium-Publisher/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`RSS获取失败: ${response.status}`);
            }

            const xmlData = await response.text();
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(xmlData);

            const items = result.rss?.channel?.[0]?.item || [];
            console.log(`RSS解析成功，找到 ${items.length} 篇文章`);

            return items.map(item => ({
                title: item.title?.[0] || '无标题',
                content: item.description?.[0] || item['content:encoded']?.[0] || '',
                link: item.link?.[0] || '',
                pubDate: item.pubDate?.[0] || new Date().toISOString(),
                guid: item.guid?.[0]?._ || item.guid?.[0] || item.link?.[0],
                tags: item.category || []
            }));

        } catch (error) {
            console.error('RSS获取失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查文章是否已发布
     */
    isArticlePublished(article) {
        return this.publishedArticles.has(article.guid) ||
            this.publishedArticles.has(article.link) ||
            this.publishedArticles.has(article.title);
    }

    /**
     * 发布单篇文章
     */
    async publishArticle(article) {
        try {
            if (this.isArticlePublished(article)) {
                console.log(`跳过已发布文章: ${article.title}`);
                return { success: true, skipped: true };
            }

            console.log(`开始发布文章: ${article.title}`);

            // 创建草稿
            const post = await this.createDraft(article);

            // 标记为已发布
            this.publishedArticles.add(article.guid);
            this.publishedArticles.add(article.title);
            await this.savePublishedArticles();

            console.log(`✅ 文章发布成功: ${article.title}`);
            console.log(`📝 Medium草稿链接: https://medium.com/p/${post.id}/edit`);

            return {
                success: true,
                postId: post.id,
                editUrl: `https://medium.com/p/${post.id}/edit`
            };

        } catch (error) {
            console.error(`文章发布失败: ${article.title}`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 运行完整发布流程
     */
    async run() {
        try {
            console.log('开始RSS到Medium API发布流程...');

            // 检查认证
            if (!this.sessionToken && !this.integrationToken) {
                throw new Error(`
🔐 需要Medium认证信息:

1. 获取官方Integration Token:
   - 登录 https://medium.com/me/settings/account
   - 点击 "API Keys"
   - 点击 "Create New Token"
   - 复制生成的Token
   - 设置环境变量: MEDIUM_INTEGRATION_TOKEN=你的Token值

2. 获取Session Cookie (需定期更新):
   - 登录 https://medium.com
   - 打开开发者工具 (F12)
   - 转到 Application/Storage → Cookies → https://medium.com
   - 复制 'sid' cookie的值
   - 设置环境变量: MEDIUM_SESSION_TOKEN=你的sid值

或者在 .env 文件中添加:
MEDIUM_INTEGRATION_TOKEN=你的Token值
MEDIUM_SESSION_TOKEN=你的sid值
                `);
            }

            // 验证用户信息
            await this.getUserInfo();

            // 获取RSS文章
            const articles = await this.fetchRSSFeed();

            if (articles.length === 0) {
                console.log('RSS中没有找到文章');
                return { published: 0, skipped: 0, errors: 0 };
            }

            // 发布文章
            let published = 0;
            let skipped = 0;
            let errors = 0;

            for (const article of articles) {
                const result = await this.publishArticle(article);

                if (result.success) {
                    if (result.skipped) {
                        skipped++;
                    } else {
                        published++;
                    }
                } else {
                    errors++;
                }

                // 避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`\n📊 发布统计:`);
            console.log(`✅ 新发布: ${published} 篇`);
            console.log(`⏭️  跳过: ${skipped} 篇`);
            console.log(`❌ 失败: ${errors} 篇`);

            return { published, skipped, errors };

        } catch (error) {
            console.error('发布流程失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取发布统计
     */
    async getPublishStats() {
        return {
            totalPublished: this.publishedArticles.size,
            lastUpdate: new Date().toISOString()
        };
    }
}

export default MediumApiPublisher; 