import React, { useState } from 'react';
import { InitiativeEntry } from '../../types/encounterCombat';

interface InitiativeTrackerProps {
  initiativeOrder: InitiativeEntry[];
  currentTurn: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdateEntry: (id: string, updates: Partial<InitiativeEntry>) => void;
}

export function InitiativeTracker({
  initiativeOrder,
  currentTurn,
  onReorder,
  onUpdateEntry
}: InitiativeTrackerProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', (e.currentTarget as HTMLElement).outerHTML);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = draggedIndex;

    if (dragIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleInitiativeChange = (id: string, newInitiative: number) => {
    onUpdateEntry(id, { initiative: newInitiative });
  };

  return (
    <div className="initiative-tracker">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Turn Order</p>
          <h3>Initiative</h3>
        </div>
        <p className="hint-text">Drag to reorder • click initiative to edit</p>
      </div>
      <div className="initiative-list" role="list">
        {initiativeOrder.map((entry, index) => {
          const isActive = index === currentTurn;
          const isDraggedOver = dragOverIndex === index;
          const isDragging = draggedIndex === index;
          const hpPercent = entry.maxHp ? Math.max(0, Math.min(100, (entry.currentHp / entry.maxHp) * 100)) : 0;

          return (
            <div
              key={entry.id}
              className={`initiative-entry ${isActive ? 'active' : ''} ${isDraggedOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              role="listitem"
            >
              <div className="drag-handle" aria-hidden="true">⋮⋮</div>
              <div className="initiative-controls">
                {isActive && <span className="active-indicator" aria-label="Active combatant">★</span>}
                <input
                  type="number"
                  value={entry.initiative}
                  onChange={(e) => handleInitiativeChange(entry.id, parseInt(e.target.value) || 0)}
                  className="initiative-input"
                  min="-20"
                  max="50"
                  aria-label={`Initiative for ${entry.name}`}
                />
              </div>

              <div className="combatant-info">
                <div className="combatant-name">
                  {entry.name}
                  {entry.instanceId && <span className="instance-id">{entry.instanceId}</span>}
                </div>
                <div className="combatant-meta">
                  <span className={`combatant-type ${entry.type}`}>{entry.type === 'player' ? 'Player' : 'Monster'}</span>
                  {entry.conditions.length === 0 && <span className="combatant-tag subdued">No conditions</span>}
                </div>
                {entry.conditions.length > 0 && (
                  <div className="conditions-summary">
                    {entry.conditions.map((condition, idx) => (
                      <span key={idx} className="condition-tag" title={condition.description}>
                        {condition.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="hp-display">
                <div className="hp-bar">
                  <div className="hp-bar-fill" style={{ width: `${hpPercent}%` }} />
                </div>
                <div className="hp-text">{entry.currentHp}/{entry.maxHp} HP</div>
              </div>
            </div>
          );
        })}
      </div>

      {initiativeOrder.length === 0 && (
        <div className="empty-initiative">
          <p>No combatants in initiative. Import players or add monsters to begin.</p>
        </div>
      )}
    </div>
  );
}
