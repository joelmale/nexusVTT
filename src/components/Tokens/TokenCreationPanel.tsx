import React, { useState, useRef } from 'react';
import type {
  Token,
  TokenSize,
  TokenCategory,
  TokenStats,
} from '@/types/token';
import { tokenAssetManager } from '@/services/tokenAssets';
import { assetManager } from '@/services/assetManager';
import type { AssetMetadata } from '@/services/assetManager';

interface TokenCreationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenCreated: (token: Token) => void;
  initialData?: Partial<Token>;
}

const TOKEN_SIZES: { value: TokenSize; label: string }[] = [
  { value: 'tiny', label: 'Tiny (0.5 sq)' },
  { value: 'small', label: 'Small (1 sq)' },
  { value: 'medium', label: 'Medium (1 sq)' },
  { value: 'large', label: 'Large (2 sq)' },
  { value: 'huge', label: 'Huge (3 sq)' },
  { value: 'gargantuan', label: 'Gargantuan (4 sq)' },
];

const TOKEN_CATEGORIES: { value: TokenCategory; label: string }[] = [
  { value: 'pc', label: 'Player Character' },
  { value: 'npc', label: 'NPC' },
  { value: 'monster', label: 'Monster' },
  { value: 'object', label: 'Object' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'effect', label: 'Effect' },
];

