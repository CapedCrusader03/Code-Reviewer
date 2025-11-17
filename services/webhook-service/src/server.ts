import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';

app.use(express.json());

// HMAC signature verification middleware
const verifyGitHubSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    return res.status(401).json({ error: 'No signature provided' });
  }

  const body = JSON.stringify(req.body);
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
  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}`);
});

