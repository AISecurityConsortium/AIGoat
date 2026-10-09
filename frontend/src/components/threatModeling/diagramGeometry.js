/**
 * Pure geometry helpers for the architecture diagram. No React, no DOM, so they
 * are easy to test. All coordinates are in viewBox units.
 */
import { EDGES, NODE_BY_ID, ZONE_BY_ID, VIEWBOX } from '../../data/threatModeling/architecture';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** The default view: the whole diagram. */
export const fitView = () => ({ x: 0, y: 0, w: VIEWBOX.width, h: VIEWBOX.height });

export const zoomLevel = (view) => VIEWBOX.width / view.w;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Keep the view inside the diagram bounds. */
export const clampView = (view) => {
  const w = clamp(view.w, VIEWBOX.width / MAX_ZOOM, VIEWBOX.width / MIN_ZOOM);
  const h = (w * VIEWBOX.height) / VIEWBOX.width;
  return {
    w,
    h,
    x: clamp(view.x, 0, VIEWBOX.width - w),
    y: clamp(view.y, 0, VIEWBOX.height - h),
  };
};

/** Zoom by factor (>1 zooms in) keeping the point (cx, cy) fixed on screen. */
export const zoomView = (view, factor, cx = view.x + view.w / 2, cy = view.y + view.h / 2) => {
  const w = view.w / factor;
  const clampedW = clamp(w, VIEWBOX.width / MAX_ZOOM, VIEWBOX.width / MIN_ZOOM);
  const k = clampedW / view.w;
  const h = view.h * k;
  return clampView({
    w: clampedW,
    h,
    x: cx - (cx - view.x) * k,
    y: cy - (cy - view.y) * k,
  });
};

export const panView = (view, dx, dy) => clampView({ ...view, x: view.x + dx, y: view.y + dy });

export const viewBoxString = (view) => `${view.x} ${view.y} ${view.w} ${view.h}`;

const rectOf = (id) => {
  if (id.startsWith('zone:')) return ZONE_BY_ID[id.slice(5)];
  return NODE_BY_ID[id];
};

const sidePoint = (rect, side, fraction = 0.5) => {
  switch (side) {
    case 'r': return { x: rect.x + rect.w, y: rect.y + rect.h * fraction };
    case 'l': return { x: rect.x, y: rect.y + rect.h * fraction };
    case 't': return { x: rect.x + rect.w * fraction, y: rect.y };
    default: return { x: rect.x + rect.w * fraction, y: rect.y + rect.h };
  }
};

/**
 * Spread the ports of edges that share the same node side, ordered by where
 * the other end sits, so lines do not all pile on one point.
 */
const allocatePorts = () => {
  const groups = new Map();
  EDGES.forEach((edge) => {
    [['from', 'to', edge.fromPort], ['to', 'from', edge.toPort]].forEach(([end, other, side]) => {
      const key = `${edge[end]}|${side}`;
      const otherRect = rectOf(edge[other]);
      const sortKey = edge.toX && end === 'to' ? edge.toX : otherRect.x + otherRect.w / 2;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ edgeId: edge.id, end, sortKey });
    });
  });
  const result = {};
  groups.forEach((list) => {
    list.sort((a, b) => a.sortKey - b.sortKey);
    list.forEach((item, idx) => {
      const fraction = (idx + 1) / (list.length + 1);
      result[`${item.edgeId}|${item.end}`] = fraction;
    });
  });
  return result;
};

const PORTS = allocatePorts();

const cubicPoint = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

/** Geometry for one edge: svg path, label point and endpoints. */
export const edgeGeometry = (edge) => {
  const fromRect = rectOf(edge.from);
  const toRect = rectOf(edge.to);
  const fromFraction = PORTS[`${edge.id}|from`] ?? 0.5;
  let toFraction = PORTS[`${edge.id}|to`] ?? 0.5;
  const start = sidePoint(fromRect, edge.fromPort, fromFraction);
  let end = sidePoint(toRect, edge.toPort, toFraction);
  if (edge.toX && (edge.toPort === 't' || edge.toPort === 'b')) {
    toFraction = (edge.toX - toRect.x) / toRect.w;
    end = { x: edge.toX, y: end.y };
  }
  const vertical = edge.fromPort === 'b' || edge.fromPort === 't';
  let c1;
  let c2;
  if (vertical) {
    const dy = (end.y - start.y) * 0.5;
    c1 = { x: start.x, y: start.y + dy };
    c2 = { x: end.x, y: end.y - dy };
  } else {
    const dx = (end.x - start.x) * 0.5;
    c1 = { x: start.x + dx, y: start.y };
    c2 = { x: end.x - dx, y: end.y };
  }
  const d = `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
  const label = cubicPoint(start, c1, c2, end, edge.labelT ?? 0.5);
  return { d, start, end, label };
};

/** Ids of edges touching a node. */
export const edgesTouching = (nodeId) => EDGES.filter((e) => e.from === nodeId || e.to === nodeId).map((e) => e.id);

/** Neighbours reachable by one flow from a node. */
export const neighbours = (nodeId) => {
  const ids = new Set();
  EDGES.forEach((e) => {
    if (e.from === nodeId && !e.to.startsWith('zone:')) ids.add(e.to);
    if (e.to === nodeId) ids.add(e.from);
  });
  return Array.from(ids);
};
