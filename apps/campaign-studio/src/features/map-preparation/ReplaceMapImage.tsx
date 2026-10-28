import Image from 'lucide-react/dist/esm/icons/image';
import { useEffect, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  assetImageUrl,
  isImageAsset,
  listAssets,
  uploadAssetFile,
  type UserAsset,
} from '@/services/assets-api';
import { measureImage } from '@/services/generatorHub';

import styles from './ReplaceMapImage.module.css';

export interface MapImageChoice {
  assetId: string;
  /** Path the image is served from. */
  url: string;
  /** Pixel size, known only for a fresh upload. */
  dimensions?: { width: number; height: number };
}

interface ReplaceMapImageProps {
  /** Applies the choice to the map. A rejection keeps the picker open. */
  onReplace: (choice: MapImageChoice) => Promise<void>;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * "Replace image" button and picker: choose one of the user's map assets or
 * upload a new image. The caller decides when the map is editable.
 */
export function ReplaceMapImage({ onReplace }: ReplaceMapImageProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<UserAsset[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAssets(undefined);
    setError(undefined);
    listAssets()
      .then((all) => {
        if (!cancelled) {
          setAssets(
            all.filter(
              (asset) => asset.category === 'maps' && isImageAsset(asset),
            ),
          );
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(message(failure, 'Could not load your maps.'));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const apply = async (choice: MapImageChoice) => {
    setBusy(true);
    setError(undefined);
    try {
      await onReplace(choice);
      setOpen(false);
    } catch (failure) {
      setError(message(failure, 'Could not replace the image.'));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    let choice: MapImageChoice;
    try {
      const asset = await uploadAssetFile(file, 'maps');
      const dimensions = (await measureImage(file)) ?? undefined;
      choice = { assetId: asset.id, url: assetImageUrl(asset), dimensions };
    } catch (failure) {
      setError(message(failure, 'The upload failed.'));
      setBusy(false);
      return;
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
    await apply(choice);
  };

  return (
    <>
      <button
        className={styles.trigger}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Image aria-hidden="true" size={16} />
        <span>Replace image</span>
      </button>
      <Dialog
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        open={open}
      >
        <DialogContent className="max-w-2xl">
          <div aria-label="Replace map image" role="dialog">
            <DialogHeader>
              <DialogTitle>Replace map image</DialogTitle>
              <DialogDescription>
                Choose one of your map images or upload a new one. Pins and
                layers stay where they are.
              </DialogDescription>
            </DialogHeader>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {assets === undefined && !error ? (
              <p aria-busy="true">Loading your maps…</p>
            ) : assets && assets.length > 0 ? (
              <ul aria-label="Your map images" className={styles.grid}>
                {assets.map((asset) => (
                  <li key={asset.id}>
                    <button
                      className={styles.option}
                      disabled={busy}
                      onClick={() =>
                        void apply({
                          assetId: asset.id,
                          url: assetImageUrl(asset),
                        })
                      }
                      type="button"
                    >
                      <img alt="" loading="lazy" src={assetImageUrl(asset)} />
                      <span>{asset.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : assets ? (
              <p className={styles.muted}>You have no map images yet.</p>
            ) : null}
            <div className={styles.footer}>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                Upload new image
              </button>
              <input
                accept="image/png,image/jpeg,image/webp"
                aria-label="Choose image to upload"
                className={styles.hiddenInput}
                onChange={(event) => void upload(event.target.files?.[0])}
                ref={fileInput}
                tabIndex={-1}
                type="file"
              />
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
