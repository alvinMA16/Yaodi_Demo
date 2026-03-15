import type { BalanceConfig } from "./types.js";

export const defaultBalanceConfig: BalanceConfig = {
  versionName: "v1-demo",
  starterCardIds: ["brief-gov", "brief-corp", "brief-anti"],
  inquiryTargets: ["gov", "corp", "anti"],
  pressure: {
    retainedFactor: 0.05,
    destroyFactor: 3,
    bluePenalty: 2,
    redPenalty: 5,
    deathThreshold: 120
  },
  cards: [
    {
      id: "brief-gov",
      name: "政策摘要",
      rarity: "W",
      sourceFaction: "gov",
      description: "温和推动政府掌控局势。",
      effect: { gov: 2, corp: 0, anti: 0 },
      weight: 1,
      reusable: false,
      starter: true
    },
    {
      id: "brief-corp",
      name: "市场简报",
      rarity: "W",
      sourceFaction: "corp",
      description: "为公司争取舆论空间。",
      effect: { gov: 0, corp: 2, anti: 0 },
      weight: 1,
      reusable: false,
      starter: true
    },
    {
      id: "brief-anti",
      name: "街头证词",
      rarity: "W",
      sourceFaction: "anti",
      description: "强化反 AI 组织的合理性质疑。",
      effect: { gov: 0, corp: 0, anti: 2 },
      weight: 1,
      reusable: false,
      starter: true
    },
    {
      id: "gov-guidance",
      name: "政策定调",
      rarity: "W",
      sourceFaction: "gov",
      description: "政府再次强调监管方向，温和推动自身立场。",
      effect: { gov: 2, corp: 0, anti: 0 },
      weight: 5
    },
    {
      id: "gov-audit",
      name: "审计通报",
      rarity: "W",
      sourceFaction: "gov",
      description: "政府发布基础审计意见，轻度压制公司推进。",
      effect: { gov: 2, corp: -1, anti: 0 },
      weight: 4
    },
    {
      id: "gov-audit-plus",
      name: "专项审查",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府扩大审查范围，稳步提高监管影响力。",
      effect: { gov: 3, corp: 0, anti: 0 },
      weight: 4
    },
    {
      id: "gov-oversight",
      name: "监管协同",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府推动联合监管，在加强自身话语权的同时给公司留出协同空间。",
      effect: { gov: 2, corp: 1, anti: 0 },
      weight: 3
    },
    {
      id: "gov-mandate",
      name: "行政强令",
      rarity: "B",
      sourceFaction: "gov",
      description: "政府强推临时条例，快速扩大自身掌控力。",
      effect: { gov: 5, corp: 0, anti: 0 },
      weight: 2
    },
    {
      id: "gov-delay",
      name: "延期审批",
      rarity: "B",
      sourceFaction: "gov",
      description: "延后上线窗口，显著增加监管影响。",
      effect: { gov: 4, corp: -1, anti: 0 },
      weight: 2
    },
    {
      id: "gov-war-room",
      name: "国家决断",
      rarity: "R",
      sourceFaction: "gov",
      description: "最高层拍板，政府阵营获得爆发式推进。",
      effect: { gov: 8, corp: 0, anti: 0 },
      weight: 1
    },
    {
      id: "gov-crackdown",
      name: "紧急封控",
      rarity: "R",
      sourceFaction: "gov",
      description: "政府以紧急状态推进强硬政策，直接压制公司节奏。",
      effect: { gov: 6, corp: -2, anti: 0 },
      weight: 1
    },
    {
      id: "corp-ads",
      name: "投放攻势",
      rarity: "W",
      sourceFaction: "corp",
      description: "公司加大广告投放，温和提升市场接受度。",
      effect: { gov: 0, corp: 2, anti: 0 },
      weight: 5
    },
    {
      id: "corp-soften",
      name: "公关润色",
      rarity: "W",
      sourceFaction: "corp",
      description: "公司软化舆论，轻度压制反对组织声量。",
      effect: { gov: 0, corp: 2, anti: -1 },
      weight: 4
    },
    {
      id: "corp-partnership",
      name: "渠道合作",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司和下游生态结盟，让 AI 上线声势更稳。",
      effect: { gov: 0, corp: 3, anti: 0 },
      weight: 4
    },
    {
      id: "corp-bridge",
      name: "议题转移",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司把议题引向社会收益，同时和反对方形成短暂同盟。",
      effect: { gov: 0, corp: 2, anti: 1 },
      weight: 3
    },
    {
      id: "corp-surge",
      name: "资本冲锋",
      rarity: "B",
      sourceFaction: "corp",
      description: "资本市场全力推动项目，公司推进值大幅提升。",
      effect: { gov: 0, corp: 5, anti: 0 },
      weight: 2
    },
    {
      id: "corp-lobby",
      name: "游说活动",
      rarity: "B",
      sourceFaction: "corp",
      description: "公司影响政策空间，但会积累争议。",
      effect: { gov: 0, corp: 4, anti: -1 },
      weight: 2
    },
    {
      id: "corp-launch",
      name: "上市倒计时",
      rarity: "R",
      sourceFaction: "corp",
      description: "公司宣布最后冲刺，市场情绪被推到极限。",
      effect: { gov: 0, corp: 8, anti: 0 },
      weight: 1
    },
    {
      id: "corp-buyout",
      name: "并购清场",
      rarity: "R",
      sourceFaction: "corp",
      description: "公司通过并购和资源整合强推上线，同时压制反对声音。",
      effect: { gov: 0, corp: 6, anti: -2 },
      weight: 1
    },
    {
      id: "anti-protest",
      name: "抗议浪潮",
      rarity: "W",
      sourceFaction: "anti",
      description: "街头抗议扩大，反 AI 组织获得基础推进。",
      effect: { gov: 0, corp: 0, anti: 2 },
      weight: 5
    },
    {
      id: "anti-boycott",
      name: "抵制联署",
      rarity: "W",
      sourceFaction: "anti",
      description: "民间发起联署抵制，轻度削弱政府公信力。",
      effect: { gov: -1, corp: 0, anti: 2 },
      weight: 4
    },
    {
      id: "anti-watch",
      name: "监督倡议",
      rarity: "G",
      sourceFaction: "anti",
      description: "反对组织号召建立社会监督，稳步提升自身影响。",
      effect: { gov: 0, corp: 0, anti: 3 },
      weight: 4
    },
    {
      id: "anti-coalition",
      name: "舆论同盟",
      rarity: "G",
      sourceFaction: "anti",
      description: "反 AI 组织联动公共部门，把压力同步传给政府。",
      effect: { gov: 1, corp: 0, anti: 2 },
      weight: 3
    },
    {
      id: "anti-flashpoint",
      name: "街头爆点",
      rarity: "B",
      sourceFaction: "anti",
      description: "舆情短时间内快速发酵，反对阵营出现明显跃升。",
      effect: { gov: 0, corp: 0, anti: 5 },
      weight: 2
    },
    {
      id: "anti-pressure",
      name: "围堵行动",
      rarity: "B",
      sourceFaction: "anti",
      description: "反对组织集中施压，让政府立场出现动摇。",
      effect: { gov: -1, corp: 0, anti: 4 },
      weight: 2
    },
    {
      id: "anti-uprising",
      name: "全民反扑",
      rarity: "R",
      sourceFaction: "anti",
      description: "大规模反扑引爆舆论战，反 AI 组织取得压倒性推进。",
      effect: { gov: 0, corp: 0, anti: 8 },
      weight: 1
    },
    {
      id: "anti-leak",
      name: "内部泄密",
      rarity: "R",
      sourceFaction: "anti",
      description: "用高风险曝光重创公司公信力。",
      effect: { gov: 0, corp: -2, anti: 6 },
      weight: 1
    }
  ]
};
