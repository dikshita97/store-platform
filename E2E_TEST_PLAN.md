# E2E Test Plan

## Overview

This document outlines the end-to-end testing strategy for the Store Provisioning Platform, ensuring that all user flows work correctly from creation to deletion, with complete order lifecycle validation.

## Test Strategy

### Testing Approach

- **Manual Testing:** Initial validation, exploratory testing
- **Automated Testing:** Cypress/Playwright for regression testing
- **Smoke Tests:** Quick validation of core functionality
- **Integration Tests:** API and component interactions

### Test Environments

1. **Local Development:** k3d/kind cluster
2. **CI Environment:** Ephemeral k3d cluster in GitHub Actions
3. **Staging:** Production-like environment (if available)
4. **Production:** Live environment (read-only tests)

## E2E Test Cases

### WooCommerce Test Suite

#### Test Case: WC-E2E-001 - Complete Order Flow

**Objective:** Verify end-to-end WooCommerce order processing

**Prerequisites:**
- Kubernetes cluster running
- Platform deployed and accessible
- WooCommerce store successfully provisioned

**Test Steps:**

```gherkin
Feature: WooCommerce Complete Order Flow
  As a store owner
  I want to create, sell, and fulfill orders
  So that I can run my business successfully

  Background:
    Given the Store Provisioning Platform is running
    And I have a WooCommerce store named "test-store-wc"
    And the store status is "Running"
    And I have received admin credentials

  @critical
  Scenario: Create a product and complete an order
    # Step 1: Access Admin Panel
    When I navigate to the admin URL "https://test-store-wc.127.0.0.1.nip.io/wp-admin"
    And I enter username "admin"
    And I enter password from the store credentials
    And I click "Log In"
    Then I see the WordPress Dashboard
    
    # Step 2: Create a Product
    When I hover over "Products" in the left menu
    And I click "Add New"
    Then I see the "Add new product" page
    
    When I enter "Test Product A" in the "Product name" field
    And I enter "A test product for E2E validation" in the description
    And I scroll to the "Product data" section
    And I select "Simple product" from the product type dropdown
    And I enter "29.99" in the "Regular price" field
    And I enter "TEST-001" in the "SKU" field
    And I check the "Manage stock?" checkbox
    And I enter "100" in the "Stock quantity" field
    And I select "In stock" from the "Stock status" dropdown
    And I click "Publish"
    Then I see the message "Product published"
    And I see "Test Product A" in the page title
    
    # Step 3: View Storefront
    When I click "View Product" link
    Then I see the product page with "Test Product A"
    And I see the price "$29.99"
    And I see the "Add to cart" button
    
    # Step 4: Add to Cart
    When I click "Add to cart"
    Then I see the message "Test Product A" has been added to your cart"
    And I see the cart icon shows "1" item
    
    # Step 5: Proceed to Checkout
    When I click "View cart"
    Then I see the cart page
    And I see "Test Product A" with price "$29.99"
    And I see the cart total "$29.99"
    
    When I click "Proceed to checkout"
    Then I see the checkout page
    
    # Step 6: Fill Checkout Form
    When I enter the following billing details:
      | Field              | Value              |
      | First name         | John               |
      | Last name          | Doe                |
      | Country/Region     | United States (US) |
      | Street address     | 123 Test Street    |
      | Town / City        | Test City          |
      | State              | California         |
      | ZIP                | 90210              |
      | Phone              | 555-123-4567       |
      | Email address      | john.doe@test.com  |
    And I check "Ship to a different address?" to uncheck it
    And I select "Cash on delivery" payment method
    And I check "I have read and agree to the website terms and conditions"
    And I click "Place order"
    Then I see "Order received"
    And I see an order number (e.g., "Order #123")
    And I see the message "Thank you. Your order has been received."
    
    # Step 7: Verify Order in Admin
    When I navigate to "https://test-store-wc.127.0.0.1.nip.io/wp-admin"
    And I hover over "WooCommerce" in the left menu
    And I click "Orders"
    Then I see the Orders list page
    And I see the new order in the list
    And the order status shows "Processing"
    
    When I click on the order number
    Then I see the order details page
    And I see customer "John Doe"
    And I see the product "Test Product A" with price "$29.99"
    And I see the order total "$29.99"
    And I see payment method "Cash on delivery"
    
    # Step 8: Complete Order
    When I click on the "Status" dropdown
    And I select "Completed"
    And I click "Update"
    Then I see the message "Order updated"
    And the order status shows "Completed"

  @smoke
  Scenario: Storefront is accessible and functional
    When I navigate to "https://test-store-wc.127.0.0.1.nip.io"
    Then I see the store homepage
    And the page loads without errors
    And I see the default WordPress/WooCommerce theme
```

