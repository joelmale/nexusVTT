import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Prop, PropCategory, PropSize } from '@/types/prop';
import { usePropAssets } from '@/services/propAssets';
import { safeImageUrl } from '@/utils/safeUrl';

interface PropCreationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPropSaved: (prop: Prop) => void;
  initialData?: Prop;
}

const PROP_SIZES: { value: PropSize; label: string }[] = [
  { value: 'tiny', label: 'Tiny (0.5 sq)' },
  { value: 'small', label: 'Small (1 sq)' },
  { value: 'medium', label: 'Medium (2 sq)' },
  { value: 'large', label: 'Large (3 sq)' },
  { value: 'huge', label: 'Huge (4 sq)' },
  { value: 'custom', label: 'Custom' },
];

const PROP_CATEGORIES: { value: PropCategory; label: string }[] = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'treasure', label: 'Treasure' },
  { value: 'container', label: 'Container' },
  { value: 'door', label: 'Door' },
  { value: 'trap', label: 'Trap' },
  { value: 'light', label: 'Light' },
  { value: 'effect', label: 'Effect' },
  { value: 'other', label: 'Other' },
];

const PLACEHOLDER_COLORS = [
  '#8b7355',
  '#a0522d',
  '#d2691e',
  '#cd853f',
  '#daa520',
  '#b8860b',
  '#4A9EFF',
  '#2ECC71',
  '#E67E22',
  '#9B59B6',
];

const getInitialsFromName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return 'P';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getRandomPlaceholderColor = () => {
  return PLACEHOLDER_COLORS[
    Math.floor(Math.random() * PLACEHOLDER_COLORS.length)
  ];
};

