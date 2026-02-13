import { Prisma, Store, StoreStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import helmService from './HelmService';
import config from '../config';
import { CreateStoreRequest, StoreResponse, StorePlan, StoreEngine } from '../types';

export class StoreService {
  /**
   * Create a new store
   */
  async create(data: CreateStoreRequest, createdBy?: string): Promise<Store> {
    logger.info('Creating store', { name: data.name, engine: data.engine });

    // Check for unsupported engines
    if (data.engine === 'medusa') {
      throw new Error('MedusaJS support is coming in Round 2. Please use WooCommerce for now.');
    }

    // Validate store name
    const existingStore = await prisma.store.findUnique({
      where: { name: data.name },
    });

    if (existingStore) {
      throw new Error(`Store with name '${data.name}' already exists`);
    }

    // Create store record
    const store = await prisma.store.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        engine: data.engine,
        plan: data.plan || StorePlan.BASIC,
        status: StoreStatus.PENDING,
        createdBy,
      },
    });

    logger.info('Store created', { storeId: store.id, name: store.name });

    // Create provisioning job
    await prisma.storeJob.create({
      data: {
        storeId: store.id,
        jobType: 'provision',
        status: 'pending',
        progress: 0,
      },
    });

    // Trigger async provisioning
    this.provisionStore(store).catch(error => {
      logger.error('Provisioning failed', { storeId: store.id, error: error.message });
    });

    return store;
  }

  /**
   * Provision a store (async operation)
   */
  private async provisionStore(store: Store): Promise<void> {
    const storeId = store.id;
    const namespace = `store-${storeId}`;
    const releaseName = `store-${storeId}`;
    const storeUrl = `${store.name}-${storeId}.${config.provisioning.baseDomain}`;

    logger.info('Starting store provisioning', { storeId, namespace });

    try {
      // Update store status
      await prisma.store.update({
        where: { id: storeId },
        data: {
          status: StoreStatus.PROVISIONING,
          statusMessage: 'Starting provisioning...',
          namespace,
          helmRelease: releaseName,
        },
      });

      await this.createStoreEvent(storeId, 'provisioning_started', 'Provisioning started');

      // Update job status
      await prisma.storeJob.updateMany({
        where: { storeId, jobType: 'provision', status: 'pending' },
        data: {
          status: 'running',
          startedAt: new Date(),
          currentStep: 'Creating Helm release',
          progress: 10,
        },
      });

      // Build Helm values
      const helmValues = this.buildHelmValues(store, storeUrl);

      // Install Helm chart
      const result = await helmService.install({
        chartPath: config.helm.chartPath,
        releaseName,
        namespace,
        values: helmValues,
      });

      if (!result.success) {
        throw new Error(`Helm install failed: ${result.error}`);
      }

      // Update job progress
      await prisma.storeJob.updateMany({
        where: { storeId, jobType: 'provision', status: 'running' },
        data: {
          currentStep: 'Waiting for store to be ready',
          progress: 50,
        },
      });

      // Wait for store to be ready
      await this.waitForStoreReady(namespace, store.name);

      // Get admin credentials from Kubernetes secret
      const credentials = await this.getAdminCredentials(namespace, store.name);

      // Update store as running
      await prisma.store.update({
        where: { id: storeId },
        data: {
          status: StoreStatus.RUNNING,
          statusMessage: 'Store is running',
          url: `https://${storeUrl}`,
          adminUrl: `https://${storeUrl}/wp-admin`,
          adminUsername: credentials.username,
          adminPasswordSecret: credentials.passwordSecret,
        },
      });

      await this.createStoreEvent(storeId, 'provisioning_completed', 'Store is running');

      // Complete job
      await prisma.storeJob.updateMany({
        where: { storeId, jobType: 'provision', status: 'running' },
        data: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        },
      });

      logger.info('Store provisioning completed', { storeId });

    } catch (error: any) {
      logger.error('Store provisioning failed', { storeId, error: error.message });

      // Update store status
      await prisma.store.update({
        where: { id: storeId },
        data: {
          status: StoreStatus.FAILED,
          statusMessage: error.message,
        },
      });

      await this.createStoreEvent(storeId, 'provisioning_failed', error.message);

      // Fail job
      await prisma.storeJob.updateMany({
        where: { storeId, jobType: 'provision', status: 'running' },
        data: {
          status: 'failed',
          error: error.message,
        },
      });
    }
  }

  /**
   * Build Helm values for store
   */
  private buildHelmValues(store: Store, storeUrl: string): Record<string, any> {
    return {
      store: {
        id: store.id,
        name: store.name,
        engine: store.engine,
        plan: store.plan,
        createdBy: store.createdBy,
        description: store.description,
      },
      global: {
        baseDomain: config.provisioning.baseDomain,
        storageClass: 'standard',
        certIssuer: 'selfsigned',
      },
      wordpress: {
        site: {
          url: storeUrl,
          title: store.displayName || store.name,
        },
        admin: {
          username: 'admin',
          email: 'admin@example.com',
        },
      },
    };
  }

  /**
   * Wait for store to be ready
   */
  private async waitForStoreReady(namespace: string, storeName: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const maxRetries = 60;
    const retryDelay = 5000; // 5 seconds

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check if WordPress deployment is ready
        const command = `kubectl get deployment store-${storeName}-wordpress -n ${namespace} -o jsonpath='{.status.readyReplicas}'`;
        const { stdout } = await execAsync(command, { timeout: 10000 });
        
        if (stdout.trim() === '1') {
          logger.info('Store is ready', { namespace });
          return;
        }
      } catch {
        // Not ready yet, wait and retry
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error('Timeout waiting for store to be ready');
  }

  /**
   * Get admin credentials from Kubernetes secret
   */
  private async getAdminCredentials(namespace: string, storeName: string): Promise<{ username: string; passwordSecret: string }> {
    return {
      username: 'admin',
      passwordSecret: `store-${storeName}-wordpress-credentials`,
    };
  }

  /**
   * Delete a store
   */
  async delete(storeId: string): Promise<void> {
    logger.info('Deleting store', { storeId });

    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    if (store.status === StoreStatus.DELETING) {
      throw new Error('Store is already being deleted');
    }

    // Update status
    await prisma.store.update({
      where: { id: storeId },
      data: {
        status: StoreStatus.DELETING,
        statusMessage: 'Deleting store...',
      },
    });

    // Create deletion job
    await prisma.storeJob.create({
      data: {
        storeId,
        jobType: 'delete',
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Trigger async deletion
    this.performDeletion(store).catch(error => {
      logger.error('Deletion failed', { storeId, error: error.message });
    });
  }

  /**
   * Perform store deletion (async)
   */
  private async performDeletion(store: Store): Promise<void> {
    const storeId = store.id;
    const namespace = store.namespace;
    const releaseName = store.helmRelease;

    try {
      await this.createStoreEvent(storeId, 'deletion_started', 'Starting deletion');

      if (namespace && releaseName) {
        // Uninstall Helm release
        await helmService.uninstall(releaseName, namespace);

        // Delete namespace
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        await execAsync(`kubectl delete namespace ${namespace} --force --grace-period=0`, {
          timeout: 60000,
        });
      }

      // Mark store as deleted
      await prisma.store.update({
        where: { id: storeId },
        data: {
          status: StoreStatus.DELETED,
          statusMessage: 'Store deleted',
          deletedAt: new Date(),
        },
      });

      await this.createStoreEvent(storeId, 'deletion_completed', 'Store deleted');

      // Complete job
      await prisma.storeJob.updateMany({
        where: { storeId, jobType: 'delete', status: 'running' },
        data: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        },
      });

      logger.info('Store deletion completed', { storeId });

    } catch (error: any) {
      logger.error('Store deletion failed', { storeId, error: error.message });

      await prisma.store.update({
        where: { id: storeId },
        data: {
          status: StoreStatus.FAILED,
          statusMessage: `Deletion failed: ${error.message}`,
        },
      });

      await prisma.storeJob.updateMany({
        where: { storeId, jobType: 'delete', status: 'running' },
        data: {
          status: 'failed',
          error: error.message,
        },
      });
    }
  }

  /**
   * Get store by ID
   */
  async getById(storeId: string): Promise<Store | null> {
    return prisma.store.findUnique({
      where: { id: storeId },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * List stores
   */
  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    engine?: string;
  }): Promise<{ stores: Store[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.engine) {
      where.engine = params.engine;
    }

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.count({ where }),
    ]);

    return { stores, total, page, limit };
  }

  /**
   * Create store event
   */
  private async createStoreEvent(
    storeId: string,
    eventType: string,
    message: string
  ): Promise<void> {
    await prisma.storeEvent.create({
      data: {
        storeId,
        eventType,
        message,
      },
    });
  }

  /**
   * Convert Store to StoreResponse
   */
  toResponse(store: Store): StoreResponse {
    return {
      id: store.id,
      name: store.name,
      displayName: store.displayName,
      description: store.description,
      engine: store.engine,
      plan: store.plan,
      status: store.status,
      statusMessage: store.statusMessage,
      urls: store.url ? {
        storefront: store.url,
        admin: store.adminUrl,
      } : undefined,
      createdAt: store.createdAt.toISOString(),
      updatedAt: store.updatedAt.toISOString(),
    };
  }
}

export const storeService = new StoreService();
export default storeService;
