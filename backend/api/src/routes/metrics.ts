import { Router } from 'express';
import { register } from '../utils/metrics';

const router = Router();

// Prometheus metrics endpoint
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

export default router;
