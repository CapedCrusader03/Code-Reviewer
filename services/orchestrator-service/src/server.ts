import express, { Request, Response } from 'express';
import { testConnection } from './db';
import reviewsRouter from './routes/reviews';
import { startKafkaConsumer } from './kafka-consumer';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/internal/reviews', reviewsRouter);

// Initialize database connection and Kafka consumer before starting server
async function startServer() {
  try {
    await testConnection();
    await startKafkaConsumer();
    
    app.listen(PORT, () => {
      console.log(`Orchestrator service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

