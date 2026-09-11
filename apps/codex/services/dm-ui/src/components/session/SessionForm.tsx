import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sessionSchema, SessionFormData, SESSION_STATUS } from '@/types/session';
import { Session } from '@/db/schema';
import { useWorlds } from '@/hooks/useWorlds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SelectRoot, {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Removed unused import: formatDate

interface SessionFormProps {
  session?: Session;
  campaignId: string;
  nextSessionNumber?: number;
  onSubmit: (data: SessionFormData) => Promise<void>;
  onCancel: () => void;
}

export function SessionForm({
  session,
  campaignId,
  nextSessionNumber = 1,
  onSubmit,
  onCancel,
}: SessionFormProps) {
  const { worlds } = useWorlds(campaignId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: session
      ? {
          title: session.title,
          sessionNumber: session.sessionNumber,
          plannedDate: session.plannedDate,
          actualDate: session.actualDate,
          duration: session.duration,
          status: session.status,
          worldId: session.worldId,
          summary: session.summary || '',
          notes: session.notes || '',
          participants: session.participants || [],
          experience_awarded: session.experience_awarded,
          treasure_awarded: session.treasure_awarded || '',
          quests_advanced: session.quests_advanced || [],
          npcs_encountered: session.npcs_encountered || [],
        }
      : {
          title: '',
          sessionNumber: nextSessionNumber,
          plannedDate: undefined,
          actualDate: undefined,
          duration: undefined,
          status: 'planned',
          worldId: undefined,
          summary: '',
          notes: '',
          participants: [],
          experience_awarded: undefined,
          treasure_awarded: '',
          quests_advanced: [],
          npcs_encountered: [],
        },
  });

  const selectedStatus = watch('status');
  const plannedDate = watch('plannedDate');
  const actualDate = watch('actualDate');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Enter session title"
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="sessionNumber">Session Number *</Label>
            <Input
              id="sessionNumber"
              type="number"
              {...register('sessionNumber', { valueAsNumber: true })}
              min={1}
              className={errors.sessionNumber ? 'border-destructive' : ''}
            />
            {errors.sessionNumber && (
              <p className="mt-1 text-sm text-destructive">{errors.sessionNumber.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Status *</Label>
            <SelectRoot
              value={selectedStatus}
              onValueChange={(value) => setValue('status', value as Session['status'])}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
                <SelectContent>
                  {SESSION_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectTrigger>
            </SelectRoot>
          </div>

          <div>
            <Label htmlFor="worldId">Location (Optional)</Label>
            <SelectRoot
              value={watch('worldId') || ''}
              onValueChange={(value) => setValue('worldId', value || undefined)}
            >
              <SelectTrigger id="worldId">
                <SelectValue placeholder="Select location" />
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {worlds.map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectTrigger>
            </SelectRoot>
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Scheduling</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="plannedDate">Planned Date</Label>
            <Input
              id="plannedDate"
              type="datetime-local"
              value={
                plannedDate
                  ? new Date(plannedDate).toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value).getTime() : undefined;
                setValue('plannedDate', date);
              }}
            />
          </div>

          <div>
            <Label htmlFor="actualDate">Actual Date</Label>
            <Input
              id="actualDate"
              type="datetime-local"
              value={
                actualDate
                  ? new Date(actualDate).toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value).getTime() : undefined;
                setValue('actualDate', date);
              }}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            {...register('duration', { valueAsNumber: true })}
            placeholder="e.g., 180 for 3 hours"
            min={0}
          />
        </div>
      </div>

      {/* Planning Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Session Details</h3>

        <div>
          <Label htmlFor="notes">Planning Notes</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Notes for preparing this session..."
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="summary">Session Summary</Label>
          <Textarea
            id="summary"
            {...register('summary')}
            placeholder="Summary of what happened during the session..."
            rows={4}
          />
        </div>
      </div>

      {/* Completion Details (shown for completed sessions) */}
      {selectedStatus === 'completed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Completion Details</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="experience_awarded">Experience Awarded</Label>
              <Input
                id="experience_awarded"
                type="number"
                {...register('experience_awarded', { valueAsNumber: true })}
                placeholder="Total XP awarded"
                min={0}
              />
            </div>

            <div>
              <Label htmlFor="treasure_awarded">Treasure Awarded</Label>
              <Input
                id="treasure_awarded"
                {...register('treasure_awarded')}
                placeholder="e.g., 500 gp, +1 Longsword"
              />
            </div>
          </div>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : session ? 'Update Session' : 'Create Session'}
        </Button>
      </div>
    </form>
  );
}
