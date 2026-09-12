import React from 'react';

/**
 * @file Placeholder.tsx
 * @description A temporary component used to display a "coming soon" message for features under development.
 * It helps in scaffolding the UI and showing users what to expect in future updates.
 */

interface PlaceholderProps {
  /** The title of the feature area (e.g., "Tokens", "Scene"). This determines which list of planned features is displayed. */
  title: string;
}

/**
 * Renders a placeholder UI for features that are not yet implemented.
 * It dynamically displays a list of planned sub-features based on the `title` prop,
 * providing a mini-roadmap directly in the UI. This component should be replaced
 * with the actual feature component once it is developed.
 *
 * @param {PlaceholderProps} props - The component props.
 */
export const Placeholder: React.FC<PlaceholderProps> = ({ title }) => {
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p>This feature is coming soon!</p>
      <div className="placeholder-content">
        <div className="placeholder-card">
          <h3>Planned Features</h3>
          <ul>
            {/* Dynamically render a list of planned features based on the placeholder's title. */}
            {/* As features are implemented, the corresponding component will replace this placeholder, */}
            {/* and this list can be removed or updated. */}
            {title === 'Scenes' && (
              <>
                <li>Interactive battle maps</li>
                <li>Grid system with measurements</li>
                <li>Background image support</li>
                <li>Drawing tools and annotations</li>
                <li>Fog of war and lighting</li>
              </>
            )}
            {title === 'Tokens' && (
              <>
                <li>Character and NPC tokens</li>
                <li>Token library and management</li>
                <li>Health and status tracking</li>
                <li>Initiative order management</li>
                <li>Token movement and positioning</li>
              </>
            )}
            {title === 'Chat' && (
              <>
                <li>Public messages for general table talk</li>
                <li>Private whispers to specific players</li>
                <li>DM announcements with special styling</li>
                <li>Roll result integration and history</li>
                <li>Message typing indicators and timestamps</li>
              </>
            )}
            {title === 'Props' && (
              <>
                <li>Furniture and decorations</li>
                <li>Interactive objects</li>
                <li>Environmental effects</li>
                <li>Custom prop creation</li>
              </>
            )}
            {title === 'Initiative Tracker' && (
              <>
                <li>Turn order management</li>
                <li>Combat round tracking</li>
                <li>Integration with token health/status</li>
                <li>Customizable initiative rules</li>
              </>
            )}
            {title === 'Sound Effects' && (
              <>
                <li>Ambient soundscapes</li>
                <li>Sound effect library</li>
                <li>Background music playback</li>
                <li>Volume and playback controls</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
