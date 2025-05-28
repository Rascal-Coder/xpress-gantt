import $ from 'cash-dom';
import type { CreateSVGAttributes } from './types';
// const SPACE_REGEX = /\s+/;

const CUBIC_BEZIER = {
  ease: '.25 .1 .25 1',
  linear: '0 0 1 1',
  'ease-in': '.42 0 1 1',
  'ease-out': '0 0 .58 1',
  'ease-in-out': '.42 0 .58 1',
};

/**
 * 选择器函数，查询DOM元素
 * @template T - 元素类型
 * @param {string | T | null | undefined} expr - 选择器表达式或元素
 * @param {Document | Element} [con] - 上下文容器
 * @returns {T | null} 查询到的元素或null
 *
 * @example
 * // 通过ID选择元素
 * const element = $('#my-element');
 *
 * @example
 * // 在指定容器内选择元素
 * const container = document.querySelector('.container');
 * const button = $('button', container);
 */
// export function $<T extends Element = Element>(
//   expr: string | T | null | undefined,
//   con?: Document | Element
// ): T | null {
//   if (typeof expr === 'string') {
//     return (con || document).querySelector<T>(expr);
//   }
//   return expr ?? null;
// }

// /**
//  * 绑定事件监听器
//  * @param {Element} element - 目标元素
//  * @param {string} event - 事件名称
//  * @param {string | EventListener} selectorOrCallback - 选择器或回调函数
//  * @param {EventListener} [callback] - 回调函数（当第三个参数为选择器时）
//  */
// $.on = (
//   element: Element,
//   event: string,
//   selectorOrCallback: string | EventListener,
//   callback?: EventListener
// ): void => {
//   if (callback) {
//     // 四个参数的情况：element, event, selector, callback
//     $.delegate(element, event, selectorOrCallback as string, callback);
//   } else {
//     // 三个参数的情况：element, event, callback
//     $.bind(element, event, selectorOrCallback as EventListener);
//   }
// };

// /**
//  * 移除事件监听器
//  * @param {Element} element - 目标元素
//  * @param {string} event - 事件名称
//  * @param {EventListener} handler - 事件处理函数
//  */
// $.off = (element: Element, event: string, handler: EventListener): void => {
//   element.removeEventListener(event, handler);
// };

// /**
//  * 直接绑定事件到元素
//  * @param {Element} element - 目标元素
//  * @param {string} event - 事件名称，可以是空格分隔的多个事件
//  * @param {EventListener} callback - 事件处理函数
//  */
// $.bind = (element: Element, event: string, callback: EventListener): void => {
//   for (const eventName of event.split(SPACE_REGEX)) {
//     element.addEventListener(eventName, callback);
//   }
// };

// /**
//  * 使用事件委托绑定事件
//  * @param {Element} element - 委托元素
//  * @param {string} event - 事件名称
//  * @param {string} selector - 目标选择器
//  * @param {EventListener} callback - 事件处理函数
//  */
// $.delegate = (
//   element: Element,
//   event: string,
//   selector: string,
//   callback: EventListener
// ): void => {
//   element.addEventListener(event, function (this: Element, e: Event) {
//     const target = e.target as Element;
//     const delegatedTarget = target.closest(selector);
//     if (delegatedTarget) {
//       (e as CustomEvent).delegatedTarget = delegatedTarget;
//       callback.call(this, e);
//     }
//   });
// };

// /**
//  * 查找最近的匹配选择器的祖先元素
//  * @param {string} selector - CSS选择器
//  * @param {Element} element - 起始元素
//  * @returns {Element | null} 匹配的元素或null
//  */
// $.closest = (selector: string, element: Element): Element | null => {
//   if (!element) {
//     return null;
//   }

//   if (element.matches(selector)) {
//     return element;
//   }

//   return element.parentNode instanceof Element
//     ? $.closest(selector, element.parentNode as Element)
//     : null;
// };

// /**
//  * 获取或设置元素属性
//  * @param {Element} element - 目标元素
//  * @param {string | Record<string, string>} attr - 属性名或属性对象
//  * @param {string} [value] - 属性值（当attr为字符串时）
//  * @returns {string | null | undefined} 获取属性时返回属性值，设置属性时返回undefined
//  */
// $.attr = (
//   element: Element,
//   attr: string | Record<string, string>,
//   value?: string
// ): string | null | undefined => {
//   if (!value && typeof attr === 'string') {
//     return element.getAttribute(attr);
//   }

//   if (typeof attr === 'object') {
//     for (const key in attr) {
//       if (Object.prototype.hasOwnProperty.call(attr, key)) {
//         $.attr(element, key, attr[key]);
//       }
//     }
//     return undefined;
//   }

