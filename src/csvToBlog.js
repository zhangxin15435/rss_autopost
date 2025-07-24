import fs from 'fs-extra';
import csv from 'csv-parser';
import path from 'path';
import { format } from 'date-fns';
import slugify from 'slugify';
import iconv from 'iconv-lite';
import { Readable } from 'stream';

/**
 * CSV到博客文章转换器 - 支持 /articles 目录架构
 * 从 /articles 目录读取 CSV 文件和对应的 Markdown 文件
 */
class CsvToBlog {
    constructor(options = {}) {
        this.options = options;  // 保存完整的options对象
        this.articlesDir = options.articlesDir || 'articles';  // 新的文章目录
        this.inputFile = options.inputFile || path.join(this.articlesDir, 'articles.csv');  // 从 articles 目录读取
        this.outputDir = options.outputDir || '_posts';
        this.siteDir = options.siteDir || '_site';
        this.baseUrl = options.baseUrl || 'https://yourblog.github.io';

        // 确保必要的目录存在
        this.ensureDirectories();
    }

    /**
     * 确保必要的目录存在
     */
    async ensureDirectories() {
        await fs.ensureDir(this.outputDir);
        await fs.ensureDir(this.siteDir);
        await fs.ensureDir(this.articlesDir);
        await fs.ensureDir('assets/images');
    }

    /**
     * 处理CSV文件并生成博客文章
     */
    async convertCsvToBlog() {
        try {
            console.log('开始转换CSV到博客文章...');
            console.log(`📂 从目录读取: ${this.articlesDir}`);

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
     * 解析CSV文件 - 支持新的文件架构
     */
    async parseCSV() {
        return new Promise((resolve, reject) => {
            const articles = [];

            if (!fs.existsSync(this.inputFile)) {
                reject(new Error(`CSV文件不存在: ${this.inputFile}`));
                return;
            }

            console.log(`📄 读取CSV文件: ${this.inputFile}`);

            // 直接读取UTF-8编码的CSV文件
            const content = fs.readFileSync(this.inputFile, 'utf8');

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
                    console.error('CSV解析错误:', error.message);
                    reject(error);
                });
        });
    }

