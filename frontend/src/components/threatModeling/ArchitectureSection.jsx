import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from '@mui/material';
import { AccountTree as DiagramIcon, ViewList as ListIcon } from '@mui/icons-material';
import {
  EDGES,
  FLOW_KINDS,
  NODES,
  NODE_BY_ID,
  NODE_STATUS,
  TRUST_BOUNDARIES,
  ZONES,
} from '../../data/threatModeling/architecture';
import ArchitectureDiagram from './ArchitectureDiagram';
import DiagramLegend from './DiagramLegend';
import NodeDetailPanel from './NodeDetailPanel';

const label = (id) => (id.startsWith('zone:') ? 'AIGoat backend' : NODE_BY_ID[id]?.label ?? id);

/** Accessible alternative to the diagram, and the default on narrow screens. */
const ComponentList = ({ selectedNodeId, onSelectNode, onSelectEdge }) => (
  <Box data-testid="component-list">
    {ZONES.map((zone) => {
      const nodes = NODES.filter((n) => n.zone === zone.id);
      if (nodes.length === 0) return null;
      return (
        <Box key={zone.id} sx={{ mb: 2 }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.75 }}>{zone.label}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {nodes.map((node) => (
              <Box
                key={node.id}
                component="button"
                type="button"
                onClick={() => onSelectNode(node.id)}
                aria-pressed={selectedNodeId === node.id}
                data-testid={`list-node-${node.id}`}
                sx={{
                  textAlign: 'left',
                  p: 1.25,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'text.primary',
                  bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                  border: (t) => `${selectedNodeId === node.id ? 2 : 1}px ${node.status === 'optional' ? 'dashed' : 'solid'} ${selectedNodeId === node.id ? t.palette.primary.main : (t.palette.custom?.border?.medium ?? t.palette.divider)}`,
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>{node.label}</Typography>
                  <Chip size="small" variant="outlined" label={NODE_STATUS[node.status].label} sx={{ height: 20, fontSize: '0.7rem' }} />
                  {node.attackSurface && <Chip size="small" color="warning" variant="outlined" label="Attack surface" sx={{ height: 20, fontSize: '0.7rem' }} />}
                </Box>
                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{node.sublabel}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      );
    })}
    <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.75 }}>Data flows</Typography>
    <Box component="ul" aria-label="Data flows" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {EDGES.map((edge) => (
        <li key={edge.id}>
          <Box
            component="button"
            type="button"
            onClick={() => onSelectEdge(edge.id)}
            data-testid={`list-edge-${edge.id}`}
            sx={{
              width: '100%',
              textAlign: 'left',
              p: 1,
              borderRadius: '8px',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: '0.875rem',
              color: 'text.primary',
              bgcolor: 'transparent',
              border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
              '&:hover': { borderColor: 'primary.main' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <strong>{label(edge.from)}</strong>{edge.direction === 'both' ? ' \u21c4 ' : ' \u2192 '}<strong>{label(edge.to)}</strong>
            {`: ${edge.label}`}
            <Typography component="span" sx={{ display: 'block', fontSize: '0.8125rem', color: 'text.secondary' }}>
              {`${FLOW_KINDS[edge.kind].label}. Trust boundary: ${TRUST_BOUNDARIES.find((b) => b.id === edge.boundary)?.label ?? 'none'}`}
            </Typography>
          </Box>
        </li>
      ))}
    </Box>
  </Box>
);

ComponentList.propTypes = {
  selectedNodeId: PropTypes.string,
  onSelectNode: PropTypes.func.isRequired,
  onSelectEdge: PropTypes.func.isRequired,
};

const ArchitectureSection = ({ focusRequest }) => {
  const narrow = useMediaQuery('(max-width:700px)');
  const [mode, setMode] = useState(null); // null means "follow the screen size"
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const panelRef = useRef(null);
  const effectiveMode = mode ?? (narrow ? 'list' : 'diagram');

  const selectNode = useCallback((id) => {
    setSelectedEdgeId(null);
    setSelectedNodeId(id);
  }, []);
  const selectEdge = useCallback((id) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(id);
  }, []);
  const clear = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // A scenario can ask the diagram to show a component.
  useEffect(() => {
    if (focusRequest && NODE_BY_ID[focusRequest.id]) selectNode(focusRequest.id);
  }, [focusRequest, selectNode]);

  // Bring the panel into view when something is selected, and move focus there.
  useEffect(() => {
    if (!selectedNodeId && !selectedEdgeId) return;
    const el = panelRef.current;
    if (!el) return;
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }, [selectedNodeId, selectedEdgeId]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', maxWidth: 760 }}>
          Every component and flow below exists in the repo and cites its source files. Select one to see verified facts, threat hypotheses and items that need validation.
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={effectiveMode}
          onChange={(_, value) => value && setMode(value)}
          aria-label="Architecture view"
        >
          <ToggleButton value="diagram" aria-label="Diagram view" data-testid="view-diagram"><DiagramIcon fontSize="small" sx={{ mr: 0.5 }} />Diagram</ToggleButton>
          <ToggleButton value="list" aria-label="List view" data-testid="view-list"><ListIcon fontSize="small" sx={{ mr: 0.5 }} />List</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {effectiveMode === 'diagram' ? (
        <ArchitectureDiagram
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onSelectNode={selectNode}
          onSelectEdge={selectEdge}
          onReset={clear}
        />
      ) : (
        <ComponentList selectedNodeId={selectedNodeId} onSelectNode={selectNode} onSelectEdge={selectEdge} />
      )}

      <NodeDetailPanel
        ref={panelRef}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onSelectNode={selectNode}
        onSelectEdge={selectEdge}
        onClose={clear}
      />
      <DiagramLegend />
    </Box>
  );
};

ArchitectureSection.propTypes = {
  /** { id, nonce }: select this component; a new nonce makes each request distinct. */
  focusRequest: PropTypes.shape({ id: PropTypes.string, nonce: PropTypes.number }),
};

export default ArchitectureSection;
