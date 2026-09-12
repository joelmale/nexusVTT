declare module 'react-big-calendar' {
  import { ComponentType } from 'react';

  export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

  export interface CalendarProps {
    localizer: any;
    events: any[];
    startAccessor?: string | ((event: any) => Date);
    endAccessor?: string | ((event: any) => Date);
    titleAccessor?: string | ((event: any) => string);
    view?: View;
    onView?: (view: View) => void;
    onSelectEvent?: (event: any) => void;
    onSelectSlot?: (slotInfo: any) => void;
    selectable?: boolean | 'ignoreEvents';
    style?: React.CSSProperties;
    eventPropGetter?: (event: any) => any;
    dayPropGetter?: (date: Date) => any;
    [key: string]: any;
  }

  export const Calendar: ComponentType<CalendarProps>;

  export function dateFnsLocalizer(config: {
    format: any;
    parse: any;
    startOfWeek: any;
    getDay: any;
    locales: any;
  }): any;
}
