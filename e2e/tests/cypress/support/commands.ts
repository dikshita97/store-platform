/// <reference types="cypress" />

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Create a new store via API
       * @param storeData - Store configuration
       */
      createStore(storeData: {
        name: string;
        engine?: string;
        plan?: string;
      }): Chainable<any>;

      /**
       * Delete a store via API
       * @param storeId - Store ID to delete
       */
      deleteStore(storeId: string): Chainable<any>;

      /**
       * Wait for store to be ready
       * @param storeId - Store ID to wait for
       * @param timeout - Maximum wait time in ms
       */
      waitForStoreReady(storeId: string, timeout?: number): Chainable<any>;

      /**
       * Get store by ID via API
       * @param storeId - Store ID
       */
      getStore(storeId: string): Chainable<any>;

      /**
       * Create a WooCommerce product
       * @param productData - Product configuration
       */
      createProduct(productData: {
        name: string;
        price: number;
        description?: string;
      }): Chainable<any>;

      /**
       * Navigate to store frontend
       * @param storeName - Store name/subdomain
       */
      visitStore(storeName: string): Chainable<any>;

      /**
       * Add product to cart
       * @param productName - Product name to add
       */
      addToCart(productName: string): Chainable<any>;

      /**
       * Complete WooCommerce checkout
       * @param customerData - Customer information
       */
      completeCheckout(customerData: {
        firstName: string;
        lastName: string;
        email: string;
        address: string;
        city: string;
        postcode: string;
        phone: string;
      }): Chainable<any>;
    }
  }
}

// Custom command to create a store via API
Cypress.Commands.add('createStore', (storeData) => {
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:8080';
  
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/api/v1/stores`,
    body: {
      name: storeData.name,
      engine: storeData.engine || 'woocommerce',
      plan: storeData.plan || 'basic',
    },
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 201]);
    return cy.wrap(response.body);
  });
});

// Custom command to delete a store via API
Cypress.Commands.add('deleteStore', (storeId) => {
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:8080';
  
  return cy.request({
    method: 'DELETE',
    url: `${apiUrl}/api/v1/stores/${storeId}`,
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 204]);
  });
});

// Custom command to wait for store to be ready
Cypress.Commands.add('waitForStoreReady', (storeId, timeout = 300000) => {
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:8080';
  const startTime = Date.now();
  
  const checkStatus = () => {
    return cy.request({
      method: 'GET',
      url: `${apiUrl}/api/v1/stores/${storeId}`,
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 200) {
        const store = response.body;
        
        if (store.status === 'ready') {
          return cy.wrap(store);
        } else if (store.status === 'failed') {
          throw new Error(`Store provisioning failed: ${store.error || 'Unknown error'}`);
        } else if (Date.now() - startTime > timeout) {
          throw new Error(`Timeout waiting for store ${storeId} to be ready`);
        } else {
          cy.wait(5000);
          return checkStatus();
        }
      } else {
        if (Date.now() - startTime > timeout) {
          throw new Error(`Timeout waiting for store ${storeId} to be ready`);
        }
        cy.wait(5000);
        return checkStatus();
      }
    });
  };
  
  return checkStatus();
});

// Custom command to get store by ID
Cypress.Commands.add('getStore', (storeId) => {
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:8080';
  
  return cy.request({
    method: 'GET',
    url: `${apiUrl}/api/v1/stores/${storeId}`,
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status).to.equal(200);
    return cy.wrap(response.body);
  });
});

// Custom command to navigate to store frontend
Cypress.Commands.add('visitStore', (storeName) => {
  const domain = Cypress.env('STORE_DOMAIN') || '127.0.0.1.nip.io';
  cy.visit(`https://${storeName}.${domain}`);
});

// Custom command to add product to cart (WooCommerce specific)
Cypress.Commands.add('addToCart', (productName) => {
  // Navigate to shop page
  cy.get('a').contains('Shop').click();
  
  // Find and click on the product
  cy.get('.product').contains(productName).parents('.product').find('.add_to_cart_button').click();
  
  // Wait for cart update
  cy.get('.woocommerce-message').should('contain', 'has been added to your cart');
});

// Custom command to complete checkout
Cypress.Commands.add('completeCheckout', (customerData) => {
  // Navigate to cart
  cy.get('a').contains('Cart').click();
  cy.url().should('include', '/cart');
  
  // Proceed to checkout
  cy.get('.checkout-button').click();
  cy.url().should('include', '/checkout');
  
  // Fill in customer details
  cy.get('#billing_first_name').type(customerData.firstName);
  cy.get('#billing_last_name').type(customerData.lastName);
  cy.get('#billing_email').type(customerData.email);
  cy.get('#billing_address_1').type(customerData.address);
  cy.get('#billing_city').type(customerData.city);
  cy.get('#billing_postcode').type(customerData.postcode);
  cy.get('#billing_phone').type(customerData.phone);
  
  // Select payment method (Cash on Delivery for testing)
  cy.get('#payment_method_cod').check({ force: true });
  
  // Place order
  cy.get('#place_order').click();
  
  // Verify order confirmation
  cy.url().should('include', '/order-received');
  cy.get('.woocommerce-thankyou-order-received').should('be.visible');
});
