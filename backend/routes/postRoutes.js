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

const router = express.Router();

// Public routes
router.get('/', getAllPosts);
router.get('/user/:userId', getUserPosts);

// Protected routes
router.post('/', protect, createPost);
router.post('/:postId/like', protect, likePost);
router.post('/:postId/comment', protect, addComment);
router.delete('/:postId', protect, deletePost);

module.exports = router;
