// EXPORTS: IImageItem, TARGET_LONG_SIDE, SUPPORTED_FORMATS

export interface IImageItem {
  id: string;
  file: File;
  name: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  processedBlob: Blob | null;
  processedWidth: number;
  processedHeight: number;
  processedSize: number;
  status: 'pending' | 'processing' | 'done' | 'skipped' | 'error';
  errorMsg?: string;
  outputMimeType?: string;
}

export const TARGET_LONG_SIDE = 2048;

export const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
