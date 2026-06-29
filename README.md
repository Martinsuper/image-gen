# 灰度 PNG 转换器

一个跨平台 Web/PWA 小工具，用浏览器本地能力把照片转换为 PNG 灰度图片。图片不会上传到服务器。

## 功能

- 拖拽或选择多张图片
- 原图和灰度结果并排预览
- 标准亮度、平均值、去饱和三种灰度算法
- 可调整灰度强度
- 可保留透明通道
- 导出当前图片或批量导出 PNG
- 支持 PWA 离线缓存

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开：

```text
http://localhost:5173
```

## 后续桌面化

如果需要桌面安装包，可以用 Tauri 把这个静态目录作为前端资源封装。核心图片处理逻辑都在 `app.js`，后续迁移成本很低。

## Cloudflare Pages

推荐配置：

- 构建命令：`npm run build`
- 构建输出目录：`dist`

仓库里也提供了 `wrangler.toml`，明确把 Pages 输出目录和 Workers 静态资源目录都指向 `dist`，避免 Cloudflare 把仓库根目录或 `node_modules` 当作静态资源上传。
