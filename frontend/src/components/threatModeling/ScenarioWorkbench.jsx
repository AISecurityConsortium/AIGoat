import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Tab, Tabs, Typography } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { SCENARIOS, SCENARIO_LENS_ORDER } from '../../data/threatModeling/scenarios';
import { LENS_ROLES } from '../../data/threatModeling/frameworks';
import { NODE_BY_ID, TRUST_BOUNDARIES } from '../../data/threatModeling/architecture';
import { labPath } from '../../utils/taxonomyLinks';
import { Body, ClaimList, ClaimRow, EvidenceChip, FlagChip, SubHeading } from './labels';

const Group = ({ id, title, children, defaultExpanded = false, count }) => (
  <Accordion
    disableGutters
    defaultExpanded={defaultExpanded}
    data-testid={`group-${id}`}
    sx={{
      '&:before': { display: 'none' },
      borderRadius: '10px !important',
      overflow: 'hidden',
      mb: 1,
      bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
      border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`${id}-content`} id={`${id}-header`}>
      <Typography component="h4" sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
        {title}{count != null ? ` (${count})` : ''}
      </Typography>
    </AccordionSummary>
    <AccordionDetails id={`${id}-content`}>{children}</AccordionDetails>
  </Accordion>
);
Group.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  defaultExpanded: PropTypes.bool,
  count: PropTypes.number,
};

const Bullets = ({ items }) => (
  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
    {items.map((i) => <Typography key={i} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55, mb: 0.25 }}>{i}</Typography>)}
  </Box>
);
Bullets.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired };

const Chips = ({ items, color = 'default' }) => (
  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
    {items.map((i) => <Chip key={i} size="small" variant="outlined" color={color} label={i} />)}
  </Box>
);
Chips.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired, color: PropTypes.string };

const Block = ({ title, children, sx }) => (
  <Box sx={{ mb: 1.5, ...sx }}>
    <SubHeading>{title}</SubHeading>
    {children}
  </Box>
);
Block.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node.isRequired, sx: PropTypes.object };

const Unique = ({ text }) => (
  <Box sx={{ p: 1.25, borderRadius: '8px', bgcolor: (t) => t.palette.custom?.overlay?.active ?? 'action.hover' }}>
    <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}><strong>What this lens adds:</strong> {text}</Typography>
  </Box>
);
Unique.propTypes = { text: PropTypes.string.isRequired };

const LensView = ({ lensId, lens }) => {
  const role = LENS_ROLES.find((r) => r.id === lensId);
  return (
    <Box data-testid={`lens-${lensId}`} sx={{ mb: 2.5 }}>
      <Typography component="h5" sx={{ fontWeight: 700, fontSize: '1rem' }}>{role.label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1 }}>
        {lens.framework || role.frameworks}: {role.description}
      </Typography>

      {(lensId === 'discovery' || lensId === 'risk') && <ClaimList claims={lens.finds} />}

      {lensId === 'context' && (
        <>
          <Block title="MITRE ATLAS techniques (IDs checked in the ATLAS data)">
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {lens.atlas.map((a) => <Chip key={a.id} size="small" variant="outlined" label={`${a.id} ${a.name}`} />)}
            </Box>
          </Block>
          <Block title="OWASP weakness classes">
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {lens.owasp.map((o) => (
                <Typography key={`${o.list}-${o.code}`} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>
                  <strong>{o.code}</strong> {o.name} <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>({o.list})</Typography>
                </Typography>
              ))}
            </Box>
          </Block>
          <ClaimList claims={lens.finds} />
        </>
      )}

      {lensId === 'saif' && (
        <>
          <Block title="SAIF component areas and components">
            <Chips items={lens.areas} color="primary" />
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>{lens.components.join(', ')}</Typography>
          </Block>
          <Block title="Official SAIF risk to control mapping (from the SAIF risks page)">
            {lens.risks.map((r) => (
              <Box key={r.risk} data-testid="saif-risk" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>{r.risk}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 0.5 }}>Who can mitigate: {r.who}</Typography>
                <Chips items={r.controls} />
              </Box>
            ))}
          </Block>
          <Block title="Agent and component notes (from SAIF)"><Body>{lens.agentNote}</Body></Block>
          <Block title="Analytical recommendations (not official mappings)">
            <Box component="ul" sx={{ m: 0, p: 0 }}>
              {lens.analytical.map((t) => <ClaimRow key={t} claim={{ text: t, evidence: 'hypothesis', analytical: true }} />)}
            </Box>
          </Block>
          <Block title="What stays uncertain"><Body>{lens.uncertain}</Body></Block>
        </>
      )}

      {lensId === 'aix' && (
        <>
          <Block title="Threat areas in the AI Exchange"><Chips items={lens.threats} color="primary" /></Block>
          <Block title="Named controls (as written on owaspai.org)"><Chips items={lens.controls} /></Block>
          <Block title="Where to read more">
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {lens.sections.map((s) => (
                <Button key={s.url} size="small" variant="outlined" href={s.url} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none', borderRadius: '8px' }}>
                  {s.label}
                </Button>
              ))}
            </Box>
          </Block>
          <Block title="Guidance applied to AIGoat (analytical reading of the source)">
            <Box component="ul" sx={{ m: 0, p: 0 }}>
              {lens.analytical.map((t) => <ClaimRow key={t} claim={{ text: t, evidence: 'hypothesis', analytical: true }} />)}
            </Box>
          </Block>
          <Block title="Limit of these controls"><Body>{lens.limitation}</Body></Block>
        </>
      )}

      <Unique text={lens.unique} />
    </Box>
  );
};
LensView.propTypes = { lensId: PropTypes.string.isRequired, lens: PropTypes.object.isRequired };

