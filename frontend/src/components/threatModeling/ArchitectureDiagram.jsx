import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as ZoomInIcon,
  Remove as ZoomOutIcon,
  FitScreen as FitIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import {
  DEFENSE_OVERLAY,
  EDGES,
  FLOW_KINDS,
  NODES,
  NODE_STATUS,
  VIEWBOX,
  ZONES,
} from '../../data/threatModeling/architecture';
import {
  edgeGeometry,
  fitView,
  panView,
  viewBoxString,
  zoomLevel,
  zoomView,
} from './diagramGeometry';

const ZOOM_STEP = 1.35;
const PAN_STEP = 60;

const pillWidth = (text, boundary) => Math.round(text.length * 6.1 + 12 + (boundary ? 14 : 0));

const nodeAriaLabel = (node) => {
  const parts = [node.label, node.sublabel, NODE_STATUS[node.status].label];
  if (node.attackSurface) parts.push('attack surface');
  return `${parts.join(', ')}. Press Enter to show details.`;
};

/**
 * Interactive architecture diagram.
 *
 * Fit-to-screen is the default and the SVG scales to its container, so the whole
 * architecture is visible without panning. Zoom and pan only change the viewBox.
 * Nodes are keyboard focusable. Edges are selectable with a pointer; the detail
 * panel lists each node's flows as buttons so keyboard users can reach them too.
 */
