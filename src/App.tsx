import { useState, useEffect } from 'react'
import { GenerationForm } from './components/GenerationForm'
import { AssetLibrary } from './components/AssetLibrary'
import type { Asset } from './types'

function App() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create')

  useEffect(() => {
    // Load assets on mount
    loadAssets()

    // Poll for updates every 3 seconds when there are generating assets
    const interval = setInterval(() => {
      const hasGenerating = assets.some(a => a.status === 'generating')
      if (hasGenerating || activeTab === 'library') {
        loadAssets()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [assets, activeTab])

  const loadAssets = async () => {
    try {
      const response = await fetch('/api/assets')
      if (response.ok) {
        const data = await response.json()
        setAssets(data.assets)
      }
    } catch (error) {
      console.error('Failed to load assets:', error)
    }
  }

  const handleAssetCreated = (asset: Asset) => {
    setAssets(prev => [asset, ...prev])
    setActiveTab('library')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/TJMbot.jpg" 
                alt="TJMbot" 
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div>
                <h1 className="text-xl font-bold">TJMBot Visual Arts</h1>
                <p className="text-sm text-gray-400">AI Image & Video Generation</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'create' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Create New
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'library' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Library ({assets.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'create' ? (
          <GenerationForm onAssetCreated={handleAssetCreated} />
        ) : (
          <AssetLibrary assets={assets} onAssetsChange={setAssets} />
        )}
      </main>
    </div>
  )
}

export default App
