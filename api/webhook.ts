import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Replicate sends POST webhook when prediction completes
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

  try {
    const { id: predictionId, status, output } = req.body;

    if (!predictionId) {
      return res.status(400).json({ error: 'Missing prediction id' });
    }

    // Find asset by replicate prediction ID
    const { rows } = await client.query(
      'SELECT id, type FROM assets WHERE replicate_prediction_id = $1',
      [predictionId]
    );

    if (rows.length === 0) {
      console.warn('Webhook received for unknown prediction:', predictionId);
      return res.status(404).json({ error: 'Asset not found' });
    }

    const assetId = rows[0].id;
    const assetType = rows[0].type;

    if (status === 'succeeded' && output) {
      // Download the generated file from Replicate
      const imageUrl = Array.isArray(output) ? output[0] : output;
      
      // Fetch the file
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch generated image');
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const pathname = `assets/${assetType}/${assetId}.png`;
      
      // Store in Vercel Blob
      const blob = await put(pathname, Buffer.from(imageBuffer), {
        access: 'public',
        contentType: 'image/png',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      // Update database with blob URL
      await client.query(
        `UPDATE assets 
         SET status = 'complete', 
             blob_url = $1, 
             blob_pathname = $2,
             completed_at = NOW()
         WHERE id = $3`,
        [blob.url, pathname, assetId]
      );

      console.log('Asset completed:', assetId, 'Blob URL:', blob.url);
      return res.status(200).json({ success: true, assetId, url: blob.url });
    } else if (status === 'failed') {
      await client.query(
        "UPDATE assets SET status = 'failed', updated_at = NOW() WHERE id = $1",
        [assetId]
      );
      return res.status(200).json({ success: true, status: 'failed' });
    }

    // Still processing
    return res.status(200).json({ success: true, status: 'processing' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Webhook processing failed' 
    });
  } finally {
    client.release();
  }
}
