require('dotenv').config({ path: '.env.local' });
if (!process.env.POSTGRES_URL) require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

async function seed() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const surgeonPassword = await bcrypt.hash('surgeon123', 10);

  const client = await pool.connect();
  try {
    const q = `INSERT INTO Users (Username, PasswordHash, Role) VALUES ($1, $2, $3) ON CONFLICT (Username) DO NOTHING`;
    
    await client.query(q, ['admin', adminPassword, 'Admin']);
    console.log('Admin user created/exists. Username: admin, Password: admin123');

    await client.query(q, ['surgeon', surgeonPassword, 'Surgeon']);
    console.log('Surgeon user created/exists. Username: surgeon, Password: surgeon123');

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
