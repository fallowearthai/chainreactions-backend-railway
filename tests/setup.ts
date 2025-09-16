// Test setup file
import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config();

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console.log to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};