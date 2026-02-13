import promClient from 'prom-client';

// Create a Registry to register the metrics
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'store_platform_',
});

// HTTP Request duration metric
export const httpRequestDuration = new promClient.Histogram({
  name: 'store_platform_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// HTTP Request total counter
export const httpRequestsTotal = new promClient.Counter({
  name: 'store_platform_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Active stores gauge
export const activeStoresGauge = new promClient.Gauge({
  name: 'store_platform_active_stores_total',
  help: 'Total number of active stores',
  labelNames: ['engine', 'plan', 'status'],
  registers: [register],
});

// Store operations counter
export const storeOperationsCounter = new promClient.Counter({
  name: 'store_platform_store_operations_total',
  help: 'Total number of store operations',
  labelNames: ['operation', 'engine', 'status'],
  registers: [register],
});

// Provisioning duration histogram
export const provisioningDuration = new promClient.Histogram({
  name: 'store_platform_provisioning_duration_seconds',
  help: 'Duration of store provisioning in seconds',
  labelNames: ['engine', 'plan', 'status'],
  buckets: [30, 60, 120, 180, 300, 600, 900, 1800],
  registers: [register],
});

// Helm operations counter
export const helmOperationsCounter = new promClient.Counter({
  name: 'store_platform_helm_operations_total',
  help: 'Total number of Helm operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// Database connection pool gauge
export const dbConnectionPoolGauge = new promClient.Gauge({
  name: 'store_platform_db_connection_pool_size',
  help: 'Current database connection pool size',
  registers: [register],
});

// Error counter
export const errorCounter = new promClient.Counter({
  name: 'store_platform_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'component'],
  registers: [register],
});

// Job queue size gauge
export const jobQueueSizeGauge = new promClient.Gauge({
  name: 'store_platform_job_queue_size',
  help: 'Current size of the job queue',
  labelNames: ['job_type'],
  registers: [register],
});

// Export metrics middleware for Express
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    
    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration
    );
    
    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
    });
  });
  
  next();
};