#### Test Case: WC-E2E-002 - Store Lifecycle

**Objective:** Verify complete store creation and deletion flow

```gherkin
Feature: Store Lifecycle Management
  As a platform user
  I want to create and delete stores
  So that I can manage my store portfolio

  Background:
    Given the Store Provisioning Platform dashboard is accessible
    And I am logged in to the dashboard

  @critical
  Scenario: Create a new WooCommerce store
    When I click the "Create Store" button
    Then I see the store creation wizard
    
    When I enter "lifecycle-test-store" in the "Store name" field
    And I enter "A test store for lifecycle validation" in the description
    And I select "WooCommerce" from the "Store engine" dropdown
    And I select "Basic" from the "Plan" dropdown
    And I click "Next"
    Then I see the review page with my selections
    
    When I click "Create Store"
    Then I see a progress indicator
    And I see the status "Creating namespace..."
    And within 30 seconds I see "Installing database..."
    And within 2 minutes I see "Configuring application..."
    And within 5 minutes the status shows "Running"
    And I see a success message "Store created successfully"
    And I see the store URL
    And I see admin credentials
    
    When I click "Go to Dashboard"
    Then I see the store in the store list
    And the status shows "Running"
    And I see the engine "WooCommerce"
    And I see the creation timestamp

  @critical
  Scenario: Delete a store and verify cleanup
    Given I have a store named "delete-test-store" with status "Running"
    And I am viewing the store details page
    
    When I click the "Delete Store" button
    Then I see a confirmation dialog
    And I see a warning "This action cannot be undone"
    And I see the text field "Type 'delete-test-store' to confirm"
    
    When I type "delete-test-store" in the confirmation field
    And I click "Delete Permanently"
    Then I see "Deleting store..."
    And the store status changes to "Deleting"
    
    When I wait for 2 minutes
    Then the store is removed from the list
    And I see a success message "Store deleted successfully"
    
    # Verify Kubernetes cleanup
    When I run "kubectl get namespace store-delete-test-store"
    Then I see "Error from server (NotFound)"
    
    When I run "kubectl get ingress -A | grep delete-test-store"
    Then I see no results
```

### Medusa Test Suite (Round 1 - Architecture Only)

#### Test Case: MED-E2E-001 - Medusa Option Visibility

**Objective:** Verify MedusaJS is visible but marked as coming soon

```gherkin
Feature: MedusaJS Future Support Indication
  As a platform user
  I want to see MedusaJS as a future option
  So that I know it's coming

  @architectural
  Scenario: MedusaJS appears in engine selection
    Given I am on the store creation page
    When I view the "Store engine" section
    Then I see "WooCommerce" as available option
    And I see "MedusaJS" in the list
    And "MedusaJS" has a "Coming Soon" badge
    And "MedusaJS" option is disabled
    And I see a tooltip: "MedusaJS support coming in Round 2"
    
    When I click on "MedusaJS"
    Then nothing happens
    And I see a toast notification "MedusaJS support coming in Round 2"
```

### Dashboard Test Suite

#### Test Case: DASH-E2E-001 - Store List and Filtering

