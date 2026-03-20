import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import type { Asset, GenerationRequest } from '../src/types/index.js';

// Neon connection pool for serverless
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      const { rows } = await client.query(
        'SELECT id, type, prompt, status, blob_url, width, height, duration, created_at, updated_at FROM assets ORDER BY created_at DESC'
      );
      
      const assets: Asset[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        prompt: row.prompt,
        status: row.status,
        url: row.blob_url,
        createdAt: row.created_at,
        width: row.width,
        height: row.height,
        duration: row.duration,
      }));
      
      return res.status(200).json({ assets });
    }

    if (req.method === 'POST') {
      const { prompt, type, width, height, duration } = req.body as GenerationRequest;

      if (!prompt || !type) {
        return res.status(400).json({ error: 'Missing prompt or type' });
      }

      const { rows } = await client.query(
        `INSERT INTO assets (type, prompt, status, width, height, duration)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, type, prompt, status, width, height, duration, created_at`,
        [type, prompt, 'generating', width, height, duration]
      );

      const row = rows[0];
      const asset: Asset = {
        id: row.id,
        type: row.type,
        prompt: row.prompt,
        status: row.status,
        createdAt: row.created_at,
        width: row.width,
        height: row.height,
        duration: row.duration,
      };

      return res.status(201).json(asset);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing id' });
      }

      // Get blob info before deleting
      const { rows } = await client.query(
        'SELECT blob_pathname FROM assets WHERE id = $1',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Delete from database
      await client.query('DELETE FROM assets WHERE id = $1', [id]);

      // Note: Blob deletion would happen here if we wanted to clean up storage
      // Skipping for now - can add Vercel Blob deletion later

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Database error' 
    });
  } finally {
    client.release();
  }
}
