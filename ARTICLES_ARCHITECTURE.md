# 📁 Articles 目录架构使用指南

本文档介绍如何使用新的 `/articles` 目录架构来管理和发布文章。

## 🏗️ **架构概览**

新架构将文章管理分离为两个部分：
- **CSV 文件**：存储文章元数据和发布状态
- **Markdown 文件**：存储实际的文章内容

```
articles/
├── articles.csv          # 文章元数据和发布状态
├── ai-agent-guide.md     # 文章内容文件
├── nlp-deep-learning.md  # 文章内容文件
└── js-async-best-practices.md
```

## 📋 **CSV 文件格式**

### 必需字段

| 字段名 | 说明 | 示例值 |
|--------|------|--------|
| `主题` | 文章标题 | "AI Agent开发实践指南" |
| `发布内容` | **Markdown文件名** | "ai-agent-guide.md" |
| `提出人` | 作者姓名 | "张三" |
| `标签` | 文章标签（逗号分隔） | "AI,开发,指南" |
| `发布` | 发布状态 | "进入发布流程" |
| `渠道&账号` | 发布渠道 | "medium,hashnode,DEV community" |
| `发布完成` | 完成状态 | "否" → "已发布" |

### CSV 示例

```csv
主题,发布内容,提出人,标签,发布,渠道&账号,发布完成,markdown格式文本
"AI Agent开发实践指南","ai-agent-guide.md","张三","AI,开发,指南","进入发布流程","medium,hashnode,DEV community","否",""
"深度学习在自然语言处理中的应用","nlp-deep-learning.md","李四","深度学习,NLP,AI","进入发布流程","medium,hashnode","否",""
"JavaScript异步编程最佳实践","js-async-best-practices.md","王五","JavaScript,编程,异步","进入发布流程","medium,DEV community","否",""
```

## 📝 **Markdown 文件要求**

### 文件命名规范
- 使用英文小写字母和连字符
- 与 CSV 中的 `发布内容` 字段对应
- 必须以 `.md` 扩展名结尾

### 内容格式
- 使用标准 Markdown 语法
- 支持代码块、表格、列表等
- 图片可以使用相对路径引用

### 示例结构
```markdown
# 文章标题

文章摘要或介绍...

## 第一部分

内容...

### 子标题

更多内容...

## 总结

总结内容...

---

*注释或版权信息*
```

## 🚀 **发布流程**

### 1. 准备文章

1. **创建 Markdown 文件**
   ```bash
   # 在 articles 目录下创建文章文件
   echo "# 我的新文章" > articles/my-new-article.md
   ```

2. **编辑 CSV 文件**
   ```csv
   "我的新文章","my-new-article.md","作者名","标签1,标签2","进入发布流程","medium","否",""
   ```

### 2. 执行发布

#### 本地测试
```bash
# 测试单文章发布
pnpm start single

# 测试博客生成
pnpm start blog
```

#### GitHub Actions 自动发布
- 推送到 main 分支会自动触发发布
- 手动运行 workflow 选择 `single` 模式

### 3. 发布后行为

#### 默认模式（保留文件）
- 文章发布成功后，CSV 中的 `发布完成` 字段会更新为 "已发布"
- Markdown 文件保留在 articles 目录中

#### 删除模式（清理文件）
```bash
# 设置环境变量启用删除模式
export DELETE_AFTER_PUBLISH=true
pnpm start single
```

发布成功后：
- CSV 中对应的行会被删除
- 对应的 Markdown 文件会被删除
- 已发布的文章不会再次处理

