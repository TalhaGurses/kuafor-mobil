declare module "react-big-calendar" {
  import { Component, ReactNode, ReactElement } from "react";
  import { Moment } from "moment";

  export type View = "month" | "week" | "day" | "agenda";
  
  export const Views: {
    MONTH: "month";
    WEEK: "week";
    DAY: "day";
    AGENDA: "agenda";
  };

  export type momentLocalizer = (moment: any) => {
    formats: {
      date: string;
      time: string;
      agenda: string;
    };
    firstOfWeek: () => number;
    add: (date: Date, amount: number, unit: string) => Date;
    ceil: (date: Date, unit: string) => Date;
    diff: (date1: Date, date2: Date, unit: string) => number;
    eq: (date1: Date, date2: Date) => boolean;
    gt: (date1: Date, date2: Date) => boolean;
    gte: (date1: Date, date2: Date) => boolean;
    lt: (date1: Date, date2: Date) => boolean;
    lte: (date1: Date, date2: Date) => boolean;
    merge: (date: Date, time: Date) => Date;
    startOf: (date: Date, unit: string) => Date;
    endOf: (date: Date, unit: string) => Date;
  };

  export function momentLocalizer(moment: any): momentLocalizer;

  export interface Event {
    id?: string | number;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
  }

  export interface CalendarProps {
    localizer: momentLocalizer;
    events: Event[];
    startAccessor?: string | ((event: Event) => Date);
    endAccessor?: string | ((event: Event) => Date);
    view?: View;
    onView?: (view: View) => void;
    date?: Date;
    onNavigate?: (date: Date) => void;
    onSelectEvent?: (event: Event, e: React.SyntheticEvent) => void;
    onSelectSlot?: (slotInfo: { start: Date; end: Date; resourceId?: string }) => void;
    selectable?: boolean;
    eventPropGetter?: (event: Event) => { style?: React.CSSProperties; className?: string };
    culture?: string;
    messages?: Record<string, string>;
    formats?: {
      eventTimeRangeFormat?: () => null;
    };
    defaultView?: View;
    views?: View[];
  }

  interface CalendarClass extends Component<CalendarProps> {}

  const Calendar: CalendarClass;
  export default Calendar;
}

