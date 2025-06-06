import $ from 'cash-dom';
import date_utils from '../date-utils';
import type { Gantt, Task } from '../popup/types';
import { animateSVG, createSVG } from '../svg-utils';
const NON_SAFARI_BROWSER_REGEX = /^((?!chrome|android).)*safari/i;

export default class Bar {
  gantt!: Gantt;
  task!: Task;
  name = '';
  group!: SVGGElement;
  bar_group!: SVGGElement;
  handle_group!: SVGGElement;
  invalid = false;
  height = 0;
  image_size = 0;
  corner_radius = 0;
  width = 0;
  duration = 0;
  actual_duration_raw = 0;
  ignored_duration_raw = 0;
  x = 0;
  y = 0;
  $bar!: SVGRectElement;
  $bar_progress!: SVGRectElement;
  $expected_bar_progress!: SVGRectElement;
  $date_highlight!: HTMLElement;
  $handle_progress!: SVGCircleElement;
  handles: (SVGRectElement | SVGCircleElement)[] = [];
  progress_width = 0;
  expected_progress = 0;
  expected_progress_width = 0;
  arrows: { update: () => void }[] = [];
  action_completed = false;

  constructor(gantt: Gantt, task: Task) {
    this.set_defaults(gantt, task);
    this.prepare_wrappers();
    this.prepare_helpers();
    this.refresh();
  }

  refresh(): void {
    this.bar_group.innerHTML = '';
    this.handle_group.innerHTML = '';
    if (this.task.custom_class) {
      $(this.group).addClass(this.task.custom_class);
    } else {
      $(this.group).removeClass().addClass('bar-wrapper');
    }
    this.prepare_values();
    this.draw();
    this.bind();
  }

  set_defaults(gantt: Gantt, task: Task): void {
    this.action_completed = false;
    this.gantt = gantt;
    this.task = task;
    this.name = this.name || '';
  }

  prepare_wrappers(): void {
    this.group = createSVG('g', {
      class: `bar-wrapper${this.task.custom_class ? ` ${this.task.custom_class}` : ''}`,
      'data-id': this.task.id,
    });
    this.bar_group = createSVG('g', {
      class: 'bar-group',
      append_to: this.group,
    });
    this.handle_group = createSVG('g', {
      class: 'handle-group',
      append_to: this.group,
    });
  }

  prepare_values(): void {
    this.invalid = Boolean(this.task.invalid);
    this.height = this.gantt.options.bar_height || 0;
    this.image_size = this.height - 5;
    this.task._start = new Date(this.task.start);
    this.task._end = new Date(this.task.end);
    this.compute_x();
    this.compute_y();
    this.compute_duration();
    this.corner_radius = this.gantt.options.bar_corner_radius || 0;
    this.width = (this.gantt.config.column_width || 0) * this.duration;
    if (!this.task.progress || this.task.progress < 0) {
      this.task.progress = 0;
    }
    if (this.task.progress > 100) {
      this.task.progress = 100;
    }
  }

  prepare_helpers(): void {
    SVGElement.prototype.getX = function (): number {
      return +(this.getAttribute('x') || 0);
    };
    SVGElement.prototype.getY = function (): number {
      return +(this.getAttribute('y') || 0);
    };
    SVGElement.prototype.getWidth = function (): number {
      return +(this.getAttribute('width') || 0);
    };
    SVGElement.prototype.getHeight = function (): number {
      return +(this.getAttribute('height') || 0);
    };
    SVGElement.prototype.getEndX = function (): number {
      return this.getX() + this.getWidth();
    };
  }

  prepare_expected_progress_values() {
    this.compute_expected_progress();
    this.expected_progress_width =
      (this.gantt.config.column_width || 0) *
        this.duration *
        (this.expected_progress / 100) || 0;
  }

