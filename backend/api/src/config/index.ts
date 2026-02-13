// Application configuration
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://provisioner:password@localhost:5432/provisioner',
  },
  
  // Redis (for job queue)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  
  // Kubernetes
  kubernetes: {
    inCluster: process.env.KUBERNETES_SERVICE_HOST !== undefined,
    configPath: process.env.KUBECONFIG,
  },
  
  // Helm
  helm: {
    chartPath: process.env.HELM_CHART_PATH || '/charts/helm/store-engine',
    timeout: parseInt(process.env.HELM_TIMEOUT || '600', 10), // seconds
  },
  
  // Store provisioning
  provisioning: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_PROVISIONING || '5', 10),
    timeout: parseInt(process.env.PROVISIONING_TIMEOUT || '600', 10), // seconds
    baseDomain: process.env.BASE_DOMAIN || '127.0.0.1.nip.io',
  },
  
  // Security
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  },
};

export default config;
