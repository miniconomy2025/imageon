import { Router, Request, Response } from 'express';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  getUserPosts,
  getUserFollowers,
  getUserFollowing,
  followUser,
  unfollowUser,
} from '../services/userService';

const router = Router();

// GET /profiles/:userId - Retrieve a user profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /profiles - Create a new user profile
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    await createUserProfile(payload);
    res.status(201).json({ message: 'Profile created' });
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /profiles/:userId - Update existing user profile
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    await updateUserProfile(userId, updates);
    res.json({ message: 'Profile updated' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /profiles/:userId/posts - List user's posts
router.get('/:userId/posts', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit, lastKey } = req.query;
    const result = await getUserPosts(
      userId,
      limit ? Number(limit) : undefined,
      lastKey ? JSON.parse(String(lastKey)) : undefined
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /profiles/:userId/followers - List user's followers
router.get('/:userId/followers', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await getUserFollowers(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /profiles/:userId/following - List users the user is following
router.get('/:userId/following', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await getUserFollowing(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching following list:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /profiles/:userId/follow/:targetId - Follow another user
router.post('/:userId/follow/:targetId', async (req: Request, res: Response) => {
  try {
    const { userId, targetId } = req.params;
    await followUser(userId, targetId);
    res.json({ message: `User ${userId} now follows ${targetId}` });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /profiles/:userId/unfollow/:targetId - Unfollow a user
router.delete('/:userId/unfollow/:targetId', async (req: Request, res: Response) => {
  try {
    const { userId, targetId } = req.params;
    await unfollowUser(userId, targetId);
    res.json({ message: `User ${userId} unfollowed ${targetId}` });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
