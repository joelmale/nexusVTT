import React, { useState, useRef, useEffect } from 'react';
import type { Token, TokenSize } from '@/types/token';

interface TokenConfigPanelProps {
  token: Token;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Token>) => void;
}

const TOKEN_SIZES: { value: TokenSize; label: string }[] = [
  { value: 'tiny', label: 'Tiny' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'huge', label: 'Huge' },
  { value: 'gargantuan', label: 'Gargantuan' },
];

/**
 * Remove background from an image using color-based removal
 * This uses a simple threshold-based approach
 */
const removeImageBackground = async (
  imageUrl: string,
  tolerance: number = 30,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Sample background color from corners (average)
      const corners = [
        [0, 0], // Top-left
        [canvas.width - 1, 0], // Top-right
        [0, canvas.height - 1], // Bottom-left
        [canvas.width - 1, canvas.height - 1], // Bottom-right
      ];

      let r = 0,
        g = 0,
        b = 0;
      corners.forEach(([x, y]) => {
        const idx = (y * canvas.width + x) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
      });

      // Average background color
      const bgR = r / 4;
      const bgG = g / 4;
      const bgB = b / 4;

      // Remove background pixels
      for (let i = 0; i < data.length; i += 4) {
        const dr = Math.abs(data[i] - bgR);
        const dg = Math.abs(data[i + 1] - bgG);
        const db = Math.abs(data[i + 2] - bgB);

        // If color is close to background color, make it transparent
        if (dr < tolerance && dg < tolerance && db < tolerance) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      // Put modified data back
      ctx.putImageData(imageData, 0, 0);

      // Return as data URL
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
};

export const TokenConfigPanel: React.FC<TokenConfigPanelProps> = ({
  token,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(token.name);
  const [size, setSize] = useState(token.size);
  const [exclusive, setExclusive] = useState(token.exclusive || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(30);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when panel opens
      setName(token.name);
      setSize(token.size);
      setExclusive(token.exclusive || false);
      setBackgroundRemoved(false);
      setProcessedImage(null);
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    try {
      const result = await removeImageBackground(token.image, tolerance);
      setProcessedImage(result);
      setBackgroundRemoved(true);
    } catch (error) {
      console.error('Failed to remove background:', error);
      alert(
        'Failed to remove background. Try adjusting the tolerance or uploading a different image.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetBackground = () => {
    setBackgroundRemoved(false);
    setProcessedImage(null);
  };

  const handleUploadCustom = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setProcessedImage(dataUrl);
      setBackgroundRemoved(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const updates: Partial<Token> & { exclusive?: boolean } = {
      name,
      size,
      exclusive,
    };

    // If background was removed, update the image
    if (backgroundRemoved && processedImage) {
      updates.image = processedImage;
      // Also update thumbnail
      updates.thumbnailImage = processedImage;
    }

    onSave(updates);
    onClose();
  };

  const handleSaveToServer = async () => {
    if (!backgroundRemoved || !processedImage) {
      alert('Please remove background first before saving to server');
      return;
    }

    try {
      console.log('💾 Saving token to server...');
      console.log('   Token ID:', token.id);
      console.log('   Token name:', token.name);
      console.log('   Image data length:', processedImage.length);
      console.log('   Image data prefix:', processedImage.substring(0, 50));

      const response = await fetch('/api/tokens/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId: token.id,
          imageData: processedImage,
          name: token.name,
        }),
        credentials: 'include',
      });

      console.log('   Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('   Server error:', errorData);
        throw new Error(
          errorData.error || 'Failed to save token to server'
        );
      }

      const result = await response.json();
      console.log('   Server response:', result);

      // Verify the server path is valid before updating
      if (!result.path) {
        throw new Error('Server did not return a valid path');
      }

      console.log('   Updating token with server path:', result.path);

      // Update token with server path instead of data URL
      const updates: Partial<Token> & { exclusive?: boolean } = {
        name,
        size,
        exclusive,
        image: result.path,
        thumbnailImage: result.path,
      };

      onSave(updates);
      alert('Token saved to server successfully! Path: ' + result.path);
      onClose();
    } catch (error) {
      console.error('❌ Failed to save token to server:', error);
      alert(
        'Failed to save token to server: ' +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--glass-surface-strong)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '660px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: '0 0 20px 0',
            color: 'var(--glass-text)',
            fontSize: '24px',
          }}
        >
          Configure Token
        </h2>

        {/* Preview */}
        <div
          style={{
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '200px',
              height: '200px',
              margin: '0 auto',
              border: '2px solid var(--glass-border)',
              borderRadius: '8px',
              backgroundRepeat: 'no-repeat',
              // Checkered background to show transparency
              backgroundImage: processedImage
                ? `linear-gradient(45deg, #ccc 25%, transparent 25%),
                   linear-gradient(-45deg, #ccc 25%, transparent 25%),
                   linear-gradient(45deg, transparent 75%, #ccc 75%),
                   linear-gradient(-45deg, transparent 75%, #ccc 75%),
                   url(${processedImage})`
                : `url(${token.image})`,
              backgroundSize: processedImage
                ? '20px 20px, 20px 20px, 20px 20px, 20px 20px, contain'
                : 'contain',
              backgroundPosition: processedImage
                ? '0 0, 0 10px, 10px -10px, -10px 0px, center'
                : 'center',
            }}
          />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--glass-text)',
              fontWeight: 'bold',
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              background: 'var(--glass-surface)',
              color: 'var(--glass-text)',
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
              color: 'var(--glass-text)',
              fontWeight: 'bold',
            }}
          >
            Size
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {TOKEN_SIZES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSize(s.value)}
                style={{
                  padding: '10px',
                  border: `2px solid ${size === s.value ? 'var(--color-primary)' : 'var(--glass-border)'}`,
                  borderRadius: '6px',
                  background:
                    size === s.value
                      ? 'var(--color-primary)'
                      : 'var(--glass-surface)',
                  color:
                    size === s.value
                      ? 'var(--glass-text)'
                      : 'var(--glass-text-muted)',
                  cursor: 'pointer',
                  fontWeight: size === s.value ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exclusive Toggle */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              color: 'var(--glass-text)',
            }}
          >
            <input
              type="checkbox"
              checked={exclusive}
              onChange={(e) => setExclusive(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer',
              }}
            />
            <div>
              <div style={{ fontWeight: 'bold' }}>Exclusive Token</div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--glass-text-muted)',
                }}
              >
                Only one of this token can exist on the board at a time
              </div>
            </div>
          </label>
        </div>

        {/* Background Removal */}
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            background: 'var(--glass-surface)',
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              color: 'var(--glass-text)',
              fontSize: '16px',
            }}
          >
            Background Removal
          </h3>

          {!backgroundRemoved ? (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: 'var(--glass-text)',
                    fontSize: '14px',
                  }}
                >
                  Tolerance: {tolerance}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={tolerance}
                  onChange={(e) => setTolerance(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--glass-text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Higher values remove more background but may affect the image
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleRemoveBackground}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '6px',
                    background: 'var(--color-primary)',
                    color: 'var(--glass-text)',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    fontWeight: 'bold',
                    opacity: isProcessing ? 0.5 : 1,
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Auto Remove Background'}
                </button>

                <button
                  onClick={handleUploadCustom}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '6px',
                    background: 'var(--glass-surface-strong)',
                    color: 'var(--glass-text)',
                    cursor: 'pointer',
                  }}
                >
                  Upload Custom
                </button>
              </div>
            </>
          ) : (
            <div>
              <div
                style={{
                  color: 'var(--color-primary)',
                  marginBottom: '12px',
                  fontWeight: 'bold',
                }}
              >
                ✓ Background removed
              </div>
              <button
                onClick={handleResetBackground}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  background: 'var(--glass-surface-strong)',
                  color: 'var(--glass-text)',
                  cursor: 'pointer',
                }}
              >
                Reset to Original
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            style={{
              flex: '1 1 auto',
              padding: '12px',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              background: 'var(--glass-surface)',
              color: 'var(--glass-text)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: '1 1 auto',
              padding: '12px',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              background: 'var(--color-primary)',
              color: 'var(--glass-text)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Save (Browser Only)
          </button>
          {backgroundRemoved && processedImage && (
            <button
              onClick={handleSaveToServer}
              style={{
                flex: '1 1 100%',
                padding: '12px',
                border: '2px solid var(--color-accent)',
                borderRadius: '6px',
                background: 'var(--color-accent)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '8px',
              }}
            >
              💾 Save to Server (Permanent)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
