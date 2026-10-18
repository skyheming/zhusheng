# Vendor 依赖

本目录放离线可用的第三方运行时文件，均已固定版本；3D 预览按需懒加载。

| 文件 | 版本 | 许可证 | 来源 |
| --- | --- | --- | --- |
| `three.module.js` | r160 | MIT | https://unpkg.com/three@0.160.0/build/three.module.js |
| `RGBELoader.js` | r160 | MIT | https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js |

Three.js 版权归 three.js authors 所有；MIT 许可证允许商业使用，保留版权与许可声明即可（见 https://github.com/mrdoob/three.js/blob/dev/LICENSE）。
这两个文件由结果页「3D 预览」动态加载（懒加载）；进入 3D 时才请求，SVG 视图不加载。
