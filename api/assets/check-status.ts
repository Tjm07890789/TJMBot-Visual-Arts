import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

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
    const { assetId } = req.body as { assetId: string };

    if (!assetId) {
      return res.status(400).json({ error: 'Missing assetId' });
    }

    // Get the asset and its prediction ID
    const { rows } = await client.query(
      'SELECT id, type, replicate_prediction_id, status FROM assets WHERE id = $1',
      [assetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const asset = rows[0];

    if (!asset.replicate_prediction_id) {
      return res.status(400).json({ error: 'No prediction ID for this asset' });
    }

    if (asset.status !== 'generating') {
      return res.status(200).json({ 
        status: asset.status,
        message: 'Asset is not in generating state'
      });
    }

    // Poll Replicate for status
    const replicateResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${asset.replicate_prediction_id}`,
      {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      throw new Error(`Replicate API error: ${errorText}`);
    }

    const prediction = await replicateResponse.json();

    // If completed, process the result
    if (prediction.status === 'succeeded' && prediction.output) {
      const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      
      // Fetch the file
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch generated image');
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const pathname = `assets/${asset.type}/${asset.id}.png`;
      
      // Store in Vercel Blob
      const blob = await put(pathname, Buffer.from(imageBuffer), {
        access: 'public',
        contentType: 'image/png',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      // Update database
      await client.query(
        `UPDATE assets 
         SET status = 'complete', 
             blob_url = $1, 
             blob_pathname = $2,
             completed_at = NOW()
         WHERE id = $3`,
        [blob.url, pathname, asset.id]
      );

      return res.status(200).json({
        status: 'complete',
        url: blob.url
      });
    } else if (prediction.status === 'failed') {
      await client.query(
        "UPDATE assets SET status = 'failed', updated_at = NOW() WHERE id = $1",
        [asset.id]
      );

      return res.status(200).json({
        status: 'failed',
        error: prediction.error
      });
    } else {
      // Still processing
      return res.status(200).json({
        status: prediction.status,
        message: 'Still processing'
      });
    }

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Status check failed' 
    });
  } finally {
    client.release();
  }
}