export const PropCreationPanel: React.FC<PropCreationPanelProps> = ({
  isOpen,
  onClose,
  onPropSaved,
  initialData,
}) => {
  const { addCustomProp, updateProp, generatePlaceholderImage } =
    usePropAssets();

  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState<PropCategory>(
    initialData?.category || 'other',
  );
  const [size, setSize] = useState<PropSize>(initialData?.size || 'small');
  const [tags, setTags] = useState<string>(
    initialData?.tags?.join(', ') || '',
  );
  const [description, setDescription] = useState(
    initialData?.description || '',
  );
  const [interactive, setInteractive] = useState<boolean>(
    initialData?.interactive || false,
  );
  const [lightRadius, setLightRadius] = useState<string>(
    initialData?.lightRadius ? String(initialData.lightRadius) : '',
  );
  const [lightColor, setLightColor] = useState<string>(
    initialData?.lightColor || '#FFD700',
  );

  const [imageSource, setImageSource] = useState<'upload' | 'placeholder'>(
    initialData?.image ? 'upload' : 'placeholder',
  );
  const [uploadedImage, setUploadedImage] = useState<string | null>(
    initialData?.image || null,
  );
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [bgTolerance, setBgTolerance] = useState(40);
  const [placeholderLabel, setPlaceholderLabel] = useState<string>(() =>
    getInitialsFromName(initialData?.name || ''),
  );
  const [placeholderColor, setPlaceholderColor] = useState<string>(() =>
    getRandomPlaceholderColor(),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewImage = useMemo(() => {
    if (imageSource === 'upload' && uploadedImage) {
      return removeBackground && processedImage ? processedImage : uploadedImage;
    }
    const label = placeholderLabel.trim() || getInitialsFromName(name);
    return generatePlaceholderImage(label, placeholderColor);
  }, [
    imageSource,
    uploadedImage,
    processedImage,
    removeBackground,
    placeholderLabel,
    placeholderColor,
    name,
    generatePlaceholderImage,
  ]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

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

  useEffect(() => {
    let cancelled = false;

    const processImage = async () => {
      if (!uploadedImage || !removeBackground) {
        setProcessedImage(null);
        return;
      }

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const baseIndex = 0;
          const base = {
            r: data[baseIndex],
            g: data[baseIndex + 1],
            b: data[baseIndex + 2],
          };

          const threshold = Math.max(0, Math.min(255, bgTolerance));
          const thresholdSq = threshold * threshold;

          for (let i = 0; i < data.length; i += 4) {
            const dr = data[i] - base.r;
            const dg = data[i + 1] - base.g;
            const db = data[i + 2] - base.b;
            const distanceSq = dr * dr + dg * dg + db * db;
            if (distanceSq <= thresholdSq) {
              data[i + 3] = 0;
            }
          }

          ctx.putImageData(imageData, 0, 0);
          setProcessedImage(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          if (!cancelled) {
            setProcessedImage(null);
          }
        };
        img.src = uploadedImage;
      } catch {
        if (!cancelled) {
          setProcessedImage(null);
        }
      }
    };

    processImage();

    return () => {
      cancelled = true;
    };
  }, [uploadedImage, removeBackground, bgTolerance]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a prop name');
      return;
    }

    const label = placeholderLabel.trim() || getInitialsFromName(name);
    const placeholderImage = generatePlaceholderImage(label, placeholderColor);

    const imageUrl =
      imageSource === 'upload' && uploadedImage
        ? removeBackground && processedImage
          ? processedImage
          : uploadedImage
        : placeholderImage;

    const lightRadiusValue =
      lightRadius.trim().length > 0 ? Number(lightRadius) : undefined;

    const payload: Omit<Prop, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      image: imageUrl,
      thumbnailImage: imageUrl,
      size,
      category,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: description.trim() || undefined,
      interactive,
      lightRadius: lightRadiusValue,
      lightColor: lightRadiusValue ? lightColor : undefined,
      isCustom: true,
    };

    if (initialData) {
      await updateProp(initialData.id, payload);
      onPropSaved({ ...initialData, ...payload, updatedAt: Date.now() });
    } else {
      const created = await addCustomProp(payload);
      onPropSaved(created);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="prop-creation-modal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 'var(--z-panel)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary, #1f1f1f)',
          borderRadius: '12px',
          padding: '20px',
          width: 'min(1200px, 98vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          border: '1px solid var(--border-color, #444)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>
            {initialData ? 'Edit Prop' : 'Create Prop'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary, #fff)',
              fontSize: '20px',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '16px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ color: 'var(--text-secondary, #ccc)' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!placeholderLabel.trim()) {
                  setPlaceholderLabel(getInitialsFromName(e.target.value));
                }
              }}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #444)',
                background: 'var(--bg-tertiary, #2a2a2a)',
                color: 'var(--text-primary, #fff)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ color: 'var(--text-secondary, #ccc)' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PropCategory)}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #444)',
                background: 'var(--bg-tertiary, #2a2a2a)',
                color: 'var(--text-primary, #fff)',
              }}
            >
              {PROP_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ color: 'var(--text-secondary, #ccc)' }}>Size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as PropSize)}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #444)',
                background: 'var(--bg-tertiary, #2a2a2a)',
                color: 'var(--text-primary, #fff)',
              }}
            >
              {PROP_SIZES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ color: 'var(--text-secondary, #ccc)' }}>
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #444)',
                background: 'var(--bg-tertiary, #2a2a2a)',
                color: 'var(--text-primary, #fff)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ color: 'var(--text-secondary, #ccc)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #444)',
                background: 'var(--bg-tertiary, #2a2a2a)',
                color: 'var(--text-primary, #fff)',
                resize: 'vertical',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: '12px',
              border: '1px solid var(--border-color, #444)',
              borderRadius: '10px',
              padding: '12px',
              gridColumn: '1 / -1',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ color: 'var(--text-primary, #fff)' }}>
                Icon
              </strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setImageSource('upload')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border:
                      imageSource === 'upload'
                        ? '2px solid var(--color-primary, #4A9EFF)'
                        : '1px solid var(--border-color, #444)',
                    background: 'var(--bg-tertiary, #2a2a2a)',
                    color: 'var(--text-primary, #fff)',
                    cursor: 'pointer',
                  }}
                >
                  Upload
                </button>
                <button
                  onClick={() => setImageSource('placeholder')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border:
                      imageSource === 'placeholder'
                        ? '2px solid var(--color-primary, #4A9EFF)'
                        : '1px solid var(--border-color, #444)',
                    background: 'var(--bg-tertiary, #2a2a2a)',
                    color: 'var(--text-primary, #fff)',
                    cursor: 'pointer',
                  }}
                >
                  Placeholder
                </button>
              </div>
            </div>

            {imageSource === 'upload' ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                {!uploadedImage && (
                  <span style={{ color: 'var(--text-secondary, #aaa)' }}>
                    If you skip upload, a placeholder icon will be generated.
                  </span>
                )}
                {uploadedImage && (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label
                      style={{ color: 'var(--text-secondary, #ccc)' }}
                    >
                      Remove Background
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={removeBackground}
                        onChange={(e) => setRemoveBackground(e.target.checked)}
                      />
                      <label style={{ color: 'var(--text-secondary, #aaa)' }}>
                        Use top-left pixel as background
                      </label>
                    </div>
                    {removeBackground && (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <label
                          style={{ color: 'var(--text-secondary, #ccc)' }}
                        >
                          Tolerance: {bgTolerance}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={120}
                          value={bgTolerance}
                          onChange={(e) => setBgTolerance(Number(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                <label style={{ color: 'var(--text-secondary, #ccc)' }}>
                  Label (1-2 letters)
                </label>
                <input
                  type="text"
                  value={placeholderLabel}
                  maxLength={2}
                  onChange={(e) =>
                    setPlaceholderLabel(e.target.value.toUpperCase())
                  }
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #444)',
                    background: 'var(--bg-tertiary, #2a2a2a)',
                    color: 'var(--text-primary, #fff)',
                  }}
                />
                <label style={{ color: 'var(--text-secondary, #ccc)' }}>
                  Background Color
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={placeholderColor}
                    onChange={(e) => setPlaceholderColor(e.target.value)}
                    style={{ width: '48px', height: '32px', border: 'none' }}
                  />
                  <button
                    onClick={() => setPlaceholderColor(getRandomPlaceholderColor())}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #444)',
                      background: 'var(--bg-tertiary, #2a2a2a)',
                      color: 'var(--text-primary, #fff)',
                      cursor: 'pointer',
                    }}
                  >
                    Randomize
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <img
                src={safeImageUrl(previewImage)}
                alt="Prop preview"
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '8px',
                  background: '#111',
                  border: '1px solid var(--border-color, #444)',
                }}
              />
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>
                Preview
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ color: 'var(--text-secondary, #ccc)' }}>
              Interactive
            </label>
            <input
              type="checkbox"
              checked={interactive}
              onChange={(e) => setInteractive(e.target.checked)}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: '8px',
              gridTemplateColumns: '1fr 1fr',
              gridColumn: '1 / -1',
            }}
          >
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ color: 'var(--text-secondary, #ccc)' }}>
                Light Radius (optional)
              </label>
              <input
                type="number"
                min={0}
                value={lightRadius}
                onChange={(e) => setLightRadius(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #444)',
                  background: 'var(--bg-tertiary, #2a2a2a)',
                  color: 'var(--text-primary, #fff)',
                }}
              />
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ color: 'var(--text-secondary, #ccc)' }}>
                Light Color
              </label>
              <input
                type="color"
                value={lightColor}
                onChange={(e) => setLightColor(e.target.value)}
                style={{ height: '36px', border: 'none' }}
                disabled={!lightRadius}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #444)',
              background: 'transparent',
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--color-primary, #4A9EFF)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {initialData ? 'Save Changes' : 'Create Prop'}
          </button>
        </div>
      </div>
    </div>
  );
};

PropCreationPanel.displayName = 'PropCreationPanel';
