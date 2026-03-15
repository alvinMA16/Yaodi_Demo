export type Faction = "gov" | "corp" | "anti";
export type CardRarity = "W" | "G" | "B" | "R" | "O";
export type RunStatus = "active" | "completed" | "dead";
export type EndingCode = "perfect" | "win" | "failure" | "blank" | "death";

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
  weight: number;
  reusable?: boolean;
  starter?: boolean;
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

export interface DailyRecord {
  day: number;
  inquiries: InquiryLog[];
  playedCards: PlayedCardLog[];
  discardedCardIds: string[];
  retainedCardIds: string[];
  reportSubmitted: boolean;
  pressureBefore: number;
  pressureAfter: number;
}

export interface EndingResult {
  code: EndingCode;
  title: string;
  summary: string;
  ranking: string[];
  playerTendency: string[];
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
  history: DailyRecord[];
  balanceVersionId?: number;
  ending?: EndingResult;
}

export type StartRunParams = {
  seed: number;
  balanceVersionId?: number;
};

export type GameAction =
  | { type: "inquire"; target: Faction }
  | { type: "playCard"; cardInstanceId: string }
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
