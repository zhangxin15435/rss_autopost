import fs from 'fs-extra';
import csv from 'csv-parser';
import path from 'path';
import { format } from 'date-fns';
import slugify from 'slugify';
import iconv from 'iconv-lite';
import { Readable } from 'stream';

/**
 * CSV到博客文章转换器
 * 将CSV数据转换为Jekyll格式的markdown文章
 */
class CsvToBlog {
    constructor(options = {}) {
        this.options = options;  // 保存完整的options对象
        this.inputFile = options.inputFile || '内容库_发布数据@zc_发布情况.csv';
        this.outputDir = options.outputDir || '_posts';
        this.siteDir = options.siteDir || '_site';
        this.baseUrl = options.baseUrl || 'https://yourblog.github.io';

        // 确保输出目录存在
        this.ensureDirectories();
    }

    /**
     * 确保必要的目录存在
     */
    async ensureDirectories() {
        await fs.ensureDir(this.outputDir);
        await fs.ensureDir(this.siteDir);
        await fs.ensureDir('assets/images');
    }

    /**
     * 处理CSV文件并生成博客文章
     */
    async convertCsvToBlog() {
        try {
            console.log('开始转换CSV到博客文章...');

            const articles = await this.parseCSV();
            const publishableArticles = this.filterPublishableArticles(articles);

            console.log(`找到 ${publishableArticles.length} 篇待发布文章`);

            for (const article of publishableArticles) {
                await this.createBlogPost(article);
            }

            // 生成Jekyll配置文件
            await this.generateJekyllConfig();

            // 生成首页
            await this.generateIndex();

            console.log('博客文章生成完成！');
            return publishableArticles.length;

        } catch (error) {
            console.error('转换过程中出错:', error.message);
            throw error;
        }
    }

    /**
     * 解析CSV文件
     */
    async parseCSV() {
        return new Promise((resolve, reject) => {
            const articles = [];

            if (!fs.existsSync(this.inputFile)) {
                reject(new Error(`CSV文件不存在: ${this.inputFile}`));
                return;
            }

            // 读取文件的原始buffer，然后转换编码
            const buffer = fs.readFileSync(this.inputFile);
            let content = '';

            // 尝试检测编码并转换
            try {
                // 首先尝试UTF-8
                content = buffer.toString('utf8');
                if (content.includes('�')) {
                    // 如果有乱码，尝试GBK
                    content = iconv.decode(buffer, 'gbk');
                }
            } catch (error) {
                // 如果转换失败，使用GBK
                content = iconv.decode(buffer, 'gbk');
            }

            // 使用转换后的内容创建流
            Readable.from([content])
                .pipe(csv())
                .on('data', (row) => {
                    const article = this.processArticleData(row);
                    if (article) {
                        articles.push(article);
                    }
                })
                .on('end', () => {
                    console.log(`成功解析 ${articles.length} 条记录`);
                    resolve(articles);
                })
                .on('error', (error) => {
                    reject(new Error(`CSV解析错误: ${error.message}`));
                });
        });
    }

    /**
     * 处理单篇文章数据
     */
    processArticleData(row) {
        try {
            // 清理和提取数据
            const title = this.cleanText(row['主题'] || '');
            const content = this.cleanText(row['发布内容'] || '');
            const author = this.cleanText(row['提出人'] || '');
            const tags = this.parseTags(row['标签'] || '');
            const status = row['发布'] || '';
            const channels = row['渠道&账号'] || '';
            const completed = row['发布完成'] || '';

            // 验证必要字段
            if (!title || !content) {
                console.warn('跳过无效文章：缺少标题或内容');
                return null;
            }

            return {
                title,
                content,
                author,
                tags,
                status,
                channels,
                completed,
                slug: this.generateSlug(title),
                date: new Date(),
                originalRow: row
            };
        } catch (error) {
            console.error('处理文章数据时出错:', error.message);
            return null;
        }
    }

    /**
     * 筛选可发布的文章
     */
    filterPublishableArticles(articles) {
        return articles.filter(article => {
            const status = article.status;
            const channels = article.channels.toLowerCase();
            const completed = article.completed;

            // 检查是否进入发布流程且渠道包含medium
            const isInWorkflow = status.includes('进入发布流程');
            const hasMediumChannel = channels.includes('medium');

            // 如果设置了允许重新发布，忽略完成状态；否则只发布未完成的
            const shouldPublish = this.options.allowRepublish ?
                (completed !== '是' || true) :  // 允许重新发布时忽略完成状态
                completed !== '是';              // 正常情况下只发布未完成的

            if (this.options.allowRepublish && isInWorkflow && hasMediumChannel) {
                console.log(`✅ 测试模式: 包含文章 "${article.title.substring(0, 50)}..."`);
            }

            return isInWorkflow && hasMediumChannel && shouldPublish;
        });
    }

