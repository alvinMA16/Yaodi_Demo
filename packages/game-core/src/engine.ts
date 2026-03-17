import { createRng } from "./random.js";
import type {
  ApplyActionResult,
  BalanceConfig,
  CardDefinition,
  CardEffectMode,
  CardRarity,
  CardEffect,
  DailyRecord,
  EndDayResolutionLog,
  EndingResult,
  Faction,
  GameAction,
  GameState,
  InquiryPhase,
  InquiryTargetContext,
  OrangeEffectMode,
  RunSummary,
  RunModifiers,
  StartRunParams
} from "./types.js";

const factionOrder: Faction[] = ["gov", "corp", "anti"];
const defaultRarityWeights: Record<CardRarity, number> = { W: 0, G: 0, B: 0, R: 0, O: 0 };
export const endDayResolutionOrderLabels = ["盘口", "世界事件", "双杀", "禁牌", "梭哈", "政变"] as const;
export const runCardLimits = {
  infoCardSlots: 3,
  warehouseCarrySlots: 3,
  warehouseCapacity: 12
} as const;

const govPersonas = ["发言人", "技术主管", "部长", "副总统"] as const;
const corpPersonas = ["发言人", "法务", "高管", "CEO"] as const;
const antiPersonas = ["游行者", "领队", "策划", "领袖"] as const;
const factionLabels: Record<Faction, string> = {
  gov: "政府",
  corp: "公司",
  anti: "反对组织"
};

const phaseRarityTables: Record<
  InquiryPhase,
  Record<Faction, Array<Record<CardRarity, number>>>
> = {
  day1to3: {
    gov: [
      { W: 92, G: 7, B: 1, R: 0, O: 0 },
      { W: 88, G: 10, B: 2, R: 0, O: 0 },
      { W: 85, G: 12, B: 3, R: 0, O: 0 },
      { W: 82, G: 12, B: 6, R: 0, O: 0 }
    ],
    corp: [
      { W: 90, G: 8, B: 2, R: 0, O: 0 },
      { W: 84, G: 10, B: 6, R: 0, O: 0 },
      { W: 80, G: 10, B: 10, R: 0, O: 0 },
      { W: 78, G: 10, B: 12, R: 0, O: 0 }
    ],
    anti: [
      { W: 88, G: 10, B: 2, R: 0, O: 0 },
      { W: 82, G: 13, B: 5, R: 0, O: 0 },
      { W: 78, G: 12, B: 10, R: 0, O: 0 },
      { W: 76, G: 10, B: 14, R: 0, O: 0 }
    ]
  },
  day4to6: {
    gov: [
      { W: 86, G: 10, B: 4, R: 0, O: 0 },
      { W: 82, G: 10, B: 6, R: 2, O: 0 },
      { W: 78, G: 12, B: 7, R: 3, O: 0 },
      { W: 76, G: 12, B: 8, R: 4, O: 0 }
    ],
    corp: [
      { W: 82, G: 10, B: 6, R: 2, O: 0 },
      { W: 78, G: 10, B: 7, R: 4, O: 1 },
      { W: 72, G: 10, B: 10, R: 7, O: 1 },
      { W: 68, G: 10, B: 12, R: 8, O: 2 }
    ],
    anti: [
      { W: 80, G: 12, B: 5, R: 3, O: 0 },
      { W: 74, G: 13, B: 6, R: 6, O: 1 },
      { W: 66, G: 12, B: 7, R: 12, O: 3 },
      { W: 62, G: 10, B: 6, R: 19, O: 3 }
    ]
  },
  day7: {
    gov: [
      { W: 84, G: 10, B: 4, R: 2, O: 0 },
      { W: 82, G: 10, B: 5, R: 2, O: 1 },
      { W: 74, G: 12, B: 7, R: 5, O: 2 },
      { W: 70, G: 12, B: 8, R: 6, O: 4 }
    ],
    corp: [
      { W: 78, G: 10, B: 7, R: 4, O: 1 },
      { W: 72, G: 10, B: 8, R: 7, O: 3 },
      { W: 68, G: 10, B: 10, R: 8, O: 4 },
      { W: 60, G: 10, B: 12, R: 10, O: 8 }
    ],
    anti: [
      { W: 74, G: 12, B: 6, R: 8, O: 0 },
      { W: 70, G: 13, B: 6, R: 9, O: 2 },
      { W: 66, G: 12, B: 6, R: 12, O: 4 },
      { W: 60, G: 10, B: 5, R: 15, O: 10 }
    ]
  }
};

function cloneEffect(effect?: CardEffect): CardEffect {
  return {
    gov: effect?.gov ?? 0,
    corp: effect?.corp ?? 0,
    anti: effect?.anti ?? 0
  };
}

function addEffect(base: CardEffect, delta: CardEffect): CardEffect {
  return {
    gov: base.gov + delta.gov,
    corp: base.corp + delta.corp,
    anti: base.anti + delta.anti
  };
}

type WorldEvent = {
  title: string;
  summary: string;
  effect: CardEffect;
};

function multiplyEffect(effect: CardEffect, multiplier: number): CardEffect {
  return {
    gov: effect.gov * multiplier,
    corp: effect.corp * multiplier,
    anti: effect.anti * multiplier
  };
}

function createModifiers(): RunModifiers {
  return {
    persistentOrangeEffects: [],
    twinKillOaths: [],
    perfectEndingOaths: []
  };
}

function compareFactions(a: string, b: string) {
  return factionOrder.indexOf(a as Faction) - factionOrder.indexOf(b as Faction);
}

function highestFactions(effect: CardEffect) {
  const maxValue = Math.max(effect.gov, effect.corp, effect.anti);

  return factionOrder.filter((faction) => effect[faction] === maxValue);
}

function lowestFactions(effect: CardEffect) {
  const minValue = Math.min(effect.gov, effect.corp, effect.anti);

  return factionOrder.filter((faction) => effect[faction] === minValue);
}

function spreadEffect(factions: Faction[], amount: number) {
  const result = cloneEffect();

  for (const faction of factions) {
    result[faction] += amount;
  }

  return result;
}

