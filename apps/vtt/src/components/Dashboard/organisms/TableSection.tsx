import React from 'react';
import type { CharacterRecord, TableRecord } from '../types';
import { TableCard } from '../molecules/TableCard';
import { GothicHeader } from '../atoms/Typography';

interface TableSectionProps {
  title: string;
  icon: React.ReactNode;
  tables: TableRecord[];
  /** Heroes, used to name the hero a player brings to each table. */
  heroes?: CharacterRecord[];
  onAction?: (table: TableRecord) => void;
  onDelete?: (table: TableRecord) => void;
  /** Buttons shown on the right of the section header. */
  actions?: React.ReactNode;
  /**
   * Rendered instead of the grid when there are no tables. Without it an empty
   * section renders nothing at all.
   */
  emptyContent?: React.ReactNode;
  className?: string;
}

export const TableSection: React.FC<TableSectionProps> = ({
  title,
  icon,
  tables,
  heroes = [],
  onAction,
  onDelete,
  actions,
  emptyContent,
  className = '',
}) => {
  if (tables.length === 0 && !emptyContent) return null;

  const heroName = (table: TableRecord): string | undefined =>
    table.myCharacterId
      ? heroes.find((h) => h.id === table.myCharacterId)?.name
      : undefined;

  return (
    <section aria-label={title} className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#8c6b4a]/30 pb-3">
        <GothicHeader
          level={2}
          variant="medieval"
          className="flex items-center gap-2"
        >
          <span className="text-amber-500" aria-hidden="true">
            {icon}
          </span>
          {title}
        </GothicHeader>
        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {actions}
          </div>
        )}
      </div>

      {tables.length === 0 ? (
        emptyContent
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              heroName={heroName(table)}
              onAction={onAction}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
};
