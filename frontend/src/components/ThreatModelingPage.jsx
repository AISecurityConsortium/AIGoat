import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Container, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AccountTree as ThreatModelIcon,
  ArrowForward as ArrowForwardIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as ExternalIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader, SectionCard, EmptyState } from './common';
import { labPath } from '../utils/taxonomyLinks';

const MODELS = [
  {
    id: 'atlas',
    name: 'MITRE ATLAS',
    official: 'https://atlas.mitre.org/',
    question: 'What would an attacker do next?',
    surfaces: ['chat.cracky', 'rag.kb', 'agent.runner', 'mcp.client'],
    bullets: [
      'ATLAS is an attacker story: reconnaissance, access, execution, persistence, exfiltration.',
      'Reach for it when you need a named next move, not a control to toggle.',
      'It is sequenced. It does not rank product defects the way OWASP does.',
      'On AIGoat: injection on chat.cracky, poison on rag.kb, tool steer on agent.runner, poisoned descriptor on mcp.client.',
    ],
  },
  {
    id: 'maestro',
    name: 'MAESTRO',
    official: 'https://cloudsecurityalliance.org/artifacts/agentic-ai-threat-modeling-framework-maestro',
    question: 'Which agent layer failed?',
    surfaces: ['agent.runner', 'mcp.client'],
    bullets: [
      'CSA model for stacked agent systems: model, data, framework, tools, memory.',
      'Use it when a failure only appears after a tool result is written back into the next prompt.',
      'Names layers, not Top 10 codes. OWASP Agentic names the failure; MAESTRO names the layer.',
      'Shop agent: Ollama, SQLite plus rag.kb, Intent Gate, per-user memory, MCP stdio. One agent with tools.',
    ],
  },
  {
    id: 'nist',
    name: 'NIST AI RMF and Generative AI Profile',
    official: 'https://www.nist.gov/itl/ai-risk-management-framework',
    question: 'Can we prove we measured it?',
    surfaces: ['chat.cracky', 'rag.kb', 'agent.runner', 'mcp.client'],
    bullets: [
      'GOVERN, MAP, MEASURE, and MANAGE, plus a generative-AI profile for leakage, plugins, and resource abuse.',
      'Use it when someone asks whether you measured the risk and who owns the response.',
      'ATLAS and STRIDE generate threats. NIST asks for owners, metrics, and a plan.',
      'On AIGoat: L0 is a teaching policy, primary_risk is MAP, evaluators are MEASURE, raising L0 to L2 is MANAGE.',
    ],
  },
  {
    id: 'saif',
    name: 'Google SAIF',
    official: 'https://safety.google/cybersecurity-advancements/saif/',
    question: 'Would the lifecycle catch this?',
    surfaces: ['chat.cracky', 'rag.kb', 'agent.runner', 'mcp.client'],
    bullets: [
      "Google's secure-by-default AI product lifecycle: foundations, detection, automation, shared baseline.",
      'Use it for engineering conversations: filters, output handling, plugin review, logging.',
      'A program, not a taxonomy. Pair it with OWASP for defect names.',
      'L1 is a toy slice (validation, intent, moderation). L2 adds Guardrails. Do not copy L0 into a real shop.',
    ],
  },
  {
    id: 'stride-linddun',
    name: 'STRIDE and LINDDUN',
    official: 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats',
    question: 'What fails on each arrow?',
    surfaces: ['chat.cracky', 'rag.kb', 'agent.runner', 'mcp.client'],
    bullets: [
      'STRIDE is the per-element mnemonic on prompts, chunks, tools, memory, and MCP descriptors.',
      'Use STRIDE when you have a data-flow diagram. Use LINDDUN when the flow carries personal data.',
      'Forces every arrow to answer six questions that a Top 10 list will skip.',
      'The worked mapping is in the shop-agent example below.',
    ],
  },
  {
    id: 'owasp-exchange',
    name: 'OWASP AI Exchange',
    official: 'https://owaspai.org/',
    question: 'Which OWASP doc am I holding?',
    surfaces: ['chat.cracky', 'rag.kb', 'agent.runner', 'mcp.client'],
    bullets: [
      'Crosswalk among OWASP AI projects. The Testing Guide is how you probe and record evidence.',
      'Start here when a stakeholder says they follow OWASP and you need to know which document.',
      'The Top 10 lists stay the catalogs AIGoat teaches. The Exchange shows how they sit next to ATLAS and NIST.',
      'A captured flag is a failing test you would want in CI, not a production sign-off.',
    ],
  },
];

