# Store Provisioning Platform - E2E Tests

This directory contains end-to-end tests for the Store Provisioning Platform using Cypress.

## 📁 Directory Structure

```
e2e/tests/
├── cypress/
│   ├── e2e/                    # Test files
│   │   ├── store-creation.cy.ts
│   │   ├── woocommerce-order-flow.cy.ts
│   │   ├── store-deletion.cy.ts
│   │   └── full-e2e-journey.cy.ts
│   ├── fixtures/               # Test data
│   │   └── test-data.json
│   └── support/                # Support files
│       ├── commands.ts         # Custom Cypress commands
│       └── e2e.ts             # Global configuration
├── cypress.config.ts           # Cypress configuration
├── package.json
├── tsconfig.json
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (http://localhost:8080)
- Frontend dashboard running (http://localhost:5173)
- Kubernetes cluster with stores accessible

### Installation

```bash
cd e2e/tests
npm install
```

### Run Tests

```bash
# Run all tests headlessly
npm test

# Run with headed browser (for debugging)
npm run test:headed

# Run in specific browser
npm run test:chrome
npm run test:firefox

# Open Cypress Test Runner
npm run open
```

## 🔧 Environment Variables

The tests use the following environment variables (with defaults):

- `CYPRESS_BASE_URL` - Dashboard URL (default: http://localhost:5173)
- `CYPRESS_API_URL` - API URL (default: http://localhost:8080)
- `CYPRESS_STORE_DOMAIN` - Store domain suffix (default: 127.0.0.1.nip.io)

### Example with custom environment:

```bash
CYPRESS_BASE_URL=http://my-dashboard.com \
CYPRESS_API_URL=http://my-api.com \
npm test
```

## 📝 Test Files

### store-creation.cy.ts
Tests store creation functionality:
- Create store via API
- Wait for provisioning
- Verify dashboard updates
- Validate error handling

### woocommerce-order-flow.cy.ts
Tests WooCommerce e-commerce flow:
- Navigate to store
- Add products to cart
- Complete checkout process
- Handle cart operations

### store-deletion.cy.ts
Tests store cleanup:
- Delete store via API
- Verify dashboard updates
- Handle non-existent stores
- Bulk cleanup of test stores

### full-e2e-journey.cy.ts
Complete user journey test:
- Dashboard navigation
- Store creation
- Order placement
- Store deletion

## 🛠️ Custom Commands

### API Commands
- `cy.createStore({ name, engine, plan })` - Create a new store
- `cy.deleteStore(storeId)` - Delete a store
- `cy.waitForStoreReady(storeId, timeout)` - Wait for store provisioning
- `cy.getStore(storeId)` - Get store details

### WooCommerce Commands
- `cy.visitStore(storeName)` - Navigate to store frontend
- `cy.addToCart(productName)` - Add product to cart
- `cy.completeCheckout(customerData)` - Complete checkout flow

## 📊 Test Data

Test data is stored in `cypress/fixtures/test-data.json`:
- Store configuration
- Customer data
- Product information
- WordPress credentials

## 🔍 Debugging

### View Screenshots & Videos

Cypress automatically captures:
- Screenshots on test failure (`cypress/screenshots/`)
- Videos of test runs (`cypress/videos/`)

### Headed Mode

Run tests in headed mode to see the browser:

```bash
npm run test:headed
```

### Cypress Test Runner

Open the interactive Test Runner:

```bash
npm run open
```

## 🔄 CI/CD Integration

The E2E tests are integrated into the CI/CD pipeline via GitHub Actions:

1. Tests run after successful Docker image builds
2. Tests execute in a k3d Kubernetes cluster
3. Screenshots and videos are uploaded as artifacts on failure
4. Test results are preserved for 7 days

### Manual CI Trigger

To run E2E tests manually in CI:

```bash
git commit --allow-empty -m "trigger e2e tests"
git push
```

## 🐛 Troubleshooting

### Common Issues

**Tests failing due to timeouts:**
- Store provisioning takes 3-5 minutes
- Increase timeout in `cypress.config.ts`

**API connection errors:**
- Verify backend is running on port 8080
- Check `CYPRESS_API_URL` environment variable

**WooCommerce tests failing:**
- Ensure stores are fully provisioned before running
- Check that stores are accessible via HTTPS

### Getting Help

1. Check test output for specific error messages
2. Review screenshots in `cypress/screenshots/`
3. Watch test execution in headed mode
4. Check API logs for backend errors

## 🎯 Best Practices

1. **Use unique names**: Tests generate unique store names with timestamps
2. **Clean up**: Tests automatically clean up created stores
3. **Wait for readiness**: Always wait for stores to be ready before testing
4. **Test isolation**: Each test creates its own store to avoid conflicts

## 📈 Future Improvements

- [ ] Add visual regression tests
- [ ] Implement parallel test execution
- [ ] Add more WooCommerce scenarios (coupons, shipping, etc.)
- [ ] Create test data factories
- [ ] Add API contract tests
