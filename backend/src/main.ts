import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = parseInt(process.env.PORT || '5000', 10);
  const socketPort = parseInt(process.env.SOCKET_PORT || '5001', 10);

  await app.listen(port);
  logger.log(`REST API is listening on http://127.0.0.1:${port}`);
  logger.log(`Socket.IO Gateway is listening on ws://127.0.0.1:${socketPort}`);
}

bootstrap();
