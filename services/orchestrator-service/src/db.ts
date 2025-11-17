import knex, { Knex } from 'knex';

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3308'),
    user: process.env.DB_USER || 'reviewer',
    password: process.env.DB_PASSWORD || 'reviewerpass',
    database: process.env.DB_NAME || 'code_reviewer'
  },
  pool: {
    min: 2,
    max: 10
  }
};

const db = knex(config);

// Test connection
export async function testConnection(): Promise<void> {
  try {
    await db.raw('SELECT 1');
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export default db;

