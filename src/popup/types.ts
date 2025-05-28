import type Popup from '.';
import type { CreateElOptions } from '..';
import type Bar from '../bar';
import type { DateScale } from '../date-utils';
interface Task {
  id?: string;
  name?: string;
  description?: string;
  start: string | Date;
  end: string | Date;
  _start: Date;
  _end: Date;
  _index: number;
  actual_duration?: number;
  ignored_duration?: number;
  progress?: number;
  custom_class?: string;
  invalid?: boolean;
  thumbnail?: string;
  color?: string;
  color_progress?: string;
  dependencies: string | string[];
  duration?: string;
  task?: Task;
}

interface Gantt {
  get_bar: (task: Task) => Bar;
  $lower_header: HTMLElement;
  gantt_start: Date;
  create_el: (options: CreateElOptions) => HTMLElement;
  options: {
    bar_height?: number;
    bar_corner_radius?: number;
    show_expected_progress?: boolean;
    readonly_progress?: boolean;
    readonly_dates?: boolean;
    readonly?: boolean;
    popup_on?: 'click' | 'hover';
    padding?: number;
  };
  trigger_event: (event: string, args: unknown[]) => void;
  config: {
    column_width?: number;
    unit?: DateScale;
    step?: number;
    ignored_positions?: number[];
    header_height?: number;
    ignored_dates?: Date[];
    ignored_function?: (date: Date) => boolean;
  };
  get_ignored_region: (x: number, drn?: 1) => number[];
  show_popup: (options: ShowOptions) => void;
  $container: HTMLElement;
  popup: Popup;
}

interface PopupOptions {
  task: Task;
  chart: Gantt;
  get_title: () => HTMLElement;
  set_title: (title: string) => void;
  get_subtitle: () => HTMLElement;
  set_subtitle: (subtitle: string) => void;
  get_details: () => HTMLElement;
  set_details: (details: string) => void;
  add_action: (
    html: string | ((task: Task) => string),
    func: (task: Task, gantt: Gantt, e: MouseEvent) => void
  ) => void;
}

interface ShowOptions {
  x: number;
  y: number;
  task: Task;
  target: SVGElement;
}

type PopupFunction = (options: PopupOptions) => string | false | null;

export type { Task, Gantt, PopupOptions, ShowOptions, PopupFunction };
