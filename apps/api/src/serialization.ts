import type { BalanceConfig, GameState, RunSummary } from "@alibi/game-core";

export function parseBalanceConfig(configJson: string) {
  return JSON.parse(configJson) as BalanceConfig;
}

export function parseState(stateJson: string) {
  return JSON.parse(stateJson) as GameState;
}

export function parseSummary(summaryJson: string) {
  return JSON.parse(summaryJson) as RunSummary;
}