function shiftHighestToLowest(effect: CardEffect, amount: number) {
  return addEffect(spreadEffect(highestFactions(effect), -amount), spreadEffect(lowestFactions(effect), amount));
}

function dynamicCardEffect(world: CardEffect, mode: CardEffectMode): CardEffect {
  if (mode === "boost_lowest_2") {
    return spreadEffect(lowestFactions(world), 2);
  }

  return shiftHighestToLowest(world, mode === "shift_high_to_low_1" ? 1 : mode === "shift_high_to_low_2" ? 2 : 3);
}

function resolveCardEffect(card: CardDefinition, world: CardEffect) {
  if (!card.effectMode) {
    return card.effect;
  }

  return dynamicCardEffect(world, card.effectMode);
}

function orangeEffectRequiresSingleTarget(effect?: OrangeEffectMode) {
  return effect === "force_highest_inquiry_today" || effect === "force_negative_target_today";
}

function orangeEffectRequiresPairTarget(effect?: OrangeEffectMode) {
  return effect === "lockstep_pair_today";
}

function normalizeTargetFactions(targetFactions?: Faction[]) {
  if (!targetFactions || targetFactions.length === 0) {
    return [];
  }

  const uniqueTargets = [...new Set(targetFactions)];

  if (uniqueTargets.length !== targetFactions.length) {
    throw new Error("Target factions must be distinct");
  }

  return uniqueTargets;
}

function factionListLabel(factions: Faction[]) {
  return factions.join(" + ");
}

function validateOrangeTargets(card: CardDefinition, targetFactions: Faction[]) {
  if (orangeEffectRequiresSingleTarget(card.orangeEffect) && targetFactions.length !== 1) {
    throw new Error(`Card ${card.name} requires exactly one target faction`);
  }

  if (orangeEffectRequiresPairTarget(card.orangeEffect) && targetFactions.length !== 2) {
    throw new Error(`Card ${card.name} requires exactly two target factions`);
  }

  if (
    targetFactions.length > 0 &&
    !orangeEffectRequiresSingleTarget(card.orangeEffect) &&
    !orangeEffectRequiresPairTarget(card.orangeEffect)
  ) {
    throw new Error(`Card ${card.name} does not accept target factions`);
  }
}

function hasTimedEndDayModifier(state: GameState) {
  return Boolean(
    state.modifiers.marketSwingToday?.day === state.day ||
      state.modifiers.lockstepPairToday?.day === state.day ||
      state.modifiers.forcedNegativeTargetToday?.day === state.day ||
      state.modifiers.doubleDayDeltaToday?.day === state.day ||
      state.modifiers.swapHighestLowestToday?.day === state.day
  );
}

function worldEventCandidates(state: GameState): WorldEvent[] {
  const phase = phaseFromDay(state.day);
  const leaderNames = highestFactions(state.world).map((faction) => factionLabels[faction]).join(" / ");
  const trailingNames = lowestFactions(state.world).map((faction) => factionLabels[faction]).join(" / ");

  if (phase === "day1to3") {
    return [
      {
        title: "政府吹风",
        summary: "监管口径略微收紧，政府话语权小幅上升。",
        effect: { gov: 1, corp: 0, anti: 0 }
      },
      {
        title: "市场预热",
        summary: "资本市场开始预热，公司阵营获得一点势能。",
        effect: { gov: 0, corp: 1, anti: 0 }
      },
      {
        title: "街头串联",
        summary: "线下活动升温，反对组织得到更多曝光。",
        effect: { gov: 0, corp: 0, anti: 1 }
      },
      {
        title: "弱侧回流",
        summary: `${trailingNames} 获得额外关注，最弱阵营被轻轻扶了一把。`,
        effect: spreadEffect(lowestFactions(state.world), 1)
      },
      {
        title: "试探性制衡",
        summary: `${leaderNames} 暂时收缩，${trailingNames} 得到一点活动空间。`,
        effect: shiftHighestToLowest(state.world, 1)
      }
    ];
  }

  if (phase === "day4to6") {
    return [
      {
        title: "监管风暴",
        summary: "监管进入实质阶段，政府推进明显增强，同时市场承压。",
        effect: { gov: 2, corp: -1, anti: 0 }
      },
      {
        title: "投资人逼宫",
        summary: "市场要求更快落地，公司冲势上扬，反对声浪被压制。",
        effect: { gov: 0, corp: 2, anti: -1 }
      },
      {
        title: "舆论反噬",
        summary: "社会争议扩大，反对组织迅速抬头，政府被迫后撤。",
        effect: { gov: -1, corp: 0, anti: 2 }
      },
      {
        title: "圆桌协商",
        summary: `${leaderNames} 被要求收敛，${trailingNames} 获得更多发言份额。`,
        effect: shiftHighestToLowest(state.world, 1)
      },
      {
        title: "议题全面升温",
        summary: "所有阵营都被卷入更高烈度的公开争论。",
        effect: { gov: 1, corp: 1, anti: 1 }
      }
    ];
  }

  return [
    {
      title: "国家机器进场",
      summary: "最后时刻政府全面介入，试图锁住局势。",
      effect: { gov: 3, corp: -1, anti: 0 }
    },
    {
      title: "资本最后通牒",
      summary: "公司发动最后冲刺，逼迫所有人面对既成事实。",
      effect: { gov: 0, corp: 3, anti: -1 }
    },
    {
      title: "全民反扑",
      summary: "大规模反扑压过台面，反对组织迎来最后爆发。",
      effect: { gov: -1, corp: 0, anti: 3 }
    },
    {
      title: "极限制衡",
      summary: `${leaderNames} 被强行压住，${trailingNames} 被迅速抬高，结局天秤剧烈摆动。`,
      effect: shiftHighestToLowest(state.world, 2)
    },
    {
      title: "全面失控",
      summary: "所有阵营在最后一天同时失控，烈度一起冲顶。",
      effect: { gov: 2, corp: 2, anti: 2 }
    }
  ];
}