```gherkin
Feature: Dashboard Store Management
  As a platform user
  I want to view and filter my stores
  So that I can efficiently manage them

  Background:
    Given I have created 5 stores:
      | Name        | Engine      | Status  |
      | store-alpha | woocommerce | Running |
      | store-beta  | woocommerce | Running |
      | store-gamma | woocommerce | Failed  |
      | store-delta | woocommerce | Pending |
      | store-eps   | woocommerce | Running |

  @smoke
  Scenario: View all stores
    When I navigate to the dashboard
    Then I see the store list
    And I see 5 stores listed
    And each store shows:
      | Name       |
      | Status     |
      | Engine     |
      | Created At |
      | URL        |

  Scenario: Filter stores by status
    When I click the "Status" filter dropdown
    And I select "Running"
    Then I see 3 stores: "store-alpha", "store-beta", "store-eps"
    And I do not see "store-gamma" or "store-delta"
    
    When I clear the filter
    Then I see all 5 stores again

  Scenario: Search stores by name
    When I enter "alpha" in the search box
    Then I see only "store-alpha"
    And the list count shows "1 store"
    
    When I clear the search
    Then I see all 5 stores

  Scenario: Sort stores by creation date
    When I click the "Created At" column header
    Then stores are sorted by newest first
    
    When I click "Created At" again
    Then stores are sorted by oldest first
```

#### Test Case: DASH-E2E-002 - Store Details View

```gherkin
Feature: Store Details Page
  As a platform user
  I want to view detailed information about a store
  So that I can monitor its health and access it

  Background:
    Given I have a store named "detail-test-store" with status "Running"

  @smoke
  Scenario: View store details
    When I click on "detail-test-store" in the store list
    Then I see the store details page
    And I see the following sections:
      | Section          | Content                          |
      | Overview         | Store name, status, engine       |
      | URLs             | Storefront, Admin, API URLs      |
      | Resources        | CPU, Memory, Storage usage       |
      | Recent Activity  | Creation, updates, events        |
      | Quick Actions    | Open Store, Open Admin, Delete   |

  Scenario: Access store URLs
    When I click "Open Storefront"
    Then a new tab opens to the store URL
    And the storefront loads successfully
    
    When I return to the dashboard
    And I click "Open Admin"
    Then a new tab opens to the admin URL
    And the WordPress login page loads
```

### Concurrency Test Suite

#### Test Case: CONC-E2E-001 - Concurrent Store Creation

```gherkin
Feature: Concurrent Store Provisioning
  As a developer with multiple clients
  I want to create multiple stores simultaneously
  So that I can be efficient

  @performance
  Scenario: Create 3 stores concurrently
    Given the platform is running
    And no stores are currently being provisioned
    
    When I initiate creation of 3 stores:
      | Store Name | Engine      |
      | client-a   | woocommerce |
      | client-b   | woocommerce |
      | client-c   | woocommerce |
    Then all 3 stores show status "Pending"
    
    When I wait for 10 seconds
    Then I see progress indicators for all 3 stores
    And they show different progress percentages
    
    When I wait for up to 10 minutes
    Then all 3 stores show status "Running"
    And each store has a unique URL
    And each store is independently accessible
    And stores are isolated (data not shared)
```

## Automation Strategy

### Framework Selection

**Primary: Cypress**
- Excellent for web application testing
- Built-in waiting and retry mechanisms
- Screenshot and video recording on failure
- Easy CI/CD integration

**Alternative: Playwright**
- Cross-browser testing
- Better for complex scenarios
- Faster execution
- Native parallel execution

### Test Structure

```
e2e/
├── cypress/
│   ├── e2e/
│   │   ├── woocommerce/
│   │   │   ├── order-flow.cy.js
│   │   │   ├── product-management.cy.js
│   │   │   └── checkout.cy.js
│   │   ├── dashboard/
│   │   │   ├── store-creation.cy.js
│   │   │   ├── store-deletion.cy.js
│   │   │   ├── store-list.cy.js
│   │   │   └── store-details.cy.js
│   │   ├── lifecycle/
│   │   │   ├── concurrent-creation.cy.js
│   │   │   └── health-checks.cy.js
│   │   └── smoke/
│   │       └── platform-smoke.cy.js
│   ├── fixtures/
│   │   ├── stores.json
│   │   ├── products.json
│   │   └── credentials.json
│   ├── support/
│   │   ├── commands.js
│   │   ├── woocommerce.js
│   │   └── dashboard.js
│   └── config/
│       ├── cypress.local.config.js
│       ├── cypress.ci.config.js
│       └── cypress.prod.config.js
└── playwright/
    └── (alternative implementation)
```

