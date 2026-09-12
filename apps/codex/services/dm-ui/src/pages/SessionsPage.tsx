import { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useCampaignStore } from '@/stores/campaignStore';
import { useSessions } from '@/hooks/useSessions';
import { SessionForm } from '@/components/session/SessionForm';
import { SessionFormData, CalendarEvent } from '@/types/session';
import { Session } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar as CalendarIcon,
  Plus,
  List,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { enUS } from 'date-fns/locale';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export function SessionsPage() {
  const { activeCampaign } = useCampaignStore();
  const {
    sessions,
    upcomingSessions,
    completedSessions,
    getNextSessionNumber,
    createSession,
    updateSession,
    deleteSession,
    completeSession,
    cancelSession,
  } = useSessions(activeCampaign?.id);

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [calendarView, setCalendarView] = useState<View>('month');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [nextSessionNum, setNextSessionNum] = useState(1);

  // Convert sessions to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return sessions
      .filter((s) => s.plannedDate || s.actualDate)
      .map((session) => {
        const date = session.actualDate || session.plannedDate!;
        const duration = session.duration || 180; // default 3 hours

        return {
          id: session.id,
          title: `Session ${session.sessionNumber}: ${session.title}`,
          start: new Date(date),
          end: new Date(date + duration * 60 * 1000),
          resource: {
            sessionId: session.id,
            status: session.status,
            sessionNumber: session.sessionNumber,
          },
        };
      });
  }, [sessions]);

  if (!activeCampaign) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Active Campaign</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a campaign to start planning sessions.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateClick = async () => {
    const nextNum = await getNextSessionNumber(activeCampaign!.id);
    setNextSessionNum(nextNum);
    setShowCreateDialog(true);
  };

  const handleCreate = async (data: SessionFormData) => {
    await createSession(activeCampaign!.id, data);
    setShowCreateDialog(false);
  };

  const handleUpdate = async (data: SessionFormData) => {
    if (selectedSession) {
      await updateSession(selectedSession.id, data);
      setShowEditDialog(false);
      setSelectedSession(null);
    }
  };

  const handleDelete = async (session: Session) => {
    if (confirm(`Delete "${session.title}"? This action cannot be undone.`)) {
      await deleteSession(session.id);
      setSelectedSession(null);
    }
  };

  const handleComplete = async (session: Session) => {
    await completeSession(session.id, {
      actualDate: Date.now(),
    });
  };

  const handleCancel = async (session: Session) => {
    if (confirm(`Cancel "${session.title}"?`)) {
      await cancelSession(session.id);
    }
  };

  const handleEdit = (session: Session) => {
    setSelectedSession(session);
    setShowEditDialog(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const session = sessions.find((s) => s.id === event.resource?.sessionId);
    if (session) {
      handleEdit(session);
    }
  };

  // Custom event style getter
  const eventStyleGetter = (event: CalendarEvent) => {
    const status = event.resource?.status;
    let backgroundColor = '#3174ad';

    if (status === 'completed') backgroundColor = '#22c55e';
    if (status === 'cancelled') backgroundColor = '#6b7280';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Session Planner</h1>
            <p className="mt-1 text-muted-foreground">
              Plan and track sessions for {activeCampaign.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="mr-2 h-4 w-4" />
              List
            </Button>
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-4">
          <div className="rounded-lg bg-accent p-3">
            <div className="text-2xl font-bold">{sessions.length}</div>
            <div className="text-sm text-muted-foreground">Total Sessions</div>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-3">
            <div className="text-2xl font-bold text-blue-500">{upcomingSessions.length}</div>
            <div className="text-sm text-muted-foreground">Upcoming</div>
          </div>
          <div className="rounded-lg bg-green-500/10 p-3">
            <div className="text-2xl font-bold text-green-500">{completedSessions.length}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        {viewMode === 'calendar' ? (
          <div className="h-full rounded-lg border bg-card p-4">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={calendarView}
              onView={setCalendarView}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              popup
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold">Upcoming Sessions</h2>
                <div className="space-y-2">
                  {upcomingSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onComplete={handleComplete}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Completed Sessions */}
            {completedSessions.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold">Recent Completed Sessions</h2>
                <div className="space-y-2">
                  {completedSessions.slice(0, 10).map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onComplete={handleComplete}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 && (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h2 className="mt-4 text-xl font-semibold">No Sessions Yet</h2>
                  <p className="mt-2 text-muted-foreground">
                    Create your first session to get started.
                  </p>
                  <Button className="mt-4" onClick={handleCreateClick}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Session
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
          </DialogHeader>
          <SessionForm
            campaignId={activeCampaign.id}
            nextSessionNumber={nextSessionNum}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <SessionForm
              session={selectedSession}
              campaignId={activeCampaign.id}
              onSubmit={handleUpdate}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedSession(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Session Card Component
interface SessionCardProps {
  session: Session;
  onEdit: (session: Session) => void;
  onDelete: (session: Session) => void;
  onComplete: (session: Session) => void;
  onCancel: (session: Session) => void;
}

function SessionCard({ session, onEdit, onDelete, onComplete, onCancel }: SessionCardProps) {
  const statusColors = {
    planned: 'bg-blue-500',
    'in-progress': 'bg-yellow-500',
    completed: 'bg-green-500',
    cancelled: 'bg-gray-500',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${statusColors[session.status]}`} />
          <h3 className="font-semibold">
            Session {session.sessionNumber}: {session.title}
          </h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
            {session.status}
          </span>
        </div>
        {session.plannedDate && (
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(session.plannedDate), 'PPpp')}
          </p>
        )}
        {session.summary && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{session.summary}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        {session.status === 'planned' && (
          <Button size="icon" variant="ghost" onClick={() => onComplete(session)} title="Complete">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => onEdit(session)} title="Edit">
          <Edit className="h-4 w-4" />
        </Button>
        {session.status === 'planned' && (
          <Button size="icon" variant="ghost" onClick={() => onCancel(session)} title="Cancel">
            <XCircle className="h-4 w-4 text-yellow-500" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => onDelete(session)} title="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
