import React, { useMemo } from 'react';
import {
  Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails,
  Chip, Button, Alert, Skeleton, TextField,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
  OpenInNew as ExternalIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useFrameworks, useFramework } from '../hooks/useFrameworks';
import { PageHeader, SectionCard, RiskChip, EmptyState } from './common';
import { attacksRiskPath, attacksSurfacePath } from '../utils/taxonomyLinks';
import { DEFAULT_FRAMEWORK, sortFrameworks } from '../utils/frameworkOrder';

const LLM_2025_TO_2026 = [
  { tag: 'Unchanged', hue: 'default', code: 'LLM01', title: 'Prompt Injection', note: 'same title and rank' },
  { tag: 'Unchanged', hue: 'default', code: 'LLM02', title: 'Sensitive Information Disclosure', note: 'same title and rank' },
  { tag: 'Moved up', hue: 'warning', code: 'LLM03', title: 'Excessive Agency', note: 'was LLM06' },
  { tag: 'Moved down', hue: 'info', code: 'LLM04', title: 'Supply Chain', note: 'was LLM03' },
  { tag: 'Moved down', hue: 'info', code: 'LLM05', title: 'Data and Model Poisoning', note: 'was LLM04' },
  { tag: 'Moved up', hue: 'warning', code: 'LLM06', title: 'Unbounded Consumption', note: 'was LLM10' },
  { tag: 'Moved up', hue: 'warning', code: 'LLM07', title: 'Misinformation', note: 'was LLM09' },
  { tag: 'Renamed', hue: 'secondary', code: 'LLM08', title: 'Hidden Context Exposure', note: 'was LLM07 System Prompt Leakage' },
  { tag: 'Moved down', hue: 'info', code: 'LLM09', title: 'Vector and Embedding Weaknesses', note: 'was LLM08' },
  { tag: 'Moved down', hue: 'info', code: 'LLM10', title: 'Improper Output Handling', note: 'was LLM05' },
];

const outboundButtonSx = {
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9375rem',
  borderRadius: '8px',
  borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
  color: (t) => t.palette.custom?.text?.accent ?? 'primary.main',
  '&:hover': {
    borderColor: 'primary.main',
    bgcolor: (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.06),
  },
};

