import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

interface CreateReviewRequest {
  job_id: string;
  repo: string;
  pr_number: number;
  commit_sha: string;
  diff: string;
}

interface ReviewListItem {
  id: number;
  repo: string;
  pr_number: number;
  status: string;
  quality_score: number | null;
  created_at: Date;
}

// GET /internal/reviews - Get list of all reviews
router.get('/', async (req: Request, res: Response) => {
  try {
    const reviews = await db('reviews')
      .select('id', 'repo', 'pr_number', 'status', 'quality_score', 'created_at')
      .orderBy('created_at', 'desc');

    const reviewsList: ReviewListItem[] = reviews.map(review => ({
      id: review.id,
      repo: review.repo,
      pr_number: review.pr_number,
      status: review.status,
      quality_score: review.quality_score,
      created_at: review.created_at
    }));

    res.status(200).json(reviewsList);
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews', details: error.message });
  }
});

// POST /internal/reviews - Create a new review job
router.post('/', async (req: Request, res: Response) => {
  try {
    const { job_id, repo, pr_number, commit_sha, diff }: CreateReviewRequest = req.body;

    // Validate required fields
    if (!job_id || !repo || !pr_number || !commit_sha || !diff) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert review record
    const [review_id] = await db('reviews').insert({
      job_id,
      repo,
      pr_number,
      commit_sha,
      status: 'pending',
      created_at: db.fn.now()
    });

    console.log(`Created review: ${review_id} for job: ${job_id}`);

    res.status(201).json({ review_id });
  } catch (error: any) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review', details: error.message });
  }
});

export default router;

