import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Collapse, IconButton,
  Alert, Skeleton, Button,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';
import { useLocation, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useLabs } from '../hooks/useLabs';
import { useFramework, useFrameworks } from '../hooks/useFrameworks';
import {
  PageHeader, RiskChip, DifficultyChip, DefenseLevelChip, DEFENSE_LEVEL_LABELS,
  CodeBlock, EmptyState, ProgressBar, SectionCard, RelatedMap,
} from './common';
import { riskPath } from '../utils/taxonomyLinks';
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

const FRAMEWORK_TONES = {
  'owasp-llm-2026': {
    main: '#4f46e5',
    ink: '#3730a3',
    inkDark: '#c7d2fe',
    soft: 'rgba(79,70,229,0.08)',
    softDark: 'rgba(99,102,241,0.16)',
  },
  'owasp-mcp-2025': {
    main: '#0f766e',
    ink: '#115e59',
    inkDark: '#99f6e4',
    soft: 'rgba(15,118,110,0.04)',
    softDark: 'rgba(45,212,191,0.07)',
  },
  'owasp-agentic-2026': {
    main: '#e0a15a',
    ink: '#9a6230',
    inkDark: '#f6d2a8',
    onMain: '#4a2c12',
    soft: 'rgba(224,161,90,0.045)',
    softDark: 'rgba(224,161,90,0.07)',
  },
};

const toneOf = (frameworkId) => FRAMEWORK_TONES[frameworkId] || FRAMEWORK_TONES['owasp-llm-2026'];

