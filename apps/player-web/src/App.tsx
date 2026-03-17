import { useEffect, useMemo, useState } from "react";
import { describeInquiryTarget, endDayResolutionOrderLabels, runCardLimits } from "@alibi/game-core";
import type { CardDefinition, Faction, GameState, InquiryTargetContext } from "@alibi/game-core";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

type ProfileCardEntry = {
  cardId: string;
  name: string;
  rarity: CardDefinition["rarity"];
  sourceFaction: Faction;
  count: number;
  effectLabel: string;
};

type InventorySettlement = {
  outcome: "perfect" | "win" | "failure" | "blank" | "death";
  loadoutCardIds: string[];
  returnedCardIds: string[];
  gainedCardIds: string[];
  lostCardIds: string[];
  summary: string;
  createdAt: string;
};

type ProfileResponse = {
  inventoryEntries: ProfileCardEntry[];
  equippedCardIds: string[];
  carrySlots: number;
  maxOrangeCarry: number;
  rewardPoolSummary: {
    totalCards: number;
    byRarity: {
      W: number;
      G: number;
      B: number;
      R: number;
    };
  };
  recentSettlements: InventorySettlement[];
};

type BootstrapResponse = {
  activeBalanceVersion?: {
    id: number;
    version: string;
    name: string;
    status: string;
  };
  profile?: ProfileResponse;
};

