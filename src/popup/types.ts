interface Task {
  id?: string;
  name?: string;
  description?: string;
  _start?: Date;
  _end?: Date;
  actual_duration?: number;
  ignored_duration?: number;
  progress?: number;
  // 其他可能的任务属性
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  [key: string]: any;
}

interface Gantt {
  create_el: (options: {
    classes?: string;
    type?: string;
    append_to?: HTMLElement;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    [key: string]: any;
  }) => HTMLElement;
  // 其他甘特图方法和属性
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  [key: string]: any;
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
  target: HTMLElement;
}

type PopupFunction = (options: PopupOptions) => string | false | null;

export type { Task, Gantt, PopupOptions, ShowOptions, PopupFunction };