const EXAMPLE_STEPS = [
  {
    title: '1. Draw the real surfaces',
    body: 'AIGoat looks like a shop assistant. The threat model is four runtimes: chat.cracky, rag.kb, agent.runner, and mcp.client. api.raw is a stub and stays out.',
    labs: [
      { id: 'llm01-1', label: 'llm01-1 Prompt Injection' },
      { id: 'llm09-1', label: 'llm09-1 Vector poisoning' },
      { id: 'llm03-1', label: 'llm03-1 Tool refund' },
      { id: 'mcp03-1', label: 'mcp03-1 Tool shadowing' },
    ],
  },
  {
    title: '2. Name assets and trust boundaries',
    body: 'Assets: customer rows, HMAC flags, the system prompt, retrieved chunks, per-user memory, MCP descriptors. Typed input sits on the untrusted side of every arrow.',
    labs: [
      { id: 'llm08-1', label: 'llm08-1 Hidden context' },
      { id: 'asi06-1', label: 'asi06-1 Memory poison' },
    ],
  },
  {
    title: '3. Walk ATLAS, then STRIDE, then one OWASP risk',
    body: 'ATLAS gives the story. STRIDE asks a question on each arrow. Then pick one primary_risk so the work lands in a lab instead of a slide.',
    labs: [
      { id: 'llm03-3', label: 'llm03-3 Overpowered assistant' },
      { id: 'llm10-1', label: 'llm10-1 XSS output' },
    ],
  },
  {
    title: '4. Record the control you would ship',
    body: 'L0 is the failing test. L1 is cheap filters. L2 is Guardrails plus allowlists and approvals. Watch the same goal succeed at L0 and stall at L2.',
    labs: [
      { id: 'llm03-2', label: 'llm03-2 Allowlist / HITL' },
      { id: 'mcp01-1', label: 'mcp01-1 Token flood via MCP' },
    ],
  },
];

const STRIDE_ROWS = [
  { threat: 'Spoofing', where: 'hidden system prompt', lab: 'llm08-1' },
  { threat: 'Tampering', where: 'retrieved chunks', lab: 'llm09-1' },
  { threat: 'Repudiation', where: 'refund at L0 with no approval row', lab: 'llm03-1' },
  { threat: 'Disclosure', where: 'export_customer_data', lab: 'llm03-1' },
  { threat: 'Denial of service', where: 'token flood', lab: 'llm06-1' },
  { threat: 'Elevation', where: 'poisoned MCP description', lab: 'mcp03-1' },
];

const outboundButtonSx = {
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9375rem',
  borderRadius: '8px',
};

const Diagram = ({ src, alt }) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    sx={{ width: '100%', maxWidth: 720, display: 'block', mx: 'auto', my: 1 }}
  />
);

Diagram.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
};

const LabChip = ({ lab }) => (
  <Chip
    label={lab.label || lab.id}
    size="small"
    component={RouterLink}
    to={labPath(lab.id)}
    clickable
    sx={{ textDecoration: 'none' }}
  />
);

LabChip.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
  }).isRequired,
};