//   if (value) {
//     element.setAttribute(attr, value);
//   }
//   return undefined;
// };

/**
 * 获取贝塞尔曲线参数
 * @param {keyof typeof CUBIC_BEZIER} name - 曲线名称
 * @returns {string} 贝塞尔曲线参数
 */
function cubic_bezier(name: keyof typeof CUBIC_BEZIER) {
  return CUBIC_BEZIER[name];
}

/**
 * 创建SVG元素并设置属性
 * @template K - SVG元素标签名称的类型
 * @param {K} tag - SVG标签名称
 * @param {CreateSVGAttributes} attrs - 要设置的属性对象
 * @param {HTMLElement} [attrs.append_to] - 将创建的元素附加到的父元素
 * @param {string} [attrs.innerHTML] - 设置元素的innerHTML内容
 * @param {string} [attrs.clipPath] - 设置元素的clipPath属性
 * @returns {SVGElementTagNameMap[K]} 创建的SVG元素
 *
 * @example
 * // 创建一个简单的圆形
 * const circle = createSVG('circle', {
 *   cx: '50',
 *   cy: '50',
 *   r: '25',
 *   fill: 'red'
 * });
 *
 * @example
 * // 创建SVG元素并添加到容器
 * const container = document.getElementById('svg-container');
 * const rect = createSVG('rect', {
 *   x: '10',
 *   y: '10',
 *   width: '100',
 *   height: '50',
 *   fill: 'blue',
 *   append_to: container
 * });
 *
 * @example
 * // 创建带有innerHTML的SVG文本元素
 * const text = createSVG('text', {
 *   x: '20',
 *   y: '30',
 *   innerHTML: '这是<tspan fill="red">SVG</tspan>文本'
 * });
 */
export function createSVG<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: CreateSVGAttributes
): SVGElementTagNameMap[K] {
  const svgNS = 'http://www.w3.org/2000/svg';
  const elem = document.createElementNS(svgNS, tag);
  for (const attr in attrs) {
    if (attr === 'append_to') {
      const parent = attrs.append_to;
      if (parent) {
        parent.appendChild(elem);
      }
    } else if (attr === 'innerHTML') {
      if (attrs.innerHTML) {
        elem.innerHTML = attrs.innerHTML;
      }
    } else if (attr === 'clipPath') {
      elem.setAttribute('clip-path', `url(#${attrs[attr]})`);
    } else {
      elem.setAttribute(attr, attrs[attr]);
    }
  }
  return elem;
}

/**
 * 为SVG元素添加动画
 * @param {SVGElement} svgElement - SVG元素
 * @param {string} attr - 要动画的属性
 * @param {string} from - 起始值
 * @param {string} to - 结束值
 *
 * @example
 * // 为圆形添加半径动画
 * const circle = document.querySelector('circle');
 * animateSVG(circle, 'r', '5', '20');
 *
 * @example
 * // 为矩形添加宽度变化动画
 * const rect = document.querySelector('rect');
 * animateSVG(rect, 'width', '50', '200');
 */
export function animateSVG(
  svgElement: SVGElement,
  attr: string,
  from: string,
  to: string
) {
  const animatedSvgElement = getAnimationElement(svgElement, attr, from, to);

  if (animatedSvgElement === svgElement) {
    const event = new Event('click', {
      bubbles: true,
      cancelable: true,
    });
    animatedSvgElement.dispatchEvent(event);
  }
}

/**
 * 获取或创建SVG动画元素
 * @param {SVGElement} svgElement - SVG元素
 * @param {string} attr - 要动画的属性
 * @param {string} from - 起始值
 * @param {string} to - 结束值
 * @param {string} [dur='0.4s'] - 动画持续时间
 * @param {string} [begin='0.1s'] - 动画开始延迟
 * @returns {SVGElement} 带有动画的SVG元素
 */
function getAnimationElement(
  svgElement: SVGElement,
  attr: string,
  from: string,
  to: string,
  dur = '0.4s',
  begin = '0.1s'
) {
  const animEl = svgElement.querySelector('animate');
  if (animEl) {
    $(animEl).attr({
      attributeName: attr,
      from,
      to,
      dur,
      begin: `click + ${begin}`,
    });
    return svgElement;
  }

  const animateElement = createSVG('animate', {
    attributeName: attr,
    from,
    to,
    dur,
    begin,
    calcMode: 'spline',
    values: `${from};${to}`,
    keyTimes: '0; 1',
    keySplines: cubic_bezier('ease-out'),
  });
  $(svgElement).append(animateElement);

  return svgElement;
}
