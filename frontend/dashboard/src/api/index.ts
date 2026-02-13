import axios, { AxiosError } from 'axios';
import { Store, CreateStoreRequest, StoreListResponse, ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiResponse<any>>) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Store API
export const storeApi = {
  // List all stores
  list: async (params?: { page?: number; limit?: number; status?: string; engine?: string }) => {
    const response = await api.get<StoreListResponse>('/stores', { params });
    return response.data;
  },

  // Get store by ID
  get: async (id: string) => {
    const response = await api.get<{ success: true; data: Store }>(`/stores/${id}`);
    return response.data;
  },

  // Create new store
  create: async (data: CreateStoreRequest) => {
    const response = await api.post<{ success: true; data: { store: Store; message: string } }>(
      '/stores',
      data
    );
    return response.data;
  },

  // Delete store
  delete: async (id: string) => {
    const response = await api.delete<{ success: true; data: { message: string } }>(`/stores/${id}`);
    return response.data;
  },
};

// Health API
export const healthApi = {
  // Check liveness
  live: async () => {
    const response = await api.get('/health/live');
    return response.data;
  },

  // Check readiness
  ready: async () => {
    const response = await api.get('/health/ready');
    return response.data;
  },
};

export default api;