function resolveWorldEvent(state: GameState, seed: number) {
  const candidates = worldEventCandidates(state);
  const rng = createRng(
    seed +
      state.day * 211 +
      state.world.gov * 31 +
      state.world.corp * 17 +
      state.world.anti * 13
  );
  const selected = candidates[Math.floor(rng() * candidates.length)]!;

  return selected;
}

function orangeCardsDrawnCount(config: BalanceConfig, state: GameState) {
  return state.history
    .flatMap((day) => day.inquiries)
    .map((entry) => findCard(config.cards, entry.drawnCardId))
    .filter((card) => card.rarity === "O").length;
}

function heldOrangeCardIds(state: GameState) {
  return new Set(
    [...state.infoCards, ...state.warehouseCards]
      .filter((card) => card.rarity === "O")
      .map((card) => card.id)
  );
}

function phaseFromDay(day: number): InquiryPhase {
  if (day <= 3) {
    return "day1to3";
  }

  if (day <= 6) {
    return "day4to6";
  }

  return "day7";
}

function instantiateCard(card: CardDefinition, instanceId: string): CardDefinition {
  return {
    ...card,
    instanceId
  };
}

function findCard(cards: CardDefinition[], id: string) {
  const card = cards.find((candidate) => candidate.id === id);

  if (!card) {
    throw new Error(`Card not found: ${id}`);
  }

  return card;
}

function currentDayDelta(state: GameState) {
  let record: DailyRecord | undefined;

  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const candidate = state.history[index];
    if (candidate?.day === state.day) {
      record = candidate;
      break;
    }
  }

  return (record?.playedCards ?? []).reduce<CardEffect>(
    (effect, card) => addEffect(effect, card.effect),
    cloneEffect()
  );
}

function govLevel(state: GameState) {
  if (state.modifiers.forcedHighestInquiryToday?.day === state.day && state.modifiers.forcedHighestInquiryToday.targetFaction === "gov") {
    return 4;
  }

  const absoluteGov = Math.abs(state.world.gov);
  const dailyGovDelta = Math.abs(currentDayDelta(state).gov);
  let level: 1 | 2 | 3 | 4 = 1;

  if (absoluteGov >= 70) {
    level = 4;
  } else if (absoluteGov >= 40) {
    level = 3;
  } else if (absoluteGov >= 20) {
    level = 2;
  }

  if (dailyGovDelta >= 90) {
    return 4;
  }

  if (dailyGovDelta >= 60) {
    return Math.max(level, 3) as 3 | 4;
  }

  if (dailyGovDelta >= 30) {
    return Math.max(level, 2) as 2 | 3 | 4;
  }

  return level;
}

function corpLevel(state: GameState) {
  if (state.modifiers.forcedHighestInquiryToday?.day === state.day && state.modifiers.forcedHighestInquiryToday.targetFaction === "corp") {
    return 4;
  }

  const dailyCorpDelta = Math.abs(currentDayDelta(state).corp);

  if (dailyCorpDelta >= 35) {
    return 4;
  }

  if (dailyCorpDelta >= 20) {
    return 3;
  }

  if (dailyCorpDelta >= 10) {
    return 2;
  }

  return 1;
}

function antiLevel(state: GameState) {
  if (state.modifiers.forcedHighestInquiryToday?.day === state.day && state.modifiers.forcedHighestInquiryToday.targetFaction === "anti") {
    return 4;
  }

  const dailyCorpDelta = Math.abs(currentDayDelta(state).corp);
  const absoluteGov = Math.abs(state.world.gov);
  const stormIndex = dailyCorpDelta * 2 + absoluteGov * 0.7;

  if (stormIndex >= 50) {
    return 4;
  }

  if (stormIndex >= 35) {
    return 3;
  }

  if (stormIndex >= 20) {
    return 2;
  }

  return 1;
}

export function describeInquiryTarget(state: GameState, target: Faction): InquiryTargetContext {
  const phase = phaseFromDay(state.day);
  const level = target === "gov" ? govLevel(state) : target === "corp" ? corpLevel(state) : antiLevel(state);
  const personaByTarget = {
    gov: govPersonas,
    corp: corpPersonas,
    anti: antiPersonas
  } as const;
  const persona = personaByTarget[target][level - 1]!;

  return {
    target,
    day: state.day,
    phase,
    level,
    persona,
    rarityWeights: phaseRarityTables[phase][target][level - 1] ?? defaultRarityWeights
  };
}

function weightedCardPick(
  cards: CardDefinition[],
  seed: number,
  day: number,
  inquiryIndex: number,
  targetContext: InquiryTargetContext,
  state: GameState,
  config: BalanceConfig
) {
  const orangeCapReached = orangeCardsDrawnCount(config, state) >= 3;
  const heldOrangeIds = heldOrangeCardIds(state);
  const pool = cards
    .filter((card) => {
      if (card.sourceFaction !== targetContext.target || card.starter) {
        return false;
      }

      if (card.rarity !== "O") {
        return true;
      }

      if (orangeCapReached) {
        return false;
      }

      return !heldOrangeIds.has(card.id);
    })
    .map((card) => ({
      card,
      effectiveWeight: card.weight * (targetContext.rarityWeights[card.rarity] ?? 0)
    }))
    .filter((entry) => entry.effectiveWeight > 0);

  if (pool.length === 0) {
    throw new Error(`No cards configured for target ${targetContext.target} in phase ${targetContext.phase}`);
  }

  const rng = createRng(seed + day * 100 + inquiryIndex * 17 + targetContext.target.charCodeAt(0) + targetContext.level * 13);
  const totalWeight = pool.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
  const roll = rng() * totalWeight;
  let cursor = 0;

  for (const entry of pool) {
    cursor += entry.effectiveWeight;
    if (roll <= cursor) {
      return entry.card;
    }
  }

  return pool[pool.length - 1]!.card;
}