    /**
     * 创建单篇博客文章
     */
    async createBlogPost(article) {
        try {
            const dateStr = format(article.date, 'yyyy-MM-dd');
            const filename = `${dateStr}-${article.slug}.md`;
            const filepath = path.join(this.outputDir, filename);

            // 生成Front Matter
            const frontMatter = this.generateFrontMatter(article);

            // 处理文章内容
            const processedContent = this.processContent(article.content);

            // 组合完整的markdown内容
            const markdownContent = `---
${frontMatter}
---

${processedContent}
`;

            await fs.writeFile(filepath, markdownContent, 'utf8');
            console.log(`创建文章: ${filename}`);

            return {
                filename,
                filepath,
                url: `${this.baseUrl}/${dateStr.replace(/-/g, '/')}/${article.slug}/`
            };

        } catch (error) {
            console.error(`创建文章失败 "${article.title}":`, error.message);
            throw error;
        }
    }

    /**
     * 生成Jekyll Front Matter
     */
    generateFrontMatter(article) {
        const dateStr = format(article.date, 'yyyy-MM-dd HH:mm:ss xxxx');

        return `layout: post
title: "${article.title.replace(/"/g, '\\"')}"
date: ${dateStr}
author: "${article.author}"
tags: [${article.tags.map(tag => `"${tag}"`).join(', ')}]
categories: ["blog"]
description: "${this.generateDescription(article.content)}"
excerpt: "${this.generateExcerpt(article.content)}"
published: true`;
    }

    /**
     * 处理文章内容
     */
    processContent(content) {
        // 基本的markdown格式化
        let processed = content;

        // 处理段落
        processed = processed.replace(/\n\n+/g, '\n\n');

        // 处理特殊字符
        processed = processed.replace(/"/g, '"').replace(/"/g, '"');
        processed = processed.replace(/'/g, "'").replace(/'/g, "'");

        // 添加更多段落分隔
        processed = processed.replace(/([。！？])\s*([A-Za-z\u4e00-\u9fa5])/g, '$1\n\n$2');

        return processed.trim();
    }

    /**
     * 生成文章描述
     */
    generateDescription(content) {
        const cleaned = content.replace(/[""'']/g, '').replace(/\n/g, ' ');
        return cleaned.length > 150 ? cleaned.substring(0, 150) + '...' : cleaned;
    }

    /**
     * 生成文章摘要
     */
    generateExcerpt(content) {
        const cleaned = content.replace(/[""'']/g, '').replace(/\n/g, ' ');
        return cleaned.length > 80 ? cleaned.substring(0, 80) + '...' : cleaned;
    }

    /**
     * 生成Jekyll配置文件
     */
    async generateJekyllConfig() {
        const config = `# Jekyll 配置文件
title: "技术博客"
description: "Context Engineering and AI Development Blog"
baseurl: ""
url: "${this.baseUrl}"

# 构建设置
markdown: kramdown
highlighter: rouge
permalink: /:year/:month/:day/:title/

# 插件
plugins:
  - jekyll-feed
  - jekyll-sitemap
  - jekyll-seo-tag

# RSS Feed 设置
feed:
  path: feed.xml
  posts_limit: 20

# 排除文件
exclude:
  - node_modules
  - package.json
  - README.md
  - src/

# 集合设置
collections:
  posts:
    output: true
    permalink: /:year/:month/:day/:title/

# 默认值
defaults:
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
      show_excerpts: true
`;

        await fs.writeFile('_config.yml', config, 'utf8');
        console.log('生成Jekyll配置文件');
    }

    /**
     * 生成首页
     */
    async generateIndex() {
        const indexContent = `---
layout: default
title: "技术博客首页"
---

# 最新文章

{% for post in site.posts limit:10 %}
  <article>
    <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
    <p>{{ post.excerpt }}</p>
    <p><small>发布时间: {{ post.date | date: "%Y年%m月%d日" }} | 作者: {{ post.author }}</small></p>
    <p>标签: {% for tag in post.tags %}<span class="tag">{{ tag }}</span>{% endfor %}</p>
  </article>
  <hr>
{% endfor %}

## RSS订阅

<a href="{{ site.url }}/feed.xml">订阅RSS</a>
`;

        await fs.writeFile('index.md', indexContent, 'utf8');
        console.log('生成首页文件');
    }

    /**
     * 工具方法：清理文本
     */
    cleanText(text) {
        if (!text) return '';
        return text.toString().trim();
    }

    /**
     * 工具方法：解析标签
     */
    parseTags(tagsStr) {
        if (!tagsStr) return ['技术', 'AI'];

        return tagsStr.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .slice(0, 5);
    }

    /**
     * 工具方法：生成URL友好的slug
     */
    generateSlug(title) {
        // 先尝试提取英文部分
        const englishMatch = title.match(/([A-Za-z\s:]+)/);
        if (englishMatch) {
            return slugify(englishMatch[1], {
                lower: true,
                strict: true,
                remove: /[*+~.()'"!:@]/g
            });
        }

        // 如果没有英文，使用拼音或者时间戳
        return `post-${Date.now()}`;
    }
}

export default CsvToBlog; 