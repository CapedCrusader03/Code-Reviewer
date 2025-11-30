import knex, { Knex } from 'knex';
import config from './config';

const knexConfig: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database
  },
  pool: {
    min: 2,
    max: 10
  }
};

const db = knex(knexConfig);

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