  draw() {
    this.draw_bar();
    this.draw_progress_bar();
    if (this.gantt.options.show_expected_progress) {
      this.prepare_expected_progress_values();
      this.draw_expected_progress_bar();
    }
    this.draw_label();
    this.draw_resize_handles();

    if (this.task.thumbnail) {
      this.draw_thumbnail();
    }
  }

  draw_bar() {
    this.$bar = createSVG('rect', {
      x: String(this.x),
      y: String(this.y),
      width: String(this.width),
      height: String(this.height),
      rx: String(this.corner_radius),
      ry: String(this.corner_radius),
      class: 'bar',
      append_to: this.bar_group,
    });
    if (this.task.color) {
      this.$bar.style.fill = this.task.color;
    }
    animateSVG(this.$bar, 'width', '0', String(this.width));

    if (this.invalid) {
      $(this.$bar).addClass('bar-invalid');
    }
  }

  draw_expected_progress_bar() {
    if (this.invalid) {
      return;
    }
    this.$expected_bar_progress = createSVG('rect', {
      x: String(this.x),
      y: String(this.y),
      width: String(this.expected_progress_width),
      height: String(this.height),
      rx: String(this.corner_radius),
      ry: String(this.corner_radius),
      class: 'bar-expected-progress',
      append_to: this.bar_group,
    });

    animateSVG(
      this.$expected_bar_progress,
      'width',
      '0',
      String(this.expected_progress_width)
    );
  }

  draw_progress_bar() {
    if (this.invalid) {
      return;
    }
    this.progress_width = this.calculate_progress_width();
    let r = this.corner_radius;
    if (!NON_SAFARI_BROWSER_REGEX.test(navigator.userAgent)) {
      r = this.corner_radius + 2;
    }
    this.$bar_progress = createSVG('rect', {
      x: String(this.x),
      y: String(this.y),
      width: String(this.progress_width),
      height: String(this.height),
      rx: String(r),
      ry: String(r),
      class: 'bar-progress',
      append_to: this.bar_group,
    });
    if (this.task.color_progress) {
      this.$bar_progress.style.fill = this.task.color_progress;
    }
    const x =
      (date_utils.diff(
        this.task._start,
        this.gantt.gantt_start,
        this.gantt.config.unit
      ) /
        (this.gantt.config.step || 1)) *
      (this.gantt.config.column_width || 0);

    const $date_highlight = this.gantt.create_el({
      classes: `date-range-highlight hide highlight-${this.task.id}`,
      width: this.width,
      left: x,
    });
    this.$date_highlight = $date_highlight;
    $(this.gantt.$lower_header).prepend($date_highlight);

    animateSVG(this.$bar_progress, 'width', '0', String(this.progress_width));
  }

  calculate_progress_width() {
    const width = this.$bar.getWidth();
    const ignored_end = this.x + width;
    const total_ignored_area =
      (this.gantt.config.ignored_positions?.reduce(
        (acc: number, val: number) => {
          return acc + +(val >= this.x && val < ignored_end);
        },
        0
      ) || 0) * (this.gantt.config.column_width || 0);
    let progress_width =
      ((width - total_ignored_area) * (this.task.progress ?? 0)) / 100;
    const progress_end = this.x + progress_width;
    const total_ignored_progress =
      (this.gantt.config.ignored_positions?.reduce(
        (acc: number, val: number) => {
          return acc + +(val >= this.x && val < progress_end);
        },
        0
      ) || 0) * (this.gantt.config.column_width || 0);

    progress_width += total_ignored_progress;

    let ignored_regions = this.gantt.get_ignored_region(
      this.x + progress_width
    );

    while (ignored_regions.length) {
      progress_width += this.gantt.config.column_width || 0;
      ignored_regions = this.gantt.get_ignored_region(this.x + progress_width);
    }
    this.progress_width = progress_width;
    return progress_width;
  }

