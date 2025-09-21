import express from 'express';
import { getMyProfile, putMyProfile, changeMyPassword } from '../controller/profileController.js';
import * as Auth from '../middlewares/auth.js'


const router = express.Router();

router.get('/me/profile',Auth.verifyToken,getMyProfile);
router.put('/me/profile',Auth.verifyToken, putMyProfile);
router.put('/me/password',Auth.verifyToken, changeMyPassword);

export default router;
