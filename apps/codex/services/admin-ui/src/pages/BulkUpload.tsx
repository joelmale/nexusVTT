import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

import { Badge } from '../components/ui/badge';
import { Upload, File, CheckCircle, XCircle, Clock } from 'lucide-react';

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

interface BulkUploadResult {
  batchId: string;
  results: Array<{
    document?: any;
    uploadUrl?: string;
    error?: string;
    fileName?: string;
    success: boolean;
  }>;
  total: number;
  successful: number;
  failed: number;
}

interface BulkStatus {
  batchId: string;
  total: number;
  processed: number;
  failed: number;
  processing: number;
  pending: number;
  documents: Array<{
    id: string;
    title: string;
    status: string;
    indexed: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

const API_BASE_URL = '';

export default function BulkUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<BulkUploadResult | null>(null);

  // Query for bulk upload status
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['bulk-status', currentBatchId],
    queryFn: async () => {
      if (!currentBatchId) return null;
      const response = await fetch(`${API_BASE_URL}/api/documents/bulk/${currentBatchId}/status`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json() as Promise<BulkStatus>;
    },
    enabled: !!currentBatchId,
    refetchInterval: currentBatchId ? 5000 : false, // Poll every 5 seconds
  });

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
    // This would call the preview API for each file
    // For now, just show basic file info
    setFiles(prev => prev.map(file => ({
      ...file,
      preview: {
        mimeType: file.file.type || 'application/octet-stream',
        size: file.file.size,
      },
    })));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Prepare bulk upload data
      const bulkData = {
        documents: files.map(file => ({
          title: file.title,
          description: file.description,
          type: file.type,
          format: file.file.name.split('.').pop() === 'md' ? 'markdown' : 'pdf',
          author: '',
          uploadedBy: 'admin', // This should come from user context
          tags: file.tags,
          campaigns: file.campaigns,
          collections: file.collections,
          isPublic: false,
          metadata: {},
          fileSize: file.file.size,
          fileName: file.file.name,
        })),
      };

      // Create bulk documents
      const response = await fetch(`${API_BASE_URL}/api/documents/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bulkData),
      });

      if (!response.ok) {
        throw new Error('Failed to create documents');
      }

      const result: BulkUploadResult = await response.json();
      setUploadResults(result);
      setCurrentBatchId(result.batchId);

      // Upload files to S3
      let uploaded = 0;
      for (const item of result.results) {
        if (item.uploadUrl && item.document) {
          const fileData = files.find(f => f.title === item.document.title);
          if (fileData) {
            try {
              await fetch(item.uploadUrl, {
                method: 'PUT',
                body: fileData.file,
                headers: {
                  'Content-Type': fileData.file.type || 'application/octet-stream',
                },
              });
              await fetch(`/api/documents/${item.document.id}/process`, {
                method: 'POST',
              });
            } catch (error) {
              console.error('Upload failed:', error);
            }
          }
        }
        uploaded++;
        setUploadProgress((uploaded / result.results.length) * 100);
      }

      // Clear files and refetch status
      setFiles([]);
      refetchStatus();
    } catch (error) {
      console.error('Bulk upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

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
            Choose multiple PDF or Markdown files to upload
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="file"
              multiple
              accept=".pdf,.md,.markdown"
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
                disabled={files.length === 0 || isUploading}
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
              Batch ID: {uploadResults.batchId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {uploadResults.successful} Successful
                </Badge>
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {uploadResults.failed} Failed
                </Badge>
              </div>

              {uploadResults.results.map((result, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="flex-1">
                    {result.document?.title || result.fileName}
                  </span>
                  {!result.success && (
                    <span className="text-sm text-red-600">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {statusData && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{statusData.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{statusData.processed}</div>
                  <div className="text-sm text-gray-600">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{statusData.processing}</div>
                  <div className="text-sm text-gray-600">Processing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{statusData.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>

              <div className="space-y-2">
                {statusData.documents.slice(0, 10).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="flex-1">{doc.title}</span>
                    <div className="flex items-center gap-2">
                      {doc.status === 'completed' && doc.indexed && (
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Indexed
                        </Badge>
                      )}
                      {doc.status === 'processing' && (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Processing
                        </Badge>
                      )}
                      {doc.status === 'failed' && (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
