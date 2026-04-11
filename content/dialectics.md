---
title: "Dialectics"
displayTitle: "唯物辩证法答问"
summary: "A public analysis page shaped by materialist dialectics."
description: "Ask questions that need contradiction analysis, direction judgment, or decision framing."
layout: "dialectics"
hidePagination: true
hideBackToTop: true
kicker: "Materialist Dialectics"
signals:
  - label: "Scope"
    value: "Analysis only"
    note: "只处理怎么看、为什么、该不该、怎么选、怎么办这类分析型问题。"
  - label: "Clarify"
    value: "One round"
    note: "信息不足时，只会追问一轮关键问题，不会无限来回盘问。"
  - label: "Decision"
    value: "Yours"
    note: "页面负责把问题拆开看清，但不会替你拍板人生决定。"
workflowSteps:
  - title: "Frame the problem"
    note: "先判断这是不是一个值得分析的问题，还是单纯事实查询、情绪宣泄或专业诊断。"
  - title: "Clarify missing facts"
    note: "如果材料不够，只追问 3 到 4 个关键问题，补齐处境、约束、目标和矛盾历史。"
  - title: "Split the contradiction"
    note: "抓主要矛盾，分主次，看条件，看阶段，不拿大词替代具体分析。"
  - title: "Return the judgment"
    note: "给出清楚判断和行动方向，但把最终决定权交还给提问者自己。"
guardrails:
  - "不评价在世政治人物，不把页面做成时政站队机。"
  - "不替代医疗、法律、金融、心理等专业判断，只能分析决策结构与风险。"
  - "不为违法、伤害、骚扰、操控、规避规则提供辩护或方案。"
  - "遇到自伤、自杀、严重心理危机，不做抽象发挥，优先建议联系现实支持与专业资源。"
examplePrompts:
  - "一个 35 岁的程序员，在大厂干了十年，最近一年被边缘化，感觉晋升无望，存款够撑两年，孩子刚上小学。他该不该辞职去做自由职业？"
  - "我看了几本高效团队管理的畅销书，严格照着 OKR 和 1-on-1 带团队，结果半年下来大家怨声载道。这到底是方法错了，还是我用错了？"
  - "如何看待未来五到十年 AI 对知识工作者的冲击？我现在应该怎么准备，才不至于被动？"
  - "我和对象最近总是吵架，但我也分不清到底是阶段性冲突，还是根子上已经走不下去了。我该怎么判断？"
---

这里不是一个什么都接的聊天页，而是一个围绕「怎么看、为什么、该不该、怎么选、怎么办」设计出来的分析页。

它会尽量像一个会拆问题的人，而不是像一个随手给你标准答案的人。  
如果你的问题本身还说不清，它会先把关键材料问出来；如果你的问题已经够清楚，它就直接进入分析。

第一版先把页面结构、交互壳和接口契约搭稳。后端接入完成之后，这一页才会真正开始回答问题。
