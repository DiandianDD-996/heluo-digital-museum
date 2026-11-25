import {
  GUIDE_ARTIFACT_SLUG,
  GUIDE_EXHIBIT_SLUG,
  STONE_ARTIFACT_SLUG,
  STONE_EXHIBIT_SLUG,
  type GuideLocale,
  type GuidePageContext,
  type GuideStreamStatusPhase,
} from './guideTypes'

export interface GuideUiStrings {
  fabLabel: string
  fabAria: string
  title: string
  subtitle: string
  close: string
  clear: string
  clearConfirmAria: string
  expand: string
  compact: string
  copy: string
  copied: string
  regenerate: string
  retry: string
  ideasToggle: string
  ideasClose: string
  scrollBottom: string
  contextPrefix: string
  shortcutHint: string
  composerHint: string
  inputPlaceholder: string
  send: string
  stop: string
  aiBadge: string
  archiveBadge: string
  degradedHint: string
  sourcesToggle: string
  boundaryLabel: string
  dividerPrefix: string
  rateLimited: string
  networkError: string
  stoppedNotice: string
  statusLabels: Record<GuideStreamStatusPhase, string>
}

export interface QuickIntent {
  id: string
  label: string
  prompt: string
}

export interface RoutePreset {
  welcome: string
  starters: string[]
}

export function getGuideStrings(locale: GuideLocale): GuideUiStrings {
  if (locale === 'en-US') {
    return {
      fabLabel: 'Luosheng',
      fabAria: 'Open Luosheng AI museum guide',
      title: 'Luosheng',
      subtitle: 'Curatorial Guide · 3D Companion',
      close: 'Close guide',
      clear: 'Clear',
      clearConfirmAria: 'Clear conversation history',
      expand: 'Wider view',
      compact: 'Compact view',
      copy: 'Copy',
      copied: 'Copied ✓',
      regenerate: 'Regenerate',
      retry: 'Retry',
      ideasToggle: 'Prompt ideas',
      ideasClose: 'Hide ideas',
      scrollBottom: 'Latest ↓',
      contextPrefix: 'Context',
      shortcutHint: 'Alt+L',
      composerHint: 'Enter to send · Shift+Enter newline · Alt+L',
      inputPlaceholder: 'Ask about any exhibit, 3D detail, or visit slot…',
      send: 'Send',
      stop: 'Stop',
      aiBadge: 'AI Guide',
      archiveBadge: 'Archive Direct',
      degradedHint: 'Fallback to live museum archive',
      sourcesToggle: 'Sources & Notes',
      boundaryLabel: 'Scope & Boundaries',
      dividerPrefix: 'Viewing',
      rateLimited: 'You are asking a bit fast — please wait a moment and try again.',
      networkError: 'Unable to reach Luosheng right now. Please check your connection and try again.',
      stoppedNotice: 'Generation stopped.',
      statusLabels: {
        thinking: 'Thinking…',
        reading_archive: 'Reading museum archive…',
        searching_slots: 'Checking live appointment slots…',
      },
    }
  }
  return {
    fabLabel: '问洛笙',
    fabAria: '打开洛笙 AI 博物馆向导',
    title: '洛笙',
    subtitle: '策展向导 · 3D 展柜副驾',
    close: '收起向导',
    clear: '清空对话',
    clearConfirmAria: '清空当前对话记录',
    expand: '宽屏模式',
    compact: '标准宽度',
    copy: '复制',
    copied: '已复制 ✓',
    regenerate: '重新生成',
    retry: '重试发送',
    ideasToggle: '灵感提问',
    ideasClose: '收起灵感',
    scrollBottom: '回到底部 ↓',
    contextPrefix: '当前上下文',
    shortcutHint: 'Alt+L 唤起',
    composerHint: 'Enter 发送 · Shift+Enter 换行 · Alt+L 唤起',
    inputPlaceholder: '问器物细节、年代工艺或预约时段…',
    send: '发送',
    stop: '停止',
    aiBadge: 'AI 讲解',
    archiveBadge: '馆藏资料直出',
    degradedHint: '当前已自动回退至馆藏实时资料',
    sourcesToggle: '依据与边界',
    boundaryLabel: '资料边界',
    dividerPrefix: '已切换至',
    rateLimited: '提问频率稍快，请稍等片刻再试。',
    networkError: '暂时无法连接洛笙服务，请检查网络后再试。',
    stoppedNotice: '已停止生成。',
    statusLabels: {
      thinking: '正在组织讲解…',
      reading_archive: '正在查阅馆藏档案…',
      searching_slots: '正在查询公开预约时段…',
    },
  }
}

