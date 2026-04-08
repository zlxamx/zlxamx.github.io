# Article Check Standards

## Table Of Contents

- [1. How To Use These Standards](#1-how-to-use-these-standards)
- [2. Hard Rules: Punctuation, Spacing, Capitalization, Numbers](#2-hard-rules-punctuation-spacing-capitalization-numbers)
- [3. Wording And Tone](#3-wording-and-tone)
- [4. Concept And Term Precision](#4-concept-and-term-precision)
- [5. Reader Experience And Structure](#5-reader-experience-and-structure)
- [6. Risky Vocabulary](#6-risky-vocabulary)
- [7. Severity Rubric And Reporting](#7-severity-rubric-and-reporting)

## 1. How To Use These Standards

- Judge in this order: meaning, then hard formatting, then wording, then polish.
- Prefer concrete explanations over taste judgments.
- Distinguish `硬性规范` from `语境性建议`.
- When rules conflict, preserve meaning first.
- For direct quotation, satire, or deliberate stylization, mark the exception instead of flattening the text.

## 2. Hard Rules: Punctuation, Spacing, Capitalization, Numbers

### 2.1 Chinese body text uses full-width punctuation

- 标准：中文正文统一使用全角标点。
- 能做：今天，我们讨论写作。
- 不能做：今天,我们讨论写作.
- 备注：英文原句、代码、命令、URL 保持原样。

### 2.2 Chinese quotation marks use 「」 and 『』

- 标准：一级引号用「」，二级引号用『』。
- 能做：她说：「我最喜欢『说人话』这个标准。」
- 不能做：“她说：‘我最喜欢‘说人话’这个标准。’”
- 备注：若项目已有明确 house style 且全篇一致，可按既有规范执行。

### 2.3 Chinese dash and ellipsis use Chinese forms

- 标准：中文破折号用 `——`，省略号用 `……`。
- 能做：他停了停——又继续说下去。 我想了很久……
- 不能做：他停了停--又继续说下去。 我想了很久......
- 备注：英文句子遵守英文自己的标点规则。

### 2.4 Express alternatives with `/`, not `\`

- 标准：表达“或 / 和 / 并列方案”时用 `/`，不用 `\`。
- 能做：你可以选方案 A / B。
- 不能做：你可以选方案 A \ B。

### 2.5 English words and product names keep official casing

- 标准：英文单词、品牌、产品名、系统名保持官方大小写。
- 能做：GitHub、Android、macOS、iPhone、ChatGPT。
- 不能做：Github、android、Macos、IPhone、chatgpt。
- 备注：不确定时先查官方写法，再决定是否保留原名或翻译。

### 2.6 Mixed Chinese and English need spacing

- 标准：中文与英文之间留空格。
- 能做：这篇文章发布在 GitHub Pages 上。
- 不能做：这篇文章发布在GitHub Pages上。
- 备注：中文标点与前面的英文词之间不再额外补空格，例如 `使用 GitHub。`

### 2.7 Mixed Chinese and Arabic numerals need spacing

- 标准：中文与阿拉伯数字之间留空格。
- 能做：一年有 365 天。 这个功能在 2026 年上线。
- 不能做：一年有365天。 这个功能在2026年上线。
- 备注：固定写法如 `5G`、`A4`、`iPhone 16`、版本号、URL 可按整体 token 保留。

### 2.8 English punctuation uses half-width forms and normal spacing

- 标准：英文标点使用半角，逗号、句号、分号等后面补一个空格。
- 能做：Write clearly, then write beautifully.
- 不能做：Write clearly ,then write beautifully .
- 备注：中文句子里不要硬套英文标点习惯。

### 2.9 Prefer Chinese numerals for generic one-digit counts

- 标准：非技术、非计量、非编号语境下，单个数字优先写成中文数字。
- 能做：三个问题、两种方法、写了八年。
- 不能做：3 个问题、2 种方法、写了 8 年。
- 备注：日期、编号、排名、章节、统计值、精确参数、产品型号可继续使用阿拉伯数字。

### 2.10 Use Arabic numerals for precise or statistical values

- 标准：凡是需要精确表达的数量、比例、日期、版本、金额、统计值，优先使用阿拉伯数字。
- 能做：留存率提高了 12.6%。 第 3 章。 2026-04-07。
- 不能做：留存率提高了百分之十二点六。 第三章。 二零二六年四月七日。
- 备注：关键是“易读”和“可核对”。

## 3. Wording And Tone

### 3.1 Do not use a word only because it is fashionable

- 标准：流行词、黑话、管理学套话、互联网热词，如果不能提供额外信息，就应替换。
- 能做：这段论证缺少前提和证据。
- 不能做：这段论证的颗粒度不够，叙事闭环也没立住。
- 备注：判断方法是删掉热词后，看看信息有没有损失。没有损失，就该删。

### 3.2 Avoid cliches and canned phrases

- 标准：陈词滥调、模板化成语、现成口号，只要不能推进文章，就要删或改写。
- 能做：不同读者会得出不同理解。
- 不能做：一千个人眼里有一千个哈姆雷特。
- 备注：如果是故意引用、反讽、二次创作，可以保留，但要确认读者能看出来。

### 3.3 Avoid borrowed voices that do not belong to the article

- 标准：不要无缘无故套用新闻播报腔、淘宝客服腔、公关稿腔、成功学腔。
- 能做：我们修复了这个问题，原因是缓存策略写错了。
- 不能做：带着这个问题，我们走访了多位用户。
- 不能做：亲，这个问题已经帮你处理好了哦。
- 备注：个人风格可以鲜明，但不要借来一整套现成腔调顶替思考。

### 3.4 Do not show off cleverness when plain language works

- 标准：在不损失信息的前提下，优先选更直接、更短、更正常的表达。
- 能做：淘宝腔也是一种特殊文风。
- 不能做：淘宝文风是特殊文风的又一个子集。
- 备注：术语只有在真的能省去解释成本时才值得保留。

### 3.5 Say human things, not inflated abstractions

- 标准：优先使用具体、可感、可验证的表达，而不是空泛的大词。
- 能做：这个功能离线时会失败。
- 不能做：该能力全面赋能用户体验升级。
- 备注：如果一句话里全是“价值、体验、效率、升级、能力”之类的抽象名词，通常就该重写。

### 3.6 Do not write praise or certainty you do not believe

- 标准：警惕表演性赞美、假装庄重、借来的共识、没有证据的豪言。
- 能做：我不确定这次更新是否值得长期投入。
- 不能做：这是一场颠覆行业的历史性升级。
- 备注：除非文章紧接着拿出证据，否则这种句子几乎一定要改。

### 3.7 Replace empty intensifiers with evidence

- 标准：像“非常、极其、巨大、显著、全面、彻底”这类加强词，没有证据时应减弱或删除。
- 能做：这个改动让加载时间从 3 秒降到 1.2 秒。
- 不能做：这个改动显著提升了性能。
- 备注：能量化就量化，不能量化就描述具体变化。

## 4. Concept And Term Precision

### 4.1 Define load-bearing abstract terms in local context

- 标准：凡是承担论点的抽象词，第一次认真使用时就要给出本文语境下的定义。
- 能做：本文里的「主体性」指一个人能否自己形成判断，并承担判断的后果。
- 不能做：年轻人最缺的是主体性。
- 备注：`主体性`、`自由`、`理性`、`系统性`、`客观` 这类词，默认都需要定义。

### 4.2 Separate the label from the concept

- 标准：同一个中文词可能对应多个概念，同一个概念也可能被不同中文词翻译出来。不要把“词”当成“概念”本身。
- 能做：这里的「主体」是哲学上的 subject，不是语法里的主语。
- 不能做：把 `主体性`、`主观性`、`subjectivity` 当成天然可互换的同义词。
- 备注：遇到理论词、翻译词、跨学科词，先审概念映射，再审句子。

### 4.3 Do not silently switch meanings mid-article

- 标准：一个关键词在文中一旦被定义，就不要让它悄悄滑向另一层意思。
- 能做：下文转到大众心理学语境里谈「主体性」，不再沿用前面的哲学定义。
- 不能做：前文把「主体性」当作能动性，后文又拿它指忠于自我的程度，中间却没有提醒。
- 备注：一旦发生换义，必须明示“我现在改用另一层意思”。

### 4.4 Check source-language and disciplinary context for imported terms

- 标准：外来术语、翻译词、学科词，优先核对原语词义或学科语境，再决定中文写法。
- 能做：先确认 `agency` 在当前语境里更接近 `能动性` 还是别的概念。
- 不能做：只因为网上很多人都这么翻，就直接沿用。
- 备注：如果无法核实，也要告诉读者“这里采用的是工作性翻译”。

### 4.5 Admit ambiguity instead of pretending universal agreement

- 标准：没有统一定义时，要明确告诉读者“本文怎么用这个词”，而不是假装全世界都同意。
- 能做：中文互联网常把这几个词混用，本文只取其中一义。
- 不能做：这个词本来就只有一种标准理解。
- 备注：当文章的说服力依赖于一个模糊词时，模糊本身就是问题。

### 4.6 Prefer narrower and testable words

- 标准：如果一个大词可以拆成动作、关系、机制、例子，就优先拆开。
- 能做：她会独立作决定，也愿意承担后果。
- 不能做：她的主体性很强。
- 备注：抽象判断必须能回落到可观察行为，否则容易沦为空话。

### 4.7 Give a contrast, boundary, or example for abstract claims

- 标准：抽象概念至少配一个例子、反例、边界条件或对照项。
- 能做：这里说的「主观」是依赖个人感受判断，例如“我就是觉得它高级”。
- 不能做：这完全是一种主观性。
- 备注：如果读者无法从上下文判断“到底算不算”，说明概念还没落地。

### 4.8 Use wording as a test of thinking

- 标准：如果作者无法用一两句普通话解释一个词，那它还不适合承担论证任务。
- 能做：把大词换成简单句，再检查意思有没有变化。
- 不能做：用一个模糊大词把整段论证糊过去。
- 备注：很多“用词问题”其实是“思考还没做完”的信号。

## 5. Reader Experience And Structure

### 5.1 Every paragraph should earn the reader's attention

- 标准：每一段都要提供信息、推进论证、交付情绪或建立必要场景，不能只是作者自我陶醉。
- 能做：开头一段就交代问题、判断和 stakes。
- 不能做：连写三段自我抒情，却还没进入主题。
- 备注：创作性随笔可以慢一点，但也要让读者知道为什么值得继续读。

### 5.2 Give the reader a concrete payoff early

- 标准：长文尤其要尽快让读者看到核心问题、主要判断或最有用的信息。
- 能做：开头 2-4 段内说明“这篇文章要解决什么”。
- 不能做：铺垫很久，只让读者等“真正内容”出现。
- 备注：不是不能铺垫，而是铺垫也要服务主题。

### 5.3 Length is not depth

- 标准：不要把“长”“万字”“深度”当作品质本身；重复、绕远、空转都该删。
- 能做：用 800 字说清楚，就不要硬写成 3000 字。
- 不能做：为了显得认真，把同一个意思换四种说法重复四次。
- 备注：真正的深度来自前提、区分、证据、例子，而不是字数。

### 5.4 Use the read-aloud test

- 标准：句子如果一口气读不顺，通常就该拆；段落如果朗读时看不出重音，通常就该重组。
- 能做：一句只承担一个主要动作或判断。
- 不能做：主句、插话、转折、补充说明全部缠在一个超长句里。
- 备注：这条对中文尤其有用，因为很多坏句子眼读能过，嘴读就露馅。

## 6. Risky Vocabulary

### 6.1 Default hard-ban list

- 标准：下面这些词默认不进入正常正文，除非是在引用、分析、角色对白或明确模仿某种语体。
- 默认禁用：屌丝、白富美、高富帅、高大上、富二代、红二代、军二代、安利（动词）、撕逼、尼玛（语气助词）、也是醉了、有木有、美女、帅哥、给力。
- 能做：推荐、争吵、粗糙、吸引人、令人喜欢。
- 不能做：我来安利一下这个工具。 这篇文章太给力了。 这种撕逼没意义。
- 备注：故意把粗口写成缩写、拼音、字母替代，也按同一规则处理。

### 6.2 Default caution list

- 标准：下面这些词不是绝对禁用，但一旦出现，就要检查它是否真的表达了可验证信息。
- 慎用词：情怀、物欲横流、众所周知、简约、唯美、精品、行为艺术、low、人工智能。
- 能做：这个页面只有三个颜色和一种字号层级，因此显得克制。
- 不能做：这个页面非常简约唯美。
- 能做：这不是通用 AI，而是一个做分类和召回的模型。
- 不能做：我们用人工智能重塑写作体验。
- 备注：这类词经常承担“态度展示”而不是“信息传达”。

## 7. Severity Rubric And Reporting

### 7.1 `Must Fix`

- 含义：不改会直接损伤意思、制造误解、破坏基本规范，或明显拉低文本质量。
- 典型情况：关键词未定义、概念混用、错误大小写、错误标点体系、明显违禁词、无证据的重大断言。

### 7.2 `Should Fix`

- 含义：不改仍能读，但会削弱说服力、可信度、气质或可读性。
- 典型情况：热词、套话、陈词滥调、借来的腔调、空泛抽象、铺垫过长、重复论述。

### 7.3 `Polish`

- 含义：不改也能发，但改了会更紧、更顺、更鲜明。
- 典型情况：节奏不稳、词语重复、轻微啰嗦、例子还能更具体。

### 7.4 Default report format

- `Verdict`：`可发布` / `发布前需修改` / `不建议发布`
- `Must Fix`：逐条列出摘录、规则、原因、建议改法
- `Should Fix`：逐条列出摘录、规则、原因、建议改法
- `Polish`：逐条列出可选优化
- `What Already Works`：列出值得保留的 2-5 个优点

### 7.5 Judgment reminder

- 先问“这句话到底在说什么”，再问“这句话写得漂不漂亮”。
- 先修概念，再修文风；先修硬错，再修口味。
- 如果一句话的问题来自作者尚未想清楚，不要只给词语替换，要指出“这里需要补定义 / 例子 / 前提 / 边界”。
