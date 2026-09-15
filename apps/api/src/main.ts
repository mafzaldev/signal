import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './env.js';

async function bootstrap() {
  // Better Auth reads raw request bodies; its Nest module re-adds the JSON parser for other routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}
await bootstrap();
