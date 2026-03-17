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
  getProfile,
  getRun,
  listActionLogs,
  listBalanceVersions,
  listRuns,
  publishBalanceVersion,
  updateBalanceVersion,
  updateProfile,
  updateRun
} from "./db.js";
import { createDraftVersionName, draftFromConfig } from "./defaults.js";
import {
  profileResponse,
  removeLoadoutFromProfile,
  resolveLoadout,
  settleProfileAfterRun,
  updateEquippedLoadout
} from "./profile.js";
import { parseBalanceConfig, parseState, parseSummary } from "./serialization.js";

const createRunSchema = z.object({
  balanceVersionId: z.number().int().optional(),
  seed: z.number().int().optional(),
  carryCardIds: z.array(z.string()).max(3).optional()
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inquire"),
    target: z.enum(["gov", "corp", "anti"])
  }),
  z.object({
    type: z.literal("playCard"),
    cardInstanceId: z.string().min(1),
    targetFactions: z.array(z.enum(["gov", "corp", "anti"])).max(2).optional()
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

const loadoutSchema = z.object({
  equippedCardIds: z.array(z.string()).max(3)
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
        effectMode: z.enum(["boost_lowest_2", "shift_high_to_low_1", "shift_high_to_low_2", "shift_high_to_low_3"]).optional(),
        orangeEffect: z
          .enum([
            "double_day_delta_today",
            "market_swing_today",
            "double_future_info_cards_no_retain",
            "force_highest_inquiry_today",
            "force_negative_target_today",
            "lockstep_pair_today",
            "swap_highest_lowest_today"
          ])
          .optional(),
        effectLabel: z.string().optional(),
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
  loadoutCardIdsJson: string;
  stateJson: string;
  summaryJson: string;
  settlementJson?: string | null;
  endingCode?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: run.id,
    status: run.status,
    seed: run.seed,
    balanceVersionId: run.balanceVersionId,
    loadoutCardIds: JSON.parse(run.loadoutCardIdsJson) as string[],
    state: parseState(run.stateJson),
    summary: parseSummary(run.summaryJson),
    settlement: run.settlementJson ? JSON.parse(run.settlementJson) : null,
    endingCode: run.endingCode,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/bootstrap", async () => {
    const activeBalanceVersion = await getActiveBalanceVersion();
    const profile = await getProfile();

    return {
      activeBalanceVersion,
      profile: activeBalanceVersion ? profileResponse(profile, parseBalanceConfig(activeBalanceVersion.configJson)) : undefined,
      fallbackBalance: activeBalanceVersion ? undefined : defaultBalanceConfig
    };
  });

  app.put("/profile/loadout", async (request, reply) => {
    const payload = loadoutSchema.parse(request.body ?? {});
    const activeVersion = await getActiveBalanceVersion();

    if (!activeVersion) {
      return reply.code(400).send({ message: "No active balance version available" });
    }

    const config = parseBalanceConfig(activeVersion.configJson);
    const updatedProfile = await updateProfile((current) => updateEquippedLoadout(current, payload.equippedCardIds, config, new Date().toISOString()));

    return {
      profile: profileResponse(updatedProfile, config)
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
    const profile = await getProfile();
    const carryCardIds = resolveLoadout(payload.carryCardIds, profile, config);
    const state = startRun(config, { seed, balanceVersionId: activeVersion.id, carryCardIds });
    const summary = summarizeRun(state);
    const run = await createRun({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: state.runStatus,
      seed,
      balanceVersionId: activeVersion.id,
      loadoutCardIdsJson: JSON.stringify(carryCardIds),
      stateJson: JSON.stringify(state),
      summaryJson: JSON.stringify(summary),
      settlementJson: null,
      endingCode: null
    });
    const updatedProfile = await updateProfile((current) => removeLoadoutFromProfile(current, carryCardIds, new Date().toISOString()));

    return reply.code(201).send({
      ...toRunResponse(run),
      profile: profileResponse(updatedProfile, config)
    });
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
    let settlement = null;
    let profile = null;

    if (result.state.runStatus !== "active") {
      const currentProfile = await getProfile();
      const loadoutCardIds = JSON.parse(run.loadoutCardIdsJson) as string[];
      const settled = settleProfileAfterRun(currentProfile, config, result.state, loadoutCardIds, run.seed, new Date().toISOString());
      settlement = settled.settlement;
      const updatedProfile = await updateProfile(() => settled.profile);
      profile = profileResponse(updatedProfile, config);
    }

    const updated = await updateRun(id, (current) => ({
      ...current,
      status: result.state.runStatus,
      stateJson: JSON.stringify(result.state),
      summaryJson: JSON.stringify(summary),
      settlementJson: settlement ? JSON.stringify(settlement) : current.settlementJson ?? null,
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
      actionSummary: result.actionSummary,
      ...(profile ? { profile } : {})
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
