import { describe, expect, it } from "vitest";
import { applyAction, defaultBalanceConfig, determineEnding, startRun } from "../src/index.js";

describe("game core", () => {
  it("starts with three starter cards and zero pressure", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42, balanceVersionId: 1 });

    expect(state.day).toBe(1);
    expect(state.pressure).toBe(0);
    expect(state.warehouseCards).toHaveLength(3);
    expect(state.balanceVersionId).toBe(1);
  });

  it("increments pressure and day on end day", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    applyAction(defaultBalanceConfig, 42, state, { type: "inquire", target: "gov" });
    const result = applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });

    expect(result.state.day).toBe(2);
    expect(result.state.pressure).toBeGreaterThan(0);
  });

  it("resolves a perfect ending when reports are complete and tendency matches leaders", () => {
    const state = startRun(defaultBalanceConfig, { seed: 7 });

    for (let day = 1; day <= 7; day += 1) {
      applyAction(defaultBalanceConfig, 7, state, {
        type: "playCard",
        cardInstanceId: state.warehouseCards.find((card) => card.id === "brief-corp")!.instanceId!
      });
      applyAction(defaultBalanceConfig, 7, state, { type: "endDay", discardCardInstanceIds: [], submitReport: true });
      if (day < 7) {
        state.warehouseCards.push({
          id: "brief-corp",
          instanceId: `corp-${day}`,
          name: "市场简报",
          description: "为公司争取舆论空间。",
          rarity: "W",
          sourceFaction: "corp",
          effect: { gov: 0, corp: 2, anti: 0 },
          weight: 1
        });
      }
    }

    const ending = determineEnding(state);
    expect(ending.code).toBe("perfect");
  });
});
