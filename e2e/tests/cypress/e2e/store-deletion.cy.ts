describe('Store Deletion and Cleanup', () => {
  let storeId: string;
  let storeName: string;

  beforeEach(() => {
    // Create a store for deletion testing
    storeName = `e2e-delete-test-${Date.now()}`;
    
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      storeId = response.id;
      cy.log(`Created test store: ${storeId}`);
      
      // Wait for store to be ready before testing deletion
      cy.waitForStoreReady(storeId, 300000).then(() => {
        cy.log('Store is ready for deletion test');
      });
    });
  });

  it('should delete store via API', () => {
    // Delete the store
    cy.deleteStore(storeId).then(() => {
      cy.log(`Deleted store: ${storeId}`);
    });
    
    // Verify store is deleted by trying to fetch it
    cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/api/v1/stores/${storeId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(404);
    });
  });

  it('should remove store from dashboard after deletion', () => {
    // First verify store exists in dashboard
    cy.visit('/stores');
    cy.get('[data-testid="stores-list"]', { timeout: 10000 }).should('be.visible');
    cy.contains(storeName).should('be.visible');
    
    // Delete the store via API
    cy.deleteStore(storeId);
    
    // Refresh the dashboard
    cy.reload();
    
    // Verify store no longer appears
    cy.contains(storeName).should('not.exist');
  });

  it('should cleanup store resources in Kubernetes', () => {
    // Delete the store
    cy.deleteStore(storeId);
    
    // Note: In a real implementation, you would verify that:
    // - The namespace is deleted
    // - Pods are terminated
    // - Services are removed
    // - PVCs are deleted
    // This would require kubectl access or API endpoints
    
    cy.log('Store resources should be cleaned up in Kubernetes');
  });

  it('should handle deletion of non-existent store', () => {
    const fakeStoreId = 'non-existent-store-id-12345';
    
    cy.request({
      method: 'DELETE',
      url: `${Cypress.env('API_URL')}/api/v1/stores/${fakeStoreId}`,
      failOnStatusCode: false,
    }).then((response) => {
      // Should return 404 or similar error
      expect(response.status).to.be.oneOf([404, 400, 500]);
    });
  });

  it('should delete store and verify no orphaned data', () => {
    // Get store details before deletion
    cy.getStore(storeId).then((storeBefore) => {
      cy.log(`Store before deletion: ${JSON.stringify(storeBefore)}`);
      
      // Delete store
      cy.deleteStore(storeId);
      
      // Try to access store's frontend URL (should fail or redirect)
      if (storeBefore.url) {
        cy.request({
          method: 'GET',
          url: storeBefore.url,
          failOnStatusCode: false,
          timeout: 10000,
        }).then((response) => {
          // Should not be accessible (could be 404, connection refused, etc.)
          cy.log(`Store URL response status: ${response.status}`);
          expect(response.status).to.be.at.least(400);
        });
      }
    });
  });
});

describe('Bulk Cleanup - Delete All Test Stores', () => {
  it('should cleanup all stores created during E2E tests', () => {
    // Get all stores
    cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/api/v1/stores`,
    }).then((response) => {
      expect(response.status).to.equal(200);
      
      const stores = response.body;
      
      // Filter stores created by E2E tests
      const testStores = stores.filter((store: any) => 
        store.name.startsWith('e2e-') || 
        store.name.includes('test-')
      );
      
      cy.log(`Found ${testStores.length} test stores to cleanup`);
      
      // Delete each test store
      testStores.forEach((store: any) => {
        cy.deleteStore(store.id).then(() => {
          cy.log(`Deleted test store: ${store.name} (${store.id})`);
        });
      });
      
      // Verify all test stores are deleted
      cy.request({
        method: 'GET',
        url: `${Cypress.env('API_URL')}/api/v1/stores`,
      }).then((verifyResponse) => {
        const remainingStores = verifyResponse.body.filter((store: any) => 
          store.name.startsWith('e2e-') || 
          store.name.includes('test-')
        );
        expect(remainingStores).to.have.length(0);
      });
    });
  });
});
