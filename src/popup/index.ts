import type { Gantt, PopupFunction, ShowOptions } from './types';

export default class Popup {
  private parent: HTMLElement;
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
    this.parent.innerHTML = `
            <div class="title"></div>
            <div class="subtitle"></div>
            <div class="details"></div>
            <div class="actions"></div>
        `;
    this.hide();

    this.title = this.parent.querySelector('.title') as HTMLElement;
    this.subtitle = this.parent.querySelector('.subtitle') as HTMLElement;
    this.details = this.parent.querySelector('.details') as HTMLElement;
    this.actions = this.parent.querySelector('.actions') as HTMLElement;
  }

  show({ x, y, task }: ShowOptions): void {
    this.actions.innerHTML = '';

    const html = this.popup_func({
      task,
      chart: this.gantt,
      get_title: () => this.title,
      set_title: (title) => {
        this.title.innerHTML = title;
      },
      get_subtitle: () => this.subtitle,
      set_subtitle: (subtitle) => {
        this.subtitle.innerHTML = subtitle;
      },
      get_details: () => this.details,
      set_details: (details) => {
        this.details.innerHTML = details;
      },
      add_action: (htmlContent, func) => {
        const action = this.gantt.create_el({
          classes: 'action-btn',
          type: 'button',
          append_to: this.actions,
        });

        const finalHtml: string =
          typeof htmlContent === 'function' ? htmlContent(task) : htmlContent;

        action.innerHTML = finalHtml;
        action.onclick = (e) => func(task, this.gantt, e as MouseEvent);
      },
    });

    if (html === false) {
      return;
    }
    if (html) {
      this.parent.innerHTML = html;
    }

    if (this.actions.innerHTML === '') {
      this.actions.remove();
    } else {
      this.parent.appendChild(this.actions);
    }

    this.parent.style.left = `${x + 10}px`;
    this.parent.style.top = `${y - 10}px`;
    this.parent.classList.remove('hide');
  }

  hide(): void {
    this.parent.classList.add('hide');
  }
}
