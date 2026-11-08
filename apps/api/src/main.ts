import helmet from '@fastify/helmet';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createCorsOptions } from './config/cors.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 8 * 1024 * 1024 }),
    {
      bufferLogs: true
    }
  );
  const config = app.get(ConfigService);

  await app.register(helmet);
  app.enableCors(createCorsOptions(config.getOrThrow<string>('CORS_ORIGINS')));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true })
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Electro Dougaz API').setVersion('1').build()
  );
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.get<number>('API_PORT', 4000), '0.0.0.0');
}

void bootstrap();
