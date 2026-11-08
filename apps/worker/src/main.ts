import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })] })
class WorkerModule {}

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(WorkerModule);
  new Logger('Worker').log('Background worker is ready');
}

void bootstrap();
