import { defaultBalanceConfig } from "@alibi/game-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { environment } from "./config.js";
import { createSeedProfile, type PlayerProfileRecord } from "./profile.js";

export interface BalanceVersionRecord {
  id: number;
  version: string;
  name: string;
  status: string;
  description?: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface RunRecord {
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
}

export interface ActionLogRecord {
  id: string;
  runId: string;
  day: number;
  actionType: string;
  payloadJson: string;
  createdAt: string;
}

interface StoreFile {
  nextBalanceVersionId: number;
  balanceVersions: BalanceVersionRecord[];
  runs: RunRecord[];
  actionLogs: ActionLogRecord[];
  profile: PlayerProfileRecord;
}

const dataFile = resolve(process.cwd(), environment.DATA_FILE);

function nowIso() {
  return new Date().toISOString();
}

function createSeedStore(): StoreFile {
  const createdAt = nowIso();

  return {
    nextBalanceVersionId: 2,
    balanceVersions: [
      {
        id: 1,
        version: defaultBalanceConfig.versionName,
        name: "Initial demo balance",
        status: "active",
        description: "Seeded default config for the local demo.",
        configJson: JSON.stringify(defaultBalanceConfig),
        createdAt,
        updatedAt: createdAt,
        publishedAt: createdAt
      }
    ],
    runs: [],
    actionLogs: [],
    profile: createSeedProfile(defaultBalanceConfig, createdAt)
  };
}

async function writeStore(store: StoreFile) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

async function readStore() {
  try {
    const content = await readFile(dataFile, "utf8");
    return JSON.parse(content) as StoreFile;
  } catch (error) {
    const store = createSeedStore();
    await writeStore(store);
    return store;
  }
}

export async function ensureStore() {
  await readStore();
}

export async function getProfile() {
  const store = await readStore();
  return store.profile;
}

export async function updateProfile(updater: (current: PlayerProfileRecord) => PlayerProfileRecord) {
  const store = await readStore();
  store.profile = updater(store.profile);
  await writeStore(store);
  return store.profile;
}

export async function listBalanceVersions() {
  const store = await readStore();
  return [...store.balanceVersions].sort((a, b) => {
    const aDate = a.publishedAt ?? a.createdAt;
    const bDate = b.publishedAt ?? b.createdAt;
    return Date.parse(bDate) - Date.parse(aDate);
  });
}

export async function getBalanceVersion(id: number) {
  const store = await readStore();
  return store.balanceVersions.find((version) => version.id === id) ?? null;
}

export async function getActiveBalanceVersion() {
  const versions = await listBalanceVersions();
  return versions.find((version) => version.status === "active") ?? null;
}

export async function createBalanceVersion(input: {
  version: string;
  name: string;
  status: string;
  description?: string;
  configJson: string;
}): Promise<BalanceVersionRecord> {
  const store = await readStore();
  const createdAt = nowIso();
  const created: BalanceVersionRecord = {
    id: store.nextBalanceVersionId,
    version: input.version,
    name: input.name,
    status: input.status,
    configJson: input.configJson,
    createdAt,
    updatedAt: createdAt,
    publishedAt: input.status === "active" ? createdAt : null,
    ...(input.description !== undefined ? { description: input.description } : {})
  };

  store.nextBalanceVersionId += 1;
  store.balanceVersions.push(created);
  await writeStore(store);
  return created;
}

export async function updateBalanceVersion(
  id: number,
  updater: (current: BalanceVersionRecord) => BalanceVersionRecord
): Promise<BalanceVersionRecord | null> {
  const store = await readStore();
  const index = store.balanceVersions.findIndex((version) => version.id === id);

  if (index === -1) {
    return null;
  }

  const updated = updater(store.balanceVersions[index]!);
  store.balanceVersions[index] = updated;
  await writeStore(store);
  return updated;
}

export async function publishBalanceVersion(id: number): Promise<BalanceVersionRecord | null> {
  const store = await readStore();
  const publishedAt = nowIso();
  let published: BalanceVersionRecord | null = null;

  store.balanceVersions = store.balanceVersions.map((version) => {
    if (version.id === id) {
      published = {
        ...version,
        status: "active",
        publishedAt,
        updatedAt: publishedAt
      };
      return published;
    }

    if (version.status === "active") {
      return {
        ...version,
        status: "archived",
        updatedAt: publishedAt
      };
    }

    return version;
  });

  await writeStore(store);
  return published;
}

export async function createRun(input: Omit<RunRecord, "createdAt" | "updatedAt">): Promise<RunRecord> {
  const store = await readStore();
  const createdAt = nowIso();
  const run: RunRecord = {
    ...input,
    createdAt,
    updatedAt: createdAt
  };

  store.runs.push(run);
  await writeStore(store);
  return run;
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const store = await readStore();
  return store.runs.find((run) => run.id === id) ?? null;
}

export async function listRuns(): Promise<RunRecord[]> {
  const store = await readStore();
  return [...store.runs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function updateRun(id: string, updater: (current: RunRecord) => RunRecord): Promise<RunRecord | null> {
  const store = await readStore();
  const index = store.runs.findIndex((run) => run.id === id);

  if (index === -1) {
    return null;
  }

  const updated = updater(store.runs[index]!);
  store.runs[index] = {
    ...updated,
    updatedAt: nowIso()
  };
  await writeStore(store);
  return store.runs[index]!;
}

export async function createActionLog(input: Omit<ActionLogRecord, "id" | "createdAt">): Promise<ActionLogRecord> {
  const store = await readStore();
  const log: ActionLogRecord = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    ...input
  };

  store.actionLogs.push(log);
  await writeStore(store);
  return log;
}

export async function listActionLogs(runId: string): Promise<ActionLogRecord[]> {
  const store = await readStore();
  return store.actionLogs
    .filter((log) => log.runId === runId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
