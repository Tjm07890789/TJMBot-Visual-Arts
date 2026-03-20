import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import type { GenerationRequest } from '../src/types/index.js';

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
    const { prompt, type, width = 1024, height = 1024 } = req.body as GenerationRequest;

    if (!prompt || !type) {
      return res.status(400).json({ error: 'Missing prompt or type' });
    }

    // Create asset record first
    const { rows: assetRows } = await client.query(
      `INSERT INTO assets (type, prompt, status, width, height)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [type, prompt, 'generating', width, height]
    );

    const assetId = assetRows[0].id;

    // Map type to Replicate model
    let version: string;
    let input: Record<string, unknown>;

    switch (type) {
      case 'image':
        version = 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4'; // SDXL
        input = { prompt, width, height, num_outputs: 1 };
        break;
      case 'meme':
        version = 'ca1f5e5e0c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5'; // AnimateDiff
        input = { prompt, num_frames: 16, fps: 8 };
        break;
      case 'video':
        version = '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438'; // SVD
        input = { image: prompt, frames: 14, fps: 6 };
        break;
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }

    // Start generation on Replicate
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version,
        input,
        webhook: 'https://tjmbot-visual-arts.vercel.app/api/webhook',
        webhook_events_filter: ['completed'],
      }),
    });

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      // Mark asset as failed
      await client.query(
        "UPDATE assets SET status = 'failed' WHERE id = $1",
        [assetId]
      );
      throw new Error(`Replicate API error: ${errorText}`);
    }

    const prediction = await replicateResponse.json();

    // Store prediction ID
    await client.query(
      'UPDATE assets SET replicate_prediction_id = $1 WHERE id = $2',
      [prediction.id, assetId]
    );

    return res.status(201).json({
      id: assetId,
      predictionId: prediction.id,
      status: prediction.status,
    });

  } catch (error) {
    console.error('Generation failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Generation failed' 
    });
  } finally {
    client.release();
  }
}
