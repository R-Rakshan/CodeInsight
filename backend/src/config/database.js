const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client:', err.message);
  if (err.code) {
    console.error('[Database] Error code:', err.code);
  }
  console.error('[Database] Full error:', err);
  process.exit(-1);
});

const verifyConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected');
  } catch (err) {
    console.error('[Database] Connection failed:', err.message);
    if (err.code) {
      console.error('[Database] Error code:', err.code);
    }
    console.error('[Database] Verify DATABASE_URL is set correctly in .env');
    console.error('[Database] Full error:', err);
  }
};

verifyConnection();

const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
};
