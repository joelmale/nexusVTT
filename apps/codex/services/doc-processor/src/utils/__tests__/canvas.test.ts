import { describe, expect, it } from 'vitest';
import {
  DOMMatrixPolyfill,
  ImageDataPolyfill,
  Path2DPolyfill,
  DOMPointPolyfill,
  ensureCanvasPolyfills,
  createCanvas,
  canvasBackend,
} from '../canvas';

describe('canvas utilities and polyfills', () => {
  describe('DOMMatrixPolyfill', () => {
    it('initializes default identity matrix', () => {
      const m = new DOMMatrixPolyfill();
      expect(m.a).toBe(1);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(1);
      expect(m.e).toBe(0);
      expect(m.f).toBe(0);
      expect(m.is2D).toBe(true);
      expect(m.isIdentity).toBe(true);
    });

    it('initializes from a 6-element array', () => {
      const m = new DOMMatrixPolyfill([2, 0, 0, 3, 10, 20]);
      expect(m.a).toBe(2);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(3);
      expect(m.e).toBe(10);
      expect(m.f).toBe(20);
      expect(m.is2D).toBe(true);
    });

    it('initializes from a 16-element array', () => {
      const m = new DOMMatrixPolyfill([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        5, 6, 7, 1,
      ]);
      expect(m.is2D).toBe(false);
      expect(m.m41).toBe(5);
      expect(m.m42).toBe(6);
      expect(m.m43).toBe(7);
      expect(m.e).toBe(5);
      expect(m.f).toBe(6);
    });

    it('initializes from an object with custom properties', () => {
      const m = new DOMMatrixPolyfill({
        a: 2,
        b: 1,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
      });
      expect(m.a).toBe(2);
      expect(m.b).toBe(1);
      expect(m.c).toBe(3);
      expect(m.d).toBe(4);
      expect(m.e).toBe(5);
      expect(m.f).toBe(6);
    });

    it('supports transform methods and returns instances', () => {
      const m = new DOMMatrixPolyfill();
      expect(m.multiply()).toBeInstanceOf(DOMMatrixPolyfill);
      expect(m.inverse()).toBeInstanceOf(DOMMatrixPolyfill);
      expect(m.translate(10, 20)).toBe(m);
      expect(m.scale(2, 2)).toBe(m);
      expect(m.rotate(45)).toBe(m);
      expect(m.transformPoint({ x: 5, y: 10 })).toEqual({
        x: 5,
        y: 10,
        z: 0,
        w: 1,
      });
      expect(m.transformPoint()).toEqual({
        x: 0,
        y: 0,
        z: 0,
        w: 1,
      });
    });

    it('supports static factory methods', () => {
      const fromObj = DOMMatrixPolyfill.fromMatrix({ a: 3, d: 3 });
      expect(fromObj.a).toBe(3);
      expect(fromObj.d).toBe(3);

      const f32 = new Float32Array([1, 2, 3, 4, 5, 6]);
      const fromF32 = DOMMatrixPolyfill.fromFloat32Array(f32);
      expect(fromF32.a).toBe(1);
      expect(fromF32.f).toBe(6);

      const f64 = new Float64Array([1, 0, 0, 1, 10, 20]);
      const fromF64 = DOMMatrixPolyfill.fromFloat64Array(f64);
      expect(fromF64.e).toBe(10);
      expect(fromF64.f).toBe(20);
    });
  });

  describe('ImageDataPolyfill', () => {
    it('creates an image data buffer with correct byte size', () => {
      const img = new ImageDataPolyfill(10, 20);
      expect(img.width).toBe(10);
      expect(img.height).toBe(20);
      expect(img.data.length).toBe(10 * 20 * 4);
      expect(img.data).toBeInstanceOf(Uint8ClampedArray);
    });

    it('defaults dimensions to 0', () => {
      const img = new ImageDataPolyfill();
      expect(img.width).toBe(0);
      expect(img.height).toBe(0);
      expect(img.data.length).toBe(0);
    });
  });

  describe('Path2DPolyfill', () => {
    it('implements stub path drawing methods without throwing', () => {
      const p = new Path2DPolyfill();
      expect(() => {
        p.addPath();
        p.moveTo();
        p.lineTo();
        p.bezierCurveTo();
        p.quadraticCurveTo();
        p.arc();
        p.arcTo();
        p.ellipse();
        p.rect();
        p.closePath();
      }).not.toThrow();
    });
  });

  describe('DOMPointPolyfill', () => {
    it('initializes with default coordinate values', () => {
      const pt = new DOMPointPolyfill();
      expect(pt.x).toBe(0);
      expect(pt.y).toBe(0);
      expect(pt.z).toBe(0);
      expect(pt.w).toBe(1);
    });

    it('initializes from static fromPoint', () => {
      const pt = DOMPointPolyfill.fromPoint({ x: 12, y: 34, z: 5, w: 2 });
      expect(pt.x).toBe(12);
      expect(pt.y).toBe(34);
      expect(pt.z).toBe(5);
      expect(pt.w).toBe(2);

      const emptyPt = DOMPointPolyfill.fromPoint();
      expect(emptyPt.x).toBe(0);
      expect(emptyPt.y).toBe(0);
      expect(emptyPt.z).toBe(0);
      expect(emptyPt.w).toBe(1);
    });
  });

  describe('ensureCanvasPolyfills', () => {
    it('ensures global objects are defined', () => {
      ensureCanvasPolyfills();
      const g = globalThis as Record<string, unknown>;
      expect(g.DOMMatrix).toBeDefined();
      expect(g.ImageData).toBeDefined();
      expect(g.Path2D).toBeDefined();
      expect(g.DOMPoint).toBeDefined();
    });
  });

  describe('exports', () => {
    it('exports createCanvas and canvasBackend', () => {
      expect(typeof createCanvas).toBe('function');
      expect(typeof canvasBackend).toBe('string');
    });
  });
});
