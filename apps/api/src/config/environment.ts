export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const required = ['DATABASE_URL', 'CORS_ORIGINS'];
  for (const key of required)
    if (typeof environment[key] !== 'string' || !environment[key])
      throw new Error(`${key} is required`);
  const port = Number(environment.API_PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error('API_PORT must be a valid TCP port');
  const delivery = Number(environment.DELIVERY_FEE_MILLIMES ?? 8000);
  if (!Number.isSafeInteger(delivery) || delivery < 0)
    throw new Error('DELIVERY_FEE_MILLIMES must be a non-negative integer');
  return { ...environment, API_PORT: port, DELIVERY_FEE_MILLIMES: delivery };
}
