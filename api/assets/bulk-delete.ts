import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });
  }

  const client = await pool.connect();

  try {
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid ids array' });
    }

    // Delete all specified assets
    const result = await client.query(
      'DELETE FROM assets WHERE id = ANY($1)',
      [ids]
    );

    return res.status(200).json({ 
      success: true, 
      deleted: result.rowCount 
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Delete failed' 
    });
  } finally {
    client.release();
  }
}
