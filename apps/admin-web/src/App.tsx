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

type RunDetail = RunSummary & {
  state: {
    world: {
      gov: number;
      corp: number;
      anti: number;
    };
    pressure: number;
    history: Array<{
      day: number;
      reportSubmitted: boolean;
      pressureAfter: number;
      retainedCardIds: string[];
      discardedCardIds: string[];
      playedCards: Array<{ cardId: string }>;
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
          <div className="run-list">
            {runs.map((run) => (
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

