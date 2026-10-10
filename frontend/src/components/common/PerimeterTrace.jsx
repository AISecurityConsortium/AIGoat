import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';

/** Angles (deg, from the box centre) for evenly spaced points along a rounded-rect perimeter. */
export const borderAngles = (width, height, radius = 13) => {
  const w = width;
  const h = height;
  const r = Math.min(radius, w / 2, h / 2);
  const points = [];
  const pushLine = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(len));
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      points.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  const pushArc = (cx, cy, a0, a1) => {
    const sweep = Math.abs(a1 - a0);
    const steps = Math.max(1, Math.round(sweep * r));
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  pushLine(r, 0, w - r, 0);
  pushArc(w - r, r, -Math.PI / 2, 0);
  pushLine(w, r, w, h - r);
  pushArc(w - r, h - r, 0, Math.PI / 2);
  pushLine(w - r, h, r, h);
  pushArc(r, h - r, Math.PI / 2, Math.PI);
  pushLine(0, h - r, 0, r);
  pushArc(r, r, Math.PI, (Math.PI * 3) / 2);
  return points.map(([x, y]) => {
    const deg = (Math.atan2(x - w / 2, -(y - h / 2)) * 180) / Math.PI;
    return (deg + 360) % 360;
  });
};

/**
 * One white point travelling the parent's border at constant speed with a short fading trail.
 * The parent must be position: relative and own the border radius. Static under reduced motion.
 */
const PerimeterTrace = ({ radius = 8, duration = 7000 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.style.display = 'none';
      return undefined;
    }
    let samples = [];
    const rebuild = () => {
      const rect = node.getBoundingClientRect();
      samples = borderAngles(rect.width, rect.height, radius);
    };
    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(node);
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      if (samples.length > 1) {
        const scaled = (((now - start) % duration) / duration) * samples.length;
        const i = Math.floor(scaled) % samples.length;
        const frac = scaled - Math.floor(scaled);
        const a0 = samples[i];
        let delta = samples[(i + 1) % samples.length] - a0;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        node.style.setProperty('--aigoat-angle', `${(a0 + delta * frac + 360) % 360}deg`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [radius, duration]);

  return (
    <>
      <style>{`@property --aigoat-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }`}</style>
      <Box
        ref={ref}
        aria-hidden="true"
        sx={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: '-1px',
          borderRadius: 'inherit',
          padding: '1px',
          background: 'conic-gradient(from var(--aigoat-angle), transparent 0deg, transparent 318deg, rgba(255,255,255,0.06) 330deg, rgba(255,255,255,0.32) 352deg, rgba(255,255,255,0.75) 358deg, #fff 359.6deg, transparent 360deg)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
        }}
      />
    </>
  );
};

PerimeterTrace.propTypes = {
  radius: PropTypes.number,
  duration: PropTypes.number,
};

export default PerimeterTrace;
