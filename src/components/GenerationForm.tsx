import { useState } from 'react'
import type { GenerationRequest, Asset } from '../types'

interface GenerationFormProps {
  onAssetCreated: (asset: Asset) => void
}

export function GenerationForm({ onAssetCreated }: GenerationFormProps) {
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState<Asset['type']>('image')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type,
          width: 1024,
          height: 1024,
        } as GenerationRequest),
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const asset: Asset = await response.json()
      onAssetCreated(asset)
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold mb-6">Create New Asset</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['image', 'meme', 'video'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-4 py-3 rounded-lg border-2 font-medium capitalize transition-colors ${
                    type === t
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={type === 'image' 
                ? "A futuristic cityscape at sunset, cyberpunk style..."
                : type === 'meme'
                ? "A cat wearing sunglasses with dramatic lighting..."
                : "A serene forest with flowing water, cinematic..."
              }
              rows={4}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="mt-2 text-sm text-gray-500">
              {prompt.length} characters
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              `Generate ${type}`
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
          <h3 className="font-medium text-gray-300 mb-2">About {type} generation:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            {type === 'image' && (
              <>
                <li>• Uses Stable Diffusion XL via Replicate</li>
                <li>• Generates 1024x1024 images</li>
                <li>• Cost: ~$0.02 per image</li>
              </>
            )}
            {type === 'meme' && (
              <>
                <li>• Uses FLUX for meme images</li>
                <li>• Generates 1024x1024 meme images</li>
                <li>• Cost: ~$0.003 per meme</li>
              </>
            )}
            {type === 'video' && (
              <>
                <li>• Uses Stable Video Diffusion</li>
                <li>• Generates up to 10 second videos</li>
                <li>• Cost: ~$0.20-0.50 per video</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
