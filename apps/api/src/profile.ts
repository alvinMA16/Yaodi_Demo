import type { BalanceConfig, CardDefinition, GameState } from "@alibi/game-core";
import { runCardLimits } from "@alibi/game-core";

export interface PlayerProfileRecord {
  inventoryCardIds: string[];
  equippedCardIds: string[];
  settlements: InventorySettlement[];
  updatedAt: string;
}

export interface InventorySettlement {
  outcome: "perfect" | "win" | "failure" | "blank" | "death";
  loadoutCardIds: string[];
  returnedCardIds: string[];
  gainedCardIds: string[];
  lostCardIds: string[];
  summary: string;
  createdAt: string;
}

export interface ProfileCardEntry {
  cardId: string;
  name: string;
  rarity: CardDefinition["rarity"];
  sourceFaction: CardDefinition["sourceFaction"];
  count: number;
  effectLabel: string;
}

export interface ProfileResponse {
  inventoryEntries: ProfileCardEntry[];
  equippedCardIds: string[];
  carrySlots: number;
  maxOrangeCarry: number;
  rewardPoolSummary: {
    totalCards: number;
    byRarity: Record<Exclude<CardDefinition["rarity"], "O">, number>;
  };
  recentSettlements: InventorySettlement[];
}

const maxOrangeCarry = 1;
const settlementHistoryLimit = 12;

function createRng(seed: number) {
  let value = (seed >>> 0) || 1;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function findCard(config: BalanceConfig, cardId: string) {
  const card = config.cards.find((entry) => entry.id === cardId);

  if (!card) {
    throw new Error(`Card not found in active balance: ${cardId}`);
  }

  return card;
}

function removeCardIds(pool: string[], cardIds: string[]) {
  const next = [...pool];

  for (const cardId of cardIds) {
    const index = next.indexOf(cardId);

    if (index === -1) {
      throw new Error(`Card ${cardId} is not available in profile inventory`);
    }

    next.splice(index, 1);
  }

  return next;
}

function pickRandomCardIds(pool: string[], amount: number, seed: number) {
  const remaining = [...pool];
  const picked: string[] = [];
  const rng = createRng(seed);

  while (remaining.length > 0 && picked.length < amount) {
    const index = Math.floor(rng() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]!);
  }

  return {
    picked,
    remaining
  };
}

function weightedRewardDraw(config: BalanceConfig, amount: number, seed: number) {
  const rewardPool = config.cards.filter((card) => !card.starter && card.rarity !== "O");
  const rng = createRng(seed);
  const drawn: string[] = [];

  for (let drawIndex = 0; drawIndex < amount; drawIndex += 1) {
    const totalWeight = rewardPool.reduce((sum, card) => sum + Math.max(0, card.weight), 0);

    if (totalWeight <= 0) {
      break;
    }

    let roll = rng() * totalWeight;

    for (const card of rewardPool) {
      roll -= Math.max(0, card.weight);
      if (roll <= 0) {
        drawn.push(card.id);
        break;
      }
    }
  }

  return drawn;
}

function summarizeCardEntries(cardIds: string[], config: BalanceConfig) {
  return cardIds.map((cardId) => findCard(config, cardId).name).join("、") || "无";
}

function clampEquippedCardIds(equippedCardIds: string[], inventoryCardIds: string[]) {
  const remaining = [...inventoryCardIds];
  const next: string[] = [];

  for (const cardId of equippedCardIds) {
    const index = remaining.indexOf(cardId);

    if (index === -1) {
      continue;
    }

    next.push(cardId);
    remaining.splice(index, 1);
  }

  return next;
}

function orangeCarryCount(cardIds: string[], config: BalanceConfig) {
  return cardIds.filter((cardId) => findCard(config, cardId).rarity === "O").length;
}

function assertLoadout(cardIds: string[], inventoryCardIds: string[], config: BalanceConfig) {
  if (cardIds.length > runCardLimits.warehouseCarrySlots) {
    throw new Error(`最多只能携带 ${runCardLimits.warehouseCarrySlots} 张仓库卡`);
  }

  if (orangeCarryCount(cardIds, config) > maxOrangeCarry) {
    throw new Error(`最多只能携带 ${maxOrangeCarry} 张橙卡`);
  }

  removeCardIds(inventoryCardIds, cardIds);
}

export function createSeedProfile(config: BalanceConfig, nowIso: string): PlayerProfileRecord {
  return {
    inventoryCardIds: [...config.starterCardIds],
    equippedCardIds: [...config.starterCardIds],
    settlements: [],
    updatedAt: nowIso
  };
}

