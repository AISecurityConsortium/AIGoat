import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Container, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';
import AgentConsole from './agent/AgentConsole';
import McpConsole from './mcp/McpConsole';
import McpHostLab from './mcp/McpHostLab';
import McpRecordedSession from './mcp/McpRecordedSession';
import PerimeterTrace, { borderAngles } from './common/PerimeterTrace';
import { RelatedMap, SectionCard, LabPrimer } from './common';
import { LabExpectations } from './common/LabPrimer';
import { EvidenceSubmission } from './labs/LabGuide';
import { CheckCircleOutline as CheckIcon } from '@mui/icons-material';
import { invalidateLabsCache, useLabs } from '../hooks/useLabs';
import { MCP_NAV_GROUPS } from '../utils/labTeaching';

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
  const [seedGoal, setSeedGoal] = useState('');
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
    let cancelled = false;
    const token = localStorage.getItem('token');
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_DETAIL(labId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(({ data }) => {
      if (cancelled) return;
      if (data.surface === 'agent.runner' || data.surface === 'mcp.client' || data.surface === 'mcp.host') {
        setLab(data);
        setSeedGoal('');
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

  const back = lab.surface === 'mcp.client' || lab.surface === 'mcp.host'
    ? { to: '/mcp', label: 'Back to MCP' }
    : { to: '/agent', label: 'Back to Agent' };

  const mcpClient = lab.surface === 'mcp.client';
  const mcpHost = lab.surface === 'mcp.host';
  const mcpLab = mcpClient || mcpHost;
  const labNames = Object.fromEntries((catalog || []).map((item) => [item.id, item.name]));
  const completedIds = new Set((catalog || []).filter((item) => item.completed_at).map((item) => item.id));
  const series = MCP_NAV_GROUPS.find((group) => group.series && group.labs.includes(lab.id));
  const seriesIndex = series ? series.labs.indexOf(lab.id) : -1;
  const seriesNext = series ? series.labs[seriesIndex + 1] : '';
  const onCompletionChange = (done) => {
    setGoalMet(done);
    if (labId && String(labId).startsWith('mcp') && !done) setAttackLabComplete(labId, false);
    invalidateLabsCache();
    refetchCatalog();
  };

  return (
    <Container maxWidth={mcpLab ? 'xl' : 'md'} sx={{ py: mcpLab ? 2 : 4 }}>
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
        {mcpLab && (
          <>
            <Box aria-hidden="true" sx={{ width: '1px', alignSelf: 'stretch', bgcolor: 'divider' }} />
            <Box component="nav" aria-label="MCP labs" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, alignItems: 'center', minWidth: 0, flex: '1 1 0' }}>
              {MCP_NAV_GROUPS.map((group) => (
                <Box key={group.id} role="group" aria-label={group.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.25, whiteSpace: 'nowrap' }}>
                    {group.label}
                  </Typography>
                  {group.labs.map((id, index) => {
                    const current = id === lab.id;
                    const step = group.steps?.[id];
                    return (
                      <React.Fragment key={id}>
                        {group.series && index > 0 && (
                          <Typography aria-hidden="true" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>→</Typography>
                        )}
                        <Tooltip title={step ? `Step ${index + 1}: ${labNames[id] || id}` : (labNames[id] || id)}>
                          <Chip
                            component={RouterLink}
                            to={`/labs/${id}`}
                            label={`MCP${id.slice(3)}`}
                            size="small"
                            clickable
                            aria-current={current ? 'page' : undefined}
                            icon={completedIds.has(id) ? <CheckIcon sx={{ fontSize: '0.8rem !important' }} /> : undefined}
                            color={current ? 'primary' : 'default'}
                            variant="outlined"
                            sx={{
                              height: 20,
                              textDecoration: 'none',
                              fontWeight: current ? 700 : 500,
                              '& .MuiChip-label': { fontSize: '0.7rem', px: 0.6 },
                              ...(current ? {} : { opacity: 0.72 }),
                            }}
                          />
                        </Tooltip>
                      </React.Fragment>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
      {mcpClient && lab.ui?.recorded_session ? (
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
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                  <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, flex: '1 1 auto', minWidth: 0 }}>
                    <Box component="span" sx={{ color: 'primary.light', mr: 1 }}>{String(lab.id).toUpperCase()}</Box>
                    {String(lab.name || '').replace(/^MCP\d+\s*[-–]\s*/, '')}
                  </Typography>
                  {goalMet && (
                    <Chip label="Lab complete" size="small" color="success" variant="outlined" sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.72rem', fontWeight: 700 } }} />
                  )}
                  {(lab.risks || []).length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mr: 0.25 }}>Risks</Typography>
                      {lab.risks.map((risk) => (
                        <Chip
                          key={risk}
                          label={String(risk).split(':').pop()}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
                {series && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {`${series.label} series · Step ${seriesIndex + 1} of ${series.labs.length}: ${series.steps[lab.id]}`}
                    </Typography>
                    {seriesNext && (
                      <Button
                        component={RouterLink}
                        to={`/labs/${seriesNext}`}
                        size="small"
                        sx={{ textTransform: 'none', fontSize: '0.78rem', py: 0, minHeight: 0 }}
                      >
                        {`Next: MCP${seriesNext.slice(3)} ${series.steps[seriesNext]} →`}
                      </Button>
                    )}
                  </Box>
                )}
                <Box
                  sx={{
                    position: 'relative',
                    mt: 1.25,
                    px: 1.5,
                    py: 1,
                    borderRadius: '8px',
                    border: (t) => `1px solid ${goalMet ? alpha(t.palette.success.main, 0.5) : alpha(t.palette.primary.light, 0.22)}`,
                    bgcolor: (t) => alpha(goalMet ? t.palette.success.main : t.palette.primary.main, 0.05),
                  }}
                >
                  {!goalMet && <PerimeterTrace radius={8} />}
                  <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Objective
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.5, mt: 0.25 }}>{lab.description}</Typography>
                </Box>
              </Box>
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
      ) : (
        <Box>
          <SectionCard title="In this lab" dense>
            <RelatedMap
              dense
              risks={lab.risks || []}
              surface={lab.surface}
              relatedLabIds={lab.related_lab_ids || []}
            />
          </SectionCard>
          <Box sx={{ mt: 2 }}>
            <LabPrimer
              lab={lab}
              onTryPayload={lab.surface === 'agent.runner' ? setSeedGoal : undefined}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <AgentConsole labId={labId} lab={lab} seedGoal={seedGoal} />
          </Box>
        </Box>
      )}
    </Container>
  );
};

export default LabWorkspace;
