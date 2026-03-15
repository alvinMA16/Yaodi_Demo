import { describe, expect, it } from "vitest";
import { applyAction, defaultBalanceConfig, describeInquiryTarget, determineEnding, startRun } from "../src/index.js";

describe("game core", () => {
  it("ships a non-starter card pool for every faction and rarity band", () => {
    const nonStarterCards = defaultBalanceConfig.cards.filter((card) => !card.starter);

    for (const faction of ["gov", "corp", "anti"] as const) {
      for (const rarity of ["W", "G", "B", "R"] as const) {
        expect(nonStarterCards.some((card) => card.sourceFaction === faction && card.rarity === rarity)).toBe(true);
      }
    }
  });

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

  it("rejects submitting a report when no cards were played that day", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });

    expect(() =>
      applyAction(defaultBalanceConfig, 42, state, {
        type: "endDay",
        discardCardInstanceIds: [],
        submitReport: true
      })
    ).toThrow("Cannot submit a report without playing at least one card");
  });

  it("uses early-phase rarity gating for anti inquiries", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const context = describeInquiryTarget(state, "anti");

    expect(context.phase).toBe("day1to3");
    expect(context.persona).toBe("游行者");
    expect(context.rarityWeights.R).toBe(0);
    expect(context.rarityWeights.O).toBe(0);
  });

  it("upgrades the corp inquiry persona after a large daily corp swing", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });

    state.history.push({
      day: 4,
      inquiries: [],
      playedCards: [
        {
          cardId: "corp-ads",
          source: "info",
          effect: { gov: 0, corp: 12, anti: -4 },
          rarity: "G",
          playedAt: new Date().toISOString()
        }
      ],
      discardedCardIds: [],
      retainedCardIds: [],
      reportSubmitted: true,
      pressureBefore: 0,
      pressureAfter: 0
    });
    state.day = 4;
    state.world = { gov: 0, corp: 12, anti: -4 };

    const context = describeInquiryTarget(state, "corp");

    expect(context.phase).toBe("day4to6");
    expect(context.level).toBe(2);
    expect(context.persona).toBe("法务");
    expect(context.rarityWeights.R).toBe(4);
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
    expect(ending.worldEndingTitle).toBe("坐收渔利");
    expect(ending.rankingLabel).toBe("corp > gov = anti");
  });
});