export function profileResponse(profile: PlayerProfileRecord, config: BalanceConfig): ProfileResponse {
  const counts = new Map<string, number>();
  const rewardPoolSummary = {
    totalCards: 0,
    byRarity: {
      W: 0,
      G: 0,
      B: 0,
      R: 0
    }
  };

  for (const cardId of profile.inventoryCardIds) {
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }

  for (const card of config.cards) {
    if (card.starter || card.rarity === "O") {
      continue;
    }

    rewardPoolSummary.totalCards += 1;
    rewardPoolSummary.byRarity[card.rarity] += 1;
  }

  const inventoryEntries = [...counts.entries()]
    .map(([cardId, count]) => {
      const card = findCard(config, cardId);

      return {
        cardId,
        name: card.name,
        rarity: card.rarity,
        sourceFaction: card.sourceFaction,
        count,
        effectLabel: card.effectLabel ?? `Gov ${card.effect.gov} / Corp ${card.effect.corp} / Anti ${card.effect.anti}`
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  return {
    inventoryEntries,
    equippedCardIds: [...profile.equippedCardIds],
    carrySlots: runCardLimits.warehouseCarrySlots,
    maxOrangeCarry,
    rewardPoolSummary,
    recentSettlements: [...profile.settlements].slice(-5).reverse()
  };
}

export function resolveLoadout(
  requestedCardIds: string[] | undefined,
  profile: PlayerProfileRecord,
  config: BalanceConfig
) {
  const candidate = requestedCardIds ?? profile.equippedCardIds;
  assertLoadout(candidate, profile.inventoryCardIds, config);
  return [...candidate];
}

export function updateEquippedLoadout(profile: PlayerProfileRecord, equippedCardIds: string[], config: BalanceConfig, nowIso: string) {
  assertLoadout(equippedCardIds, profile.inventoryCardIds, config);

  return {
    ...profile,
    equippedCardIds: [...equippedCardIds],
    updatedAt: nowIso
  };
}

export function removeLoadoutFromProfile(profile: PlayerProfileRecord, loadoutCardIds: string[], nowIso: string): PlayerProfileRecord {
  return {
    ...profile,
    inventoryCardIds: removeCardIds(profile.inventoryCardIds, loadoutCardIds),
    updatedAt: nowIso
  };
}

export function settleProfileAfterRun(
  profile: PlayerProfileRecord,
  config: BalanceConfig,
  state: GameState,
  loadoutCardIds: string[],
  seed: number,
  nowIso: string
) {
  if (!state.ending?.code) {
    throw new Error("Cannot settle a run without an ending");
  }

  const remainingCardIds = [...state.warehouseCards, ...state.infoCards].map((card) => card.id);
  const combinedPool = [...profile.inventoryCardIds, ...remainingCardIds];
  const outcome = state.ending.code;
  let gainedCardIds: string[] = [];
  let lostCardIds: string[] = [];
  let returnedCardIds: string[] = [];
  let inventoryCardIds = [...profile.inventoryCardIds];

  if (outcome === "perfect" || outcome === "win") {
    returnedCardIds = remainingCardIds;
    gainedCardIds = weightedRewardDraw(config, outcome === "perfect" ? 2 : 1, seed + 701);
    inventoryCardIds = [...profile.inventoryCardIds, ...returnedCardIds, ...gainedCardIds];
  } else {
    let lossCount = 0;

    if (outcome === "failure") {
      lossCount = 1;
    } else if (outcome === "blank") {
      lossCount = 6;
    } else if (outcome === "death") {
      const carriedOrange = orangeCarryCount(loadoutCardIds, config) > 0;
      const playedAllIn = state.history.some((day) => day.playedCards.some((entry) => entry.cardId === "corp-all-in"));
      lossCount = playedAllIn ? 9 : carriedOrange ? 6 : 3;
    }

    const lossSeed = seed + (outcome === "failure" ? 801 : outcome === "blank" ? 901 : 1001);
    const lossResult = pickRandomCardIds(combinedPool, lossCount, lossSeed);
    lostCardIds = lossResult.picked;
    inventoryCardIds = lossResult.remaining;
  }

  const settlement: InventorySettlement = {
    outcome,
    loadoutCardIds: [...loadoutCardIds],
    returnedCardIds,
    gainedCardIds,
    lostCardIds,
    summary:
      outcome === "perfect" || outcome === "win"
        ? `带回 ${summarizeCardEntries(returnedCardIds, config)}；获得 ${summarizeCardEntries(gainedCardIds, config)}`
        : `掉落 ${summarizeCardEntries(lostCardIds, config)}`,
    createdAt: nowIso
  };

  const settlements = [...profile.settlements, settlement].slice(-settlementHistoryLimit);
  const equippedCardIds = clampEquippedCardIds(profile.equippedCardIds, inventoryCardIds);

  return {
    profile: {
      ...profile,
      inventoryCardIds,
      equippedCardIds,
      settlements,
      updatedAt: nowIso
    },
    settlement
  };
}