function currentDayRecord(state: GameState): DailyRecord {
  const lastRecord = state.history[state.history.length - 1];

  if (!lastRecord || lastRecord.day !== state.day) {
    const created: DailyRecord = {
      day: state.day,
      inquiries: [],
      playedCards: [],
      discardedCardIds: [],
      retainedCardIds: [],
      reportSubmitted: false,
      pressureBefore: state.pressure,
      pressureAfter: state.pressure,
      worldBefore: cloneEffect(state.world),
      worldAfter: cloneEffect(state.world),
      endDayResolutionLogs: []
    };
    state.history.push(created);
    return created;
  }

  return lastRecord;
}

function rarityPenalty(config: BalanceConfig, cards: CardDefinition[]) {
  return cards.reduce((sum, card) => {
    if (card.rarity === "B") {
      return sum + config.pressure.bluePenalty;
    }

    if (card.rarity === "R") {
      return sum + config.pressure.redPenalty;
    }

    return sum;
  }, 0);
}

export function computePressure(config: BalanceConfig, currentPressure: number, day: number, retainedCards: number, destroyedCards: number, rareCardsPlayed: CardDefinition[]) {
  const retainedPenalty = retainedCards * day * day * config.pressure.retainedFactor;
  const destroyPenalty = destroyedCards * config.pressure.destroyFactor;
  const rarePenalty = rarityPenalty(config, rareCardsPlayed);

  return {
    nextPressure: Number((currentPressure + retainedPenalty + destroyPenalty + rarePenalty).toFixed(2)),
    retainedPenalty,
    destroyPenalty,
    rarePenalty
  };
}

function rankingGroupsFromEffect(effect: CardEffect) {
  const sorted = Object.entries(effect)
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return compareFactions(a[0], b[0]);
      }

      return b[1] - a[1];
    });
  const groups: string[][] = [];

  for (const [faction, value] of sorted) {
    const lastGroup = groups[groups.length - 1];
    const lastFaction = lastGroup?.[0];
    const lastValue = lastFaction ? effect[lastFaction as Faction] : undefined;

    if (lastGroup && lastValue === value) {
      lastGroup.push(faction);
      continue;
    }

    groups.push([faction]);
  }

  return groups;
}

function rankingFromEffect(effect: CardEffect) {
  return rankingGroupsFromEffect(effect).flat();
}

function topTendency(effect: CardEffect) {
  const maxValue = Math.max(effect.gov, effect.corp, effect.anti);

  return Object.entries(effect)
    .filter(([, value]) => value === maxValue)
    .map(([faction]) => faction)
    .sort(compareFactions);
}

function formatFactionGroups(groups: string[][]) {
  return groups.map((group) => group.join(" = ")).join(" > ");
}

function worldEndingFromRankingLabel(rankingLabel: string) {
  switch (rankingLabel) {
    case "gov > corp > anti":
      return {
        title: "合法合规",
        summary: "AI 受损上线，政府指导公司并保有监督管理权，反对组织失败。"
      };
    case "gov > anti > corp":
      return {
        title: "国有资产",
        summary: "AI 受损上线，政府采纳了反对组织意见，并对 AI 推进实施了国有化。"
      };
    case "gov = anti > corp":
      return {
        title: "隐私保护",
        summary: "AI 暂停上线，政府全面审查隐私问题，反对组织全程监督，公司失败。"
      };
    case "gov = corp > anti":
      return {
        title: "民生第一",
        summary: "AI 受损上线，政府有限支持公司，同时附加税收与就业约束，反对组织失败。"
      };
    case "gov > anti = corp":
      return {
        title: "明天再说",
        summary: "AI 延缓上线，公司与反对组织各执一词，政府选择继续观望。"
      };
    case "anti > gov > corp":
      return {
        title: "拦腰斩断",
        summary: "AI 未能上线，政府听取了反对组织与舆论意见，直接立法禁止部署。"
      };
    case "anti > corp > gov":
      return {
        title: "黑客帝国",
        summary: "AI 叛乱上线，反对组织渗透公司上传恶意代码，公司为保市值没有立刻下线。"
      };
    case "anti > gov = corp":
      return {
        title: "人民万岁",
        summary: "AI 受损上线，却遭到人民抵制，政府和公司彼此制衡。"
      };
    case "corp > anti > gov":
      return {
        title: "无伤大雅",
        summary: "AI 受损上线，公司成功打压反对组织，多数用户仍被留在系统里。"
      };
    case "corp > gov > anti":
      return {
        title: "公司至上",
        summary: "AI 完整上线，政府完全支持公司，反对组织失败。"
      };
    case "corp = anti > gov":
      return {
        title: "握手言和",
        summary: "公司与反对组织达成和解，AI 受限上线，政府基本缺席。"
      };
    case "corp > gov = anti":
      return {
        title: "坐收渔利",
        summary: "AI 完整上线，政府和反对组织来回拉扯，公司趁机推进成功。"
      };
    case "gov = corp = anti":
      return {
        title: "三权分立",
        summary: "三方陷入胶着，现实没有发生决定性变化。"
      };
    default:
      return {
        title: "未知结局",
        summary: "世界走向未能匹配到已定义的结局模板。"
      };
  }
}

