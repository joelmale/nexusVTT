import { useState, useCallback } from 'react';
import { codexUploadDocument, DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_MAX_BYTES, documentUploadProblem } from '@/lib/codexUpload';
import { useCan } from '@/auth/AuthContext';
import { permissionHint } from '@/auth/permissions';
import { errorText } from '@/lib/ui';
import { formatBytes } from '@/lib/assetsApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

import { Badge } from '../components/ui/badge';
import { Upload, File, CheckCircle, XCircle } from 'lucide-react';

interface UploadFile {
  file: File;
  title: string;
  description: string;
  type: string;
  tags: string[];
  campaigns: string[];
  collections: string[];
  preview?: {
    mimeType: string;
    thumbnailUrl?: string;
    size: number;
  };
}

interface UploadOutcome {
  fileName: string;
  success: boolean;
  document?: { id: string; title: string; status?: string };
  error?: string;
}

/**
 * Uploads each file through control-api (`POST /codex/documents/upload`),
 * which stores the bytes server side and queues processing. The browser never
 * talks to object storage.
 */
export default function BulkUpload() {
  const canUpload = useCan('uploadDocuments');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadOutcome[] | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const newFiles: UploadFile[] = selectedFiles.map(file => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      description: '',
      type: 'rulebook', // Default type
      tags: [],
      campaigns: [],
      collections: [],
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const updateFile = (index: number, updates: Partial<UploadFile>) => {
    setFiles(prev => prev.map((file, i) => i === index ? { ...file, ...updates } : file));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generatePreviews = async () => {
    // Basic file info only; thumbnails are produced by doc-processor after upload.
    setFiles(prev => prev.map(file => ({
      ...file,
      preview: {
        mimeType: file.file.type || 'application/octet-stream',
        size: file.file.size,
      },
    })));
  };

  const problems = files.map(file => documentUploadProblem(file.file));
  const hasProblems = problems.some(Boolean);

  const uploadFiles = async () => {
    if (files.length === 0 || hasProblems) return;

    setIsUploading(true);
    setUploadProgress(0);
    const outcomes: UploadOutcome[] = [];
    const failedFiles: UploadFile[] = [];

    for (const [index, file] of files.entries()) {
      try {
        const document = await codexUploadDocument(file.file, {
          title: file.title,
          description: file.description,
          type: file.type,
          tags: file.tags,
          campaigns: file.campaigns,
          collections: file.collections,
        });
        outcomes.push({ fileName: file.file.name, success: true, document });
      } catch (error) {
        outcomes.push({ fileName: file.file.name, success: false, error: errorText(error) });
        failedFiles.push(file);
      }
      setUploadProgress(((index + 1) / files.length) * 100);
    }

    setUploadResults(outcomes);
    // Keep only the files that failed so they can be retried.
    setFiles(failedFiles);
    setIsUploading(false);
  };

  const successful = uploadResults?.filter(result => result.success).length ?? 0;
  const failed = (uploadResults?.length ?? 0) - successful;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Upload</h1>
        <p className="text-gray-600">Upload multiple documents at once with batch processing</p>
      </div>

      {/* File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Select Files
          </CardTitle>
          <CardDescription>
            Choose PDF or Markdown files, up to {formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)} each
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="file"
              multiple
              accept={DOCUMENT_UPLOAD_ACCEPT}
              aria-label="Documents to upload"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <div className="flex gap-2">
              <Button
                onClick={generatePreviews}
                disabled={files.length === 0 || isUploading}
                variant="outline"
              >
                Generate Previews
              </Button>
              <Button
                onClick={uploadFiles}
                disabled={!canUpload || files.length === 0 || hasProblems || isUploading}
                title={canUpload ? undefined : permissionHint('uploadDocuments')}
              >
                {isUploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Upload Progress</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Files to Upload ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4" />
                        <span className="font-medium">{file.file.name}</span>
                        <Badge variant="secondary">{file.preview?.mimeType || 'Unknown'}</Badge>
                        <span className="text-sm text-gray-500">
                          {(file.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      {problems[index] && (
                        <p role="alert" className="text-sm text-red-600">{problems[index]}</p>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Title"
                          value={file.title}
                          onChange={(e) => updateFile(index, { title: e.target.value })}
                        />
                        <Input
                          placeholder="Description"
                          value={file.description}
                          onChange={(e) => updateFile(index, { description: e.target.value })}
                        />
                      </div>

                      {file.preview?.thumbnailUrl && (
                        <img
                          src={file.preview.thumbnailUrl}
                          alt="Preview"
                          className="w-32 h-32 object-cover rounded border"
                        />
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Results</CardTitle>
            <CardDescription>
              Uploaded documents are queued for processing; follow them on the Processing page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {successful} Successful
                </Badge>
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {failed} Failed
                </Badge>
              </div>

              {uploadResults.map((result, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded" data-testid="upload-result">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="flex-1">
                    {result.document?.title || result.fileName}
                  </span>
                  {result.success && result.document?.status && (
                    <span className="text-sm text-gray-600">{result.document.status}</span>
                  )}
                  {!result.success && (
                    <span className="text-sm text-red-600">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
