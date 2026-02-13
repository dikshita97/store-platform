describe('WooCommerce Order Flow', () => {
  let storeId: string;
  let storeName: string;
  const storeDomain = Cypress.env('STORE_DOMAIN') || '127.0.0.1.nip.io';

  before(() => {
    // Create a store for order testing
    storeName = `e2e-order-test-${Date.now()}`;
    
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      storeId = response.id;
      cy.log(`Created store: ${storeId}`);
      
      // Wait for store to be ready
      cy.waitForStoreReady(storeId, 300000).then((store) => {
        cy.log(`Store ready: ${store.url}`);
      });
    });
  });

  after(() => {
    // Clean up: delete the store
    if (storeId) {
      cy.deleteStore(storeId).then(() => {
        cy.log(`Cleaned up store: ${storeId}`);
      });
    }
  });

  it('should load WooCommerce store homepage', () => {
    cy.visitStore(storeName);
    
    // Verify WooCommerce is loaded
    cy.get('body', { timeout: 30000 }).should('be.visible');
    cy.title().should('contain', storeName);
    
    // Check for WooCommerce specific elements
    cy.get('.woocommerce', { timeout: 10000 }).should('exist');
  });

  it('should navigate to shop page', () => {
    cy.visitStore(storeName);
    
    // Click on Shop link
    cy.get('a').contains(/shop|store/i).first().click();
    
    // Verify we're on the shop page
    cy.url().should('include', '/shop');
    cy.get('.products').should('be.visible');
  });

  it('should add a product to cart', () => {
    cy.visitStore(storeName);
    cy.visit(`https://${storeName}.${storeDomain}/shop`);
    
    // Wait for products to load
    cy.get('.product', { timeout: 10000 }).should('have.length.at.least', 1);
    
    // Add first product to cart
    cy.get('.product').first().within(() => {
      cy.get('.add_to_cart_button').click();
    });
    
    // Verify success message
    cy.get('.woocommerce-message', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'has been added to your cart');
  });

  it('should view cart contents', () => {
    // First add a product
    cy.visit(`https://${storeName}.${storeDomain}/shop`);
    cy.get('.product').first().find('.add_to_cart_button').click();
    cy.get('.woocommerce-message').should('be.visible');
    
    // Navigate to cart
    cy.visit(`https://${storeName}.${storeDomain}/cart`);
    
    // Verify cart page
    cy.get('.cart', { timeout: 10000 }).should('be.visible');
    cy.get('.cart_item').should('have.length.at.least', 1);
  });

  it('should complete checkout process', () => {
    const customerData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      address: '123 Test Street',
      city: 'Test City',
      postcode: '12345',
      phone: '1234567890',
    };

    // Add product to cart
    cy.visit(`https://${storeName}.${storeDomain}/shop`);
    cy.get('.product').first().find('.add_to_cart_button').click();
    cy.get('.woocommerce-message', { timeout: 10000 }).should('be.visible');
    
    // Go to checkout
    cy.visit(`https://${storeName}.${storeDomain}/checkout`);
    cy.get('form.checkout', { timeout: 30000 }).should('be.visible');
    
    // Fill billing details
    cy.get('#billing_first_name').type(customerData.firstName);
    cy.get('#billing_last_name').type(customerData.lastName);
    cy.get('#billing_email').type(customerData.email);
    cy.get('#billing_address_1').type(customerData.address);
    cy.get('#billing_city').type(customerData.city);
    cy.get('#billing_postcode').type(customerData.postcode);
    cy.get('#billing_phone').type(customerData.phone);
    
    // Select payment method (Cash on Delivery)
    cy.get('#payment_method_cod').check({ force: true });
    
    // Place order
    cy.get('#place_order').click();
    
    // Verify order confirmation
    cy.url({ timeout: 30000 }).should('include', '/order-received');
    cy.get('.woocommerce-thankyou-order-received', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Thank you');
    cy.get('.woocommerce-order-overview__order').should('be.visible');
  });

  it('should handle cart updates', () => {
    cy.visit(`https://${storeName}.${storeDomain}/shop`);
    cy.get('.product').first().find('.add_to_cart_button').click();
    cy.get('.woocommerce-message').should('be.visible');
    
    // Go to cart
    cy.visit(`https://${storeName}.${storeDomain}/cart`);
    cy.get('.cart').should('be.visible');
    
    // Update quantity
    cy.get('.qty').first().clear().type('2');
    cy.get('[name="update_cart"]').click();
    
    // Verify cart updated
    cy.get('.woocommerce-message', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Cart updated');
  });

  it('should remove item from cart', () => {
    // Add product
    cy.visit(`https://${storeName}.${storeDomain}/shop`);
    cy.get('.product').first().find('.add_to_cart_button').click();
    cy.get('.woocommerce-message').should('be.visible');
    
    // Go to cart
    cy.visit(`https://${storeName}.${storeDomain}/cart`);
    cy.get('.cart_item').should('have.length.at.least', 1);
    
    // Remove item
    cy.get('.remove').first().click();
    
    // Verify cart is empty
    cy.get('.cart-empty', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Your cart is currently empty');
  });
});
