import $ from 'cash-dom';
import type { Gantt, PopupFunction, ShowOptions } from './types';
export default class Popup {
  parent: HTMLElement;
  private popup_func: PopupFunction;
  private gantt: Gantt;
  private title!: HTMLElement;
  private subtitle!: HTMLElement;
  private details!: HTMLElement;
  private actions!: HTMLElement;

  constructor(parent: HTMLElement, popup_func: PopupFunction, gantt: Gantt) {
    this.parent = parent;
    this.popup_func = popup_func;
    this.gantt = gantt;

    this.make();
  }

  make(): void {
    $(this.parent).html(
      `
            <div class="title"></div>
            <div class="subtitle"></div>
            <div class="details"></div>
            <div class="actions"></div>
        `
    );
    this.hide();

    this.title = this.parent.querySelector('.title')!;
    this.subtitle = this.parent.querySelector('.subtitle')!;
    this.details = this.parent.querySelector('.details')!;
    this.actions = this.parent.querySelector('.actions')!;
  }

  show({ x, y, task }: ShowOptions): void {
    $(this.actions).html('');

    const html = this.popup_func({
      task,
      chart: this.gantt,
      get_title: () => this.title,
      set_title: (title) => {
        $(this.title).html(title);
      },
      get_subtitle: () => this.subtitle,
      set_subtitle: (subtitle) => {
        $(this.subtitle).html(subtitle);
      },
      get_details: () => this.details,
      set_details: (details) => {
        $(this.details).html(details);
      },
      add_action: (htmlContent, func) => {
        const action = this.gantt.create_el({
          classes: 'action-btn',
          type: 'button',
          append_to: this.actions,
        });

        const finalHtml: string =
          typeof htmlContent === 'function' ? htmlContent(task) : htmlContent;

        $(action).html(finalHtml);
        $(action).on('click', (e) => func(task, this.gantt, e));
      },
    });

    if (html === false) {
      return;
    }
    if (html) {
      $(this.parent).html(html);
    }

    if ($(this.actions).html() === '') {
      $(this.actions).remove();
    } else {
      $(this.parent).append(this.actions);
    }
    $(this.parent).css('left', `${x + 10}px`);
    $(this.parent).css('top', `${y - 10}px`);
    $(this.parent).removeClass('hide');
  }

  hide(): void {
    $(this.parent).addClass('hide');
  }
}
