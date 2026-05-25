import { createApp } from "./app";
import { env } from "./env";

async function bootstrap() {
  const app = await createApp();

  try {
    await app.listen({
      port: env.SERVER_PORT,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void bootstrap();
