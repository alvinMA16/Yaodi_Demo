import type { BalanceConfig, CardDefinition, CardEffectMode, CardRarity, Faction } from "./types.js";

function card(definition: CardDefinition) {
  return definition;
}

function dynamicCard(params: {
  id: string;
  name: string;
  rarity: CardRarity;
  sourceFaction: Faction;
  description: string;
  effectMode: CardEffectMode;
  effectLabel: string;
  weight: number;
}) {
  return card({
    ...params,
    effect: { gov: 0, corp: 0, anti: 0 }
  });
}

function orangeCard(params: {
  id: string;
  name: string;
  sourceFaction: Faction;
  description: string;
  orangeEffect:
    | "double_day_delta_today"
    | "market_swing_today"
    | "double_future_info_cards_no_retain"
    | "force_highest_inquiry_today"
    | "force_negative_target_today"
    | "lockstep_pair_today"
    | "swap_highest_lowest_today";
  effectLabel: string;
  weight: number;
}) {
  return card({
    ...params,
    rarity: "O",
    effect: { gov: 0, corp: 0, anti: 0 }
  });
}

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
    card({
      id: "brief-gov",
      name: "政策摘要",
      rarity: "W",
      sourceFaction: "gov",
      description: "温和推动政府掌控局势。",
      effect: { gov: 2, corp: 0, anti: 0 },
      weight: 1,
      reusable: false,
      starter: true
    }),
    card({
      id: "brief-corp",
      name: "市场简报",
      rarity: "W",
      sourceFaction: "corp",
      description: "为公司争取舆论空间。",
      effect: { gov: 0, corp: 2, anti: 0 },
      weight: 1,
      reusable: false,
      starter: true
    }),
    card({
      id: "brief-anti",
      name: "街头证词",
      rarity: "W",
      sourceFaction: "anti",
      description: "强化反 AI 组织的合理性质疑。",
      effect: { gov: 0, corp: 0, anti: 2 },
      weight: 1,
      reusable: false,
      starter: true
    }),
    card({
      id: "gov-guidance",
      name: "政策定调",
      rarity: "W",
      sourceFaction: "gov",
      description: "政府再次强调监管方向，温和推动自身立场。",
      effect: { gov: 2, corp: 0, anti: 0 },
      weight: 5
    }),
    card({
      id: "gov-audit",
      name: "审计通报",
      rarity: "W",
      sourceFaction: "gov",
      description: "政府发布基础审计意见，轻度压制公司推进。",
      effect: { gov: 2, corp: -1, anti: 0 },
      weight: 4
    }),
    card({
      id: "gov-audit-plus",
      name: "专项审查",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府扩大审查范围，稳步提高监管影响力。",
      effect: { gov: 3, corp: 0, anti: 0 },
      weight: 4
    }),
    card({
      id: "gov-oversight",
      name: "监管协同",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府推动联合监管，在加强自身话语权的同时给公司留出协同空间。",
      effect: { gov: 2, corp: 1, anti: 0 },
      weight: 3
    }),
    card({
      id: "gov-mandate",
      name: "行政强令",
      rarity: "B",
      sourceFaction: "gov",
      description: "政府强推临时条例，快速扩大自身掌控力。",
      effect: { gov: 5, corp: 0, anti: 0 },
      weight: 2
    }),
    card({
      id: "gov-delay",
      name: "延期审批",
      rarity: "B",
      sourceFaction: "gov",
      description: "延后上线窗口，显著增加监管影响。",
      effect: { gov: 4, corp: -1, anti: 0 },
      weight: 2
    }),
    card({
      id: "gov-war-room",
      name: "国家决断",
      rarity: "R",
      sourceFaction: "gov",
      description: "最高层拍板，政府阵营获得爆发式推进。",
      effect: { gov: 8, corp: 0, anti: 0 },
      weight: 1
    }),
    card({
      id: "gov-crackdown",
      name: "紧急封控",
      rarity: "R",
      sourceFaction: "gov",
      description: "政府以紧急状态推进强硬政策，直接压制公司节奏。",
      effect: { gov: 6, corp: -2, anti: 0 },
      weight: 1
    }),
    card({
      id: "corp-ads",
      name: "投放攻势",
      rarity: "W",
      sourceFaction: "corp",
      description: "公司加大广告投放，温和提升市场接受度。",
      effect: { gov: 0, corp: 2, anti: 0 },
      weight: 5
    }),
    card({
      id: "corp-soften",
      name: "公关润色",
      rarity: "W",
      sourceFaction: "corp",
      description: "公司软化舆论，轻度压制反对组织声量。",
      effect: { gov: 0, corp: 2, anti: -1 },
      weight: 4
    }),
    card({
      id: "corp-partnership",
      name: "渠道合作",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司和下游生态结盟，让 AI 上线声势更稳。",
      effect: { gov: 0, corp: 3, anti: 0 },
      weight: 4
    }),
    card({
      id: "corp-bridge",
      name: "议题转移",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司把议题引向社会收益，同时和反对方形成短暂同盟。",
      effect: { gov: 0, corp: 2, anti: 1 },
      weight: 3
    }),
    card({
      id: "corp-surge",
      name: "资本冲锋",
      rarity: "B",
      sourceFaction: "corp",
      description: "资本市场全力推动项目，公司推进值大幅提升。",
      effect: { gov: 0, corp: 5, anti: 0 },
      weight: 2
    }),
    card({
      id: "corp-lobby",
      name: "游说活动",
      rarity: "B",
      sourceFaction: "corp",
      description: "公司影响政策空间，但会积累争议。",
      effect: { gov: 0, corp: 4, anti: -1 },
      weight: 2
    }),
    card({
      id: "corp-launch",
      name: "上市倒计时",
      rarity: "R",
      sourceFaction: "corp",
      description: "公司宣布最后冲刺，市场情绪被推到极限。",
      effect: { gov: 0, corp: 8, anti: 0 },
      weight: 1
    }),
    card({
      id: "corp-buyout",
      name: "并购清场",
      rarity: "R",
      sourceFaction: "corp",
      description: "公司通过并购和资源整合强推上线，同时压制反对声音。",
      effect: { gov: 0, corp: 6, anti: -2 },
      weight: 1
    }),
    card({
      id: "anti-protest",
      name: "抗议浪潮",
      rarity: "W",
      sourceFaction: "anti",
      description: "街头抗议扩大，反 AI 组织获得基础推进。",
      effect: { gov: 0, corp: 0, anti: 2 },
      weight: 5
    }),
    card({
      id: "anti-boycott",
      name: "抵制联署",
      rarity: "W",
      sourceFaction: "anti",
      description: "民间发起联署抵制，轻度削弱政府公信力。",
      effect: { gov: -1, corp: 0, anti: 2 },
      weight: 4
    }),
    card({
      id: "anti-watch",
      name: "监督倡议",
      rarity: "G",
      sourceFaction: "anti",
      description: "反对组织号召建立社会监督，稳步提升自身影响。",
      effect: { gov: 0, corp: 0, anti: 3 },
      weight: 4
    }),
    card({
      id: "anti-coalition",
      name: "舆论同盟",
      rarity: "G",
      sourceFaction: "anti",
      description: "反 AI 组织联动公共部门，把压力同步传给政府。",
      effect: { gov: 1, corp: 0, anti: 2 },
      weight: 3
    }),
    card({
      id: "anti-flashpoint",
      name: "街头爆点",
      rarity: "B",
      sourceFaction: "anti",
      description: "舆情短时间内快速发酵，反对阵营出现明显跃升。",
      effect: { gov: 0, corp: 0, anti: 5 },
      weight: 2
    }),
    card({
      id: "anti-pressure",
      name: "围堵行动",
      rarity: "B",
      sourceFaction: "anti",
      description: "反对组织集中施压，让政府立场出现动摇。",
      effect: { gov: -1, corp: 0, anti: 4 },
      weight: 2
    }),
    card({
      id: "anti-uprising",
      name: "全民反扑",
      rarity: "R",
      sourceFaction: "anti",
      description: "大规模反扑引爆舆论战，反 AI 组织取得压倒性推进。",
      effect: { gov: 0, corp: 0, anti: 8 },
      weight: 1
    }),
    card({
      id: "anti-leak",
      name: "内部泄密",
      rarity: "R",
      sourceFaction: "anti",
      description: "用高风险曝光重创公司公信力。",
      effect: { gov: 0, corp: -2, anti: 6 },
      weight: 1
    }),
    card({
      id: "gov-public-briefing",
      name: "公开简报",
      rarity: "W",
      sourceFaction: "gov",
      description: "一份面向全社会的公开简报，让三方议题同时升温。",
      effect: { gov: 1, corp: 1, anti: 1 },
      weight: 2
    }),
    dynamicCard({
      id: "gov-weak-side-protection",
      name: "弱侧兜底",
      rarity: "W",
      sourceFaction: "gov",
      description: "政府选择扶住当前最弱的一方，防止局面过早失衡。",
      effectMode: "boost_lowest_2",
      effectLabel: "+2 当前最低阵营",
      weight: 2
    }),
    card({
      id: "gov-cooling-notice",
      name: "降温通知",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府发出降温通知，让三方都暂时收敛一步。",
      effect: { gov: -1, corp: -1, anti: -1 },
      weight: 2
    }),
    dynamicCard({
      id: "gov-balance-order",
      name: "平衡指令",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府要求压一压当前最强者，同时给最弱者一点喘息空间。",
      effectMode: "shift_high_to_low_1",
      effectLabel: "-1 当前最高阵营 / +1 当前最低阵营",
      weight: 2
    }),
    dynamicCard({
      id: "gov-reallocation-plan",
      name: "重新配额",
      rarity: "B",
      sourceFaction: "gov",
      description: "政府强制再分配资源，明显压缩领先方和落后方之间的差距。",
      effectMode: "shift_high_to_low_2",
      effectLabel: "-2 当前最高阵营 / +2 当前最低阵营",
      weight: 1
    }),
    card({
      id: "gov-systemic-signal",
      name: "系统信号",
      rarity: "B",
      sourceFaction: "gov",
      description: "政府释放强烈信号，三方关注度同步抬升。",
      effect: { gov: 2, corp: 2, anti: 2 },
      weight: 1
    }),
    dynamicCard({
      id: "gov-forced-balance",
      name: "强制均衡",
      rarity: "R",
      sourceFaction: "gov",
      description: "政府直接对最强者动刀，并用同等力度扶起最弱者。",
      effectMode: "shift_high_to_low_3",
      effectLabel: "-3 当前最高阵营 / +3 当前最低阵营",
      weight: 1
    }),
    orangeCard({
      id: "gov-market-swing",
      name: "盘口",
      sourceFaction: "gov",
      description: "日终随机选中一个阵营，其今日净变化 x2，另外两方改为 0.5 倍。",
      orangeEffect: "market_swing_today",
      effectLabel: "日终随机结算：1 个阵营 x2，其余阵营 x0.5",
      weight: 1
    }),
    orangeCard({
      id: "gov-ban-order",
      name: "禁牌",
      sourceFaction: "gov",
      description: "选择一个阵营，使其今日最终净变化必为负值，但日终额外压力 +25。",
      orangeEffect: "force_negative_target_today",
      effectLabel: "选择 1 个阵营：今日净变化强制为负；日终压力 +25",
      weight: 1
    }),
    orangeCard({
      id: "gov-coup",
      name: "政变",
      sourceFaction: "gov",
      description: "日终互换当前最高阵营与最低阵营的最终数值；若最终不是强胜利，你会直接死亡。",
      orangeEffect: "swap_highest_lowest_today",
      effectLabel: "日终互换最高与最低阵营；若最终不是强胜利则死亡",
      weight: 1
    }),
    card({
      id: "gov-emergency-broadcast",
      name: "紧急播报",
      rarity: "R",
      sourceFaction: "gov",
      description: "突发播报把整场争端都推上了更高烈度。",
      effect: { gov: 3, corp: 3, anti: 3 },
      weight: 1
    }),
    card({
      id: "corp-market-buzz",
      name: "市场热词",
      rarity: "W",
      sourceFaction: "corp",
      description: "公司放出新热词，市场和舆论一起被带热。",
      effect: { gov: 1, corp: 1, anti: 1 },
      weight: 2
    }),
    dynamicCard({
      id: "corp-underdog-bet",
      name: "押注弱侧",
      rarity: "W",
      sourceFaction: "corp",
      description: "公司先扶起最弱的一方，试图制造对自己更有利的新均势。",
      effectMode: "boost_lowest_2",
      effectLabel: "+2 当前最低阵营",
      weight: 2
    }),
    card({
      id: "corp-pr-cooling",
      name: "降温公关",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司尝试整体降温，让争端暂时都退一步。",
      effect: { gov: -1, corp: -1, anti: -1 },
      weight: 2
    }),
    dynamicCard({
      id: "corp-market-rebalance",
      name: "市场再平衡",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司压低风头最盛的一方，同时让最弱一方进入可谈判区间。",
      effectMode: "shift_high_to_low_1",
      effectLabel: "-1 当前最高阵营 / +1 当前最低阵营",
      weight: 2
    }),
    dynamicCard({
      id: "corp-liquidity-tilt",
      name: "流动性倾斜",
      rarity: "B",
      sourceFaction: "corp",
      description: "公司用资本重新灌注局势，明显拉近领先方和落后方的距离。",
      effectMode: "shift_high_to_low_2",
      effectLabel: "-2 当前最高阵营 / +2 当前最低阵营",
      weight: 1
    }),
    card({
      id: "corp-platform-wave",
      name: "平台联动",
      rarity: "B",
      sourceFaction: "corp",
      description: "平台矩阵同步发力，让三方争端一起升温。",
      effect: { gov: 2, corp: 2, anti: 2 },
      weight: 1
    }),
    dynamicCard({
      id: "corp-capital-reshuffle",
      name: "资本洗牌",
      rarity: "R",
      sourceFaction: "corp",
      description: "公司大规模洗牌，把最强者拉下，同时强行扶起最弱者。",
      effectMode: "shift_high_to_low_3",
      effectLabel: "-3 当前最高阵营 / +3 当前最低阵营",
      weight: 1
    }),
    orangeCard({
      id: "corp-all-in",
      name: "梭哈",
      sourceFaction: "corp",
      description: "仅限 Day 7 使用。日终会把今天的全部阵营变化整体翻倍，包括玩家打牌与世界自动波动。",
      orangeEffect: "double_day_delta_today",
      effectLabel: "仅限 Day 7：今日全部变化 x2",
      weight: 1
    }),
    orangeCard({
      id: "corp-bet-on-top",
      name: "押宝",
      sourceFaction: "corp",
      description: "选择一个阵营，该阵营今天的质询强制提升到最高人物层级；若日终不是第一，直接死亡。",
      orangeEffect: "force_highest_inquiry_today",
      effectLabel: "选择 1 个阵营：今日强制最高层级；若不领先则死亡",
      weight: 1
    }),
    card({
      id: "corp-full-spectrum-campaign",
      name: "全网轰炸",
      rarity: "R",
      sourceFaction: "corp",
      description: "公司全平台投放，把三方数值一起推高。",
      effect: { gov: 3, corp: 3, anti: 3 },
      weight: 1
    }),
    card({
      id: "anti-public-discussion",
      name: "全民讨论",
      rarity: "W",
      sourceFaction: "anti",
      description: "反 AI 阵营把争议拉到全民讨论层面，三方都被卷入。",
      effect: { gov: 1, corp: 1, anti: 1 },
      weight: 2
    }),
    dynamicCard({
      id: "anti-support-the-weak",
      name: "扶弱声援",
      rarity: "W",
      sourceFaction: "anti",
      description: "反 AI 阵营优先扶持当下最弱一方，制造新的舆论焦点。",
      effectMode: "boost_lowest_2",
      effectLabel: "+2 当前最低阵营",
      weight: 2
    }),
    card({
      id: "anti-call-for-calm",
      name: "冷静呼吁",
      rarity: "G",
      sourceFaction: "anti",
      description: "反 AI 阵营主张冷静，让三方暂时一起退一步。",
      effect: { gov: -1, corp: -1, anti: -1 },
      weight: 2
    }),
    dynamicCard({
      id: "anti-street-mediation",
      name: "街头调停",
      rarity: "G",
      sourceFaction: "anti",
      description: "街头调停会压低过热的一方，并给落后者更多发声空间。",
      effectMode: "shift_high_to_low_1",
      effectLabel: "-1 当前最高阵营 / +1 当前最低阵营",
      weight: 2
    }),
    dynamicCard({
      id: "anti-reverse-pressure",
      name: "反向施压",
      rarity: "B",
      sourceFaction: "anti",
      description: "反 AI 阵营把矛头对准最强者，并集中火力抬高最弱者。",
      effectMode: "shift_high_to_low_2",
      effectLabel: "-2 当前最高阵营 / +2 当前最低阵营",
      weight: 1
    }),
    card({
      id: "anti-public-agenda",
      name: "公共议程",
      rarity: "B",
      sourceFaction: "anti",
      description: "反 AI 阵营主导公共议程，让三方都进入高压状态。",
      effect: { gov: 2, corp: 2, anti: 2 },
      weight: 1
    }),
    dynamicCard({
      id: "anti-opinion-flip",
      name: "舆论翻盘",
      rarity: "R",
      sourceFaction: "anti",
      description: "反 AI 阵营把最强者拖回地面，并用同样力度把最弱者顶上来。",
      effectMode: "shift_high_to_low_3",
      effectLabel: "-3 当前最高阵营 / +3 当前最低阵营",
      weight: 1
    }),
    orangeCard({
      id: "anti-public-opinion",
      name: "舆情",
      sourceFaction: "anti",
      description: "剩余天数里信息卡效果 x2，但日终不得留存任何信息卡，否则直接死亡。",
      orangeEffect: "double_future_info_cards_no_retain",
      effectLabel: "剩余天数信息卡 x2；日终不得留牌",
      weight: 1
    }),
    orangeCard({
      id: "anti-twin-kill",
      name: "双杀",
      sourceFaction: "anti",
      description: "选择两个阵营，让它们今天必须同涨同跌；若最终任一阵营落败，你会直接死亡。",
      orangeEffect: "lockstep_pair_today",
      effectLabel: "选择 2 个阵营：今日同涨同跌；若最终任一落败则死亡",
      weight: 1
    }),
    card({
      id: "anti-nationwide-focus",
      name: "全国聚焦",
      rarity: "R",
      sourceFaction: "anti",
      description: "全国目光被重新聚焦，三方烈度同时拉高。",
      effect: { gov: 3, corp: 3, anti: 3 },
      weight: 1
    })
  ]
};