const ScenarioView = ({ scenario, onOpenComponent }) => {
  const boundaries = scenario.boundaries.map((id) => TRUST_BOUNDARIES.find((b) => b.id === id)).filter(Boolean);
  const gid = (name) => `scenario-${scenario.id}-${name}`;
  return (
    <Box data-testid={`scenario-${scenario.id}`}>
      <Typography component="h3" sx={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
        Scenario {scenario.number}: {scenario.title}
      </Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'primary.main', mb: 1 }}>{scenario.family}</Typography>
      <Body sx={{ mb: 1.5 }}>{scenario.context}</Body>

      <Box
        data-testid="scenario-conditions"
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: '10px',
          border: (t) => `1px solid ${t.palette.warning.main}`,
          bgcolor: (t) => t.palette.custom?.overlay?.hover ?? 'action.hover',
        }}
      >
        <SubHeading>Key distinction</SubHeading>
        <Body>{scenario.conditions}</Body>
      </Box>

      <Group id={gid('path')} title="Attack path" defaultExpanded count={scenario.attackPath.length}>
        <Box component="ol" sx={{ m: 0, pl: 2.5 }} data-testid="attack-path">
          {scenario.attackPath.map((step) => (
            <Box component="li" key={step.text} sx={{ mb: 1.5 }} data-evidence={step.evidence}>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
                <EvidenceChip evidence={step.evidence} />
                {(step.flags || []).map((f) => <FlagChip key={f} flag={f} />)}
              </Box>
              <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>{step.text}</Typography>
              {step.refs && (
                <Typography sx={{ fontSize: '0.8125rem', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontFamily: '"JetBrains Mono", monospace', wordBreak: 'break-word' }}>
                  {step.refs.join('  ')}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Group>

      <Group id={gid('scope')} title="Components, assets, attacker and boundaries">
        <Block title="Architecture components (select to open in the diagram)">
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {scenario.components.map((id) => (
              <Chip
                key={id}
                size="small"
                clickable
                color="primary"
                variant="outlined"
                label={NODE_BY_ID[id].label}
                onClick={() => onOpenComponent(id)}
                data-testid={`scenario-component-${id}`}
              />
            ))}
          </Box>
        </Block>
        <Block title="Assets to protect"><Bullets items={scenario.assets} /></Block>
        <Block title="Attacker assumptions"><Bullets items={scenario.attacker.assumptions} /></Block>
        <Block title="Prerequisites"><Bullets items={scenario.attacker.prerequisites} /></Block>
        <Block title="Trust boundaries crossed">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {boundaries.map((b) => (
              <Typography key={b.id} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>
                <strong>{b.label}</strong>: {b.detail}
              </Typography>
            ))}
          </Box>
        </Block>
      </Group>

      <Group id={gid('lenses')} title="Framework-by-framework analysis" count={SCENARIO_LENS_ORDER.length}>
        {SCENARIO_LENS_ORDER.map((lensId) => <LensView key={lensId} lensId={lensId} lens={scenario.lenses[lensId]} />)}
      </Group>

      <Group id={gid('distinct')} title="Distinct findings and overlap">
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {SCENARIO_LENS_ORDER.map((lensId) => (
            <Typography key={lensId} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55, mb: 0.75 }}>
              <strong>{LENS_ROLES.find((r) => r.id === lensId).label}:</strong> {scenario.lenses[lensId].unique}
            </Typography>
          ))}
        </Box>
        <Block title="Where they overlap" sx={{ mt: 1.5 }}><Body>{scenario.overlap}</Body></Block>
      </Group>

      <Group id={gid('risk')} title="Likelihood, impact and risk rationale">
        <Block title="Likelihood"><Body>{scenario.risk.likelihood}</Body></Block>
        <Block title="Impact"><Body>{scenario.risk.impact}</Body></Block>
        <Block title="Rationale"><Body>{scenario.risk.rationale}</Body></Block>
        <Block title="Assumptions"><Bullets items={scenario.risk.assumptions} /></Block>
      </Group>

      <Group id={gid('mitigations')} title="Mitigations and residual risks" count={scenario.mitigations.length}>
        <Box component="ul" sx={{ m: 0, p: 0 }} data-testid="mitigations">
          {scenario.mitigations.map((m) => (
            <Box component="li" key={m.text} sx={{ listStyle: 'none', mb: 1.25 }} data-state={m.state}>
              <Chip
                size="small"
                variant={m.state === 'implemented' ? 'filled' : 'outlined'}
                color={m.state === 'implemented' ? 'success' : 'default'}
                label={m.state === 'implemented' ? 'Implemented in AIGoat (teaching profile)' : 'Candidate (not implemented)'}
                sx={{ mb: 0.5 }}
              />
              <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>{m.text}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Limit: {m.limit}</Typography>
              {m.refs && (
                <Typography sx={{ fontSize: '0.8125rem', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
                  {m.refs.join('  ')}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        <Block title="Residual risks"><Bullets items={scenario.residual} /></Block>
        <Block title="What remains uncertain or uncovered"><Bullets items={scenario.uncertain} /></Block>
      </Group>

      <Box sx={{ mt: 1.5 }}>
        <SubHeading>Try it in the labs</SubHeading>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {scenario.labs.map((id) => <Chip key={id} size="small" label={id} component={RouterLink} to={labPath(id)} clickable />)}
        </Box>
      </Box>
    </Box>
  );
};
ScenarioView.propTypes = { scenario: PropTypes.object.isRequired, onOpenComponent: PropTypes.func.isRequired };

const ScenarioWorkbench = ({ onOpenComponent }) => {
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === selectedId) || SCENARIOS[0];
  return (
    <Box>
      <Body sx={{ mb: 1.5 }}>
        Six scenarios apply the same lenses to the same system. Each claim is labelled verified, hypothesis or needs validation, and educational weaknesses are marked by design. None of these are reported as detected vulnerabilities.
      </Body>
      <Tabs
        value={selectedId}
        onChange={(_, value) => setSelectedId(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Scenarios"
        sx={{ mb: 2, borderBottom: (t) => `1px solid ${t.palette.divider}` }}
      >
        {SCENARIOS.map((s) => (
          <Tab
            key={s.id}
            value={s.id}
            label={`${s.number}. ${s.title}`}
            data-testid={`scenario-tab-${s.id}`}
            sx={{ textTransform: 'none', alignItems: 'flex-start', textAlign: 'left', maxWidth: 220 }}
          />
        ))}
      </Tabs>
      <ScenarioView scenario={scenario} onOpenComponent={onOpenComponent} />
    </Box>
  );
};
ScenarioWorkbench.propTypes = { onOpenComponent: PropTypes.func.isRequired };

export default ScenarioWorkbench;