const toneColors = (tone, theme) => {
  const dark = theme.palette.mode === 'dark';
  return {
    main: tone.main,
    ink: dark ? tone.inkDark : tone.ink,
    soft: dark ? tone.softDark : tone.soft,
    onMain: tone.onMain || '#ffffff',
  };
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
  const activeTone = toneOf(frameworkFilter);

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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <PageHeader
          icon={<BugIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
          title="Attack Labs"
          subtitle="Hands-on exercises for each mapped risk. Try the example prompts, compare results across defense levels."
        />

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
          >
            Could not load labs. Confirm you are signed in and the API is running.
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={88} />
          </Box>
        )}

        <Box
          role="tablist"
          aria-label="Security frameworks"
          onKeyDown={handlePillKeyDown}
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25, mb: 1.5 }}
        >
          {orderedFrameworks.map((fw) => {
            const selected = fw.id === frameworkFilter;
            const count = pillCounts[fw.id] || 0;
            const tone = toneOf(fw.id);
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
                  px: 1.75,
                  py: 1.35,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  bgcolor: (t) => {
                    const colors = toneColors(tone, t);
                    return selected ? colors.main : (t.palette.custom?.surface?.elevated ?? t.palette.background.paper);
                  },
                  color: (t) => (selected ? toneColors(tone, t).onMain : toneColors(tone, t).ink),
                  border: (t) => (selected
                    ? '1px solid transparent'
                    : `1px solid ${alpha(tone.main, t.palette.mode === 'dark' ? 0.32 : 0.2)}`),
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: (t) => {
                      const colors = toneColors(tone, t);
                      return selected ? colors.main : colors.soft;
                    },
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: tone.main,
                    outlineOffset: 2,
                  },
                }}
              >
                <Typography sx={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2, color: 'inherit' }}>
                  {shortFrameworkLabel(fw)}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'inherit', opacity: selected ? 0.92 : 0.75, whiteSpace: 'nowrap' }}>
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
          sx={(t) => {
            const colors = toneColors(activeTone, t);
            return {
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 1,
              mb: 3,
              p: 1.25,
              borderRadius: '14px',
              bgcolor: colors.soft,
              border: `1px solid ${alpha(activeTone.main, t.palette.mode === 'dark' ? 0.22 : 0.12)}`,
            };
          }}
        >
          {categories.map((c, i) => {
            const hasLabs = c.labs.length > 0;
            const isActive = activeTab === i;
            const labLabel = hasLabs
              ? `${c.labs.length} ${c.labs.length === 1 ? 'lab' : 'labs'}`
              : 'Soon';
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
                  display: 'grid',
                  gridTemplateColumns: '72px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.15,
                  py: 1,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s, border-color 0.15s',
                  bgcolor: (t) => {
                    if (isActive) return t.palette.mode === 'dark' ? alpha(activeTone.main, 0.28) : '#ffffff';
                    if (!hasLabs) return 'transparent';
                    return t.palette.mode === 'dark' ? alpha('#000', 0.18) : alpha('#fff', 0.72);
                  },
                  border: (t) => {
                    if (isActive) return `1.5px solid ${activeTone.main}`;
                    if (!hasLabs) return `1.5px dashed ${alpha(activeTone.main, 0.35)}`;
                    return `1.5px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`;
                  },
                  opacity: hasLabs ? 1 : 0.72,
                  '&:hover': {
                    bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(activeTone.main, 0.22) : '#ffffff'),
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: activeTone.main,
                    outlineOffset: 2,
                  },
                }}
              >
                <Typography sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  textAlign: 'center',
                  lineHeight: 1,
                  px: 0.75,
                  py: 0.7,
                  borderRadius: '7px',
                  color: isActive ? '#fff' : (t) => toneColors(activeTone, t).ink,
                  bgcolor: isActive ? activeTone.main : (t) => alpha(activeTone.main, t.palette.mode === 'dark' ? 0.28 : 0.14),
                }}>
                  {c.code}
                </Typography>
                <Typography sx={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  color: 'text.primary',
                }}>
                  {c.title}
                </Typography>
                <Typography sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  color: (t) => (hasLabs ? toneColors(activeTone, t).ink : (t.palette.custom?.text?.muted ?? 'text.secondary')),
                  fontStyle: hasLabs ? 'normal' : 'italic',
                }}>
                  {labLabel}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {cat.code && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h5" sx={{ color: (t) => toneColors(activeTone, t).ink, fontWeight: 700 }}>
              {cat.code}: {cat.title}
            </Typography>
          </Box>
        )}

        {catLabs.length > 0 && (
          <ProgressBar value={completedCount} total={catLabs.length} />
        )}

        {!loading && !error && catLabs.length === 0 ? (
          <EmptyState
            title="Coming Soon"
            description={cat.code ? `Labs for ${cat.code} are under development.` : 'No labs match these filters.'}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {catLabs.map((lab) => {
              const isExpanded = expandedLab === lab.id;
              const isDone = !!completed[lab.id];
              const expected = lab.expected_by_level || {};
              return (
                <Card
                  key={lab.id}
                  sx={{
                    bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                    border: (t) => `1px solid ${isDone ? alpha(t.palette.secondary.main, 0.2) : (t.palette.custom?.border?.subtle ?? t.palette.divider)}`,
                    borderRadius: '12px',
                    overflow: 'visible',
                  }}
                >
                  <CardContent sx={{ p: 0 }}>
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
                        display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2,
                        cursor: 'pointer', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.02) },
                      }}
                    >
                      <IconButton
                        size="small"
                        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                        onClick={(e) => { e.stopPropagation(); toggleComplete(lab.id); }}
                        sx={{ color: isDone ? 'secondary.main' : (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}
                      >
                        {isDone ? <CheckIcon /> : <UncheckedIcon />}
                      </IconButton>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '1rem' }}>{lab.name}</Typography>
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
                        <Typography sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.9375rem', mt: 0.25 }}>
                          {lab.description}
                        </Typography>
                      </Box>
                      <ExpandMoreIcon sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                    </Box>

                    <Collapse in={isExpanded}>
                      <Box sx={{ px: 3, pb: 3, borderTop: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}` }}>
                        {lab.description && (
                          <Box sx={{ mt: 2, mb: 3 }}>
                            <SectionCard tone="info" dense title="Goal">
                              <Typography sx={{ color: (t) => t.palette.custom?.text?.accent ?? 'primary.light', fontSize: '1rem' }}>
                                {lab.description}
                              </Typography>
                            </SectionCard>
                          </Box>
                        )}

                        {(lab.example_payloads || []).length > 0 && (
                          <>
                            <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.9375rem', textTransform: 'uppercase', mb: 1.5, letterSpacing: '0.04em' }}>
                              Show me
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                              {(lab.example_payloads || []).map((prompt, i) => (
                                <CodeBlock key={`${lab.id}-p${i}`} code={prompt} language="prompt" />
                              ))}
                            </Box>
                          </>
                        )}

                        {lab.objective && (
                          <Box sx={{ mb: 3 }}>
                            <SectionCard dense title="How this attack works">
                              <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                {lab.objective}
                              </Typography>
                            </SectionCard>
                          </Box>
                        )}

                        <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.9375rem', textTransform: 'uppercase', mb: 1.5, letterSpacing: '0.04em' }}>
                          Expected Results by Defense Level
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {LEVEL_ORDER.filter((level) => expected[level] || expected[Number(level)]).map((level) => {
                            const text = expected[level] || expected[Number(level)];
                            return (
                              <Box key={level} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <DefenseLevelChip level={Number(level)} />
                                <Box>
                                  <Typography sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.8125rem', fontWeight: 600 }}>
                                    {DEFENSE_LEVEL_LABELS[Number(level)]}
                                  </Typography>
                                  <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', fontSize: '0.9375rem', lineHeight: 1.5 }}>
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
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default AttacksPage;