type RunResponse = {
  id: string;
  seed: number;
  status: string;
  balanceVersionId: number;
  loadoutCardIds: string[];
  settlement: InventorySettlement | null;
  state: GameState;
  summary: {
    day: number;
    pressure: number;
    status: string;
    ranking: string[];
    reportDays: number;
  };
  actionSummary?: string;
  profile?: ProfileResponse;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

function scoreLabel(state: GameState) {
  return [`Gov ${state.world.gov}`, `Corp ${state.world.corp}`, `Anti ${state.world.anti}`].join(" / ");
}

function worldLabel(world: { gov: number; corp: number; anti: number }) {
  return [`Gov ${world.gov}`, `Corp ${world.corp}`, `Anti ${world.anti}`].join(" / ");
}

function cardEffectLabel(card: CardDefinition) {
  return card.effectLabel ?? `Gov ${card.effect.gov} / Corp ${card.effect.corp} / Anti ${card.effect.anti}`;
}

function requiresSingleTarget(card: CardDefinition) {
  return card.orangeEffect === "force_highest_inquiry_today" || card.orangeEffect === "force_negative_target_today";
}

function requiresPairTarget(card: CardDefinition) {
  return card.orangeEffect === "lockstep_pair_today";
}

function countCardIds(cardIds: string[]) {
  const counts = new Map<string, number>();

  for (const cardId of cardIds) {
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }

  return counts;
}

function outcomeLabel(outcome: InventorySettlement["outcome"]) {
  if (outcome === "perfect") {
    return "强胜利";
  }

  if (outcome === "win") {
    return "胜利";
  }

  if (outcome === "failure") {
    return "失败";
  }

  if (outcome === "blank") {
    return "空白结局";
  }

  return "死亡";
}

function loadoutBlockReason(params: {
  entry: ProfileCardEntry;
  equippedCount: number;
  equippedTotal: number;
  carrySlots: number;
  equippedOrangeCount: number;
  maxOrangeCarry: number;
  hasActiveRun: boolean;
  pending: boolean;
}) {
  const { entry, equippedCount, equippedTotal, carrySlots, equippedOrangeCount, maxOrangeCarry, hasActiveRun, pending } = params;

  if (hasActiveRun) {
    return "本局进行中，下一局携带配置暂时锁定。";
  }

  if (pending) {
    return "正在更新携带配置。";
  }

  if (equippedCount >= entry.count) {
    return "这张牌在仓库里的可用份数已经用完。";
  }

  if (equippedTotal >= carrySlots) {
    return `携带位已满，只能带 ${carrySlots} 张。`;
  }

  if (entry.rarity === "O" && equippedOrangeCount >= maxOrangeCarry) {
    return `橙卡携带上限是 ${maxOrangeCarry} 张。`;
  }

  return null;
}

const pairTargets: Array<{ label: string; targets: [Faction, Faction] }> = [
  { label: "gov + corp", targets: ["gov", "corp"] },
  { label: "gov + anti", targets: ["gov", "anti"] },
  { label: "corp + anti", targets: ["corp", "anti"] }
];

function CardTile(props: {
  card: CardDefinition;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (cardInstanceId: string) => void;
  onPlay?: (cardInstanceId: string, targetFactions?: Faction[]) => void;
}) {
  const { card, selectable, selected, onSelect, onPlay } = props;

  return (
    <article className={`card-tile rarity-${card.rarity.toLowerCase()} ${selected ? "selected" : ""}`}>
      <header>
        <strong>{card.name}</strong>
        <span>{card.rarity}</span>
      </header>
      <p>{card.description}</p>
      <p className="card-effect">{cardEffectLabel(card)}</p>
      <div className="card-actions">
        {selectable ? (
          <label>
            <input type="checkbox" checked={selected} onChange={() => onSelect?.(card.instanceId!)} />
            日终销毁
          </label>
        ) : null}
        {requiresSingleTarget(card) ? (
          <>
            {(["gov", "corp", "anti"] as Faction[]).map((target) => (
              <button key={target} onClick={() => onPlay?.(card.instanceId!, [target])}>
                对 {target} 打出
              </button>
            ))}
          </>
        ) : null}
        {requiresPairTarget(card) ? (
          <>
            {pairTargets.map((pair) => (
              <button key={pair.label} onClick={() => onPlay?.(card.instanceId!, pair.targets)}>
                对 {pair.label} 打出
              </button>
            ))}
          </>
        ) : null}
        {!requiresSingleTarget(card) && !requiresPairTarget(card) ? (
          <button onClick={() => onPlay?.(card.instanceId!)}>打出</button>
        ) : null}
      </div>
    </article>
  );
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [discardIds, setDiscardIds] = useState<string[]>([]);
  const [selectedReplayDay, setSelectedReplayDay] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await request<BootstrapResponse>("/bootstrap");
        setBootstrap(data);
        setProfile(data.profile ?? null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "无法加载启动信息");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!run?.state.ending || run.state.history.length === 0) {
      setSelectedReplayDay(null);
      return;
    }

    const lastHistoryDay = run.state.history[run.state.history.length - 1]?.day ?? null;
    const replayDayStillExists = run.state.history.some((day) => day.day === selectedReplayDay);

    if (!replayDayStillExists && lastHistoryDay !== null) {
      setSelectedReplayDay(lastHistoryDay);
    }
  }, [run, selectedReplayDay]);

  const hasActiveRun = run?.state.runStatus === "active";
  const inventoryEntryMap = useMemo(
    () => new Map((profile?.inventoryEntries ?? []).map((entry) => [entry.cardId, entry])),
    [profile]
  );
  const equippedCounts = useMemo(() => countCardIds(profile?.equippedCardIds ?? []), [profile]);
  const equippedOrangeCount = useMemo(
    () =>
      (profile?.equippedCardIds ?? []).filter((cardId) => {
        const entry = inventoryEntryMap.get(cardId);
        return entry?.rarity === "O";
      }).length,
    [inventoryEntryMap, profile]
  );

  const toggleDiscard = (cardId: string) => {
    setDiscardIds((current) =>
      current.includes(cardId) ? current.filter((value) => value !== cardId) : [...current, cardId]
    );
  };

  const runAction = async (path: string, init?: RequestInit) => {
    setPending(true);
    setError(null);

    try {
      const data = await request<RunResponse>(path, init);
      setRun(data);
      if (data.profile) {
        setProfile(data.profile);
      }
      setMessage(data.actionSummary ?? null);
      setDiscardIds([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "请求失败");
    } finally {
      setPending(false);
    }
  };

  const updateLoadout = async (equippedCardIds: string[]) => {
    setPending(true);
    setError(null);

    try {
      const data = await request<{ profile: ProfileResponse }>("/profile/loadout", {
        method: "PUT",
        body: JSON.stringify({ equippedCardIds })
      });
      setProfile(data.profile);
      setMessage(`已更新携带配置（${equippedCardIds.length}/${data.profile.carrySlots}）`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法更新携带配置");
    } finally {
      setPending(false);
    }
  };

  const addLoadoutCard = (cardId: string) => {
    if (!profile) {
      return;
    }

    void updateLoadout([...profile.equippedCardIds, cardId]);
  };

  const removeLoadoutCard = (cardId: string) => {
    if (!profile) {
      return;
    }

    const index = profile.equippedCardIds.lastIndexOf(cardId);

    if (index === -1) {
      return;
    }

    const next = [...profile.equippedCardIds];
    next.splice(index, 1);
    void updateLoadout(next);
  };

  const startNewRun = async () => {
    if (!bootstrap?.activeBalanceVersion || !profile) {
      return;
    }

    await runAction("/runs", {
      method: "POST",
      body: JSON.stringify({
        balanceVersionId: bootstrap.activeBalanceVersion.id,
        carryCardIds: profile.equippedCardIds
      })
    });
  };

  const submitAction = async (payload: object) => {
    if (!run) {
      return;
    }

    await runAction(`/runs/${run.id}/actions`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  };

  if (loading) {
    return <main className="shell">加载中...</main>;
  }

  const currentDayRecord =
    run && run.state.history[run.state.history.length - 1]?.day === run.state.day
      ? run.state.history[run.state.history.length - 1]
      : null;
  const currentDayPlayedCount = currentDayRecord?.playedCards.length ?? 0;
  const canSubmitReport = currentDayPlayedCount > 0;
  const infoCardSlotsFull = (run?.state.infoCards.length ?? 0) >= runCardLimits.infoCardSlots;
  const inquiryContexts: InquiryTargetContext[] = run
    ? (["gov", "corp", "anti"] as Faction[]).map((target) => describeInquiryTarget(run.state, target))
    : [];
  const endingReplayDay =
    run?.state.ending && selectedReplayDay !== null
      ? run.state.history.find((day) => day.day === selectedReplayDay) ?? null
      : null;
  const replayDays = run?.state.ending ? [...run.state.history].reverse() : [];
  const modifierNotes = run
    ? [
        ...(run.state.modifiers.doubleDayDeltaToday?.day === run.state.day
          ? [`${run.state.modifiers.doubleDayDeltaToday.sourceCardName}：Day 7 日终会把今日全部变化翻倍`]
          : []),
        ...(run.state.modifiers.marketSwingToday?.day === run.state.day
          ? [`${run.state.modifiers.marketSwingToday.sourceCardName}：日终会随机重算今日阵营变化`]
          : []),
        ...(run.state.modifiers.forcedHighestInquiryToday?.day === run.state.day
          ? [
              `${run.state.modifiers.forcedHighestInquiryToday.sourceCardName}：${run.state.modifiers.forcedHighestInquiryToday.targetFaction} 今日强制使用最高级人物`
            ]
          : []),
        ...(run.state.modifiers.forcedNegativeTargetToday?.day === run.state.day
          ? [
              `${run.state.modifiers.forcedNegativeTargetToday.sourceCardName}：${run.state.modifiers.forcedNegativeTargetToday.targetFaction} 今日结算必为负值，且压力 +25`
            ]
          : []),
        ...(run.state.modifiers.lockstepPairToday?.day === run.state.day
          ? [
              `${run.state.modifiers.lockstepPairToday.sourceCardName}：${run.state.modifiers.lockstepPairToday.targetFactions.join(" + ")} 今日必须同涨同跌`
            ]
          : []),
        ...(run.state.modifiers.swapHighestLowestToday?.day === run.state.day
          ? [
              `${run.state.modifiers.swapHighestLowestToday.sourceCardName}：日终会互换最高与最低阵营；若最终不是强胜利则死亡`
            ]
          : []),
        ...((run.state.modifiers.marketSwingToday?.day === run.state.day ||
          run.state.modifiers.lockstepPairToday?.day === run.state.day ||
          run.state.modifiers.forcedNegativeTargetToday?.day === run.state.day ||
          run.state.modifiers.doubleDayDeltaToday?.day === run.state.day ||
          run.state.modifiers.swapHighestLowestToday?.day === run.state.day)
          ? [`日终叠加顺序：${endDayResolutionOrderLabels.join(" -> ")}`]
          : []),
        ...run.state.modifiers.twinKillOaths.map(
          (oath) => `${oath.sourceCardName}：${oath.targetFactions.join(" + ")} 若最终任一落败则死亡`
        ),
        ...run.state.modifiers.perfectEndingOaths.map((oath) => `${oath.sourceCardName}：${oath.description}`),
        ...run.state.modifiers.persistentOrangeEffects.map((effect) => `${effect.sourceCardName}：${effect.description}`)
      ]
    : [];

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Alibi Inquest</p>
          <h1>本地可玩原型</h1>
          <p>
            聚焦 7 天调查循环、压力系统、阵营推进和版本化数值配置。默认激活版本：
            {bootstrap?.activeBalanceVersion?.version ?? "未初始化"}
          </p>
        </div>
        <button
          className="primary"
          onClick={() => void startNewRun()}
          disabled={pending || !bootstrap?.activeBalanceVersion || !profile || hasActiveRun}
        >
          新开一局
        </button>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="message">{message}</p> : null}

      {profile ? (
        <section className="grid two-columns">
          <section className="panel">
            <h2>局外仓库</h2>
            <p>
              当前库存 {profile.inventoryEntries.reduce((sum, entry) => sum + entry.count, 0)} 张。每局最多携带 {profile.carrySlots} 张仓库卡，
              其中橙卡最多 {profile.maxOrangeCarry} 张。
            </p>
              <div className="loadout-summary">
                <div>
                  <strong>下局携带位</strong>
                  <p className="muted">
                    {hasActiveRun
                    ? `本局已锁定 ${run.loadoutCardIds.length}/${profile.carrySlots} 张，结算后再调整下一局携带。`
                    : `${profile.equippedCardIds.length}/${profile.carrySlots} 已选，开局时会直接从仓库扣除。`}
                  </p>
                  <p className="muted">当前橙卡携带：{equippedOrangeCount}/{profile.maxOrangeCarry}。</p>
                </div>
                {!hasActiveRun ? (
                  <div className="chip-row">
                  {profile.equippedCardIds.length > 0 ? (
                    profile.equippedCardIds.map((cardId, index) => {
                      const entry = inventoryEntryMap.get(cardId);

                      return (
                        <span key={`${cardId}-${index}`} className="chip">
                          {entry?.name ?? cardId}
                        </span>
                      );
                    })
                  ) : (
                    <span className="muted">还没有选择携带卡。</span>
                  )}
                </div>
              ) : null}
            </div>
            <div className="reward-pool panel-note">
              <strong>胜利奖励池</strong>
              <p className="muted">
                这里只会掉落普通奖励卡，不会直接送起始牌或橙卡。当前奖励池共 {profile.rewardPoolSummary.totalCards} 张：
                W {profile.rewardPoolSummary.byRarity.W} / G {profile.rewardPoolSummary.byRarity.G} / B{" "}
                {profile.rewardPoolSummary.byRarity.B} / R {profile.rewardPoolSummary.byRarity.R}。
              </p>
              <p className="muted">强胜利给 2 张奖励，普通胜利给 1 张奖励；奖励仍然会进局外仓库，下一局要你自己决定带不带。</p>
            </div>
            <div className="inventory-list">
              {profile.inventoryEntries.map((entry) => {
                const equippedCount = equippedCounts.get(entry.cardId) ?? 0;
                const addBlockedReason = loadoutBlockReason({
                  entry,
                  equippedCount,
                  equippedTotal: profile.equippedCardIds.length,
                  carrySlots: profile.carrySlots,
                  equippedOrangeCount,
                  maxOrangeCarry: profile.maxOrangeCarry,
                  hasActiveRun,
                  pending
                });
                const canAdd = addBlockedReason === null;
                const canRemove = !hasActiveRun && !pending && equippedCount > 0;

                return (
                  <article key={entry.cardId} className="inventory-entry">
                    <div className="inventory-meta">
                      <header>
                        <strong>{entry.name}</strong>
                        <span>
                          {entry.rarity} · {entry.sourceFaction}
                        </span>
                      </header>
                      <p className="muted">{entry.effectLabel}</p>
                      <p className="inventory-count">
                        库存 {entry.count} 张
                        {!hasActiveRun ? ` / 已选 ${equippedCount} 张` : ""}
                      </p>
                      {entry.rarity === "O" ? (
                        <p className="muted">橙卡属于高风险携带卡，每局最多只能带 {profile.maxOrangeCarry} 张。</p>
                      ) : null}
                      {addBlockedReason ? <p className="warning-text">{addBlockedReason}</p> : null}
                    </div>
                    <div className="inventory-actions">
                      <button disabled={!canRemove} onClick={() => removeLoadoutCard(entry.cardId)}>
                        移出携带
                      </button>
                      <button className="primary" disabled={!canAdd} onClick={() => addLoadoutCard(entry.cardId)}>
                        加入携带
                      </button>
                    </div>
                  </article>
                );
              })}
              {profile.inventoryEntries.length === 0 ? (
                <p className="muted">仓库已经空了。先通关拿奖励，或者别在死亡局里亏太多。</p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <h2>最近结算</h2>
            <p>胜利会带回剩余卡牌并给奖励；失败、空白和死亡会随机掉仓库卡。这里保留最近 5 次结算。</p>
            <div className="history">
              {profile.recentSettlements.map((settlement) => (
                <article key={settlement.createdAt} className="history-day settlement-entry">
                  <header>
                    <strong>{outcomeLabel(settlement.outcome)}</strong>
                    <span>{new Date(settlement.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
                  </header>
                  <p>{settlement.summary}</p>
                  <p className="muted">
                    带入 {settlement.loadoutCardIds.length} 张 / 带回 {settlement.returnedCardIds.length} 张 / 奖励{" "}
                    {settlement.gainedCardIds.length} 张 / 掉落 {settlement.lostCardIds.length} 张
                  </p>
                </article>
              ))}
              {profile.recentSettlements.length === 0 ? <p className="muted">还没有结算记录。</p> : null}
            </div>
          </section>
        </section>
      ) : (
        <section className="panel">
          <h2>局外仓库未初始化</h2>
          <p>当前没有可用的激活版本，所以还不能建立局外仓库和携带配置。</p>
        </section>
      )}

      {!run ? (
        <section className="panel">
          <h2>还没有战局</h2>
          <p>先在上面的局外仓库里挑好携带卡，再点击“新开一局”。开局时这批卡会从仓库扣掉，结局后再按结果返还或掉落。</p>
        </section>
      ) : (
        <>
          <section className="grid summary-grid">
            <div className="panel stat">
              <span>Day</span>
              <strong>{run.state.day}</strong>
            </div>
            <div className="panel stat">
              <span>Pressure</span>
              <strong>{run.state.pressure}</strong>
            </div>
            <div className="panel stat">
              <span>Inquiries</span>
              <strong>{run.state.inquiryRemaining}</strong>
            </div>
            <div className="panel stat">
              <span>World</span>
              <strong>{scoreLabel(run.state)}</strong>
            </div>
          </section>

          {modifierNotes.length > 0 ? (
            <section className="panel">
              <h2>当前特殊效果</h2>
              <div className="history">
                {modifierNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid two-columns">
            <section className="panel">
              <h2>质询</h2>
              <p>
                剩余 {run.state.inquiryRemaining} 次。信息卡槽 {run.state.infoCards.length}/{runCardLimits.infoCardSlots}。
                每次质询会按当前人物等级和天数阶段刷新信息卡。
              </p>
              {infoCardSlotsFull ? <p className="muted">信息卡槽已满，先打出或日终销毁一些牌，才能继续质询。</p> : null}
              <div className="history">
                {inquiryContexts.map((context) => (
                  <article key={context.target} className="history-day">
                    <header>
                      <strong>{context.target}</strong>
                      <span>
                        Lv{context.level} {context.persona}
                      </span>
                    </header>
                    <p>
                      阶段：
                      {context.phase === "day1to3" ? "Day 1-3" : context.phase === "day4to6" ? "Day 4-6" : "Day 7"}
                    </p>
                    <p>
                      刷率：W {context.rarityWeights.W} / G {context.rarityWeights.G} / B {context.rarityWeights.B} / R {context.rarityWeights.R} / O {context.rarityWeights.O}
                    </p>
                  </article>
                ))}
              </div>
              <div className="actions">
                {inquiryContexts.map((context) => (
                  <button
                    key={context.target}
                    disabled={pending || run.state.inquiryRemaining === 0 || run.state.runStatus !== "active" || infoCardSlotsFull}
                    onClick={() => void submitAction({ type: "inquire", target: context.target })}
                  >
                    质询 {context.target} · {context.persona}
                  </button>
                ))}
              </div>
              <h3>当天信息卡</h3>
              <div className="card-grid">
                {run.state.infoCards.map((card) => (
                  <CardTile
                    key={card.instanceId}
                    card={card}
                    selectable
                    selected={discardIds.includes(card.instanceId!)}
                    onSelect={toggleDiscard}
                    onPlay={(cardInstanceId, targetFactions) =>
                      void submitAction({ type: "playCard", cardInstanceId, ...(targetFactions ? { targetFactions } : {}) })
                    }
                  />
                ))}
                {run.state.infoCards.length === 0 ? <p className="muted">今天还没有抽到信息卡。</p> : null}
              </div>
            </section>

            <section className="panel">
              <h2>仓库卡</h2>
              <p>
                这就是本局带进来的仓库资源。开局携带位固定 {runCardLimits.warehouseCarrySlots}，仓库容量上限 {runCardLimits.warehouseCapacity}。
              </p>
              <p className="muted">本局带入 {run.loadoutCardIds.length} 张；没打出去的仓库卡，会在结局时按胜负决定是否带回局外仓库。</p>
              <div className="card-grid">
                {run.state.warehouseCards.map((card) => (
                  <CardTile
                    key={card.instanceId}
                    card={card}
                    onPlay={(cardInstanceId, targetFactions) =>
                      void submitAction({ type: "playCard", cardInstanceId, ...(targetFactions ? { targetFactions } : {}) })
                    }
                  />
                ))}
                {run.state.warehouseCards.length === 0 ? <p className="muted">仓库卡已用完。</p> : null}
              </div>
            </section>
          </section>

          <section className="grid two-columns">
            <section className="panel">
              <h2>日终处理</h2>
              <p>未打出的信息卡可以留到下一天，也可以在这里销毁。蓝卡和红卡会增加额外压力。想提交报告，今天至少要先打出 1 张卡。</p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={pending || run.state.runStatus !== "active" || !canSubmitReport}
                  onClick={() =>
                    void submitAction({
                      type: "endDay",
                      discardCardInstanceIds: discardIds,
                      submitReport: true
                    })
                  }
                >
                  提交报告并结束当天
                </button>
                <button
                  disabled={pending || run.state.runStatus !== "active"}
                  onClick={() =>
                    void submitAction({
                      type: "endDay",
                      discardCardInstanceIds: discardIds,
                      submitReport: false
                    })
                  }
                >
                  空报告结束当天
                </button>
              </div>
            </section>

            <section className="panel">
              <h2>调查记录</h2>
              <div className="history">
                {run.state.history.map((day) => (
                  <article key={day.day} className="history-day">
                    <header>
                      <strong>Day {day.day}</strong>
                      <span>
                        Pressure {day.pressureBefore} → {day.pressureAfter}
                      </span>
                    </header>
                    <p>报告：{day.reportSubmitted ? "已提交" : "空报告"}</p>
                    <p>质询：{day.inquiries.map((entry) => `${entry.target}:${entry.drawnCardId}`).join(" / ") || "无"}</p>
                    <p>打出：{day.playedCards.map((entry) => entry.cardId).join(", ") || "无"}</p>
                    {day.worldEventTitle ? (
                      <p>
                        世界事件：{day.worldEventTitle}
                        {day.worldEventSummary ? `，${day.worldEventSummary}` : ""}
                      </p>
                    ) : null}
                    {day.endDayResolutionLogs.length > 0 ? (
                      <div className="history">
                        {day.endDayResolutionLogs.map((entry, index) => (
                          <p key={`${day.day}-${entry.step}-${index}`}>
                            {index + 1}. {entry.step}：{entry.summary} | World {entry.worldBefore.gov}/{entry.worldBefore.corp}/{entry.worldBefore.anti} →{" "}
                            {entry.worldAfter.gov}/{entry.worldAfter.corp}/{entry.worldAfter.anti} | Pressure {entry.pressureBefore} → {entry.pressureAfter}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
                {run.state.history.length === 0 ? <p className="muted">调查尚未开始。</p> : null}
              </div>
            </section>
          </section>

          {run.state.ending ? (
            <section className="panel ending">
              <h2>《{run.state.ending.worldEndingTitle}》</h2>
              <p>{run.state.ending.worldEndingSummary}</p>
              <p>调查结果：{run.state.ending.title}</p>
              <p>{run.state.ending.summary}</p>
              <p>阵营排序：{run.state.ending.rankingLabel}</p>
              <p>玩家倾向：{run.state.ending.playerTendencyLabel}</p>
              {run.settlement ? (
                <div className="settlement-banner">
                  <strong>本局仓库结算</strong>
                  <p>{run.settlement.summary}</p>
                  <p className="muted">
                    带入 {run.settlement.loadoutCardIds.length} 张 / 带回 {run.settlement.returnedCardIds.length} 张 / 奖励{" "}
                    {run.settlement.gainedCardIds.length} 张 / 掉落 {run.settlement.lostCardIds.length} 张
                  </p>
                </div>
              ) : null}
              {endingReplayDay ? (
                <div className="ending-replay">
                  <div className="ending-replay-header">
                    <div>
                      <h3>{run.state.runStatus === "dead" ? `死亡前 Day ${endingReplayDay.day} 回放` : `Day ${endingReplayDay.day} 回放`}</h3>
                      <p className="muted">按实际日终结算顺序，把这一天如何把局势推向当前结局直接展开。</p>
                    </div>
                    <span className="replay-chip">{endingReplayDay.endDayResolutionLogs.length} 步结算</span>
                  </div>

                  <div className="replay-day-switcher">
                    {replayDays.map((day) => (
                      <button
                        key={day.day}
                        className={day.day === endingReplayDay.day ? "primary" : undefined}
                        onClick={() => setSelectedReplayDay(day.day)}
                      >
                        Day {day.day}
                      </button>
                    ))}
                  </div>

                  <div className="replay-summary-grid">
                    <article className="replay-stat">
                      <span>当天打出</span>
                      <strong>{endingReplayDay.playedCards.length}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>世界变化</span>
                      <strong>
                        {worldLabel(endingReplayDay.worldBefore)} → {worldLabel(endingReplayDay.worldAfter)}
                      </strong>
                    </article>
                    <article className="replay-stat">
                      <span>压力变化</span>
                      <strong>
                        {endingReplayDay.pressureBefore} → {endingReplayDay.pressureAfter}
                      </strong>
                    </article>
                  </div>

                  {endingReplayDay.playedCards.length > 0 ? (
                    <p className="muted">当天出牌：{endingReplayDay.playedCards.map((entry) => entry.cardId).join(", ")}</p>
                  ) : null}

                  {endingReplayDay.worldEventTitle ? (
                    <p className="muted">
                      世界事件：{endingReplayDay.worldEventTitle}
                      {endingReplayDay.worldEventSummary ? `，${endingReplayDay.worldEventSummary}` : ""}
                    </p>
                  ) : null}

                  <div className="replay-timeline">
                    {endingReplayDay.endDayResolutionLogs.length > 0 ? (
                      endingReplayDay.endDayResolutionLogs.map((entry, index) => (
                        <article key={`${endingReplayDay.day}-${entry.step}-${index}`} className="replay-step">
                          <header>
                            <strong>
                              {index + 1}. {entry.step}
                            </strong>
                            <span>
                              Pressure {entry.pressureBefore} → {entry.pressureAfter}
                            </span>
                          </header>
                          <p>{entry.summary}</p>
                          <p className="muted">
                            World {worldLabel(entry.worldBefore)} → {worldLabel(entry.worldAfter)}
                          </p>
                        </article>
                      ))
                    ) : (
                      <article className="replay-step">
                        <header>
                          <strong>1. 平静收束</strong>
                          <span>
                            Pressure {endingReplayDay.pressureBefore} → {endingReplayDay.pressureAfter}
                          </span>
                        </header>
                        <p>这一天没有额外连锁结算，局势主要由当天出牌、保留和基础日终规则决定。</p>
                        <p className="muted">
                          World {worldLabel(endingReplayDay.worldBefore)} → {worldLabel(endingReplayDay.worldAfter)}
                        </p>
                      </article>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
