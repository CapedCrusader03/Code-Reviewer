import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}`);
});