    /**
 * 处理单条文章数据 - 支持从 Markdown 文件读取内容
 */
    processArticleData(row) {
        try {
            // 提取基本信息（适配实际的CSV字段名）
            const title = this.cleanText(row['title'] || row['主题'] || '');
            const author = this.cleanText(row['提出人'] || '');
            const tags = this.parseTags(row['标签'] || '');
            const mdFileName = this.cleanText(row['发布内容'] || '');  // 现在这个字段存储的是 md 文件名

            if (!title.trim()) {
                console.warn('⚠️ 跳过标题为空的行');
                return null;
            }

            if (!mdFileName.trim()) {
                console.warn(`⚠️ 文章"${title}"缺少Markdown文件名`);
                return null;
            }

            // 读取 Markdown 文件内容
            const content = this.readMarkdownFile(mdFileName, title);

            if (!content) {
                console.warn(`⚠️ 无法读取文章"${title}"的内容文件: ${mdFileName}`);
                return null;
            }

            // 返回标准化的数据结构
            return {
                // 兼容中文字段名
                '主题': title,
                '发布内容': mdFileName,  // 存储文件名而不是内容
                '提出人': author,
                '标签': row['标签'] || '',
                '发布': row['发布'] || '',
                '渠道&账号': row['渠道&账号'] || '',
                '发布完成': row['发布完成'] || '',

                // 兼容英文字段名
                title,
                content,  // 从文件读取的实际内容
                author,
                tags,
                status: row['发布'] || '',
                channels: row['渠道&账号'] || '',
                completed: row['发布完成'] || '',
                mdFileName,  // 新增：存储md文件名

                // 其他字段
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
     * 从 Markdown 文件读取内容
     */
    readMarkdownFile(mdFileName, articleTitle) {
        try {
            // 确保文件名有 .md 扩展名
            const fileName = mdFileName.endsWith('.md') ? mdFileName : `${mdFileName}.md`;
            const filePath = path.join(this.articlesDir, fileName);

            if (!fs.existsSync(filePath)) {
                console.error(`❌ Markdown文件不存在: ${filePath}`);
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`📖 读取文章内容: ${fileName} (${content.length} 字符)`);

            return content;
        } catch (error) {
            console.error(`❌ 读取Markdown文件失败 "${mdFileName}":`, error.message);
            return null;
        }
    }

    /**
     * 筛选可发布的文章
     */
    filterPublishableArticles(articles) {
        return articles.filter(article => {
            // 使用实际的CSV字段名
            const status = article.发布 || '';
            const channels = (article['渠道&账号'] || '').toLowerCase();
            const completed = article.发布完成 || '';
            const subject = article.title || article.主题 || '';  // 先尝试title，再尝试主题
            const mdFileName = article.mdFileName || '';

            // 检查是否进入发布流程且渠道包含medium
            const isInWorkflow = status.includes('进入发布流程');
            const hasMediumChannel = channels.includes('medium');
            const hasValidSubject = subject.trim().length > 0;
            const hasValidMdFile = mdFileName.trim().length > 0;

            // 如果设置了允许重新发布，忽略完成状态；否则只发布未完成的
            const shouldPublish = this.options.allowRepublish ?
                (completed !== '已发布') :  // 允许重新发布时检查是否已发布
                completed !== '已发布';     // 正常情况下只发布未发布的

            if (this.options.allowRepublish && isInWorkflow && hasMediumChannel && hasValidSubject && hasValidMdFile) {
                console.log(`✅ 测试模式: 包含文章 "${subject.substring(0, 50)}..."`);
            }

            const result = isInWorkflow && hasMediumChannel && shouldPublish && hasValidSubject && hasValidMdFile;

            if (result) {
                console.log(`📄 找到可发布文章: ${subject.substring(0, 50)}... (${mdFileName})`);
            }

            return result;
        });
    }

    /**
     * 删除已发布的文章文件和CSV行
     */
    async deletePublishedArticle(articleTitle) {
        try {
            console.log(`🗑️ 开始删除已发布文章: ${articleTitle}`);

            // 1. 读取当前CSV数据
            const csvData = await this.parseCSV();

            // 2. 找到要删除的文章
            let deletedArticle = null;
            const remainingData = csvData.filter(article => {
                if (article.title === articleTitle || article.主题 === articleTitle) {
                    deletedArticle = article;
                    return false; // 不包含在剩余数据中
                }
                return true; // 保留其他文章
            });

            if (!deletedArticle) {
                console.warn(`⚠️ 未找到要删除的文章: ${articleTitle}`);
                return false;
            }

            // 3. 删除对应的 Markdown 文件
            const mdFileName = deletedArticle.mdFileName;
            if (mdFileName) {
                const fileName = mdFileName.endsWith('.md') ? mdFileName : `${mdFileName}.md`;
                const filePath = path.join(this.articlesDir, fileName);

                if (fs.existsSync(filePath)) {
                    await fs.remove(filePath);
                    console.log(`✅ 已删除Markdown文件: ${fileName}`);
                } else {
                    console.warn(`⚠️ Markdown文件不存在: ${fileName}`);
                }
            }

            // 4. 更新CSV文件（写入剩余数据）
            await this.writeCSV(remainingData);
            console.log(`✅ 已从CSV中删除文章记录: ${articleTitle}`);

            return true;

        } catch (error) {
            console.error(`❌ 删除文章失败 "${articleTitle}":`, error.message);
            return false;
        }
    }

    /**
     * 更新文章发布状态
     */
    async updateArticleStatus(articleTitle, status = '已发布') {
        try {
            console.log(`📝 更新文章发布状态: ${articleTitle} -> ${status}`);

            // 读取当前CSV文件
            const csvData = await this.parseCSV();

            // 找到对应文章并更新状态
            let updated = false;
            for (const article of csvData) {
                if (article.title === articleTitle || article.主题 === articleTitle) {
                    article.发布完成 = status;
                    article['发布完成'] = status; // 确保中文字段也更新
                    updated = true;
                    console.log(`✅ 文章状态已更新: ${articleTitle}`);
                    break;
                }
            }

            if (!updated) {
                console.warn(`⚠️ 未找到匹配的文章: ${articleTitle}`);
                return false;
            }

            // 写回CSV文件
            await this.writeCSV(csvData);
            return true;

        } catch (error) {
            console.error('❌ 更新文章状态失败:', error.message);
            return false;
        }
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
        let processed = content;

        // 🔧 修复：移除原始内容中的YAML front matter
        // 检测以 --- 开头的front matter并移除
        const frontMatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
        if (frontMatterRegex.test(processed)) {
            processed = processed.replace(frontMatterRegex, '');
            console.log('🧹 移除了原始内容中的YAML front matter');
        }

        // 移除多余的分隔线和空行
        processed = processed.replace(/^-{3,}\s*\n/gm, '');
        
        // 基本的markdown格式化
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
        // 使用处理后的内容（已移除YAML front matter）
        const processedContent = this.processContent(content);
        
        // 提取第一段作为描述，跳过标题
        const paragraphs = processedContent.split('\n\n');
        let description = '';
        
        for (const paragraph of paragraphs) {
            const cleaned = paragraph.trim()
                .replace(/^#{1,6}\s+/, '') // 移除markdown标题
                .replace(/[""'']/g, '')
                .replace(/\n/g, ' ');
            
            if (cleaned.length > 10 && !cleaned.match(/^[>\-\*\+]/)) { // 排除引用和列表
                description = cleaned;
                break;
            }
        }
        
        return description.length > 150 ? description.substring(0, 150) + '...' : description;
    }

    /**
     * 生成文章摘要
     */
    generateExcerpt(content) {
        // 使用处理后的内容（已移除YAML front matter）
        const processedContent = this.processContent(content);
        
        // 提取第一段有效内容作为摘要
        const paragraphs = processedContent.split('\n\n');
        let excerpt = '';
        
        for (const paragraph of paragraphs) {
            const cleaned = paragraph.trim()
                .replace(/^#{1,6}\s+/, '') // 移除markdown标题
                .replace(/[""'']/g, '')
                .replace(/\n/g, ' ');
            
            if (cleaned.length > 10 && !cleaned.match(/^[>\-\*\+]/)) { // 排除引用和列表
                excerpt = cleaned;
                break;
            }
        }
        
        return excerpt.length > 80 ? excerpt.substring(0, 80) + '...' : excerpt;
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
  - articles/

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
    <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
    <p>{{ post.excerpt }}</p>
    <p><small>发布时间: {{ post.date | date: "%Y年%m月%d日" }} | 作者: {{ post.author }}</small></p>
    <p>标签: {% for tag in post.tags %}<span class="tag">{{ tag }}</span>{% endfor %}</p>
  </article>
  <hr>
{% endfor %}

## RSS订阅

<a href="{{ '/feed.xml' | relative_url }}">订阅RSS</a>
`;

        await fs.writeFile('index.md', indexContent, 'utf8');
        console.log('生成首页文件');
    }

    /**
     * 获取下一篇待发布的文章
     */
    async getNextUnpublishedArticle() {
        try {
            const articles = await this.parseCSV();
            const publishableArticles = this.filterPublishableArticles(articles);

            // 调试：显示所有文章的状态信息
            console.log(`📊 总共 ${articles.length} 篇文章，符合条件的 ${publishableArticles.length} 篇`);

            for (let i = 0; i < Math.min(3, articles.length); i++) {
                const article = articles[i];
                console.log(`📋 文章 ${i + 1}:`);
                console.log(`   标题: ${article.title || article.主题}`);
                console.log(`   发布: ${article.发布}`);
                console.log(`   渠道&账号: ${article['渠道&账号']}`);
                console.log(`   发布完成: ${article.发布完成}`);
            }

            // 查找第一篇未发布的文章
            for (const article of publishableArticles) {
                // 检查发布完成状态，如果不是"已发布"就处理
                if (!article.发布完成 || article.发布完成 !== '已发布') {
                    const title = article.title || article.主题;
                    const slug = this.generateSlug(title);
                    const postDate = new Date(); // 使用当前日期
                    const year = format(postDate, 'yyyy');
                    const month = format(postDate, 'MM');
                    const day = format(postDate, 'dd');
                    const articleUrl = `${this.baseUrl}/${year}/${month}/${day}/${slug}/`;

                    return {
                        title: title,
                        url: articleUrl,
                        author: article.提出人,
                        tags: this.parseTags(article.标签),
                        rawData: article
                    };
                }
            }

            console.log('📭 没有待发布的文章');
            return null;

        } catch (error) {
            console.error('❌ 获取待发布文章失败:', error.message);
            return null;
        }
    }

    /**
     * 写入CSV文件
     */
    async writeCSV(data) {
        try {
            // 使用UTF-8编码写入CSV文件
            const csvContent = this.arrayToCSV(data);
            await fs.writeFile(this.inputFile, csvContent, 'utf8');
            console.log(`✅ CSV文件已更新: ${this.inputFile}`);
        } catch (error) {
            console.error('❌ 写入CSV文件失败:', error.message);
            throw error;
        }
    }

    /**
     * 数组转CSV格式
     */
    arrayToCSV(data) {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [];

        // 添加标题行
        csvRows.push(headers.map(header => `"${header}"`).join(','));

        // 添加数据行
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header] || '';
                return `"${value.toString().replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
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
        if (!title) {
            return `post-${Date.now()}`;
        }

        // 确保title是字符串
        const titleStr = title.toString().trim();
        if (!titleStr) {
            return `post-${Date.now()}`;
        }

        // 先尝试提取英文部分
        const englishMatch = titleStr.match(/([A-Za-z\s:]+)/);
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