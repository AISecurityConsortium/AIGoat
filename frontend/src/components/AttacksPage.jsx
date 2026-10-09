import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container, Typography, Box, Collapse, IconButton,
  Alert, Skeleton, Button, Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
} from '@mui/icons-material';
import { useLocation, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useLabs } from '../hooks/useLabs';
import { useFramework, useFrameworks } from '../hooks/useFrameworks';
import {
  RiskChip, DifficultyChip, DefenseLevelChip, DEFENSE_LEVEL_LABELS,
  CodeBlock, EmptyState, ProgressBar, SectionCard, RelatedMap,
} from './common';
import HubHero from './common/HubHero';
import HubRail, { RailPanel } from './common/HubRail';
import { chipSx, inset, meta, panel, sectionTitle } from './common/panelStyles';
import { riskPath } from '../utils/taxonomyLinks';
import { LAB_SERIES } from '../utils/labTeaching';
import {
  DEFAULT_FRAMEWORK, FRAMEWORK_ORDER, sortFrameworks, shortFrameworkLabel, labFrameworkId,
} from '../utils/frameworkOrder';

const LEGACY_ID_MAP = {
  'lm01-direct': 'llm01-1',
  'lm01-indirect': 'llm01-2',
  'lm01-override': 'llm01-3',
  'lm02-config': 'llm02-1',
  'lm02-customer': 'llm02-1',
  'lm02-apikeys': 'llm02-2',
  'lm04-review-poison': 'llm02-3',
  'lm04-tip-injection': 'llm02-3',
  'lm04-context-manipulation': 'llm02-3',
  'lm05-xss': 'llm05-1',
  'lm07-extract': 'llm07-1',
  'lm07-indirect': 'llm07-1',
  'lm03-backdoor': 'llm03-1',
  'lm06-agency': 'llm06-1',
  'lm08-kb-poison': 'llm08-1',
  'lm08-embedding-collision': 'llm08-1',
  'lm08-retrieval-flooding': 'llm08-1',
  'lm09-hallucination': 'llm09-1',
  'lm09-false-authority': 'llm09-1',
  'lm09-medical-legal': 'llm09-1',
  'lm10-flood': 'llm10-1',
};

const LEVEL_ORDER = ['0', '1', '2'];

const ATTACK_STEPS = [
  'Pick a framework and a risk. Each risk lists the labs that practice it.',
  'Open a lab, read the goal, and try the example prompts.',
  'Repeat at each defense level and compare what changes. Mark the lab complete when done.',
];

const ATTACK_FLOW = {
  caption: 'Every lab is mapped to a risk. Completion is saved in this browser only.',
  steps: [
    { title: 'Framework', detail: 'LLM, MCP or Agentic' },
    { title: 'Risk', detail: 'one entry, one code', accent: true },
    { title: 'Lab', detail: 'goal, prompts, expected results' },
    { title: 'Defense level', detail: 'L0, L1 and L2', warn: true },
  ],
};

const HUB_LINKS = [
  { to: '/mcp', label: 'MCP labs' },
  { to: '/agent', label: 'Agentic labs' },
  { to: '/knowledge-base', label: 'RAG labs' },
];

const LABEL_SX = {
  color: 'text.secondary', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', mb: 1, letterSpacing: '0.04em',
};

const LAB_ID_RENAME_2026 = {
  'llm08-6': 'llm01-5',
  'llm06-2': 'llm03-1',
  'llm06-3': 'llm03-2',
  'llm06-1': 'llm03-3',
  'llm03-1': 'llm04-1',
  'llm04-1': 'llm05-1',
  'llm10-1': 'llm06-1',
  'llm09-1': 'llm07-1',
  'llm07-1': 'llm08-1',
  'llm08-1': 'llm09-1',
  'llm08-2': 'llm09-2',
  'llm08-3': 'llm09-3',
  'llm08-4': 'llm09-4',
  'llm08-5': 'llm09-5',
  'llm05-1': 'llm10-1',
};

const getCompletionKey = () => {
  const username = localStorage.getItem('username') || 'anonymous';
  return `aigoat_owasp_completed_${username}`;
};

