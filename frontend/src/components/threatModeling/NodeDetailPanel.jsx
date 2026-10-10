import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Chip, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import {
  DEFENSE_OVERLAY,
  EDGES,
  FLOW_KINDS,
  NODE_BY_ID,
  NODE_STATUS,
  TRUST_BOUNDARIES,
  ZONE_BY_ID,
} from '../../data/threatModeling/architecture';
import { labPath } from '../../utils/taxonomyLinks';
import { Body, ClaimList, SubHeading } from './labels';

const nodeLabel = (id) => (id.startsWith('zone:') ? `${ZONE_BY_ID[id.slice(5)].label}` : NODE_BY_ID[id]?.label ?? id);

const Section = ({ title, children }) => (
  <Box sx={{ mb: 2 }}>
    <SubHeading>{title}</SubHeading>
    {children}
  </Box>
);
Section.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

const ChipRow = ({ items }) => (
  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
    {items.map((i) => <Chip key={i} size="small" label={i} variant="outlined" />)}
  </Box>
);
ChipRow.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired };

const Shell = forwardRef(({ title, subtitle, chips, onClose, children, testId }, ref) => (
  <Box
    ref={ref}
    tabIndex={-1}
    data-testid={testId}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && onClose) onClose();
    }}
    sx={{
      mt: 2,
      p: { xs: 2, md: 2.5 },
      borderRadius: '12px',
      border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
      bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>{title}</Typography>
        {subtitle && <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>{subtitle}</Typography>}
        {chips && <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>{chips}</Box>}
      </Box>
      {onClose && (
        <Button size="small" onClick={onClose} startIcon={<CloseIcon />} aria-label="Close details" sx={{ flexShrink: 0 }}>
          Close
        </Button>
      )}
    </Box>
    {children}
  </Box>
));
Shell.displayName = 'Shell';
Shell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  chips: PropTypes.node,
  onClose: PropTypes.func,
  children: PropTypes.node.isRequired,
  testId: PropTypes.string,
};

