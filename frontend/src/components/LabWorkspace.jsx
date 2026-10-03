import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Container, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';
import AgentConsole from './agent/AgentConsole';
import McpConsole from './mcp/McpConsole';
import { RelatedMap, SectionCard, LabPrimer } from './common';
import { LabExpectations } from './common/LabPrimer';
import { EvidenceSubmission } from './labs/LabGuide';
import { useLabs } from '../hooks/useLabs';
import { MCP_NAV_ORDER } from '../utils/labTeaching';

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

const borderAngles = (width, height) => {
  const w = width;
  const h = height;
  const r = Math.min(13, w / 2, h / 2);
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
  const [metIds, setMetIds] = useState([]);
  const ringRef = useRef(null);
  const { labs: catalog } = useLabs();
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
    setMetIds((prev) => [...new Set([...prev, ...done])]);
  }, [catalog]);

  useEffect(() => {
    if (!lab?.id) return undefined;
    setMetIds((prev) => {
      const has = prev.includes(lab.id);
      if (goalMet && !has) return [...prev, lab.id];
      if (!goalMet && has) return prev.filter((id) => id !== lab.id);
      return prev;
    });
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
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', minWidth: 0 }}>
              {MCP_NAV_ORDER.map((id) => {
                const current = id === lab.id;
                const met = metIds.includes(id);
                return (
                  <Tooltip key={id} title={labNames[id] || id}>
                    <Chip
                      component={RouterLink}
                      to={`/labs/${id}`}
                      label={`MCP${id.slice(3)}`}
                      size="small"
                      clickable
                      color={current ? 'primary' : 'default'}
                      variant={current ? 'filled' : 'outlined'}
                      sx={{
                        height: 22,
                        textDecoration: 'none',
                        fontWeight: current ? 700 : 500,
                        '& .MuiChip-label': { fontSize: '0.6875rem', px: 0.75 },
                        ...(met ? { border: '1px solid', borderColor: 'success.main' } : {}),
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </>
        )}
      </Box>
      {mcpLab ? (
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
              <LabExpectations lab={lab} />
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
              onGoalMet={(done) => {
                setGoalMet(done);
                if (labId && String(labId).startsWith('mcp') && !done) setAttackLabComplete(labId, false);
              }}
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
