import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  database?: 'ok';
}

@Controller('health')
export class HealthController {
  constructor(private readonly database?: DatabaseService) {}

  @Get()
  getHealth(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async getReadiness(): Promise<HealthResponse> {
    if (!this.database) throw new ServiceUnavailableException('Database unavailable');
    try {
      await this.database.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok', database: 'ok', timestamp: new Date().toISOString() };
  }
}
