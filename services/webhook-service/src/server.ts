import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/github/webhook', (req: Request, res: Response) => {
  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}`);
});

