import { useState } from 'react'
import type { Asset } from '../types'

interface AssetLibraryProps {
  assets: Asset[]
  onAssetsChange: (assets: Asset[]) => void
}

export function AssetLibrary({ assets, onAssetsChange }: AssetLibraryProps) {
  const [filter, setFilter] = useState<Asset['type'] | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredAssets = filter === 'all' 
    ? assets 
    : assets.filter(a => a.type === filter)

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
      if (response.ok) {
        onAssetsChange(assets.filter(a => a.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    
    setIsDeleting(true)
    try {
      const response = await fetch('/api/assets/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      
      if (response.ok) {
        onAssetsChange(assets.filter(a => !selectedIds.has(a.id)))
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error('Failed to bulk delete:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopy = async (url: string, id: string) => {
    try {
      // Fetch the image as blob
      const response = await fetch(url)
      const blob = await response.blob()
      
      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      // Fallback: copy the URL
      try {
        await navigator.clipboard.writeText(url)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      } catch (e) {
        console.error('Fallback copy failed:', e)
      }
    }
  }

  const handleRefresh = async (assetId: string) => {
    try {
      const response = await fetch('/api/assets/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'complete') {
          // Update the asset in the list
          onAssetsChange(assets.map(a => 
            a.id === assetId 
              ? { ...a, status: 'complete', url: result.url }
              : a
          ))
        } else if (result.status === 'failed') {
          onAssetsChange(assets.map(a => 
            a.id === assetId 
              ? { ...a, status: 'failed' }
              : a
          ))
        }
      }
    } catch (error) {
      console.error('Failed to refresh:', error)
    }
  }

  const getStatusColor = (status: Asset['status']) => {
    switch (status) {
      case 'complete': return 'text-green-400'
      case 'generating': return 'text-yellow-400'
      case 'failed': return 'text-red-400'
    }
  }

  const allSelected = filteredAssets.length > 0 && filteredAssets.every(a => selectedIds.has(a.id))
  const someSelected = selectedIds.size > 0

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'image', 'meme', 'video'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {f} {f !== 'all' && `(${assets.filter(a => a.type === f).length})`}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {filteredAssets.length > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-800 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </span>
          </label>
          
          {someSelected && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded text-sm font-medium transition-colors"
            >
              {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </button>
          )}
        </div>
      )}

      {/* Assets Grid */}
      {filteredAssets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No assets yet</p>
          <p className="text-gray-500 mt-2">Create your first image, meme, or video</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className={`bg-gray-800 rounded-lg overflow-hidden border transition-colors relative ${
                selectedIds.has(asset.id) 
                  ? 'border-blue-500 ring-2 ring-blue-500/20' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.id)}
                  onChange={(e) => handleSelect(asset.id, e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700/80 text-blue-600 focus:ring-blue-500"
                />
              </div>

              {/* Preview */}
              <div className="aspect-square bg-gray-900 flex items-center justify-center">
                {asset.status === 'complete' && asset.url ? (
                  asset.type === 'image' || asset.type === 'meme' ? (
                    <img
                      src={asset.url}
                      alt={asset.prompt}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <span className="text-4xl">🎥</span>
                      <p className="text-sm text-gray-400 mt-2">{asset.type}</p>
                    </div>
                  )
                ) : asset.status === 'generating' ? (
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 mt-2">Generating...</p>
                    <button
                      onClick={() => handleRefresh(asset.id)}
                      className="mt-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
                    >
                      Check Status
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-red-400">
                    <span className="text-2xl">❌</span>
                    <p className="text-sm mt-1">Failed</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm text-gray-300 line-clamp-2" title={asset.prompt}>
                  {asset.prompt}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs capitalize ${getStatusColor(asset.status)}`}>
                    {asset.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                {/* Actions */}
                {asset.status === 'complete' && (
                  <div className="flex gap-2 mt-3">
                    {asset.url && (
                      <>
                        <button
                          onClick={() => handleCopy(asset.url!, asset.id)}
                          className={`flex-1 px-3 py-1.5 rounded text-sm font-medium text-center transition-colors ${
                            copiedId === asset.id
                              ? 'bg-green-600 text-white'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                        >
                          {copiedId === asset.id ? 'Copied!' : 'Copy'}
                        </button>
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-center transition-colors"
                        >
                          Open
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm font-medium transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
