import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chess_db' });
async function check() {
  try {
    const { rows } = await pool.query('SELECT * FROM games ORDER BY created_at DESC LIMIT 5');
    console.log(rows);
  } catch(e) {
    console.error(e);
  }
  pool.end();
}
check();
