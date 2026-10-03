import React, { useState, useEffect, useRef } from 'react';
import type { Token } from '@/types/token';
import { getTokenPixelSize } from '@/types/token';
import { useActiveTool, useGameStore } from '@/stores/gameStore';
import { useTransientDrag } from '@/hooks/useTransientDrag';
import { useTokenRenderData } from '@/stores/scene';
import { tokenAssetManager } from '@/services/tokenAssets';
import { TokenContextMenu } from '../Tokens/TokenContextMenu';
import { Icon } from '@/components/Common/Icon';
import { getConditionById } from '@/types/initiative';

interface TokenRendererProps {
  placedTokenId: string;
  gridSize: number;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  /** Called exactly once, on gesture release, with the final world position. */
  onMoveEnd: (id: string, position: { x: number; y: number }) => void;
  onRotate?: (id: string, rotation: number) => void;
  /** Host sees hidden tokens and can edit all; used with currentUserId for canEdit. */
  isHost: boolean;
  currentUserId: string;
  sceneId?: string;
}

/**
 * Renders a placed token on the scene canvas.
 *
 * A5: self-subscribes to its own token record via `useTokenRenderData`
 * instead of receiving the full `PlacedToken` object as a prop from the
 * parent's `.map()`. This is the core isolation guarantee: SceneCanvas no
 * longer holds `placedTokens` at all, so a token move only re-renders THIS
 * component (the one whose id changed) — siblings, grid, and background are
 * untouched. The base `Token` asset lookup and the visibility/canEdit
 * checks (previously done in the parent's map) also live here now, since
 * they need per-token record fields the parent no longer subscribes to.
 */
