import { afterAll } from 'vitest';
import { closeDb } from './helpers.js';

process.env.NODE_ENV = 'test';
afterAll(closeDb);
