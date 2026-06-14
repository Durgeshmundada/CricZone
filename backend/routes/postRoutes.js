// backend/routes/postRoutes.js
const express = require('express');
const {
  getAllPosts,
  getUserPosts,
  createPost,
  likePost,
  addComment,
  deletePost
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const schemas = require('../validation/schemas');

const router = express.Router();

// Public routes
router.get('/', getAllPosts);
router.get('/user/:userId', getUserPosts);

// Protected routes
router.post('/', protect, validate(schemas.createPost), createPost);
router.post('/:postId/like', protect, validate(schemas.postIdParam), likePost);
router.post('/:postId/comment', protect, validate(schemas.addComment), addComment);
router.delete('/:postId', protect, validate(schemas.postIdParam), deletePost);

module.exports = router;
