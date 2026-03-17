import { useEffect, useMemo, useState } from "react";
import type { BalanceConfig } from "@alibi/game-core";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

type BalanceVersion = {
  id: number;
  version: string;
  name: string;
  status: string;
  description?: string;
  publishedAt?: string | null;
  config: BalanceConfig;
};

type RunSummary = {
  id: string;
  status: string;
  seed: number;
  endingCode?: string | null;
  summary: {
    day: number;
    pressure: number;
    ranking: string[];
    reportDays: number;
  };
};

type RunFilter = "all" | "death" | "perfect";

type RunDetail = RunSummary & {
  state: {
    world: {
      gov: number;
      corp: number;
      anti: number;
    };
    pressure: number;
    ending?: {
      code: string;
      title: string;
      summary: string;
      rankingLabel: string;
      playerTendencyLabel: string;
      worldEndingTitle: string;
      worldEndingSummary: string;
    };
    history: Array<{
      day: number;
      reportSubmitted: boolean;
      pressureBefore: number;
      pressureAfter: number;
      worldBefore: { gov: number; corp: number; anti: number };
      worldAfter: { gov: number; corp: number; anti: number };
      retainedCardIds: string[];
      discardedCardIds: string[];
      playedCards: Array<{ cardId: string }>;
      endDayResolutionLogs: Array<{
        step: string;
        summary: string;
        worldBefore: { gov: number; corp: number; anti: number };
        worldAfter: { gov: number; corp: number; anti: number };
        pressureBefore: number;
        pressureAfter: number;
      }>;
      worldEventTitle?: string;
      worldEventSummary?: string;
    }>;
  };
  actionLogs: Array<{
    id: string;
    actionType: string;
    createdAt: string;
    payload: {
      actionSummary: string;
    };
  }>;
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

function worldLabel(world: { gov: number; corp: number; anti: number }) {
  return `Gov ${world.gov} / Corp ${world.corp} / Anti ${world.anti}`;
}

function formatConfig(config: BalanceConfig) {
  return JSON.stringify(config, null, 2);
}

export default function App() {
  const [versions, setVersions] = useState<BalanceVersion[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [selectedReplayDay, setSelectedReplayDay] = useState<number | null>(null);
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions]
  );

  async function loadVersions() {
    const data = await request<BalanceVersion[]>("/admin/balance-versions");
    setVersions(data);
    if (!selectedVersionId && data[0]) {
      setSelectedVersionId(data[0].id);
      setName(data[0].name);
      setDescription(data[0].description ?? "");
      setDraftText(formatConfig(data[0].config));
    }
  }

  async function loadRuns() {
    const data = await request<RunSummary[]>("/admin/runs");
    setRuns(data);
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadVersions(), loadRuns()]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "初始化失败");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedVersion) {
      return;
    }

    setName(selectedVersion.name);
    setDescription(selectedVersion.description ?? "");
    setDraftText(formatConfig(selectedVersion.config));
  }, [selectedVersion]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }

    void (async () => {
      try {
        const detail = await request<RunDetail>(`/admin/runs/${selectedRunId}`);
        setRunDetail(detail);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "加载 run 详情失败");
      }
    })();
  }, [selectedRunId]);

  useEffect(() => {
    if (!runDetail || runDetail.state.history.length === 0) {
      setSelectedReplayDay(null);
      return;
    }

    const lastHistoryDay = runDetail.state.history[runDetail.state.history.length - 1];

    setSelectedReplayDay((current) => {
      if (current !== null && runDetail.state.history.some((day) => day.day === current)) {
        return current;
      }

      return lastHistoryDay ? lastHistoryDay.day : null;
    });
  }, [runDetail]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    const selectedRunVisible = runs.some((run) => {
      if (run.id !== selectedRunId) {
        return false;
      }

      if (runFilter === "death") {
        return run.endingCode === "death";
      }

      if (runFilter === "perfect") {
        return run.endingCode === "perfect";
      }

      return true;
    });

    if (!selectedRunVisible) {
      setSelectedRunId(null);
    }
  }, [runFilter, runs, selectedRunId]);

  const createDraft = async () => {
    try {
      setError(null);
      const created = await request<BalanceVersion>("/admin/balance-versions", {
        method: "POST",
        body: JSON.stringify({
          name: `Draft ${new Date().toLocaleTimeString()}`,
          description: "Cloned from the latest active version",
          sourceVersionId: selectedVersion?.id
        })
      });
      setMessage(`已创建草稿 ${created.version}`);
      await loadVersions();
      setSelectedVersionId(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建草稿失败");
    }
  };

  const saveDraft = async () => {
    if (!selectedVersion) {
      return;
    }

    try {
      setError(null);
      const config = JSON.parse(draftText) as BalanceConfig;
      await request(`/admin/balance-versions/${selectedVersion.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          description,
          config
        })
      });
      setMessage("草稿已保存");
      await loadVersions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败，请检查 JSON 结构");
    }
  };

  const publishDraft = async () => {
    if (!selectedVersion) {
      return;
    }

    try {
      setError(null);
      await request(`/admin/balance-versions/${selectedVersion.id}/publish`, {
        method: "POST"
      });
      setMessage(`已发布 ${selectedVersion.version}`);
      await Promise.all([loadVersions(), loadRuns()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发布失败");
    }
  };

  const replayDays = runDetail ? [...runDetail.state.history].reverse() : [];
  const replayDay =
    runDetail && selectedReplayDay !== null
      ? runDetail.state.history.find((day) => day.day === selectedReplayDay) ?? null
      : null;
  const lastHistoryDay = runDetail?.state.history[runDetail.state.history.length - 1] ?? null;
  const lastActionSummary = runDetail?.actionLogs[runDetail.actionLogs.length - 1]?.payload.actionSummary ?? null;
  const filteredRuns = runs.filter((run) => {
    if (runFilter === "death") {
      return run.endingCode === "death";
    }

    if (runFilter === "perfect") {
      return run.endingCode === "perfect";
    }

    return true;
  });

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Balance Admin</p>
          <h1>数值后台</h1>
          <p>编辑草稿版本、发布激活版本，并回看最近的战局与操作日志。</p>
        </div>
        <button className="primary" onClick={() => void createDraft()}>
          基于当前版本创建草稿
        </button>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="message">{message}</p> : null}

      <section className="admin-grid">
        <section className="panel">
          <h2>Balance Versions</h2>
          <div className="version-list">
            {versions.map((version) => (
              <button
                key={version.id}
                className={`version-item ${version.id === selectedVersionId ? "selected" : ""}`}
                onClick={() => setSelectedVersionId(version.id)}
              >
                <strong>{version.version}</strong>
                <span>{version.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel editor-panel">
          <h2>版本编辑</h2>
          {selectedVersion ? (
            <>
              <label>
                名称
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                描述
                <input value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label>
                JSON 配置
                <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={24} />
              </label>
              <div className="actions">
                <button onClick={() => void saveDraft()} disabled={selectedVersion.status !== "draft"}>
                  保存草稿
                </button>
                <button className="primary" onClick={() => void publishDraft()} disabled={selectedVersion.status !== "draft"}>
                  发布为激活版本
                </button>
              </div>
            </>
          ) : (
            <p className="muted">暂无版本数据。</p>
          )}
        </section>
      </section>

      <section className="admin-grid">
        <section className="panel">
          <h2>Recent Runs</h2>
          <div className="run-filters">
            <button className={runFilter === "all" ? "primary" : undefined} onClick={() => setRunFilter("all")}>
              全部 {runs.length}
            </button>
            <button className={runFilter === "death" ? "primary" : undefined} onClick={() => setRunFilter("death")}>
              死亡局 {runs.filter((run) => run.endingCode === "death").length}
            </button>
            <button className={runFilter === "perfect" ? "primary" : undefined} onClick={() => setRunFilter("perfect")}>
              强胜利局 {runs.filter((run) => run.endingCode === "perfect").length}
            </button>
          </div>
          <div className="run-list">
            {filteredRuns.map((run) => (
              <button
                key={run.id}
                className={`run-item ${run.id === selectedRunId ? "selected" : ""}`}
                onClick={() => setSelectedRunId(run.id)}
              >
                <strong>{run.id.slice(0, 8)}</strong>
                <span>
                  Day {run.summary.day} / Pressure {run.summary.pressure} / {run.status}
                </span>
              </button>
            ))}
            {runs.length === 0 ? <p className="muted">还没有战局数据。</p> : null}
            {runs.length > 0 && filteredRuns.length === 0 ? <p className="muted">当前筛选下没有 run。</p> : null}
          </div>
        </section>

        <section className="panel">
          <h2>Run Detail</h2>
          {runDetail ? (
            <>
              <p>
                Seed {runDetail.seed} / Ending {runDetail.endingCode ?? "未结束"}
              </p>
              <p>
                World: Gov {runDetail.state.world.gov} / Corp {runDetail.state.world.corp} / Anti {runDetail.state.world.anti}
              </p>
              {runDetail.state.ending ? (
                <section className="admin-ending-summary">
                  <div className="admin-replay-header">
                    <div>
                      <h3>结局对照摘要</h3>
                      <p className="muted">把最终世界走向、你的调查结果和关键终止信息压成一眼能看懂的摘要。</p>
                    </div>
                    <span className="replay-chip">{runDetail.state.ending.code}</span>
                  </div>

                  <div className="replay-summary-grid">
                    <article className="replay-stat">
                      <span>世界结局</span>
                      <strong>《{runDetail.state.ending.worldEndingTitle}》</strong>
                    </article>
                    <article className="replay-stat">
                      <span>调查结果</span>
                      <strong>{runDetail.state.ending.title}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>阵营排序</span>
                      <strong>{runDetail.state.ending.rankingLabel}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>玩家倾向</span>
                      <strong>{runDetail.state.ending.playerTendencyLabel}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>报告天数</span>
                      <strong>{runDetail.summary.reportDays} / 7</strong>
                    </article>
                    <article className="replay-stat">
                      <span>{runDetail.status === "dead" ? "触发日" : "收束日"}</span>
                      <strong>{lastHistoryDay ? `Day ${lastHistoryDay.day}` : "未记录"}</strong>
                    </article>
                  </div>

                  <p>{runDetail.state.ending.worldEndingSummary}</p>
                  <p>{runDetail.state.ending.summary}</p>
                  {runDetail.status === "dead" ? (
                    <p className="muted">终止动作：{lastActionSummary ?? "未记录，通常为压力或特殊死亡条件触发。"}</p>
                  ) : null}
                </section>
              ) : (
                <section className="admin-ending-summary">
                  <div className="admin-replay-header">
                    <div>
                      <h3>战局摘要</h3>
                      <p className="muted">当前 run 还没结算，先看运行状态、报告进度和最近动作。</p>
                    </div>
                    <span className="replay-chip">{runDetail.status}</span>
                  </div>

                  <div className="replay-summary-grid">
                    <article className="replay-stat">
                      <span>当前 Day</span>
                      <strong>{runDetail.summary.day}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>当前压力</span>
                      <strong>{runDetail.summary.pressure}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>报告天数</span>
                      <strong>{runDetail.summary.reportDays} / 7</strong>
                    </article>
                    <article className="replay-stat">
                      <span>当前排序</span>
                      <strong>{runDetail.summary.ranking.join(" > ")}</strong>
                    </article>
                  </div>

                  <p className="muted">最近动作：{lastActionSummary ?? "还没有动作记录。"}</p>
                </section>
              )}
              {replayDay ? (
                <section className="admin-replay">
                  <div className="admin-replay-header">
                    <div>
                      <h3>Day {replayDay.day} 回放</h3>
                      <p className="muted">按天切换查看每一天如何把局势推到当前 run 的结果。</p>
                    </div>
                    <span className="replay-chip">{replayDay.endDayResolutionLogs.length} 步结算</span>
                  </div>

                  <div className="replay-day-switcher">
                    {replayDays.map((day) => (
                      <button
                        key={day.day}
                        className={day.day === replayDay.day ? "primary" : undefined}
                        onClick={() => setSelectedReplayDay(day.day)}
                      >
                        Day {day.day}
                      </button>
                    ))}
                  </div>

                  <div className="replay-summary-grid">
                    <article className="replay-stat">
                      <span>当天打出</span>
                      <strong>{replayDay.playedCards.length}</strong>
                    </article>
                    <article className="replay-stat">
                      <span>世界变化</span>
                      <strong>
                        {worldLabel(replayDay.worldBefore)} to {worldLabel(replayDay.worldAfter)}
                      </strong>
                    </article>
                    <article className="replay-stat">
                      <span>压力变化</span>
                      <strong>
                        {replayDay.pressureBefore} to {replayDay.pressureAfter}
                      </strong>
                    </article>
                  </div>

                  <p>Played: {replayDay.playedCards.map((card) => card.cardId).join(", ") || "无"}</p>
                  <p>Discarded: {replayDay.discardedCardIds.join(", ") || "无"}</p>
                  <p>Retained: {replayDay.retainedCardIds.join(", ") || "无"}</p>
                  {replayDay.worldEventTitle ? <p>World Event: {replayDay.worldEventTitle}</p> : null}
                  {replayDay.worldEventSummary ? <p>Event Summary: {replayDay.worldEventSummary}</p> : null}

                  <div className="history">
                    {replayDay.endDayResolutionLogs.length > 0 ? (
                      replayDay.endDayResolutionLogs.map((entry, index) => (
                        <article key={`${replayDay.day}-${entry.step}-${index}`} className="history-item replay-step">
                          <header>
                            <strong>
                              {index + 1}. {entry.step}
                            </strong>
                            <span>
                              Pressure {entry.pressureBefore} to {entry.pressureAfter}
                            </span>
                          </header>
                          <p>{entry.summary}</p>
                          <p className="muted">
                            World {worldLabel(entry.worldBefore)} to {worldLabel(entry.worldAfter)}
                          </p>
                        </article>
                      ))
                    ) : (
                      <article className="history-item replay-step">
                        <header>
                          <strong>1. 平静收束</strong>
                          <span>
                            Pressure {replayDay.pressureBefore} to {replayDay.pressureAfter}
                          </span>
                        </header>
                        <p>这一天没有额外连锁结算，局势主要由当天出牌、保留和基础日终规则决定。</p>
                        <p className="muted">
                          World {worldLabel(replayDay.worldBefore)} to {worldLabel(replayDay.worldAfter)}
                        </p>
                      </article>
                    )}
                  </div>
                </section>
              ) : null}
              <h3>Daily History</h3>
              <div className="history">
                {runDetail.state.history.map((day) => (
                  <article key={day.day} className="history-item">
                    <header>
                      <strong>Day {day.day}</strong>
                      <span>{day.reportSubmitted ? "提交报告" : "空报告"}</span>
                    </header>
                    <p>Pressure after: {day.pressureAfter}</p>
                    <p>Played: {day.playedCards.map((card) => card.cardId).join(", ") || "无"}</p>
                    <p>Discarded: {day.discardedCardIds.join(", ") || "无"}</p>
                    <p>Retained: {day.retainedCardIds.join(", ") || "无"}</p>
                    {day.worldEventTitle ? <p>World Event: {day.worldEventTitle}</p> : null}
                    {day.worldEventSummary ? <p>Event Summary: {day.worldEventSummary}</p> : null}
                    {day.endDayResolutionLogs.length > 0 ? (
                      <div className="history">
                        {day.endDayResolutionLogs.map((entry, index) => (
                          <p key={`${day.day}-${entry.step}-${index}`}>
                            {index + 1}. {entry.step}: {entry.summary} | World {entry.worldBefore.gov}/{entry.worldBefore.corp}/{entry.worldBefore.anti} to{" "}
                            {entry.worldAfter.gov}/{entry.worldAfter.corp}/{entry.worldAfter.anti} | Pressure {entry.pressureBefore} to {entry.pressureAfter}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              <h3>Action Logs</h3>
              <div className="history">
                {runDetail.actionLogs.map((log) => (
                  <article key={log.id} className="history-item">
                    <header>
                      <strong>{log.actionType}</strong>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </header>
                    <p>{log.payload.actionSummary}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">选择一个 run 查看详情。</p>
          )}
        </section>
      </section>
    </main>
  );
}
