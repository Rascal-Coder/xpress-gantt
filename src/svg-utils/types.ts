interface CubicBezier {
  ease: string;
  linear: string;
  'ease-in': string;
  'ease-out': string;
  'ease-in-out': string;
}

type CreateSVGAttributes = {
  append_to?: Element;
  innerHTML?: string;
  clipPath?: string;
} & Omit<
  Partial<SVGElementTagNameMap[keyof SVGElementTagNameMap]>,
  'append_to' | 'innerHTML' | 'clipPath'
> & {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    [key: string]: any;
  };

type CustomEvent = Event & { delegatedTarget: Element };

export type { CubicBezier, CreateSVGAttributes, CustomEvent };
