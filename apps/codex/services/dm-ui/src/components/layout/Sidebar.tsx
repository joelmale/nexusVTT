import { Link, useParams, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home,
  Map,
  Calendar,
  ScrollText,
  Users,
  Swords,
  StickyNote,
  BookOpen,
  Library,
  BookMarked
} from 'lucide-react';
import { useCampaignStore } from '@/stores/campaignStore';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({ open }: SidebarProps) {
  const { campaignId } = useParams();
  const location = useLocation();
  const { activeCampaign } = useCampaignStore();

  const navigationItems = [
    {
      name: 'Home',
      href: '/',
      icon: Home,
      requiresCampaign: false
    },
    {
      name: 'Codex Browser',
      href: '/codex',
      icon: BookMarked,
      requiresCampaign: false
    },
    ...(campaignId
      ? [
          {
            name: 'Campaign Overview',
            href: `/campaigns/${campaignId}`,
            icon: Home,
            requiresCampaign: true
          },
          {
            name: 'Worlds & Locations',
            href: `/campaigns/${campaignId}/worlds`,
            icon: Map,
            requiresCampaign: true
          },
          {
            name: 'Sessions',
            href: `/campaigns/${campaignId}/sessions`,
            icon: Calendar,
            requiresCampaign: true
          },
          {
            name: 'Plot Threads',
            href: `/campaigns/${campaignId}/plots`,
            icon: ScrollText,
            requiresCampaign: true
          },
          {
            name: 'NPCs',
            href: `/campaigns/${campaignId}/npcs`,
            icon: Users,
            requiresCampaign: true
          },
          {
            name: 'Encounters',
            href: `/campaigns/${campaignId}/encounters`,
            icon: Swords,
            requiresCampaign: true
          },
          {
            name: 'Notes',
            href: `/campaigns/${campaignId}/notes`,
            icon: StickyNote,
            requiresCampaign: true
          },
          {
            name: 'Journals',
            href: `/campaigns/${campaignId}/journals`,
            icon: BookOpen,
            requiresCampaign: true
          },
          {
            name: 'Lore Encyclopedia',
            href: `/campaigns/${campaignId}/lore`,
            icon: Library,
            requiresCampaign: true
          }
        ]
      : [])
  ];

  return (
    <aside
      className={cn(
        'border-r bg-card transition-all duration-300',
        open ? 'w-64' : 'w-0 overflow-hidden'
      )}
    >
      <div className="flex h-full flex-col p-4">
        {/* Campaign Info */}
        {activeCampaign && (
          <div className="mb-4 rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Current Campaign</p>
            <p className="font-semibold">{activeCampaign.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {activeCampaign.status}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            if (item.requiresCampaign && !activeCampaign) {
              return null;
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t pt-4">
          <p className="text-xs text-muted-foreground">
            NexusCodex DM Planner v1.0.0
          </p>
          <p className="text-xs text-muted-foreground">100% Offline Capable</p>
        </div>
      </div>
    </aside>
  );
}
