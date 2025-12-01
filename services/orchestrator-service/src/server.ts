import express, { Request, Response } from 'express';
import cors from 'cors';
import { testConnection } from './db';
import reviewsRouter from './routes/reviews';
import { startKafkaConsumer, startStaticAnalysisConsumer } from './kafka-consumer';
import config from './config';
import { register } from './metrics';

const app = express();
const PORT = config.port;

// CORS configuration - allow requests from dashboard
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error: any) {
    res.status(500).end(error.message);
  }
});

// Routes
app.use('/internal/reviews', reviewsRouter);

// Initialize database connection and Kafka consumer before starting server
async function startServer() {
  try {
    await testConnection();
    console.log('Starting Kafka consumers...');
    await startKafkaConsumer();
    console.log('Code review consumer started');
    
    try {
      await startStaticAnalysisConsumer();
      console.log('Static analysis consumer started');
    } catch (staticError: any) {
      console.error('Failed to start static analysis consumer:', staticError.message);
      console.error('Stack:', staticError.stack);
      throw staticError;
    }
    
    console.log('All Kafka consumers started successfully');
    
    app.listen(PORT, () => {
      console.log(`Orchestrator service listening on port ${PORT}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n✗ Port ${PORT} is already in use!`);
        console.error('Please either:');
        console.error(`  1. Kill the process using port ${PORT}:`);
        console.error(`     powershell -ExecutionPolicy Bypass -File kill-port.ps1`);
        console.error(`  2. Or use a different port: PORT=5001 npm start`);
        console.error('');
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  } catch (error: any) {
    console.error('Failed to start server:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

startServer();

