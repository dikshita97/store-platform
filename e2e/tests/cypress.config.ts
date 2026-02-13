import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:5173',
    apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:8080',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    video: true,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    setupNodeEvents(on, config) {
      // Configure environment variables
      config.env = {
        ...config.env,
        API_URL: process.env.CYPRESS_API_URL || 'http://localhost:8080',
        DASHBOARD_URL: process.env.CYPRESS_DASHBOARD_URL || 'http://localhost:5173',
        STORE_DOMAIN: process.env.CYPRESS_STORE_DOMAIN || '127.0.0.1.nip.io',
      };

      // Task to wait for store provisioning
      on('task', {
        waitForStoreProvisioning(storeId: string) {
          return new Promise((resolve, reject) => {
            const maxAttempts = 60;
            let attempts = 0;
            
            const checkStatus = async () => {
              attempts++;
              try {
                const response = await fetch(`${config.env.API_URL}/api/v1/stores/${storeId}`);
                const data = await response.json();
                
                if (data.status === 'ready') {
                  resolve(data);
                } else if (data.status === 'failed') {
                  reject(new Error(`Store provisioning failed: ${data.error}`));
                } else if (attempts >= maxAttempts) {
                  reject(new Error('Timeout waiting for store provisioning'));
                } else {
                  setTimeout(checkStatus, 5000);
                }
              } catch (error) {
                if (attempts >= maxAttempts) {
                  reject(error);
                } else {
                  setTimeout(checkStatus, 5000);
                }
              }
            };
            
            checkStatus();
          });
        },
        
        log(message: string) {
          console.log(message);
          return null;
        },
      });

      return config;
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