const FrameworkTabs = ({ frameworks, selectedId, onSelect }) => {
  const handleKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const idx = frameworks.findIndex((fw) => fw.id === selectedId);
    if (idx < 0) return;
    const next = event.key === 'ArrowRight'
      ? (idx + 1) % frameworks.length
      : (idx - 1 + frameworks.length) % frameworks.length;
    onSelect(frameworks[next].id);
  };

  return (
    <Box
      role="tablist"
      aria-label="Security frameworks"
      onKeyDown={handleKeyDown}
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}
    >
      {frameworks.map((fw) => {
        const selected = fw.id === selectedId;
        return (
          <Box
            key={fw.id}
            role="tab"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-controls="framework-risk-list"
            onClick={() => onSelect(fw.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(fw.id);
              }
            }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 2,
              py: 1.25,
              borderRadius: '10px',
              cursor: 'pointer',
              minWidth: { xs: 80, md: 110 },
              textAlign: 'center',
              transition: 'all 0.15s',
              bgcolor: selected
                ? (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.1)
                : (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03),
              border: selected
                ? (t) => `1.5px solid ${t.palette.primary.main}`
                : (t) => `1.5px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: selected ? 'primary.main' : 'text.primary', lineHeight: 1.2 }}>
              {fw.version}
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, mt: 0.25, lineHeight: 1.2, color: selected ? 'primary.main' : 'text.secondary' }}>
              {fw.name.replace('OWASP ', '').replace(' for LLM Applications', '')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

const OwaspTop10Page = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { frameworks, loading: listLoading, error: listError, refetch: refetchList } = useFrameworks();
  const orderedFrameworks = useMemo(() => sortFrameworks(frameworks), [frameworks]);
  const selectedId = searchParams.get('framework') || DEFAULT_FRAMEWORK;
  const query = searchParams.get('q') || '';
  const { framework, loading: detailLoading, error: detailError, refetch: refetchDetail } = useFramework(selectedId);

  const filteredRisks = useMemo(() => {
    const risks = framework?.risks || [];
    const needle = query.trim().toLowerCase();
    if (!needle) return risks;
    return risks.filter((risk) =>
      `${risk.code} ${risk.title} ${risk.summary}`.toLowerCase().includes(needle)
    );
  }, [framework, query]);

  const setFrameworkId = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('framework', id);
    setSearchParams(next);
  };

  const setQuery = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const loading = listLoading || detailLoading;
  const error = listError || detailError;

  const headerActions = (
    <>
      <Button
        variant="outlined"
        size="small"
        endIcon={<ExternalIcon sx={{ fontSize: '0.9375rem !important' }} />}
        component="a"
        href={framework?.url || 'https://genai.owasp.org/llm-top-10/'}
        target="_blank"
        rel="noopener noreferrer"
        sx={outboundButtonSx}
      >
        Official list
      </Button>
      <Button
        variant="outlined"
        size="small"
        endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
        onClick={() => navigate('/threat-modeling')}
        sx={outboundButtonSx}
      >
        Threat modeling
      </Button>
      <Button
        variant="outlined"
        size="small"
        endIcon={<ExternalIcon sx={{ fontSize: '0.9375rem !important' }} />}
        component="a"
        href="https://genai.owasp.org/"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          ...outboundButtonSx,
          color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
        }}
      >
        OWASP Gen AI Project
      </Button>
    </>
  );

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <PageHeader
          title="AI Security Frameworks"
          subtitle="Educational taxonomies that AIGoat maps labs and challenges to. Switch frameworks to see how the same techniques appear under different lists."
          actions={headerActions}
        />

        {listLoading && !frameworks.length && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" width={110} height={52} />
            ))}
          </Box>
        )}

        {orderedFrameworks.length > 0 && (
          <FrameworkTabs frameworks={orderedFrameworks} selectedId={selectedId} onSelect={setFrameworkId} />
        )}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={<Button color="inherit" size="small" onClick={() => { refetchList(); refetchDetail(); }}>Retry</Button>}
          >
            Could not load this framework. Check that the API is running.
          </Alert>
        )}

        {framework && (
          <Box sx={{ mb: 3 }}>
            <SectionCard>
              <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>{framework.name}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 1.5 }}>
                v{framework.version}
                {framework.status ? ` · ${framework.status}` : ''}
                {framework.publisher ? ` · ${framework.publisher}` : ''}
                {` · ${framework.risks?.length || 0} risks`}
              </Typography>
              {(framework.status === 'beta' || framework.status === 'draft') && framework.maturity_note && (
                <Alert severity="warning" role="note" sx={{ mb: 2 }}>
                  {framework.maturity_note}
                </Alert>
              )}
              <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                {framework.attribution}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8125rem', mt: 1 }}>
                Source licence: {framework.source_license}
              </Typography>
            </SectionCard>
          </Box>
        )}

        {selectedId === 'owasp-llm-2026' && (
          <Box sx={{ mb: 3 }}>
            <SectionCard title="What changed from 2025 to 2026">
              <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', fontSize: '0.9375rem', lineHeight: 1.6, mb: 2 }}>
                OWASP re-ranked the LLM Top 10 for 2026 as agents, tools, and retrieval moved from side channels
                to the default architecture. AIGoat maps labs to the 2026 list only. Titles below are OWASP labels;
                the notes are AIGoat teaching commentary, not the official explanations.
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {LLM_2025_TO_2026.map((row) => (
                  <Box
                    component="li"
                    key={row.code}
                    sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}
                  >
                    <Chip size="small" label={row.tag} color={row.hue} />
                    <Typography sx={{ fontSize: '0.9375rem', color: 'text.primary' }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>{row.code}</Box>
                      {' '}{row.title}
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        {' '}({row.note})
                      </Box>
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mt: 2, lineHeight: 1.6 }}>
                Nothing was added or removed. Agent-specific risks moved to the Agentic Applications list.
              </Typography>
            </SectionCard>
          </Box>
        )}

        <TextField
          size="small"
          fullWidth
          placeholder="Filter by code, title, or summary"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 2 }}
        />

        {loading && !framework && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={56} />
            ))}
          </Box>
        )}

        {!loading && framework && filteredRisks.length === 0 && (
          <EmptyState
            title="No risks match"
            description={query ? 'Try a different filter.' : 'This framework has no risks yet.'}
          />
        )}

        <Box id="framework-risk-list" role="tabpanel" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filteredRisks.map((risk) => (
            <Accordion
              key={risk.id}
              disableGutters
              sx={{
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                borderRadius: '10px !important',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />}
                sx={{
                  px: 2.5, py: 0.25, minHeight: 48,
                  '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, my: 1 },
                }}
              >
                <RiskChip code={risk.code} framework={framework.name} />
                <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '1rem', flex: 1 }}>
                  {risk.title}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.8125rem', mr: 1 }}>
                  {(risk.lab_ids || []).length} labs · {(risk.challenge_ids || []).length} challenges
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                <Box sx={{ borderTop: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`, pt: 2 }}>
                  <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', lineHeight: 1.7, mb: 2, fontSize: '0.9375rem' }}>
                    {risk.summary}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                    {(risk.attack_surfaces || []).map((surface) => (
                      <Chip
                        key={surface}
                        label={surface}
                        size="small"
                        component={RouterLink}
                        to={attacksSurfacePath(surface)}
                        clickable
                        sx={{ textDecoration: 'none' }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                      onClick={() => navigate(`/owasp-top-10/${framework.id}/${risk.code}`)}
                      sx={{
                        color: 'primary.light',
                        borderColor: (t) => t.palette.custom?.brand?.primaryMuted ?? alpha(t.palette.primary.main, 0.25),
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                      }}
                    >
                      View risk
                    </Button>
                    {(risk.lab_ids || []).length > 0 && (
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                        onClick={() => navigate(attacksRiskPath(framework.id, risk.code))}
                        sx={{
                          color: 'primary.light',
                          borderColor: (t) => t.palette.custom?.brand?.primaryMuted ?? alpha(t.palette.primary.main, 0.25),
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.9375rem',
                        }}
                      >
                        Try in Attack Lab
                      </Button>
                    )}
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 2, lineHeight: 1.6 }}>
            Ready to test these vulnerabilities hands-on? Jump into the Attack Labs
            and practice exploiting real LLM weaknesses in a safe environment.
          </Typography>
          <Button
            variant="contained"
            size="medium"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/attacks')}
            sx={{
              bgcolor: (t) => t.palette.custom?.brand?.primary ?? 'primary.main',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9375rem',
              px: 3,
              py: 1,
              borderRadius: '10px',
              '&:hover': { bgcolor: (t) => t.palette.primary.dark },
            }}
          >
            Launch Attack Labs
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default OwaspTop10Page;
