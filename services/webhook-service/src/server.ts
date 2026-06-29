import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Kafka } from 'kafkajs';
import config from './config';
import { calculateUserDiscount } from './buggy-util';

const app = express();
const PORT = config.port;
const WEBHOOK_SECRET = config.webhookSecret;
const GITHUB_TOKEN = config.githubToken;
const KAFKA_BROKER = config.kafkaBroker;

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
  
  // Debug: Log payload keys to see what's available
  console.log('Payload keys:', Object.keys(payload));
  console.log('Has diff in payload?', !!payload.diff);
  
  // Extract required fields
  const repo = payload.repository?.full_name;
  const pr_number = payload.pull_request?.number;
  const head_sha = payload.pull_request?.head?.sha;

  // Reference the buggy utility code
  if (pr_number === 99999) {
    calculateUserDiscount(req, 'GOLD');
  }

  if (!repo || !pr_number || !head_sha) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Log extracted data
  const extractedData = { repo, pr_number, head_sha };
  console.log(JSON.stringify(extractedData));

  try {
    // Check if diff is provided in payload (for testing)
    let diff: string;
    
    // Check for diff in payload (for testing/smoke tests)
    if (payload.diff && typeof payload.diff === 'string') {
      diff = payload.diff;
      console.log('Using diff from payload (test mode)');
      console.log(`Diff length: ${diff.length} chars`);
    } else {
      // Fetch PR diff from GitHub API
      console.log(`Fetching diff from GitHub API for ${repo}#${pr_number}`);
      const diffUrl = `https://api.github.com/repos/${repo}/pulls/${pr_number}`;
      try {
        const response = await axios.get(diffUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3.diff',
            'Authorization': GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : undefined,
            'User-Agent': 'AI-Code-Reviewer-Webhook'
          }
        });
        diff = response.data;
        
        // Check if diff contains binary file markers
        const hasBinaryMarker = /Binary files .* differ/.test(diff);
        if (hasBinaryMarker) {
          console.log('Diff contains binary file markers, fetching file contents...');
          console.log(`GITHUB_TOKEN is ${GITHUB_TOKEN ? 'set' : 'NOT set'}`);
          
          if (!GITHUB_TOKEN) {
            console.error('⚠️ GITHUB_TOKEN not set! Cannot fetch file contents. Set it with: $env:GITHUB_TOKEN="your-token"');
            // Continue with original diff - it's better than nothing
          } else {
            try {
              // Fetch PR files to get list of changed files
              const filesUrl = `https://api.github.com/repos/${repo}/pulls/${pr_number}/files`;
              const filesResponse = await axios.get(filesUrl, {
                headers: {
                  'Accept': 'application/vnd.github.v3+json',
                  'Authorization': `Bearer ${GITHUB_TOKEN}`,
                  'User-Agent': 'AI-Code-Reviewer-Webhook'
                }
              });
              
              const files = filesResponse.data;
              const baseSha = payload.pull_request?.base?.sha;
              const headSha = payload.pull_request?.head?.sha;
              
              // Reconstruct diff with actual file contents
              const diffParts: string[] = [];
              
              for (const file of files) {
                // Skip removed files
                if (file.status === 'removed') {
                  console.log(`Skipping removed file: ${file.filename}`);
                  continue;
                }
                
                // Skip binary files
                if (file.binary) {
                  console.log(`Skipping binary file: ${file.filename}`);
                  continue;
                }
                
                console.log(`Processing file: ${file.filename} (status: ${file.status}, binary: ${file.binary})`);
                
                // Use patch if available (works for both new and modified files)
                if (file.patch) {
                  console.log(`Using patch for ${file.filename} (${file.patch.length} chars)`);
                  // Add diff header
                  diffParts.push(`diff --git a/${file.filename} b/${file.filename}`);
                  if (file.status === 'added') {
                    diffParts.push(`new file mode 100644`);
                  }
                  diffParts.push(file.patch);
                } else if (file.status === 'added' || file.status === 'renamed') {
                  // For new/renamed files without patch, fetch content
                  console.log(`Fetching content for ${file.filename} (no patch available)`);
                  try {
                    const contentUrl = `https://api.github.com/repos/${repo}/contents/${file.filename}?ref=${headSha}`;
                    console.log(`Fetching from: ${contentUrl}`);
                    const contentResponse = await axios.get(contentUrl, {
                      headers: {
                        'Accept': 'application/vnd.github.v3.raw',
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'User-Agent': 'AI-Code-Reviewer-Webhook'
                      }
                    });
                    
                    const fileContent = typeof contentResponse.data === 'string' 
                      ? contentResponse.data 
                      : Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');
                    
                    console.log(`Fetched ${fileContent.length} chars for ${file.filename}`);
                    
                    // Create a proper diff for new file
                    diffParts.push(`diff --git a/${file.filename} b/${file.filename}`);
                    diffParts.push(`new file mode 100644`);
                    diffParts.push(`index 0000000..${headSha.substring(0, 7)}`);
                    diffParts.push(`--- /dev/null`);
                    diffParts.push(`+++ b/${file.filename}`);
                    
                    // Add file content with + prefix
                    const lines = fileContent.split('\n');
                    for (const line of lines) {
                      diffParts.push(`+${line}`);
                    }
                    console.log(`Added ${lines.length} lines to diff for ${file.filename}`);
                  } catch (contentError: any) {
                    console.error(`Failed to fetch content for ${file.filename}: ${contentError.message}`);
                    if (contentError.response) {
                      console.error(`GitHub API returned ${contentError.response.status}: ${JSON.stringify(contentError.response.data)}`);
                    }
                  }
                } else if (file.status === 'modified') {
                  console.log(`Modified file ${file.filename} has no patch, using original diff`);
                  // Try to extract from original diff
                  const originalDiffLines = diff.split('\n');
                  let inFile = false;
                  const fileDiffLines: string[] = [];
                  
                  for (const line of originalDiffLines) {
                    if (line.includes(`diff --git`) && line.includes(file.filename)) {
                      inFile = true;
                      fileDiffLines.push(line);
                    } else if (inFile && line.startsWith('diff --git')) {
                      break; // Next file
                    } else if (inFile) {
                      fileDiffLines.push(line);
                    }
                  }
                  
                  if (fileDiffLines.length > 0) {
                    diffParts.push(...fileDiffLines);
                  }
                }
              }
              
              if (diffParts.length > 0) {
                diff = diffParts.join('\n');
                console.log(`Reconstructed diff with file contents (${diff.length} chars)`);
              } else {
                console.warn('Could not reconstruct diff, using original');
              }
            } catch (filesError: any) {
              console.error(`Failed to fetch PR files: ${filesError.message}`);
              if (filesError.response) {
                console.error(`GitHub API returned ${filesError.response.status}: ${JSON.stringify(filesError.response.data)}`);
              }
              // Continue with original diff
            }
          }
        }
      } catch (axiosError: any) {
        console.error('Failed to fetch diff from GitHub:', axiosError.message);
        if (axiosError.response) {
          console.error(`GitHub API returned ${axiosError.response.status}: ${axiosError.response.statusText}`);
        }
        throw axiosError;
      }
    }
    
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
    if (error.response) {
      console.error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to process webhook', 
      details: error.response ? `Request failed with status code ${error.response.status}` : error.message 
    });
  }
});

// Listen on all interfaces to allow ngrok access
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook service listening on port ${PORT}`);
  console.log(`Accessible at http://localhost:${PORT} and via ngrok`);
});

// Handle server errors
server.on('error', (err: any) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