  draw_label() {
    let x_coord = this.x + this.$bar.getWidth() / 2;

    if (this.task.thumbnail) {
      x_coord = this.x + this.image_size + 5;
    }

    createSVG('text', {
      x: String(x_coord),
      y: String(this.y + this.height / 2),
      innerHTML: this.task.name as string,
      class: 'bar-label',
      append_to: this.bar_group,
    });
    // labels get BBox in the next tick
    requestAnimationFrame(() => this.update_label_position());
  }

  draw_thumbnail() {
    const x_offset = 10;
    const y_offset = 2;
    const defs = createSVG('defs', {
      append_to: this.bar_group,
    }) as SVGDefsElement;

    createSVG('rect', {
      id: `rect_${this.task.id}`,
      x: String(this.x + x_offset),
      y: String(this.y + y_offset),
      width: String(this.image_size),
      height: String(this.image_size),
      rx: '15',
      class: 'img_mask',
      append_to: defs,
    });

    const clipPath = createSVG('clipPath', {
      id: `clip_${this.task.id}`,
      append_to: defs,
    }) as SVGClipPathElement;

    createSVG('use', {
      href: `#rect_${this.task.id}`,
      append_to: clipPath,
    });

    createSVG('image', {
      x: String(this.x + x_offset),
      y: String(this.y + y_offset),
      width: String(this.image_size),
      height: String(this.image_size),
      class: 'bar-img',
      href: this.task.thumbnail as string,
      clipPath: `clip_${this.task.id}`,
      append_to: this.bar_group,
    });
  }

  draw_resize_handles() {
    if (this.invalid || this.gantt.options.readonly) {
      return;
    }

    const bar = this.$bar;
    const handle_width = 3;
    this.handles = [];
    if (!this.gantt.options.readonly_dates) {
      this.handles.push(
        createSVG('rect', {
          x: String(bar.getEndX() - handle_width / 2),
          y: String(bar.getY() + this.height / 4),
          width: String(handle_width),
          height: String(this.height / 2),
          rx: String(2),
          ry: String(2),
          class: 'handle right',
          append_to: this.handle_group,
        })
      );

      this.handles.push(
        createSVG('rect', {
          x: String(bar.getX() - handle_width / 2),
          y: String(bar.getY() + this.height / 4),
          width: String(handle_width),
          height: String(this.height / 2),
          rx: String(2),
          ry: String(2),
          class: 'handle left',
          append_to: this.handle_group,
        })
      );
    }
    if (!this.gantt.options.readonly_progress) {
      const bar_progress = this.$bar_progress;
      this.$handle_progress = createSVG('circle', {
        cx: String(bar_progress.getEndX()),
        cy: String(bar_progress.getY() + bar_progress.getHeight() / 2),
        r: String(4.5),
        class: 'handle progress',
        append_to: this.handle_group,
      });
      this.handles.push(this.$handle_progress);
    }

    for (const handle of this.handles) {
      $(handle).on('mouseenter', () => $(handle).addClass('active'));
      $(handle).on('mouseleave', () => $(handle).removeClass('active'));
    }
  }

  bind() {
    if (this.invalid) {
      return;
    }
    this.setup_click_event();
  }

