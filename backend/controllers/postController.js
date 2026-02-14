const Post = require('../models/Post');
const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

exports.getAllPosts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const posts = await Post.find({ visibility: 'public', isActive: true })
      .populate('userId', 'name profile.displayName media.profilePicture')
      .populate('matchId', 'matchName matchDate')
      .populate('comments.userId', 'name media.profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments({ visibility: 'public', isActive: true });

    return res.json({
      success: true,
      count: posts.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      posts
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch posts', error);
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const posts = await Post.find({ userId, isActive: true })
      .populate('userId', 'name profile.displayName media.profilePicture')
      .populate('matchId', 'matchName matchDate')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: posts.length,
      posts
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch user posts', error);
  }
};

exports.createPost = async (req, res) => {
  try {
    const { content, matchId, tournamentId, type, media } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Post content is required'
      });
    }

    const post = await Post.create({
      userId: req.user._id,
      content,
      matchId,
      tournamentId,
      type: type || 'text',
      media
    });

    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'name profile.displayName media.profilePicture');

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: populatedPost
    });
  } catch (error) {
    return sendServerError(res, 'Failed to create post', error);
  }
};

exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const alreadyLiked = post.likes.some((id) => id.toString() === req.user._id.toString());

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    return res.json({
      success: true,
      message: alreadyLiked ? 'Post unliked' : 'Post liked',
      likes: post.likes.length
    });
  } catch (error) {
    return sendServerError(res, 'Failed to like post', error);
  }
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    post.comments.push({
      userId: req.user._id,
      text,
      timestamp: new Date()
    });

    await post.save();

    const updatedPost = await Post.findById(postId)
      .populate('comments.userId', 'name media.profilePicture');

    return res.json({
      success: true,
      message: 'Comment added successfully',
      comments: updatedPost.comments
    });
  } catch (error) {
    return sendServerError(res, 'Failed to add comment', error);
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    post.isActive = false;
    await post.save();

    return res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    return sendServerError(res, 'Failed to delete post', error);
  }
};
