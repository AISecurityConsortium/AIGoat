import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';
import AgentWorkbench from './agent/AgentWorkbench';
import McpConsole from './mcp/McpConsole';
import McpHostLab from './mcp/McpHostLab';
import McpRecordedSession from './mcp/McpRecordedSession';
import { borderAngles } from './common/PerimeterTrace';
import { SectionCard, LabPrimer } from './common';
import LabHeader from './common/LabHeader';
import LabSwitcher from './common/LabSwitcher';
import { LabExpectations } from './common/LabPrimer';
import { EvidenceSubmission } from './labs/LabGuide';
import { invalidateLabsCache, useLabs } from '../hooks/useLabs';
import { AGENT_NAV_GROUPS, MCP_NAV_GROUPS, labChipLabel } from '../utils/labTeaching';

const mcpChipLabel = (id) => (id.startsWith('mcp') ? `MCP${id.slice(3)}` : id);

const completionKey = () => `aigoat_owasp_completed_${localStorage.getItem('username') || 'anonymous'}`;

const setAttackLabComplete = (id, done) => {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(completionKey()) || '{}');
  } catch {
    raw = {};
  }
  if (done) raw[id] = true;
  else delete raw[id];
  localStorage.setItem(completionKey(), JSON.stringify(raw));
};

const LabWorkspace = () => {
  const { labId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const labId = paramId || searchParams.get('lab');
  const [lab, setLab] = useState(null);
  const [error, setError] = useState(null);
  const [goalMet, setGoalMet] = useState(false);
  const [pushedEvaluation, setPushedEvaluation] = useState(null);
  const ringRef = useRef(null);
  const { labs: catalog, refetch: refetchCatalog } = useLabs();
  const prevLabId = useRef(labId);
  if (prevLabId.current !== labId) {
    prevLabId.current = labId;
    setGoalMet(false);
    setPushedEvaluation(null);
  }

  useEffect(() => {
    if (!labId) {
      navigate('/attacks', { replace: true });
      return undefined;
    }
    if (labId === 'killchain-1') {
      navigate('/challenges?killchain=1', { replace: true });
      return undefined;
    }
    let cancelled = false;
    const token = localStorage.getItem('token');
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_DETAIL(labId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(({ data }) => {
      if (cancelled) return;
      if (data.surface === 'agent.runner' || data.surface === 'mcp.client' || data.surface === 'mcp.host') {
        setLab(data);
        setGoalMet(Boolean(data.completed_at));
        return;
      }
      if (data.surface === 'rag.kb') {
        navigate(`/knowledge-base?lab=${labId}`, { replace: true });
        return;
      }
      navigate(`/attacks?lab=${labId}`, { replace: true });
    }).catch((err) => {
      if (!cancelled) setError(err.response?.data?.detail || 'Lab not found');
    });
    return () => { cancelled = true; };
  }, [labId, navigate]);

  useEffect(() => {
    const done = (catalog || []).filter((item) => item.completed_at && String(item.id).startsWith('mcp')).map((item) => item.id);
    if (!done.length) return;
    done.forEach((id) => setAttackLabComplete(id, true));
  }, [catalog]);

  useEffect(() => {
    if (!lab?.id) return undefined;
    if (goalMet && String(lab.id).startsWith('mcp')) setAttackLabComplete(lab.id, true);
    return undefined;
  }, [lab, goalMet]);

  useEffect(() => {
    const node = ringRef.current;
    if (!node || goalMet) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let samples = [];
    const rebuild = () => {
      const rect = node.getBoundingClientRect();
      samples = borderAngles(rect.width, rect.height);
    };
    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(node);
    let frame = 0;
    const start = performance.now();
    const duration = 2600;
    const tick = (now) => {
      if (samples.length > 1) {
        const t = ((now - start) % duration) / duration;
        const scaled = t * samples.length;
        const i = Math.floor(scaled) % samples.length;
        const frac = scaled - Math.floor(scaled);
        const a0 = samples[i];
        const a1 = samples[(i + 1) % samples.length];
        let delta = a1 - a0;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const angle = (a0 + delta * frac + 360) % 360;
        node.style.setProperty('--aigoat-angle', `${angle}deg`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [lab, goalMet]);

  if (!labId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{String(error)}</Alert>
      </Container>
    );
  }
  if (!lab) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // asi01-1/asi04-1 run on the mcp.host surface but belong to the Agent track.
  const isAgentLab = String(lab.id).startsWith('asi') || lab.surface === 'agent.runner';
  const back = !isAgentLab && (lab.surface === 'mcp.client' || lab.surface === 'mcp.host')
    ? { to: '/mcp', label: 'Back to MCP' }
    : { to: '/agent', label: 'Back to Agent' };

  const mcpClient = lab.surface === 'mcp.client';
  const mcpHost = lab.surface === 'mcp.host';
  const mcpLab = mcpClient || mcpHost;
  const labNames = Object.fromEntries((catalog || []).map((item) => [item.id, item.name]));
  const completedIds = new Set((catalog || []).filter((item) => item.completed_at).map((item) => item.id));
  const series = MCP_NAV_GROUPS.find((group) => group.series && group.labs.includes(lab.id));
  const onCompletionChange = (done) => {
    setGoalMet(done);
    if (labId && String(labId).startsWith('mcp') && !done) setAttackLabComplete(labId, false);
    invalidateLabsCache();
    refetchCatalog();
  };

  return (
    <Container maxWidth={mcpLab || isAgentLab ? 'xl' : 'md'} sx={{ py: mcpLab || isAgentLab ? 2 : 4 }}>
      <style>
        {`@property --aigoat-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }`}
      </style>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
        <Button
          component={RouterLink}
          to={back.to}
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
        >
          {back.label}
        </Button>
        {(mcpLab || isAgentLab) && (
          <>
            <Box aria-hidden="true" sx={{ display: { xs: 'none', sm: 'block' }, width: '1px', alignSelf: 'stretch', bgcolor: 'divider' }} />
            <LabSwitcher
              groups={isAgentLab ? AGENT_NAV_GROUPS : MCP_NAV_GROUPS}
              ariaLabel={isAgentLab ? 'Agentic labs' : 'MCP labs'}
              currentId={lab.id}
              labNames={labNames}
              completedIds={completedIds}
              labelFor={isAgentLab ? labChipLabel : mcpChipLabel}
            />
          </>
        )}
      </Box>
      {isAgentLab ? (
        <AgentWorkbench
          lab={lab}
          labId={labId}
          goalMet={goalMet}
          labNames={labNames}
          onCompletionChange={onCompletionChange}
        />
      ) : mcpClient && lab.ui?.recorded_session ? (
        <McpRecordedSession
          labId={labId}
          lab={lab}
          completed={goalMet}
          onGoalMet={onCompletionChange}
        />
      ) : mcpLab && lab.ui?.learner_first && mcpHost ? (
        <McpHostLab
          labId={labId}
          lab={lab}
          completed={goalMet}
          onGoalMet={onCompletionChange}
        />
      ) : mcpClient ? (
        <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
          <McpConsole
            labId={labId}
            lab={lab}
            pushedEvaluation={pushedEvaluation}
            header={(
              <LabHeader
                lab={lab}
                goalMet={goalMet}
                objective={lab.description}
                series={series}
                labelFor={mcpChipLabel}
              />
            )}
            completed={goalMet}
            onGoalMet={onCompletionChange}
          />
        </Box>
      ) : mcpLab ? (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', lg: mcpClient ? '220px minmax(0, 1fr) minmax(360px, 420px)' : '220px minmax(0, 1fr)' },
          }}
        >
          <Box
            sx={{
              gridColumn: { lg: 1 },
              gridRow: { lg: mcpClient ? '1 / span 2' : '1' },
              alignSelf: { lg: 'stretch' },
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                position: { lg: 'sticky' },
                top: { lg: 72 },
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {lab.description && (
                <Box
                  sx={{
                    position: 'relative',
                    borderRadius: '14px',
                    '& .MuiPaper-root': {
                      transition: 'border-color 0.35s ease, background-color 0.35s ease',
                      borderColor: (t) => (goalMet ? t.palette.success.main : alpha(t.palette.primary.light, 0.35)),
                      bgcolor: (t) => alpha(goalMet ? t.palette.success.main : t.palette.primary.main, goalMet ? 0.14 : 0.08),
                    },
                  }}
                >
                  {!goalMet && (
                    <Box
                      ref={ringRef}
                      aria-hidden="true"
                      sx={{
                        pointerEvents: 'none',
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 'inherit',
                        padding: '1.5px',
                        zIndex: 1,
                        background: (t) => `conic-gradient(from var(--aigoat-angle), transparent 0deg, transparent 292deg, ${alpha(t.palette.primary.main, 0.05)} 314deg, ${alpha(t.palette.primary.light, 0.45)} 336deg, ${alpha(t.palette.primary.light, 0.9)} 350deg, #fff 358deg, #fff 360deg)`,
                        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                        WebkitMaskComposite: 'xor',
                        mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                        maskComposite: 'exclude',
                      }}
                    />
                  )}
                  <SectionCard title={goalMet ? 'Goal met' : 'Goal'} compact>
                    <Typography sx={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      {lab.description}
                    </Typography>
                    {goalMet && (
                      <Typography sx={{ mt: 0.75, fontSize: '0.75rem', fontWeight: 700, color: 'success.main' }}>
                        This lab's condition is met.
                      </Typography>
                    )}
                  </SectionCard>
                </Box>
              )}
              {!lab.ui?.learner_first && <LabExpectations lab={lab} />}
              {(lab.submission_fields || []).length > 0 && (
                <SectionCard title="Submit what you found" compact>
                  <EvidenceSubmission
                    lab={lab}
                    onEvaluation={(next) => {
                      setPushedEvaluation(next);
                      if (next?.exploit_triggered) {
                        setGoalMet(true);
                        if (labId && String(labId).startsWith('mcp')) setAttackLabComplete(labId, true);
                      }
                    }}
                  />
                </SectionCard>
              )}
            </Box>
          </Box>
          <Box sx={{ gridColumn: { lg: 2 }, minWidth: 0 }}>
            <LabPrimer lab={lab} hideGoal />
          </Box>
          {mcpClient && (
            <McpConsole
              labId={labId}
              lab={lab}
              embedded
              pushedEvaluation={pushedEvaluation}
              onGoalMet={onCompletionChange}
            />
          )}
        </Box>
      ) : null}
    </Container>
  );
};

export default LabWorkspace;