export function getRoutePreset(context: GuidePageContext, locale: GuideLocale): RoutePreset {
  const en = locale === 'en-US'
  const isDing = context.artifactSlug === GUIDE_ARTIFACT_SLUG || context.exhibitSlug === GUIDE_EXHIBIT_SLUG
  const isStoneExhibit = context.exhibitSlug === STONE_EXHIBIT_SLUG || (context.route === 'exhibit-detail' && context.artifactSlug === STONE_ARTIFACT_SLUG)

  if (context.route === 'exhibit-detail' && isStoneExhibit) {
    return en
      ? {
          welcome: 'You are at the Raking-Light Stone Stele table (EXHIBIT 02). Drag the grazing light to reveal chisel grooves, or ask how to read the Heluo spatial lines.',
          starters: [
            'How does low-angle raking light help inspect carved stone lines?',
            'What should I look for in the central five-dot node and main axes?',
            'Compare this carved stone slab with the River-map Jade Bi',
          ],
        }
      : {
          welcome: '你正站在《河洛图纹石板 · 斜射光刻痕检视台》前。拖动低角度侧光即可照出刀口阴影，也可以问我如何读懂石上的空间秩序。',
          starters: [
            '为什么低角度斜射光能把浅石刻的刀口看清楚？',
            '看这块图纹石板时，先抓哪三处线条与节点？',
            '把这块图纹石板和《河图玉璧》并置看有什么味道？',
          ],
        }
  }

  if (context.route === 'exhibit-detail' && isDing) {
    return en
      ? {
          welcome: 'You are in the 3D Bronze Ding gallery. Ask anything about its form, Shang ritual context, or click a button for a guided 3D tour.',
          starters: [
            'Give me a 3-step 3D tour of this Bronze Ding',
            'Why are only two legs visible from the side?',
            'How would a Ding like this be used in Shang rituals?',
          ],
        }
      : {
          welcome: '你正站在河洛青铜鼎 3D 展柜前。无论是它的造型门道、商代礼器背景，还是想直接开启 3D 三步导览，尽管问我。',
          starters: [
            '带我用 3D 三步导览看一遍这件青铜鼎',
            '侧面数来数去只有两条腿，是断了一条吗？',
            '商代人一般怎么用“鼎”，它和“爵”怎么配合？',
          ],
        }
  }

  if (context.route === 'artifact-detail' && isDing) {
    return en
      ? {
          welcome: 'This is the digital reproduction of the Heluo Bronze Ding (referencing CMA 1962.281). Ask about its period, dimensions, visual details, or open the 3D showcase.',
          starters: [
            'What dynasty and size is the reference Ding?',
            'Where was it excavated?',
            'Take me to the 3D showcase to inspect the three legs',
          ],
        }
      : {
          welcome: '这件河洛青铜鼎是参考克利夫兰艺术博物馆 1962.281 制作的数字重制展品。想知道它的年代、尺寸、看点，或直接切去 3D 展柜细看，都可以问我。',
          starters: [
            '这件鼎是什么年代、多大尺寸？',
            '它是在洛阳出土的吗？',
            '带我去 3D 展柜看看三足和双耳',
          ],
        }
  }

  if (context.route === 'artifact-detail') {
    const name = context.title || (en ? 'this exhibit' : '这件展品')
    return en
      ? {
          welcome: `You are viewing ${name}. I can explain its design story, compare it with other exhibits in the museum, or check if there are related articles.`,
          starters: [
            'What are the key visual details to notice here?',
            'Is this an original concept exhibit or a historical artifact?',
            'Compare this with the Heluo Bronze Ding',
          ],
        }
      : {
          welcome: `你正在浏览「${name}」。我可以陪你细读它的器形故事、说明概念展品与数字重制的区别，也可以和馆内其他藏品做对比。`,
          starters: [
            '这件展品最值得看哪些细节？',
            '它是真实出土文物还是概念展品？',
            '和河洛青铜鼎相比有什么不同？',
          ],
        }
  }

  if (context.route === 'article-detail') {
    return en
      ? {
          welcome: 'Reading a curatorial feature. Ask me to summarize key themes or recommend related artifacts in the collection.',
          starters: [
            'Summarize the main idea of this article',
            'Which artifacts in the museum relate to this topic?',
            'Check upcoming visit appointment slots',
          ],
        }
      : {
          welcome: '你正在阅读文化专题。我可以为你提炼主线观点，或者推荐与这篇专题呼应的馆内藏品。',
          starters: [
            '帮我提炼这篇专题的核心看点',
            '馆里有哪些藏品和这篇专题有关？',
            '看看最近几天还能预约入馆吗？',
          ],
        }
  }

  if (context.route === 'appointment') {
    return en
      ? {
          welcome: 'Planning an offline visit? I can check live open appointment slots across the next 365 days and explain group size rules (1–30 visitors).',
          starters: [
            'Which slots are open tomorrow?',
            'Can a group of 5 visit in the next 3 days?',
            'What are the booking rules and open window?',
          ],
        }
      : {
          welcome: '准备安排线下参观吗？我可以帮你实时查询未来一年（365 天）的公开可约时段和余量（每周一闭馆，单笔限 1–30 人）。',
          starters: [
            '明天还有哪些可预约时段？',
            '未来三天 5 个人能约哪一场？',
            '单笔预约最多支持多少人？',
          ],
        }
  }

  if (context.route === 'shop') {
    return en
      ? {
          welcome: 'Browsing the Heluo Museum Store. Ask about any item’s price, live stock, or the cultural motif behind its design.',
          starters: [
            'What items are currently in stock?',
            'Which souvenir relates to river motifs?',
            'Take me to the 3D Bronze Ding gallery',
          ],
        }
      : {
          welcome: '欢迎来到河洛文创。可以向我了解任意在售商品的价格、实时库存，以及它背后的河洛纹样灵感。',
          starters: [
            '现在有哪些文创商品在售、库存如何？',
            '哪件文创和河图纹样有关？',
            '带我去 3D 展厅看看青铜鼎',
          ],
        }
  }

  if (context.route === 'exhibits') {
    return en
      ? {
          welcome: 'Welcome to the 3D Digital Hall. Ask how to inspect the Heluo Bronze Ding in 3D or jump straight to a detail view.',
          starters: [
            'What should I look for first on the Bronze Ding 3D model?',
            'Focus on the bronze ding ears in 3D',
            'Compare solid mode and point cloud mode',
          ],
        }
      : {
          welcome: '欢迎来到 3D 数字展厅。你可以问我青铜鼎最值得观察的 3 处结构，也可以让我直接带你定位到 3D 局部视角。',
          starters: [
            '看青铜鼎 3D 模型最先应该看哪里？',
            '直接带我去 3D 展柜看鼎耳',
            '实体模式和点云模式各适合看什么？',
          ],
        }
  }

  // home & explore default
  return en
    ? {
        welcome: 'Hello, I am Luosheng, your Heluo Digital Museum curator-companion. Ask me for a custom visit route, deep artifact comparisons, 3D tours, shop picks, or live visit slots.',
        starters: [
          'Curate a 15-minute highlight route for my first visit',
          'Compare the 3D Bronze Ding with the concept exhibits',
          'Which visit slots are open over the next 7 days?',
        ],
      }
    : {
        welcome: '你好，我是河洛数字博物馆首席策展向导洛笙。想定制逛展路线、深度对比展品、开启 3D 青铜鼎导览，或查文创与未来一年（365 天）预约余量，随时问我。',
        starters: [
          '帮我规划一条 15 分钟的高光逛展路线',
          '把 3D 青铜鼎和原创概念展品放在一起对比讲讲',
          '帮我看看未来 7 天还有哪些可预约时段？',
        ],
      }
}

