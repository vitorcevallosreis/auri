declare module 'react-big-calendar' {
  import { ComponentType, ReactNode } from 'react';

  export interface Event {
    id?: string | number;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
    [key: string]: any;
  }

  export interface View {
    name: string;
    title: string;
    component: ComponentType<any>;
  }

  export interface Calendar {
    localizer: any;
    events: Event[];
    views?: string[] | { [key: string]: boolean };
    view?: string;
    onView?: (view: string) => void;
    date?: Date;
    onNavigate?: (date: Date) => void;
    onSelectEvent?: (event: Event) => void;
    onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[]; action: string }) => void;
    onDoubleClickEvent?: (event: Event) => void;
    onDrillDown?: (date: Date, view: string) => void;
    startAccessor?: string | ((event: Event) => Date);
    endAccessor?: string | ((event: Event) => Date);
    titleAccessor?: string | ((event: Event) => string);
    allDayAccessor?: string | ((event: Event) => boolean);
    tooltipAccessor?: string | ((event: Event) => string);
    resourceAccessor?: string | ((event: Event) => any);
    resources?: any[];
    resourceIdAccessor?: string | ((resource: any) => string | number);
    resourceTitleAccessor?: string | ((resource: any) => string);
    defaultView?: string;
    defaultDate?: Date;
    eventPropGetter?: (event: Event, start: Date, end: Date, isSelected: boolean) => { style?: any; className?: string };
    slotPropGetter?: (date: Date) => { style?: any; className?: string };
    dayPropGetter?: (date: Date) => { style?: any; className?: string };
    showMultiDayTimes?: boolean;
    min?: Date;
    max?: Date;
    scrollToTime?: Date;
    culture?: string;
    formats?: any;
    components?: any;
    messages?: any;
    timeslots?: number;
    rtl?: boolean;
    step?: number;
    length?: number;
    selectable?: boolean | 'ignoreEvents';
    longPressThreshold?: number;
    onSelecting?: (range: { start: Date; end: Date }) => boolean | undefined;
    popup?: boolean;
    popupOffset?: number | { x: number; y: number };
    getDrilldownView?: (targetDate: Date, currentViewName: string, configuredViewNames: string[]) => string | null;
    getNow?: () => Date;
    toolbar?: boolean;
    style?: any;
    className?: string;
    elementProps?: any;
    [key: string]: any;
  }

  export const Calendar: ComponentType<Calendar>;
  export const Views: {
    MONTH: string;
    WEEK: string;
    WORK_WEEK: string;
    DAY: string;
    AGENDA: string;
  };
  export const momentLocalizer: (moment: any) => any;
  export const globalizeLocalizer: (globalize: any) => any;
  export const dateFnsLocalizer: (config: any) => any;
  export const move: (View: any, options: any) => any;
  export const navigate: (date: Date, action: string, unit?: string) => Date;
}
