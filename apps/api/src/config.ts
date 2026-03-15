import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const environmentSchema = z.object({
  PORT: z.coerce.number().default(3001),
  PLAYER_APP_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_APP_ORIGIN: z.string().default("http://localhost:5174"),
  DATA_FILE: z.string().default("./data/store.json")
});

export const environment = environmentSchema.parse(process.env);
