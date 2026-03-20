import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import type { Asset, GenerationRequest } from '../src/types/index.js';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.join(process.cwd(), 'assets');
const DB_FILE = path.join(process.cwd(), 'db', 'assets.json');

// Ensure directories exist
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.mkdirSync(path.join(ASSETS_DIR, 'images'), { recursive: true });
  fs.mkdirSync(path.join(ASSETS_DIR, 'memes'), { recursive: true });
  fs.mkdirSync(path.join(ASSETS_DIR, 'videos'), { recursive: true });
}
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

function loadAssets(): Asset[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load assets:', error);
  }
  return [];
}

function saveAssets(assets: Asset[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(assets, null, 2));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const assets = loadAssets();
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

    const assets = loadAssets();
    assets.unshift(asset);
    saveAssets(assets);

    // TODO: Trigger Replicate generation
    // For now, return the asset with generating status
    return res.status(201).json(asset);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }

    let assets = loadAssets();
    const asset = assets.find(a => a.id === id);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete file if exists
    if (asset.localPath && fs.existsSync(asset.localPath)) {
      fs.unlinkSync(asset.localPath);
    }

    assets = assets.filter(a => a.id !== id);
    saveAssets(assets);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
