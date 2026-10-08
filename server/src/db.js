import mongoose from 'mongoose';
import { config } from './config.js';

let isConnected = false;

export async function connectDB(uri = config.mongodbUri) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    console.error(`[DB] MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