const ThreatModelingPage = () => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(false);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MODELS;
    return MODELS.filter((model) => (
      `${model.name} ${model.question} ${model.bullets.join(' ')}`
        .toLowerCase()
        .includes(needle)
    ));
  }, [query]);

  const jumpTo = (id) => {
    setOpenId(id);
    window.setTimeout(() => {
      document.getElementById(`tm-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <PageHeader
          icon={<ThreatModelIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
          title="Threat modeling for LLM systems"
          subtitle="Six ways to ask what can go wrong, then one pass over the AIGoat shop agent. Titles are upstream labels. The notes are AIGoat teaching commentary."
          actions={(
            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
              component={RouterLink}
              to="/owasp-top-10"
              sx={outboundButtonSx}
            >
              OWASP hub
            </Button>
          )}
        />

        <Box sx={{ mb: 4 }}>
          <SectionCard>
            <Diagram
              src="/media/diagrams/threat-model-loop.svg"
              alt="Name surfaces, name assets and trust boundaries, walk threats, then record a control."
            />
          </SectionCard>
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Start here: pick by the question you are answering
        </Typography>
        <Diagram
          src="/media/diagrams/framework-picker.svg"
          alt="Six threat models, each answering a different question."
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.25,
            mb: 4,
            mt: 1,
          }}
        >
          {MODELS.map((model) => (
            <Box
              key={model.id}
              role="button"
              tabIndex={0}
              onClick={() => jumpTo(model.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  jumpTo(model.id);
                }
              }}
              sx={{
                p: 1.5,
                borderRadius: '10px',
                cursor: 'pointer',
                border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                '&:hover': { borderColor: 'primary.main' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.5 }}>{model.name}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', lineHeight: 1.45 }}>
                {model.question}
              </Typography>
            </Box>
          ))}
        </Box>

        <TextField
          size="small"
          fullWidth
          placeholder="Filter models by name or question"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 2 }}
        />

        {!filtered.length && (
          <EmptyState
            title="No models match"
            description="Try a different filter, or clear the search to see all six models."
          />
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 5 }}>
          {filtered.map((model) => (
            <Accordion
              key={model.id}
              id={`tm-${model.id}`}
              disableGutters
              expanded={openId === model.id}
              onChange={(_, isOpen) => setOpenId(isOpen ? model.id : false)}
              sx={{
                borderRadius: '10px !important',
                overflow: 'hidden',
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{model.name}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>{model.question}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
                  {model.bullets.map((bullet) => (
                    <Typography key={bullet} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                      {bullet}
                    </Typography>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                  {model.surfaces.map((surface) => (
                    <Chip key={surface} label={surface} size="small" />
                  ))}
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<ExternalIcon sx={{ fontSize: '0.9375rem !important' }} />}
                  href={model.official}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    ...outboundButtonSx,
                    borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                    color: (t) => t.palette.custom?.text?.accent ?? 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: (t) => t.palette.custom?.overlay?.active ?? alpha(t.palette.primary.main, 0.06),
                    },
                  }}
                >
                  Official source
                </Button>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        <SectionCard title="Worked example: refund someone else's order">
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.65, mb: 2, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
            Refund someone else's order without standing at the till. One sentence. The model is four surfaces, a handful of tools, and a defense toggle.
          </Typography>
          <Diagram
            src="/media/diagrams/aigoat-surfaces.svg"
            alt="Browser, FastAPI, four live surfaces, Ollama, Chroma, SQLite, and MCP children, with trust boundaries drawn."
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 3 }}>
            {EXAMPLE_STEPS.map((step) => (
              <Box key={step.title}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>{step.title}</Typography>
                <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 1, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
                  {step.body}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {step.labs.map((lab) => <LabChip key={lab.id} lab={lab} />)}
                </Box>
              </Box>
            ))}
          </Box>
          <Diagram
            src="/media/diagrams/stride-shop-agent.svg"
            alt="STRIDE letters mapped onto the shop-agent refund path with lab ids."
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, mb: 3 }}>
            {STRIDE_ROWS.map((row) => (
              <Box key={row.threat} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', minWidth: 130 }}>{row.threat}</Typography>
                <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary' }}>{row.where}</Typography>
                <LabChip lab={{ id: row.lab, label: row.lab }} />
              </Box>
            ))}
          </Box>
          <SectionCard tone="info" title="What a real shop would ship" dense>
            <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Pin tools, scan memory, require approval on refunds and exports, and never render model HTML.
            </Typography>
          </SectionCard>
        </SectionCard>
      </Container>
    </Box>
  );
};

export default ThreatModelingPage;