  setup_click_event() {
    const task_id = this.task.id;
    $(this.group).on('mouseover', (e) => {
      this.gantt.trigger_event('hover', [this.task, e.screenX, e.screenY, e]);
    });

    if (this.gantt.options.popup_on === 'click') {
      $(this.group).on('mouseup', (e) => {
        const mouseEvent = e;
        const posX = mouseEvent.offsetX || mouseEvent.layerX;
        if (this.$handle_progress) {
          const cx = +(this.$handle_progress.getAttribute('cx') || 0);
          if (cx > posX - 1 && cx < posX + 1) {
            return;
          }
        }
        this.gantt.show_popup({
          x: mouseEvent.offsetX || mouseEvent.layerX,
          y: mouseEvent.offsetY || mouseEvent.layerY,
          task: this.task,
          target: this.$bar,
        });
      });
    }
    let timeout: ReturnType<typeof setTimeout>;
    $(this.group).on('mouseenter', (e) => {
      const mouseEvent = e;
      timeout = setTimeout(() => {
        if (this.gantt.options.popup_on === 'hover') {
          this.gantt.show_popup({
            x: mouseEvent.offsetX || mouseEvent.layerX,
            y: mouseEvent.offsetY || mouseEvent.layerY,
            task: this.task,
            target: this.$bar,
          });
        }
        $(this.gantt.$container)
          .find(`.highlight-${task_id}`)
          .removeClass('hide');
      }, 200);
    });
    $(this.group).on('mouseleave', () => {
      clearTimeout(timeout);
      if (this.gantt.options.popup_on === 'hover') {
        this.gantt.popup?.hide?.();
      }
      $(this.gantt.$container).find(`.highlight-${task_id}`).addClass('hide');
    });

    $(this.group).on('click', () => {
      this.gantt.trigger_event('click', [this.task]);
    });

    $(this.group).on('dblclick', () => {
      if (this.action_completed) {
        // just finished a move action, wait for a few seconds
        return;
      }
      this.group.classList.remove('active');
      if (this.gantt.popup) {
        this.gantt.popup.parent.classList.remove('hide');
      }

      this.gantt.trigger_event('double_click', [this.task]);
    });
    let tapedTwice = false;
    $(this.group).on('touchstart', (e) => {
      if (!tapedTwice) {
        tapedTwice = true;
        setTimeout(() => {
          tapedTwice = false;
        }, 300);
        return false;
      }
      e.preventDefault();
      //action on double tap goes below

      if (this.action_completed) {
        // just finished a move action, wait for a few seconds
        return;
      }
      this.group.classList.remove('active');
      if (this.gantt.popup) {
        this.gantt.popup.parent.classList.remove('hide');
      }

      this.gantt.trigger_event('double_click', [this.task]);
      return;
    });
  }

  update_bar_position({ x = null, width = null }) {
    const bar = this.$bar;

    if (x) {
      const xs = this.task.dependencies?.map((dep: Task) =>
        this.gantt.get_bar(dep).$bar.getX()
      );
      const valid_x = xs?.reduce((prev: boolean, curr: number) => {
        return prev && x >= curr;
      }, true);
      if (!valid_x) {
        return;
      }
      this.update_attr(bar, 'x', x);
      this.x = x;
      this.$date_highlight.style.left = `${x}px`;
    }
    if (width && width > 0) {
      this.update_attr(bar, 'width', width);
      this.$date_highlight.style.width = `${width}px`;
    }

    this.update_label_position();
    this.update_handle_position();
    this.date_changed();
    this.compute_duration();

    if (this.gantt.options.show_expected_progress) {
      this.update_expected_progressbar_position();
    }

    this.update_progressbar_position();
    this.update_arrow_position();
  }

  private updateLabelX(label: SVGElement, newX: number) {
    label.setAttribute('x', String(newX));
  }

  private updateImagePosition(
    img: SVGElement,
    img_mask: SVGElement | null,
    newX: number
  ) {
    img.setAttribute('x', String(newX));
    if (img_mask) {
      img_mask.setAttribute('x', String(newX));
    }
  }

  update_label_position_on_horizontal_scroll({ x = 0, sx = 0 }) {
    const container = this.gantt.$container.querySelector('.gantt-container');
    const label = this.group.querySelector(
      '.bar-label'
    ) as unknown as SVGElement;
    const img = this.group.querySelector('.bar-img') as unknown as SVGElement;
    const img_mask = this.bar_group.querySelector(
      '.img_mask'
    ) as SVGElement | null;

    const barWidthLimit = this.$bar.getX() + this.$bar.getWidth();
    const newLabelX = label?.getX() + x || 0;
    const newImgX = (img && img.getX() + x) || 0;
    const imgWidth = (img && img.getBBox().width + 7) || 7;
    const labelEndX = newLabelX + label.getBBox().width + 7;
    const viewportCentral = sx + (container?.clientWidth || 0) / 2;

    if (label.classList.contains('big')) {
      return;
    }

    if (labelEndX < barWidthLimit && x > 0 && labelEndX < viewportCentral) {
      this.updateLabelX(label, newLabelX);
      if (img) {
        this.updateImagePosition(img, img_mask, newImgX);
      }
    } else if (
      newLabelX - imgWidth > this.$bar.getX() &&
      x < 0 &&
      labelEndX > viewportCentral
    ) {
      this.updateLabelX(label, newLabelX);
      if (img) {
        this.updateImagePosition(img, img_mask, newImgX);
      }
    }
  }

