/**
 * Character Import Modal
 * Allows importing one or more characters from various sources
 */

import React, { useState, useRef } from 'react';
import { useCharacterStore } from '@/stores/characterStore';

interface ImportSummary {
  successful: number;
  failed: number;
  errors: string[];
}

interface CharacterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: { successful: number; failed: number }) => void;
}

export const CharacterImportModal: React.FC<CharacterImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [totalCharacters, setTotalCharacters] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importCharactersFromFiles = useCharacterStore(
    (state) => state.importCharactersFromFiles,
  );

  const countCharactersInFiles = async (files: File[]): Promise<number> => {
    let total = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const normalized = normalizeImportPayload(data);
        if (Array.isArray(normalized)) {
          total += normalized.length;
        } else {
          total += 1;
        }
      } catch {
        // If parsing fails, assume 1 character per file as fallback
        total += 1;
      }
    }
    return total;
  };

  const normalizeImportPayload = (data: unknown): unknown => {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.characters)) {
        return record.characters;
      }
    }

    return data;
  };

  if (!isOpen) return null;

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
      setResult(null); // Clear previous results

      // Count total characters
      const count = await countCharactersInFiles(fileArray);
      setTotalCharacters(count);
    }
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) return;

    setImporting(true);
    setResult(null);

    try {
      const importResult = await importCharactersFromFiles(selectedFiles);

      setResult(importResult);

      if (onImportComplete) {
        onImportComplete({
          successful: importResult.successful,
          failed: importResult.failed,
        });
      }

      // If all succeeded, close after short delay
      if (importResult.failed === 0) {
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (error) {
      setResult({
        successful: 0,
        failed: totalCharacters,
        errors: [error instanceof Error ? error.message : 'Import failed'],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Characters</h2>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="import-section">
            <h3>Select Character Files</h3>
            <p className="import-instructions">
              Choose one or more JSON character files to import. Supported
              formats: 5e Character Forge, NexusVTT JSON
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <div className="file-select-area">
              <button
                className="btn btn-secondary"
                onClick={handleBrowseFiles}
                disabled={importing}
              >
                Browse Files
              </button>

              {selectedFiles.length > 0 && (
                <div className="selected-files">
                  <h4>
                    Selected Files ({selectedFiles.length}) - {totalCharacters}{' '}
                    Character{totalCharacters !== 1 ? 's' : ''}:
                  </h4>
                  <ul>
                    {selectedFiles.map((file, index) => (
                      <li key={index}>
                        <span className="file-icon">📄</span>
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Drag and drop area */}
            <div
              className="drag-drop-area"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files).filter((file) =>
                  file.name.endsWith('.json'),
                );
                if (files.length > 0) {
                  setSelectedFiles(files);
                  setResult(null);

                  // Count total characters
                  const count = await countCharactersInFiles(files);
                  setTotalCharacters(count);
                }
              }}
            >
              <div className="drag-drop-content">
                <span className="drag-drop-icon">📂</span>
                <p>Or drag and drop JSON files here</p>
              </div>
            </div>
          </div>

          {/* Import Results */}
          {result && (
            <div
              className={`import-results ${result.failed > 0 ? 'has-errors' : 'success'}`}
            >
              <h3>Import Results</h3>

              {result.successful > 0 && (
                <div className="success-message">
                  ✅ Successfully imported {result.successful} character
                  {result.successful !== 1 ? 's' : ''}
                </div>
              )}

              {result.failed > 0 && (
                <div className="error-section">
                  <div className="error-summary">
                    ❌ Failed to import {result.failed} character
                    {result.failed !== 1 ? 's' : ''}
                  </div>

                  {result.errors.length > 0 && (
                    <div className="error-list">
                      <h4>Errors:</h4>
                      <ul>
                        {result.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={importing}
          >
            {result && result.failed === 0 ? 'Close' : 'Cancel'}
          </button>

          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={totalCharacters === 0 || importing}
          >
            {importing ? (
              <>
                <span className="spinner"></span>
                Importing...
              </>
            ) : (
              `Import ${totalCharacters} Character${totalCharacters !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--color-bg-secondary, #1a1a1a);
          border: 2px solid var(--color-border, #333);
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--color-border, #333);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 2rem;
          cursor: pointer;
          color: var(--color-text-secondary, #aaa);
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          color: var(--color-text-primary, #fff);
        }

        .modal-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--color-border, #333);
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .import-section h3 {
          margin-top: 0;
          margin-bottom: 0.5rem;
        }

        .import-instructions {
          color: var(--color-text-secondary, #aaa);
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }

        .file-select-area {
          margin-bottom: 1.5rem;
        }

        .selected-files {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--color-bg-tertiary, #0f0f0f);
          border-radius: 4px;
        }

        .selected-files h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.9rem;
          color: var(--color-text-secondary, #aaa);
        }

        .selected-files ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .selected-files li {
          padding: 0.5rem;
          margin-bottom: 0.5rem;
          background: var(--color-bg-secondary, #1a1a1a);
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .selected-files li:last-child {
          margin-bottom: 0;
        }

        .file-icon {
          font-size: 1.2rem;
        }

        .file-name {
          flex: 1;
          font-family: monospace;
        }

        .file-size {
          color: var(--color-text-secondary, #aaa);
          font-size: 0.85rem;
        }

        .drag-drop-area {
          border: 2px dashed var(--color-border, #333);
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .drag-drop-area:hover {
          border-color: var(--color-primary, #4a9eff);
          background: rgba(74, 158, 255, 0.05);
        }

        .drag-drop-content {
          pointer-events: none;
        }

        .drag-drop-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .drag-drop-content p {
          margin: 0;
          color: var(--color-text-secondary, #aaa);
        }

        .import-results {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 8px;
        }

        .import-results.success {
          background: rgba(46, 160, 67, 0.1);
          border: 1px solid rgba(46, 160, 67, 0.3);
        }

        .import-results.has-errors {
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.3);
        }

        .import-results h3 {
          margin-top: 0;
          margin-bottom: 1rem;
        }

        .success-message {
          color: #2ea043;
          font-weight: 500;
        }

        .error-section {
          color: #dc2626;
        }

        .error-summary {
          font-weight: 500;
          margin-bottom: 1rem;
        }

        .error-list h4 {
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }

        .error-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .error-list li {
          padding: 0.5rem;
          background: rgba(220, 38, 38, 0.1);
          border-left: 3px solid #dc2626;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 4px;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--color-primary, #4a9eff);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover, #3a8eef);
        }

        .btn-secondary {
          background: var(--color-bg-tertiary, #2a2a2a);
          color: var(--color-text-primary, #fff);
          border: 1px solid var(--color-border, #333);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--color-bg-secondary, #3a3a3a);
        }

        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default CharacterImportModal;
