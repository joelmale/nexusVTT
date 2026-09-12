import React from 'react';
import { useSceneBackgroundImage } from '@/stores/scene';

interface SceneBackgroundProps {
  sceneId: string;
}

/**
 * Background image layer.
 *
 * A5: self-subscribes to the scene's background image via the narrow
 * `useSceneBackgroundImage` slice instead of receiving it as a prop from
 * SceneCanvas. Renders nothing when the scene has no background (that
 * conditional previously lived in SceneCanvas). With `React.memo` and a
 * single stable string prop, a token move never re-renders this component:
 * Immer keeps `scene.backgroundImage` reference-identical across token
 * writes, so the subscription doesn't fire and the memo bails out.
 */
export const SceneBackground: React.FC<SceneBackgroundProps> = React.memo(
  ({ sceneId }) => {
    const backgroundImage = useSceneBackgroundImage(sceneId);

    // Handle error state (hook must run unconditionally, before the
    // no-background early return below)
    const [imageError, setImageError] = React.useState(false);

    if (!backgroundImage) return null;

    const {
      url,
      width,
      height,
      offsetX = 0,
      offsetY = 0,
      scale = 1,
    } = backgroundImage;

    // Set reasonable defaults for background sizing
    const bgWidth = width || 1920;
    const bgHeight = height || 1080;
    const bgOffsetX = offsetX || -(bgWidth * scale) / 2;
    const bgOffsetY = offsetY || -(bgHeight * scale) / 2;

    const handleImageError = (
      e: React.SyntheticEvent<SVGImageElement, Event>,
    ) => {
      console.error('🖼️ Image load error:', {
        url: url.substring(0, 100) + '...',
        error: e,
      });
      setImageError(true);
    };

    const handleImageLoad = () => {
      setImageError(false);
    };

    if (imageError) {
      return (
        <g className="scene-background">
          <rect
            x={bgOffsetX}
            y={bgOffsetY}
            width={bgWidth * scale}
            height={bgHeight * scale}
            fill="#1a1a2e"
            opacity={0.8}
          />
          <text x={0} y={0} fill="#ff6b6b" fontSize="24" textAnchor="middle">
            ⚠️ Failed to load background image
          </text>
        </g>
      );
    }

    return (
      <g className="scene-background">
        <image
          href={url}
          xlinkHref={url}
          x={bgOffsetX}
          y={bgOffsetY}
          width={bgWidth * scale}
          height={bgHeight * scale}
          preserveAspectRatio="xMidYMid slice"
          opacity={0.9}
          onError={handleImageError}
          onLoad={handleImageLoad}
          crossOrigin="anonymous"
        />
      </g>
    );
  },
);

SceneBackground.displayName = 'SceneBackground';
