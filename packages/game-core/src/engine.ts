import { createRng } from "./random.js";
import type {
  ApplyActionResult,
  BalanceConfig,
  CardDefinition,
  CardEffect,
  DailyRecord,
  EndingResult,
  Faction,
  GameAction,
  GameState,
  RunSummary,
  StartRunParams
} from "./types.js";

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

function weightedCardPick(cards: CardDefinition[], seed: number, day: number, inquiryIndex: number, target: Faction) {
  const pool = cards.filter((card) => card.sourceFaction === target && !card.starter);

  if (pool.length === 0) {
    throw new Error(`No cards configured for target ${target}`);
  }

  const rng = createRng(seed + day * 100 + inquiryIndex * 17 + target.charCodeAt(0));
  const totalWeight = pool.reduce((sum, card) => sum + card.weight, 0);
  const roll = rng() * totalWeight;
  let cursor = 0;

  for (const card of pool) {
    cursor += card.weight;
    if (roll <= cursor) {
      return card;
    }
  }

  return pool[pool.length - 1]!;
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

function rankingFromEffect(effect: CardEffect) {
  return Object.entries(effect)
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }

      return b[1] - a[1];
    })
    .map(([faction]) => faction);
}

function topTendency(effect: CardEffect) {
  const maxValue = Math.max(effect.gov, effect.corp, effect.anti);

  return Object.entries(effect)
    .filter(([, value]) => value === maxValue)
    .map(([faction]) => faction)
    .sort();
}

export function determineEnding(state: GameState): EndingResult {
  const ranking = rankingFromEffect(state.world);
  const playerTendency = topTendency(state.playerInfluence);
  const reportDays = state.history.filter((day) => day.reportSubmitted).length;

  if (state.runStatus === "dead") {
    return {
      code: "death",
      title: "死亡",
      summary: "压力突破阈值，调查在崩溃前终止。",
      ranking,
      playerTendency
    };
  }

  if (reportDays === 0) {
    return {
      code: "blank",
      title: "全空白",
      summary: "七天没有提交任何报告，案件被彻底放空。",
      ranking,
      playerTendency
    };
  }

  if (reportDays < 7) {
    return {
      code: "failure",
      title: "调查失败",
      summary: "你活了下来，但调查并未持续推进到最后。",
      ranking,
      playerTendency
    };
  }

  const winnerScore = Math.max(state.world.gov, state.world.corp, state.world.anti);
  const leaders = Object.entries(state.world)
    .filter(([, value]) => value === winnerScore)
    .map(([faction]) => faction)
    .sort();
  const isPerfect = playerTendency.some((faction) => leaders.includes(faction));

  return isPerfect
    ? {
        code: "perfect",
        title: "强胜利",
        summary: "你的行动倾向与最终主导阵营保持一致，报告完整且方向正确。",
        ranking,
        playerTendency
      }
    : {
        code: "win",
        title: "胜利",
        summary: "你完成了全部调查，但推进方向与最终世界走向并不一致。",
        ranking,
        playerTendency
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
  const card = instantiateCard(
    weightedCardPick(config.cards, seed, state.day, inquiryIndex, target),
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
  const rareCardsPlayed = record.playedCards
    .map((entry) => findCard(config.cards, entry.cardId))
    .filter((card) => card.rarity === "B" || card.rarity === "R");
  const pressure = computePressure(config, state.pressure, state.day, retained.length, discarded.length, rareCardsPlayed);

  record.discardedCardIds = discarded.map((card) => card.id);
  record.retainedCardIds = retained.map((card) => card.id);
  record.reportSubmitted = action.submitReport;
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
    actionSummary: `Ended day ${record.day}`
  };
}
