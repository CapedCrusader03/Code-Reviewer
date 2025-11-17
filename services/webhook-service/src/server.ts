import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';

// Capture raw body for signature verification
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// HMAC signature verification middleware
const verifyGitHubSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    return res.status(401).json({ error: 'No signature provided' });
  }

  const body = (req as any).rawBody || JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Check length first to avoid timingSafeEqual error
  if (signature.length !== expectedSignature.length) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/github/webhook', verifyGitHubSignature, (req: Request, res: Response) => {
  const event = req.headers['x-github-event'] as string;

  // Only process pull_request events
  if (event !== 'pull_request') {
    return res.status(200).json({ received: true, message: 'Event ignored' });
  }

  const payload = req.body;
  
  // Extract required fields
  const repo = payload.repository?.full_name;
  const pr_number = payload.pull_request?.number;
  const head_sha = payload.pull_request?.head?.sha;

  if (!repo || !pr_number || !head_sha) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Log extracted data
  const extractedData = { repo, pr_number, head_sha };
  console.log(JSON.stringify(extractedData));

  res.status(202).json({ received: true, data: extractedData });
});

app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}`);
});

