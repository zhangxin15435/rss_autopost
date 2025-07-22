import fs from 'fs-extra';
import RSS from 'rss';
import path from 'path';
import { format } from 'date-fns';
import matter from 'gray-matter';

/**
 * RSS Feed生成器
 * 从Jekyll博客文章生成标准的RSS 2.0 feed
 */
class RSSGenerator {
    constructor(options = {}) {
        this.postsDir = options.postsDir || '_posts';
        this.outputFile = options.outputFile || 'feed.xml';
        this.siteConfig = {
            title: options.title || '技术博客',
            description: options.description || 'Context Engineering and AI Development Blog',
            feed_url: options.feed_url || 'https://zhangxin15435.github.io/rss_autopost/feed.xml',
            site_url: options.site_url || 'https://zhangxin15435.github.io/rss_autopost',
            image_url: options.image_url || 'https://zhangxin15435.github.io/rss_autopost/assets/logo.png',
            author: options.author || 'Blog Author',
            managingEditor: options.managingEditor || 'zhangxin15435@gmail.com',
            webMaster: options.webMaster || 'zhangxin15435@gmail.com',
            copyright: options.copyright || `${new Date().getFullYear()} Blog. All rights reserved.`,
            language: options.language || 'zh-cn',
            categories: options.categories || ['Technology', 'AI', 'Development'],
            ttl: options.ttl || 60
        };
    }

    /**
     * 生成RSS Feed
     */
    async generateRSS() {
        try {
            console.log('开始生成RSS Feed...');

            // 读取所有博客文章
            const posts = await this.loadPosts();

            // 按日期排序（最新的在前）
            posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 创建RSS实例
            const feed = new RSS(this.siteConfig);

            // 添加文章到feed
            posts.forEach(post => {
                feed.item({
                    title: post.title,
                    description: this.generateDescription(post),
                    url: post.url,
                    guid: post.url,
                    categories: post.tags || [],
                    author: post.author || this.siteConfig.author,
                    date: post.date,
                    enclosure: post.image ? {
                        url: post.image,
                        type: 'image/jpeg'
                    } : undefined
                });
            });

            // 生成XML
            const xml = feed.xml({ indent: true });

            // 写入文件
            await fs.writeFile(this.outputFile, xml, 'utf8');

            console.log(`RSS Feed 已生成: ${this.outputFile}`);
            console.log(`包含 ${posts.length} 篇文章`);

            return {
                feedPath: this.outputFile,
                postsCount: posts.length,
                feedUrl: this.siteConfig.feed_url
            };

        } catch (error) {
            console.error('生成RSS Feed时出错:', error.message);
            throw error;
        }
    }

    /**
     * 加载所有博客文章
     */
    async loadPosts() {
        try {
            if (!await fs.pathExists(this.postsDir)) {
                console.warn(`文章目录不存在: ${this.postsDir}`);
                return [];
            }

            const files = await fs.readdir(this.postsDir);
            const markdownFiles = files.filter(file => file.endsWith('.md'));

            const posts = [];

            for (const file of markdownFiles) {
                try {
                    const post = await this.parsePost(file);
                    if (post && post.published !== false) {
                        posts.push(post);
                    }
                } catch (error) {
                    console.warn(`解析文章失败 ${file}:`, error.message);
                }
            }

            return posts;
        } catch (error) {
            console.error('加载文章时出错:', error.message);
            return [];
        }
    }

    /**
     * 解析单篇文章
     */
    async parsePost(filename) {
        try {
            const filepath = path.join(this.postsDir, filename);
            const content = await fs.readFile(filepath, 'utf8');

            // 使用gray-matter解析front matter
            const { data: frontMatter, content: markdownContent } = matter(content);

            // 从文件名提取日期（Jekyll格式：YYYY-MM-DD-title.md）
            const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
            if (!dateMatch) {
                console.warn(`文件名格式不正确: ${filename}`);
                return null;
            }

            const [, dateStr, slug] = dateMatch;
            const postDate = frontMatter.date ? new Date(frontMatter.date) : new Date(dateStr);

            // 生成文章URL
            const url = this.generatePostUrl(postDate, slug, frontMatter);

            return {
                title: frontMatter.title || slug.replace(/-/g, ' '),
                content: markdownContent,
                excerpt: frontMatter.excerpt || frontMatter.description || this.extractExcerpt(markdownContent),
                date: postDate,
                author: frontMatter.author,
                tags: frontMatter.tags || [],
                categories: frontMatter.categories || [],
                url: url,
                published: frontMatter.published,
                image: frontMatter.image || frontMatter.cover_image,
                slug: slug,
                filename: filename
            };

        } catch (error) {
            console.error(`解析文章失败 ${filename}:`, error.message);
            return null;
        }
    }