## ⚙️ **配置选项**

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ARTICLES_DIR` | 文章目录路径 | `articles` |
| `CSV_FILE` | CSV 文件路径 | `articles/articles.csv` |
| `DELETE_AFTER_PUBLISH` | 发布后删除文件 | `false` |

### 配置示例

```javascript
// 在代码中配置
const config = {
    blog: {
        articlesDir: 'articles',
        inputFile: 'articles/articles.csv',
        allowRepublish: false
    },
    medium: {
        deleteAfterPublish: false,
        // 其他配置...
    }
};
```

## 🔄 **工作流程对比**

### 旧架构（单一 CSV）
```
CSV文件 → 包含文章内容 → 生成博客 → 发布到Medium
```

### 新架构（分离式）
```
CSV文件（元数据）+ Markdown文件（内容）→ 生成博客 → 发布到Medium → 清理文件
```

## 📈 **优势**

### 1. **内容分离**
- 文章内容独立管理
- CSV 文件更简洁
- 更好的版本控制

### 2. **文件管理**
- 支持自动清理已发布文章
- 避免文件堆积
- 减少仓库大小

### 3. **开发体验**
- Markdown 编辑器支持更好
- 语法高亮和预览
- 更专业的写作环境

### 4. **可扩展性**
- 支持复杂的 Markdown 内容
- 可以引用图片和其他资源
- 更灵活的内容组织

## 🛠️ **实际操作示例**

### 添加新文章

1. **创建内容文件**
   ```bash
   cat > articles/new-tech-article.md << 'EOF'
   # 新技术探索
   
   这是一篇关于新技术的文章...
   
   ## 核心概念
   
   详细介绍核心概念...
   EOF
   ```

2. **更新 CSV 文件**
   ```csv
   "新技术探索","new-tech-article.md","技术专家","新技术,探索","进入发布流程","medium","否",""
   ```

3. **测试发布**
   ```bash
   pnpm start single
   ```

### 批量管理文章

```bash
# 查看待发布文章
grep "进入发布流程" articles/articles.csv | grep -v "已发布"

# 检查对应的 Markdown 文件是否存在
for file in $(awk -F, 'NR>1 {gsub(/"/, "", $2); print $2}' articles/articles.csv); do
    if [ -f "articles/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (缺失)"
    fi
done
```

## 🔧 **故障排除**

### 常见问题

#### 1. 文件找不到
```
❌ Markdown文件不存在: articles/missing-file.md
```
**解决方案**：检查 CSV 中的文件名是否与实际文件匹配

#### 2. CSV 编码问题
```
❌ CSV解析错误: Invalid character
```
**解决方案**：确保 CSV 文件使用 UTF-8 或 GBK 编码

#### 3. 无待发布文章
```
📭 没有待发布的文章
```
**解决方案**：检查 CSV 中是否有符合条件的文章：
- `发布` = "进入发布流程"
- `渠道&账号` 包含 "medium"
- `发布完成` ≠ "已发布"

### 调试模式

```bash
# 启用详细日志
DEBUG=* pnpm start single

# 允许重新发布（测试用）
ALLOW_REPUBLISH=true pnpm start single
```

## 📚 **最佳实践**

### 1. **文件命名**
- 使用描述性的英文文件名
- 避免特殊字符和空格
- 保持名称简洁但清晰

### 2. **内容组织**
- 每个文章一个独立的 Markdown 文件
- 使用标准的 Markdown 语法
- 添加适当的标题层级

### 3. **版本控制**
- 定期提交 CSV 和 Markdown 文件的更改
- 使用有意义的提交信息
- 考虑使用分支管理不同状态的文章

### 4. **备份策略**
- 在启用删除模式前备份重要文章
- 定期备份整个 articles 目录
- 考虑使用 Git 标签标记重要版本

## 🔄 **迁移指南**

### 从旧架构迁移

如果您目前使用的是旧的单一 CSV 架构，可以按以下步骤迁移：

1. **创建 articles 目录**
   ```bash
   mkdir articles
   ```

2. **提取文章内容**
   ```bash
   # 根据现有 CSV 创建 Markdown 文件
   # 这需要根据具体情况编写脚本
   ```

3. **更新 CSV 格式**
   - 将 `发布内容` 字段从文章内容改为文件名
   - 移动 CSV 文件到 articles 目录

4. **测试新架构**
   ```bash
   pnpm start single
   ```

## 💡 **小贴士**

1. **文件检查**：发布前确保所有引用的 Markdown 文件都存在
2. **编码统一**：保持 CSV 和 Markdown 文件的编码一致
3. **预览功能**：使用 Markdown 编辑器预览文章效果
4. **增量发布**：利用单文章发布功能逐步发布内容
5. **状态监控**：定期检查发布状态和文件完整性

---

🎉 **新的 articles 架构让文章管理更加专业和高效！** 

如有任何问题或建议，欢迎反馈。 