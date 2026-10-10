import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Chip, Typography } from '@mui/material';
import { OpenInNew as ExternalIcon } from '@mui/icons-material';
import {
  AIX_CONTROLS,
  FRAMEWORKS,
  FRAMEWORK_CATEGORIES,
  SAIF_AGENT_COMPONENTS,
  SAIF_COMPONENT_AREAS,
  SAIF_ELEMENTS,
} from '../../data/threatModeling/frameworks';
import { Body, SubHeading } from './labels';

const ExternalLink = ({ href, children }) => (
  <Button
    size="small"
    variant="outlined"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    endIcon={<ExternalIcon sx={{ fontSize: '0.9rem !important' }} />}
    sx={{ textTransform: 'none', borderRadius: '8px' }}
  >
    {children}
  </Button>
);
ExternalLink.propTypes = { href: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

const List = ({ items }) => (
  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
    {items.map((i) => <Typography key={i} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55, mb: 0.25 }}>{i}</Typography>)}
  </Box>
);
List.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired };

const Field = ({ title, children }) => (
  <Box sx={{ mb: 1.5 }}>
    <SubHeading>{title}</SubHeading>
    {typeof children === 'string' ? <Body>{children}</Body> : children}
  </Box>
);
Field.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

const SaifExtra = () => (
  <Box data-testid="saif-extra" sx={{ mt: 2, p: 2, borderRadius: '10px', border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}` }}>
    <Typography component="h4" sx={{ fontWeight: 700, mb: 1 }}>SAIF at a glance</Typography>
    <Body sx={{ mb: 1.5 }}>
      SAIF is an AI security framework and risk-to-control resource. It does not replace STRIDE, PASTA, LINDDUN or attack trees. Use those to find threats in your design, then use SAIF to place each AI risk in a component and choose candidate controls.
    </Body>
    <Field title="Six core elements (from Google's original SAIF overview)">
      <List items={SAIF_ELEMENTS} />
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.5 }}>
        These are not chronological steps. The SAIF Map, risks, controls and agent resources are the more detailed material built around the same framework, and the controls align with these six elements.
      </Typography>
    </Field>
    <Field title="SAIF Map: four component areas">
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {SAIF_COMPONENT_AREAS.map((a) => (
          <Typography key={a.area} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>
            <strong>{a.area}</strong>: {a.components.join(', ')}
          </Typography>
        ))}
      </Box>
    </Field>
    <Field title="Agent extension (SAIF: focus on agents)">
      <List items={SAIF_AGENT_COMPONENTS} />
    </Field>
    <Field title="Who it is for">
      <Body>Model creators (who train or tune models), model consumers (who build applications on models), or both. Each SAIF risk says which party can mitigate it. AIGoat is a model consumer.</Body>
    </Field>
  </Box>
);

const AixExtra = () => (
  <Box data-testid="aix-extra" sx={{ mt: 2, p: 2, borderRadius: '10px', border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}` }}>
    <Typography component="h4" sx={{ fontWeight: 700, mb: 1 }}>OWASP AI Exchange at a glance</Typography>
    <Body sx={{ mb: 1.5 }}>
      The AI Exchange is a broad AI security and privacy knowledge resource: threats, controls, testing and privacy guidance. It is not a component-level threat modeling methodology like STRIDE or attack trees, and it is wider than the LLM and agentic Top 10 lists. It does include a risk analysis section to help select the threats and controls that apply. This page does not prescribe an Exchange-specific process beyond what the source states.
    </Body>
    <Field title="Main sections (as titled on owaspai.org)">
      <List items={['AI security overview, including the threat map, agentic AI overview, RAG systems overview and risk analysis', 'General controls', 'Development-time threats', 'Runtime application security threats', 'AI security testing', 'AI privacy']} />
    </Field>
    <Field title="Control names seen in the checked pages (examples)">
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {AIX_CONTROLS.slice(0, 12).map((c) => <Chip key={c} size="small" variant="outlined" label={c} />)}
      </Box>
    </Field>
    <Field title="Who it is for">
      <Body>AI system architects, developers, security practitioners and risk owners who need practical threat and control guidance for AI and data-centric systems.</Body>
    </Field>
  </Box>
);

