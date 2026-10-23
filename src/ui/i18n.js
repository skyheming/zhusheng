// src/ui/i18n.js — 轻量双语（zh 完整 / en 覆盖导航、按钮、价格、表单等关键文案）
// 用法：t('nav.cart')，t('design.wristValue', { value: '15.5' })
// 切换：setLang('en') / toggleLang()，持久化到 localStorage('zs.lang.v1')，
// 也支持 ?lang=en 或 #/...?lang=en 直接进入。

const LANG_KEY = 'zs.lang.v1';
const DEFAULT_LANG = 'zh';
const SUPPORTED = ['zh', 'en'];

const listeners = new Set();

/* ============================== 文案表 ============================== */

const DICT = {
  zh: {
    'brand.name': '珠生',
    'brand.sub': 'ZHUSHENG',
    'brand.tagline': '以生辰为序 · 串五行为珠',
    'brand.taglineEn': 'Born of the elements. Strung for you.',
    'skip': '跳到主要内容',
    'lang.aria': '切换语言 / Switch language',
    'lang.other': 'EN',
    'lang.current': '中文',

    'nav.philosophy': '理念',
    'nav.custom': '定制',
    'nav.stories': '手串故事',
    'nav.cart': '购物袋',
    'nav.menu': '菜单',
    'nav.close': '关闭菜单',
    'nav.bagCount': '购物袋，{count} 件',

    'cta.start': '开始定制',
    'cta.stories': '看看别人的手串',
    'cta.generate': '生成我的手串',
    'cta.generating': '正在取珠',
    'cta.addToCart': '加入购物袋',
    'cta.added': '已放入购物袋',
    'cta.edit': '编辑设计',
    'cta.save': '保存设计',
    'cta.reset': '重置',
    'cta.back': '返回',
    'cta.backHome': '回到首页',
    'cta.viewDesign': '查看设计',
    'cta.viewBag': '查看购物袋',
    'cta.keepBrowsing': '继续挑选',
    'cta.share': '分享',
    'cta.copyLink': '复制链接',
    'cta.variation': '换一批看看',
    'cta.generateMine': '为我自己生成',
    'cta.confirm': '确认',
    'cta.cancel': '取消',
    'cta.remove': '删除',
    'cta.checkout': '去结算',
    'cta.close': '关闭',
    'cta.openDesign': '打开设计',

    'home.hero.kicker': '以生辰为序 · 串五行为珠',
    'home.hero.titleA': '你的生辰，',
    'home.hero.titleB': '本就有它的颜色。',
    'home.hero.lead': '输入生日与性别。我们从四柱五行里取出三颗珠子，排成一串只属于你的手串——先看见，再决定要不要带走。',
    'home.hero.stat1': '手工串制',
    'home.hero.stat2': '天然晶石',
    'home.hero.stat3': '7 日交付',
    'home.hero.cardLabel': '设计编号',
    'home.hero.cardKind': '示例设计',
    'home.hero.scroll': '向下看看',
    'home.hero.caption': '丁火 · 月白　庚午 / 辛巳 / 丁未 / 丙午',

    'home.gen.kicker': 'THE RITUAL · 定制',
    'home.gen.title': '先告诉我你的生辰。',
    'home.gen.lead': '只用来排八字取珠。没有账号，也不用留电话；生成之后，链接就是你的设计。',
    'home.gen.birthday': '生日',
    'home.gen.birthdayHint': '支持 1900 年以后的日期',
    'home.gen.gender': '性别',
    'home.gen.wish': '心愿',
    'home.gen.wishHint': '可选，可多选',
    'home.gen.wrist': '手围',
    'home.gen.wristHint': '可选，默认按性别估算',
    'home.gen.wristOpt': '稍后再定',
    'home.gen.note': '无需注册 · 结果可分享',
    'home.bar.sub': '3 秒生成我的手串',
    'home.bar.cta': '开始定制',
    'home.gen.error.required': '请选择你的生日。',
    'home.gen.error.range': '暂时支持 1900 年以后的生日。',
    'home.gen.error.future': '生日不能晚于今天。',
    'home.gen.error.gender': '请选择性别，或选择「不透露」。',
    'home.gen.phase1': '正在排你的八字',
    'home.gen.phase2': '正在从五行里取三颗珠子',
    'home.gen.phase3': '正在定结构、算价格',
    'home.gen.done': '好了，这是你的手串。',
    'home.gen.footnote': '同一份生辰，每次生成都会是同一串。',

    'home.steps.kicker': 'THREE STEPS · 三步',
    'home.steps.title': '不需要懂八字，也能得到一串对的珠子。',
    'home.steps.1.title': '输入生辰',
    'home.steps.1.body': '公历生日与性别即可。年月日化成四柱，缺什么、旺什么，一目了然。',
    'home.steps.2.title': '五行取用',
    'home.steps.2.body': '从用神出发，在天然晶石里挑出主珠、辅珠与点缀，兼顾颜色与寓意。',
    'home.steps.3.title': '一珠一愿',
    'home.steps.3.body': '你写下的心愿会进入取珠规则。最后，它被手工串好，附一张独立编号卡。',

    'home.elements.kicker': 'FIVE ELEMENTS · 五行',
    'home.elements.title': '缺什么补什么，是一种自我关照。',
    'home.elements.lead': '五行不是公式，更像一套看自己的语言：木舒展、火明亮、土承载、金收敛、水流动。我们把偏弱的那一种，翻译成腕上的一点颜色。',
    'home.elements.note': '这不是迷信，是一种自我关照的仪式。',
    'home.elements.wood': '像春日抽芽，向外舒展。',
    'home.elements.fire': '像夏夜灯火，明亮温暖。',
    'home.elements.earth': '像厚土承物，安稳可靠。',
    'home.elements.metal': '像秋金收敛，清醒利落。',
    'home.elements.water': '像冬水归藏，安静深远。',

    'home.craft.kicker': 'CRAFT · 工艺',
    'home.craft.title': '慢一点做，才戴得久。',
    'home.craft.1.title': '天然晶石',
    'home.craft.1.body': '每一颗都有天然纹理与色差，我们把它当作特征，而不是瑕疵。',
    'home.craft.2.title': 'S925 银配件',
    'home.craft.2.body': '隔珠、扣件与挂坠均为 S925，久戴会氧化，可用擦银布恢复。',
    'home.craft.3.title': '手工串制',
    'home.craft.3.body': '按你选定的手围与珠径逐颗穿线，打结、收口，均由同一位串珠师完成。',
    'home.craft.4.title': '独立编号卡',
    'home.craft.4.body': '每串附带一张编号卡，记着它的生辰、用神与珠名。',

    'home.stories.kicker': 'THEIR WORLDS · 手串故事',
    'home.stories.title': '他们把它戴在腕上。',
    'home.stories.photoTag': '佩戴示意',
    'home.stories.photoNote': '故事文案为示例，图片为佩戴示意图；真实客单会陆续替换。',
    'home.stories.1.quote': '我本来只是想买一串好看的。输入生日那天，系统说我火太旺，用月光石。戴上之后确实会安静一点——也可能是心理作用，但我不介意。',
    'home.stories.1.name': '林，29 岁，杭州',
    'home.stories.1.id': '癸水 · 月白',
    'home.stories.2.quote': '给妈妈做的。她生日在中秋前后，用神是土，配了蜜蜡和南红。她说颜色很衬她的手，我看着她笑，觉得这件事做对了。',
    'home.stories.2.name': '陈，34 岁，厦门',
    'home.stories.2.id': '戊土 · 蜜色',
    'home.stories.3.quote': '编辑了三次才定下来。换珠的时候价格会跟着动，这点让我很放心。最后那串比最初多了六十块，也更好看了。',
    'home.stories.3.name': '周，26 岁，成都',
    'home.stories.3.id': '辛金 · 金丝',

    'home.faq.kicker': 'FAQ',
    'home.faq.title': '你可能还想问。',
    'home.faq.1.q': '手围怎么选？',
    'home.faq.1.a': '用软尺贴着手腕骨头后方一圈量，得出厘米数即可。14–16cm 偏细，17–18cm 常见，19–20cm 偏宽。拿不准就选默认值，戴起来略松时可自行收一节。',
    'home.faq.2.q': '多久发货？',
    'home.faq.2.a': '设计确认后 48 小时内完成串制与质检，7 日内送达大部分城市。急件可以在订单备注里告诉我们。',
    'home.faq.3.q': '可以改设计吗？',
    'home.faq.3.a': '可以。结果页点「编辑设计」，换珠、改手围、换挂坠都会实时更新价格。保存后会生成新链接，旧链接依然有效。',
    'home.faq.4.q': '命理依据是什么？',
    'home.faq.4.a': '四柱与五行按东八区、立春换年、节气换月计算，日柱以 1949-10-01 甲子日为锚。取珠规则公开，且始终把「好看、好戴」放在玄学之前。',

    'home.cta.kicker': 'BEGIN',
    'home.cta.title': '现在，轮到你的生辰。',
    'home.cta.lead': '一分钟，一串手串，一个可以分享的设计编号。',
    'home.cta.button': '生成我的手串',

    'design.back': '返回',
    'design.shared.title': '这是朋友分享给你的设计。',
    'design.shared.cta': '为我自己生成',
    'design.eyebrow': '为你而设 · FOR YOU',
    'design.reference': '参考价',
    'design.tax': '含税 · 满 ¥399 包邮',
    'design.wrist': '手围',
    'design.diameter': '珠径',
    'design.added': '已放入购物袋，可以去购物袋看看。',
    'design.promise1': '天然晶石',
    'design.promise2': '48h 内发货',
    'design.promise3': '7 天无理由',
    'design.promise4': '独立编号卡',
    'design.shareTitle': '把这串分享出去',
    'design.shareHint': '复制链接发给朋友，打开即看，无需登录。',
    'design.view.label': '切换视图',
    'design.view.circle': '环视',
    'design.view.flat': '平铺',
    'design.view.wrist': '佩戴',
    'design.view.threeD': '3D 预览',
    'design.dragHint': '拖动旋转 · 悬停识珠',
    'design.dragHint3d': '拖动旋转 · 3D 材质预览',
    'design.bazi.kicker': 'BAZI · 四柱',
    'design.bazi.title': '你的四柱与五行。',
    'design.bazi.dayMaster': '日主',
    'design.bazi.pillar.year': '年柱',
    'design.bazi.pillar.month': '月柱',
    'design.bazi.pillar.day': '日柱',
    'design.bazi.pillar.hour': '时柱',
    'design.bazi.hourUnknown': '时辰未填',
    'design.bazi.elements': '五行分布',
    'design.bazi.favorable': '用神',
    'design.bazi.avoid': '忌',
    'design.bazi.missing': '缺',
    'design.bazi.noMissing': '无明显缺失',
    'design.bazi.conclusion': '宜以{secondary}生{primary}，让{max}的热度有处安放。',
    'design.picks.kicker': 'THREE STONES · 三珠',
    'design.picks.title': '为什么是这三颗。',
    'design.picks.main': '主珠',
    'design.picks.support': '辅珠',
    'design.picks.accent': '点缀',
    'design.spec.kicker': 'SPECIFICATION · 规格',
    'design.spec.title': '结构一览。',
    'design.spec.beadCount': '珠子颗数',
    'design.spec.beadDiameter': '珠径',
    'design.spec.wrist': '手围',
    'design.spec.metal': '金属',
    'design.spec.spacer': '隔珠',
    'design.spec.none': '无',
    'design.spec.charm': '挂坠',
    'design.spec.total': '总件数',
    'design.spec.metal.silver': 'S925 银',
    'design.spec.metal.gold': '古金',
    'design.spec.spacerEvery': '每 5 颗左右',
    'design.spec.spacerValue': '{count} 颗 · 每 {every} 颗左右',
    'design.value.pieces': '{count} 颗',
    'design.value.total': '{count} 件',
    'design.value.mm': '{value} mm',
    'design.value.cm': '{value} cm',
    'design.care.kicker': 'CARE · 养护',
    'design.care.title': '水晶也需要被好好对待。',
    'design.care.1': '避免磕碰与长时间暴晒，洗澡、游泳时摘下。',
    'design.care.2': '银配件氧化变暗是正常的，用擦银布轻轻擦拭即可恢复光泽。',
    'design.care.3': '不戴时放进随附的绒袋，别和其他首饰缠在一起。',
    'design.care.4': '天然晶石的纹理与色差不是瑕疵，是它的来处。',
    'design.faq.title': '你可能还想问。',
    'design.variation.title': '没有一见钟情？',
    'design.variation.lead': '同一个生辰，换一种取珠与排布。价格与结构都会重新算。',
    'design.createMine.title': '也想看看自己的那串？',
    'design.createMine.lead': '输入生日和性别，一分钟就有答案。',
    'design.invalid.title': '这个设计链接似乎不完整。',
    'design.invalid.body': '可能复制时少了一段。重新生成一串，只要一分钟。',
    'design.invalid.cta': '重新生成',
    'design.spec.storyTitle': '这一串的来处',
    'design.stoneUnit': '单颗',

    'editor.kicker': 'EDIT · 编辑',
    'editor.title': '调整你的手串。',
    'editor.lead': '每一次改动都会即时重算价格与结构，确认后再保存。',
    'editor.section.size': '尺寸与材质',
    'editor.section.stones': '三颗主珠',
    'editor.section.structure': '结构',
    'editor.section.wish': '心愿',
    'editor.wrist': '手围',
    'editor.wristValue': '{value} cm',
    'editor.diameter': '珠径',
    'editor.metal': '金属',
    'editor.metal.silver': '银色',
    'editor.metal.gold': '古金',
    'editor.layout': '布局样式',
    'editor.layout.symmetry': '对称',
    'editor.layout.gradient': '渐变',
    'editor.layout.interval': '间隔',
    'editor.spacer': '隔珠密度',
    'editor.spacer.none': '无',
    'editor.spacer.sparse': '少',
    'editor.spacer.standard': '标准',
    'editor.spacer.dense': '多',
    'editor.charm': '挂坠',
    'editor.charm.none': '无',
    'editor.charm.lotus': '莲蓬',
    'editor.charm.peace': '平安扣',
    'editor.charm.pixiu': '貔貅',
    'editor.role.main': '主珠',
    'editor.role.support': '辅珠',
    'editor.role.accent': '点缀',
    'editor.replace': '替换',
    'editor.collapse': '收起',
    'editor.why': '为何适合你',
    'editor.unitCost': '单颗 ¥{price}',
    'editor.liveNote': '改动即时生效，价格同步更新。',
    'editor.wishNote': '心愿改变后，推荐会重新计算。',
    'editor.saved': '设计已保存，链接已可分享。',
    'editor.applyFailed': '这个组合暂时不可用，换一颗试试。',
    'editor.resetTitle': '恢复初始推荐？',
    'editor.resetBody': '你在这串上的所有调整都会被清除，回到最初生成的设计。',
    'editor.resetDone': '已恢复初始推荐。',
    'editor.barPrice': '当前价格',
    'editor.barHint': '保存后生成新的分享链接',
    'editor.unsaved': '有未保存的修改',
    'editor.savedState': '已保存',
    'editor.pickOne': '点击替换',
    'editor.current': '当前',
    'editor.colorFamily': '{family}系',
    'qty.decrease': '减少数量',
    'qty.increase': '增加数量',

    'cart.kicker': 'BAG · 购物袋',
    'cart.title': '你的购物袋。',
    'cart.lead': '设计会在这里等你。结账通道接入 Shopify 后即可直接下单。',
    'cart.empty.title': '购物袋还是空的。',
    'cart.empty.lead': '先输入生日，看看属于你的那串。',
    'cart.item.design': '设计',
    'cart.item.qty': '数量',
    'cart.item.remove': '移除',
    'cart.item.open': '查看设计',
    'cart.summary': '订单小计',
    'cart.subtotal': '小计',
    'cart.shipping': '运费',
    'cart.free': '包邮',
    'cart.freeRule': '满 ¥399 包邮，否则 ¥12',
    'cart.freeShippingProgress': '再买 ¥{amount} 即可包邮',
    'cart.total': '合计',
    'cart.checkoutNote': '结账通道即将开放，你的设计会先被保留。',
    'cart.secure': '安全支付 · 7 天无理由退换',
    'cart.count': '{count} 件',
    'cart.modal.title': '结账通道即将开放。',
    'cart.modal.body': '珠生正在接入 Shopify 支付。这一单已经整理好，通道开放后可以直接带走；现在也可以先把设计链接分享给朋友。',
    'cart.modal.note': '已生成可对接的订单数据（见控制台）。',
    'cart.modal.cta': '知道了',
    'cart.addedToast': '已放入购物袋。',
    'cart.removedToast': '已从购物袋移除。',
    'cart.emptyBag': '购物袋是空的。',

    'share.copied': '链接已复制，可以分享了。',
    'share.failed': '复制失败，请手动选择下面的链接。',
    'share.manual': '手动复制',
    'share.wechat': '微信',
    'share.xiaohongshu': '小红书',
    'share.coming': '即将开放',
    'share.aria': '复制设计分享链接',

    'about.kicker': 'PHILOSOPHY · 理念',
    'about.title': '珠生，是为生辰而生的珠子。',
    'about.lead': '我们相信，一个人第一次认真看自己的五行，往往不是在算命，而是在找一种说法——解释自己为什么是这样的人。珠生把这种说法做成了一串可以戴在腕上的东西。',
    'about.story.kicker': 'WHY WE MAKE',
    'about.story.title': '从一句「你适合戴点水色」开始。',
    'about.story.p1': '几年前，一位做珠宝的朋友替人挑珠子。她不懂命理，但总能挑得很准：看一眼对方的肤色、说话的节奏、最近在烦的事，就知道该递过去哪一颗。后来我们想，如果把这种判断写成规则，是不是每个人都能得到自己的那一串。',
    'about.story.p2': '于是有了珠生。八字与五行是入口，宝石知识库是材料，最后落在一张设计图和一张编号卡上。我们不承诺改运，只希望你在抬手的时候，能想起那天的自己。',
    'about.elements.kicker': 'FIVE ELEMENTS',
    'about.elements.title': '五行，是一种看自己的语言。',
    'about.care.kicker': 'CARE',
    'about.care.title': '戴得久，才像你的。',
    'about.cta.title': '现在，给自己做一串。',
    'about.cta.lead': '输入生日与性别，一分钟看见结果。',

    'notfound.kicker': '404',
    'notfound.title': '这条珠线断了。',
    'notfound.lead': '你访问的页面不存在，或者这个设计链接不完整。',
    'notfound.cta': '回到首页',
    'error.title': '出了点小问题。',
    'error.lead': '页面没能正常加载，可以刷新一次，或回到首页重新开始。',
    'error.retry': '刷新页面',

    'footer.statement': '以生辰为序，串五行为珠。',
    'footer.desc': '珠生把八字五行翻译成可以戴在腕上的颜色。天然晶石、S925 银、手工串制，每一串都有独立编号。',
    'footer.series': '系列',
    'footer.series1': '生辰系列',
    'footer.series2': '心愿系列',
    'footer.series3': '礼物与纪念',
    'footer.help': '帮助',
    'footer.help1': '尺寸指南',
    'footer.help2': '水晶养护',
    'footer.help3': '配送与售后',
    'footer.help4': '联系我们',
    'footer.follow': '关注',
    'footer.wechat': '微信',
    'footer.xiaohongshu': '小红书',
    'footer.instagram': 'Instagram',
    'footer.copyright': '© 2026 珠生 ZHUSHENG · 保留所有权利',
    'footer.shopify': '结账通道由 Shopify 提供支持（接入中）',
    'footer.note': '本页为静态预览，设计数据由前端生成，不会上传。',
    'footer.backTop': '回到顶部',

    'common.mm': 'mm',
    'common.cm': 'cm',
    'common.yes': '是',
    'common.no': '否',
    'common.loading': '加载中',
    'toast.langSwitched': '语言已切换为中文。',
    'toast.mockNote': '当前为演示数据。',
  },

  en: {
    'brand.name': 'ZHUSHENG',
    'brand.sub': '珠生',
    'brand.tagline': 'Ordered by birth, strung by element.',
    'brand.taglineEn': 'Born of the elements. Strung for you.',
    'skip': 'Skip to content',
    'lang.aria': 'Switch language',
    'lang.other': '中文',
    'lang.current': 'EN',

    'nav.philosophy': 'Philosophy',
    'nav.custom': 'Customize',
    'nav.stories': 'Stories',
    'nav.cart': 'Bag',
    'nav.menu': 'Menu',
    'nav.close': 'Close menu',
    'nav.bagCount': 'Shopping bag, {count} items',

    'cta.start': 'Start',
    'cta.stories': 'Read their stories',
    'cta.generate': 'Generate my bracelet',
    'cta.generating': 'Selecting stones',
    'cta.addToCart': 'Add to bag',
    'cta.added': 'Added to bag',
    'cta.edit': 'Edit design',
    'cta.save': 'Save design',
    'cta.reset': 'Reset',
    'cta.back': 'Back',
    'cta.backHome': 'Back home',
    'cta.viewDesign': 'View design',
    'cta.viewBag': 'View bag',
    'cta.keepBrowsing': 'Keep browsing',
    'cta.share': 'Share',
    'cta.copyLink': 'Copy link',
    'cta.variation': 'Another round',
    'cta.generateMine': 'Generate for me',
    'cta.confirm': 'Confirm',
    'cta.cancel': 'Cancel',
    'cta.remove': 'Remove',
    'cta.checkout': 'Checkout',
    'cta.close': 'Close',
    'cta.openDesign': 'Open design',

    'home.hero.kicker': 'ORDERED BY BIRTH · STRUNG BY ELEMENT',
    'home.hero.titleA': 'Your birthday ',
    'home.hero.titleB': 'already has its colour.',
    'home.hero.lead': 'Tell us your date of birth and gender. We read the four pillars and five elements, then choose three stones and string them for you — see it first, decide later.',
    'home.hero.stat1': 'Hand-strung',
    'home.hero.stat2': 'Natural stones',
    'home.hero.stat3': 'Ships in 7 days',
    'home.hero.cardLabel': 'Design no.',
    'home.hero.cardKind': 'Sample design',
    'home.hero.scroll': 'Scroll',
    'home.hero.caption': 'Ding Fire · Moon White — Geng Wu / Xin Si / Ding Wei / Bing Wu',

    'home.gen.kicker': 'THE RITUAL · CUSTOM',
    'home.gen.title': 'First, your date of birth.',
    'home.gen.lead': 'Used only to read your chart. No account, no phone number — the link is your design.',
    'home.gen.birthday': 'Date of birth',
    'home.gen.birthdayHint': 'Dates after 1900',
    'home.gen.gender': 'Gender',
    'home.gen.wish': 'Intention',
    'home.gen.wishHint': 'Optional, choose any',
    'home.gen.wrist': 'Wrist',
    'home.gen.wristHint': 'Optional, estimated from gender',
    'home.gen.wristOpt': 'Decide later',
    'home.gen.note': 'No sign-up · Shareable result',
    'home.bar.sub': 'Ready in three seconds',
    'home.bar.cta': 'Start',
    'home.gen.error.required': 'Please choose your date of birth.',
    'home.gen.error.range': 'We support birthdays after 1900.',
    'home.gen.error.future': 'The date cannot be in the future.',
    'home.gen.error.gender': 'Please choose a gender, or “Prefer not to say”.',
    'home.gen.phase1': 'Reading your four pillars',
    'home.gen.phase2': 'Choosing three stones',
    'home.gen.phase3': 'Composing and pricing',
    'home.gen.done': 'Here is your bracelet.',
    'home.gen.footnote': 'The same birthday always returns the same design.',

    'home.steps.kicker': 'THREE STEPS',
    'home.steps.title': 'You do not need to know bazi to get the right stones.',
    'home.steps.1.title': 'Enter your birth',
    'home.steps.1.body': 'A date and a gender. They become four pillars — what is abundant, what is thin.',
    'home.steps.2.title': 'Read the elements',
    'home.steps.2.body': 'From your favourable element we pick a main stone, a support and an accent — colour and meaning together.',
    'home.steps.3.title': 'One stone, one wish',
    'home.steps.3.body': 'Your intention joins the rules. Then it is strung by hand and sent with a numbered card.',

    'home.elements.kicker': 'FIVE ELEMENTS',
    'home.elements.title': 'Fill what is thin. It is a way of caring for yourself.',
    'home.elements.lead': 'Wood unfolds, fire brightens, earth carries, metal gathers, water moves. We translate the element you lack into a colour at your wrist.',
    'home.elements.note': 'Not superstition — a small ritual of self-regard.',
    'home.elements.wood': 'Like spring sprouting outward.',
    'home.elements.fire': 'Like lamplight on a summer night.',
    'home.elements.earth': 'Like ground that holds everything.',
    'home.elements.metal': 'Like autumn air, clear and exact.',
    'home.elements.water': 'Like winter water, quiet and deep.',

    'home.craft.kicker': 'CRAFT',
    'home.craft.title': 'Made slowly, worn for years.',
    'home.craft.1.title': 'Natural stones',
    'home.craft.1.body': 'Every stone carries its own veins and shade. We call that character, not flaw.',
    'home.craft.2.title': 'S925 silver',
    'home.craft.2.body': 'Spacers, clasps and charms are S925. They darken with wear; a silver cloth brings them back.',
    'home.craft.3.title': 'Hand-strung',
    'home.craft.3.body': 'Cut to your wrist and bead size, knotted and finished by the same maker.',
    'home.craft.4.title': 'Numbered card',
    'home.craft.4.body': 'Each piece comes with a card that records its birth date, element and stones.',

    'home.stories.kicker': 'THEIR WORLDS',
    'home.stories.title': 'They wear it on the wrist.',
    'home.stories.photoTag': 'STYLED',
    'home.stories.photoNote': 'Story copy is illustrative and images are styled placeholders; real customer photos will replace them.',
    'home.stories.1.quote': 'I only wanted something pretty. It told me my fire was too strong and chose moonstone. I do feel calmer — maybe it is in my head, but I do not mind.',
    'home.stories.1.name': 'Lin, 29, Hangzhou',
    'home.stories.1.id': 'Gui Water · Moon White',
    'home.stories.2.quote': 'Made for my mother, whose birthday falls near mid-autumn. Earth is her element, so amber and red agate. The colours suit her hand. I am glad I did it.',
    'home.stories.2.name': 'Chen, 34, Xiamen',
    'home.stories.2.id': 'Wu Earth · Honey',
    'home.stories.3.quote': 'I edited it three times. The price moved with every swap, which made me trust it. The final piece cost sixty more than the first, and looked better.',
    'home.stories.3.name': 'Zhou, 26, Chengdu',
    'home.stories.3.id': 'Xin Metal · Gold Thread',

    'home.faq.kicker': 'FAQ',
    'home.faq.title': 'A few questions.',
    'home.faq.1.q': 'How do I choose a wrist size?',
    'home.faq.1.a': 'Measure snugly around the wrist bone with a soft tape. 14–16 cm is petite, 17–18 cm common, 19–20 cm relaxed. When unsure, keep the default.',
    'home.faq.2.q': 'When will it ship?',
    'home.faq.2.a': 'Within 48 hours of confirming the design, delivered in 7 days to most cities. Tell us in the order note if it is urgent.',
    'home.faq.3.q': 'Can I change the design?',
    'home.faq.3.a': 'Yes. Open Edit design on the result page: stones, wrist and charm update the price live. Saving creates a new link; the old one still works.',
    'home.faq.4.q': 'What is the astrological basis?',
    'home.faq.4.a': 'Pillars use UTC+8, years turn at the start of spring, months at solar terms. The rules are deterministic — and beauty always comes before metaphysics.',

    'home.cta.kicker': 'BEGIN',
    'home.cta.title': 'Now it is your turn.',
    'home.cta.lead': 'One minute, one bracelet, one design number you can share.',
    'home.cta.button': 'Generate my bracelet',

    'design.back': 'Back',
    'design.shared.title': 'A design shared with you.',
    'design.shared.cta': 'Generate for me',
    'design.eyebrow': 'FOR YOU',
    'design.reference': 'Reference',
    'design.tax': 'Tax included · free shipping over ¥399',
    'design.wrist': 'Wrist',
    'design.diameter': 'Bead size',
    'design.added': 'Added to your bag.',
    'design.promise1': 'Natural stones',
    'design.promise2': 'Ships in 48h',
    'design.promise3': '7-day returns',
    'design.promise4': 'Numbered card',
    'design.shareTitle': 'Share this design',
    'design.shareHint': 'Send the link — it opens without signing in.',
    'design.view.label': 'Switch view',
    'design.view.circle': 'Circle',
    'design.view.flat': 'Flat',
    'design.view.wrist': 'Worn',
    'design.view.threeD': '3D',
    'design.dragHint': 'Drag to rotate · hover a bead',
    'design.dragHint3d': 'Drag to rotate · 3D material preview',
    'design.bazi.kicker': 'BAZI',
    'design.bazi.title': 'Your pillars and elements.',
    'design.bazi.dayMaster': 'Day Master',
    'design.bazi.pillar.year': 'Year',
    'design.bazi.pillar.month': 'Month',
    'design.bazi.pillar.day': 'Day',
    'design.bazi.pillar.hour': 'Hour',
    'design.bazi.hourUnknown': 'No birth time',
    'design.bazi.elements': 'Element balance',
    'design.bazi.favorable': 'Favourable',
    'design.bazi.avoid': 'Avoid',
    'design.bazi.missing': 'Missing',
    'design.bazi.noMissing': 'None notably missing',
    'design.bazi.conclusion': 'Let {secondary} feed {primary}, so the {max} has somewhere to rest.',
    'design.picks.kicker': 'THREE STONES',
    'design.picks.title': 'Why these three.',
    'design.picks.main': 'Main',
    'design.picks.support': 'Support',
    'design.picks.accent': 'Accent',
    'design.spec.kicker': 'SPECIFICATION',
    'design.spec.title': 'How it is built.',
    'design.spec.beadCount': 'Beads',
    'design.spec.beadDiameter': 'Bead size',
    'design.spec.wrist': 'Wrist',
    'design.spec.metal': 'Metal',
    'design.spec.spacer': 'Spacers',
    'design.spec.none': 'None',
    'design.spec.charm': 'Charm',
    'design.spec.total': 'Total pieces',
    'design.spec.metal.silver': 'S925 silver',
    'design.spec.metal.gold': 'Antique gold',
    'design.spec.spacerEvery': 'about every 5 beads',
    'design.spec.spacerValue': '{count} · about every {every}',
    'design.value.pieces': '{count} beads',
    'design.value.total': '{count} pieces',
    'design.value.mm': '{value} mm',
    'design.value.cm': '{value} cm',
    'design.care.kicker': 'CARE',
    'design.care.title': 'Stones need to be treated well.',
    'design.care.1': 'Avoid knocks and long sun exposure. Remove before showering or swimming.',
    'design.care.2': 'Silver darkens with wear; a silver cloth restores its light.',
    'design.care.3': 'Keep it in the pouch when not worn, away from other jewellery.',
    'design.care.4': 'Natural veins and shade are not flaws — they are where it came from.',
    'design.faq.title': 'A few questions.',
    'design.variation.title': 'Not the one?',
    'design.variation.lead': 'Same birth, a different reading and arrangement. Structure and price are recalculated.',
    'design.createMine.title': 'Want your own?',
    'design.createMine.lead': 'A birthday and a gender; one minute to an answer.',
    'design.invalid.title': 'This design link looks incomplete.',
    'design.invalid.body': 'A piece may be missing from the link. Generating a new one takes a minute.',
    'design.invalid.cta': 'Generate a new one',
    'design.spec.storyTitle': 'Where this strand comes from',
    'design.stoneUnit': 'each',

    'editor.kicker': 'EDIT',
    'editor.title': 'Adjust your bracelet.',
    'editor.lead': 'Every change recalculates price and structure. Save when it feels right.',
    'editor.section.size': 'Size & metal',
    'editor.section.stones': 'Three stones',
    'editor.section.structure': 'Structure',
    'editor.section.wish': 'Intention',
    'editor.wrist': 'Wrist',
    'editor.wristValue': '{value} cm',
    'editor.diameter': 'Bead size',
    'editor.metal': 'Metal',
    'editor.metal.silver': 'Silver',
    'editor.metal.gold': 'Antique gold',
    'editor.layout': 'Layout',
    'editor.layout.symmetry': 'Symmetry',
    'editor.layout.gradient': 'Gradient',
    'editor.layout.interval': 'Interval',
    'editor.spacer': 'Spacers',
    'editor.spacer.none': 'None',
    'editor.spacer.sparse': 'Sparse',
    'editor.spacer.standard': 'Standard',
    'editor.spacer.dense': 'Dense',
    'editor.charm': 'Charm',
    'editor.charm.none': 'None',
    'editor.charm.lotus': 'Lotus',
    'editor.charm.peace': 'Peace knot',
    'editor.charm.pixiu': 'Pixiu',
    'editor.role.main': 'Main',
    'editor.role.support': 'Support',
    'editor.role.accent': 'Accent',
    'editor.replace': 'Replace',
    'editor.collapse': 'Close',
    'editor.why': 'Why it fits',
    'editor.unitCost': '¥{price} each',
    'editor.liveNote': 'Changes apply live, price included.',
    'editor.wishNote': 'Changing intention recalculates recommendations.',
    'editor.saved': 'Design saved. The link is ready to share.',
    'editor.applyFailed': 'That combination is not available. Try another stone.',
    'editor.resetTitle': 'Reset to the original design?',
    'editor.resetBody': 'All adjustments will be cleared and you will return to the first recommendation.',
    'editor.resetDone': 'Reset to the original.',
    'editor.barPrice': 'Current price',
    'editor.barHint': 'Saving creates a new share link',
    'editor.unsaved': 'Unsaved changes',
    'editor.savedState': 'Saved',
    'editor.pickOne': 'Tap to replace',
    'editor.current': 'Current',
    'editor.colorFamily': '{family}',
    'qty.decrease': 'Decrease quantity',
    'qty.increase': 'Increase quantity',

    'cart.kicker': 'BAG',
    'cart.title': 'Your bag.',
    'cart.lead': 'Your designs wait here. Checkout opens once Shopify is connected.',
    'cart.empty.title': 'Your bag is empty.',
    'cart.empty.lead': 'Start with your birthday and see what belongs to you.',
    'cart.item.design': 'Design',
    'cart.item.qty': 'Quantity',
    'cart.item.remove': 'Remove',
    'cart.item.open': 'View design',
    'cart.summary': 'Order summary',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Shipping',
    'cart.free': 'Free',
    'cart.freeRule': 'Free over ¥399, otherwise ¥12',
    'cart.freeShippingProgress': '¥{amount} away from free shipping',
    'cart.total': 'Total',
    'cart.checkoutNote': 'Checkout is coming soon. Your design will be kept.',
    'cart.secure': 'Secure payment · 7-day returns',
    'cart.count': '{count} items',
    'cart.modal.title': 'Checkout is opening soon.',
    'cart.modal.body': 'ZHUSHENG is connecting Shopify payments. This order is ready to go once it opens — meanwhile you can share the design link.',
    'cart.modal.note': 'A Shopify-ready order payload was printed to the console.',
    'cart.modal.cta': 'Got it',
    'cart.addedToast': 'Added to your bag.',
    'cart.removedToast': 'Removed from your bag.',
    'cart.emptyBag': 'Your bag is empty.',

    'share.copied': 'Link copied. Ready to share.',
    'share.failed': 'Copy failed. Please select the link below.',
    'share.manual': 'Copy manually',
    'share.wechat': 'WeChat',
    'share.xiaohongshu': 'RED',
    'share.coming': 'Coming soon',
    'share.aria': 'Copy share link',

    'about.kicker': 'PHILOSOPHY',
    'about.title': 'ZHUSHENG is jewellery born from a birthday.',
    'about.lead': 'Most people first look at their elements not to predict the future, but to find a way to describe themselves. We make that description into something you can wear.',
    'about.story.kicker': 'WHY WE MAKE',
    'about.story.title': 'It began with “you should wear something watery”.',
    'about.story.p1': 'A jeweller friend used to choose stones for people without knowing any astrology. She read their skin, their rhythm of speech, the thing worrying them that week — and handed over the right stone. We wondered whether that judgement could become rules.',
    'about.story.p2': 'ZHUSHENG is the attempt. The chart is the door, the stone library is the material, and the result is a design and a numbered card. We promise no fortune — only that when you raise your hand, you remember the day you chose it.',
    'about.elements.kicker': 'FIVE ELEMENTS',
    'about.elements.title': 'The elements are a language for the self.',
    'about.care.kicker': 'CARE',
    'about.care.title': 'Worn long enough, it becomes yours.',
    'about.cta.title': 'Make one for yourself.',
    'about.cta.lead': 'A birthday and a gender; one minute.',

    'notfound.kicker': '404',
    'notfound.title': 'This thread has snapped.',
    'notfound.lead': 'The page does not exist, or this design link is incomplete.',
    'notfound.cta': 'Back home',
    'error.title': 'Something went wrong.',
    'error.lead': 'The page could not load. Try refreshing, or start again from home.',
    'error.retry': 'Refresh',

    'footer.statement': 'Ordered by birth, strung by element.',
    'footer.desc': 'ZHUSHENG translates the five elements into colour at your wrist. Natural stones, S925 silver, hand-strung, each with its own number.',
    'footer.series': 'Series',
    'footer.series1': 'Birth series',
    'footer.series2': 'Intention series',
    'footer.series3': 'Gifts & keepsakes',
    'footer.help': 'Help',
    'footer.help1': 'Size guide',
    'footer.help2': 'Stone care',
    'footer.help3': 'Shipping & returns',
    'footer.help4': 'Contact',
    'footer.follow': 'Follow',
    'footer.wechat': 'WeChat',
    'footer.xiaohongshu': 'RED',
    'footer.instagram': 'Instagram',
    'footer.copyright': '© 2026 ZHUSHENG · All rights reserved',
    'footer.shopify': 'Checkout powered by Shopify (in progress)',
    'footer.note': 'Static preview — designs are generated in your browser and never uploaded.',
    'footer.backTop': 'Back to top',

    'common.mm': 'mm',
    'common.cm': 'cm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.loading': 'Loading',
    'toast.langSwitched': 'Language set to English.',
    'toast.mockNote': 'Demo data.',
  },
};

