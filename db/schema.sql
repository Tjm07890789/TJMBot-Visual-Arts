-- TJMBot Visual Arts Database Schema
-- Run this in your Neon Postgres console

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Assets table: stores metadata only, not binary content
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'meme', 'video')),
  prompt TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'complete', 'failed')),
  
  -- Storage references (URLs to Vercel Blob, not binary data in DB)
  blob_url TEXT,
  blob_pathname TEXT,
  
  -- Replicate tracking
  replicate_prediction_id VARCHAR(100),
  
  -- Dimensions
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_replicate_id ON assets(replicate_prediction_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assets_updated_at 
  BEFORE UPDATE ON assets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Verify table creation
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'assets';
