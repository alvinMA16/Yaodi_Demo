import {
  applyAction,
  defaultBalanceConfig,
  startRun,
  summarizeRun,
  type GameAction
} from "@alibi/game-core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createActionLog,
  createBalanceVersion,
  createRun,
  getActiveBalanceVersion,
  getBalanceVersion,
  getRun,
  listActionLogs,
  listBalanceVersions,
  listRuns,
  publishBalanceVersion,
  updateBalanceVersion,
  updateRun
} from "./db.js";
import { createDraftVersionName, draftFromConfig } from "./defaults.js";
import { parseBalanceConfig, parseState, parseSummary } from "./serialization.js";

const createRunSchema = z.object({
  balanceVersionId: z.number().int().optional(),
  seed: z.number().int().optional()
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inquire"),
    target: z.enum(["gov", "corp", "anti"])
  }),
  z.object({
    type: z.literal("playCard"),
    cardInstanceId: z.string().min(1)
  }),
  z.object({
    type: z.literal("endDay"),
    discardCardInstanceIds: z.array(z.string()),
    submitReport: z.boolean()
  })
]);

const balanceDraftSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceVersionId: z.number().int().optional()
});

const updateBalanceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.object({
    versionName: z.string().min(1),
    starterCardIds: z.array(z.string()),
    inquiryTargets: z.array(z.enum(["gov", "corp", "anti"])),
    cards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        rarity: z.enum(["W", "G", "B", "R", "O"]),
        sourceFaction: z.enum(["gov", "corp", "anti"]),
        description: z.string(),
        effect: z.object({
          gov: z.number(),
          corp: z.number(),
          anti: z.number()
        }),
        weight: z.number(),
        reusable: z.boolean().optional(),
        starter: z.boolean().optional()
      })
    ),
    pressure: z.object({
      retainedFactor: z.number(),
      destroyFactor: z.number(),
      bluePenalty: z.number(),
      redPenalty: z.number(),
      deathThreshold: z.number()
    })
  })
});

function toRunResponse(run: {
  id: string;
  status: string;
  seed: number;
  balanceVersionId: number;
  stateJson: string;
  summaryJson: string;
  endingCode?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: run.id,
    status: run.status,
    seed: run.seed,
    balanceVersionId: run.balanceVersionId,
    state: parseState(run.stateJson),
    summary: parseSummary(run.summaryJson),
    endingCode: run.endingCode,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/bootstrap", async () => {
    const activeBalanceVersion = await getActiveBalanceVersion();

    return {
      activeBalanceVersion,
      fallbackBalance: activeBalanceVersion ? undefined : defaultBalanceConfig
    };
  });

  app.post("/runs", async (request, reply) => {
    const payload = createRunSchema.parse(request.body ?? {});
    const activeVersion = (payload.balanceVersionId ? await getBalanceVersion(payload.balanceVersionId) : await getActiveBalanceVersion()) ?? null;

    if (!activeVersion) {
      return reply.code(400).send({ message: "No balance version available" });
    }

    const config = parseBalanceConfig(activeVersion.configJson);
    const seed = payload.seed ?? Math.floor(Math.random() * 1_000_000);
    const state = startRun(config, { seed, balanceVersionId: activeVersion.id });
    const summary = summarizeRun(state);
    const run = await createRun({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: state.runStatus,
      seed,
      balanceVersionId: activeVersion.id,
      stateJson: JSON.stringify(state),
      summaryJson: JSON.stringify(summary),
      endingCode: null
    });

    return reply.code(201).send(toRunResponse(run));
  });

  app.get("/runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await getRun(id);

    if (!run) {
      return reply.code(404).send({ message: "Run not found" });
    }

    return toRunResponse(run);
  });

  app.post("/runs/:id/actions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const action = actionSchema.parse(request.body) as GameAction;
    const run = await getRun(id);

    if (!run) {
      return reply.code(404).send({ message: "Run not found" });
    }

    const version = await getBalanceVersion(run.balanceVersionId);

    if (!version) {
      return reply.code(500).send({ message: "Balance version is missing" });
    }

    const state = parseState(run.stateJson);
    const config = parseBalanceConfig(version.configJson);
    const actionDay = state.day;
    const result = applyAction(config, run.seed, state, action);
    const summary = summarizeRun(result.state);
    const updated = await updateRun(id, (current) => ({
      ...current,
      status: result.state.runStatus,
      stateJson: JSON.stringify(result.state),
      summaryJson: JSON.stringify(summary),
      endingCode: result.state.ending?.code ?? null
    }));

    if (!updated) {
      return reply.code(500).send({ message: "Run could not be updated" });
    }

    await createActionLog({
      runId: id,
      day: actionDay,
      actionType: action.type,
      payloadJson: JSON.stringify({ action, actionSummary: result.actionSummary })
    });

    return {
      ...toRunResponse(updated),
      actionSummary: result.actionSummary
    };
  });

  app.get("/admin/balance-versions", async () => {
    const versions = await listBalanceVersions();

    return versions.map((version) => ({
      ...version,
      config: parseBalanceConfig(version.configJson)
    }));
  });

  app.post("/admin/balance-versions", async (request, reply) => {
    const payload = balanceDraftSchema.parse(request.body ?? {});
    const sourceVersion = payload.sourceVersionId
      ? await getBalanceVersion(payload.sourceVersionId)
      : await getActiveBalanceVersion();
    const version = createDraftVersionName();
    const draft = draftFromConfig(version, sourceVersion?.configJson);
    const created = await createBalanceVersion({
      ...draft,
      name: payload.name,
      ...(payload.description !== undefined ? { description: payload.description } : {})
    });

    return reply.code(201).send({
      ...created,
      config: parseBalanceConfig(created.configJson)
    });
  });

  app.put("/admin/balance-versions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = updateBalanceSchema.parse(request.body ?? {});
    const current = await getBalanceVersion(Number(id));

    if (!current) {
      return reply.code(404).send({ message: "Balance version not found" });
    }

    if (current.status !== "draft") {
      return reply.code(400).send({ message: "Only draft versions can be edited" });
    }

    const updated = await updateBalanceVersion(Number(id), (version) => ({
      ...version,
      updatedAt: new Date().toISOString(),
      name: payload.name,
      version: payload.config.versionName,
      configJson: JSON.stringify(payload.config),
      ...(payload.description !== undefined ? { description: payload.description } : {})
    }));

    if (!updated) {
      return reply.code(404).send({ message: "Balance version not found" });
    }

    return {
      ...updated,
      config: parseBalanceConfig(updated.configJson)
    };
  });

  app.post("/admin/balance-versions/:id/publish", async (request, reply) => {
    const { id } = request.params as { id: string };
    const targetId = Number(id);
    const target = await getBalanceVersion(targetId);

    if (!target) {
      return reply.code(404).send({ message: "Balance version not found" });
    }

    const published = await publishBalanceVersion(targetId);

    if (!published) {
      return reply.code(500).send({ message: "Published version could not be reloaded" });
    }

    return {
      ...published,
      config: parseBalanceConfig(published.configJson)
    };
  });

  app.get("/admin/runs", async () => {
    const runs = await listRuns();

    return runs.slice(0, 100).map(toRunResponse);
  });

  app.get("/admin/runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await getRun(id);

    if (!run) {
      return reply.code(404).send({ message: "Run not found" });
    }

    const actionLogs = await listActionLogs(id);

    return {
      ...toRunResponse(run),
      actionLogs: actionLogs.map((log) => ({
        ...log,
        payload: JSON.parse(log.payloadJson)
      }))
    };
  });
}