/* ============================== 语言状态 ============================== */

function readStoredLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (SUPPORTED.includes(stored)) return stored;
  } catch { /* localStorage may be unavailable */ }
  return null;
}

function readUrlLang() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromSearch = params.get('lang');
    if (SUPPORTED.includes(fromSearch)) return fromSearch;
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex >= 0) {
      const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get('lang');
      if (SUPPORTED.includes(fromHash)) return fromHash;
    }
  } catch { /* ignore */ }
  return null;
}

function detectLang() {
  return readUrlLang() || readStoredLang() || DEFAULT_LANG;
}

let lang = detectLang();

export function getLang() {
  return lang;
}

export function isEn() {
  return lang === 'en';
}

export function setLang(next, { announce = true } = {}) {
  const normalized = SUPPORTED.includes(next) ? next : DEFAULT_LANG;
  const changed = normalized !== lang;
  lang = normalized;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  applyDocumentLang();
  for (const fn of listeners) {
    try { fn(lang); } catch (err) { console.error('[i18n] listener failed', err); }
  }
  return changed;
}

export function toggleLang(options) {
  return setLang(lang === 'zh' ? 'en' : 'zh', options);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyDocumentLang() {
  const root = document.documentElement;
  root.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  root.setAttribute('data-lang', lang);
}

/* ============================== t / pick ============================== */

export function t(key, vars) {
  const table = DICT[lang] || DICT.zh;
  let str = table[key];
  if (str === undefined) str = DICT.zh[key];
  if (str === undefined) {
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
  }
  return str;
}

/** 从 {zh,en} 或字符串取当前语言文本 */
export function pick(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.zh ?? value.en ?? '';
}

/* ============================== 静态 UI 词表 ============================== */

export const UI_GENDERS = [
  { id: 'f', zh: '女', en: 'Her' },
  { id: 'm', zh: '男', en: 'Him' },
  { id: 'x', zh: '不透露', en: 'Prefer not to say' },
];

export const UI_WISHES = [
  { id: 'love', zh: '爱情', en: 'Love' },
  { id: 'career', zh: '事业', en: 'Career' },
  { id: 'wealth', zh: '财富', en: 'Wealth' },
  { id: 'health', zh: '健康', en: 'Health' },
  { id: 'family', zh: '家庭', en: 'Family' },
  { id: 'emotion', zh: '情绪平衡', en: 'Balance' },
];

export const UI_ELEMENTS = [
  { id: 'wood', zh: '木', en: 'Wood', hex: '#5F7D5A', seasonZh: '春', seasonEn: 'Spring', traitZh: '生长 · 舒展', traitEn: 'Growth · unfolding', lineKey: 'home.elements.wood' },
  { id: 'fire', zh: '火', en: 'Fire', hex: '#B14A36', seasonZh: '夏', seasonEn: 'Summer', traitZh: '明亮 · 热烈', traitEn: 'Radiance · warmth', lineKey: 'home.elements.fire' },
  { id: 'earth', zh: '土', en: 'Earth', hex: '#B08A57', seasonZh: '长夏', seasonEn: 'Late summer', traitZh: '承载 · 稳定', traitEn: 'Holding · steadiness', lineKey: 'home.elements.earth' },
  { id: 'metal', zh: '金', en: 'Metal', hex: '#9AA0A6', seasonZh: '秋', seasonEn: 'Autumn', traitZh: '收敛 · 清明', traitEn: 'Gathering · clarity', lineKey: 'home.elements.metal' },
  { id: 'water', zh: '水', en: 'Water', hex: '#3F5B6E', seasonZh: '冬', seasonEn: 'Winter', traitZh: '流动 · 沉静', traitEn: 'Flow · quiet', lineKey: 'home.elements.water' },
];

export const ELEMENT_ZH = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
export const ELEMENT_EN = { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' };
export const ELEMENT_HEX = {
  wood: '#5F7D5A', fire: '#B14A36', earth: '#B08A57', metal: '#9AA0A6', water: '#3F5B6E',
};
export const ELEMENT_NAMES = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

export function elementLabel(id) {
  return lang === 'en' ? (ELEMENT_EN[id] || id) : (ELEMENT_ZH[id] || id);
}

export function roleLabel(role) {
  const labels = {
    main: { zh: '主珠', en: 'Main' },
    support: { zh: '辅珠', en: 'Support' },
    accent: { zh: '点缀', en: 'Accent' },
  };
  return pick(labels[role] || labels.main);
}

export function applyUrlLangToDocument() {
  applyDocumentLang();
}
