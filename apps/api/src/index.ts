import cors from "@fastify/cors";
import Fastify from "fastify";
import { environment } from "./config.js";
import { ensureStore } from "./db.js";
import { registerRoutes } from "./routes.js";

async function main() {
  await ensureStore();
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: [environment.PLAYER_APP_ORIGIN, environment.ADMIN_APP_ORIGIN]
  });

  await registerRoutes(app);

  await app.listen({
    host: "0.0.0.0",
    port: environment.PORT
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