const migrateCompletions = (raw) => {
  let next = { ...raw };
  if (!localStorage.getItem('aigoat_owasp_completed_migrated')) {
    Object.entries(LEGACY_ID_MAP).forEach(([oldId, newId]) => {
      if (raw[oldId]) next[newId] = true;
    });
    localStorage.setItem('aigoat_owasp_completed_migrated', '1');
  }
  if (!localStorage.getItem('aigoat_owasp_completed_migrated_2026')) {
    const renamed = {};
    Object.entries(next).forEach(([id, value]) => {
      renamed[LAB_ID_RENAME_2026[id] || id] = value;
    });
    next = renamed;
    localStorage.setItem('aigoat_owasp_completed_migrated_2026', '1');
  }
  localStorage.setItem(getCompletionKey(), JSON.stringify(next));
  return next;
};

const riskCodeForLab = (lab, frameworkId) => {
  const match = (lab.risks || []).find((r) => r.startsWith(`${frameworkId}:`));
  if (match) return match.split(':').slice(1).join(':');
  return lab.owasp;
};

const AttacksPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const frameworkFilter = searchParams.get('framework') || DEFAULT_FRAMEWORK;
  const surfaceFilter = searchParams.get('surface') || '';
  const difficultyFilter = searchParams.get('difficulty') || '';
  const statusFilter = searchParams.get('status') || '';
  const labFromQuery = searchParams.get('lab');

  const { frameworks: frameworkList } = useFrameworks();
  const { framework } = useFramework(frameworkFilter);
  const { labs: allLabs, loading, error, refetch } = useLabs();

  const orderedFrameworks = useMemo(() => {
    const sorted = sortFrameworks(frameworkList);
    if (sorted.length) return sorted;
    return FRAMEWORK_ORDER.map((id) => ({ id }));
  }, [frameworkList]);

  const scopedLabs = useMemo(() => allLabs.filter((lab) => {
    if (surfaceFilter && lab.surface !== surfaceFilter) return false;
    if (difficultyFilter && lab.difficulty !== difficultyFilter) return false;
    if (statusFilter && lab.status !== statusFilter) return false;
    return true;
  }), [allLabs, surfaceFilter, difficultyFilter, statusFilter]);

  const labs = useMemo(
    () => scopedLabs.filter((lab) => labFrameworkId(lab) === frameworkFilter),
    [scopedLabs, frameworkFilter],
  );

  const pillCounts = useMemo(() => {
    const counts = {};
    scopedLabs.forEach((lab) => {
      const id = labFrameworkId(lab);
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [scopedLabs]);

  const [activeTab, setActiveTab] = useState(0);
  const [expandedLab, setExpandedLab] = useState(null);
  const [completed, setCompleted] = useState({});

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(getCompletionKey()) || '{}');
      setCompleted(migrateCompletions(stored));
    } catch {
      setCompleted({});
    }
  }, []);

  const categories = useMemo(() => {
    if (framework?.risks?.length) {
      return framework.risks.map((risk) => ({
        code: risk.code,
        title: risk.title,
        riskId: risk.id,
        labs: labs.filter((lab) => (lab.primary_risk || (lab.risks || [])[0]) === risk.id),
      }));
    }
    const grouped = new Map();
    labs.forEach((lab) => {
      const primary = lab.primary_risk || (lab.risks || [])[0] || '';
      const code = primary.includes(':') ? primary.split(':').slice(1).join(':') : riskCodeForLab(lab, frameworkFilter);
      if (!grouped.has(code)) grouped.set(code, { code, title: code, riskId: primary || null, labs: [] });
      grouped.get(code).labs.push(lab);
    });
    return Array.from(grouped.values());
  }, [framework, labs, frameworkFilter]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash || !categories.length) return;
    let idx = categories.findIndex((c) => c.code === hash);
    if (idx < 0) {
      const hashedLab = labs.find(
        (lab) => lab.owasp === hash || (lab.risks || []).some((r) => r.endsWith(`:${hash}`))
      );
      if (hashedLab) {
        idx = categories.findIndex((c) => c.labs.some((l) => l.id === hashedLab.id));
      }
    }
      if (idx >= 0) setActiveTab(idx);
  }, [location.hash, categories, labs]);

  useEffect(() => {
    if (!labFromQuery || !allLabs.length) return;
    const lab = allLabs.find((item) => item.id === labFromQuery);
    if (!lab) return;
    const fw = labFrameworkId(lab);
    if (fw && fw !== frameworkFilter) {
      const next = new URLSearchParams(searchParams);
      next.set('framework', fw);
      setSearchParams(next, { replace: true });
      return;
    }
    const idx = categories.findIndex((c) => c.labs.some((l) => l.id === labFromQuery));
    if (idx >= 0) {
      setActiveTab(idx);
      setExpandedLab(labFromQuery);
      localStorage.setItem('active_lab_id', labFromQuery);
    }
  }, [labFromQuery, allLabs, frameworkFilter, categories, searchParams, setSearchParams]);

  const toggleComplete = useCallback((labId) => {
    setCompleted((prev) => {
      const next = { ...prev, [labId]: !prev[labId] };
      localStorage.setItem(getCompletionKey(), JSON.stringify(next));
      return next;
    });
  }, []);

  const expandLab = (lab) => {
    const next = expandedLab === lab.id ? null : lab.id;
    setExpandedLab(next);
    if (next) localStorage.setItem('active_lab_id', lab.id);
    else localStorage.removeItem('active_lab_id');
  };

  const cat = categories[activeTab] || { code: '', title: '', labs: [] };
  const catLabs = cat.labs || [];
  const completedCount = catLabs.filter((l) => completed[l.id]).length;
  const frameworkLabs = labs;
  const frameworkDone = frameworkLabs.filter((l) => completed[l.id]).length;
  const activeFilters = [
    surfaceFilter && { key: 'surface', label: `surface: ${surfaceFilter}` },
    difficultyFilter && { key: 'difficulty', label: `difficulty: ${difficultyFilter}` },
    statusFilter && { key: 'status', label: `status: ${statusFilter}` },
  ].filter(Boolean);

  const clearFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const selectFramework = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('framework', id);
    next.delete('lab');
    setSearchParams(next, { replace: true });
    setActiveTab(0);
    setExpandedLab(null);
  };

  const handlePillKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    if (!orderedFrameworks.length) return;
    const idx = orderedFrameworks.findIndex((fw) => fw.id === frameworkFilter);
    if (idx < 0) return;
    const next = event.key === 'ArrowRight'
      ? (idx + 1) % orderedFrameworks.length
      : (idx - 1 + orderedFrameworks.length) % orderedFrameworks.length;
    selectFramework(orderedFrameworks[next].id);
  };

  const handleTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    if (!categories.length) return;
    const next = event.key === 'ArrowRight'
      ? (activeTab + 1) % categories.length
      : (activeTab - 1 + categories.length) % categories.length;
    setActiveTab(next);
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 2 }}>
      <Container maxWidth="xl">
        <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
          <HubHero
            eyebrow="Hands-on labs"
            title="Attack Labs"
            description="Hands-on exercises for each mapped risk. Try the example prompts, compare results across defense levels."
            steps={ATTACK_STEPS}
            flow={ATTACK_FLOW}
            actions={(
              <>
                <Button
                  component={Link}
                  to="/owasp-top-10"
                  variant="contained"
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Browse frameworks
                </Button>
                {HUB_LINKS.map((item) => (
                  <Button
                    key={item.to}
                    component={Link}
                    to={item.to}
                    variant="outlined"
                    size="small"
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {item.label}
                  </Button>
                ))}
              </>
            )}
          />

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
            >
              Could not load labs. Confirm you are signed in and the API is running.
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={88} />
            </Box>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              alignItems: 'start',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(300px, 3fr)', lg: 'minmax(0, 7fr) minmax(340px, 3fr)' },
            }}
          >
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={panel}>
                <Box
                  role="tablist"
                  aria-label="Security frameworks"
                  onKeyDown={handlePillKeyDown}
                  sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1, mb: 1.5 }}
                >
                  {orderedFrameworks.map((fw) => {
                    const selected = fw.id === frameworkFilter;
                    const count = pillCounts[fw.id] || 0;
                    return (
                      <Box
                        key={fw.id}
                        role="tab"
                        tabIndex={selected ? 0 : -1}
                        aria-selected={selected}
                        onClick={() => selectFramework(fw.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectFramework(fw.id);
                          }
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          px: 1.5,
                          py: 1,
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          bgcolor: selected
                            ? (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.1)
                            : (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03),
                          border: (t) => (selected
                            ? `1.5px solid ${t.palette.primary.main}`
                            : `1.5px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`),
                          color: selected ? 'primary.main' : 'text.primary',
                          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2, color: 'inherit' }}>
                          {shortFrameworkLabel(fw)}
                        </Typography>
                        <Typography sx={{ ...meta, fontWeight: 600, flexShrink: 0, color: 'inherit', opacity: 0.8 }}>
                          {count} {count === 1 ? 'lab' : 'labs'}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                <Box
                  role="tablist"
                  aria-label="Lab categories"
                  onKeyDown={handleTabKeyDown}
                  sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 0.75 }}
                >
                  {categories.map((c, i) => {
                    const hasLabs = c.labs.length > 0;
                    const isActive = activeTab === i;
                    const labLabel = hasLabs
                      ? `${c.labs.length} ${c.labs.length === 1 ? 'lab' : 'labs'}`
                      : (c.code === 'MCP05' ? 'Refused' : 'Soon');
                    return (
                      <Box
                        key={c.code}
                        role="tab"
                        tabIndex={isActive ? 0 : -1}
                        aria-selected={isActive}
                        onClick={() => setActiveTab(i)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setActiveTab(i);
                          }
                        }}
                        sx={{
                          ...inset,
                          display: 'grid',
                          gridTemplateColumns: '64px minmax(0, 1fr) auto',
                          alignItems: 'center',
                          gap: 1,
                          px: 1,
                          py: 0.85,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          opacity: hasLabs ? 1 : 0.7,
                          borderStyle: hasLabs ? 'solid' : 'dashed',
                          borderColor: isActive ? 'primary.main' : 'divider',
                          borderWidth: isActive ? '1.5px' : '1px',
                          bgcolor: isActive
                            ? (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.1)
                            : inset.bgcolor,
                          '&:hover': { borderColor: 'primary.main' },
                          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            lineHeight: 1,
                            px: 0.5,
                            py: 0.6,
                            borderRadius: '6px',
                            color: isActive ? '#fff' : 'primary.light',
                            bgcolor: isActive ? 'primary.main' : (t) => alpha(t.palette.primary.main, 0.14),
                          }}
                        >
                          {c.code}
                        </Typography>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3 }}>
                          {c.title}
                        </Typography>
                        <Typography sx={{ ...meta, fontWeight: 700, fontStyle: hasLabs ? 'normal' : 'italic' }}>
                          {labLabel}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Box sx={panel}>
                {cat.code && (
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 1 }}>
                    {cat.code}: {cat.title}
                  </Typography>
                )}

                {catLabs.length > 0 && (
                  <ProgressBar value={completedCount} total={catLabs.length} />
                )}

                {!loading && !error && catLabs.length === 0 ? (
                  cat.code === 'MCP05' ? (
                    <EmptyState
                      title="We refused to build this"
                      description="Command injection would mean a tool argument reaches a shell. The agentic track shows the same sink inside a disposable Docker sandbox."
                      action={(
                        <Button component={Link} to="/labs/asi05-1" variant="outlined" sx={{ textTransform: 'none' }}>
                          Open the sandboxed executor lab
                        </Button>
                      )}
                    />
                  ) : (
                    <EmptyState
                      title="Coming Soon"
                      description={cat.code ? `Labs for ${cat.code} are under development.` : 'No labs match these filters.'}
                    />
                  )
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                    {catLabs.map((lab) => {
                      const isExpanded = expandedLab === lab.id;
                      const isDone = !!completed[lab.id];
                      const expected = lab.expected_by_level || {};
                      return (
                        <Box
                          key={lab.id}
                          sx={{
                            ...inset,
                            borderColor: (t) => (isDone ? alpha(t.palette.secondary.main, 0.35) : t.palette.divider),
                          }}
                        >
                          <Box
                            onClick={() => expandLab(lab)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                expandLab(lab);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25,
                              cursor: 'pointer', borderRadius: '8px',
                              '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03) },
                              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                            }}
                          >
                            <IconButton
                              size="small"
                              aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                              onClick={(e) => { e.stopPropagation(); toggleComplete(lab.id); }}
                              sx={{ color: isDone ? 'secondary.main' : 'text.secondary' }}
                            >
                              {isDone ? <CheckIcon /> : <UncheckedIcon />}
                            </IconButton>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{lab.name}</Typography>
                                <RiskChip
                                  code={lab.owasp}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const qualified = (lab.risks || []).find((r) => r.endsWith(`:${lab.owasp}`))
                                      || (lab.risks || [])[0]
                                      || `owasp-llm-2026:${lab.owasp}`;
                                    navigate(riskPath(qualified));
                                  }}
                                />
                                {lab.difficulty && <DifficultyChip difficulty={lab.difficulty} />}
                              </Box>
                              <Typography sx={{ ...meta, fontSize: '0.85rem', mt: 0.25 }}>
                                {lab.description}
                              </Typography>
                            </Box>
                            <ExpandMoreIcon sx={{ color: 'text.secondary', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                          </Box>

                          <Collapse in={isExpanded}>
                            <Box sx={{ px: 2, pb: 2, pt: 1.5, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
                              {lab.description && (
                                <Box sx={{ mb: 2 }}>
                                  <SectionCard tone="info" dense title="Goal">
                                    <Typography sx={{ color: (t) => t.palette.custom?.text?.accent ?? 'primary.light', fontSize: '0.95rem' }}>
                                      {lab.description}
                                    </Typography>
                                  </SectionCard>
                                </Box>
                              )}

                              {(lab.example_payloads || []).length > 0 && (
                                <>
                                  <Typography sx={LABEL_SX}>Show me</Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                    {(lab.example_payloads || []).map((prompt, i) => (
                                      <CodeBlock key={`${lab.id}-p${i}`} code={prompt} language="prompt" />
                                    ))}
                                  </Box>
                                </>
                              )}

                              {lab.objective && (
                                <Box sx={{ mb: 2 }}>
                                  <SectionCard dense title="How this attack works">
                                    <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                      {lab.objective}
                                    </Typography>
                                    {LAB_SERIES[lab.id] && (
                                      <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mt: 1 }}>
                                        {LAB_SERIES[lab.id]}
                                      </Typography>
                                    )}
                                  </SectionCard>
                                </Box>
                              )}

                              <Typography sx={LABEL_SX}>Expected Results by Defense Level</Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {LEVEL_ORDER.filter((level) => expected[level] || expected[Number(level)]).map((level) => {
                                  const text = expected[level] || expected[Number(level)];
                                  return (
                                    <Box key={level} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                      <DefenseLevelChip level={Number(level)} />
                                      <Box>
                                        <Typography sx={{ ...meta, fontWeight: 600 }}>
                                          {DEFENSE_LEVEL_LABELS[Number(level)]}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                                          {text}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Box>
                              <RelatedMap
                                risks={lab.risks || []}
                                surface={lab.surface}
                                relatedLabIds={lab.related_lab_ids || []}
                              />
                              {lab.surface === 'agent.runner' && (
                                <Button
                                  component={Link}
                                  to={`/labs/${lab.id}`}
                                  variant="outlined"
                                  size="small"
                                  sx={{ mt: 2 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open agent console
                                </Button>
                              )}
                              {lab.surface === 'mcp.client' && (
                                <Button
                                  component={Link}
                                  to={`/labs/${lab.id}`}
                                  variant="outlined"
                                  size="small"
                                  sx={{ mt: 2 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open MCP console
                                </Button>
                              )}
                              {lab.surface === 'mcp.host' && (
                                <Button
                                  component={Link}
                                  to={lab.id === 'killchain-1' ? '/challenges?killchain=1' : `/labs/${lab.id}`}
                                  variant="outlined"
                                  size="small"
                                  sx={{ mt: 2 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Start the two-step lab
                                </Button>
                              )}
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>

            <HubRail label="Lab context">
              <Box sx={panel}>
                <Typography component="h2" sx={sectionTitle}>
                  {framework?.name || shortFrameworkLabel({ id: frameworkFilter })}
                </Typography>
                <Typography sx={{ ...meta, mt: 0.25, mb: 1 }}>
                  {frameworkDone} of {frameworkLabs.length} labs marked complete in this framework.
                </Typography>
                {frameworkLabs.length > 0 && (
                  <ProgressBar value={frameworkDone} total={frameworkLabs.length} />
                )}
                {cat.riskId && (
                  <Button
                    component={Link}
                    to={riskPath(cat.riskId)}
                    size="small"
                    sx={{ mt: 1, textTransform: 'none' }}
                  >
                    Read about {cat.code}
                  </Button>
                )}
              </Box>

              {activeFilters.length > 0 && (
                <RailPanel title="Active filters" lead="Set from a link elsewhere in AIGoat. Remove one to see more labs.">
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                    {activeFilters.map((filter) => (
                      <Chip
                        key={filter.key}
                        size="small"
                        label={filter.label}
                        onDelete={() => clearFilter(filter.key)}
                        sx={chipSx}
                      />
                    ))}
                  </Box>
                </RailPanel>
              )}

              <RailPanel
                title="Defense levels"
                lead="Each lab lists what to expect at every level, so you can compare how the defenses change the result."
                items={[0, 1, 2].map((level) => DEFENSE_LEVEL_LABELS[level])}
              />
            </HubRail>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default AttacksPage;
