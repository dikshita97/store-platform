/**
 * Full End-to-End Test Suite
 * 
 * This test covers the complete user journey:
 * 1. Navigate to dashboard
 * 2. Create a store
 * 3. Wait for provisioning
 * 4. Access store frontend
 * 5. Place an order
 * 6. Return to dashboard
 * 7. Delete the store
 */

describe('Complete User Journey - Full E2E Flow', () => {
  const storeName = `e2e-full-journey-${Date.now()}`;
  let storeId: string;
  let storeUrl: string;
  const storeDomain = Cypress.env('STORE_DOMAIN') || '127.0.0.1.nip.io';

  it('should complete full user journey from dashboard to order', () => {
    // Step 1: Navigate to dashboard
    cy.visit('/');
    cy.get('[data-testid="dashboard"]', { timeout: 10000 }).should('be.visible');
    cy.contains('Dashboard').should('be.visible');
    
    // Step 2: Navigate to stores page
    cy.get('a').contains('Stores').click();
    cy.url().should('include', '/stores');
    cy.get('[data-testid="stores-list"]').should('be.visible');
    
    // Step 3: Create a new store via API
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      storeId = response.id;
      cy.log(`Created store: ${storeName} (${storeId})`);
      
      // Verify store appears in dashboard
      cy.reload();
      cy.contains(storeName).should('be.visible');
      cy.contains('provisioning').should('be.visible');
    });
    
    // Step 4: Wait for store provisioning
    cy.waitForStoreReady(storeId, 300000).then((store) => {
      storeUrl = store.url;
      cy.log(`Store is ready at: ${storeUrl}`);
      
      // Refresh dashboard to see updated status
      cy.visit('/stores');
      cy.get(`[data-testid="store-card-${storeId}"]`).within(() => {
        cy.contains('ready').should('be.visible');
      });
    });
    
    // Step 5: Access store frontend
    cy.visitStore(storeName);
    cy.get('body', { timeout: 30000 }).should('be.visible');
    cy.title().should('contain', storeName);
    
    // Step 6: Navigate to shop and add product
    cy.get('a').contains(/shop|store/i).first().click({ force: true });
    cy.url().should('include', '/shop');
    
    // Wait for products to load
    cy.get('.product', { timeout: 10000 }).should('have.length.at.least', 1);
    
    // Add product to cart
    cy.get('.product').first().within(() => {
      cy.get('.add_to_cart_button').click({ force: true });
    });
    
    cy.get('.woocommerce-message', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'has been added to your cart');
    
    // Step 7: Go to checkout
    cy.visit(`https://${storeName}.${storeDomain}/checkout`);
    cy.get('form.checkout', { timeout: 30000 }).should('be.visible');
    
    // Fill customer details
    cy.get('#billing_first_name').type('John');
    cy.get('#billing_last_name').type('Doe');
    cy.get('#billing_email').type('john.doe@example.com');
    cy.get('#billing_address_1').type('123 Test Street');
    cy.get('#billing_city').type('Test City');
    cy.get('#billing_postcode').type('12345');
    cy.get('#billing_phone').type('1234567890');
    
    // Select payment method and place order
    cy.get('#payment_method_cod').check({ force: true });
    cy.get('#place_order').click();
    
    // Verify order confirmation
    cy.url({ timeout: 30000 }).should('include', '/order-received');
    cy.get('.woocommerce-thankyou-order-received', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Thank you');
    
    cy.log('Order placed successfully!');
    
    // Step 8: Return to dashboard
    cy.visit('/stores');
    cy.contains(storeName).should('be.visible');
    
    // Click on store to view details
    cy.get(`[data-testid="store-card-${storeId}"]`).click();
    cy.url().should('include', `/stores/${storeId}`);
    cy.get('[data-testid="store-detail"]', { timeout: 10000 }).should('be.visible');
    
    // Step 9: Delete the store
    cy.get('[data-testid="delete-store-button"]').click();
    cy.get('[data-testid="confirm-delete"]').click();
    
    // Verify store is deleted
    cy.url().should('include', '/stores');
    cy.contains(storeName).should('not.exist');
    
    // Verify via API
    cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/api/v1/stores/${storeId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(404);
    });
    
    cy.log('Full user journey completed successfully!');
  });
});

describe('Dashboard Navigation', () => {
  it('should navigate through all dashboard pages', () => {
    // Dashboard home
    cy.visit('/');
    cy.get('[data-testid="dashboard"]').should('be.visible');
    cy.contains('Platform Overview').should('be.visible');
    
    // Stores list
    cy.get('a').contains('Stores').click();
    cy.url().should('include', '/stores');
    cy.get('[data-testid="stores-list"]').should('be.visible');
    
    // Click create store button
    cy.get('[data-testid="create-store-button"]').click();
    cy.get('[data-testid="create-store-modal"]').should('be.visible');
    
    // Close modal
    cy.get('[data-testid="close-modal"]').click();
    cy.get('[data-testid="create-store-modal"]').should('not.exist');
  });
});

describe('API Health Checks', () => {
  it('should verify API is healthy', () => {
    cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/health`,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('status', 'ok');
    });
  });

  it('should list all stores', () => {
    cy.request({
      method: 'GET',
      url: `${Cypress.env('API_URL')}/api/v1/stores`,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
    });
  });
});
