import express from 'express';
import { getAiStatus } from '../services/aiProvider.js';

const router = express.Router();

router.get('/ai/status', (req, res) => {
  const status = getAiStatus();
  res.json(status);
});

export default router;
