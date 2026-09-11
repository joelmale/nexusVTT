import { z } from 'zod';

export const sessionSchema = z.object({
  title: z.string().min(1, 'Session title is required').max(200, 'Title too long'),
  sessionNumber: z.number().int().min(1, 'Session number must be at least 1'),
  plannedDate: z.number().optional(),
  actualDate: z.number().optional(),
  duration: z.number().int().min(0).optional(),
  status: z.enum(['planned', 'in-progress', 'completed', 'cancelled']),
  worldId: z.string().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
  participants: z.array(z.string()).optional(),
  experience_awarded: z.number().int().min(0).optional(),
  treasure_awarded: z.string().optional(),
  quests_advanced: z.array(z.string()).optional(),
  npcs_encountered: z.array(z.string()).optional(),
});

export type SessionFormData = z.infer<typeof sessionSchema>;

// Re-export Session type from db schema for convenience
export type { Session } from '@/db/schema';

export const SESSION_STATUS = [
  { value: 'planned', label: 'Planned', color: 'bg-blue-500' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500' },
] as const;

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    sessionId: string;
    status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
    sessionNumber: number;
  };
}
