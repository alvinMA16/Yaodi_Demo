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
      id: "gov-audit",
      name: "审计通报",
      rarity: "G",
      sourceFaction: "gov",
      description: "政府加强审查，同时压制公司推进速度。",
      effect: { gov: 3, corp: -1, anti: 0 },
      weight: 3
    },
    {
      id: "gov-delay",
      name: "延期审批",
      rarity: "B",
      sourceFaction: "gov",
      description: "延后上线窗口，显著增加监管影响。",
      effect: { gov: 4, corp: -2, anti: 1 },
      weight: 2
    },
    {
      id: "corp-ads",
      name: "投放攻势",
      rarity: "G",
      sourceFaction: "corp",
      description: "公司扩大市场营销，制造上线势能。",
      effect: { gov: 0, corp: 3, anti: -1 },
      weight: 3
    },
    {
      id: "corp-lobby",
      name: "游说活动",
      rarity: "B",
      sourceFaction: "corp",
      description: "公司影响政策空间，但会积累争议。",
      effect: { gov: 1, corp: 4, anti: -2 },
      weight: 2
    },
    {
      id: "anti-protest",
      name: "抗议浪潮",
      rarity: "G",
      sourceFaction: "anti",
      description: "反 AI 组织推动街头反对声量。",
      effect: { gov: -1, corp: -1, anti: 3 },
      weight: 3
    },
    {
      id: "anti-leak",
      name: "内部泄密",
      rarity: "R",
      sourceFaction: "anti",
      description: "用高风险曝光重创公司公信力。",
      effect: { gov: 0, corp: -4, anti: 5 },
      weight: 1
    }
  ]
};

