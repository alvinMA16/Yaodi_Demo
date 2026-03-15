import { defaultBalanceConfig } from "@alibi/game-core";

export function createDraftVersionName() {
  return `draft-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function draftFromConfig(version: string, sourceConfig?: string) {
  return {
    version,
    name: `Draft ${version}`,
    status: "draft",
    description: "Editable balance draft",
    configJson: sourceConfig ?? JSON.stringify(defaultBalanceConfig)
  };
}

