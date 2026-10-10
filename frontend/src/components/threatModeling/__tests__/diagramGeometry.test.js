import { EDGES, VIEWBOX } from '../../../data/threatModeling/architecture';
import {
  MAX_ZOOM, MIN_ZOOM, clampView, edgeGeometry, edgesTouching, fitView, neighbours, panView, viewBoxString, zoomLevel, zoomView,
} from '../diagramGeometry';

describe('diagram geometry', () => {
  test('fit shows the whole diagram at 100 percent', () => {
    const v = fitView();
    expect(v).toEqual({ x: 0, y: 0, w: VIEWBOX.width, h: VIEWBOX.height });
    expect(zoomLevel(v)).toBe(1);
    expect(viewBoxString(v)).toBe(`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`);
  });

  test('zoom in is limited to the maximum and zoom out to the fit view', () => {
    let v = fitView();
    for (let i = 0; i < 30; i += 1) v = zoomView(v, 1.25);
    expect(zoomLevel(v)).toBeCloseTo(MAX_ZOOM, 5);
    for (let i = 0; i < 60; i += 1) v = zoomView(v, 1 / 1.25);
    expect(zoomLevel(v)).toBeCloseTo(MIN_ZOOM, 5);
    expect(v).toEqual(fitView());
  });

  test('zooming keeps the anchor point in place', () => {
    const v = fitView();
    const z = zoomView(v, 2, 600, 360);
    expect(z.x + z.w / 2).toBeCloseTo(600);
    expect(z.y + z.h / 2).toBeCloseTo(360);
    const corner = zoomView(v, 2, 0, 0);
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
  });

  test('panning never leaves the diagram', () => {
    const z = zoomView(fitView(), 2);
    const left = panView(z, -5000, -5000);
    expect(left.x).toBe(0);
    expect(left.y).toBe(0);
    const right = panView(z, 5000, 5000);
    expect(right.x + right.w).toBeCloseTo(VIEWBOX.width);
    expect(right.y + right.h).toBeCloseTo(VIEWBOX.height);
    expect(panView(fitView(), 100, 100)).toEqual(fitView());
  });

  test('clamp keeps the aspect ratio', () => {
    const v = clampView({ x: -10, y: -10, w: 400, h: 10 });
    expect(v.w / v.h).toBeCloseTo(VIEWBOX.width / VIEWBOX.height);
  });

  test('every edge has finite geometry inside the diagram', () => {
    EDGES.forEach((e) => {
      const g = edgeGeometry(e);
      expect(g.d).toMatch(/^M /);
      [g.start, g.end, g.label].forEach((p) => {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(VIEWBOX.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(VIEWBOX.height);
      });
    });
  });

  test('neighbour helpers agree with the edge list', () => {
    expect(edgesTouching('chat').length).toBeGreaterThan(0);
    expect(neighbours('chat')).toEqual(expect.arrayContaining(['api', 'ollama', 'chroma']));
  });
});
