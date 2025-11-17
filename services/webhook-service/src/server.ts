import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Kafka } from 'kafkajs';

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'webhook-service',
  brokers: [KAFKA_BROKER]
});

const producer = kafka.producer();
let producerReady = false;

// Connect Kafka producer
producer.connect().then(() => {
  console.log('Kafka producer connected');
  producerReady = true;
}).catch(err => {
  console.error('Failed to connect Kafka producer:', err);
});

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

app.post('/github/webhook', verifyGitHubSignature, async (req: Request, res: Response) => {
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

  try {
    // Fetch PR diff from GitHub API
    const diffUrl = `https://api.github.com/repos/${repo}/pulls/${pr_number}`;
    const response = await axios.get(diffUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        'Authorization': GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : undefined,
        'User-Agent': 'AI-Code-Reviewer-Webhook'
      }
    });

    const diff = response.data;
    console.log(`Diff preview (first 200 chars): ${diff.substring(0, 200)}`);

    // Check if Kafka producer is ready
    if (!producerReady) {
      console.error('Kafka producer not ready');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    // Generate job ID and prepare Kafka message
    const job_id = crypto.randomUUID();
    const kafkaMessage = {
      job_id,
      repo,
      pr_number,
      commit_sha: head_sha,
      diff
    };

    // Publish to Kafka
    await producer.send({
      topic: 'code-review-requests',
      messages: [
        {
          key: job_id,
          value: JSON.stringify(kafkaMessage)
        }
      ]
    });

    console.log(`Published to Kafka: job_id=${job_id}`);

    res.status(202).json({ 
      received: true, 
      job_id,
      data: { 
        repo, 
        pr_number, 
        head_sha,
        diff_length: diff.length
      } 
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error.message);
    return res.status(500).json({ error: 'Failed to process webhook', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}`);
});

