---
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
