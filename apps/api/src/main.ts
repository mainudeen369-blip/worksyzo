import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/error.filter';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`Worksyzo API listening on http://localhost:${config.port}`, 'Bootstrap');
  Logger.log(`CORS origin: ${config.webOrigin}`, 'Bootstrap');
}

bootstrap().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error('API failed to start:', error);
  process.exit(1);
});
