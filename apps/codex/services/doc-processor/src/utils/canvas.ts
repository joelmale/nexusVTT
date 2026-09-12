type CanvasModule = {
  createCanvas: (width: number, height: number) => any;
  Image?: any;
};

let canvasModule: CanvasModule;
let canvasSource = 'canvas';

try {
  // Prefer napi-rs canvas to match pdfjs node expectations.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  canvasModule = require('@napi-rs/canvas');
  canvasSource = '@napi-rs/canvas';
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  canvasModule = require('canvas');
}

export const createCanvas = canvasModule.createCanvas;
export const CanvasImage = canvasModule.Image;
export const canvasBackend = canvasSource;
