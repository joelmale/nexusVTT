import React from 'react';
import type { TableRecord } from '../types';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import { OverflowMenu, type OverflowMenuItem } from '../atoms/OverflowMenu';
import { ParchmentTexture } from '../atoms/ParchmentTexture';
import { RoleRibbon } from '../atoms/RoleRibbon';
import { WaxSeal } from '../atoms/WaxSeal';
import { getPrepLine, getTableAction } from '../tableAction';
import { formatRelative } from '@/utils/formatRelative';
import Play from 'lucide-react/dist/esm/icons/play';

const MAX_AVATARS = 5;

interface TableCardProps {
  table: TableRecord;
  /** Name of the hero bound to this table (player role). */
  heroName?: string;
  /** Opens the table (DM) or rejoins it (player). */
  onAction?: (table: TableRecord) => void;
  /** Rename / edit description. Offered to DMs only. */
  onEdit?: (table: TableRecord) => void;
  /** Offered to DMs only. */
  onDelete?: (table: TableRecord) => void;
  className?: string;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const TableCard: React.FC<TableCardProps> = ({
  table,
  heroName,
  onAction,
  onEdit,
  onDelete,
  className = '',
}) => {
  const isDm = table.role === 'dm';
  const action = getTableAction(table, 'card');
  const playedLabel = formatRelative(table.lastPlayedAt);
  const prepLine = isDm ? getPrepLine(table) : '';
  const shown = table.roster.slice(0, MAX_AVATARS);
  const extra = table.roster.length - shown.length;

  const menuItems: OverflowMenuItem[] = [];
  if (isDm && onEdit) {
    menuItems.push({ label: 'Rename', onSelect: () => onEdit(table) });
  }
  if (isDm && onDelete) {
    menuItems.push({
      label: 'Delete',
      danger: true,
      onSelect: () => onDelete(table),
    });
  }

  return (
    <article
      data-testid="table-card"
      data-role={table.role}
      className={`
        relative flex flex-col gap-3 p-3.5 pt-4 rounded-sm bg-[#EFE8D8] text-[#362b21]
        border-4 border-double border-[#8c6b4a]/60 shadow-[0_4px_8px_rgba(0,0,0,0.3)]
        hover:border-[#d97706]/70 hover:shadow-vtt-amber-glow motion-safe:hover:scale-[1.01]
        transition-all duration-300 min-w-0
        ${className}
      `}
    >
      <ParchmentTexture />

      <RoleRibbon role={table.role} className="absolute -top-1 right-3 z-10" />

      <div className="relative flex flex-col gap-1 min-w-0">
        <div className="min-h-6">
          <WaxSeal status={table.status} />
        </div>
        <GothicHeader
          level={3}
          variant="cinzel"
          className="!text-[#362b21] !text-lg leading-tight !drop-shadow-none break-words"
        >
          {table.name}
        </GothicHeader>
        {!isDm && (
          <p className="text-xs font-serif text-[#362b21]/75">
            Run by {table.dmName}
          </p>
        )}
      </div>

      {table.subtitle && (
        <p
          className="
            relative text-xs font-serif italic text-[#362b21]/85 leading-relaxed line-clamp-3
            first-letter:font-['Uncial_Antiqua',cursive] first-letter:text-3xl
            first-letter:font-bold first-letter:text-amber-800 first-letter:float-left
            first-letter:mr-1.5 first-letter:leading-none first-letter:not-italic
          "
        >
          {table.subtitle}
        </p>
      )}

      <div className="relative flex flex-col gap-1.5 mt-auto">
        {table.roster.length > 0 && (
          <ul
            aria-label="At the table"
            className="flex flex-wrap items-center gap-1.5"
          >
            {shown.map((member, i) => {
              const title = [
                member.characterName
                  ? `${member.userName} as ${member.characterName}`
                  : member.userName,
                member.online ? 'online' : 'offline',
              ].join(', ');
              return (
                <li
                  key={`${member.userName}-${i}`}
                  title={title}
                  aria-label={title}
                  className="relative"
                >
                  <span
                    aria-hidden="true"
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-[#362b21] text-[#f1e6d3] text-[11px] font-bold border border-[#8c6b4a]"
                  >
                    {initialsOf(member.userName)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#EFE8D8] ${
                      member.online ? 'bg-emerald-600' : 'bg-slate-400'
                    }`}
                  />
                </li>
              );
            })}
            {extra > 0 && (
              <li className="text-xs font-bold text-[#362b21]/75">+{extra}</li>
            )}
          </ul>
        )}

        {prepLine && (
          <p className="text-xs font-serif text-[#362b21]/85">{prepLine}</p>
        )}
        {!isDm && heroName && (
          <p className="text-xs font-serif text-[#362b21]/85">
            Playing <span className="font-bold">{heroName}</span>
          </p>
        )}
        <p className="text-xs font-serif italic text-[#362b21]/75">
          {playedLabel ? `Played ${playedLabel}` : 'Never played'}
        </p>
      </div>

      <div className="relative flex justify-between items-center border-t border-[#8c6b4a]/20 pt-3 gap-2">
        <OverflowMenu
          items={menuItems}
          label={`More actions for ${table.name}`}
        />
        {onAction && (
          <Button
            variant="bronze"
            onClick={() => onAction(table)}
            disabled={action.disabled}
            title={action.hint}
            icon={
              action.disabled ? undefined : (
                <Play size={12} className="fill-current" />
              )
            }
            className="!py-1 !px-3 text-xs ml-auto"
          >
            {action.label}
          </Button>
        )}
      </div>
    </article>
  );
};
