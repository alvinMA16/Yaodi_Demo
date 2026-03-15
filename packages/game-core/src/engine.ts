import { createRng } from "./random.js";
import type {
  ApplyActionResult,
  BalanceConfig,
  CardDefinition,
  CardRarity,
  CardEffect,
  DailyRecord,
  EndingResult,
  Faction,
  GameAction,
  GameState,
  InquiryPhase,
  InquiryTargetContext,
  RunSummary,
  StartRunParams
} from "./types.js";

const factionOrder: Faction[] = ["gov", "corp", "anti"];
const defaultRarityWeights: Record<CardRarity, number> = { W: 0, G: 0, B: 0, R: 0, O: 0 };

const govPersonas = ["发言人", "技术主管", "部长", "副总统"] as const;
const corpPersonas = ["发言人", "法务", "高管", "CEO"] as const;
const antiPersonas = ["游行者", "领队", "策划", "领袖"] as const;

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

function compareFactions(a: string, b: string) {
  return factionOrder.indexOf(a as Faction) - factionOrder.indexOf(b as Faction);
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

function weightedCardPick(cards: CardDefinition[], seed: number, day: number, inquiryIndex: number, targetContext: InquiryTargetContext) {
  const pool = cards
    .filter((card) => card.sourceFaction === targetContext.target && !card.starter)
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
      pressureAfter: state.pressure
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
  const warehouseCards = config.starterCardIds.map((cardId, index) =>
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
    history: [],
    ...(params.balanceVersionId !== undefined ? { balanceVersionId: params.balanceVersionId } : {})
  };
}

export function resolveInquiry(config: BalanceConfig, state: GameState, target: Faction, seed: number) {
  if (state.runStatus !== "active") {
    throw new Error("Run is not active");
  }

  if (state.inquiryRemaining <= 0) {
    throw new Error("No inquiry actions remaining");
  }

  const inquiryIndex = 3 - state.inquiryRemaining;
  const targetContext = describeInquiryTarget(state, target);
  const card = instantiateCard(
    weightedCardPick(config.cards, seed, state.day, inquiryIndex, targetContext),
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

    state.world = addEffect(state.world, card.effect);
    state.playerInfluence = addEffect(state.playerInfluence, card.effect);

    if (card.reusable) {
      state.warehouseCards = [...state.warehouseCards, card];
    }

    const record = currentDayRecord(state);
    record.playedCards.push({
      cardId: card.id,
      source,
      effect: card.effect,
      rarity: card.rarity,
      playedAt: new Date().toISOString()
    });

    return {
      state,
      actionSummary: `Played ${card.name}`
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

  record.discardedCardIds = discarded.map((card) => card.id);
  record.retainedCardIds = retained.map((card) => card.id);
  record.reportSubmitted = action.submitReport && playedCardsCount > 0;
  record.pressureAfter = pressure.nextPressure;
  state.pressure = pressure.nextPressure;

  if (state.pressure >= config.pressure.deathThreshold) {
    state.runStatus = "dead";
    state.ending = determineEnding(state);

    return {
      state,
      actionSummary: "Pressure exceeded the threshold"
    };
  }

  if (state.day >= 7) {
    state.runStatus = "completed";
    state.ending = determineEnding(state);

    return {
      state,
      actionSummary: "The 7-day investigation ended"
    };
  }

  state.day += 1;
  state.inquiryRemaining = 3;

  return {
    state,
    actionSummary: record.reportSubmitted ? `Submitted a report and ended day ${record.day}` : `Ended day ${record.day} with an empty report`
  };
}
