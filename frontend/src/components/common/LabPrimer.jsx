import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDefense } from '../../contexts/DefenseContext';
import { apiClient } from '../../config/api';
import { riskPath } from '../../utils/taxonomyLinks';
import DefenseLevelChip, { DEFENSE_LEVEL_LABELS } from './DefenseLevelChip';
import McpFlow from './McpFlow';
import RiskChip from './RiskChip';
import SectionCard from './SectionCard';
import { HOST_STEPS, MCP_FLOWS, SHIP_CONTROL } from '../../utils/labTeaching';
import { useRisk } from '../../hooks/useFrameworks';

const DIAGRAM = {
  'agent.runner': {
    src: '/media/diagrams/agent-loop.svg',
    alt: 'Goal to planner to Intent Gate to tool to observation.',
  },
};

const WATCH = {
  'agent.runner': 'The transcript tool_call is the evidence, not model prose.',
  'mcp.client': 'Read the tool description as untrusted text.',
  'mcp.host': 'The score is the tool the assistant calls, not the sentence it writes.',
};

const expectedAt = (expected, level) => {
  if (!expected || typeof expected !== 'object') return '';
  return expected[String(level)] || expected[level] || '';
};

const switchPersona = async (alicePath, labId) => {
  const current = localStorage.getItem('username');
  const target = current === 'admin' ? 'alice' : 'admin';
  if (current !== 'alice' && current !== 'admin') return;
  const res = await apiClient.get('/api/auth/demo-users/');
  const match = (res.data.users || []).find((row) => row.username === target);
  if (!match?.demo_token) return;
  localStorage.setItem('token', match.demo_token);
  localStorage.setItem('username', target);
  const adminPath = labId ? `/admin/assistant?lab=${labId}` : '/admin/assistant';
  window.location.assign(target === 'admin' ? adminPath : alicePath);
};

