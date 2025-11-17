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

