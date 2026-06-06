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

function makeCaseInsensitive(row: any) {
  if (!row || typeof row !== 'object') return row;
  return new Proxy(row, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        if (prop in target) return Reflect.get(target, prop, receiver);
        const lowerProp = prop.toLowerCase();
        if (lowerProp in target) return Reflect.get(target, lowerProp, receiver);
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

export async function openDb() {
  return {
    async run(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      const row = makeCaseInsensitive(res.rows[0]);
      return { lastID: row?.CaseID || row?.id || row?.UserID, changes: res.rowCount };
    },
    async all(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      return res.rows.map(makeCaseInsensitive);
    },
    async get(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      return makeCaseInsensitive(res.rows[0]);
    },
    async exec(sql: string) {
      return pool.query(sql);
    }
  };
}

