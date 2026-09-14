import React, { useState, useMemo } from 'react';
import { ShoppingCart, Minus, Plus, Coins, AlertTriangle, X, Info } from 'lucide-react';
import { loadNewPlayerShop } from '../../../services/dataService';
import { canAffordPurchase } from '../../../services/equipmentService';
import { ShopItem, PurchasedItem } from '../../../types/equipment';

interface EquipmentShopProps {
  startingGold: number;
  onPurchaseComplete: (purchasedItems: PurchasedItem[]) => void;
  onBack: () => void;
}

interface CartItem extends ShopItem {
  quantity: number;
}

export const EquipmentShop: React.FC<EquipmentShopProps> = ({
  startingGold,
  onPurchaseComplete,
  onBack
}) => {
  const shopInventory = loadNewPlayerShop();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [descriptionModal, setDescriptionModal] = useState<{ item: ShopItem | null; isOpen: boolean }>({
    item: null,
    isOpen: false
  });

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, ShopItem[]>();
    shopInventory.forEach(item => {
      if (!grouped.has(item.category)) {
        grouped.set(item.category, []);
      }
      grouped.get(item.category)!.push(item);
    });
    return grouped;
  }, [shopInventory]);

  // Calculate cart totals
  const cartItems = Array.from(cart.values());
  const totalCost = cartItems.reduce((sum, item) => sum + (item.cost_gp * item.quantity), 0);
  const remainingGold = startingGold - totalCost;
  const canAfford = remainingGold >= 0;

  const addToCart = (item: ShopItem) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(item.id);

      if (existing) {
        // Check if we can afford one more
        const newCost = totalCost - (existing.cost_gp * existing.quantity) + (existing.cost_gp * (existing.quantity + 1));
        if (newCost > startingGold) return prev;

        existing.quantity += 1;
      } else {
        // Check if we can afford this item
        if (totalCost + item.cost_gp > startingGold) return prev;

        newCart.set(item.id, { ...item, quantity: 1 });
      }

      return newCart;
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(itemId);

      if (existing) {
        if (existing.quantity > 1) {
          existing.quantity -= 1;
        } else {
          newCart.delete(itemId);
        }
      }

      return newCart;
    });
  };

  const clearCart = () => {
    setCart(new Map());
  };

  const handlePurchaseComplete = () => {
    const purchasedItems: PurchasedItem[] = cartItems.map(item => ({
      ...item,
      purchased: true
    }));
    onPurchaseComplete(purchasedItems);
  };

  const getCartQuantity = (itemId: string): number => {
    return cart.get(itemId)?.quantity || 0;
  };

  const openDescriptionModal = (item: ShopItem) => {
    setDescriptionModal({ item, isOpen: true });
  };

  const closeDescriptionModal = () => {
    setDescriptionModal({ item: null, isOpen: false });
  };

  const isDescriptionTruncated = (description: string | undefined): boolean => {
    // Rough estimation: if description is longer than ~150 characters, it's likely more than 3 lines
    return description ? description.length > 150 : false;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <ShoppingCart className="w-12 h-12 text-accent-yellow-light mx-auto mb-4" />
        <h3 className="text-xl font-bold text-accent-yellow-light mb-2">
          Equipment Shop
        </h3>
        <p className="text-sm text-theme-tertiary">
          Spend your starting wealth on equipment. Choose wisely - you can't return items!
        </p>
      </div>

      {/* Budget Bar */}
      <div className="bg-theme-tertiary p-4 rounded-lg border border-theme-primary">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-accent-yellow-light" />
            <span className="font-semibold text-accent-yellow-light">Starting Wealth</span>
          </div>
          <div className="text-right">
            <div className={`font-bold text-lg ${canAfford ? 'text-accent-yellow-light' : 'text-accent-red-light'}`}>
              {remainingGold} / {startingGold} gp
            </div>
            <div className="text-xs text-theme-muted">
              Spent: {totalCost} gp
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-theme-quaternary rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              canAfford ? 'bg-accent-yellow' : 'bg-accent-red'
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (totalCost / startingGold) * 100))}%`
            }}
          />
        </div>

        {!canAfford && (
          <div className="flex items-center gap-2 mt-2 text-accent-red-light text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>You've exceeded your budget!</span>
          </div>
        )}
      </div>

      {/* Cart Summary */}
      {cartItems.length > 0 && (
        <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-theme-secondary">Cart ({cartItems.length} items)</h4>
            <button
              onClick={clearCart}
              className="text-xs text-accent-red-light hover:text-accent-red px-2 py-1 rounded"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            {cartItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-theme-primary/30">
                <div className="flex-1">
                  <div className="font-medium text-theme-primary text-sm">{item.name}</div>
                  <div className="text-xs text-theme-muted">{item.cost_gp} gp each</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-6 h-6 bg-theme-quaternary hover:bg-theme-hover rounded flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-6 h-6 bg-accent-blue hover:bg-accent-blue-dark rounded flex items-center justify-center"
                    disabled={!canAffordPurchase(startingGold, cartItems.map(c => ({ id: c.id, quantity: c.quantity })))}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shop Categories */}
      {Array.from(itemsByCategory.entries()).map(([category, items]) => (
        <div key={category}>
          <h4 className="font-semibold text-accent-blue-light mb-3 border-b border-theme-primary pb-2">
            {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(item => {
              const inCart = getCartQuantity(item.id);
              const canAffordThis = remainingGold >= item.cost_gp;

              return (
                <div
                  key={item.id}
                  className={`border-2 rounded-lg p-3 transition-all ${
                    inCart > 0
                      ? 'bg-accent-blue-darker border-accent-blue'
                      : 'bg-theme-tertiary border-theme-primary hover:border-theme-secondary'
                  } ${!canAffordThis ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-theme-primary text-sm">{item.name}</h5>
                    <span className="text-accent-yellow-light font-bold text-sm">
                      {item.cost_gp} gp
                    </span>
                  </div>

                  {item.ac && (
                    <div className="text-xs text-accent-green-light mb-1">
                      AC: {item.ac}
                    </div>
                  )}

                  {item.description && (
                    <div className="text-xs text-theme-tertiary mb-3">
                      <p className={`line-clamp-3 ${isDescriptionTruncated(item.description) ? 'cursor-pointer hover:text-theme-primary' : ''}`}
                         onClick={() => isDescriptionTruncated(item.description) && openDescriptionModal(item)}>
                        {item.description}
                        {isDescriptionTruncated(item.description) && (
                          <span className="text-theme-muted ml-1">...</span>
                        )}
                      </p>
                      {isDescriptionTruncated(item.description) && (
                        <button
                          onClick={() => openDescriptionModal(item)}
                          className="text-xs text-accent-blue-light hover:text-accent-blue mt-1 flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          Read more
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {inCart > 0 && (
                      <div className="text-xs text-accent-blue-light">
                        In cart: {inCart}
                      </div>
                    )}

                    <button
                      onClick={() => addToCart(item)}
                      disabled={!canAffordThis}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        inCart > 0
                          ? 'bg-accent-blue text-white'
                          : 'bg-accent-green hover:bg-accent-green-dark text-white'
                      } disabled:bg-theme-quaternary disabled:text-theme-muted disabled:cursor-not-allowed`}
                    >
                      {inCart > 0 ? 'Add More' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-theme-primary">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white transition-colors"
        >
          ← Back to Equipment Options
        </button>

        <div className="flex-1" />

        <button
          onClick={handlePurchaseComplete}
          disabled={cartItems.length === 0 || !canAfford}
          className="px-6 py-3 bg-accent-green hover:bg-accent-green-dark disabled:bg-theme-quaternary disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          Complete Purchase ({cartItems.length} items)
        </button>
      </div>

      {/* Description Modal */}
      {descriptionModal.isOpen && descriptionModal.item && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-theme-secondary">
              <h3 className="text-lg font-bold text-theme-primary">{descriptionModal.item.name}</h3>
              <button
                onClick={closeDescriptionModal}
                className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
                aria-label="Close description"
              >
                <X className="w-5 h-5 text-theme-muted" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-accent-yellow-light font-bold">{descriptionModal.item.cost_gp} gp</span>
                  {descriptionModal.item.ac && (
                    <span className="text-accent-green-light">AC: {descriptionModal.item.ac}</span>
                  )}
                </div>
                <div className="text-theme-tertiary leading-relaxed">
                  {descriptionModal.item.description}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};