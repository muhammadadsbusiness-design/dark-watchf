import { neon } from '@neondatabase/serverless';
import { getConnectionString, cleanUrl, getActiveEnvVarName } from './db.js';

export { getConnectionString, cleanUrl, getActiveEnvVarName };

export function getSql() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Database connection string is not configured. POSTGRES_URL أو DATABASE_URL غير موجود في Environment Variables');
  }
  return neon(connectionString);
}

export const sql = function (strings: TemplateStringsArray, ...values: any[]) {
  const client = getSql();
  return client(strings, ...values);
};

(sql as any).query = function (text: string, params?: any[]) {
  const client = getSql();
  return (client as any).query(text, params);
};

export async function query(text: string, params: any[] = []) {
  const client = getSql();
  const rows = await (client as any).query(text, params);
  return { rows };
}

export default sql;
