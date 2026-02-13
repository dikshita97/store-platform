import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../utils/logger';
import { HelmConfig } from '../types';

const execAsync = promisify(exec);

export class HelmService {
  private chartPath: string;
  private timeout: number;

  constructor() {
    this.chartPath = config.helm.chartPath;
    this.timeout = config.helm.timeout;
  }

  /**
   * Install or upgrade a Helm release
   */
  async install(config: HelmConfig): Promise<{ success: boolean; output: string; error?: string }> {
    const { releaseName, namespace, values } = config;
    
    logger.info('Installing Helm release', { releaseName, namespace });

    try {
      // Create namespace if it doesn't exist
      await this.ensureNamespace(namespace);

      // Build values file
      const valuesFile = this.buildValuesFile(values);
      
      // Install/upgrade Helm release
      const command = `helm upgrade --install ${releaseName} ${this.chartPath}/woocommerce \\
        --namespace ${namespace} \\
        --create-namespace \\
        --values ${valuesFile} \\
        --timeout ${this.timeout}s \\
        --wait \\
        --atomic`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: (this.timeout + 30) * 1000, // Add 30s buffer
      });

      logger.info('Helm install completed', { releaseName, namespace });

      return {
        success: true,
        output: stdout,
      };
    } catch (error: any) {
      logger.error('Helm install failed', { 
        releaseName, 
        namespace, 
        error: error.message,
        stderr: error.stderr,
      });

      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }

  /**
   * Uninstall a Helm release
   */
  async uninstall(releaseName: string, namespace: string): Promise<{ success: boolean; error?: string }> {
    logger.info('Uninstalling Helm release', { releaseName, namespace });

    try {
      const command = `helm uninstall ${releaseName} --namespace ${namespace} --wait`;
      
      await execAsync(command, {
        timeout: 120000, // 2 minutes
      });

      logger.info('Helm uninstall completed', { releaseName, namespace });

      return { success: true };
    } catch (error: any) {
      // Release may not exist, which is fine
      if (error.message.includes('release: not found')) {
        logger.warn('Helm release not found during uninstall', { releaseName, namespace });
        return { success: true };
      }

      logger.error('Helm uninstall failed', { 
        releaseName, 
        namespace, 
        error: error.message,
      });

      return {
        success: false,
        error: error.stderr || error.message,
      };
    }
  }

  /**
   * Get Helm release status
   */
  async getStatus(releaseName: string, namespace: string): Promise<any | null> {
    try {
      const command = `helm status ${releaseName} --namespace ${namespace} --output json`;
      const { stdout } = await execAsync(command, { timeout: 30000 });
      return JSON.parse(stdout);
    } catch (error) {
      return null;
    }
  }

  /**
   * Ensure namespace exists
   */
  private async ensureNamespace(namespace: string): Promise<void> {
    try {
      const command = `kubectl get namespace ${namespace}`;
      await execAsync(command, { timeout: 10000 });
    } catch {
      // Namespace doesn't exist, create it
      const createCommand = `kubectl create namespace ${namespace}`;
      await execAsync(createCommand, { timeout: 10000 });
      logger.info('Created namespace', { namespace });
    }
  }

  /**
   * Build values file from object
   */
  private buildValuesFile(values: Record<string, any>): string {
    const yaml = require('yaml');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const yamlContent = yaml.stringify(values);
    const tempFile = path.join(os.tmpdir(), `helm-values-${uuidv4()}.yaml`);
    
    fs.writeFileSync(tempFile, yamlContent);
    
    return tempFile;
  }

  /**
   * Check if Helm is available
   */
  async isHelmAvailable(): Promise<boolean> {
    try {
      await execAsync('helm version', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const helmService = new HelmService();
export default helmService;
