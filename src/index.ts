import './styles/gantt.css';
import $ from 'cash-dom';
import type { default as ArrowType } from './arrow';
import Arrow from './arrow';
import BarClass from './bar';
import date_utils from './date-utils';
import { DEFAULT_OPTIONS, DEFAULT_VIEW_MODES } from './defaults';
import type { Gantt as GanttType, Task } from './popup/types';
import { createSVG } from './svg-utils';
interface ExtendedSVGRect extends SVGRectElement {
  ox: number;
  oy: number;
  owidth: number;
  finaldx: number;
  min_dx: number;
  max_dx: number;
}

interface ExtendedSVGProgressRect extends ExtendedSVGRect {
  min_dx: number;
  max_dx: number;
}

interface Bar extends Omit<BarClass, 'arrows'> {
  $bar: ExtendedSVGRect;
  $bar_progress: ExtendedSVGProgressRect;
  arrows?: ArrowType[];
  update_bar_position(options: {
    x?: number | null;
    width?: number | null;
  }): void;
}

interface PopupOptions {
  [key: string]: unknown;
}

interface PopupInstance {
  show(opts: PopupOptions): void;
  hide(): void;
  parent: HTMLElement;
}

declare class Popup implements PopupInstance {
  constructor(
    wrapper: HTMLElement,
    options: ((ctx: PopupContext) => void) | undefined,
    gantt: Gantt
  );
  show(opts: PopupOptions): void;
  hide(): void;
  parent: HTMLElement;
}

interface PopupContext {
  set_title: (title: string) => void;
  set_subtitle: (subtitle: string) => void;
  set_details: (details: string) => void;
  task: {
    name: string;
    description: string;
    _start: Date;
    _end: Date;
    actual_duration: number;
    ignored_duration?: number;
    progress: number;
  };
  chart: {
    options: {
      language: string;
    };
  };
}

interface GanttEventHandlers {
  [key: `on_${string}`]: ((...args: unknown[]) => void) | undefined;
}

interface Holiday {
  date?: string;
  name?: string;
}

type HolidayCheck = ((d: Date) => boolean) | string | Holiday;

interface GanttOptions extends GanttEventHandlers {
  arrow_curve?: number;
  auto_move_label?: boolean;
  bar_corner_radius?: number;
  bar_height?: number;
  container_height?: string | number;
  column_width?: number | null;
  date_format?: string;
  upper_header_height?: number;
  lower_header_height?: number;
  snap_at?: unknown | null;
  infinite_padding?: boolean;
  holidays?: Record<string, HolidayCheck | HolidayCheck[]>;
  ignore?: Array<string | ((date: Date) => boolean)>;
  language?: string;
  lines?: string;
  move_dependencies?: boolean;
  padding?: number;
  popup?: (ctx: PopupContext) => void;
  popup_on?: string;
  readonly_progress?: boolean;
  readonly_dates?: boolean;
  readonly?: boolean;
  scroll_to?: string;
  show_expected_progress?: boolean;
  today_button?: boolean;
  view_mode?: string | ViewMode;
  view_mode_select?: boolean;
  view_modes?: ViewMode[];
}

export interface CreateElOptions {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  id?: string;
  classes: string;
  append_to?: HTMLElement | SVGElement;
  type?: string;
}

interface GanttConfig {
  ignored_dates: Date[];
  ignored_positions: number[];
  extend_by_units: number;
  ignored_function?: (date: Date) => boolean;
  view_mode?: ViewMode;
  step?: number;
  unit?: DateScale;
  column_width?: number;
  header_height?: number;
}

interface ViewMode {
  name: string;
  step: string;
  column_width?: number;
  padding?: string | string[];
  date_format?: string;
  upper_text:
    | ((date: Date, lastDate: Date | null, language: string) => string)
    | string;
  lower_text:
    | ((date: Date, lastDate: Date | null, language: string) => string)
    | string;
  thick_line?: (date: Date) => boolean;
  snap_at?: string;
  [key: string]: unknown;
}

type DateScale =
  | 'year'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'millisecond';

interface DurationResult {
  duration: number;
  scale: DateScale;
}

interface LayerElements {
  [key: string]: SVGElement;
}

interface GanttElements {
  get $header(): HTMLElement;
  get $upper_header(): HTMLElement;
  get $lower_header(): HTMLElement;
  get $side_header(): HTMLElement;
  get $today_button(): HTMLButtonElement | undefined;
  get $current_highlight(): HTMLElement | undefined;
  get $current_ball_highlight(): HTMLElement | undefined;
}

interface GanttMethods {
  view_is(mode: string): boolean;
  scroll_current(): void;
  get_closest_date(): [Date, HTMLElement] | null;
}

interface DateInfo {
  x: number;
  lower_y: number;
  upper_y: number;
  lower_text: string;
  upper_text: string;
  formatted_date: string;
  date: Date;
  column_width: number;
}

interface ViewModeInput {
  name: string;
}

declare global {
  interface Window {
    Gantt: typeof Gantt;
  }
}
const AttrKeys = ['id', 'width', 'height', 'append_to'] as const;
type AttrKeys = (typeof AttrKeys)[number];
const CSS_VARIABLES: Record<string, keyof GanttOptions> = {
  'grid-height': 'container_height',
  'bar-height': 'bar_height',
  'lower-header-height': 'lower_header_height',
  'upper-header-height': 'upper_header_height',
};
export default class Gantt implements GanttElements, GanttMethods {
  static VIEW_MODE = {
    HOUR: DEFAULT_VIEW_MODES[0],
    QUARTER_DAY: DEFAULT_VIEW_MODES[1],
    HALF_DAY: DEFAULT_VIEW_MODES[2],
    DAY: DEFAULT_VIEW_MODES[3],
    WEEK: DEFAULT_VIEW_MODES[4],
    MONTH: DEFAULT_VIEW_MODES[5],
    YEAR: DEFAULT_VIEW_MODES[6],
  };

