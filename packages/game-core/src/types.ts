export type Faction = "gov" | "corp" | "anti";
export type CardRarity = "W" | "G" | "B" | "R" | "O";
export type RunStatus = "active" | "completed" | "dead";
export type EndingCode = "perfect" | "win" | "failure" | "blank" | "death";
export type InquiryPhase = "day1to3" | "day4to6" | "day7";
export type CardEffectMode = "boost_lowest_2" | "shift_high_to_low_1" | "shift_high_to_low_2" | "shift_high_to_low_3";
export type OrangeEffectMode =
  | "double_day_delta_today"
  | "market_swing_today"
  | "double_future_info_cards_no_retain"
  | "force_highest_inquiry_today"
  | "force_negative_target_today"
  | "lockstep_pair_today"
  | "swap_highest_lowest_today";

export interface CardEffect {
  gov: number;
  corp: number;
  anti: number;
}

export interface CardDefinition {
  id: string;
  instanceId?: string;
  name: string;
  rarity: CardRarity;
  sourceFaction: Faction;
  description: string;
  effect: CardEffect;
  effectMode?: CardEffectMode;
  orangeEffect?: OrangeEffectMode;
  effectLabel?: string;
  weight: number;
  reusable?: boolean;
  starter?: boolean;
}

export interface RunModifiers {
  doubleDayDeltaToday?: {
    day: number;
    sourceCardId: string;
    sourceCardName: string;
  };
  marketSwingToday?: {
    day: number;
    sourceCardId: string;
    sourceCardName: string;
  };
  infoCardMultiplier?: number;
  noRetainInfoCards?: boolean;
  forcedHighestInquiryToday?: {
    day: number;
    targetFaction: Faction;
    sourceCardId: string;
    sourceCardName: string;
  };
  forcedNegativeTargetToday?: {
    day: number;
    targetFaction: Faction;
    sourceCardId: string;
    sourceCardName: string;
  };
  lockstepPairToday?: {
    day: number;
    targetFactions: [Faction, Faction];
    sourceCardId: string;
    sourceCardName: string;
  };
  swapHighestLowestToday?: {
    day: number;
    sourceCardId: string;
    sourceCardName: string;
  };
  persistentOrangeEffects: Array<{
    sourceCardId: string;
    sourceCardName: string;
    description: string;
  }>;
  twinKillOaths: Array<{
    sourceCardId: string;
    sourceCardName: string;
    targetFactions: [Faction, Faction];
    description: string;
  }>;
  perfectEndingOaths: Array<{
    sourceCardId: string;
    sourceCardName: string;
    description: string;
  }>;
}

export interface PressureRules {
  retainedFactor: number;
  destroyFactor: number;
  bluePenalty: number;
  redPenalty: number;
  deathThreshold: number;
}

export interface BalanceConfig {
  versionName: string;
  starterCardIds: string[];
  inquiryTargets: Faction[];
  cards: CardDefinition[];
  pressure: PressureRules;
}

export interface BalanceVersionRef {
  id: number;
  version: string;
  status: string;
}

export interface InquiryLog {
  target: Faction;
  drawnCardId: string;
  drawnAt: string;
}

export interface PlayedCardLog {
  cardId: string;
  source: "info" | "warehouse";
  effect: CardEffect;
  rarity: CardRarity;
  playedAt: string;
}

export interface EndDayResolutionLog {
  step: string;
  summary: string;
  worldBefore: CardEffect;
  worldAfter: CardEffect;
  pressureBefore: number;
  pressureAfter: number;
}

export interface DailyRecord {
  day: number;
  inquiries: InquiryLog[];
  playedCards: PlayedCardLog[];
  discardedCardIds: string[];
  retainedCardIds: string[];
  reportSubmitted: boolean;
  pressureBefore: number;
  pressureAfter: number;
  worldBefore: CardEffect;
  worldAfter: CardEffect;
  endDayResolutionLogs: EndDayResolutionLog[];
  worldEventTitle?: string;
  worldEventSummary?: string;
  worldEventEffect?: CardEffect;
}

export interface EndingResult {
  code: EndingCode;
  title: string;
  summary: string;
  ranking: string[];
  rankingLabel: string;
  playerTendency: string[];
  playerTendencyLabel: string;
  worldEndingTitle: string;
  worldEndingSummary: string;
}

export interface InquiryTargetContext {
  target: Faction;
  day: number;
  phase: InquiryPhase;
  level: 1 | 2 | 3 | 4;
  persona: string;
  rarityWeights: Record<CardRarity, number>;
}

export interface GameState {
  day: number;
  inquiryRemaining: number;
  pressure: number;
  runStatus: RunStatus;
  world: CardEffect;
  playerInfluence: CardEffect;
  infoCards: CardDefinition[];
  warehouseCards: CardDefinition[];
  modifiers: RunModifiers;
  history: DailyRecord[];
  balanceVersionId?: number;
  ending?: EndingResult;
}

export type StartRunParams = {
  seed: number;
  balanceVersionId?: number;
  carryCardIds?: string[];
};

export type GameAction =
  | { type: "inquire"; target: Faction }
  | { type: "playCard"; cardInstanceId: string; targetFactions?: Faction[] }
  | { type: "endDay"; discardCardInstanceIds: string[]; submitReport: boolean };

export interface ApplyActionResult {
  state: GameState;
  actionSummary: string;
}

export interface RunSummary {
  status: RunStatus;
  day: number;
  pressure: number;
  ranking: string[];
  reportDays: number;
  balanceVersionId?: number;
  endingCode?: EndingCode;
}
