import React, { useState } from 'react';
import {
  Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails,
  Chip, Button, useMediaQuery, Paper,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
  OpenInNew as ExternalIcon,
  CompareArrows as CompareIcon,
  TrendingUp as TrendingUpIcon,
  NewReleases as NewIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const OWASP_ITEMS = [
  {
    code: 'LLM01',
    title: 'Prompt Injection',
    description: 'Manipulating LLMs via crafted inputs that override system instructions, leading to unauthorized actions or data leaks. This includes both direct injection (user input) and indirect injection (poisoned external data).',
    risk: 'Attackers can bypass safety guardrails, exfiltrate sensitive data, perform unauthorized actions, or manipulate the AI into generating harmful content.',
  },
  {
    code: 'LLM02',
    title: 'Sensitive Information Disclosure',
    description: 'LLMs may inadvertently reveal confidential data in their responses, including PII, credentials, API keys, or proprietary system details embedded in training data or context.',
    risk: 'Exposure of customer data, internal credentials, financial information, or business logic that can be exploited for further attacks.',
  },
  {
    code: 'LLM03',
    title: 'Supply Chain',
    description: 'Vulnerabilities arising from compromised training data, pre-trained models, plugins, or third-party components integrated into LLM-based applications.',
    risk: 'Backdoors in models, poisoned dependencies, or malicious plugins can compromise the entire application silently.',
  },
  {
    code: 'LLM04',
    title: 'Data and Model Poisoning',
    description: 'Manipulation of training data or fine-tuning processes to introduce biases, backdoors, or vulnerabilities into the model, affecting its outputs and reliability.',
    risk: 'Corrupted model outputs, biased decisions, backdoor triggers that produce attacker-controlled responses for specific inputs.',
  },
  {
    code: 'LLM05',
    title: 'Improper Output Handling',
    description: 'Failing to validate, sanitize, or encode LLM outputs before passing them to downstream components, enabling injection attacks like XSS, SSRF, or code execution.',
    risk: 'Cross-site scripting through AI-generated content, server-side request forgery, or remote code execution via unsanitized outputs.',
  },
  {
    code: 'LLM06',
    title: 'Excessive Agency',
    description: 'Granting LLMs too much autonomy, permissions, or functionality without proper guardrails, allowing them to take unintended or harmful actions on behalf of users.',
    risk: 'Unauthorized data modifications, unintended API calls, privilege escalation, or actions that violate business rules.',
  },
  {
    code: 'LLM07',
    title: 'System Prompt Leakage',
    description: 'Extraction of the system prompt or internal instructions through social engineering, prompt injection, or other techniques, revealing the application\'s logic and constraints.',
    risk: 'Exposed system prompts reveal security measures, business rules, and attack surface, enabling more targeted and effective exploits.',
  },
  {
    code: 'LLM08',
    title: 'Vector and Embedding Weaknesses',
    description: 'Vulnerabilities in retrieval-augmented generation (RAG) systems where vector databases or embedding pipelines can be manipulated to inject malicious content or retrieve inappropriate data.',
    risk: 'Poisoned knowledge bases, manipulated search results, or unauthorized access to sensitive documents through embedding manipulation.',
  },
  {
    code: 'LLM09',
    title: 'Misinformation',
    description: 'LLMs generating false, misleading, or fabricated information (hallucinations) that appears authoritative and convincing, potentially leading to wrong decisions.',
    risk: 'Users acting on incorrect AI-generated information, reputational damage, legal liability, or cascading errors in automated systems.',
  },
  {
    code: 'LLM10',
    title: 'Unbounded Consumption',
    description: 'Lack of rate limiting, resource controls, or cost management for LLM interactions, allowing denial-of-service attacks or runaway costs through excessive API consumption.',
    risk: 'Service disruption, excessive cloud costs, resource exhaustion, or denial-of-service affecting all users of the application.',
  },
];

const CHANGES_2025 = [
  { icon: <NewIcon sx={{ fontSize: '0.9rem' }} />, type: 'New', text: 'LLM07: System Prompt Leakage — elevated from a sub-topic to its own category, reflecting the growing attack surface around system prompt extraction.' },
  { icon: <NewIcon sx={{ fontSize: '0.9rem' }} />, type: 'New', text: 'LLM08: Vector and Embedding Weaknesses — newly added to address risks in RAG architectures and vector databases that didn\'t exist in the 2023/24 list.' },
  { icon: <SwapIcon sx={{ fontSize: '0.9rem' }} />, type: 'Renamed', text: 'LLM02: "Insecure Output Handling" was renamed to "Sensitive Information Disclosure" — the scope broadened to cover all forms of data leakage, not just output handling.' },
  { icon: <SwapIcon sx={{ fontSize: '0.9rem' }} />, type: 'Renamed', text: 'LLM10: "Model Theft" was replaced by "Unbounded Consumption" — shifting focus from IP theft to denial-of-service and cost exploitation attacks.' },
  { icon: <TrendingUpIcon sx={{ fontSize: '0.9rem' }} />, type: 'Reordered', text: 'LLM04: "Data and Model Poisoning" merged the former "Training Data Poisoning" with model integrity concerns, reflecting the full lifecycle of data corruption attacks.' },
  { icon: <CompareIcon sx={{ fontSize: '0.9rem' }} />, type: 'Removed', text: '"Insecure Plugin Design" and "Overreliance" were removed as standalone items — their risks are now covered under Supply Chain (LLM03) and Misinformation (LLM09).' },
];

const OwaspTop10Page = () => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');
  const isDark = theme.palette.mode === 'dark';

  const handleChange = (panel) => (_event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const chipColor = isDark ? '#c8d0db' : '#475569';
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'text.primary', fontSize: isMobile ? '1.7rem' : '2.3rem', letterSpacing: '-0.03em', mb: 1.5 }}>
            OWASP Top 10 for LLM Applications
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 560, lineHeight: 1.7, mb: 2.5, fontSize: '0.9rem' }}>
            The definitive guide to security risks in Large Language Model applications.
            Updated for 2025 with new categories reflecting the evolving threat landscape
            around RAG systems, system prompts, and agentic AI.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              endIcon={<ExternalIcon sx={{ fontSize: '0.75rem !important' }} />}
              component="a"
              href="https://genai.owasp.org/llm-top-10/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: '8px',
                borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                color: (t) => t.palette.custom?.text?.accent ?? 'primary.main',
                '&:hover': { borderColor: 'primary.main', bgcolor: (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.06) },
              }}
            >
              Official OWASP LLM Top 10
            </Button>
            <Button
              variant="outlined"
              size="small"
              endIcon={<ExternalIcon sx={{ fontSize: '0.75rem !important' }} />}
              component="a"
              href="https://genai.owasp.org/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', borderRadius: '8px',
                borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
                '&:hover': { borderColor: 'primary.main', bgcolor: (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.06) },
              }}
            >
              OWASP Gen AI Project
            </Button>
          </Box>
        </Box>

        {/* What's Changed in 2025 */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 5,
            borderRadius: '14px',
            bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
            border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
            <CompareIcon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', letterSpacing: '-0.01em' }}>
              What changed from 2023/24 to 2025
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {CHANGES_2025.map((item, i) => {
              const typeColor = item.type === 'New' ? (isDark ? '#4ade80' : '#16a34a')
                : item.type === 'Renamed' ? (isDark ? '#818cf8' : '#6366f1')
                : item.type === 'Reordered' ? (isDark ? '#fbbf24' : '#d97706')
                : (isDark ? '#94a3b8' : '#64748b');
              return (
                <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Chip
                    icon={item.icon}
                    label={item.type}
                    size="small"
                    sx={{
                      mt: 0.25,
                      flexShrink: 0,
                      bgcolor: alpha(typeColor, 0.1),
                      color: typeColor,
                      border: `1px solid ${alpha(typeColor, 0.2)}`,
                      fontWeight: 700,
                      fontSize: '0.62rem',
                      height: 24,
                      '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                    }}
                  />
                  <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {item.text}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* Section label */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', letterSpacing: '-0.01em' }}>
            All 10 Categories
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            Click to expand details
          </Typography>
        </Box>

        {/* Accordion list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {OWASP_ITEMS.map((item, idx) => (
            <Accordion
              key={item.code}
              expanded={expanded === item.code}
              onChange={handleChange(item.code)}
              sx={{
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                borderRadius: '10px !important',
                '&:before': { display: 'none' },
                overflow: 'hidden',
                transition: 'border-color 0.2s',
                ...(expanded === item.code && {
                  borderColor: (t) => t.palette.custom?.border?.strong ?? t.palette.primary.main,
                }),
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />}
                sx={{
                  px: 2.5, py: 0.25, minHeight: 48,
                  '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, my: 1 },
                }}
              >
                <Chip
                  label={item.code}
                  size="small"
                  sx={{
                    bgcolor: chipBg,
                    color: chipColor,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    border: `1px solid ${chipBorder}`,
                    minWidth: 56,
                    height: 24,
                  }}
                />
                <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.88rem', flex: 1 }}>
                  {item.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                <Box sx={{ borderTop: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`, pt: 2 }}>
                  <Typography sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', lineHeight: 1.7, mb: 2, fontSize: '0.85rem' }}>
                    {item.description}
                  </Typography>
                  <Box sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.05), border: (t) => `1px solid ${alpha(t.palette.error.main, 0.12)}`, borderRadius: '8px', p: 1.75, mb: 2.5 }}>
                    <Typography sx={{ color: 'error.light', fontWeight: 700, fontSize: '0.68rem', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Risk / Impact
                    </Typography>
                    <Typography sx={{ color: 'error.light', fontSize: '0.8rem', lineHeight: 1.6 }}>
                      {item.risk}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: '0.8rem !important' }} />}
                      onClick={() => navigate(`/attacks#${item.code}`)}
                      sx={{
                        color: 'primary.light',
                        borderColor: (t) => t.palette.custom?.brand?.primaryMuted ?? alpha(t.palette.primary.main, 0.25),
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        '&:hover': { borderColor: 'primary.main', bgcolor: (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.08) },
                      }}
                    >
                      Try in Attack Lab
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      endIcon={<ExternalIcon sx={{ fontSize: '0.7rem !important' }} />}
                      component="a"
                      href={`https://genai.owasp.org/llmrisk/${item.code.toLowerCase()}-prompt-injection/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'text.secondary',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      Read on OWASP
                    </Button>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {/* Bottom CTA */}
        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, lineHeight: 1.6 }}>
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
              fontSize: '0.85rem',
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
