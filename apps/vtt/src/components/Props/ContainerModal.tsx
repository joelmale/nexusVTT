import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import type { PlacedProp, ContainerItem } from '@/types/prop';
import './ContainerModal.css';

interface ContainerModalProps {
  placedProp: PlacedProp;
  sceneId: string;
  onClose: () => void;
  isHost: boolean;
}

export const ContainerModal: React.FC<ContainerModalProps> = ({
  placedProp,
  sceneId,
  onClose,
  isHost,
}) => {
  const { updateProp } = useGameStore();
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemDescription, setNewItemDescription] = useState('');

  const containerState = placedProp.currentStats?.state || 'closed';
  const isLocked = containerState === 'locked';
  const isOpen = containerState === 'open';
  const items = placedProp.currentStats?.contents || [];

  const canInteract = isHost || (isOpen && !isLocked);

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    if (!isHost) return; // Only DM can add items

    const newItem: ContainerItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newItemName.trim(),
      quantity: newItemQuantity,
      description: newItemDescription.trim() || undefined,
    };

    const updatedContents = [...items, newItem];

    updateProp(sceneId, placedProp.id, {
      currentStats: {
        ...placedProp.currentStats,
        contents: updatedContents,
      },
    });

    // Reset form
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemDescription('');
  };

  const handleRemoveItem = (itemId: string) => {
    if (!isHost) return; // Only DM can remove items

    const updatedContents = items.filter((item) => item.id !== itemId);

    updateProp(sceneId, placedProp.id, {
      currentStats: {
        ...placedProp.currentStats,
        contents: updatedContents,
      },
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    if (!canInteract) return;

    const updatedContents = items
      .map((item) => {
        if (item.id === itemId) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
      .filter((item) => item.quantity > 0); // Remove items with 0 quantity

    updateProp(sceneId, placedProp.id, {
      currentStats: {
        ...placedProp.currentStats,
        contents: updatedContents,
      },
    });
  };

  return (
    <div className="container-modal-overlay" onClick={onClose}>
      <div className="container-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="container-modal-header">
          <h3 className="container-modal-title">
            {placedProp.name || 'Container'}
          </h3>
          <div className="container-modal-status">
            {isLocked && <span className="status-badge locked">🔒 Locked</span>}
            {!isLocked && isOpen && <span className="status-badge open">🔓 Open</span>}
            {!isLocked && !isOpen && <span className="status-badge closed">🚪 Closed</span>}
          </div>
          <button className="container-modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Container State Message */}
        {isLocked && !isHost && (
          <div className="container-message locked-message">
            This container is locked. Only the DM can access its contents.
          </div>
        )}

        {!isOpen && !isLocked && !isHost && (
          <div className="container-message closed-message">
            This container is closed. Ask the DM to open it.
          </div>
        )}

        {/* Contents List */}
        {canInteract && (
          <div className="container-modal-body">
            <div className="container-contents">
              <h4 className="container-section-title">
                Contents ({items.length} item{items.length !== 1 ? 's' : ''})
              </h4>

              {items.length === 0 ? (
                <div className="container-empty">
                  <p>This container is empty.</p>
                </div>
              ) : (
                <div className="container-items-list">
                  {items.map((item) => (
                    <div key={item.id} className="container-item">
                      <div className="container-item-header">
                        <div className="container-item-name">
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="container-item-quantity"> ×{item.quantity}</span>
                          )}
                        </div>
                        {isHost && (
                          <button
                            className="container-item-remove"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remove item"
                          >
                            🗑️
                          </button>
                        )}
                      </div>

                      {item.description && (
                        <div className="container-item-description">{item.description}</div>
                      )}

                      <div className="container-item-actions">
                        <button
                          className="quantity-btn"
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          disabled={!canInteract}
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="quantity-value">{item.quantity}</span>
                        <button
                          className="quantity-btn"
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          disabled={!canInteract}
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Item Form (DM only) */}
        {isHost && (
          <div className="container-modal-footer">
            <h4 className="container-section-title">Add Item</h4>
            <div className="add-item-form">
              <div className="form-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem();
                  }}
                />
                <input
                  type="number"
                  className="form-input quantity-input"
                  placeholder="Qty"
                  min="1"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Description (optional)"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem();
                  }}
                />
              </div>
              <button className="add-item-btn" onClick={handleAddItem} disabled={!newItemName.trim()}>
                Add Item
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
