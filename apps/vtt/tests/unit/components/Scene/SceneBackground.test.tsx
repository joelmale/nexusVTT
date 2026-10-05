import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { SceneBackground } from '@/components/Scene/SceneBackground';
import * as sceneSlices from '@/stores/scene';

vi.mock('@/stores/scene', () => ({
  useSceneBackgroundImage: vi.fn(),
}));

describe('SceneBackground component', () => {
  it('renders nothing when there is no background image', () => {
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockReturnValue(undefined);

    const { container } = render(
      <svg>
        <SceneBackground sceneId="scene-1" />
      </svg>,
    );

    expect(container.querySelector('.scene-background')).toBeNull();
  });

  it('renders widescreen background image with preserveAspectRatio and centered offsets', () => {
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockReturnValue({
      url: 'https://cdn.nexusvtt.com/maps/wide-dungeon.webp',
      width: 1920,
      height: 1080,
      offsetX: -960,
      offsetY: -540,
      scale: 1,
    });

    const { container } = render(
      <svg>
        <SceneBackground sceneId="scene-1" />
      </svg>,
    );

    const image = container.querySelector('image');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('href')).toBe(
      'https://cdn.nexusvtt.com/maps/wide-dungeon.webp',
    );
    expect(image?.getAttribute('width')).toBe('1920');
    expect(image?.getAttribute('height')).toBe('1080');
    expect(image?.getAttribute('x')).toBe('-960');
    expect(image?.getAttribute('y')).toBe('-540');
    expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('preserves exact 0 offset values rather than falling back to centered calculation', () => {
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockReturnValue({
      url: 'https://cdn.nexusvtt.com/maps/wide-dungeon.webp',
      width: 2560,
      height: 1440,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });

    const { container } = render(
      <svg>
        <SceneBackground sceneId="scene-1" />
      </svg>,
    );

    const image = container.querySelector('image');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('x')).toBe('0');
    expect(image?.getAttribute('y')).toBe('0');
    expect(image?.getAttribute('width')).toBe('2560');
    expect(image?.getAttribute('height')).toBe('1440');
  });

  it('renders fallback rectangle and error message when image fails to load', () => {
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockReturnValue({
      url: 'https://cdn.nexusvtt.com/maps/broken.webp',
      width: 1920,
      height: 1080,
      offsetX: -960,
      offsetY: -540,
      scale: 1,
    });

    const { container } = render(
      <svg>
        <SceneBackground sceneId="scene-1" />
      </svg>,
    );

    const image = container.querySelector('image');
    expect(image).not.toBeNull();

    fireEvent.error(image!);

    const rect = container.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('width')).toBe('1920');
    expect(rect?.getAttribute('height')).toBe('1080');
    expect(screen.getByText(/Failed to load background image/)).toBeInTheDocument();
  });

  it('triggers onLoad handler to clear any previous error state', () => {
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockReturnValue({
      url: 'https://cdn.nexusvtt.com/maps/wide-dungeon.webp',
      width: 1920,
      height: 1080,
    });

    const { container } = render(
      <svg>
        <SceneBackground sceneId="scene-1" />
      </svg>,
    );

    const image = container.querySelector('image');
    expect(image).not.toBeNull();
    fireEvent.load(image!);
    expect(container.querySelector('.scene-background')).not.toBeNull();
  });

  it('uses default dimensions and offsets when width and height are omitted', () => {
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockReturnValue({
      url: 'https://cdn.nexusvtt.com/maps/wide-dungeon.webp',
    });

    const { container } = render(
      <svg>
        <SceneBackground sceneId="scene-1" />
      </svg>,
    );

    const image = container.querySelector('image');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('width')).toBe('1920');
    expect(image?.getAttribute('height')).toBe('1080');
    expect(image?.getAttribute('x')).toBe('-960');
    expect(image?.getAttribute('y')).toBe('-540');
  });
});

