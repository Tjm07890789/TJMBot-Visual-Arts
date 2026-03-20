import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GenerationRequest } from '../src/types';

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

  const { prompt, type, width = 1024, height = 1024 } = req.body as GenerationRequest;

  if (!prompt || !type) {
    return res.status(400).json({ error: 'Missing prompt or type' });
  }

  try {
    // Map type to Replicate model
    let model: string;
    let input: Record<string, unknown>;

    switch (type) {
      case 'image':
        model = 'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4';
        input = {
          prompt,
          width,
          height,
          num_outputs: 1,
          num_inference_steps: 50,
          guidance_scale: 7.5,
        };
        break;
      case 'meme':
        model = 'stability-ai/animate-diff:ca1f5e5e0c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5';
        input = {
          prompt,
          num_frames: 16,
          fps: 8,
        };
        break;
      case 'video':
        model = 'stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438';
        input = {
          image: prompt, // SVD requires an image input
          frames: 14,
          fps: 6,
        };
        break;
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }

    // Start generation on Replicate
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: model,
        input,
        webhook: `${process.env.VERCEL_URL || ''}/api/webhook`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${error}`);
    }

    const prediction = await response.json();

    return res.status(201).json({
      predictionId: prediction.id,
      status: prediction.status,
    });
  } catch (error) {
    console.error('Generation failed:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Generation failed' 
    });
  }
}
