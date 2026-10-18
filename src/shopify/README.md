# Shopify 接入方案（v1 规划，当前站点为独立静态前端）

当前仓库先交付**独立可运行的静态前端**（`index.html` + `src/` + `assets/`），不依赖 Shopify。Shopify 接入分两步：先做「主题内嵌 + 原生购物车」，再评估「B2B/多市场/会员」需求。

## 1. 推荐架构：主题 Section + App Embed（保留静态渲染能力）

```
Shopify 主题
├── sections/zhusheng-builder.liquid      ← 全屏定制器（本仓库的 index.html 内容）
├── snippets/zhusheng-config.liquid       ← 注入 product/variant/currency/API 配置
├── assets/zhusheng.css                   ← tokens + 页面 CSS 合并
├── assets/zhusheng.js                    ← 本仓库 src/ 打包后的单文件（esbuild）
└── templates/page.zhusheng.json          ← 落地页模板
```

- 定制器放在独立 landing page（`/pages/customize`），避免主题 header/footer 干扰；也可用 theme app extension 的 app block。
- 本仓库的 ES Module 结构可直接用 esbuild 打包成 IIFE/ESM（零运行时依赖），上线时只替换 `window.ZHUSHENG_CONFIG`。
- 分享链接：`/pages/customize#/design/<token>`；token 已自带全部状态，无需服务端。

## 2. 商品与变体建模

推荐用一个「虚拟母商品」+ 变体承载价格，用 line item properties 承载设计：

- 商品：`珠生 · 定制五行手串`（隐藏/仅在定制器内加购）。
- 变体（决定价格与 SKU）：
  - `珠径`：6mm / 8mm / 10mm
  - `金属`：S925 银 / 古金
  - `收藏级`：标准 / 收藏级（选用 special 成本珠时）
- line item properties（写入购物车行，便于客服/生产）：
  - `设计编号` = ZS-XXXX
  - `生辰` = 1990-05-15 12:00 / 女
  - `八字` = 庚午 辛巳 庚辰 壬午
  - `三珠` = 天河石 / 银曜石 / 摩根石
  - `手围` = 15.5cm / 21 颗 / 隔珠 4 / 莲蓬
  - `设计链接` = 分享 URL
  - `设计状态` = token（≤900 字符，metafield 可存）
- 价格校验：前端价格仅展示；**加购前用 `cart/add.js` 的 variant 价格为准**，并把设计 token 存入 cart attributes / 订单 note，服务端按变体价收款。若需精确按珠计价，改用 Draft Order / Cart Transform Function（Shopify Plus）或预生成 SKU 价格表。

## 3. 加购实现（本仓库预留 hooks）

`src/shopify/shopify-cart.js` 提供：

```js
export async function addDesignToCart(design, { quantity = 1, variantId, properties }) {}
// 内部：POST /cart/add.js  { items:[{ id: variantId, quantity, properties }] }
export function buildCheckoutPermalink(variantId, quantity, properties) {}
export function designToProperties(design) {}   // 本仓库可先用
```

- 站点当前 `#/cart` 是本地购物袋（localStorage）；接入时把「结账」替换为跳转 `cart/add.js` → `/cart` 或直接 `checkout`。
- 设计 token 同时写 `cart.attributes.zhusheng_designs`（JSON 数组），便于一次结算多串。
- 若用 Headless（Hydrogen/Storefront API）：`cartCreate` + `cartLinesAdd`，properties 字段相同。

## 4. 价格与货币

- 店铺主币种 CNY；启用 Shopify Markets 后，前端通过 `window.Shopify.currency` 或 `/cart.js` 获取当前币种，`formatPrice` 用 `Intl.NumberFormat(locale,{style:'currency',currency})`。
- 人民币展示 ¥，英文站显示 USD；税率与运费由 Shopify 结账计算，前端只展示「估算」。
- 划线价用 compareAtPrice（variant 的 compare_at_price）或展示「参考价」，避免虚构原价风险。

## 5. 设计数据持久化

| 方案 | 适用 | 说明 |
| --- | --- | --- |
| URL token | 默认 | 零后端，分享即用；token <900 字符 |
| Cart line properties | 加购 | 订单可追溯，客服可复现 |
| Customer metafield | 登录用户 | `zhusheng.designs` JSON 列表（需 App 或 Admin API） |
| 独立设计服务 | 未来 | 短链 `/s/<id>`、图片 OG、分享统计；需后端/Serverless |

OG 分享图：接入时用 Shopify 的 `og:image` 或 Serverless 渲染 `/design/<token>.png`（本仓库的 SVG 渲染器可在 Node 中复用生成 PNG，需 canvas 或 resvg）。

## 6. 上线清单

1. 建母商品与 3×2×2 变体，配置价格（用 `docs/samples` 预算价校准）。
2. 上传 `sections/zhusheng-builder.liquid` + `assets/zhusheng.js/css`，配置 `ZHUSHENG_CONFIG`（variant 映射、货币、locale）。
3. 把 `#/cart` 结账按钮切到 `addDesignToCart`；测试购物车行属性与订单导出。
4. 埋点：生成成功率、编辑率、分享率、加购率（GA4 / Shopify Web Pixels）。
5. 合规：功效措辞审查（不得医疗宣称）、隐私政策（生日/性别）、7 天无理由与定制商品退换规则。
6. 性能：字体子集化（Noto Serif SC 按需子集）、SVG 渲染器懒加载、首屏 <150KB gzip。

## 7. 本仓库已预留

- `src/core/index.js` 门面与 UI 解耦：Shopify 版只需替换购物袋/结账适配层。
- `src/shopify/shopify-cart.js`：加购/属性/permalink 适配器骨架。
- `src/shopify/section-builder.liquid`：可直接改造的主题 section 模板。
- 分享 token 格式与设计 schema 稳定，便于未来迁移到服务端短链。
