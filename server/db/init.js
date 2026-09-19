import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initSchema() {
  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Applying database schema from schema.sql...');
    await client.query(sql);
    console.log('Schema successfully initialized with pgvector and all 14 tables.');
  } catch (err) {
    console.error('Error applying schema:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initSchema().catch(() => process.exit(1));