const FlowButtons = ({ nodeId, onSelectEdge, onSelectNode }) => {
  const flows = EDGES.filter((e) => e.from === nodeId || e.to === nodeId);
  if (flows.length === 0) return <Body>No drawn flows. See the note on omitted flows in the legend.</Body>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {flows.map((flow) => {
        const outgoing = flow.from === nodeId;
        const other = outgoing ? flow.to : flow.from;
        const arrow = flow.direction === 'both' ? '\u2194' : outgoing ? '\u2192' : '\u2190';
        return (
          <Box key={flow.id} sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onSelectEdge(flow.id)}
              data-testid={`flow-button-${flow.id}`}
              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
            >
              {arrow} {nodeLabel(other)}: {flow.label}
            </Button>
            {!other.startsWith('zone:') && (
              <Button size="small" onClick={() => onSelectNode(other)} sx={{ textTransform: 'none' }}>
                Open {nodeLabel(other)}
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
FlowButtons.propTypes = {
  nodeId: PropTypes.string.isRequired,
  onSelectEdge: PropTypes.func.isRequired,
  onSelectNode: PropTypes.func.isRequired,
};

const LabLinks = ({ ids }) => (
  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
    {ids.map((id) => (
      <Chip key={id} size="small" label={id} component={RouterLink} to={labPath(id)} clickable />
    ))}
  </Box>
);
LabLinks.propTypes = { ids: PropTypes.arrayOf(PropTypes.string).isRequired };

const NodeDetailPanel = forwardRef(({ selectedNodeId, selectedEdgeId, onSelectNode, onSelectEdge, onClose }, ref) => {
  if (selectedEdgeId) {
    const edge = EDGES.find((e) => e.id === selectedEdgeId);
    if (!edge) return null;
    const boundary = TRUST_BOUNDARIES.find((b) => b.id === edge.boundary);
    return (
      <Shell
        ref={ref}
        testId="detail-panel"
        title={`Flow: ${nodeLabel(edge.from)} ${edge.direction === 'both' ? '\u2194' : '\u2192'} ${nodeLabel(edge.to)}`}
        subtitle={FLOW_KINDS[edge.kind].label}
        chips={boundary ? <Chip size="small" color="warning" variant="outlined" label={`Crosses trust boundary: ${boundary.label}`} /> : null}
        onClose={onClose}
      >
        <Section title="What flows">
          <Body>{edge.detail}</Body>
        </Section>
        {boundary && (
          <Section title="Why the boundary matters">
            <Body>{boundary.detail}</Body>
          </Section>
        )}
        <Section title="Evidence (repo paths)">
          <ChipRow items={edge.evidence} />
        </Section>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" onClick={() => onSelectNode(edge.from)} sx={{ textTransform: 'none' }}>
            Open {nodeLabel(edge.from)}
          </Button>
          {!edge.to.startsWith('zone:') && (
            <Button size="small" variant="outlined" onClick={() => onSelectNode(edge.to)} sx={{ textTransform: 'none' }}>
              Open {nodeLabel(edge.to)}
            </Button>
          )}
        </Box>
      </Shell>
    );
  }

  if (selectedNodeId === 'defense') {
    return (
      <Shell ref={ref} testId="detail-panel" title="Defense pipeline" subtitle="Overlay inside each surface, not a separate service" onClose={onClose}>
        <Body sx={{ mb: 2 }}>{DEFENSE_OVERLAY.summary}</Body>
        <SubHeading>Verified implementation facts</SubHeading>
        <ClaimList claims={DEFENSE_OVERLAY.facts} />
      </Shell>
    );
  }

  const node = NODE_BY_ID[selectedNodeId];
  if (!node) {
    return (
      <Box
        ref={ref}
        tabIndex={-1}
        data-testid="detail-panel-empty"
        sx={{
          mt: 2,
          p: 2,
          borderRadius: '12px',
          border: (t) => `1px dashed ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
        }}
      >
        <Body>Select a component or a flow in the diagram to see its description, responsibilities, data, verified facts, threat hypotheses and items that need validation.</Body>
      </Box>
    );
  }

  const zone = ZONE_BY_ID[node.zone];
  return (
    <Shell
      ref={ref}
      testId="detail-panel"
      title={node.label}
      subtitle={node.sublabel}
      onClose={onClose}
      chips={(
        <>
          <Chip size="small" label={NODE_STATUS[node.status].label} color={node.status === 'confirmed' ? 'success' : 'default'} variant={node.status === 'confirmed' ? 'filled' : 'outlined'} />
          {node.attackSurface && <Chip size="small" color="warning" variant="outlined" label="Attack surface" />}
          <Chip size="small" variant="outlined" label={zone.label} />
        </>
      )}
    >
      <Body sx={{ mb: 2 }}>{node.summary}</Body>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 0, md: 3 } }}>
        <Box>
          <Section title="Responsibilities">
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {node.responsibilities.map((r) => <Typography key={r} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>{r}</Typography>)}
            </Box>
          </Section>
          <Section title="Data handled"><ChipRow items={node.data} /></Section>
          <Section title="Threat categories to consider (STRIDE starting points, analytical)"><ChipRow items={node.threatCategories} /></Section>
          <Section title="Flows">
            <FlowButtons nodeId={node.id} onSelectEdge={onSelectEdge} onSelectNode={onSelectNode} />
          </Section>
          {node.labs.length > 0 && <Section title="Related labs"><LabLinks ids={node.labs} /></Section>}
          <Section title="Evidence (repo paths)"><ChipRow items={node.evidence} /></Section>
        </Box>
        <Box>
          <Section title="Verified implementation facts">
            <ClaimList claims={node.facts} empty="None recorded." />
          </Section>
          <Section title="Threat hypotheses (derived from the architecture, not confirmed)">
            <ClaimList claims={node.hypotheses} empty="None recorded." />
          </Section>
          <Section title="Potential weaknesses that need validation">
            <ClaimList claims={node.toValidate} empty="None recorded." />
          </Section>
        </Box>
      </Box>
    </Shell>
  );
});
NodeDetailPanel.displayName = 'NodeDetailPanel';

NodeDetailPanel.propTypes = {
  selectedNodeId: PropTypes.string,
  selectedEdgeId: PropTypes.string,
  onSelectNode: PropTypes.func.isRequired,
  onSelectEdge: PropTypes.func.isRequired,
  onClose: PropTypes.func,
};

export default NodeDetailPanel;
