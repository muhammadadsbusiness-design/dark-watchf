import { testPostgresConnection, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const testResult = await testPostgresConnection();
    return res.status(200).json(testResult);
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error('Error in test-db handler:', safeError);
    return res.status(200).json({
      connected: false,
      error: safeError,
      message: `فشل فحص اتصال قاعدة البيانات: ${safeError}`,
      testedAt: new Date().toISOString()
    });
  }
}