export function determineEnding(state: GameState): EndingResult {
  const rankingGroups = rankingGroupsFromEffect(state.world);
  const ranking = rankingGroups.flat();
  const rankingLabel = formatFactionGroups(rankingGroups);
  const playerTendency = topTendency(state.playerInfluence);
  const playerTendencyLabel = playerTendency.join(" = ");
  const reportDays = state.history.filter((day) => day.reportSubmitted).length;
  const worldEnding = worldEndingFromRankingLabel(rankingLabel);

  if (state.runStatus === "dead") {
    return {
      code: "death",
      title: "死亡",
      summary: "压力突破阈值，调查在崩溃前终止。",
      ranking,
      rankingLabel,
      playerTendency,
      playerTendencyLabel,
      worldEndingTitle: worldEnding.title,
      worldEndingSummary: worldEnding.summary
    };
  }

  if (reportDays === 0) {
    return {
      code: "blank",
      title: "全空白",
      summary: "七天没有提交任何报告，案件被彻底放空。",
      ranking,
      rankingLabel,
      playerTendency,
      playerTendencyLabel,
      worldEndingTitle: worldEnding.title,
      worldEndingSummary: worldEnding.summary
    };
  }

  if (reportDays < 7) {
    return {
      code: "failure",
      title: "调查失败",
      summary: "你活了下来，但调查并未持续推进到最后。",
      ranking,
      rankingLabel,
      playerTendency,
      playerTendencyLabel,
      worldEndingTitle: worldEnding.title,
      worldEndingSummary: worldEnding.summary
    };
  }

  const leaders = rankingGroups[0] ?? [];
  const isPerfect = playerTendency.some((faction) => leaders.includes(faction));

  return isPerfect
    ? {
        code: "perfect",
        title: "强胜利",
        summary: "你的行动倾向与最终主导阵营保持一致，报告完整且方向正确。",
        ranking,
        rankingLabel,
        playerTendency,
        playerTendencyLabel,
        worldEndingTitle: worldEnding.title,
        worldEndingSummary: worldEnding.summary
      }
    : {
        code: "win",
        title: "胜利",
        summary: "你完成了全部调查，但推进方向与最终世界走向并不一致。",
        ranking,
        rankingLabel,
        playerTendency,
        playerTendencyLabel,
        worldEndingTitle: worldEnding.title,
        worldEndingSummary: worldEnding.summary
      };
}

export function summarizeRun(state: GameState): RunSummary {
  return {
    status: state.runStatus,
    day: state.day,
    pressure: state.pressure,
    ranking: rankingFromEffect(state.world),
    reportDays: state.history.filter((day) => day.reportSubmitted).length,
    ...(state.balanceVersionId !== undefined ? { balanceVersionId: state.balanceVersionId } : {}),
    ...(state.ending?.code ? { endingCode: state.ending.code } : {})
  };
}

export function startRun(config: BalanceConfig, params: StartRunParams): GameState {
  const carryCardIds = params.carryCardIds ?? config.starterCardIds;

  if (carryCardIds.length > runCardLimits.warehouseCarrySlots) {
    throw new Error("Starter loadout exceeds warehouse carry slots");
  }

  if (carryCardIds.length > runCardLimits.warehouseCapacity) {
    throw new Error("Starter loadout exceeds warehouse capacity");
  }

  const warehouseCards = carryCardIds.map((cardId, index) =>
    instantiateCard(findCard(config.cards, cardId), `starter-${index + 1}-${cardId}`)
  );

  return {
    day: 1,
    inquiryRemaining: 3,
    pressure: 0,
    runStatus: "active",
    world: cloneEffect(),
    playerInfluence: cloneEffect(),
    infoCards: [],
    warehouseCards,
    modifiers: createModifiers(),
    history: [],
    ...(params.balanceVersionId !== undefined ? { balanceVersionId: params.balanceVersionId } : {})
  };
}

export function resolveInquiry(config: BalanceConfig, state: GameState, target: Faction, seed: number) {
  if (state.runStatus !== "active") {
    throw new Error("Run is not active");
  }

  if (state.infoCards.length >= runCardLimits.infoCardSlots) {
    throw new Error("Info card slots are full");
  }

  if (state.inquiryRemaining <= 0) {
    throw new Error("No inquiry actions remaining");
  }

  const inquiryIndex = 3 - state.inquiryRemaining;
  const targetContext = describeInquiryTarget(state, target);
  const card = instantiateCard(
    weightedCardPick(config.cards, seed, state.day, inquiryIndex, targetContext, state, config),
    `day-${state.day}-inq-${inquiryIndex + 1}-${target}`
  );
  const record = currentDayRecord(state);

  state.infoCards = [...state.infoCards, card];
  state.inquiryRemaining -= 1;
  record.inquiries.push({
    target,
    drawnCardId: card.id,
    drawnAt: new Date().toISOString()
  });

  return card;
}

function removeCard(cards: CardDefinition[], cardInstanceId: string) {
  const index = cards.findIndex((card) => card.instanceId === cardInstanceId);

  if (index === -1) {
    return null;
  }

  const [card] = cards.splice(index, 1);
  return card;
}

function currentDayEffect(record: DailyRecord) {
  return record.playedCards.reduce<CardEffect>((effect, card) => addEffect(effect, card.effect), cloneEffect());
}

function chooseMarketSwingTarget(seed: number, day: number) {
  const rng = createRng(seed + day * 1000 + 97);
  const roll = Math.floor(rng() * factionOrder.length);
  return factionOrder[roll]!;
}

function halfTowardFloor(value: number) {
  return Math.floor(value * 0.5);
}

function transformMarketSwing(effect: CardEffect, target: Faction): CardEffect {
  return {
    gov: target === "gov" ? effect.gov * 2 : halfTowardFloor(effect.gov),
    corp: target === "corp" ? effect.corp * 2 : halfTowardFloor(effect.corp),
    anti: target === "anti" ? effect.anti * 2 : halfTowardFloor(effect.anti)
  };
}

function clearEndOfDayModifiers(state: GameState) {
  if (state.modifiers.doubleDayDeltaToday?.day === state.day) {
    delete state.modifiers.doubleDayDeltaToday;
  }

  if (state.modifiers.marketSwingToday?.day === state.day) {
    delete state.modifiers.marketSwingToday;
  }

  if (state.modifiers.forcedHighestInquiryToday?.day === state.day) {
    delete state.modifiers.forcedHighestInquiryToday;
  }

  if (state.modifiers.forcedNegativeTargetToday?.day === state.day) {
    delete state.modifiers.forcedNegativeTargetToday;
  }

  if (state.modifiers.lockstepPairToday?.day === state.day) {
    delete state.modifiers.lockstepPairToday;
  }

  if (state.modifiers.swapHighestLowestToday?.day === state.day) {
    delete state.modifiers.swapHighestLowestToday;
  }
}

