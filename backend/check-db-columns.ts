import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgres://postgres:admin@localhost:5432/testnest',
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'games'
      ORDER BY ordinal_position
    `);
    console.log('=== Actual columns in games table ===');
    for (const row of result.rows) {
      console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(15)} nullable=${row.is_nullable} default=${row.column_default}`);
    }

    // Also check if there are any games stored
    const count = await pool.query('SELECT COUNT(*) FROM games');
    console.log(`\nTotal games in DB: ${count.rows[0].count}`);
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

main();