    /**
     * 生成文章URL
     */
    generatePostUrl(date, slug, frontMatter) {
        const year = format(date, 'yyyy');
        const month = format(date, 'MM');
        const day = format(date, 'dd');

        // 支持自定义permalink
        if (frontMatter.permalink) {
            return `${this.siteConfig.site_url}${frontMatter.permalink}`;
        }

        // 默认Jekyll格式
        return `${this.siteConfig.site_url}/${year}/${month}/${day}/${slug}/`;
    }

    /**
     * 生成文章描述
     */
    generateDescription(post) {
        // 优先使用 excerpt 或 description
        if (post.excerpt) {
            return this.cleanHtml(post.excerpt);
        }

        // 从内容中提取
        return this.extractExcerpt(post.content);
    }

    /**
     * 从内容中提取摘要
     */
    extractExcerpt(content) {
        // 移除markdown语法
        let cleaned = content
            .replace(/^#.+$/gm, '') // 移除标题
            .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
            .replace(/\[.*?\]\(.*?\)/g, '') // 移除链接
            .replace(/[*_`]/g, '') // 移除格式化字符
            .replace(/\n/g, ' ') // 换行转空格
            .replace(/\s+/g, ' ') // 多个空格合并
            .trim();

        // 截取前200个字符
        return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
    }

    /**
     * 清理HTML标签
     */
    cleanHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * 验证RSS Feed
     */
    async validateRSS() {
        try {
            if (!await fs.pathExists(this.outputFile)) {
                throw new Error(`RSS文件不存在: ${this.outputFile}`);
            }

            const xml = await fs.readFile(this.outputFile, 'utf8');

            // 基本的XML验证
            if (!xml.includes('<rss') || !xml.includes('</rss>')) {
                throw new Error('RSS格式不正确');
            }

            // 检查必要元素
            const requiredElements = ['<title>', '<description>', '<link>'];
            for (const element of requiredElements) {
                if (!xml.includes(element)) {
                    throw new Error(`缺少必要元素: ${element}`);
                }
            }

            console.log('RSS Feed 验证通过');
            return true;

        } catch (error) {
            console.error('RSS验证失败:', error.message);
            return false;
        }
    }

    /**
     * 生成Atom feed（额外支持）
     */
    async generateAtomFeed() {
        try {
            const posts = await this.loadPosts();
            posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            const updated = posts.length > 0 ? posts[0].date.toISOString() : new Date().toISOString();

            const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${this.siteConfig.title}</title>
  <link href="${this.siteConfig.site_url}"/>
  <link href="${this.siteConfig.feed_url.replace('feed.xml', 'atom.xml')}" rel="self"/>
  <updated>${updated}</updated>
  <id>${this.siteConfig.site_url}/</id>
  <author>
    <name>${this.siteConfig.author}</name>
  </author>
  <generator>Node.js RSS Generator</generator>

${posts.map(post => `  <entry>
    <title>${this.escapeXml(post.title)}</title>
    <link href="${post.url}"/>
    <updated>${post.date.toISOString()}</updated>
    <id>${post.url}</id>
    <content type="html">${this.escapeXml(post.content)}</content>
    <summary>${this.escapeXml(post.excerpt)}</summary>
    ${post.tags.map(tag => `<category term="${this.escapeXml(tag)}"/>`).join('\n    ')}
  </entry>`).join('\n\n')}
</feed>`;

            await fs.writeFile('atom.xml', atomXml, 'utf8');
            console.log('Atom Feed 已生成: atom.xml');

        } catch (error) {
            console.error('生成Atom Feed时出错:', error.message);
        }
    }

    /**
     * XML转义
     */
    escapeXml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * 获取Feed统计信息
     */
    async getFeedStats() {
        try {
            const posts = await this.loadPosts();
            const recentPosts = posts.filter(post => {
                const daysDiff = (new Date() - new Date(post.date)) / (1000 * 60 * 60 * 24);
                return daysDiff <= 30; // 最近30天
            });

            return {
                totalPosts: posts.length,
                recentPosts: recentPosts.length,
                lastUpdated: posts.length > 0 ? posts[0].date : null,
                feedUrl: this.siteConfig.feed_url,
                authors: [...new Set(posts.map(p => p.author).filter(Boolean))],
                tags: [...new Set(posts.flatMap(p => p.tags || []))]
            };
        } catch (error) {
            console.error('获取Feed统计信息失败:', error.message);
            return null;
        }
    }
}

export default RSSGenerator; 