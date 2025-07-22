---
layout: default
title: RSS自动发布到Medium
description: 从CSV数据自动生成博客文章并发布到Medium
---

# RSS自动发布系统

这是一个自动化博客发布系统，可以：

## 功能特性

- 📝 **CSV转博客**: 从CSV数据自动生成Jekyll博客文章
- 🔄 **RSS生成**: 自动生成RSS/Atom feed  
- 🚀 **Medium发布**: 使用Playwright自动发布到Medium
- 🎯 **智能过滤**: 避免重复发布已发布的文章

## RSS Feed

- **RSS**: [feed.xml](./feed.xml)
- **Atom**: [atom.xml](./atom.xml)

## 最新文章

{% for post in site.posts limit:5 %}
- [{{ post.title }}]({{ post.url | relative_url }}) - {{ post.date | date: "%Y-%m-%d" }}
{% endfor %}

## 技术栈

- **Jekyll**: 静态站点生成
- **GitHub Pages**: 托管
- **GitHub Actions**: 自动化部署
- **Playwright**: 浏览器自动化
- **Node.js**: 后端逻辑

---

*由 [RSS到Medium自动发布系统](https://github.com/zhangxin15435/rss_autopost) 强力驱动*