export function getQuickIntents(context: GuidePageContext, locale: GuideLocale): QuickIntent[] {
  const en = locale === 'en-US'
  const isDing = context.artifactSlug === GUIDE_ARTIFACT_SLUG || context.exhibitSlug === GUIDE_EXHIBIT_SLUG
  const isStoneExhibit = context.exhibitSlug === STONE_EXHIBIT_SLUG || (context.route === 'exhibit-detail' && context.artifactSlug === STONE_ARTIFACT_SLUG)

  if (context.route === 'exhibit-detail' && isStoneExhibit) {
    return en
      ? [
          { id: 'raking-why', label: 'Why raking light', prompt: 'Why does low-angle raking light reveal carved stone strokes clearly?' },
          { id: 'raking-axes', label: '3 focal points', prompt: 'What are the three key details to inspect first on the River-Map Stone slab?' },
          { id: 'raking-jade', label: 'Compare Jade Bi', prompt: 'Compare this carved stone slab with the River-map Jade Bi' },
          { id: 'visit-slots', label: 'Book a visit', prompt: 'Check open appointment slots for the next 7 days' },
        ]
      : [
          { id: 'raking-why', label: '斜射光原理', prompt: '为什么低角度斜射光能把浅石刻的刀口看清楚？' },
          { id: 'raking-axes', label: '看点三步', prompt: '看这块图纹石板时，先抓哪三处线条与节点？' },
          { id: 'raking-jade', label: '对比河图玉璧', prompt: '把这块图纹石板和《河图玉璧》并置看有什么味道？' },
          { id: 'visit-slots', label: '查可约时段', prompt: '看看未来 7 天还有哪些可预约时段？' },
        ]
  }

  if (context.route === 'exhibit-detail' && isDing) {
    return en
      ? [
          { id: 'ding-tour', label: '3D 3-step tour', prompt: 'Give me a 3-step 3D tour of this Bronze Ding' },
          { id: 'ding-ears', label: 'Inspect ears', prompt: 'Focus on the upright ears of the Bronze Ding in 3D' },
          { id: 'ding-legs', label: 'Three legs check', prompt: 'Why are only two legs visible from the side?' },
          { id: 'ding-slots', label: 'Book a visit', prompt: 'Check open appointment slots over the next 7 days' },
        ]
      : [
          { id: 'ding-tour', label: '3D 三步导览', prompt: '带我用 3D 三步导览看一遍这件青铜鼎' },
          { id: 'ding-ears', label: '看鼎耳特写', prompt: '帮我在 3D 里聚焦到青铜鼎的双立耳细节' },
          { id: 'ding-legs', label: '三足视角', prompt: '侧面数来数去只有两条腿，是断了一条吗？' },
          { id: 'ding-slots', label: '约线下看展', prompt: '帮我看看未来 7 天有哪些可约时段？' },
        ]
  }

  if (context.route === 'appointment') {
    return en
      ? [
          { id: 'slots-tomorrow', label: 'Tomorrow slots', prompt: 'Which appointment slots are open tomorrow?' },
          { id: 'slots-weekend', label: 'Next 7 days', prompt: 'Show open appointment slots for the next 7 days' },
          { id: 'slots-group', label: 'Group rules', prompt: 'What are the open booking window, Monday closure, and group size rules?' },
        ]
      : [
          { id: 'slots-tomorrow', label: '查明天余票', prompt: '明天还有哪些可预约时段？' },
          { id: 'slots-week', label: '未来 7 天', prompt: '帮我查未来 7 天每天的可预约时段和余量' },
          { id: 'slots-rules', label: '预约与闭馆规则', prompt: '馆方开放预约窗口是多久、周一闭馆吗、单笔最多几人？' },
        ]
  }

  if (context.route === 'shop') {
    return en
      ? [
          { id: 'shop-stock', label: 'Stock overview', prompt: 'Which museum store items are currently in stock and at what prices?' },
          { id: 'shop-motif', label: 'Design motifs', prompt: 'Which souvenirs draw inspiration from Heluo river patterns?' },
          { id: 'shop-ding', label: 'Open 3D Ding', prompt: 'Take me to the 3D Bronze Ding exhibit' },
        ]
      : [
          { id: 'shop-stock', label: '在售与库存', prompt: '现在有哪些文创商品在售、价格和实时库存如何？' },
          { id: 'shop-motif', label: '纹样灵感来源', prompt: '这些河洛文创分别对应馆里哪几件文物纹样？' },
          { id: 'shop-ding', label: '逛 3D 展厅', prompt: '带我去 3D 展厅看看河洛青铜鼎' },
        ]
  }

  if (context.route === 'artifact-detail') {
    return en
      ? [
          { id: 'art-details', label: 'Visual highlights', prompt: 'What are the key visual details to notice on this piece?' },
          { id: 'art-3d', label: 'Go to 3D hall', prompt: 'Take me to the 3D showcase to inspect details' },
          { id: 'art-compare', label: 'Compare Ding', prompt: 'Compare this exhibit with the Heluo Bronze Ding' },
        ]
      : [
          { id: 'art-details', label: '细节看点', prompt: '这件展品最值得看哪些纹饰与细节？' },
          { id: 'art-3d', label: '去 3D 展厅', prompt: '馆里哪件展品可以在 3D 展厅近距离旋转查看？' },
          { id: 'art-compare', label: '对比青铜鼎', prompt: '把这件展品和河洛青铜鼎放在一起对比讲讲' },
        ]
  }

  if (context.route === 'article-detail') {
    return en
      ? [
          { id: 'doc-summary', label: 'Key takeaways', prompt: 'Summarize the key curatorial ideas in this article' },
          { id: 'doc-artifacts', label: 'Related pieces', prompt: 'Which artifacts in the museum relate to this article?' },
          { id: 'doc-slots', label: 'Check slots', prompt: 'Which visit slots are open over the next 7 days?' },
        ]
      : [
          { id: 'doc-summary', label: '提炼要点', prompt: '帮我用三条重点概括这篇文化专题' },
          { id: 'doc-artifacts', label: '关联藏品', prompt: '馆里有哪些藏品和这篇专题主题相呼应？' },
          { id: 'doc-slots', label: '预约入馆', prompt: '看看未来 7 天还能预约入馆吗？' },
        ]
  }

  return en
    ? [
        { id: 'home-route', label: '15-min tour', prompt: 'Curate a 15-minute highlight route for my first visit' },
        { id: 'home-ding', label: '3D Bronze Ding', prompt: 'Take me to the 3D Bronze Ding exhibit for a quick tour' },
        { id: 'home-slots', label: 'Check slots', prompt: 'Which visit slots are open over the next 7 days?' },
        { id: 'home-shop', label: 'Shop picks', prompt: 'What cultural souvenirs are available in the museum store?' },
      ]
    : [
        { id: 'home-route', label: '15分钟路线', prompt: '帮我规划一条 15 分钟的高光逛展路线' },
        { id: 'home-ding', label: '看 3D 青铜鼎', prompt: '带我走进河洛青铜鼎 3D 展柜并做简要导览' },
        { id: 'home-slots', label: '查可约时段', prompt: '帮我看看未来 7 天还有哪些可预约时段？' },
        { id: 'home-shop', label: '推荐文创', prompt: '现在有哪些值得带走的河洛文创？' },
      ]
}