const FrameworkDetail = ({ framework }) => {
  const category = FRAMEWORK_CATEGORIES[framework.category];
  return (
    <Box
      data-testid="framework-detail"
      sx={{
        mt: 2,
        p: { xs: 2, md: 2.5 },
        borderRadius: '12px',
        border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
        bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
      }}
    >
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>{framework.name}</Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', my: 1 }}>
        <Chip size="small" color="primary" variant="outlined" label={category.label} />
        <Chip size="small" variant="outlined" label={framework.publisher} />
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>{framework.version}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3 }}>
        <Box>
          <Field title="Purpose">{framework.purpose}</Field>
          <Field title="Best time to use">{framework.bestTime}</Field>
          <Field title="Scope">{framework.scope}</Field>
          <Field title="What it finds">{framework.threatsFound}</Field>
        </Box>
        <Box>
          <Field title="Strengths"><List items={framework.strengths} /></Field>
          <Field title="Limits"><List items={framework.limits} /></Field>
          <Field title="AIGoat example (teaching commentary)">{framework.aigoatExample}</Field>
        </Box>
      </Box>
      {framework.id === 'saif' && <SaifExtra />}
      {framework.id === 'owasp-ai-exchange' && <AixExtra />}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
        <ExternalLink href={framework.url}>{framework.urlLabel}</ExternalLink>
        {(framework.extraLinks || []).map((l) => <ExternalLink key={l.url} href={l.url}>{l.label}</ExternalLink>)}
      </Box>
    </Box>
  );
};
FrameworkDetail.propTypes = { framework: PropTypes.object.isRequired };

const FrameworkExplorer = () => {
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const visible = FRAMEWORKS.filter((f) => category === 'all' || f.category === category);
  const selected = FRAMEWORKS.find((f) => f.id === selectedId && visible.includes(f)) || null;

  return (
    <Box>
      <Box role="group" aria-label="Filter frameworks by category" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
        <Chip
          label="All"
          clickable
          color={category === 'all' ? 'primary' : 'default'}
          variant={category === 'all' ? 'filled' : 'outlined'}
          onClick={() => setCategory('all')}
          data-testid="category-all"
          aria-pressed={category === 'all'}
        />
        {Object.entries(FRAMEWORK_CATEGORIES).map(([key, cat]) => (
          <Chip
            key={key}
            label={cat.label}
            clickable
            color={category === key ? 'primary' : 'default'}
            variant={category === key ? 'filled' : 'outlined'}
            onClick={() => setCategory(key)}
            data-testid={`category-${key}`}
            aria-pressed={category === key}
          />
        ))}
      </Box>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 2 }} data-testid="category-description">
        {category === 'all' ? 'The categories differ on purpose: a taxonomy is not a method, and a knowledge base is not a control set.' : FRAMEWORK_CATEGORIES[category].description}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
        {visible.map((f) => (
          <Box
            key={f.id}
            component="button"
            type="button"
            onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
            aria-pressed={selectedId === f.id}
            data-testid={`framework-card-${f.id}`}
            sx={{
              textAlign: 'left',
              p: 1.5,
              borderRadius: '10px',
              cursor: 'pointer',
              font: 'inherit',
              color: 'text.primary',
              bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
              border: (t) => `${selectedId === f.id ? 2 : 1}px solid ${selectedId === f.id ? t.palette.primary.main : (t.palette.custom?.border?.medium ?? t.palette.divider)}`,
              '&:hover': { borderColor: 'primary.main' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.5 }}>{f.name}</Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'primary.main', mb: 0.75 }}>
              {FRAMEWORK_CATEGORIES[f.category].label}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.45 }}>{f.bestTime}</Typography>
          </Box>
        ))}
      </Box>

      {selected && <FrameworkDetail framework={selected} />}
    </Box>
  );
};

export default FrameworkExplorer;