export const TokenRenderer: React.FC<TokenRendererProps> = React.memo(
  ({
    placedTokenId,
    gridSize,
    isSelected,
    onSelect,
    onMoveEnd,
    isHost,
    currentUserId,
    sceneId,
  }) => {
    const activeTool = useActiveTool();
    const setActiveTool = useGameStore((state) => state.setActiveTool);
    const placedToken = useTokenRenderData(placedTokenId);
    const [, setAssetRevision] = useState(0);

    useEffect(() => {
      const handleAssetUpdate = (event: Event) => {
        const tokenId = (event as CustomEvent<{ tokenId?: string }>).detail
          ?.tokenId;
        if (!tokenId || tokenId === placedToken?.tokenId) {
          setAssetRevision((revision) => revision + 1);
        }
      };
      window.addEventListener('token-assets-updated', handleAssetUpdate);
      return () =>
        window.removeEventListener('token-assets-updated', handleAssetUpdate);
    }, [placedToken?.tokenId]);

    // Resolve the base token asset (synchronous in-memory lookup; the
    // parent gates the whole layer behind `assetsReady`, same as before).
    const token: Token | undefined = placedToken
      ? tokenAssetManager.getTokenById(placedToken.tokenId) ?? undefined
      : undefined;

    const canEdit = isHost || placedToken?.placedBy === currentUserId;
    const [isDragging, setIsDragging] = useState(false);
    const imageRef = useRef<SVGImageElement>(null);

    // Calculate token size in pixels
    const tokenSize =
      placedToken && token
        ? getTokenPixelSize(token.size, gridSize) * placedToken.scale
        : 0;

    // Only handle interactions when select tool is active (select tool combines select + move)
    const canInteract = canEdit && activeTool === 'select';

    // Debug logging for selected tokens
    useEffect(() => {
      if (isSelected) {
        console.log(`🎯 Token ${placedTokenId} selected:`, {
          tokenName: token?.name,
          canEdit,
          activeTool,
          canInteract,
          isSelected,
        });
      }
    }, [isSelected, canEdit, activeTool, canInteract, placedTokenId, token?.name]);

    // Transient drag: imperative rAF-batched `transform` writes during the
    // gesture (no setState/store writes), exactly one commit on release.
    const { onPointerDown: onDragPointerDown } = useTransientDrag({
      getStartPosition: () => ({
        x: placedToken?.x ?? 0,
        y: placedToken?.y ?? 0,
      }),
      rotation: placedToken?.rotation ?? 0,
      disabled: !canInteract || !placedToken,
      onCommit: (position) => {
        setIsDragging(false);
        if (imageRef.current) {
          imageRef.current.style.opacity = '1';
        }
        onMoveEnd(placedTokenId, position);
      },
    });

    const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
      console.log('🖱️ Token pointerDown:', {
        canInteract,
        tokenId: placedTokenId,
        activeTool,
        canEdit,
        isSelected,
        button: e.button,
      });
      if (!canInteract) {
        console.log('❌ canInteract is false, returning early');
        return;
      }

      // Only handle left-click
      if (e.button !== 0) {
        console.log('❌ Not left-click, ignoring');
        return;
      }

      e.stopPropagation();
      console.log('✅ stopPropagation called, event won\'t reach DrawingTools');

      // Select this token (or add to multi-select with Shift/Cmd/Ctrl)
      const isMultiSelect = e.shiftKey || e.metaKey || e.ctrlKey;
      console.log('🎯 Calling onSelect:', {
        tokenId: placedTokenId,
        isMultiSelect,
        isSelected,
      });
      onSelect(placedTokenId, isMultiSelect);

      // Start dragging if already selected or just selected (and not locked)
      const isTokenLocked = !!(
        placedToken?.locked || placedToken?.currentStats?.locked
      );
      if (!isTokenLocked && (isSelected || !isMultiSelect)) {
        console.log('🚀 Starting drag for token:', placedTokenId);
        setIsDragging(true);
        if (imageRef.current) {
          imageRef.current.style.opacity = '0.7';
        }
        onDragPointerDown(e);
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (canInteract) {
        if (activeTool !== 'select') {
          setActiveTool('select');
        }
        onSelect(placedTokenId, false);
      }
    };

    // Token was removed from the store (deleted) between the id list and
    // this subscription resolving, or the base asset is unknown - render
    // nothing rather than crash (same behavior as the old parent-side map).
    if (!placedToken || !token) return null;

    // Visibility filter (previously in the parent's map): players don't see
    // hidden tokens.
    if (!isHost && !placedToken.visibleToPlayers) return null;

    const effectiveName =
      placedToken.nameOverride || token.name || 'Unknown Token';

    const rawHp = placedToken.currentStats?.hp ?? token.stats?.hp;
    const rawMaxHp =
      (placedToken.currentStats?.maxHp as number | undefined) ??
      (token.stats?.maxHp as number | undefined) ??
      (token.stats?.hp as number | undefined);

    const hpStats =
      typeof rawHp === 'number'
        ? {
            current: rawHp,
            max:
              typeof rawMaxHp === 'number' && rawMaxHp > 0
                ? rawMaxHp
                : Math.max(1, rawHp),
          }
        : null;

    const barWidth = Math.max(24, tokenSize * 0.8);
    const barHeight = 4;
    const hpPercent = hpStats
      ? Math.max(0, Math.min(1, hpStats.current / hpStats.max))
      : 0;
    const fillWidth = barWidth * hpPercent;
    const hpColor =
      hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';

    const isTokenLocked = !!(
      placedToken.locked || placedToken.currentStats?.locked
    );

    const isGhost =
      isHost &&
      (!placedToken.visibleToPlayers ||
        placedToken.conditions.some((c) => c.id === 'invisible'));

    return (
      <>
        <g
          aria-label={`Token: ${effectiveName}`}
          data-token-id={placedTokenId}
          data-token-name={effectiveName}
          transform={`translate(${placedToken.x}, ${placedToken.y}) rotate(${placedToken.rotation})`}
          onPointerDown={handlePointerDown}
          onContextMenu={handleContextMenu}
          style={{
            cursor: canInteract
              ? isDragging
                ? 'grabbing'
                : isTokenLocked
                  ? 'not-allowed'
                  : 'grab'
              : 'default',
            pointerEvents: canInteract ? 'auto' : 'none',
            touchAction: canInteract ? 'none' : undefined,
          }}
        >
        {/* Token Image */}
        <image
          ref={imageRef}
          href={token.image}
          x={-tokenSize / 2}
          y={-tokenSize / 2}
          width={tokenSize}
          height={tokenSize}
          style={{
            opacity: isGhost ? 0.5 : 1,
            filter: placedToken.isDead ? 'grayscale(100%)' : 'none',
          }}
        />

        {/* DM Ghost / Stealth View indicator */}
        {isGhost && (
          <g data-testid="token-ghost-indicator">
            <circle
              cx={0}
              cy={0}
              r={tokenSize / 2 + 3}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4,4"
              opacity={0.9}
            />
            {/* DM Eye Badge in upper-left corner */}
            <g transform={`translate(${-tokenSize / 2 + 4}, ${-tokenSize / 2 + 4})`}>
              <circle
                cx={0}
                cy={0}
                r={9}
                fill="rgba(15, 23, 42, 0.85)"
                stroke="#38bdf8"
                strokeWidth={1}
              />
              <text
                x={0}
                y={3}
                textAnchor="middle"
                fontSize="11"
                dominantBaseline="central"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                👁️
              </text>
            </g>
          </g>
        )}

        {/* Dead indicator - Black X */}
        {placedToken.isDead && (
          <g>
            {/* X mark */}
            <line
              x1={-tokenSize / 3}
              y1={-tokenSize / 3}
              x2={tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#000"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <line
              x1={tokenSize / 3}
              y1={-tokenSize / 3}
              x2={-tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#000"
              strokeWidth={4}
              strokeLinecap="round"
            />
            {/* White outline for visibility */}
            <line
              x1={-tokenSize / 3}
              y1={-tokenSize / 3}
              x2={tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#fff"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.3}
            />
            <line
              x1={tokenSize / 3}
              y1={-tokenSize / 3}
              x2={-tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#fff"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.3}
            />
          </g>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <circle
            cx={0}
            cy={0}
            r={tokenSize / 2 + 5}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={3}
            strokeDasharray="5,5"
          />
        )}

        {/* Token border */}
        <circle
          cx={0}
          cy={0}
          r={tokenSize / 2}
          fill="none"
          stroke={placedToken.dmNotesOnly ? '#ff0000' : '#333'}
          strokeWidth={2}
          opacity={0.8}
        />

        {/* Dual Condition Aura Ring - Pulsing perimeter circle colored by primary condition */}
        {placedToken.conditions.length > 0 && (() => {
          const primaryCond = placedToken.conditions[0];
          const standardRule = getConditionById(primaryCond.id);
          const auraColor = primaryCond.color || standardRule?.color || '#a855f7';
          return (
            <circle
              data-testid="token-condition-aura"
              cx={0}
              cy={0}
              r={tokenSize / 2 + 5}
              fill="none"
              stroke={auraColor}
              strokeWidth={3}
              opacity={0.8}
              strokeDasharray="4,2"
              style={{
                filter: `drop-shadow(0 0 6px ${auraColor})`,
              }}
            />
          );
        })()}

        {/* Status Badges with custom Icon & 5e rule definitions */}
        {placedToken.conditions.length > 0 && (
          <g
            data-testid="token-conditions-badges"
            transform={`translate(${tokenSize / 2 - 2}, ${-tokenSize / 2 + 2})`}
          >
            {placedToken.conditions.slice(0, 4).map((condition, index) => {
              const rule = getConditionById(condition.id);
              const badgeSize = Math.max(18, Math.min(26, tokenSize * 0.35));
              const offset = index * (badgeSize + 4);
              const badgeColor = condition.color || rule?.color || '#6366f1';
              const description =
                rule?.description || condition.description || 'Active status condition';

              return (
                <g
                  key={condition.id || index}
                  transform={`translate(${-offset}, 0)`}
                  data-testid={`condition-badge-${condition.id}`}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={badgeSize / 2}
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={badgeColor}
                    strokeWidth={1.5}
                  />
                  <foreignObject
                    x={-badgeSize / 2 + 1}
                    y={-badgeSize / 2 + 1}
                    width={badgeSize - 2}
                    height={badgeSize - 2}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${badgeSize * 0.55}px`,
                      }}
                    >
                      <Icon
                        id={`condition:${condition.id.toLowerCase()}`}
                        fallback={condition.icon || rule?.icon || '🌀'}
                        size={Math.round(badgeSize - 4)}
                      />
                    </div>
                  </foreignObject>
                  <title>{`${condition.name}: ${description}`}</title>
                </g>
              );
            })}
          </g>
        )}

        {/* Token Health Bar (Synchronous SVG anchored directly inside canvas group - ADR-0005) */}
        {hpStats && (
          <g
            transform={`translate(${-barWidth / 2}, ${tokenSize / 2 + 4})`}
            data-testid="token-health-bar"
          >
            {/* Background track */}
            <rect
              x={0}
              y={0}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill="rgba(0, 0, 0, 0.75)"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth={0.5}
            />
            {/* Fill bar */}
            <rect
              x={0}
              y={0}
              width={fillWidth}
              height={barHeight}
              rx={2}
              fill={hpColor}
            />
            <title>{`HP: ${hpStats.current} / ${hpStats.max}`}</title>
          </g>
        )}

        {/* Token dead marker (Red X overlay) */}
        {placedToken.isDead && (
          <g data-testid="token-dead-marker">
            <line
              x1={-tokenSize * 0.35}
              y1={-tokenSize * 0.35}
              x2={tokenSize * 0.35}
              y2={tokenSize * 0.35}
              stroke="#ef4444"
              strokeWidth={Math.max(3, tokenSize * 0.08)}
              strokeLinecap="round"
            />
            <line
              x1={tokenSize * 0.35}
              y1={-tokenSize * 0.35}
              x2={-tokenSize * 0.35}
              y2={tokenSize * 0.35}
              stroke="#ef4444"
              strokeWidth={Math.max(3, tokenSize * 0.08)}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Token elevation badge (for flying/swimming) */}
        {typeof placedToken.elevation === 'number' &&
          placedToken.elevation !== 0 && (
            <g transform={`translate(${-tokenSize / 2}, ${-tokenSize / 2})`}>
              <rect
                x={-6}
                y={-14}
                width={42}
                height={14}
                rx={3}
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#38bdf8"
                strokeWidth={1}
              />
              <text
                x={15}
                y={-4}
                fill="#38bdf8"
                fontSize={9}
                fontWeight="bold"
                textAnchor="middle"
              >
                {placedToken.elevation > 0
                  ? `+${placedToken.elevation}ft`
                  : `${placedToken.elevation}ft`}
              </text>
            </g>
          )}

        {/* Token label */}
        {effectiveName ? (
          <text
            x={0}
            y={tokenSize / 2 + (hpStats ? 20 : 15)}
            textAnchor="middle"
            fill="#fff"
            stroke="#000"
            strokeWidth={2}
            paintOrder="stroke"
            fontSize={12}
            fontWeight="bold"
          >
            {effectiveName}
          </text>
        ) : null}
      </g>
      {isSelected && !isDragging && (
        <TokenContextMenu
          tokenId={placedTokenId}
          sceneId={sceneId}
          worldX={placedToken.x}
          worldY={placedToken.y}
          isDragging={isDragging}
          onEdit={() =>
            window.dispatchEvent(
              new CustomEvent('open-panel', { detail: 'tokens' }),
            )
          }
        />
      )}
    </>
  );
  },
);
