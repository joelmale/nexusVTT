type CanvasModule = {
  createCanvas: (width: number, height: number) => any;
  Image?: any;
  DOMMatrix?: any;
  ImageData?: any;
  Path2D?: any;
  DOMPoint?: any;
};

export class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;
  isIdentity = true;

  constructor(
    init?:
      | string
      | number[]
      | {
          a?: number;
          b?: number;
          c?: number;
          d?: number;
          e?: number;
          f?: number;
          m11?: number;
          m12?: number;
          m21?: number;
          m22?: number;
          m41?: number;
          m42?: number;
        },
  ) {
    if (Array.isArray(init)) {
      if (init.length === 6) {
        this.a = init[0];
        this.b = init[1];
        this.c = init[2];
        this.d = init[3];
        this.e = init[4];
        this.f = init[5];
        this.m11 = init[0];
        this.m12 = init[1];
        this.m21 = init[2];
        this.m22 = init[3];
        this.m41 = init[4];
        this.m42 = init[5];
      } else if (init.length === 16) {
        this.m11 = init[0];
        this.m12 = init[1];
        this.m13 = init[2];
        this.m14 = init[3];
        this.m21 = init[4];
        this.m22 = init[5];
        this.m23 = init[6];
        this.m24 = init[7];
        this.m31 = init[8];
        this.m32 = init[9];
        this.m33 = init[10];
        this.m34 = init[11];
        this.m41 = init[12];
        this.m42 = init[13];
        this.m43 = init[14];
        this.m44 = init[15];
        this.a = this.m11;
        this.b = this.m12;
        this.c = this.m21;
        this.d = this.m22;
        this.e = this.m41;
        this.f = this.m42;
        this.is2D = false;
      }
    } else if (init && typeof init === 'object') {
      if (init.a !== undefined) this.a = this.m11 = init.a;
      if (init.b !== undefined) this.b = this.m12 = init.b;
      if (init.c !== undefined) this.c = this.m21 = init.c;
      if (init.d !== undefined) this.d = this.m22 = init.d;
      if (init.e !== undefined) this.e = this.m41 = init.e;
      if (init.f !== undefined) this.f = this.m42 = init.f;
    }
  }

  multiply(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill();
  }

  inverse(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill();
  }

  translate(_tx = 0, _ty = 0, _tz = 0): DOMMatrixPolyfill {
    return this;
  }

  scale(_scaleX = 1, _scaleY = _scaleX, _scaleZ = 1): DOMMatrixPolyfill {
    return this;
  }

  rotate(_rotX = 0, _rotY = 0, _rotZ = 0): DOMMatrixPolyfill {
    return this;
  }

  transformPoint(point?: { x?: number; y?: number; z?: number; w?: number }): {
    x: number;
    y: number;
    z: number;
    w: number;
  } {
    return {
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      z: point?.z ?? 0,
      w: point?.w ?? 1,
    };
  }

  static fromMatrix(init?: unknown): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(init as any);
  }

  static fromFloat32Array(init: Float32Array): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(Array.from(init));
  }

  static fromFloat64Array(init: Float64Array): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(Array.from(init));
  }
}

export class ImageDataPolyfill {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width = 0, height = 0) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

export class Path2DPolyfill {
  addPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  arcTo(): void {}
  ellipse(): void {}
  rect(): void {}
}

export class DOMPointPolyfill {
  x = 0;
  y = 0;
  z = 0;
  w = 1;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static fromPoint(point?: {
    x?: number;
    y?: number;
    z?: number;
    w?: number;
  }): DOMPointPolyfill {
    return new DOMPointPolyfill(
      point?.x ?? 0,
      point?.y ?? 0,
      point?.z ?? 0,
      point?.w ?? 1,
    );
  }
}

let canvasModule: CanvasModule;
let canvasSource = 'canvas';

try {
  // Prefer napi-rs canvas if native bindings are present and functional
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const napi = require('@napi-rs/canvas');
  napi.createCanvas(1, 1);
  canvasModule = napi;
  canvasSource = '@napi-rs/canvas';
} catch {
  try {
    // Fall back to node-canvas compiled in the container
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCanvas = require('canvas');
    nodeCanvas.createCanvas(1, 1);
    canvasModule = nodeCanvas;
    canvasSource = 'canvas';

    // Patch require.cache for '@napi-rs/canvas' so that pdfjs-dist's internal
    // NodeCanvasFactory will resolve node-canvas instead of failing to find native bindings
    try {
      const napiPath = require.resolve('@napi-rs/canvas');
      require.cache[napiPath] = {
        id: napiPath,
        filename: napiPath,
        loaded: true,
        exports: nodeCanvas,
      } as any;
    } catch {
      // Ignore if resolve fails
    }
  } catch {
    canvasModule = {
      createCanvas: () => ({ getContext: () => ({}) }),
    };
    canvasSource = 'stub';
  }
}

export function ensureCanvasPolyfills(moduleToUse?: CanvasModule): void {
  const g = globalThis as unknown as Record<string, unknown>;

  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = moduleToUse?.DOMMatrix || DOMMatrixPolyfill;
  }
  if (typeof g.ImageData === 'undefined') {
    g.ImageData = moduleToUse?.ImageData || ImageDataPolyfill;
  }
  if (typeof g.Path2D === 'undefined') {
    g.Path2D = moduleToUse?.Path2D || Path2DPolyfill;
  }
  if (typeof g.DOMPoint === 'undefined') {
    g.DOMPoint = moduleToUse?.DOMPoint || DOMPointPolyfill;
  }
}

// Polyfill immediately on import so pdf-parse / pdfjs-dist can load without throwing
ensureCanvasPolyfills(canvasModule);

export const createCanvas = canvasModule.createCanvas;
export const CanvasImage = canvasModule.Image;
export const canvasBackend = canvasSource;

/**
 * Custom CanvasFactory for pdfjsLib.getDocument({ CanvasFactory: CustomCanvasFactory })
 * Ensures pdfjs-dist uses our configured canvas backend without relying on internal require('@napi-rs/canvas').
 */
export class CustomCanvasFactory {
  #enableHWA = false;

  constructor(options: { enableHWA?: boolean } = {}) {
    this.#enableHWA = options.enableHWA ?? false;
  }

  _createCanvas(width: number, height: number) {
    return createCanvas(width, height);
  }

  create(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    const canvas = this._createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext('2d', { willReadFrequently: !this.#enableHWA }),
    };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    if (!canvasAndContext?.canvas) {
      throw new Error('Canvas is not specified');
    }
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    if (!canvasAndContext?.canvas) {
      throw new Error('Canvas is not specified');
    }
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