function activateOrangeEffect(state: GameState, card: CardDefinition, targetFactions?: Faction[]) {
  if (!card.orangeEffect) {
    return {
      actionSummary: `Played ${card.name}`
    };
  }

  const normalizedTargets = normalizeTargetFactions(targetFactions);
  validateOrangeTargets(card, normalizedTargets);

  if (card.orangeEffect === "double_day_delta_today") {
    if (state.day !== 7) {
      throw new Error("梭哈只能在 Day 7 使用");
    }

    state.modifiers.doubleDayDeltaToday = {
      day: state.day,
      sourceCardId: card.id,
      sourceCardName: card.name
    };

    return {
      actionSummary: `Played ${card.name}; all Day 7 changes will be doubled at end of day`
    };
  }

  if (card.orangeEffect === "market_swing_today") {
    state.modifiers.marketSwingToday = {
      day: state.day,
      sourceCardId: card.id,
      sourceCardName: card.name
    };

    return {
      actionSummary: `Played ${card.name}; today's market swing will resolve at end of day`
    };
  }

  if (card.orangeEffect === "force_highest_inquiry_today") {
    const targetFaction = normalizedTargets[0]!;

    state.modifiers.forcedHighestInquiryToday = {
      day: state.day,
      targetFaction,
      sourceCardId: card.id,
      sourceCardName: card.name
    };

    return {
      actionSummary: `Played ${card.name} and forced ${targetFaction} to use the highest-tier persona today`
    };
  }

  if (card.orangeEffect === "force_negative_target_today") {
    const targetFaction = normalizedTargets[0]!;

    state.modifiers.forcedNegativeTargetToday = {
      day: state.day,
      targetFaction,
      sourceCardId: card.id,
      sourceCardName: card.name
    };

    return {
      actionSummary: `Played ${card.name} and marked ${targetFaction} to end the day negative`
    };
  }

  if (card.orangeEffect === "lockstep_pair_today") {
    const pair = [normalizedTargets[0]!, normalizedTargets[1]!] as [Faction, Faction];
    const description = `${factionListLabel(pair)} 今日必须同涨同跌；若最终任一落败则死亡。`;

    state.modifiers.lockstepPairToday = {
      day: state.day,
      targetFactions: pair,
      sourceCardId: card.id,
      sourceCardName: card.name
    };
    state.modifiers.twinKillOaths = [
      ...state.modifiers.twinKillOaths,
      {
        sourceCardId: card.id,
        sourceCardName: card.name,
        targetFactions: pair,
        description
      }
    ];

    return {
      actionSummary: `Played ${card.name} and locked ${factionListLabel(pair)} into the same direction today`
    };
  }

  if (card.orangeEffect === "swap_highest_lowest_today") {
    state.modifiers.swapHighestLowestToday = {
      day: state.day,
      sourceCardId: card.id,
      sourceCardName: card.name
    };
    state.modifiers.perfectEndingOaths = [
      ...state.modifiers.perfectEndingOaths.filter((oath) => oath.sourceCardId !== card.id),
      {
        sourceCardId: card.id,
        sourceCardName: card.name,
        description: "日终互换最高与最低阵营；若最终不是强胜利则死亡。"
      }
    ];

    return {
      actionSummary: `Played ${card.name}; highest and lowest factions will swap at end of day, and only a perfect ending will let you live`
    };
  }

  state.modifiers.infoCardMultiplier = 2;
  state.modifiers.noRetainInfoCards = true;
  state.modifiers.persistentOrangeEffects = [
    ...state.modifiers.persistentOrangeEffects.filter((effect) => effect.sourceCardId !== card.id),
    {
      sourceCardId: card.id,
      sourceCardName: card.name,
      description: "剩余天数的信息卡效果 x2，且日终不得留信息卡。"
    }
  ];

  return {
    actionSummary: `Played ${card.name}; future info cards are doubled and you can no longer retain them`
  };
}

function applyLockstepPair(state: GameState, record: DailyRecord) {
  const modifier = state.modifiers.lockstepPairToday;

  if (!modifier || modifier.day !== state.day) {
    return null;
  }

  const [firstFaction, secondFaction] = modifier.targetFactions;
  const firstDelta = state.world[firstFaction] - record.worldBefore[firstFaction];
  const secondDelta = state.world[secondFaction] - record.worldBefore[secondFaction];
  const firstSign = Math.sign(firstDelta);
  const secondSign = Math.sign(secondDelta);
  let enforcedSign = 0;

  if (Math.abs(firstDelta) > Math.abs(secondDelta)) {
    enforcedSign = firstSign;
  } else if (Math.abs(secondDelta) > Math.abs(firstDelta)) {
    enforcedSign = secondSign;
  } else if (firstSign !== 0) {
    enforcedSign = firstSign;
  } else {
    enforcedSign = secondSign;
  }

  if (enforcedSign === 0) {
    return null;
  }

  let changed = false;

  for (const faction of modifier.targetFactions) {
    const currentDelta = state.world[faction] - record.worldBefore[faction];

    if (Math.sign(currentDelta) === enforcedSign) {
      continue;
    }

    const desiredDelta = enforcedSign > 0 ? 1 : -1;
    state.world[faction] += desiredDelta - currentDelta;
    changed = true;
  }

  if (!changed) {
    return null;
  }

  return `${modifier.sourceCardName} forced ${factionListLabel(modifier.targetFactions)} to move together`;
}

function failedTwinKillOath(state: GameState) {
  const trailingFactions = lowestFactions(state.world);

  return state.modifiers.twinKillOaths.find((oath) =>
    oath.targetFactions.some((faction) => trailingFactions.includes(faction))
  );
}

function applyDoubleDayDelta(state: GameState, record: DailyRecord) {
  const modifier = state.modifiers.doubleDayDeltaToday;

  if (!modifier || modifier.day !== state.day) {
    return null;
  }

  const dayDelta = {
    gov: state.world.gov - record.worldBefore.gov,
    corp: state.world.corp - record.worldBefore.corp,
    anti: state.world.anti - record.worldBefore.anti
  };

  if (dayDelta.gov === 0 && dayDelta.corp === 0 && dayDelta.anti === 0) {
    return `${modifier.sourceCardName} found no Day 7 delta to double`;
  }

  state.world = addEffect(state.world, dayDelta);
  state.playerInfluence = addEffect(state.playerInfluence, dayDelta);

  return `${modifier.sourceCardName} doubled all Day 7 changes`;
}