  date_changed() {
    let changed = false;
    const { new_start_date, new_end_date } = this.compute_start_end_date();
    if (Number(this.task._start) !== Number(new_start_date)) {
      changed = true;
      this.task._start = new_start_date;
    }

    if (Number(this.task._end) !== Number(new_end_date)) {
      changed = true;
      this.task._end = new_end_date;
    }

    if (!changed) {
      return;
    }

    this.gantt.trigger_event('date_change', [
      this.task,
      new_start_date,
      date_utils.add(new_end_date, -1, 'second'),
    ]);
  }

  progress_changed() {
    this.task.progress = this.compute_progress();
    this.gantt.trigger_event('progress_change', [
      this.task,
      this.task.progress,
    ]);
  }

  set_action_completed() {
    this.action_completed = true;
    setTimeout(() => {
      this.action_completed = false;
    }, 1000);
  }

  compute_start_end_date() {
    const bar = this.$bar;
    const x_in_units = bar.getX() / this.gantt.config.column_width!;
    const new_start_date = date_utils.add(
      this.gantt.gantt_start,
      x_in_units * this.gantt.config.step!,
      this.gantt.config.unit!
    );

    const width_in_units = bar.getWidth() / this.gantt.config.column_width!;
    const new_end_date = date_utils.add(
      new_start_date,
      width_in_units * this.gantt.config.step!,
      this.gantt.config.unit!
    );

    return { new_start_date, new_end_date };
  }

  compute_progress() {
    this.progress_width = this.$bar_progress.getWidth();
    this.x = this.$bar_progress.getBBox().x;
    const progress_area = this.x + this.progress_width;
    const progress =
      this.progress_width -
      (this.gantt.config.ignored_positions?.reduce(
        (acc: number, val: number) => {
          return acc + +(val >= this.x && val <= progress_area);
        },
        0
      ) || 0) *
        (this.gantt.config.column_width || 0);
    if (progress < 0) {
      return 0;
    }
    const total =
      this.$bar.getWidth() -
      this.ignored_duration_raw * (this.gantt.config.column_width || 0);
    return Number.parseInt(String((progress / total) * 100), 10);
  }

  compute_expected_progress() {
    this.expected_progress =
      date_utils.diff(date_utils.today(), this.task._start as Date, 'hour') /
      (this.gantt.config.step || 0);
    this.expected_progress =
      ((this.expected_progress < this.duration
        ? this.expected_progress
        : this.duration) *
        100) /
      this.duration;
  }

  compute_x() {
    const { column_width } = this.gantt.config;
    const task_start = this.task._start;
    const gantt_start = this.gantt.gantt_start;

    const diff =
      date_utils.diff(task_start as Date, gantt_start, this.gantt.config.unit) /
      (this.gantt.config.step || 0);

    const x = diff * (column_width || 0);

    this.x = x;
  }

  compute_y() {
    this.y =
      (this.gantt.config.header_height || 0) +
      (this.gantt.options.padding || 0) / 2 +
      (this.task._index || 0) *
        ((this.height || 0) + (this.gantt.options.padding || 0));
  }