### Cypress Configuration

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'https://dashboard.127.0.0.1.nip.io',
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 60000,
    execTimeout: 120000,
    taskTimeout: 120000,
    env: {
      apiUrl: process.env.CYPRESS_API_URL || 'https://api.127.0.0.1.nip.io',
      storeDomain: process.env.CYPRESS_STORE_DOMAIN || '127.0.0.1.nip.io',
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        // Custom tasks for kubectl operations
        kubectlCommand(command) {
          const { execSync } = require('child_process');
          return execSync(command).toString();
        },
      });
    },
  },
});
```

### Example Cypress Test

```javascript
// cypress/e2e/woocommerce/order-flow.cy.js

describe('WooCommerce Complete Order Flow', () => {
  const storeName = `test-store-${Date.now()}`;
  let adminPassword;

  before(() => {
    // Create store via API
    cy.createStore({
      name: storeName,
      engine: 'woocommerce',
      plan: 'basic',
    }).then((response) => {
      adminPassword = response.body.data.credentials.admin.password;
      // Wait for store to be ready
      cy.waitForStoreStatus(storeName, 'running', { timeout: 300000 });
    });
  });

  after(() => {
    // Cleanup
    cy.deleteStore(storeName);
  });

  it('should create a product and complete an order', () => {
    // Login to admin
    cy.visit(`https://${storeName}.127.0.0.1.nip.io/wp-admin`);
    cy.get('#user_login').type('admin');
    cy.get('#user_pass').type(adminPassword);
    cy.get('#wp-submit').click();
    cy.contains('Dashboard');

    // Create product
    cy.contains('Products').click();
    cy.contains('Add New').click();
    cy.get('#title').type('Test Product A');
    cy.get('#content').type('A test product for E2E validation');
    cy.get('#_regular_price').type('29.99');
    cy.get('#_sku').type('TEST-001');
    cy.get('#publish').click();
    cy.contains('Product published');

    // View product on storefront
    cy.contains('View Product').click();
    cy.contains('Test Product A');
    cy.contains('$29.99');

    // Add to cart
    cy.contains('Add to cart').click();
    cy.contains('has been added to your cart');

    // Checkout
    cy.contains('View cart').click();
    cy.contains('Proceed to checkout').click();

    // Fill checkout form
    cy.get('#billing_first_name').type('John');
    cy.get('#billing_last_name').type('Doe');
    cy.get('#billing_address_1').type('123 Test Street');
    cy.get('#billing_city').type('Test City');
    cy.get('#billing_postcode').type('90210');
    cy.get('#billing_phone').type('555-123-4567');
    cy.get('#billing_email').type('john.doe@test.com');

    // Select payment method
    cy.get('#payment_method_cod').check();
    cy.get('#terms').check();

    // Place order
    cy.get('#place_order').click();
    cy.contains('Order received');
    cy.get('.woocommerce-order-overview__order')
      .invoke('text')
      .then((orderNumber) => {
        // Verify order in admin
        cy.visit(`https://${storeName}.127.0.0.1.nip.io/wp-admin`);
        cy.contains('WooCommerce').click();
        cy.contains('Orders').click();
        cy.contains(orderNumber);

        // Complete order
        cy.contains(orderNumber).click();
        cy.get('#order_status')
          .select('wc-completed')
          .should('have.value', 'wc-completed');
        cy.contains('Update').click();
        cy.contains('Order updated');
      });
  });
});
```

### Custom Commands

```javascript
// cypress/support/commands.js

