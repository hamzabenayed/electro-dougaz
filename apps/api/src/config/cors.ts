/** Explicit methods are required: Fastify's defaults omit PUT and PATCH. */
export function createCorsOptions(origins: string) {
  return {
    credentials: true,
    origin: origins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
  };
}
