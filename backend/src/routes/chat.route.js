import express from 'express';
import { getStreamToken, createCall, validateCall } from '../controllers/chat.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get("/token", protectRoute, getStreamToken);

// Secure video call routes
router.post("/call/:friendId", protectRoute, createCall);
router.get("/call/:callId/validate", protectRoute, validateCall);

export default router;