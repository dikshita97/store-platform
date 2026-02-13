// Store types matching backend API
export interface Store {
  id: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  engine: string;
  plan: string;
  status: StoreStatus;
  statusMessage?: string | null;
  urls?: {
    storefront?: string;
    admin?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type StoreStatus = 'pending' | 'provisioning' | 'running' | 'failed' | 'deleting' | 'deleted';

export interface CreateStoreRequest {
  name: string;
  displayName?: string;
  description?: string;
  engine: 'woocommerce' | 'medusa';
  plan?: 'basic' | 'standard' | 'premium';
}

export interface StoreListResponse {
  data: {
    stores: Store[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
