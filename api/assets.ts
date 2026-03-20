import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import type { Asset, GenerationRequest } from '../src/types/index.js';

// In-memory storage for serverless environment
// Note: This resets on each deployment/cold start
// For production, use a database like Vercel Postgres or Upstash Redis
const assets: Asset[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ assets });
  }

  if (req.method === 'POST') {
    const { prompt, type, width, height, duration } = req.body as GenerationRequest;

    if (!prompt || !type) {
      return res.status(400).json({ error: 'Missing prompt or type' });
    }

    const asset: Asset = {
      id: uuidv4(),
      type,
      prompt,
      status: 'generating',
      createdAt: new Date().toISOString(),
      width,
      height,
      duration,
    };

    assets.unshift(asset);

    // TODO: Trigger Replicate generation
    // For now, return the asset with generating status
    return res.status(201).json(asset);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }

    const index = assets.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    assets.splice(index, 1);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
