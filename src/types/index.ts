export type AssetType = 'image' | 'video'

export interface Asset {
  id: string
  type: AssetType
  prompt: string
  status: 'generating' | 'complete' | 'failed'
  url?: string
  localPath?: string
  createdAt: string
  width?: number
  height?: number
  duration?: number
}

export interface GenerationRequest {
  prompt: string
  type: AssetType
  width?: number
  height?: number
  duration?: number
}
