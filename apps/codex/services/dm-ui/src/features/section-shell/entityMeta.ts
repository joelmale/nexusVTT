import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import Gem from 'lucide-react/dist/esm/icons/gem';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Search from 'lucide-react/dist/esm/icons/search';
import StickyNote from 'lucide-react/dist/esm/icons/sticky-note';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Target from 'lucide-react/dist/esm/icons/target';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import type { LucideIcon } from 'lucide-react';

import type { EntityKind } from '@/demo/fixture-registry';

export const ENTITY_ICONS: Record<EntityKind, LucideIcon> = {
  session: CalendarDays,
  location: MapPin,
  npc: UserRound,
  faction: Shield,
  quest: CheckSquare,
  objective: Target,
  encounter: Swords,
  map: MapIcon,
  clue: Search,
  handout: FileText,
  note: StickyNote,
  item: Gem,
  scene: ImageIcon,
};

export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  session: 'Sessions',
  location: 'Locations',
  npc: 'NPCs',
  faction: 'Factions',
  quest: 'Quests',
  objective: 'Objectives',
  encounter: 'Encounters',
  map: 'Maps',
  clue: 'Clues',
  handout: 'Handouts',
  note: 'Notes',
  item: 'Items',
  scene: 'Scenes',
};
