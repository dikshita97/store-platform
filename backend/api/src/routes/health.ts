import { Router } from 'express';
import prisma from '../utils/prisma';
import helmService from '../services/HelmService';

const router = Router();

/**
 * GET /health/live - Liveness probe
 */
router.get('/live', async (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * GET /health/ready - Readiness probe
 */
router.get('/ready', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Helm is available
    const helmAvailable = await helmService.isHelmAvailable();

    if (!helmAvailable) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'Helm not available',
      });
    }

    res.status(200).json({
      status: 'ok',
      checks: {
        database: 'connected',
        helm: 'available',
      },
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'not ready',
      reason: error.message,
    });
  }
});

export default router;