Cypress.Commands.add('createStore', (storeConfig) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/v1/stores`,
    body: storeConfig,
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('deleteStore', (storeName) => {
  return cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl')}/api/v1/stores/${storeName}`,
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('waitForStoreStatus', (storeName, expectedStatus, options = {}) => {
  const checkStatus = () => {
    return cy
      .request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/v1/stores/${storeName}`,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 200 && response.body.data.status === expectedStatus) {
          return cy.wrap(response);
        }
        // If failed status, fail immediately
        if (response.body.data.status === 'failed') {
          throw new Error(`Store ${storeName} failed to provision`);
        }
        // Retry
        cy.wait(5000);
        return checkStatus();
      });
  };

  return checkStatus();
});

Cypress.Commands.add('getStoreUrl', (storeName) => {
  return cy.request(`${Cypress.env('apiUrl')}/api/v1/stores/${storeName}`).then((response) => {
    return cy.wrap(response.body.data.urls.storefront);
  });
});
```

## Running Tests

### Local Development

```bash
# Start local cluster
k3d cluster create test-cluster --agents 1

# Deploy platform
helm install store-platform ./helm-charts/store-platform \
  -f ./helm-charts/store-platform/values-local.yaml \
  -n store-platform --create-namespace

# Wait for deployment
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=provisioner -n store-platform --timeout=300s

# Run E2E tests
cd e2e
npm install

# Run all tests
npx cypress run

# Run specific test
npx cypress run --spec "cypress/e2e/woocommerce/order-flow.cy.js"

# Open Cypress GUI
npx cypress open
```

### CI/CD Integration

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  workflow_dispatch:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create k3d cluster
        uses: AbsaOSS/k3d-action@v2
        with:
          cluster-name: e2e-test
          args: '--agents 1 --no-lb'

      - name: Deploy platform
        run: |
          helm install store-platform ./helm-charts/store-platform \
            -f ./helm-charts/store-platform/values-local.yaml \
            -n store-platform --create-namespace
          kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=provisioner -n store-platform --timeout=300s

      - name: Run Cypress tests
        uses: cypress-io/github-action@v6
        with:
          working-directory: e2e
          wait-on: 'https://dashboard.127.0.0.1.nip.io'
          wait-on-timeout: 120

      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: e2e/cypress/screenshots

      - name: Upload videos
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cypress-videos
          path: e2e/cypress/videos
```

## Test Data Management

### Fixtures

```json
// cypress/fixtures/stores.json
{
  "basicWooCommerce": {
    "name": "test-store-wc",
    "engine": "woocommerce",
    "plan": "basic",
    "description": "Test WooCommerce store"
  },
  "standardWooCommerce": {
    "name": "test-store-wc-std",
    "engine": "woocommerce",
    "plan": "standard",
    "description": "Standard WooCommerce store"
  }
}
```

```json
// cypress/fixtures/products.json
{
  "simpleProduct": {
    "name": "Test Product",
    "description": "A test product",
    "price": "29.99",
    "sku": "TEST-001",
    "stock": 100
  }
}
```

### Test Isolation

Each test should:
1. Create its own store (or use a unique namespace)
2. Clean up after completion
3. Use unique identifiers (timestamps, UUIDs)
4. Not depend on other tests

## Test Metrics

### Coverage Goals

- **Critical Path:** 100% (store creation, order flow, deletion)
- **Dashboard:** 80% (all UI interactions)
- **API:** 90% (all endpoints)
- **Edge Cases:** 60% (error handling, timeouts)

### Performance Benchmarks

- Store creation: < 5 minutes
- Store deletion: < 2 minutes
- Page load: < 3 seconds
- Order completion: < 2 minutes
- Concurrent stores: 5 simultaneous

### Success Criteria

All E2E tests must pass for:
- Release candidates
- Production deployments
- Major feature additions
- Infrastructure changes

## Troubleshooting

### Common Issues

1. **Tests fail intermittently**
   - Increase timeouts
   - Add more wait conditions
   - Check resource limits

2. **Store not ready in time**
   - Increase provisioning timeout
   - Check cluster resources
   - Review provisioner logs

3. **Flaky selectors**
   - Use data-testid attributes
   - Avoid text-based selectors for dynamic content
   - Use Cypress Testing Library

### Debugging

```javascript
// Add debug logging
cy.log('Creating store:', storeName);

// Pause for manual inspection
cy.pause();

// Take screenshot
cy.screenshot('before-checkout');

// Log element details
cy.get('#order-status').then(($el) => {
  cy.log('Status element:', $el.text());
});
```