  compute_duration() {
    let actual_duration_in_days = 0,
      duration_in_days = 0;
    for (
      let d = new Date(this.task._start as unknown as Date);
      d < (this.task._end as unknown as Date);
      d.setDate(d.getDate() + 1)
    ) {
      duration_in_days++;
      if (
        !this.gantt.config.ignored_dates?.find(
          (k: Date) => k.getTime() === d.getTime()
        ) &&
        (!this.gantt.config.ignored_function ||
          !this.gantt.config.ignored_function(d))
      ) {
        actual_duration_in_days++;
      }
    }
    this.task.actual_duration = actual_duration_in_days;
    this.task.ignored_duration = duration_in_days - actual_duration_in_days;

    this.duration =
      date_utils.convert_scales(
        `${duration_in_days}d`,
        this.gantt.config.unit!
      ) / (this.gantt.config.step || 0);

    this.actual_duration_raw =
      date_utils.convert_scales(
        `${actual_duration_in_days}d`,
        this.gantt.config.unit!
      ) / (this.gantt.config.step || 0);

    this.ignored_duration_raw = this.duration - this.actual_duration_raw;
  }

  update_attr(element: SVGElement, attr: string, value: string) {
    const num = +value;
    if (!Number.isNaN(num)) {
      element.setAttribute(attr, String(num));
    }
    return element;
  }

  update_expected_progressbar_position() {
    if (this.invalid) {
      return;
    }
    this.$expected_bar_progress.setAttribute('x', String(this.$bar.getX()));
    this.compute_expected_progress();
    this.$expected_bar_progress.setAttribute(
      'width',
      String(
        (this.gantt.config.column_width || 0) *
          (this.actual_duration_raw || 0) *
          (this.expected_progress / 100) || 0
      )
    );
  }

  update_progressbar_position() {
    if (this.invalid || this.gantt.options.readonly) {
      return;
    }
    this.$bar_progress.setAttribute('x', String(this.$bar.getX()));

    this.$bar_progress.setAttribute(
      'width',
      String(this.calculate_progress_width())
    );
  }

  update_label_position() {
    const img_mask = this.bar_group.querySelector(
      '.img_mask'
    ) as SVGElement | null;
    const bar = this.$bar,
      label = this.group.querySelector('.bar-label') as unknown as SVGElement,
      img = this.group.querySelector('.bar-img') as unknown as SVGElement;

    const padding = 5;
    const x_offset_label_img = this.image_size + 10;
    const labelWidth = label?.getBBox().width || 0;
    const barWidth = bar.getWidth();
    if (labelWidth > barWidth) {
      label.classList.add('big');
      if (img) {
        img.setAttribute('x', String(bar.getEndX() + padding));
        if (img_mask) {
          img_mask.setAttribute('x', String(bar.getEndX() + padding));
        }
        label.setAttribute('x', String(bar.getEndX() + x_offset_label_img));
      } else {
        label.setAttribute('x', String(bar.getEndX() + padding));
      }
    } else {
      label.classList.remove('big');
      if (img) {
        img.setAttribute('x', String(bar.getX() + padding));
        if (img_mask) {
          img_mask.setAttribute('x', String(bar.getX() + padding));
        }
        label.setAttribute(
          'x',
          String(bar.getX() + barWidth / 2 + x_offset_label_img)
        );
      } else {
        label.setAttribute(
          'x',
          String(bar.getX() + barWidth / 2 - labelWidth / 2)
        );
      }
    }
  }

  update_handle_position() {
    if (this.invalid || this.gantt.options.readonly) {
      return;
    }
    const bar = this.$bar;
    this.handle_group
      .querySelector('.handle.left')
      ?.setAttribute('x', String(bar.getX()));
    this.handle_group
      .querySelector('.handle.right')
      ?.setAttribute('x', String(bar.getEndX()));
    const handle = this.group.querySelector('.handle.progress');
    handle?.setAttribute('cx', String(this.$bar_progress.getEndX()));
  }

  update_arrow_position() {
    this.arrows = this.arrows || [];
    for (const arrow of this.arrows) {
      arrow.update();
    }
  }
}
