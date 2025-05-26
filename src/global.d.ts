declare global {
  interface SVGElement {
    getX(): number;
    getY(): number;
    getWidth(): number;
    getHeight(): number;
    getEndX(): number;
    getBBox(): {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }
}

export {};
