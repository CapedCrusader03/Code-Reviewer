import express, { Request, Response } from 'express';
import { testConnection } from './db';
import reviewsRouter from './routes/reviews';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/internal/reviews', reviewsRouter);

// Initialize database connection before starting server
testConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Orchestrator service listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

