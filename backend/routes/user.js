import express from 'express'
import * as UserController from '../controller/userController.js'
import validate from '../middlewares/validate.js';
import * as AuthMiddleware from '../middlewares/auth.js'
import { body, param } from 'express-validator';



const router = express.Router()


router.get('/', UserController.getUsers);
router.post('/login',UserController.login);
router.post('/',
    [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').notEmpty().withMessage('Role is required')
    .isIn(['admin', 'surveyor']).withMessage('Role must be either admin or surveyor')
    ],
    validate,
    AuthMiddleware.verifyToken,
    AuthMiddleware.requireRole('admin'),
    UserController.registerSurveyor
);


// Update user
router.put('/:id',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireRole('admin'),
  [
    param('id').isInt().withMessage('id must be an integer'),
    // optional fields:
    body('name').optional().isLength({ min: 1 }).withMessage('name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['admin', 'surveyor']).withMessage('Role must be either admin or surveyor')
  ],
  validate,
  UserController.updateUser
);

// Delete user
router.delete('/:id',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireRole('admin'),
  [ param('id').isInt().withMessage('id must be an integer') ],
  validate,
  UserController.deleteUser
);


router.post('/auth/forgot-password', UserController.forgotPassword);
router.post('/auth/reset-password', UserController.resetPassword);




export default router;