  private $svg: SVGElement = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  );
  private $container: HTMLElement = document.createElement('div');
  private $popup_wrapper: HTMLElement = document.createElement('div');
  private $extras!: HTMLElement;
  private $adjust!: HTMLButtonElement;
  private _$header!: HTMLElement;
  private _$upper_header!: HTMLElement;
  private _$lower_header!: HTMLElement;
  private _$side_header!: HTMLElement;
  private _$today_button?: HTMLButtonElement;
  private _$current_highlight?: HTMLElement;
  private _$current_ball_highlight?: HTMLElement;
  private layers: LayerElements = {};
  private grid_height = 0;
  private popup?: Popup;
  private bar_being_dragged: boolean | null = null;
  private current_date?: Date;
  private $current?: HTMLElement;
  private upperTexts: HTMLElement[] = [];
  private bars: Bar[] = [];
  private arrows: ArrowType[] = [];
  private original_options: GanttOptions = {};
  private options: GanttOptions = {};
  private config: GanttConfig & {
    view_mode?: ViewMode;
    date_format?: string;
    step?: number;
    unit?: DateScale;
  } = {
    ignored_dates: [],
    ignored_positions: [],
    extend_by_units: 10,
  };
  private tasks: Task[] = [];
  private dependency_map: Record<string, string[]> = {};
  private gantt_start: Date = new Date();
  private gantt_end: Date = new Date();
  private dates: Date[] = [];

  get $header(): HTMLElement {
    return this._$header;
  }
  get $upper_header(): HTMLElement {
    return this._$upper_header;
  }
  get $lower_header(): HTMLElement {
    return this._$lower_header;
  }
  get $side_header(): HTMLElement {
    return this._$side_header;
  }
  get $today_button(): HTMLButtonElement | undefined {
    return this._$today_button;
  }
  get $current_highlight(): HTMLElement | undefined {
    return this._$current_highlight;
  }
  get $current_ball_highlight(): HTMLElement | undefined {
    return this._$current_ball_highlight;
  }

  constructor(
    wrapper: string | HTMLElement | SVGElement,
    tasks: Task[],
    options: GanttOptions
  ) {
    this.setup_wrapper(wrapper);
    this.setup_options(options);
    this.setup_tasks(tasks);
    this.change_view_mode();
    this.bind_events();
  }

  setup_wrapper(element: string | HTMLElement | SVGElement): void {
    let svg_element: SVGElement | null = null;
    let wrapper_element: HTMLElement | null = null;

    // CSS Selector is passed
    if (typeof element === 'string') {
      const found_element = document.querySelector(element);
      if (!found_element) {
        throw new ReferenceError(
          `CSS selector "${element}" could not be found in DOM`
        );
      }
      wrapper_element = found_element as HTMLElement;
    } else if (element instanceof HTMLElement) {
      wrapper_element = element;
      svg_element = element.querySelector('svg');
    } else if (element instanceof SVGElement) {
      svg_element = element;
    } else {
      throw new TypeError(
        'Xpress Gantt only supports usage of a string CSS selector,' +
          " HTML DOM element or SVG DOM element for the 'element' parameter"
      );
    }

    // svg element
    if (svg_element) {
      this.$svg = svg_element;
      this.$svg.classList.add('gantt');
    } else {
      // create it
      this.$svg = createSVG('svg', {
        append_to: wrapper_element as HTMLElement,
        class: 'gantt',
      });
    }

    // wrapper element
    this.$container = this.create_el({
      classes: 'gantt-container',
      append_to: this.$svg.parentElement as HTMLElement,
    });

    $(this.$container).append(this.$svg);
    this.$popup_wrapper = this.create_el({
      classes: 'popup-wrapper',
      append_to: this.$container,
    });
  }

  create_el({
    left = 0,
    top = 0,
    width,
    height,
    id,
    classes,
    append_to,
    type,
  }: CreateElOptions): HTMLElement {
    const $el = document.createElement(type || 'div');
    for (const cls of classes.split(' ')) {
      $el.classList.add(cls);
    }
    $el.style.top = `${top}px`;
    $el.style.left = `${left}px`;

    const attrSetters: Record<AttrKeys, () => void> = {
      id: () => {
        if (id) {
          $el.id = id;
        }
      },
      width: () => {
        if (width) {
          $el.style.width = `${width}px`;
        }
      },
      height: () => {
        if (height) {
          $el.style.height = `${height}px`;
        }
      },
      append_to: () => {
        if (append_to) {
          append_to.appendChild($el);
        }
      },
    };

    const attrs = { id, width, height, append_to };
    for (const [key, value] of Object.entries(attrs)) {
      if (value) {
        attrSetters[key as AttrKeys]();
      }
    }

    return $el;
  }

  setup_options(options: GanttOptions): void {
    this.original_options = options;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setup_css_variables();
    this.setup_config();
  }
  update_options(options: GanttOptions) {
    this.setup_options({ ...this.original_options, ...options });
    this.change_view_mode(undefined, true);
  }

  setup_tasks(tasks: Task[]) {
    this.tasks = tasks
      .map((task, i) => {
        if (!task.start) {
          // biome-ignore lint/suspicious/noConsole: <explanation>
          console.error(`task "${task.id}" doesn't have a start date`);
          return false;
        }

        task._start = date_utils.parse(task.start)!;
        if (task.end === undefined && task.duration !== undefined) {
          task.end = task._start;
          const durations = task.duration.split(' ');
          for (const tmpDuration of durations) {
            const { duration, scale } = date_utils.parse_duration(
              tmpDuration
            ) as DurationResult;
            task.end = date_utils.add(task.end, duration, scale);
          }
        }
        if (!task.end) {
          // biome-ignore lint/suspicious/noConsole: <explanation>
          console.error(`task "${task.id}" doesn't have an end date`);
          return false;
        }
        task._end = date_utils.parse(task.end)!;
        if (!task._end || !task._start) {
          return false;
        }
        const diff = date_utils.diff(task._end, task._start, 'year');
        if (diff < 0) {
          // biome-ignore lint/suspicious/noConsole: <explanation>
          console.error(
            `start of task can't be after end of task: in task "${task.id}"`
          );
          return false;
        }

        // make task invalid if duration too large
        if (date_utils.diff(task._end, task._start, 'year') > 10) {
          // biome-ignore lint/suspicious/noConsole: <explanation>
          console.error(
            `the duration of task "${task.id}" is too long (above ten years)`
          );
          return false;
        }

        // cache index
        task._index = i;

        // if hours is not set, assume the last day is full day
        // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
        const task_end_values = date_utils.get_date_values(task._end);
        if (task_end_values.slice(3).every((d) => d === 0)) {
          task._end = date_utils.add(task._end, 24, 'hour');
        }

        // dependencies
        if (typeof task.dependencies === 'string' || !task.dependencies) {
          let deps: string[] = [];
          if (task.dependencies) {
            deps = task.dependencies
              .split(',')
              .map((d: string) => d.trim().replaceAll(' ', '_'))
              .filter((d: string) => d);
          }
          task.dependencies = deps;
        }

        // uids
        if (!task.id) {
          task.id = generate_id(task);
        } else if (typeof task.id === 'string') {
          task.id = task.id.replaceAll(' ', '_');
        } else {
          task.id = `${task.id}`;
        }

        return task;
      })
      .filter((t): t is Task => t !== false);
    this.setup_dependencies();
  }

  setup_dependencies() {
    this.dependency_map = {};
    for (const t of this.tasks) {
      for (const d of t.dependencies) {
        this.dependency_map[d] = this.dependency_map[d] || [];
        this.dependency_map[d].push(t.id!);
      }
    }
  }

  refresh(tasks: Task[]): void {
    this.setup_tasks(tasks);
    this.change_view_mode();
  }

  update_task(id: string, new_details: Partial<Task>): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      return;
    }

    const bar = this.bars[task._index];
    if (!bar) {
      return;
    }

    Object.assign(task, new_details);
    bar.date_changed();
    bar.compute_progress();
  }

  setup_css_variables(): void {
    for (const name in CSS_VARIABLES) {
      if (Object.prototype.hasOwnProperty.call(CSS_VARIABLES, name)) {
        const key = CSS_VARIABLES[name];
        const setting = this.options[key];
        if (setting !== 'auto') {
          this.$container.style.setProperty(`--gv-${name}`, `${setting}px`);
        }
      }
    }
  }

  change_view_mode(
    mode: ViewMode | string = this.options.view_mode ?? '',
    maintain_pos = false
  ): void {
    let view_mode: ViewMode | undefined;

    if (typeof mode === 'string') {
      const found = this.options.view_modes?.find((d) => d.name === mode);
      if (found) {
        view_mode = found;
      }
    } else {
      view_mode = mode;
    }

    if (!view_mode) {
      return;
    }

    const old_pos = maintain_pos ? this.$container.scrollLeft : undefined;
    const old_scroll_op = maintain_pos ? this.options.scroll_to : undefined;

    if (maintain_pos) {
      this.options.scroll_to = undefined;
    }

    this.options.view_mode = view_mode.name;
    this.config.view_mode = view_mode;
    this.update_view_scale(view_mode);
    this.setup_dates(maintain_pos);
    this.render();

    if (maintain_pos && old_pos !== undefined) {
      this.$container.scrollLeft = old_pos;
      this.options.scroll_to = old_scroll_op;
    }

    this.trigger_event('view_change', [view_mode]);
  }
  setup_config(): void {
    this.config = {
      ignored_dates: [],
      ignored_positions: [],
      extend_by_units: 10,
    };
    this.setup_ignore_config();
  }

  setup_ignore_config(): void {
    if (typeof this.options.ignore === 'function') {
      this.config.ignored_function = this.options.ignore;
      return;
    }

    if (typeof this.options.ignore === 'string') {
      this.options.ignore = [this.options.ignore];
    }

    for (const option of this.options.ignore ?? []) {
      if (typeof option === 'function') {
        this.config.ignored_function = option;
        continue;
      }
      if (typeof option === 'string') {
        if (option === 'weekend') {
          this.config.ignored_function = (d: Date) =>
            d.getDay() === 6 || d.getDay() === 0;
        } else {
          this.config.ignored_dates.push(new Date(`${option} `));
        }
      }
    }
  }

  update_view_scale(mode: ViewMode): void {
    const result = date_utils.parse_duration(mode.step) as DurationResult;
    this.config.step = result.duration;
    this.config.unit = result.scale;
    this.config.column_width =
      this.options.column_width || mode.column_width || 45;
    this.$container.style.setProperty(
      '--gv-column-width',
      `${this.config.column_width}px`
    );
    this.config.header_height =
      (this.options.lower_header_height ?? 0) +
      (this.options.upper_header_height ?? 0) +
      10;
  }
  setup_dates(refresh = false) {
    this.setup_gantt_dates(refresh);
    this.setup_date_values();
  }
  private calculateGanttDateRange(): { start: Date; end: Date } {
    if (!this.tasks.length) {
      return {
        start: new Date(),
        end: new Date(),
      };
    }

    let gantt_start = this.tasks[0]._start;
    let gantt_end = this.tasks[0]._end;

    for (const task of this.tasks) {
      if (task._start < gantt_start) {
        gantt_start = task._start;
      }
      if (task._end > gantt_end) {
        gantt_end = task._end;
      }
    }

    return {
      start: date_utils.start_of(gantt_start, this.config.unit ?? 'day'),
      end: date_utils.start_of(gantt_end, this.config.unit ?? 'day'),
    };
  }

  private adjustDateRange(
    start: Date,
    end: Date,
    refresh: boolean
  ): { start: Date; end: Date } {
    if (refresh) {
      return { start, end };
    }

    if (this.options.infinite_padding) {
      return {
        start: date_utils.add(
          start,
          -this.config.extend_by_units * 3,
          this.config.unit ?? 'day'
        ),
        end: date_utils.add(
          end,
          this.config.extend_by_units * 3,
          this.config.unit ?? 'day'
        ),
      };
    }

    const defaultPadding = ['1 day', '1 day'];
    const viewModePadding = this.config.view_mode?.padding;
    const padding = viewModePadding ?? defaultPadding;
    const padding_array: string[] = Array.isArray(padding)
      ? padding
      : [padding, padding];

    const [padding_start, padding_end] = padding_array.map(
      (p: string) => date_utils.parse_duration(p) as DurationResult
    );

    return {
      start: date_utils.add(
        start,
        -padding_start.duration,
        padding_start.scale
      ),
      end: date_utils.add(end, padding_end.duration, padding_end.scale),
    };
  }

  setup_gantt_dates(refresh: boolean) {
    const { start, end } = this.calculateGanttDateRange();
    const adjusted = this.adjustDateRange(start, end, refresh);

    this.gantt_start = adjusted.start;
    this.gantt_end = adjusted.end;

    const date_format = this.config.view_mode?.date_format;
    this.config.date_format = date_format ?? this.options.date_format;
    this.gantt_start.setHours(0, 0, 0, 0);
  }

  setup_date_values() {
    let cur_date = this.gantt_start;
    this.dates = [cur_date];

    while (cur_date < this.gantt_end) {
      cur_date = date_utils.add(
        cur_date,
        this.config.step ?? 1,
        this.config.unit ?? 'day'
      );
      this.dates.push(cur_date);
    }
  }
  bind_events() {
    this.bind_grid_click();
    this.bind_holiday_labels();
    this.bind_bar_events();
  }
  bind_grid_click() {
    $(this.$container).on(
      'click',
      '.grid-row, .grid-header, .ignored-bar, .holiday-highlight',
      () => {
        this.unselect_all();
        this.hide_popup();
      }
    );
  }
  unselect_all(): void {
    if (this.popup) {
      this.popup.parent.classList.add('hide');
    }
    for (const k of Array.from(
      this.$container.querySelectorAll('.date-range-highlight')
    )) {
      k.classList.add('hide');
    }
  }

  bind_holiday_labels() {
    const $highlights = Array.from(
      this.$container.querySelectorAll('.holiday-highlight')
    );
    for (const h of $highlights) {
      const label = this.$container.querySelector(`.label_${h.classList[1]}`);
      if (!label || !(label instanceof HTMLElement)) {
        continue;
      }

      let timeout: ReturnType<typeof setTimeout>;
      h.addEventListener('mouseenter', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        timeout = setTimeout(() => {
          label.classList.add('show');
          label.style.left = `${mouseEvent.offsetX}px`;
          label.style.top = `${mouseEvent.offsetY}px`;
        }, 300);
      });

      h.addEventListener('mouseleave', () => {
        clearTimeout(timeout);
        label.classList.remove('show');
      });
    }
  }
  bind_bar_events() {
    let is_dragging = false;
    let x_on_start = 0;
    let x_on_scroll_start = 0;
    let is_resizing_left = false;
    let is_resizing_right = false;
    let parent_bar_id = '';
    let pos = 0;
    let bars: Bar[] = []; // instanceof Bar
    this.bar_being_dragged = null;
    const action_in_progress = () => {
      return is_dragging || is_resizing_left || is_resizing_right;
    };
    this.$svg.onclick = (e) => {
      if (
        e.target instanceof Element &&
        e.target.classList.contains('grid-row')
      ) {
        this.unselect_all();
      }
    };

    $(this.$svg).on('mousemove', '.bar-wrapper, .handle', (e) => {
      if (
        this.bar_being_dragged === false &&
        Math.abs((e.offsetX || e.layerX) - pos) > 10
      ) {
        this.bar_being_dragged = true;
      }
    });
    $(this.$svg).on('mousedown', '.bar-wrapper, .handle', (e, element) => {
      const bar_wrapper = $(element).closest('.bar-wrapper');
      // element.classList.contains('left')
      if ($(element).hasClass('left')) {
        is_resizing_left = true;
        $(element).addClass('visible');
      } else if ($(element).hasClass('right')) {
        is_resizing_right = true;
        $(element).addClass('visible');
      } else if ($(element).hasClass('bar-wrapper')) {
        is_dragging = true;
      }

      if (this.popup) {
        this.popup.hide();
      }

      x_on_start = e.offsetX || e.layerX;
      parent_bar_id = $(bar_wrapper).data('id');
      let ids: string[] = [];
      if (this.options.move_dependencies) {
        ids = [parent_bar_id, ...this.get_all_dependent_tasks(parent_bar_id)];
      } else {
        ids = [parent_bar_id];
      }
      bars = ids.map((id) => this.get_bar(id));
      console.log('bars', bars);

      this.bar_being_dragged = false;
      pos = x_on_start;

      for (const bar of bars) {
        const $bar = bar.$bar;
        $bar.ox = $bar.getX();
        $bar.oy = $bar.getY();
        $bar.owidth = $bar.getWidth();
        $bar.finaldx = 0;
      }
    });

    if (this.options.infinite_padding) {
      let extended = false;
      $(this.$container).on('mousewheel', (e) => {
        const trigger = this.$container.scrollWidth / 2;
        if (!extended && e.currentTarget.scrollLeft <= trigger) {
          const old_scroll_left = e.currentTarget.scrollLeft;
          extended = true;

          this.gantt_start = date_utils.add(
            this.gantt_start,
            -this.config.extend_by_units,
            this.config.unit!
          );
          this.setup_date_values();
          this.render();
          e.currentTarget.scrollLeft =
            old_scroll_left +
            this.config.column_width! * this.config.extend_by_units;
          setTimeout(() => {
            extended = false;
          }, 300);
        }

        if (
          !extended &&
          e.currentTarget.scrollWidth -
            (e.currentTarget.scrollLeft + e.currentTarget.clientWidth) <=
            trigger
        ) {
          const old_scroll_left = e.currentTarget.scrollLeft;
          extended = true;
          this.gantt_end = date_utils.add(
            this.gantt_end,
            this.config.extend_by_units,
            this.config.unit!
          );
          this.setup_date_values();
          this.render();
          e.currentTarget.scrollLeft = old_scroll_left;
          setTimeout(() => {
            extended = false;
          }, 300);
        }
      });
    }

    $(this.$container).on('scroll', (e) => {
      let localBars: Bar[] = [];
      const ids = this.bars.map(({ group }) => group.getAttribute('data-id'));
      let dx = 0;
      if (x_on_scroll_start) {
        dx = e.currentTarget.scrollLeft - x_on_scroll_start;
      }

      // Calculate current scroll position's upper text
      this.current_date = date_utils.add(
        this.gantt_start,
        (e.currentTarget.scrollLeft / this.config.column_width!) *
          this.config.step!,
        this.config.unit!
      );

      let current_upper = '';
      if (typeof this.config.view_mode?.upper_text === 'function') {
        current_upper = this.config.view_mode.upper_text(
          this.current_date,
          null,
          this.options.language!
        );
      } else if (this.config.view_mode?.upper_text) {
        current_upper = date_utils.format(
          this.current_date,
          this.config.view_mode.upper_text,
          this.options.language!
        );
      }

      let $el = this.upperTexts.find((el) => el.textContent === current_upper);
      // Recalculate for smoother experience
      this.current_date = date_utils.add(
        this.gantt_start,
        ((e.currentTarget.scrollLeft + $el?.clientWidth) /
          this.config.column_width!) *
          this.config.step!,
        this.config.unit!
      );

      current_upper = '';
      if (typeof this.config.view_mode?.upper_text === 'function') {
        current_upper = this.config.view_mode.upper_text(
          this.current_date,
          null,
          this.options.language!
        );
      } else if (this.config.view_mode?.upper_text) {
        current_upper = date_utils.format(
          this.current_date,
          this.config.view_mode.upper_text,
          this.options.language!
        );
      }

      $el = this.upperTexts.find((el) => el.textContent === current_upper);

      if ($el !== this.$current) {
        if (this.$current) {
          $(this.$current).removeClass('current-upper');
        }

        $($el).addClass('current-upper');
        this.$current = $el;
      }

      x_on_scroll_start = e.currentTarget.scrollLeft;
      const [min_start, max_start, max_end] = this.get_start_end_positions();

      if (x_on_scroll_start > max_end + 100) {
        this.$adjust.innerHTML = '&larr;';
        this.$adjust.classList.remove('hide');
        this.$adjust.onclick = () => {
          this.$container.scrollTo({
            left: max_start,
            behavior: 'smooth',
          });
        };
      } else if (
        x_on_scroll_start + e.currentTarget.offsetWidth <
        min_start - 100
      ) {
        this.$adjust.innerHTML = '&rarr;';
        this.$adjust.classList.remove('hide');
        this.$adjust.onclick = () => {
          this.$container.scrollTo({
            left: min_start,
            behavior: 'smooth',
          });
        };
      } else {
        this.$adjust.classList.add('hide');
      }

      if (dx) {
        localBars = ids.map((id) => this.get_bar(id!));
        if (this.options.auto_move_label) {
          for (const bar of localBars) {
            bar.update_label_position_on_horizontal_scroll({
              x: dx,
              sx: e.currentTarget.scrollLeft,
            });
          }
        }
      }
    });

    $(this.$svg).on('mousemove', (e) => {
      if (!action_in_progress()) {
        return;
      }
      const dx = (e.offsetX || e.layerX) - x_on_start;
      for (const bar of bars) {
        const $bar = bar.$bar;
        $bar.finaldx = this.get_snap_position(dx, $bar.ox);
        this.hide_popup();
        if (is_resizing_left) {
          if (parent_bar_id === bar.task.id) {
            bar.update_bar_position({
              x: $bar.ox + $bar.finaldx,
              width: $bar.owidth - $bar.finaldx,
            });
          } else {
            bar.update_bar_position({
              x: $bar.ox + $bar.finaldx,
            });
          }
        } else if (is_resizing_right) {
          if (parent_bar_id === bar.task.id) {
            bar.update_bar_position({
              width: $bar.owidth + $bar.finaldx,
            });
          }
        } else if (
          is_dragging &&
          !this.options.readonly &&
          !this.options.readonly_dates
        ) {
          bar.update_bar_position({ x: $bar.ox + $bar.finaldx });
        }
      }
    });

    $(document).on('mouseup', () => {
      is_dragging = false;
      is_resizing_left = false;
      is_resizing_right = false;
      $(this.$container).find('.visible').removeClass('visible');
    });

    $(this.$svg).on('mouseup', () => {
      this.bar_being_dragged = null;
      for (const bar of bars) {
        const $bar = bar.$bar;
        if (!$bar.finaldx) {
          return;
        }
        bar.date_changed();
        bar.compute_progress();
        bar.set_action_completed();
      }
    });

    this.bind_bar_progress();
  }
  bind_bar_progress() {
    let x_on_start = 0;
    let is_resizing = false;
    let bar: Bar | null = null;
    let $bar_progress: Bar['$bar_progress'] | null = null;
    let $bar: Bar['$bar'] | null = null;

    this.$svg.addEventListener('mousedown', (e: Event) => {
      const target = e.target as Element;
      if (!target?.classList?.contains('handle progress')) {
        return;
      }

      is_resizing = true;
      const mouseEvent = e as MouseEvent;
      x_on_start = mouseEvent.offsetX;

      const bar_wrapper = target.closest('.bar-wrapper');
      if (!bar_wrapper) {
        return;
      }

      const id = bar_wrapper.getAttribute('data-id');
      if (!id) {
        return;
      }

      bar = this.get_bar(id);
      if (!bar) {
        return;
      }

      $bar_progress = bar.$bar_progress;
      $bar = bar.$bar;

      $bar_progress.finaldx = 0;
      $bar_progress.owidth = $bar_progress.getWidth?.() ?? 0;
      $bar_progress.min_dx = -$bar_progress.owidth;
      $bar_progress.max_dx =
        $bar.getWidth() - ($bar_progress.getWidth?.() ?? 0);
    });

    const range_positions = (
      (this.config.ignored_positions ?? []) as number[]
    ).map((d: number) => [d, d + (this.config.column_width ?? 0)]);

    this.$svg.addEventListener('mousemove', (e: MouseEvent) => {
      if (!is_resizing || !$bar_progress || !$bar) {
        return;
      }

      let now_x = e.offsetX;
      const moving_right = now_x > x_on_start;

      if (moving_right) {
        let k = range_positions.find(
          ([begin, end]) => now_x >= begin && now_x < end
        );
        while (k) {
          now_x = k[1];
          k = range_positions.find(
            ([begin, end]) => now_x >= begin && now_x < end
          );
        }
      } else {
        let k = range_positions.find(
          ([begin, end]) => now_x > begin && now_x <= end
        );
        while (k) {
          now_x = k[0];
          k = range_positions.find(
            ([begin, end]) => now_x > begin && now_x <= end
          );
        }
      }

      let dx = now_x - x_on_start;
      if (dx > $bar_progress.max_dx) {
        dx = $bar_progress.max_dx;
      }
      if (dx < $bar_progress.min_dx) {
        dx = $bar_progress.min_dx;
      }

      $bar_progress.setAttribute(
        'width',
        ($bar_progress.owidth + dx).toString()
      );
      if (bar?.$handle_progress) {
        // $.attr(bar.$handle_progress, 'cx', $bar_progress.getEndX().toString());
        $(bar.$handle_progress).attr('cx', $bar_progress.getEndX().toString());
      }
      $bar_progress.finaldx = dx;
    });

    this.$svg.addEventListener('mouseup', () => {
      is_resizing = false;
      if (!$bar_progress?.finaldx || !bar) {
        return;
      }

      $bar_progress.finaldx = 0;
      bar.progress_changed();
      bar.set_action_completed();
      bar = null;
      $bar_progress = null;
      $bar = null;
    });
  }
  render(): void {
    // 实现渲染逻辑
    this.clear();
    this.setup_layers();
    this.make_grid();
    this.make_dates();
    this.make_grid_extras();
    this.make_bars();
    this.make_arrows();
    this.map_arrows_on_bars();
    this.set_dimensions();
    this.set_scroll_position(this.options.scroll_to);
  }
  make_dates() {
    for (const date of this.get_dates_to_draw()) {
      if (date.lower_text) {
        const $lower_text = this.create_el({
          left: date.x,
          top: date.lower_y,
          classes: `lower-text date_${sanitize(date.formatted_date)}`,
          append_to: this.$lower_header,
        });
        $lower_text.innerText = date.lower_text;
      }

      if (date.upper_text) {
        const $upper_text = this.create_el({
          left: date.x,
          top: date.upper_y,
          classes: 'upper-text',
          append_to: this.$upper_header,
        });
        $upper_text.innerText = date.upper_text;
      }
    }
    this.upperTexts = Array.from(
      this.$container.querySelectorAll('.upper-text')
    );
  }
  make_bars() {
    this.bars = this.tasks.map((task) => {
      const bar = new BarClass(
        this as unknown as GanttType,
        task
      ) as unknown as Bar;
      this.layers.bar.appendChild(bar.group);
      return bar;
    });
  }
  make_arrows() {
    this.arrows = [];
    for (const task of this.tasks) {
      const arrows = task.dependencies as string[];
      const arrowList = arrows
        .map((task_id: string) => {
          const dependency = this.get_task(task_id);
          if (!dependency) {
            return;
          }
          const arrow = new Arrow(
            this as unknown as GanttType,
            this.bars[dependency._index] as unknown as Task,
            this.bars[task._index] as unknown as Task
          );
          // this.layers.arrow.appendChild(arrow.element);
          $(this.layers.arrow).append(arrow.element);
          return arrow;
        })
        .filter((arrow): arrow is ArrowType => arrow !== undefined);
      this.arrows = this.arrows.concat(arrowList);
    }
  }
  map_arrows_on_bars() {
    for (const bar of this.bars) {
      bar.arrows = this.arrows.filter((arrow) => {
        return (
          arrow.from_task?.task?.id === bar.task.id ||
          arrow.to_task?.task?.id === bar.task.id
        );
      });
    }
  }
  setup_layers() {
    this.layers = {};
    const layers = ['grid', 'arrow', 'progress', 'bar'];
    // make group layers
    for (const layer of layers) {
      this.layers[layer] = createSVG('g', {
        class: layer,
        append_to: this.$svg,
      });
    }
    this.$extras = this.create_el({
      classes: 'extras',
      append_to: this.$container,
    });
    this.$adjust = this.create_el({
      classes: 'adjust hide',
      append_to: this.$extras,
      type: 'button',
    }) as HTMLButtonElement;
    $(this.$adjust).html('&larr;');
  }

  make_grid() {
    this.make_grid_background();
    this.make_grid_rows();
    this.make_grid_header();
    this.make_side_header();
  }

  make_grid_extras() {
    this.make_grid_highlights();
    this.make_grid_ticks();
  }

  make_grid_background() {
    const grid_width = this.dates.length * (this.config.column_width ?? 0);
    let containerHeight = 0;
    if (this.options.container_height === 'auto') {
      containerHeight = 0;
    } else if (typeof this.options.container_height === 'string') {
      containerHeight = Number(this.options.container_height);
    } else {
      containerHeight = this.options.container_height ?? 0;
    }

    const grid_height = Math.max(
      (this.config.header_height ?? 0) +
        (this.options.padding ?? 0) +
        ((this.options.bar_height ?? 0) + (this.options.padding ?? 0)) *
          this.tasks.length -
        10,
      containerHeight
    );

    createSVG('rect', {
      x: 0,
      y: 0,
      width: grid_width,
      height: grid_height,
      class: 'grid-background',
      append_to: this.$svg,
    });

    this.$svg.setAttribute('height', `${grid_height}`);
    this.$svg.setAttribute('width', '100%');

    this.grid_height = grid_height;
    if (this.options.container_height === 'auto') {
      this.$container.style.height = `${grid_height}px`;
    }
  }

  make_grid_rows() {
    const rows_layer = createSVG('g', { append_to: this.layers.grid });
    const row_width = this.dates.length * (this.config.column_width ?? 0);
    const row_height =
      (this.options.bar_height ?? 0) + (this.options.padding ?? 0);
    const header_height = this.config.header_height ?? 0;

    for (let y = header_height; y < this.grid_height; y += row_height) {
      createSVG('rect', {
        x: 0,
        y,
        width: row_width,
        height: row_height,
        class: 'grid-row',
        append_to: rows_layer,
      });
    }
  }

  make_grid_header() {
    const columnWidth = Number(this.config.column_width ?? 0);
    const datesLength = this.dates?.length ?? 0;
    const headerWidth = datesLength * columnWidth;
    this._$header = this.create_el({
      width: headerWidth,
      classes: 'grid-header',
      append_to: this.$container,
    });

    this._$upper_header = this.create_el({
      classes: 'upper-header',
      append_to: this._$header,
    });
    this._$lower_header = this.create_el({
      classes: 'lower-header',
      append_to: this._$header,
    });
  }

  make_side_header() {
    this._$side_header = this.create_el({
      classes: 'side-header',
      append_to: this.$container,
    });
    this._$upper_header.prepend(this._$side_header);

    if (this.options.view_mode_select) {
      const $select = document.createElement('select');
      $($select).addClass('viewmode-select');

      const $el = document.createElement('option');
      // $el.selected = true;
      // $el.disabled = true;
      // $el.textContent = 'Mode';
      $($el)
        .prop('selected', true)
        .prop('disabled', true)
        .prop('textContent', 'Mode');
      $($select).append($el);

      for (const mode of this.options.view_modes ?? []) {
        const $option = document.createElement('option');
        $($option).prop('value', mode.name).prop('textContent', mode.name);
        // $option.value = mode.name;
        // $option.textContent = mode.name;
        if (mode.name === this.config.view_mode?.name) {
          // $option.selected = true;
          $($option).prop('selected', true);
        }
        // $select.appendChild($option);
        $($select).append($option);
      }

      $($select).on('change', () => {
        this.change_view_mode($select.value, true);
      });
      // this._$side_header.appendChild($select);
      $(this._$side_header).append($select);
    }

    if (this.options.today_button) {
      const $today_button = document.createElement('button');
      $($today_button).addClass('today-button').prop('textContent', 'Today');
      $today_button.onclick = () => {
        this.scroll_current();
      };
      $(this._$side_header).prepend($today_button);
      this._$today_button = $today_button;
    }
  }

  private make_horizontal_lines(
    $lines_layer: SVGElement,
    row_width: number,
    row_height: number,
    header_height: number
  ) {
    let row_y = header_height;
    for (let y = header_height; y < this.grid_height; y += row_height) {
      createSVG('line', {
        x1: 0,
        y1: row_y + row_height,
        x2: row_width,
        y2: row_y + row_height,
        class: 'row-line',
        append_to: $lines_layer,
      });
      row_y += row_height;
    }
  }

  private make_vertical_lines(
    initial_x: number,
    tick_y: number,
    tick_height: number
  ) {
    let tick_x = initial_x;
    for (const date of this.dates) {
      let tick_class = 'tick';
      const view_mode = this.config.view_mode;
      if (
        view_mode?.thick_line &&
        typeof view_mode.thick_line === 'function' &&
        view_mode.thick_line(date)
      ) {
        tick_class += ' thick';
      }

      createSVG('path', {
        d: `M ${tick_x} ${tick_y} v ${tick_height}`,
        class: tick_class,
        append_to: this.layers.grid,
      });

      if (this.view_is('month')) {
        tick_x +=
          (date_utils.get_days_in_month(date) *
            (this.config.column_width ?? 0)) /
          30;
      } else if (this.view_is('year')) {
        tick_x +=
          (date_utils.get_days_in_year(date) *
            (this.config.column_width ?? 0)) /
          365;
      } else {
        tick_x += this.config.column_width ?? 0;
      }
    }
  }

  make_grid_ticks() {
    if (this.options.lines === 'none') {
      return;
    }

    const tick_x = 0;
    const tick_y = this.config.header_height ?? 0;
    const tick_height = this.grid_height - tick_y;

    const $lines_layer = createSVG('g', {
      class: 'lines_layer',
      append_to: this.layers.grid,
    });

    const row_width = this.dates.length * (this.config.column_width ?? 0);
    const row_height =
      (this.options.bar_height ?? 0) + (this.options.padding ?? 0);
    const header_height = this.config.header_height ?? 0;

    if (this.options.lines !== 'vertical') {
      this.make_horizontal_lines(
        $lines_layer,
        row_width,
        row_height,
        header_height
      );
    }

    if (this.options.lines !== 'horizontal') {
      this.make_vertical_lines(tick_x, tick_y, tick_height);
    }
  }

  private processHolidayConfig(holidayConfig: HolidayCheck | HolidayCheck[]): {
    check_highlight?: (d: Date) => boolean;
    extra_func?: (d: Date) => boolean;
    labels: Record<string, string>;
  } {
    const labels: Record<string, string> = {};
    let check_highlight: ((d: Date) => boolean) | undefined;
    let extra_func: ((d: Date) => boolean) | undefined;

    if (typeof holidayConfig === 'string' && holidayConfig === 'weekend') {
      check_highlight = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
    } else if (Array.isArray(holidayConfig)) {
      extra_func = holidayConfig.find(
        (k): k is (d: Date) => boolean => typeof k === 'function'
      );

      const holidays: Holiday[] = holidayConfig.filter(
        (k): k is Holiday => typeof k === 'object' && k !== null
      );
      check_highlight = (d: Date): boolean => {
        return holidays.some((holiday: Holiday) => {
          if (holiday.date) {
            const dateObj = new Date(`${holiday.date} `);
            if (holiday.name) {
              labels[dateObj.toISOString()] = holiday.name;
            }
            return dateObj.getTime() === d.getTime();
          }
          return false;
        });
      };
    }

    return { check_highlight, extra_func, labels };
  }

  private createHolidayHighlight(
    date: Date,
    color: string,
    label: string | undefined,
    x: number,
    width: number
  ) {
    const header_height = this.config.header_height ?? 0;
    const height = this.grid_height - header_height;
    const d_formatted = date_utils.format(
      date,
      'YYYY-MM-DD',
      this.options.language ?? 'en'
    );

    if (d_formatted && label) {
      const labelEl = this.create_el({
        classes: `holiday-label label_${d_formatted.replace(' ', '_')}`,
        append_to: this.$extras,
      });
      labelEl.textContent = label;
    }

    if (d_formatted) {
      createSVG('rect', {
        x: Math.round(x),
        y: header_height,
        width,
        height,
        class: `holiday-highlight ${d_formatted.replace(' ', '_')}`,
        fill: color,
        append_to: this.layers.grid,
      });
    }
  }

  private processDateForHoliday(
    date: Date,
    check_highlight: (d: Date) => boolean,
    extra_func: ((d: Date) => boolean) | undefined,
    step: number,
    column_width: number,
    unit: string,
    view_mode_step: string
  ) {
    if (
      this.config.ignored_dates.find((k) => k.getTime() === date.getTime()) ||
      this.config.ignored_function?.(date)
    ) {
      return null;
    }

    if (check_highlight(date) || extra_func?.(date)) {
      const x =
        (date_utils.diff(date, this.gantt_start, unit) / step) * column_width;
      const width =
        column_width / date_utils.convert_scales(view_mode_step, 'day');
      return { x, width };
    }

    return null;
  }

  highlight_holidays() {
    if (!this.options.holidays) {
      return;
    }

    for (const [color, holidayConfig] of Object.entries(
      this.options.holidays
    )) {
      if (!holidayConfig) {
        continue;
      }

      const { check_highlight, extra_func, labels } =
        this.processHolidayConfig(holidayConfig);
      if (!check_highlight) {
        continue;
      }

      const step = Number(this.config.step ?? 1);
      const column_width = Number(this.config.column_width ?? 0);
      const unit = this.config.unit ?? 'day';
      const view_mode_step = this.config.view_mode?.step ?? '1 day';

      for (
        let date = new Date(this.gantt_start);
        date <= this.gantt_end;
        date.setDate(date.getDate() + 1)
      ) {
        const dimensions = this.processDateForHoliday(
          date,
          check_highlight,
          extra_func,
          step,
          column_width,
          unit,
          view_mode_step
        );

        if (dimensions) {
          this.createHolidayHighlight(
            date,
            color,
            labels[date.toISOString()],
            dimensions.x,
            dimensions.width
          );
        }
      }
    }
  }

  /**
   * Compute the horizontal x-axis distance and associated date for the current date and view.
   *
   * @returns Object containing the x-axis distance and date of the current date, or null if the current date is out of the gantt range.
   */
  highlight_current() {
    const res = this.get_closest_date();
    if (!res) {
      return;
    }

    const [_, el] = res;
    el.classList.add('current-date-highlight');

    const diff_in_units = date_utils.diff(
      new Date(),
      this.gantt_start,
      this.config.unit
    );

    const left =
      ((diff_in_units / (this.config.step ?? 1)) *
        (this.config.column_width ?? 0)) /
      1;

    this._$current_highlight = this.create_el({
      top: this.config.header_height,
      left,
      height: this.grid_height - (this.config.header_height ?? 0),
      classes: 'current-highlight',
      append_to: this.$container,
    });
    this._$current_ball_highlight = this.create_el({
      top: this.config.header_height ?? 0 - 6,
      left: left - 2.5,
      width: 6,
      height: 6,
      classes: 'current-ball-highlight',
      append_to: this.$header,
    });
  }

  make_grid_highlights() {
    this.highlight_holidays();
    this.config.ignored_positions = [];

    const height =
      (this.options.bar_height ?? 0 + (this.options.padding ?? 0)) *
      (this.tasks.length ?? 0);
    this.layers.grid.innerHTML += `<pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2
                   M0,4 l4,-4
                   M3,5 l2,-2"
                style="stroke:grey; stroke-width:0.3" />
        </pattern>`;

    for (
      let d = new Date(this.gantt_start);
      d <= this.gantt_end;
      d.setDate(d.getDate() + 1)
    ) {
      if (
        !this.config.ignored_dates.find((k) => k.getTime() === d.getTime()) &&
        (!this.config.ignored_function || !this.config.ignored_function(d))
      ) {
        continue;
      }
      const diff =
        date_utils.convert_scales(
          `${date_utils.diff(d, this.gantt_start)}d`,
          this.config.unit ?? 'day'
        ) / (this.config.step ?? 1);

      this.config.ignored_positions?.push(
        diff * (this.config.column_width ?? 0)
      );
      createSVG('rect', {
        x: diff * (this.config.column_width ?? 0),
        y: this.config.header_height,
        width: this.config.column_width ?? 0,
        height: height,
        class: 'ignored-bar',
        fill: 'url(#diagonalHatch)',
        append_to: this.$svg,
      });
    }

    this.highlight_current();
  }
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  trigger_event(event: string, args: any[]): void {
    const handler = this.options[`on_${event}`];
    if (typeof handler === 'function') {
      handler.apply(this, args);
    }
  }
  view_is(modes: string | ViewModeInput | (string | ViewModeInput)[]): boolean {
    const view_mode = this.config.view_mode;
    if (!view_mode) {
      return false;
    }

    if (typeof modes === 'string') {
      return view_mode.name === modes;
    }

    if (Array.isArray(modes)) {
      return modes.some((mode) => this.view_is(mode));
    }

    return view_mode.name === modes.name;
  }
  hide_popup() {
    this.popup?.hide();
  }

  scroll_current(): void {
    const res = this.get_closest_date();
    if (res) {
      this.set_scroll_position(res[0]);
    }
  }

  get_closest_date(): [Date, HTMLElement] | null {
    const now = new Date();
    if (now < this.gantt_start || now > this.gantt_end) {
      return null;
    }

    let current = new Date();
    let el = this.$container.querySelector(
      `.date_${sanitize(
        date_utils.format(
          current,
          this.config.date_format ?? '',
          this.options.language
        )
      )}`
    );

    // safety check to prevent infinite loop
    let c = 0;
    while (!el && c < (this.config.step ?? 1)) {
      current = date_utils.add(current, -1, this.config.unit ?? 'day');
      el = this.$container.querySelector(
        `.date_${sanitize(
          date_utils.format(
            current,
            this.config.date_format ?? '',
            this.options.language
          )
        )}`
      );
      c++;
    }

    if (!el || !(el instanceof HTMLElement)) {
      return null;
    }
    return [
      new Date(
        `${date_utils.format(
          current,
          this.config.date_format ?? '',
          this.options.language
        )} `
      ),
      el,
    ];
  }

  /**
   * Gets the oldest starting date from the list of tasks
   *
   * @returns Date
   * @memberof Gantt
   */
  get_oldest_starting_date() {
    if (!this.tasks.length) {
      return new Date();
    }
    return this.tasks
      .map((task) => task._start)
      .reduce((prev_date, cur_date) =>
        cur_date <= prev_date ? cur_date : prev_date
      );
  }
  /**
   * Clear all elements from the parent svg element
   *
   * @memberof Gantt
   */
  clear() {
    $(this.$svg).empty();
    $(this.$header).remove();
    $(this.$side_header).remove();
    $(this.$current_highlight).remove();
    $(this.$extras).remove();
    this.popup?.hide?.();
  }

  show_popup(opts: PopupOptions): void {
    if (this.options.popup === undefined || this.options.popup === null) {
      return;
    }

    if (!this.popup) {
      this.popup = new Popup(this.$popup_wrapper, this.options.popup, this);
    }

    this.popup?.show(opts);
  }
  private get_bar(id: string): Bar {
    return this.bars.find((bar) => bar.task.id === id) as Bar;
  }

  private get_all_dependent_tasks(task_id: string): string[] {
    let out: string[] = [];
    let to_process = [task_id];
    while (to_process.length) {
      const deps = to_process.reduce((acc: string[], curr: string) => {
        const deps_arr = this.dependency_map[curr];
        if (deps_arr) {
          return acc.concat(deps_arr);
        }
        return acc;
      }, []);
      out = out.concat(deps);
      to_process = deps.filter((d) => !to_process.includes(d));
    }
    return out.filter(Boolean);
  }

  get_ignored_region(pos: number, drn = 1): number[] {
    const column_width = this.config.column_width ?? 0;
    const ignored_positions = this.config.ignored_positions ?? [];

    return ignored_positions.filter((val: number) => {
      if (drn === 1) {
        return pos > val && pos <= val + column_width;
      }
      return pos >= val && pos < val + column_width;
    });
  }

  get_snap_position(dx: number, ox: number): number {
    let unit_length = 1;
    const column_width = this.config.column_width ?? 0;
    const view_mode = this.config.view_mode;
    const default_snap = (this.options.snap_at ||
      view_mode?.snap_at ||
      '1d') as string;

    if (default_snap !== 'unit') {
      const result = date_utils.parse_duration(default_snap) as DurationResult;
      if (view_mode?.step) {
        unit_length =
          date_utils.convert_scales(view_mode.step, result.scale as DateScale) /
          result.duration;
      }
    }

    const rem = dx % (column_width / unit_length);

    const final_dx =
      dx -
      rem +
      (rem < (column_width / unit_length) * 2 ? 0 : column_width / unit_length);
    let final_pos = ox + final_dx;

    const drn = final_dx > 0 ? 1 : -1;
    let ignored_regions = this.get_ignored_region(final_pos, drn);
    while (ignored_regions.length) {
      final_pos += column_width * drn;
      ignored_regions = this.get_ignored_region(final_pos, drn);
      if (!ignored_regions.length) {
        final_pos -= column_width * drn;
      }
    }
    return final_pos - ox;
  }

  private get_start_end_positions(): [number, number, number] {
    const min_start = Math.min(...this.bars.map((bar) => bar.$bar.getX()));
    const max_start = Math.max(...this.bars.map((bar) => bar.$bar.getX()));
    const max_end = Math.max(
      ...this.bars.map((bar) => bar.$bar.getX() + bar.$bar.getWidth())
    );
    return [min_start, max_start, max_end];
  }

  private set_scroll_position(date: Date | string | undefined): void {
    if (!date) {
      return;
    }
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      this.set_scroll_position(parsed);
      return;
    }
    const diff = date_utils.diff(
      date,
      this.gantt_start,
      this.config.unit ?? 'day'
    );
    const scroll_pos =
      (diff / (this.config.step ?? 1)) * (this.config.column_width ?? 1);
    this.$container.scrollLeft = scroll_pos;
  }

  get_dates_to_draw(): DateInfo[] {
    let last_date_info: DateInfo | null = null;
    const dates = this.dates.map((date) => {
      const d = this.get_date_info(date, last_date_info);
      last_date_info = d;
      return d;
    });
    return dates;
  }
  get_date_info(date: Date, last_date_info: DateInfo | null) {
    const last_date = last_date_info ? last_date_info.date : null;

    const x = last_date_info
      ? last_date_info.x + last_date_info.column_width
      : 0;

    const upper_text = this.config.view_mode?.upper_text;
    const lower_text = this.config.view_mode?.lower_text;

    // 处理upper_text
    let upper_text_fn: (
      date: Date,
      lastDate: Date | null,
      language: string
    ) => string;
    if (!upper_text) {
      upper_text_fn = () => '';
    } else if (typeof upper_text === 'string') {
      upper_text_fn = (date) =>
        date_utils.format(date, upper_text, this.options.language || 'en');
    } else {
      upper_text_fn = upper_text;
    }

    // 处理lower_text
    let lower_text_fn: (
      date: Date,
      lastDate: Date | null,
      language: string
    ) => string;
    if (!lower_text) {
      lower_text_fn = () => '';
    } else if (typeof lower_text === 'string') {
      lower_text_fn = (date) =>
        date_utils.format(date, lower_text, this.options.language || 'en');
    } else {
      lower_text_fn = lower_text;
    }

    if (this.config.view_mode) {
      this.config.view_mode.upper_text = upper_text_fn;
      this.config.view_mode.lower_text = lower_text_fn;
    }

    return {
      date,
      formatted_date: sanitize(
        date_utils.format(
          date,
          this.config.date_format || '',
          this.options.language || 'en'
        )
      ),
      column_width: this.config.column_width || 0,
      x,
      upper_text: upper_text_fn(date, last_date, this.options.language || 'en'),
      lower_text: lower_text_fn(date, last_date, this.options.language || 'en'),
      upper_y: 17,
      lower_y: (this.options.upper_header_height || 0) + 5,
    };
  }
  get_task(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  set_dimensions() {
    const { width: cur_width } = this.$svg.getBoundingClientRect();
    const actual_width = this.$svg.querySelector('.grid .grid-row')
      ? Number(
          this.$svg.querySelector('.grid .grid-row')?.getAttribute('width')
        )
      : 0;
    if (cur_width < actual_width) {
      this.$svg.setAttribute('width', actual_width.toString());
    }
  }
}

/**
 * 为任务生成唯一标识符
 * @param task 任务对象
 * @returns 由任务名称和随机字符串组合而成的唯一ID，格式为`${task.name}_${随机字符串}`
 * @example
 * // 返回类似 "任务1_f7x8w9z0y1"
 * generate_id({ name: "任务1", ... })
 */
function generate_id(task: Task) {
  return `${task.name}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * 净化字符串，将特殊字符替换为下划线
 * @param s 需要处理的原始字符串
 * @returns 将空格、冒号和点号替换为下划线后的字符串
 * @example
 * sanitize("hello world") // 返回 "hello_world"
 * sanitize("time:12:30") // 返回 "time_12_30"
 * sanitize("version.1.0") // 返回 "version_1_0"
 */
function sanitize(s: string) {
  return s.replaceAll(' ', '_').replaceAll(':', '_').replaceAll('.', '_');
}