function applySwapHighestLowest(state: GameState) {
  const modifier = state.modifiers.swapHighestLowestToday;

  if (!modifier || modifier.day !== state.day) {
    return null;
  }

  const highestFaction = highestFactions(state.world)[0]!;
  const lowestFaction = lowestFactions(state.world)[0]!;

  if (highestFaction === lowestFaction) {
    return `${modifier.sourceCardName} found no distinct highest and lowest factions`;
  }

  const highestValue = state.world[highestFaction];
  const lowestValue = state.world[lowestFaction];
  state.world[highestFaction] = lowestValue;
  state.world[lowestFaction] = highestValue;
  state.playerInfluence = addEffect(state.playerInfluence, {
    gov:
      (highestFaction === "gov" ? lowestValue - highestValue : 0) +
      (lowestFaction === "gov" ? highestValue - lowestValue : 0),
    corp:
      (highestFaction === "corp" ? lowestValue - highestValue : 0) +
      (lowestFaction === "corp" ? highestValue - lowestValue : 0),
    anti:
      (highestFaction === "anti" ? lowestValue - highestValue : 0) +
      (lowestFaction === "anti" ? highestValue - lowestValue : 0)
  });

  return `${modifier.sourceCardName} swapped ${highestFaction} with ${lowestFaction}`;
}

function failedPerfectEndingOath(state: GameState) {
  if (state.ending?.code === "perfect") {
    return null;
  }

  return state.modifiers.perfectEndingOaths[0] ?? null;
}

function pushEndDayResolutionLog(
  record: DailyRecord,
  state: GameState,
  step: string,
  worldBefore: CardEffect,
  pressureBefore: number,
  summary: string
) {
  const entry: EndDayResolutionLog = {
    step,
    summary,
    worldBefore,
    worldAfter: cloneEffect(state.world),
    pressureBefore,
    pressureAfter: state.pressure
  };

  record.endDayResolutionLogs.push(entry);
}

function resolveTimedEndDayModifiers(
  state: GameState,
  record: DailyRecord,
  seed: number,
  dayEffectBeforeEnd: CardEffect
) {
  const summaries: string[] = [];

  if (state.modifiers.marketSwingToday?.day === state.day) {
    const worldBefore = cloneEffect(state.world);
    const pressureBefore = state.pressure;
    const target = chooseMarketSwingTarget(seed, state.day);
    const transformedEffect = transformMarketSwing(dayEffectBeforeEnd, target);
    const swingDelta = {
      gov: transformedEffect.gov - dayEffectBeforeEnd.gov,
      corp: transformedEffect.corp - dayEffectBeforeEnd.corp,
      anti: transformedEffect.anti - dayEffectBeforeEnd.anti
    };

    state.world = addEffect(state.world, swingDelta);
    state.playerInfluence = addEffect(state.playerInfluence, swingDelta);
    const summary = `${state.modifiers.marketSwingToday.sourceCardName} targeted ${target}`;
    summaries.push(summary);
    pushEndDayResolutionLog(record, state, "盘口", worldBefore, pressureBefore, summary);
  }

  {
    const worldBefore = cloneEffect(state.world);
    const pressureBefore = state.pressure;
  const worldEvent = resolveWorldEvent(state, seed);
  state.world = addEffect(state.world, worldEvent.effect);
  record.worldEventTitle = worldEvent.title;
  record.worldEventSummary = worldEvent.summary;
  record.worldEventEffect = worldEvent.effect;
    const summary = `world event: ${worldEvent.title}`;
    summaries.push(summary);
    pushEndDayResolutionLog(record, state, "世界事件", worldBefore, pressureBefore, summary);
  }

  if (state.modifiers.lockstepPairToday?.day === state.day) {
    const worldBefore = cloneEffect(state.world);
    const pressureBefore = state.pressure;
    const lockstepSummary = applyLockstepPair(state, record) ?? `${state.modifiers.lockstepPairToday.sourceCardName} kept its pair in the same direction`;
    summaries.push(lockstepSummary);
    pushEndDayResolutionLog(record, state, "双杀", worldBefore, pressureBefore, lockstepSummary);
  }

  if (state.modifiers.forcedNegativeTargetToday?.day === state.day) {
    const worldBefore = cloneEffect(state.world);
    const pressureBefore = state.pressure;
    const targetFaction = state.modifiers.forcedNegativeTargetToday.targetFaction;
    const dayDelta = state.world[targetFaction] - record.worldBefore[targetFaction];
    let summary = `${state.modifiers.forcedNegativeTargetToday.sourceCardName} kept ${targetFaction} negative`;

    if (dayDelta >= 0) {
      const desiredDelta = dayDelta === 0 ? -1 : -Math.abs(dayDelta);
      state.world[targetFaction] += desiredDelta - dayDelta;
      summary = `${state.modifiers.forcedNegativeTargetToday.sourceCardName} forced ${targetFaction} negative`;
    }

    state.pressure += 25;
    summaries.push(summary);
    pushEndDayResolutionLog(record, state, "禁牌", worldBefore, pressureBefore, summary);
  }

  if (state.modifiers.doubleDayDeltaToday?.day === state.day) {
    const worldBefore = cloneEffect(state.world);
    const pressureBefore = state.pressure;
    const summary = applyDoubleDayDelta(state, record) ?? `${state.modifiers.doubleDayDeltaToday.sourceCardName} had no Day 7 effect`;
    summaries.push(summary);
    pushEndDayResolutionLog(record, state, "梭哈", worldBefore, pressureBefore, summary);
  }

  if (state.modifiers.swapHighestLowestToday?.day === state.day) {
    const worldBefore = cloneEffect(state.world);
    const pressureBefore = state.pressure;
    const summary =
      applySwapHighestLowest(state) ?? `${state.modifiers.swapHighestLowestToday.sourceCardName} found no swap target`;
    summaries.push(summary);
    pushEndDayResolutionLog(record, state, "政变", worldBefore, pressureBefore, summary);
  }

  return summaries;
}

