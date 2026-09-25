import React, { useState } from 'react';
import type { PanelComponentProps } from '@/services/panelRegistry';
import { useCharacterStore } from '@/stores/characterStore';
import { commandClient } from '@/services/commandClient';
import Package from 'lucide-react/dist/esm/icons/package';
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Zap from 'lucide-react/dist/esm/icons/zap';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Check from 'lucide-react/dist/esm/icons/check';
import styles from './InventoryPanel.module.css';

interface ItemViewData {
  instanceId: string;
  name: string;
  quantity: number;
  isEquipped: boolean;
  isAttuned: boolean;
  currentCharges?: number;
  maxCharges?: number;
  itemKind: 'weapon' | 'armor' | 'consumable' | 'book' | 'wondrous';
  bookNotes?: string;
}

export const InventoryPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const characters = useCharacterStore((state) => state.characters);
  const character = characters.find((c) => c.id === link.id);

  const campaignId = link.campaignId || 'default-campaign';
  const actorId = link.id;

  const [items, setItems] = useState<ItemViewData[]>([
    {
      instanceId: 'item-wand-magic-missiles',
      name: 'Wand of Magic Missiles',
      quantity: 1,
      isEquipped: true,
      isAttuned: true,
      currentCharges: 7,
      maxCharges: 7,
      itemKind: 'wondrous',
    },
    {
      instanceId: 'item-potion-healing',
      name: 'Potion of Healing',
      quantity: 3,
      isEquipped: false,
      isAttuned: false,
      itemKind: 'consumable',
    },
    {
      instanceId: 'item-travelers-spellbook',
      name: "Traveler's Spellbook",
      quantity: 1,
      isEquipped: true,
      isAttuned: false,
      itemKind: 'book',
      bookNotes: 'Contains 12 transcribed spells.',
    },
    {
      instanceId: 'item-longsword',
      name: 'Longsword +1',
      quantity: 1,
      isEquipped: true,
      isAttuned: false,
      itemKind: 'weapon',
    },
  ]);

  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [activeTransferItemId, setActiveTransferItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  const otherCharacters = characters.filter((c) => c.id !== actorId);

  const getItemIcon = (kind: ItemViewData['itemKind']) => {
    switch (kind) {
      case 'armor':
      case 'weapon':
        return <Shield size={16} />;
      case 'book':
        return <BookOpen size={16} />;
      case 'wondrous':
        return <Zap size={16} />;
      default:
        return <Package size={16} />;
    }
  };

  const handleStartTransfer = (item: ItemViewData) => {
    setActiveTransferItemId(item.instanceId);
    setTransferQuantity(1);
    if (otherCharacters.length > 0) {
      setTransferTargetId(otherCharacters[0].id);
    } else {
      setTransferTargetId('');
    }
    setStatusMessage(null);
  };

  const handleExecuteTransfer = async (item: ItemViewData) => {
    if (!transferTargetId) {
      setStatusMessage({ text: 'Please select a recipient actor.', isError: true });
      return;
    }

    try {
      const res = await commandClient.transferItem(campaignId, item.instanceId, {
        sourceActorId: actorId,
        targetActorId: transferTargetId,
        quantity: transferQuantity,
      });

      if (res.success) {
        setItems((prev) =>
          prev
            .map((i) => {
              if (i.instanceId === item.instanceId) {
                const remaining = i.quantity - transferQuantity;
                return remaining > 0 ? { ...i, quantity: remaining } : null;
              }
              return i;
            })
            .filter((i): i is ItemViewData => i !== null),
        );

        setActiveTransferItemId(null);
        setStatusMessage({
          text: `Transferred ${transferQuantity}x ${item.name} successfully.`,
        });
      } else {
        setStatusMessage({ text: 'Transfer failed.', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error executing item transfer.', isError: true });
    }
  };

  const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className={styles.container} data-testid="inventory-panel">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>
            <Package size={20} />
            {character ? `${character.name}'s Inventory` : link.title || 'Inventory'}
          </h2>
          <div className={styles.subtitle}>Physical Artifacts & Containers</div>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Items</span>
            <span className={styles.statValue}>{totalItemCount}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Slots</span>
            <span className={styles.statValue}>{items.length}</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`${styles.statusMessage} ${
            statusMessage.isError ? styles.statusError : styles.statusSuccess
          }`}
          data-testid="inventory-status"
        >
          {statusMessage.text}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.itemList} data-testid="item-list">
          {items.map((item) => (
            <div
              key={item.instanceId}
              className={styles.itemCard}
              data-testid={`item-card-${item.instanceId}`}
            >
              <div className={styles.itemMainRow}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemIcon}>{getItemIcon(item.itemKind)}</div>
                  <div className={styles.itemDetails}>
                    <div className={styles.itemNameRow}>
                      <span className={styles.itemName}>{item.name}</span>
                      {item.quantity > 1 && (
                        <span className={styles.itemQuantity}>x{item.quantity}</span>
                      )}
                      {item.isEquipped && (
                        <span className={`${styles.badge} ${styles.equippedBadge}`}>
                          Equipped
                        </span>
                      )}
                      {item.isAttuned && (
                        <span className={`${styles.badge} ${styles.attunedBadge}`}>
                          Attuned
                        </span>
                      )}
                    </div>
                    <div className={styles.itemMeta}>
                      <span>{item.itemKind.toUpperCase()}</span>
                      {item.currentCharges !== undefined && (
                        <span>
                          {item.currentCharges}/{item.maxCharges} Charges
                        </span>
                      )}
                      {item.bookNotes && <span>{item.bookNotes}</span>}
                    </div>
                  </div>
                </div>

                <div className={styles.itemRight}>
                  <button
                    onClick={() =>
                      activeTransferItemId === item.instanceId
                        ? setActiveTransferItemId(null)
                        : handleStartTransfer(item)
                    }
                    className={styles.transferBtn}
                    data-testid={`transfer-btn-${item.instanceId}`}
                  >
                    <ArrowRightLeft size={13} />
                    Transfer
                  </button>
                </div>
              </div>

              {/* Inline Transfer Form */}
              {activeTransferItemId === item.instanceId && (
                <div className={styles.transferForm} data-testid="transfer-form">
                  <div className={styles.transferInputs}>
                    <input
                      type="number"
                      min="1"
                      max={item.quantity}
                      value={transferQuantity}
                      onChange={(e) =>
                        setTransferQuantity(
                          Math.min(
                            item.quantity,
                            Math.max(1, parseInt(e.target.value, 10) || 1),
                          ),
                        )
                      }
                      className={`${styles.input} ${styles.qtyInput}`}
                      data-testid="transfer-qty-input"
                    />

                    {otherCharacters.length > 0 ? (
                      <select
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value)}
                        className={`${styles.input} ${styles.targetSelect}`}
                        data-testid="transfer-target-select"
                      >
                        {otherCharacters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Recipient Actor UUID"
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value)}
                        className={`${styles.input} ${styles.targetSelect}`}
                        data-testid="transfer-target-input"
                      />
                    )}

                    <button
                      onClick={() => handleExecuteTransfer(item)}
                      className={styles.confirmTransferBtn}
                      disabled={!transferTargetId}
                      data-testid="confirm-transfer-btn"
                    >
                      <Check size={14} />
                      Send
                    </button>

                    <button
                      onClick={() => setActiveTransferItemId(null)}
                      className={styles.cancelTransferBtn}
                      data-testid="cancel-transfer-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
