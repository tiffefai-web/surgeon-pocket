import { Pool } from 'pg';

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL || process.env.DATABASE_URL) || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

function convertSql(sql: string, params: any[]) {
  // Very simple parameter conversion from ? to $1, $2
  let counter = 1;
  const text = sql.replace(/\?/g, () => `$${counter++}`);
  return { text, values: params };
}

export async function openDb() {
  return {
    async run(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      // For Postgres, if you need the inserted ID, use RETURNING * in the query
      // and it will be available in res.rows[0]
      return { lastID: res.rows[0]?.CaseID || res.rows[0]?.id || res.rows[0]?.UserID, changes: res.rowCount };
    },
    async all(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      return res.rows;
    },
    async get(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      return res.rows[0];
    },
    async exec(sql: string) {
      return pool.query(sql);
    }
  };
}

