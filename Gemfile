source "https://rubygems.org"

# GitHub Pages官方gem
gem "github-pages", group: :jekyll_plugins

# Jekyll插件
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
  gem "jekyll-sitemap"
  gem "jekyll-seo-tag"
end

# Windows和JRuby不包含zoneinfo文件，所以捆绑tzinfo-data gem
# 并将其与tzinfo gem相关联
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", "~> 1.2"
  gem "tzinfo-data"
end

# 在Windows (mingw, x64_mingw, mswin)上的性能增强器
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# 锁定http_parser.rb gem到v0.6.x在JRuby构建上，因为较新的版本
# 在该平台上不具有Java对应项。
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby] 