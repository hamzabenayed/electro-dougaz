import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/modules/health/health.controller.js';

describe('HealthController', () => {
  it('reports that the process is healthy', () => {
    const response = new HealthController().getHealth();
    expect(response.status).toBe('ok');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
