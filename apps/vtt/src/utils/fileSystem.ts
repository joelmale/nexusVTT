// File System Utilities for Admin Panel
// Handles saving generated code to files with backup and versioning

export interface FileSaveOptions {
  createBackup?: boolean;
  backupSuffix?: string;
  encoding?: string;
}

export interface FileSaveResult {
  success: boolean;
  message: string;
  backupPath?: string;
  filePath?: string;
}

interface FileSystemWindow extends Window {
  showSaveFilePicker: (options?: { suggestedName: string; types: { description: string; accept: { [key: string]: string[] } }[] }) => Promise<FileSystemFileHandle>;
}

export class FileSystemManager {
  private backups: Map<string, string> = new Map();

  // Check if File System Access API is supported
  private isFileSystemAccessSupported(): boolean {
    return 'showSaveFilePicker' in window;
  }

  // Save file using File System Access API (modern browsers)
  private async saveWithFileSystemAccess(
    content: string,
    suggestedName: string,
    _options: FileSaveOptions = {},
  ): Promise<FileSaveResult> {
    try {
      const fileHandle = await (window as unknown as FileSystemWindow).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'TypeScript Files',
            accept: { 'text/typescript': ['.ts'] },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return {
        success: true,
        message: `File saved successfully: ${suggestedName}`,
        filePath: suggestedName,
      };
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        return {
          success: false,
          message: 'File save was cancelled by user',
        };
      }
      throw error;
    }
  }

  // Fallback: Download file using blob
  private downloadAsBlob(content: string, filename: string): FileSaveResult {
    try {
      const blob = new Blob([content], {
        type: 'text/typescript;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      return {
        success: true,
        message: `File downloaded: ${filename}. Please manually save it to the project.`,
        filePath: filename,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to download file: ${error}`,
      };
    }
  }

  // Create backup of existing content
  private createBackup(filename: string, content: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${filename}.backup.${timestamp}`;
    this.backups.set(backupFilename, content);
    return backupFilename;
  }

  // Save file with backup creation
  async saveFile(
    content: string,
    filename: string,
    options: FileSaveOptions = {},
  ): Promise<FileSaveResult> {
    const { createBackup = true } = options;

    try {
      // Create backup if requested
      let backupPath: string | undefined;
      if (createBackup) {
        backupPath = this.createBackup(filename, content);
      }

      // Try modern File System Access API first
      if (this.isFileSystemAccessSupported()) {
        const result = await this.saveWithFileSystemAccess(
          content,
          filename,
          options,
        );
        if (result.success) {
          return {
            ...result,
            backupPath,
          };
        }
      }

      // Fallback to download
      const result = this.downloadAsBlob(content, filename);
      return {
        ...result,
        backupPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save file: ${error}`,
      };
    }
  }

  // Get backup content
  getBackup(filename: string): string | undefined {
    return this.backups.get(filename);
  }

  // List all backups
  listBackups(): string[] {
    return Array.from(this.backups.keys());
  }

  // Clear old backups (keep only recent ones)
  clearOldBackups(keepCount: number = 10): void {
    const backupFiles = this.listBackups().sort().reverse(); // Most recent first

    if (backupFiles.length > keepCount) {
      const toRemove = backupFiles.slice(keepCount);
      toRemove.forEach((filename) => this.backups.delete(filename));
    }
  }

  // Validate file content (basic TypeScript syntax check)
  validateTypeScriptContent(content: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic validation - check for common syntax issues
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for unclosed brackets, braces, etc.
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;

      if (
        openBrackets !== closeBrackets ||
        openBraces !== closeBraces ||
        openParens !== closeParens
      ) {
        errors.push(
          `Line ${index + 1}: Possible syntax error - mismatched brackets/braces/parentheses`,
        );
      }

      // Check for common issues
      if (line.includes('undefined') && !line.includes('//')) {
        errors.push(
          `Line ${index + 1}: Found 'undefined' - may indicate incomplete data`,
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let fileSystemInstance: FileSystemManager | null = null;

export function getFileSystemManager(): FileSystemManager {
  if (!fileSystemInstance) {
    fileSystemInstance = new FileSystemManager();
  }
  return fileSystemInstance;
}

// Utility function to generate filename from data type
export function getDataFilename(dataType: string): string {
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${dataType}-data-${timestamp}.ts`;
}
