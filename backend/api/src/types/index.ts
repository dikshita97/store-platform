// Store types
export interface Store {
  id: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  engine: string;
  plan: string;
  status: StoreStatus;
  statusMessage?: string | null;
  url?: string | null;
  adminUrl?: string | null;
  namespace?: string | null;
  helmRelease?: string | null;
  adminUsername?: string | null;
  adminPasswordSecret?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  createdBy?: string | null;
}

export enum StoreStatus {
  PENDING = 'pending',
  PROVISIONING = 'provisioning',
  RUNNING = 'running',
  FAILED = 'failed',
  DELETING = 'deleting',
  DELETED = 'deleted'
}

export enum StoreEngine {
  WOOCOMMERCE = 'woocommerce',
  MEDUSA = 'medusa'
}

export enum StorePlan {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium'
}

// API Request/Response types
export interface CreateStoreRequest {
  name: string;
  displayName?: string;
  description?: string;
  engine: StoreEngine;
  plan?: StorePlan;
}

export interface StoreResponse {
  id: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  engine: string;
  plan: string;
  status: string;
  statusMessage?: string | null;
  urls?: {
    storefront?: string;
    admin?: string;
  };
  createdAt: string;
  updatedAt: string;
  credentials?: {
    username: string;
    password?: string;
  };
}

export interface StoreListResponse {
  data: StoreResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// Job types
export interface StoreJob {
  id: string;
  storeId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  currentStep?: string | null;
  error?: string | null;
  errorCode?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum JobType {
  PROVISION = 'provision',
  DELETE = 'delete'
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Helm configuration
export interface HelmConfig {
  chartPath: string;
  releaseName: string;
  namespace: string;
  values: Record<string, any>;
}

// Kubernetes types
export interface K8sPodStatus {
  phase: string;
  conditions: Array<{
    type: string;
    status: string;
    message?: string;
  }>;
  containerStatuses?: Array<{
    name: string;
    ready: boolean;
    restartCount: number;
    state: Record<string, any>;
  }>;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface StoreStatusUpdate extends WebSocketMessage {
  type: 'store.status_update';
  data: {
    storeId: string;
    status: StoreStatus;
    progress?: number;
    message?: string;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}