const ArchitectureDiagram = ({ selectedNodeId, selectedEdgeId, onSelectNode, onSelectEdge, onReset }) => {
  const theme = useTheme();
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState(fitView());
  const [focusedId, setFocusedId] = useState(null);

  const colors = useMemo(() => {
    const custom = theme.palette.custom || {};
    return {
    text: theme.palette.text.primary,
    muted: custom.text?.muted ?? theme.palette.text.secondary,
    surface: custom.surface?.elevated ?? theme.palette.background.paper,
    sunken: custom.surface?.sunken ?? theme.palette.background.default,
    border: custom.border?.strong ?? theme.palette.divider,
    subtle: custom.border?.medium ?? theme.palette.divider,
    primary: theme.palette.primary.main,
    warning: theme.palette.warning.main,
    success: theme.palette.success.main,
    zone: alpha(theme.palette.text.primary, 0.035),
    };
  }, [theme]);

  const selectedEdge = EDGES.find((e) => e.id === selectedEdgeId);
  const activeNodeIds = useMemo(() => {
    if (selectedNodeId) {
      const ids = new Set([selectedNodeId]);
      EDGES.forEach((e) => {
        if (e.from === selectedNodeId) ids.add(e.to);
        if (e.to === selectedNodeId) ids.add(e.from);
      });
      return ids;
    }
    if (selectedEdge) return new Set([selectedEdge.from, selectedEdge.to]);
    return null;
  }, [selectedNodeId, selectedEdge]);

  const isEdgeActive = (edge) => {
    if (selectedNodeId) return edge.from === selectedNodeId || edge.to === selectedNodeId;
    if (selectedEdgeId) return edge.id === selectedEdgeId;
    return true;
  };

  const geometry = useMemo(() => Object.fromEntries(EDGES.map((e) => [e.id, edgeGeometry(e)])), []);

  const zoomBy = useCallback((factor) => setView((v) => zoomView(v, factor)), []);
  const fit = useCallback(() => setView(fitView()), []);
  const reset = useCallback(() => {
    setView(fitView());
    if (onReset) onReset();
  }, [onReset]);

  // Ctrl or Cmd + wheel zooms around the pointer. A plain wheel scrolls the page.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      setView((v) => {
        const cx = v.x + ((event.clientX - rect.left) / rect.width) * v.w;
        const cy = v.y + ((event.clientY - rect.top) / rect.height) * v.h;
        return zoomView(v, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, cx, cy);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget) return; // node keys handled on the node
    switch (event.key) {
      case '+': case '=': event.preventDefault(); zoomBy(ZOOM_STEP); break;
      case '-': case '_': event.preventDefault(); zoomBy(1 / ZOOM_STEP); break;
      case '0': event.preventDefault(); fit(); break;
      case 'ArrowLeft': event.preventDefault(); setView((v) => panView(v, -PAN_STEP, 0)); break;
      case 'ArrowRight': event.preventDefault(); setView((v) => panView(v, PAN_STEP, 0)); break;
      case 'ArrowUp': event.preventDefault(); setView((v) => panView(v, 0, -PAN_STEP)); break;
      case 'ArrowDown': event.preventDefault(); setView((v) => panView(v, 0, PAN_STEP)); break;
      case 'Escape': if (onReset) onReset(); break;
      default: break;
    }
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || zoomLevel(view) <= 1.001) return;
    if (event.target.closest('[data-node]') || event.target.closest('[data-edge]')) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = { x: event.clientX, y: event.clientY, scale: view.w / rect.width };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.x) * drag.scale;
    const dy = (event.clientY - drag.y) * drag.scale;
    drag.x = event.clientX;
    drag.y = event.clientY;
    setView((v) => panView(v, -dx, -dy));
  };
  const endDrag = () => { dragRef.current = null; };

  const activateNode = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectNode(id);
    }
  };

  const zoomPct = Math.round(zoomLevel(view) * 100);

  const toolbarButton = (label, onClick, icon, testId, disabled = false) => (
    <Tooltip title={label} arrow>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          data-testid={testId}
          onClick={onClick}
          disabled={disabled}
          sx={{ border: `1px solid ${colors.subtle}`, borderRadius: '8px', bgcolor: colors.surface }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        {toolbarButton('Zoom in', () => zoomBy(ZOOM_STEP), <ZoomInIcon fontSize="small" />, 'diagram-zoom-in', zoomPct >= 400)}
        {toolbarButton('Zoom out', () => zoomBy(1 / ZOOM_STEP), <ZoomOutIcon fontSize="small" />, 'diagram-zoom-out', zoomPct <= 100)}
        {toolbarButton('Fit to screen', fit, <FitIcon fontSize="small" />, 'diagram-fit')}
        {toolbarButton('Reset view and selection', reset, <ResetIcon fontSize="small" />, 'diagram-reset')}
        <Typography
          data-testid="diagram-zoom-level"
          sx={{ fontSize: '0.8125rem', color: colors.muted, minWidth: 48 }}
          aria-live="polite"
        >
          {zoomPct}%
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: colors.muted, display: { xs: 'none', md: 'block' } }}>
          Select a component or a flow. Keys: + and - zoom, 0 fits, arrows pan when zoomed.
        </Typography>
      </Box>

      <Box
        ref={containerRef}
        role="group"
        aria-label="AIGoat architecture diagram. Tab to move between components."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="architecture-diagram"
        data-zoom={zoomPct}
        sx={{
          border: `1px solid ${colors.subtle}`,
          borderRadius: '12px',
          bgcolor: colors.sunken,
          overflow: 'hidden',
          touchAction: zoomPct > 100 ? 'none' : 'pan-y',
          cursor: zoomPct > 100 ? 'grab' : 'default',
          '&:focus-visible': { outline: `2px solid ${colors.primary}`, outlineOffset: 2 },
        }}
      >
        <svg
          viewBox={viewBoxString(view)}
          width="100%"
          style={{ display: 'block', aspectRatio: `${VIEWBOX.width} / ${VIEWBOX.height}` }}
          preserveAspectRatio="xMidYMid meet"
          fontFamily={theme.typography.fontFamily}
        >
          <title>AIGoat architecture</title>
          <desc>
            Components, data flows, trust zones and external sources of the AIGoat training platform.
            Each component can be selected to show verified facts, hypotheses and items that need validation.
          </desc>
          <defs>
            <marker id="tm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={colors.muted} />
            </marker>
            <marker id="tm-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={colors.primary} />
            </marker>
          </defs>

          {/* Trust zones */}
          {ZONES.map((zone) => (
            <g key={zone.id} data-zone={zone.id}>
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={14}
                fill={colors.zone}
                stroke={colors.border}
                strokeWidth={zone.trust === 'untrusted' || zone.trust === 'external' ? 1.6 : 1.2}
                strokeDasharray={zone.trust === 'external' ? '3 5' : zone.trust === 'untrusted' ? '' : '8 4'}
              />
              <text x={zone.x + 12} y={zone.labelBottom ? zone.y + zone.h - 10 : zone.y + 16} fontSize={11.5} fontWeight={700} fill={colors.muted} style={{ letterSpacing: '0.02em' }}>
                {zone.label}
              </text>
            </g>
          ))}

          {/* Flows */}
          {EDGES.map((edge) => {
            const g = geometry[edge.id];
            const active = isEdgeActive(edge);
            const selected = edge.id === selectedEdgeId;
            const dash = FLOW_KINDS[edge.kind].dash;
            const boundary = Boolean(edge.boundary);
            const w = pillWidth(edge.label, boundary);
            const emphasised = active && (selectedNodeId || selectedEdgeId);
            const stroke = emphasised ? colors.primary : colors.muted;
            return (
              <g
                key={edge.id}
                data-edge={edge.id}
                data-testid={`edge-${edge.id}`}
                aria-hidden="true"
                opacity={active ? 1 : 0.18}
                onClick={(e) => { e.stopPropagation(); onSelectEdge(edge.id); }}
                style={{ cursor: 'pointer' }}
              >
                <path d={g.d} fill="none" stroke="transparent" strokeWidth={14} />
                <path
                  d={g.d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={selected ? 3 : emphasised ? 2.2 : boundary ? 1.8 : 1.4}
                  strokeDasharray={dash}
                  markerEnd={`url(#${emphasised ? 'tm-arrow-active' : 'tm-arrow'})`}
                  markerStart={edge.direction === 'both' ? `url(#${emphasised ? 'tm-arrow-active' : 'tm-arrow'})` : undefined}
                />
                <g transform={`translate(${g.label.x}, ${g.label.y})`}>
                  <rect x={-w / 2} y={-8} width={w} height={16} rx={8} fill={colors.sunken} stroke={emphasised ? colors.primary : colors.subtle} strokeWidth={1} />
                  {boundary && (
                    <polygon points={`${-w / 2 + 8},-4 ${-w / 2 + 12},0 ${-w / 2 + 8},4 ${-w / 2 + 4},0`} fill={colors.warning} />
                  )}
                  <text x={boundary ? 6 : 0} y={3.5} textAnchor="middle" fontSize={10.5} fill={colors.text}>{edge.label}</text>
                </g>
              </g>
            );
          })}

          {/* Defense overlay (not a node) */}
          <g
            data-node="defense"
            role="button"
            tabIndex={0}
            aria-label="Defense pipeline overlay. Press Enter to show details."
            aria-pressed={selectedNodeId === 'defense'}
            onClick={() => onSelectNode('defense')}
            onKeyDown={(e) => activateNode(e, 'defense')}
            onFocus={() => setFocusedId('defense')}
            onBlur={() => setFocusedId(null)}
            style={{ cursor: 'pointer', outline: 'none' }}
            opacity={activeNodeIds && selectedNodeId !== 'defense' ? 0.45 : 1}
          >
            <rect
              x={DEFENSE_OVERLAY.x} y={DEFENSE_OVERLAY.y} width={DEFENSE_OVERLAY.w} height={DEFENSE_OVERLAY.h} rx={8}
              fill={colors.sunken}
            />
            <rect
              x={DEFENSE_OVERLAY.x} y={DEFENSE_OVERLAY.y} width={DEFENSE_OVERLAY.w} height={DEFENSE_OVERLAY.h} rx={8}
              fill={alpha(colors.warning, 0.08)}
              stroke={selectedNodeId === 'defense' ? colors.primary : colors.warning}
              strokeWidth={selectedNodeId === 'defense' ? 2.5 : 1.3}
              strokeDasharray="6 4"
            />
            <text x={DEFENSE_OVERLAY.x + DEFENSE_OVERLAY.w / 2} y={DEFENSE_OVERLAY.y + 23} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={colors.text}>
              Defense pipeline: controls run inside each surface (Level 0 none, Level 1, Level 2)
            </text>
            {focusedId === 'defense' && (
              <rect x={DEFENSE_OVERLAY.x - 4} y={DEFENSE_OVERLAY.y - 4} width={DEFENSE_OVERLAY.w + 8} height={DEFENSE_OVERLAY.h + 8} rx={11} fill="none" stroke={colors.primary} strokeWidth={2.5} />
            )}
          </g>

          {/* Nodes */}
          {NODES.map((node) => {
            const selected = node.id === selectedNodeId;
            const dimmed = activeNodeIds && !activeNodeIds.has(node.id);
            const optional = node.status === 'optional';
            const external = node.status === 'external';
            const stroke = selected ? colors.primary : external ? colors.muted : optional ? colors.muted : colors.border;
            return (
              <g
                key={node.id}
                data-node={node.id}
                data-testid={`node-${node.id}`}
                data-status={node.status}
                role="button"
                tabIndex={0}
                aria-label={nodeAriaLabel(node)}
                aria-pressed={selected}
                onClick={() => onSelectNode(node.id)}
                onKeyDown={(e) => activateNode(e, node.id)}
                onFocus={() => setFocusedId(node.id)}
                onBlur={() => setFocusedId(null)}
                opacity={dimmed ? 0.4 : 1}
                style={{ cursor: 'pointer', outline: 'none' }}
                className="tm-node"
              >
                {external && (
                  <rect x={node.x - 3} y={node.y - 3} width={node.w + 6} height={node.h + 6} rx={13} fill="none" stroke={stroke} strokeWidth={1} />
                )}
                <rect
                  x={node.x} y={node.y} width={node.w} height={node.h} rx={10}
                  fill={colors.surface}
                  stroke={stroke}
                  strokeWidth={selected ? 3 : 1.6}
                  strokeDasharray={optional ? '7 4' : ''}
                />
                <text x={node.x + node.w / 2} y={node.y + node.h / 2 - (node.h > 80 ? 4 : 2)} textAnchor="middle" fontSize={13.5} fontWeight={700} fill={colors.text}>
                  {node.label}
                </text>
                <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 14} textAnchor="middle" fontSize={10.5} fill={colors.muted}>
                  {node.sublabel}
                </text>
                {(optional || external) && (
                  <text x={node.x + 9} y={node.y + 13} fontSize={9} fontWeight={700} fill={colors.muted} style={{ letterSpacing: '0.06em' }}>
                    {optional ? 'OPTIONAL' : 'EXTERNAL'}
                  </text>
                )}
                {node.attackSurface && (
                  <g aria-hidden="true" transform={`translate(${node.x + node.w - 14}, ${node.y - 1})`}>
                    <polygon points="0,16 8,0 16,16" fill={colors.warning} stroke={colors.sunken} strokeWidth={1.5} />
                    <text x={8} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="#1a1a1a">!</text>
                  </g>
                )}
                {selected && (
                  <rect x={node.x - 4} y={node.y - 4} width={node.w + 8} height={node.h + 8} rx={13} fill="none" stroke={colors.primary} strokeWidth={1} strokeDasharray="2 3" />
                )}
                {focusedId === node.id && (
                  <rect data-testid="focus-ring" x={node.x - 6} y={node.y - 6} width={node.w + 12} height={node.h + 12} rx={15} fill="none" stroke={colors.primary} strokeWidth={2.5} />
                )}
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
};

ArchitectureDiagram.propTypes = {
  selectedNodeId: PropTypes.string,
  selectedEdgeId: PropTypes.string,
  onSelectNode: PropTypes.func.isRequired,
  onSelectEdge: PropTypes.func.isRequired,
  onReset: PropTypes.func,
};

export default ArchitectureDiagram;