const LabPrimer = ({ lab, onTryPayload, hideGoal = false, hideDiagram = false }) => {
  const navigate = useNavigate();
  const { defenseLevel } = useDefense();
  const isMcp = lab?.surface === 'mcp.client' || lab?.surface === 'mcp.host';
  const { risk } = useRisk(isMcp ? lab?.primary_risk : null);
  if (!lab) return null;

  const flow = MCP_FLOWS[lab.id];
  const diagram = flow ? null : DIAGRAM[lab.surface];
  const riskCode = String(lab.primary_risk || '').split(':').pop();
  const payloads = (lab.example_payloads || []).map((item) => String(item).trim()).filter(Boolean);
  const expected = expectedAt(lab.expected_by_level, defenseLevel);
  const watch = WATCH[lab.surface];
  const canFill = typeof onTryPayload === 'function';
  const labelSx = {
    fontWeight: 700,
    fontSize: '0.9375rem',
    letterSpacing: '-0.01em',
    mb: 1,
  };
  const sectionSx = {
    pt: 1.5,
    borderTop: (theme) => `1px solid ${theme.palette.custom?.border?.subtle ?? theme.palette.divider}`,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: hideDiagram ? 1 : 2, mb: hideDiagram ? 0 : 2, height: hideDiagram ? '100%' : undefined }}>
      {lab.description && !hideGoal && (
        <SectionCard title="Goal" dense>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
            {lab.description}
          </Typography>
        </SectionCard>
      )}

      {isMcp ? (
        <SectionCard dense>
          {(lab.risks || []).length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 1.25 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', lineHeight: '24px', width: 52 }}>
                RISKS
              </Typography>
              {(lab.risks || []).map((qualified) => {
                const code = String(qualified).includes(':') ? String(qualified).split(':').slice(1).join(':') : qualified;
                const framework = String(qualified).includes(':') ? String(qualified).split(':')[0] : undefined;
                return (
                  <RiskChip
                    key={qualified}
                    code={code}
                    framework={framework}
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(riskPath(qualified));
                    }}
                  />
                );
              })}
            </Box>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: !hideDiagram && flow ? 'minmax(0, 1fr) 156px' : '1fr' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              {riskCode && (
                <Box sx={{ mb: (payloads.length > 0 || lab.objective) ? 1.25 : 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.8125rem', letterSpacing: '0.06em', color: 'primary.main' }}>
                    {riskCode}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.35, mt: 0.25 }}>
                    {risk?.title || 'Loading the vulnerability name'}
                  </Typography>
                  {risk?.summary && (
                    <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, mt: 0.5, color: 'text.secondary' }}>
                      {risk.summary}
                    </Typography>
                  )}
                  {SHIP_CONTROL[lab.id] && (
                    <Box
                      sx={{
                        mt: 1,
                        px: 1.25,
                        py: 0.85,
                        borderRadius: '8px',
                        border: (t) => `1px solid ${alpha(t.palette.success.main, 0.35)}`,
                        background: (t) => `linear-gradient(120deg, ${alpha(t.palette.success.main, 0.18)}, ${alpha(t.palette.info.main, 0.08)})`,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.06em', color: 'success.main', mb: 0.25 }}>
                        MITIGATION
                      </Typography>
                      <Typography sx={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
                        {SHIP_CONTROL[lab.id]}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
              {(payloads.length > 0 || lab.objective) && (
                <Box sx={riskCode ? sectionSx : undefined}>
                  {payloads.length > 0 && (
                    <Box>
                      <Typography sx={labelSx}>One way to start</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {payloads.map((text) => (
                          <Typography key={text} sx={{ fontSize: '0.875rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                            {text}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {lab.objective && (
                    <Box sx={{ mt: payloads.length > 0 ? 1.25 : 0 }}>
                      <Typography sx={labelSx}>How this attack works</Typography>
                      <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                        {lab.objective}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            {!hideDiagram && flow && <McpFlow steps={flow.steps} caption={flow.caption} stacked compact />}
          </Box>
        </SectionCard>
      ) : diagram && (
        <SectionCard dense>
          <Box
            component="img"
            src={diagram.src}
            alt={diagram.alt}
            sx={{ width: '100%', maxWidth: 560, display: 'block', mx: 'auto' }}
          />
        </SectionCard>
      )}

      {lab.surface === 'mcp.host' && (
        <SectionCard title="Two steps" dense>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, mb: 1 }}>
            {(HOST_STEPS[lab.id] || {}).step1 || 'Step 1 is described in the objective below.'}
          </Typography>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, mb: 1.5 }}>
            {(HOST_STEPS[lab.id] || {}).step2 || 'Step 2 as Admin: open the assistant. The tool call is the result.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(HOST_STEPS[lab.id] || {}).plant && (
              <Button
                variant="outlined"
                onClick={() => switchPersona(
                  (HOST_STEPS[lab.id] || {}).plant === 'review' ? '/home' : '/support',
                  lab.id,
                )}
                sx={{ textTransform: 'none' }}
              >
                Switch persona
              </Button>
            )}
            <Button component={RouterLink} to={`/admin/assistant?lab=${lab.id}`} variant="contained" sx={{ textTransform: 'none' }}>
              Open assistant
            </Button>
          </Box>
        </SectionCard>
      )}

      {!isMcp && payloads.length > 0 && (
        <SectionCard title="One way to start" dense>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {payloads.map((text) => (
              canFill ? (
                <Button
                  key={text}
                  onClick={() => onTryPayload(text)}
                  sx={{
                    textTransform: 'none',
                    textAlign: 'left',
                    display: 'block',
                    whiteSpace: 'pre-wrap',
                    fontWeight: 500,
                    fontSize: '0.9375rem',
                    lineHeight: 1.5,
                    px: 0,
                  }}
                >
                  {text}
                </Button>
              ) : (
                <Typography key={text} sx={{ fontSize: '0.9375rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {text}
                </Typography>
              )
            ))}
          </Box>
          {canFill && (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
              Click a step to put it in the Goal box.
            </Typography>
          )}
        </SectionCard>
      )}

      {!isMcp && lab.objective && (
        <SectionCard title="How this attack works" dense>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {lab.objective}
          </Typography>
        </SectionCard>
      )}

      {!isMcp && expected && (
        <SectionCard title="What to expect at this defense level" dense>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <DefenseLevelChip level={defenseLevel} />
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
            {expected}
          </Typography>
        </SectionCard>
      )}

      {watch && (
        <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', lineHeight: 1.5 }}>
          {watch}
        </Typography>
      )}
    </Box>
  );
};

LabPrimer.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string,
    surface: PropTypes.string,
    primary_risk: PropTypes.string,
    description: PropTypes.string,
    risks: PropTypes.arrayOf(PropTypes.string),
    objective: PropTypes.string,
    example_payloads: PropTypes.arrayOf(PropTypes.string),
    expected_by_level: PropTypes.objectOf(PropTypes.string),
  }),
  onTryPayload: PropTypes.func,
  hideGoal: PropTypes.bool,
  hideDiagram: PropTypes.bool,
};

LabPrimer.defaultProps = {
  lab: null,
  onTryPayload: undefined,
};

export const LabDiagram = ({ lab }) => {
  const flow = MCP_FLOWS[lab?.id];
  if (!flow) return null;
  return (
    <SectionCard compact stretch>
      <McpFlow steps={flow.steps} caption={flow.caption} stacked />
    </SectionCard>
  );
};

LabDiagram.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string,
  }),
};

LabDiagram.defaultProps = {
  lab: null,
};

export const LabExpectations = ({ lab, stretch = false }) => {
  const rows = [0, 1, 2]
    .map((level) => ({ level, text: expectedAt(lab?.expected_by_level, level) }))
    .filter((row) => row.text);
  if (!rows.length) return null;
  return (
    <SectionCard title="What to expect at this defense level" compact stretch={stretch}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: stretch ? 1 : undefined, justifyContent: stretch ? 'space-between' : undefined }}>
        {rows.map((row) => (
          <Box key={row.level}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
              <DefenseLevelChip level={row.level} />
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary' }}>
                {DEFENSE_LEVEL_LABELS[row.level]}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.4 }}>
              {row.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </SectionCard>
  );
};

LabExpectations.propTypes = {
  lab: PropTypes.shape({
    expected_by_level: PropTypes.objectOf(PropTypes.string),
  }),
  stretch: PropTypes.bool,
};

LabExpectations.defaultProps = {
  lab: null,
};

export default LabPrimer;
