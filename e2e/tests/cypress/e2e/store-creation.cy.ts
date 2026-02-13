describe('Store Creation Flow', () => {
  let storeId: string;
  let storeName: string;

  beforeEach(() => {
    // Generate unique store name for each test
    storeName = `e2e-test-${Date.now()}`;
  });

  afterEach(() => {
    // Clean up: delete the store if it was created
    if (storeId) {
      cy.deleteStore(storeId).then(() => {
        cy.log(`Cleaned up store: ${storeId}`);
      });
    }
  });

  it('should create a new WooCommerce store via API', () => {
    // Create store via API
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      expect(response).to.have.property('id');
      expect(response).to.have.property('name', storeName);
      expect(response).to.have.property('engine', 'woocommerce');
      expect(response).to.have.property('plan', 'basic');
      expect(response).to.have.property('status');
      
      storeId = response.id;
      
      // Verify initial status is provisioning or pending
      expect(['pending', 'provisioning']).to.include(response.status);
    });
  });

  it('should wait for store to be ready', () => {
    // Create store
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      storeId = response.id;
      
      // Wait for store to be ready (up to 5 minutes)
      cy.waitForStoreReady(storeId, 300000).then((store) => {
        expect(store).to.have.property('status', 'ready');
        expect(store).to.have.property('url');
        expect(store.url).to.include(storeName);
      });
    });
  });

  it('should create store and verify dashboard updates', () => {
    // Create store via API
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      storeId = response.id;
      
      // Visit dashboard and verify store appears
      cy.visit('/stores');
      cy.get('[data-testid="stores-list"]', { timeout: 10000 }).should('be.visible');
      cy.contains(storeName).should('be.visible');
      
      // Verify store card displays correct info
      cy.get(`[data-testid="store-card-${storeId}"]`).within(() => {
        cy.contains('WooCommerce').should('be.visible');
        cy.contains('Basic').should('be.visible');
      });
    });
  });

  it('should validate required fields when creating store', () => {
    // Try to create store without name
    cy.request({
      method: 'POST',
      url: `${Cypress.env('API_URL')}/api/v1/stores`,
      body: {
        engine: 'woocommerce',
        plan: 'basic',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
    });
  });

  it('should reject invalid engine type', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('API_URL')}/api/v1/stores`,
      body: {
        name: storeName,
        engine: 'invalid-engine',
        plan: 'basic',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
    });
  });
});
