import mysql from 'mysql2/promise';
import { env } from '@/env.mjs';

const dbConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD.trim(), // Ensure password is trimmed
  database: env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT || 10,
  queueLimit: 0,
  ssl: env.DB_SSL_ENABLED
    ? { 
        rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== false,
        // ca: process.env.DB_SSL_CA ? Buffer.from(process.env.DB_SSL_CA, 'base64').toString('ascii') : undefined,
        // key: process.env.DB_SSL_KEY ? Buffer.from(process.env.DB_SSL_KEY, 'base64').toString('ascii') : undefined,
        // cert: process.env.DB_SSL_CERT ? Buffer.from(process.env.DB_SSL_CERT, 'base64').toString('ascii') : undefined,
      }
    : undefined,
  // timezone: 'Z', // Example: UTC
};

// Log DB config details, masking password
const loggableDbConfig = { ...dbConfig, password: dbConfig.password ? '********' : 'Not Set' };

let pool: mysql.Pool;
try {
  pool = mysql.createPool(dbConfig);
} catch (error) {
  console.error("Failed to create database connection pool:", error);
  throw error;
}


pool.on('error', (err) => {
  console.error("Database pool error:", err);
  // Potentially handle reconnection or logging to a monitoring service
});

// Test connection function
export const testConnection = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    return true;
  } catch (error: any) {
    console.error("Database connection test failed:", error);
    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const db = pool;
export default db;
