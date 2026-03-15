import { useEffect, useState } from "react";
import { describeInquiryTarget } from "@alibi/game-core";
import type { CardDefinition, Faction, GameState, InquiryTargetContext } from "@alibi/game-core";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

type BootstrapResponse = {
  activeBalanceVersion?: {
    id: number;
    version: string;
    name: string;
    status: string;
  };
};

type RunResponse = {
  id: string;
  seed: number;
  state: GameState;
  summary: {
    day: number;
    pressure: number;
    status: string;
    ranking: string[];
    reportDays: number;
  };
  actionSummary?: string;
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
  return [
    `Gov ${state.world.gov}`,
    `Corp ${state.world.corp}`,
    `Anti ${state.world.anti}`
  ].join(" / ");
}

function CardTile(props: {
  card: CardDefinition;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (cardInstanceId: string) => void;
  onPlay?: (cardInstanceId: string) => void;
}) {
  const { card, selectable, selected, onSelect, onPlay } = props;

  return (
    <article className={`card-tile rarity-${card.rarity.toLowerCase()} ${selected ? "selected" : ""}`}>
      <header>
        <strong>{card.name}</strong>
        <span>{card.rarity}</span>
      </header>
      <p>{card.description}</p>
      <p className="card-effect">
        Gov {card.effect.gov} / Corp {card.effect.corp} / Anti {card.effect.anti}
      </p>
      <div className="card-actions">
        {selectable && (
          <label>
            <input type="checkbox" checked={selected} onChange={() => onSelect?.(card.instanceId!)} />
            日终销毁
          </label>
        )}
        <button onClick={() => onPlay?.(card.instanceId!)}>打出</button>
      </div>
    </article>
  );
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [discardIds, setDiscardIds] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await request<BootstrapResponse>("/bootstrap");
        setBootstrap(data);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "无法加载启动信息");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      setMessage(data.actionSummary ?? null);
      setDiscardIds([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "请求失败");
    } finally {
      setPending(false);
    }
  };

  const startNewRun = async () => {
    const body = bootstrap?.activeBalanceVersion ? { balanceVersionId: bootstrap.activeBalanceVersion.id } : {};
    await runAction("/runs", {
      method: "POST",
      body: JSON.stringify(body)
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
  const inquiryContexts: InquiryTargetContext[] = run
    ? (["gov", "corp", "anti"] as Faction[]).map((target) => describeInquiryTarget(run.state, target))
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
        <button className="primary" onClick={() => void startNewRun()} disabled={pending}>
          新开一局
        </button>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="message">{message}</p> : null}

      {!run ? (
        <section className="panel">
          <h2>还没有战局</h2>
          <p>点击“新开一局”后会绑定当前激活的 balance version，并生成固定随机种子。</p>
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

          <section className="grid two-columns">
            <section className="panel">
              <h2>质询</h2>
              <p>剩余 {run.state.inquiryRemaining} 次。每次质询会按当前人物等级和天数阶段刷新信息卡。</p>
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
                    disabled={pending || run.state.inquiryRemaining === 0 || run.state.runStatus !== "active"}
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
                    onPlay={(cardInstanceId) => void submitAction({ type: "playCard", cardInstanceId })}
                  />
                ))}
                {run.state.infoCards.length === 0 ? <p className="muted">今天还没有抽到信息卡。</p> : null}
              </div>
            </section>

            <section className="panel">
              <h2>仓库卡</h2>
              <p>仓库卡代表战局开始时带入的资源，本 demo 做成一次性材料。</p>
              <div className="card-grid">
                {run.state.warehouseCards.map((card) => (
                  <CardTile
                    key={card.instanceId}
                    card={card}
                    onPlay={(cardInstanceId) => void submitAction({ type: "playCard", cardInstanceId })}
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
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
