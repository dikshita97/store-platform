import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import storeService from '../services/StoreService';
import logger from '../utils/logger';

const router = Router();

// Validation middleware
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }
  next();
};

/**
 * GET /api/v1/stores - List all stores
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const engine = req.query.engine as string | undefined;

    const result = await storeService.list({ page, limit, status, engine });

    res.json({
      success: true,
      data: {
        stores: result.stores.map(storeService.toResponse),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to list stores', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list stores',
      },
    });
  }
});

/**
 * POST /api/v1/stores - Create a new store
 */
router.post(
  '/',
  [
    body('name')
      .isString()
      .trim()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Name must be 3-50 characters, lowercase alphanumeric and hyphens only'),
    body('displayName').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('engine')
      .isString()
      .isIn(['woocommerce', 'medusa'])
      .withMessage('Engine must be woocommerce or medusa'),
    body('plan')
      .optional()
      .isString()
      .isIn(['basic', 'standard', 'premium'])
      .withMessage('Plan must be basic, standard, or premium'),
    validate,
  ],
  async (req, res) => {
    try {
      const store = await storeService.create(req.body, req.user?.id);

      res.status(202).json({
        success: true,
        data: {
          store: storeService.toResponse(store),
          message: 'Store creation started',
        },
      });
    } catch (error: any) {
      logger.error('Failed to create store', { error: error.message });
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create store',
        },
      });
    }
  }
);

/**
 * GET /api/v1/stores/:id - Get store by ID
 */
router.get(
  '/:id',
  [param('id').isUUID(), validate],
  async (req, res) => {
    try {
      const store = await storeService.getById(req.params.id);

      if (!store) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Store not found',
          },
        });
      }

      res.json({
        success: true,
        data: storeService.toResponse(store),
      });
    } catch (error: any) {
      logger.error('Failed to get store', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get store',
        },
      });
    }
  }
);

/**
 * DELETE /api/v1/stores/:id - Delete a store
 */
router.delete(
  '/:id',
  [param('id').isUUID(), validate],
  async (req, res) => {
    try {
      await storeService.delete(req.params.id);

      res.json({
        success: true,
        data: {
          message: 'Store deletion started',
        },
      });
    } catch (error: any) {
      logger.error('Failed to delete store', { error: error.message });

      if (error.message === 'Store not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      if (error.message === 'Store is already being deleted') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete store',
        },
      });
    }
  }
);

export default router;
