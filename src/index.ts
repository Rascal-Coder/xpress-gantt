import './styles/gantt.css';

interface GanttOptions {
  // 定义具体的选项类型
  [key: string]: unknown;
}

interface CreateElOptions {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  id?: string;
  classes: string;
  append_to: HTMLElement | SVGElement;
  type?: string;
}

interface SVGAttributes {
  [key: string]: string | HTMLElement | SVGElement;
}

export default class Gantt {
  private $svg: SVGElement = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  );
  private $container: HTMLElement = document.createElement('div');
  private $popup_wrapper: HTMLElement = document.createElement('div');

  constructor(
    wrapper: string | HTMLElement | SVGElement,
    tasks: unknown[],
    options: GanttOptions
  ) {
    this.setup_wrapper(wrapper);
  }

  private createSVG(tag: string, attrs: SVGAttributes): SVGElement {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [attr, value] of Object.entries(attrs)) {
      if (attr === 'append_to' && value instanceof Element) {
        value.appendChild(elem);
      } else if (typeof value === 'string') {
        elem.setAttribute(attr, value);
      }
    }
    return elem;
  }

  private setup_wrapper(element: string | HTMLElement | SVGElement): void {
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
        'Frappe Gantt only supports usage of a string CSS selector,' +
          " HTML DOM element or SVG DOM element for the 'element' parameter"
      );
    }

    // svg element
    if (svg_element) {
      this.$svg = svg_element;
      this.$svg.classList.add('gantt');
    } else {
      // create it
      this.$svg = this.createSVG('svg', {
        append_to: wrapper_element as HTMLElement,
        class: 'gantt',
      });
    }

    // wrapper element
    this.$container = this.create_el({
      classes: 'gantt-container',
      append_to: this.$svg.parentElement as HTMLElement,
      left: 0,
      top: 0,
    });

    this.$container.appendChild(this.$svg);
    this.$popup_wrapper = this.create_el({
      classes: 'popup-wrapper',
      append_to: this.$container,
      left: 0,
      top: 0,
    });
  }

  private create_el({
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
    for (const cls of classes.split(' ')) $el.classList.add(cls);
    $el.style.top = `${top}px`;
    $el.style.left = `${left}px`;
    if (id) $el.id = id;
    if (width) $el.style.width = `${width}px`;
    if (height) $el.style.height = `${height}px`;
    if (append_to) append_to.appendChild($el);
    return $el;
  }
}
