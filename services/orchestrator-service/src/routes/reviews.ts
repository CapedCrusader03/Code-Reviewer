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

// GET /internal/reviews/:id - Get a single review with findings
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    // Get review
    const review = await db('reviews')
      .where({ id: reviewId })
      .first();

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Get findings for this review
    const findings = await db('findings')
      .where({ review_id: reviewId })
      .orderBy('severity', 'desc')
      .orderBy('created_at', 'desc');

    // Parse static_metrics if it exists (might contain uml_s3_url)
    let uml_s3_url: string | null = null;
    if (review.static_metrics) {
      try {
        const staticMetrics = typeof review.static_metrics === 'string' 
          ? JSON.parse(review.static_metrics) 
          : review.static_metrics;
        uml_s3_url = staticMetrics.uml_s3_url || null;
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Return review with findings
    res.status(200).json({
      id: review.id,
      job_id: review.job_id,
      repo: review.repo,
      pr_number: review.pr_number,
      commit_sha: review.commit_sha,
      status: review.status,
      quality_score: review.quality_score,
      uml_s3_url: uml_s3_url,
      github_comment_id: review.github_comment_id,
      created_at: review.created_at,
      completed_at: review.completed_at,
      findings: findings.map(f => ({
        id: f.id,
        type: f.type,
        severity: f.severity,
        file_path: f.file_path,
        line_number: f.line_number,
        message: f.message,
        suggestion: f.suggestion,
        created_at: f.created_at
      }))
    });
  } catch (error: any) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: 'Failed to fetch review', details: error.message });
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