export const TokenCreationPanel: React.FC<TokenCreationPanelProps> = ({
  isOpen,
  onClose,
  onTokenCreated,
  initialData,
}) => {
  // Form state
  const [name, setName] = useState(initialData?.name || '');
  const [size, setSize] = useState<TokenSize>(initialData?.size || 'medium');
  const [category, setCategory] = useState<TokenCategory>(
    initialData?.category || 'monster',
  );
  const [tags, setTags] = useState<string>(initialData?.tags?.join(', ') || '');
  const [description, setDescription] = useState(
    initialData?.description || '',
  );

  // Image state
  const [imageSource, setImageSource] = useState<'upload' | 'asset'>('upload');
  const [uploadedImage, setUploadedImage] = useState<string | null>(
    initialData?.image || null,
  );
  const [selectedAsset, setSelectedAsset] = useState<AssetMetadata | null>(
    null,
  );

  // Asset browser state
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetSearchResults, setAssetSearchResults] = useState<AssetMetadata[]>(
    [],
  );
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  // Stats state
  const [stats, setStats] = useState<TokenStats>(initialData?.stats || {});

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);
      setImageSource('upload');
    };
    reader.readAsDataURL(file);
  };

  const handleAssetSearch = async () => {
    if (!assetSearchQuery.trim()) return;

    setIsLoadingAssets(true);
    try {
      const results = await assetManager.searchAssets(assetSearchQuery);
      setAssetSearchResults(results);
    } catch (error) {
      console.error('Failed to search assets:', error);
      alert('Failed to search assets. Please try again.');
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const handleAssetSelect = (asset: AssetMetadata) => {
    setSelectedAsset(asset);
    setImageSource('asset');
    setShowAssetBrowser(false);
  };

  const handleCreateToken = async () => {
    // Validation
    if (!name.trim()) {
      alert('Please enter a token name');
      return;
    }

    let imageUrl = '';

    if (imageSource === 'upload') {
      if (!uploadedImage) {
        alert('Please upload an image or select from assets');
        return;
      }
      imageUrl = uploadedImage;
    } else {
      if (!selectedAsset) {
        alert('Please select an asset');
        return;
      }
      // Load the full-resolution asset
      try {
        imageUrl = await assetManager.loadAsset(selectedAsset.id);
      } catch (error) {
        console.error('Failed to load asset:', error);
        alert('Failed to load selected asset. Please try again.');
        return;
      }
    }

    const token: Omit<Token, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      image: imageUrl,
      thumbnailImage:
        imageSource === 'asset' && selectedAsset
          ? assetManager.getThumbnailUrl(selectedAsset)
          : imageUrl,
      size,
      category,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: description.trim() || undefined,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
      isCustom: true,
    };

    // Add to default library
    const libraries = tokenAssetManager.getLibraries();
    let targetLibrary = libraries.find((lib) => lib.name === 'Custom Tokens');

    if (!targetLibrary) {
      targetLibrary = tokenAssetManager.createCustomLibrary(
        'Custom Tokens',
        'User-created custom tokens',
      );
    }

    const createdToken = tokenAssetManager.addCustomToken(
      targetLibrary.id,
      token,
    );
    onTokenCreated(createdToken);
    onClose();
  };

  const getPreviewImage = (): string => {
    if (imageSource === 'upload' && uploadedImage) {
      return uploadedImage;
    }
    if (imageSource === 'asset' && selectedAsset) {
      return assetManager.getThumbnailUrl(selectedAsset);
    }
    return '';
  };

  return (
    <div
      className="token-creation-modal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            Create Custom Token
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
          }}
        >
          {/* Left Column - Image */}
          <div>
            <h3
              style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}
            >
              Token Image
            </h3>

            {/* Image Source Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Image Source
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setImageSource('upload')}
                  className={imageSource === 'upload' ? 'primary' : 'secondary'}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border:
                      imageSource === 'upload'
                        ? '2px solid #007bff'
                        : '1px solid #ccc',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor:
                      imageSource === 'upload' ? '#e3f2fd' : 'white',
                  }}
                >
                  Upload File
                </button>
                <button
                  onClick={() => {
                    setImageSource('asset');
                    setShowAssetBrowser(true);
                  }}
                  className={imageSource === 'asset' ? 'primary' : 'secondary'}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border:
                      imageSource === 'asset'
                        ? '2px solid #007bff'
                        : '1px solid #ccc',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor:
                      imageSource === 'asset' ? '#e3f2fd' : 'white',
                  }}
                >
                  Asset Library
                </button>
              </div>
            </div>

            {/* Upload Section */}
            {imageSource === 'upload' && (
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="secondary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #ccc',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  📁 Click to Upload Image
                </button>
                <p
                  style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}
                >
                  Max file size: 5MB. Supported formats: PNG, JPG, GIF, WebP
                </p>
              </div>
            )}

            {/* Asset Browser */}
            {imageSource === 'asset' && showAssetBrowser && (
              <div
                style={{
                  marginBottom: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div
                  style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}
                >
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAssetSearch()}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                    }}
                  />
                  <button
                    onClick={handleAssetSearch}
                    disabled={isLoadingAssets}
                    className="primary"
                    style={{ padding: '8px 16px' }}
                  >
                    🔍 Search
                  </button>
                </div>

                {isLoadingAssets && <p>Loading assets...</p>}

                {assetSearchResults.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                  >
                    {assetSearchResults.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => handleAssetSelect(asset)}
                        style={{
                          cursor: 'pointer',
                          border:
                            selectedAsset?.id === asset.id
                              ? '2px solid #007bff'
                              : '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '8px',
                          textAlign: 'center',
                          backgroundColor:
                            selectedAsset?.id === asset.id
                              ? '#e3f2fd'
                              : 'white',
                        }}
                      >
                        <img
                          src={assetManager.getThumbnailUrl(asset)}
                          alt={asset.name}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '80px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            marginBottom: '8px',
                          }}
                        />
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            wordBreak: 'break-word',
                          }}
                        >
                          {asset.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Preview
              </label>
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  border: '2px solid #ccc',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  overflow: 'hidden',
                }}
              >
                {getPreviewImage() ? (
                  <img
                    src={getPreviewImage()}
                    alt="Token preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span style={{ color: '#999', fontSize: '14px' }}>
                    No image selected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div>
            <h3
              style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}
            >
              Token Details
            </h3>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Goblin Scout"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Size */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as TokenSize)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {TOKEN_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TokenCategory)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {TOKEN_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., humanoid, goblinoid, small"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Separate tags with commas
              </p>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Stats (Optional) */}
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginBottom: '12px',
                }}
              >
                Stats (Optional)
              </summary>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  paddingLeft: '16px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '13px',
                    }}
                  >
                    HP
                  </label>
                  <input
                    type="number"
                    value={stats.hp || ''}
                    onChange={(e) =>
                      setStats({
                        ...stats,
                        hp: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '13px',
                    }}
                  >
                    AC
                  </label>
                  <input
                    type="number"
                    value={stats.ac || ''}
                    onChange={(e) =>
                      setStats({
                        ...stats,
                        ac: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '13px',
                    }}
                  >
                    Speed
                  </label>
                  <input
                    type="number"
                    value={stats.speed || ''}
                    onChange={(e) =>
                      setStats({
                        ...stats,
                        speed: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="30"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '13px',
                    }}
                  >
                    CR
                  </label>
                  <input
                    type="text"
                    value={stats.cr || ''}
                    onChange={(e) =>
                      setStats({ ...stats, cr: e.target.value || undefined })
                    }
                    placeholder="1/4"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '20px 24px',
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <button
            onClick={onClose}
            className="secondary"
            style={{
              padding: '10px 24px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: 'white',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateToken}
            className="primary"
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            Create Token
          </button>
        </div>
      </div>
    </div>
  );
};
