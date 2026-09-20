import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Collapse, IconButton,
  useMediaQuery, FormControl, InputLabel, Select, MenuItem, Alert, Skeleton, Button,
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
import { useFrameworks, useFramework } from '../hooks/useFrameworks';
import {
  PageHeader, RiskChip, DifficultyChip, DefenseLevelChip, DEFENSE_LEVEL_LABELS,
  CodeBlock, EmptyState, ProgressBar, SectionCard, RelatedMap,
} from './common';
import { riskPath } from '../utils/taxonomyLinks';

const DEFAULT_FRAMEWORK = 'owasp-llm-2026';

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

const getCompletionKey = () => {
  const username = localStorage.getItem('username') || 'anonymous';
  return `aigoat_owasp_completed_${username}`;
};

const migrateCompletions = (raw) => {
  if (localStorage.getItem('aigoat_owasp_completed_migrated')) return raw;
  const next = { ...raw };
  Object.entries(LEGACY_ID_MAP).forEach(([oldId, newId]) => {
    if (raw[oldId]) next[newId] = true;
  });
  localStorage.setItem(getCompletionKey(), JSON.stringify(next));
  localStorage.setItem('aigoat_owasp_completed_migrated', '1');
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
  const isMobile = useMediaQuery('(max-width:900px)');

  const frameworkFilter = searchParams.get('framework') || DEFAULT_FRAMEWORK;
  const surfaceFilter = searchParams.get('surface') || '';
  const difficultyFilter = searchParams.get('difficulty') || '';
  const statusFilter = searchParams.get('status') || '';
  const labFromQuery = searchParams.get('lab');

  const { frameworks } = useFrameworks();
  const { framework } = useFramework(frameworkFilter);
  const { labs, loading, error, refetch } = useLabs({
    framework: frameworkFilter,
    surface: surfaceFilter || undefined,
    difficulty: difficultyFilter || undefined,
    status: statusFilter || undefined,
  });

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
        labs: labs.filter((lab) => (lab.risks || []).includes(risk.id)),
      }));
    }
    const grouped = new Map();
    labs.forEach((lab) => {
      const code = riskCodeForLab(lab, frameworkFilter);
      if (!grouped.has(code)) grouped.set(code, { code, title: code, riskId: null, labs: [] });
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
    if (!labFromQuery) return;
    const idx = categories.findIndex((c) => c.labs.some((l) => l.id === labFromQuery));
    if (idx >= 0) {
      setActiveTab(idx);
      setExpandedLab(labFromQuery);
      localStorage.setItem('active_lab_id', labFromQuery);
    }
  }, [labFromQuery, categories]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
    setActiveTab(0);
  };

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

  const surfaces = useMemo(() => Array.from(new Set(labs.map((l) => l.surface).filter(Boolean))), [labs]);
  const difficulties = useMemo(
    () => Array.from(new Set(labs.map((l) => l.difficulty).filter(Boolean))),
    [labs],
  );

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

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="lab-framework-label">Framework</InputLabel>
            <Select
              labelId="lab-framework-label"
              label="Framework"
              value={frameworkFilter}
              onChange={(e) => setFilter('framework', e.target.value)}
            >
              {frameworks.map((fw) => (
                <MenuItem key={fw.id} value={fw.id}>{fw.name} ({fw.version})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="lab-surface-label">Surface</InputLabel>
            <Select
              labelId="lab-surface-label"
              label="Surface"
              value={surfaceFilter}
              onChange={(e) => setFilter('surface', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {surfaces.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="lab-difficulty-label">Difficulty</InputLabel>
            <Select
              labelId="lab-difficulty-label"
              label="Difficulty"
              value={difficultyFilter}
              onChange={(e) => setFilter('difficulty', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {difficulties.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="lab-status-label">Status</InputLabel>
            <Select
              labelId="lab-status-label"
              label="Status"
              value={statusFilter}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="coming_soon">Coming soon</MenuItem>
            </Select>
          </FormControl>
        </Box>

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
          aria-label="Lab categories"
          onKeyDown={handleTabKeyDown}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}
        >
          {categories.map((c, i) => {
            const hasLabs = c.labs.length > 0;
            const isActive = activeTab === i;
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
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  px: 2, py: 1.25, borderRadius: '10px', cursor: 'pointer',
                  minWidth: isMobile ? 80 : 110, textAlign: 'center',
                  transition: 'all 0.15s',
                  bgcolor: isActive
                    ? (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.1)
                    : hasLabs
                      ? (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03)
                      : (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.015),
                  border: isActive
                    ? (t) => `1.5px solid ${t.palette.primary.main}`
                    : hasLabs
                      ? (t) => `1.5px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`
                      : (t) => `1.5px dashed ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                <Typography sx={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: isActive ? 'primary.main' : hasLabs ? 'text.primary' : (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                  lineHeight: 1.2,
                }}>
                  {c.code}
                </Typography>
                <Typography sx={{
                  fontSize: '0.62rem', fontWeight: 500, mt: 0.25, lineHeight: 1.2,
                  color: isActive ? 'primary.main' : hasLabs ? 'text.secondary' : (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                  opacity: hasLabs ? 1 : 0.7,
                }}>
                  {c.title}
                </Typography>
                {!hasLabs && (
                  <Typography sx={{ fontSize: '0.5rem', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', mt: 0.25, fontStyle: 'italic' }}>
                    Soon
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {cat.code && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
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
                          <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.95rem' }}>{lab.name}</Typography>
                          <RiskChip
                            code={lab.owasp}
                            onClick={(event) => {
                              event.stopPropagation();
                              const qualified = (lab.risks || []).find((r) => r.endsWith(`:${lab.owasp}`))
                                || (lab.risks || [])[0]
                                || `owasp-llm-2025:${lab.owasp}`;
                              navigate(riskPath(qualified));
                            }}
                          />
                          {lab.difficulty && <DifficultyChip difficulty={lab.difficulty} />}
                        </Box>
                        <Typography sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}>
                          {lab.description}
                        </Typography>
                      </Box>
                      <ExpandMoreIcon sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                    </Box>

                    <Collapse in={isExpanded}>
                      <Box sx={{ px: 3, pb: 3, borderTop: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}` }}>
                        {lab.objective && (
                          <Box sx={{ mt: 2, mb: 3 }}>
                            <SectionCard tone="info" dense title="Goal">
                              <Typography sx={{ color: (t) => t.palette.custom?.text?.accent ?? 'primary.light', fontSize: '0.88rem' }}>
                                {lab.objective}
                              </Typography>
                            </SectionCard>
                          </Box>
                        )}

                        <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', mb: 1.5, letterSpacing: '0.04em' }}>
                          Example Prompts
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                          {(lab.example_payloads || []).map((prompt, i) => (
                            <CodeBlock key={`${lab.id}-p${i}`} code={prompt} language="prompt" />
                          ))}
                        </Box>

                        <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', mb: 1.5, letterSpacing: '0.04em' }}>
                          Expected Results by Defense Level
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {LEVEL_ORDER.filter((level) => expected[level] || expected[Number(level)]).map((level) => {
                            const text = expected[level] || expected[Number(level)];
                            return (
                              <Box key={level} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <DefenseLevelChip level={Number(level)} />
                                <Box>
                                  <Typography sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.7rem', fontWeight: 600 }}>
                                    {DEFENSE_LEVEL_LABELS[Number(level)]}
                                  </Typography>
                                  <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', fontSize: '0.82rem', lineHeight: 1.5 }}>
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
                        {lab.surface === 'skill.runtime' && (
                          <Button
                            component={Link}
                            to={`/labs/${lab.id}`}
                            variant="outlined"
                            size="small"
                            sx={{ mt: 2 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open skill console
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
