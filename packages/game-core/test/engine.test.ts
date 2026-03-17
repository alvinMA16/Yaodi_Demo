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

  it("ships dynamic balance cards in the default pool", () => {
    const dynamicCards = defaultBalanceConfig.cards.filter((card) => card.effectMode);

    expect(dynamicCards.length).toBeGreaterThanOrEqual(12);
  });

  it("ships orange cards in the default pool", () => {
    const orangeCards = defaultBalanceConfig.cards.filter((card) => card.rarity === "O");

    expect(orangeCards.map((card) => card.id).sort()).toEqual([
      "anti-public-opinion",
      "anti-twin-kill",
      "corp-all-in",
      "corp-bet-on-top",
      "gov-ban-order",
      "gov-coup",
      "gov-market-swing"
    ]);
  });

  it("starts with three starter cards and zero pressure", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42, balanceVersionId: 1 });

    expect(state.day).toBe(1);
    expect(state.pressure).toBe(0);
    expect(state.warehouseCards).toHaveLength(3);
    expect(state.balanceVersionId).toBe(1);
  });

  it("rejects starter loadouts that exceed the carry slots", () => {
    expect(() =>
      startRun(
        {
          ...defaultBalanceConfig,
          starterCardIds: [...defaultBalanceConfig.starterCardIds, "gov-guidance"]
        },
        { seed: 42 }
      )
    ).toThrow("Starter loadout exceeds warehouse carry slots");
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
    expect(result.state.history[0]?.worldEventTitle).toBeTruthy();
    expect(result.state.history[0]?.worldEventEffect).toBeTruthy();
    expect(result.state.history[0]?.endDayResolutionLogs[0]?.step).toBe("世界事件");
  });

  it("resolves deterministic world events for the same seed and actions", () => {
    const first = startRun(defaultBalanceConfig, { seed: 123 });
    const second = startRun(defaultBalanceConfig, { seed: 123 });

    applyAction(defaultBalanceConfig, 123, first, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });
    applyAction(defaultBalanceConfig, 123, second, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });

    expect(first.world).toEqual(second.world);
    expect(first.history[0]?.worldEventTitle).toBe(second.history[0]?.worldEventTitle);
    expect(first.history[0]?.worldEventSummary).toBe(second.history[0]?.worldEventSummary);
    expect(first.history[0]?.endDayResolutionLogs.map((entry) => entry.step)).toEqual(
      second.history[0]?.endDayResolutionLogs.map((entry) => entry.step)
    );
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

  it("rejects inquiries when the info card slots are full", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const fillerCards = defaultBalanceConfig.cards.filter((card) => !card.starter).slice(0, 3);

    state.infoCards.push(
      ...fillerCards.map((card, index) => ({
        ...card,
        instanceId: `filled-slot-${index + 1}`
      }))
    );

    expect(() => applyAction(defaultBalanceConfig, 42, state, { type: "inquire", target: "gov" })).toThrow(
      "Info card slots are full"
    );
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
      pressureAfter: 0,
      worldBefore: { gov: 0, corp: 0, anti: 0 },
      worldAfter: { gov: 0, corp: 12, anti: -4 },
      endDayResolutionLogs: []
    });
    state.day = 4;
    state.world = { gov: 0, corp: 12, anti: -4 };

    const context = describeInquiryTarget(state, "corp");

    expect(context.phase).toBe("day4to6");
    expect(context.level).toBe(2);
    expect(context.persona).toBe("法务");
    expect(context.rarityWeights.R).toBe(4);
  });

  it("resolves a boost-lowest card against the current world state", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const card = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-weak-side-protection");

    state.infoCards.push({
      ...card!,
      instanceId: "dynamic-lowest"
    });
    state.world = { gov: 4, corp: 1, anti: 1 };

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "dynamic-lowest"
    });

    expect(state.world).toEqual({ gov: 4, corp: 3, anti: 3 });
  });

  it("resolves a shift-high-to-low card against the current world state", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const card = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-market-rebalance");

    state.infoCards.push({
      ...card!,
      instanceId: "dynamic-balance"
    });
    state.world = { gov: 3, corp: 1, anti: 1 };

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "dynamic-balance"
    });

    expect(state.world).toEqual({ gov: 2, corp: 2, anti: 2 });
  });

  it("only allows all-in on day 7", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const allIn = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-all-in");

    state.infoCards.push({ ...allIn!, instanceId: "all-in-early" });

    expect(() =>
      applyAction(defaultBalanceConfig, 42, state, {
        type: "playCard",
        cardInstanceId: "all-in-early"
      })
    ).toThrow("梭哈只能在 Day 7 使用");
  });

  it("doubles the whole day 7 delta after world resolution", () => {
    const base = startRun(defaultBalanceConfig, { seed: 42 });
    const allInState = startRun(defaultBalanceConfig, { seed: 42 });
    const allIn = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-all-in");
    const push = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-ads");

    base.day = 7;
    allInState.day = 7;
    base.infoCards.push({ ...push!, instanceId: "base-push" });
    allInState.infoCards.push(
      { ...allIn!, instanceId: "all-in-final" },
      { ...push!, instanceId: "all-in-push" }
    );

    applyAction(defaultBalanceConfig, 42, base, {
      type: "playCard",
      cardInstanceId: "base-push"
    });
    applyAction(defaultBalanceConfig, 42, base, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    applyAction(defaultBalanceConfig, 42, allInState, {
      type: "playCard",
      cardInstanceId: "all-in-final"
    });
    applyAction(defaultBalanceConfig, 42, allInState, {
      type: "playCard",
      cardInstanceId: "all-in-push"
    });
    applyAction(defaultBalanceConfig, 42, allInState, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    expect(allInState.world).toEqual({
      gov: base.world.gov * 2,
      corp: base.world.corp * 2,
      anti: base.world.anti * 2
    });
  });

  it("resolves market swing at end of day", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const swing = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-market-swing");
    const push = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-guidance");

    state.infoCards.push(
      { ...swing!, instanceId: "swing" },
      { ...push!, instanceId: "push" }
    );

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "swing"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "push"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    expect(state.world).toEqual({ gov: 4, corp: 0, anti: 1 });
  });

  it("kills the run when public opinion is active and info cards are retained", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const publicOpinion = defaultBalanceConfig.cards.find((entry) => entry.id === "anti-public-opinion");
    const retainedInfo = defaultBalanceConfig.cards.find((entry) => entry.id === "anti-protest");

    state.infoCards.push(
      { ...publicOpinion!, instanceId: "public-opinion" },
      { ...retainedInfo!, instanceId: "retained-info" }
    );

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "public-opinion"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });

    expect(state.runStatus).toBe("dead");
    expect(state.ending?.code).toBe("death");
  });

  it("forces the chosen faction to use the top inquiry level for the day", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const bet = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-bet-on-top");

    state.infoCards.push({
      ...bet!,
      instanceId: "bet"
    });

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "bet",
      targetFactions: ["anti"]
    });

    const context = describeInquiryTarget(state, "anti");
    expect(context.level).toBe(4);
    expect(context.persona).toBe("领袖");
  });

  it("kills the run if bet on top does not finish the day in the lead", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const bet = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-bet-on-top");
    const corpPush = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-ads");

    state.infoCards.push({
      ...bet!,
      instanceId: "bet-fail"
    });
    state.infoCards.push({
      ...corpPush!,
      instanceId: "corp-push"
    });

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "bet-fail",
      targetFactions: ["anti"]
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "corp-push"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    expect(state.runStatus).toBe("dead");
    expect(state.ending?.code).toBe("death");
  });

  it("forces the chosen faction negative and adds 25 pressure", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const ban = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-ban-order");
    const push = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-ads");

    state.infoCards.push(
      { ...ban!, instanceId: "ban" },
      { ...push!, instanceId: "push-positive" }
    );

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "ban",
      targetFactions: ["corp"]
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "push-positive"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    expect(state.pressure).toBeGreaterThanOrEqual(25);
    expect(state.history[0]?.worldAfter.corp).toBeLessThan(state.history[0]?.worldBefore.corp ?? 0);
  });

  it("forces the chosen pair to move in the same direction by end of day", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const twinKill = defaultBalanceConfig.cards.find((entry) => entry.id === "anti-twin-kill");
    const audit = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-audit");

    state.infoCards.push(
      { ...twinKill!, instanceId: "twin-kill" },
      { ...audit!, instanceId: "audit" }
    );

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "twin-kill",
      targetFactions: ["gov", "corp"]
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "audit"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    const record = state.history[0]!;
    const govDelta = record.worldAfter.gov - record.worldBefore.gov;
    const corpDelta = record.worldAfter.corp - record.worldBefore.corp;

    expect(govDelta).toBeGreaterThan(0);
    expect(corpDelta).toBeGreaterThan(0);
  });

  it("kills the run on day 7 if a twin-kill oath includes a trailing faction", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const twinKill = defaultBalanceConfig.cards.find((entry) => entry.id === "anti-twin-kill");

    state.day = 7;
    state.world = { gov: 30, corp: 20, anti: -30 };
    state.infoCards.push({
      ...twinKill!,
      instanceId: "twin-kill-final"
    });

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "twin-kill-final",
      targetFactions: ["gov", "anti"]
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });

    expect(state.runStatus).toBe("dead");
    expect(state.ending?.code).toBe("death");
  });

  it("swaps the highest and lowest factions after end-of-day resolution", () => {
    const base = startRun(defaultBalanceConfig, { seed: 42 });
    const coupState = startRun(defaultBalanceConfig, { seed: 42 });
    const coup = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-coup");

    base.day = 7;
    coupState.day = 7;
    base.world = { gov: 15, corp: 8, anti: -30 };
    coupState.world = { gov: 15, corp: 8, anti: -30 };
    coupState.infoCards.push({
      ...coup!,
      instanceId: "coup-final"
    });

    applyAction(defaultBalanceConfig, 42, base, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });
    applyAction(defaultBalanceConfig, 42, coupState, {
      type: "playCard",
      cardInstanceId: "coup-final"
    });
    applyAction(defaultBalanceConfig, 42, coupState, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });

    const expected = { ...base.world };
    expected.gov = base.world.anti;
    expected.anti = base.world.gov;

    expect(coupState.world).toEqual(expected);
    expect(coupState.runStatus).toBe("dead");
    expect(coupState.ending?.code).toBe("death");
  });

  it("allows coup to survive only on a perfect ending", () => {
    const state = startRun(defaultBalanceConfig, { seed: 7 });
    const coup = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-coup");

    state.day = 7;
    state.world = { gov: 10, corp: 60, anti: -40 };
    state.playerInfluence = { gov: 0, corp: 0, anti: 30 };
    state.history = Array.from({ length: 6 }, (_, index) => ({
      day: index + 1,
      inquiries: [],
      playedCards: [],
      discardedCardIds: [],
      retainedCardIds: [],
      reportSubmitted: true,
      pressureBefore: 0,
      pressureAfter: 0,
      worldBefore: { gov: 0, corp: 0, anti: 0 },
      worldAfter: { gov: 0, corp: 0, anti: 0 },
      endDayResolutionLogs: []
    }));
    state.infoCards.push({
      ...coup!,
      instanceId: "coup-perfect"
    });

    applyAction(defaultBalanceConfig, 7, state, {
      type: "playCard",
      cardInstanceId: "coup-perfect"
    });
    applyAction(defaultBalanceConfig, 7, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: true
    });

    expect(state.runStatus).toBe("completed");
    expect(state.ending?.code).toBe("perfect");
  });

  it("resolves all-in before coup in the fixed end-of-day order", () => {
    const state = startRun(defaultBalanceConfig, { seed: 42 });
    const allIn = defaultBalanceConfig.cards.find((entry) => entry.id === "corp-all-in");
    const coup = defaultBalanceConfig.cards.find((entry) => entry.id === "gov-coup");

    state.day = 7;
    state.world = { gov: 15, corp: 8, anti: -30 };
    state.infoCards.push(
      { ...allIn!, instanceId: "stack-all-in" },
      { ...coup!, instanceId: "stack-coup" }
    );

    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "stack-all-in"
    });
    applyAction(defaultBalanceConfig, 42, state, {
      type: "playCard",
      cardInstanceId: "stack-coup"
    });
    const result = applyAction(defaultBalanceConfig, 42, state, {
      type: "endDay",
      discardCardInstanceIds: [],
      submitReport: false
    });

    expect(result.actionSummary.includes("not perfect")).toBe(true);
    expect(state.history[0]?.endDayResolutionLogs.map((entry) => entry.step)).toEqual(["世界事件", "梭哈", "政变"]);
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
    expect(ending.worldEndingTitle).toBe("无伤大雅");
    expect(ending.rankingLabel).toBe("corp > anti > gov");
  });
});