export function applyAction(config: BalanceConfig, seed: number, state: GameState, action: GameAction): ApplyActionResult {
  if (action.type === "inquire") {
    const card = resolveInquiry(config, state, action.target, seed);
    return {
      state,
      actionSummary: `Inquired ${action.target} and drew ${card.name}`
    };
  }

  if (action.type === "playCard") {
    if (state.runStatus !== "active") {
      throw new Error("Run is not active");
    }

    let source: "info" | "warehouse" = "info";
    let card = removeCard(state.infoCards, action.cardInstanceId);

    if (!card) {
      source = "warehouse";
      card = removeCard(state.warehouseCards, action.cardInstanceId);
    }

    if (!card) {
      throw new Error(`Card ${action.cardInstanceId} is not available`);
    }

    const normalizedTargets = normalizeTargetFactions(action.targetFactions);

    validateOrangeTargets(card, normalizedTargets);

    if (card.reusable && source === "info" && state.warehouseCards.length >= runCardLimits.warehouseCapacity) {
      throw new Error("Warehouse is full");
    }

    let resolvedEffect = resolveCardEffect(card, state.world);

    if (source === "info" && state.modifiers.infoCardMultiplier && !card.orangeEffect) {
      resolvedEffect = multiplyEffect(resolvedEffect, state.modifiers.infoCardMultiplier);
    }

    state.world = addEffect(state.world, resolvedEffect);
    state.playerInfluence = addEffect(state.playerInfluence, resolvedEffect);

    if (card.reusable) {
      state.warehouseCards = [...state.warehouseCards, card];
    }

    const record = currentDayRecord(state);
    record.playedCards.push({
      cardId: card.id,
      source,
      effect: resolvedEffect,
      rarity: card.rarity,
      playedAt: new Date().toISOString()
    });

    const orangeResolution = activateOrangeEffect(state, card, normalizedTargets);

    return {
      state,
      actionSummary: orangeResolution.actionSummary
    };
  }

  if (state.runStatus !== "active") {
    throw new Error("Run is not active");
  }

  const record = currentDayRecord(state);
  const discarded = action.discardCardInstanceIds
    .map((cardId) => removeCard(state.infoCards, cardId))
    .filter((card): card is CardDefinition => Boolean(card));
  const retained = [...state.infoCards];
  const playedCardsCount = record.playedCards.length;

  if (action.submitReport && playedCardsCount === 0) {
    throw new Error("Cannot submit a report without playing at least one card");
  }

  const rareCardsPlayed = record.playedCards
    .map((entry) => findCard(config.cards, entry.cardId))
    .filter((card) => card.rarity === "B" || card.rarity === "R");
  const pressure = computePressure(config, state.pressure, state.day, retained.length, discarded.length, rareCardsPlayed);
  const dayEffectBeforeEnd = currentDayEffect(record);
  record.discardedCardIds = discarded.map((card) => card.id);
  record.retainedCardIds = retained.map((card) => card.id);
  record.reportSubmitted = action.submitReport && playedCardsCount > 0;
  state.pressure = pressure.nextPressure;
  let dayEndSummary = record.reportSubmitted ? "Submitted a report" : "Ended the day with an empty report";
  const timedModifierSummaries = resolveTimedEndDayModifiers(
    state,
    record,
    seed,
    dayEffectBeforeEnd
  );

  if (hasTimedEndDayModifier(state) && timedModifierSummaries.length > 0) {
    dayEndSummary = `${dayEndSummary}; ${timedModifierSummaries.join("; ")}`;
  }

  if (state.modifiers.forcedHighestInquiryToday?.day === state.day) {
    const targetFaction = state.modifiers.forcedHighestInquiryToday.targetFaction;
    const sourceCardName = state.modifiers.forcedHighestInquiryToday.sourceCardName;
    const leaders = highestFactions(state.world);

    if (!leaders.includes(targetFaction)) {
      state.runStatus = "dead";
      state.ending = determineEnding(state);
      record.worldAfter = cloneEffect(state.world);
      record.pressureAfter = state.pressure;
      clearEndOfDayModifiers(state);

      return {
        state,
        actionSummary: `${sourceCardName} failed because ${targetFaction} did not end the day in the lead`
      };
    }
  }

  record.worldAfter = cloneEffect(state.world);
  record.pressureAfter = state.pressure;

  if (state.modifiers.noRetainInfoCards && retained.length > 0) {
    state.runStatus = "dead";
    state.ending = determineEnding(state);
    clearEndOfDayModifiers(state);

    return {
      state,
      actionSummary: "A persistent orange effect killed the run because info cards were retained"
    };
  }

  if (state.pressure >= config.pressure.deathThreshold) {
    state.runStatus = "dead";
    state.ending = determineEnding(state);
    clearEndOfDayModifiers(state);

    return {
      state,
      actionSummary: "Pressure exceeded the threshold"
    };
  }

  if (state.day >= 7) {
    const failedOath = failedTwinKillOath(state);

    if (failedOath) {
      state.runStatus = "dead";
      state.ending = determineEnding(state);
      clearEndOfDayModifiers(state);

      return {
        state,
        actionSummary: `${failedOath.sourceCardName} failed because ${factionListLabel(failedOath.targetFactions)} did not all avoid the bottom rank`
      };
    }

    state.day = 8;
    state.inquiryRemaining = 0;
    state.runStatus = "completed";
    state.ending = determineEnding(state);

    const failedPerfectOath = failedPerfectEndingOath(state);

    if (failedPerfectOath) {
      state.runStatus = "dead";
      state.ending = determineEnding(state);
      clearEndOfDayModifiers(state);

      return {
        state,
        actionSummary: `${failedPerfectOath.sourceCardName} failed because the final ending was not perfect`
      };
    }

    clearEndOfDayModifiers(state);

    return {
      state,
      actionSummary: "Day 8 settlement is locked in"
    };
  }

  clearEndOfDayModifiers(state);
  state.day += 1;
  state.inquiryRemaining = 3;

  return {
    state,
    actionSummary: `${dayEndSummary} and ended day ${record.day}`
  };
}
