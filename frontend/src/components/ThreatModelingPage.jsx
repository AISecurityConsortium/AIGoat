import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Container, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import HubHero from './common/HubHero';
import SectionCard from './common/SectionCard';
import IntroSection from './threatModeling/IntroSection';
import ArchitectureSection from './threatModeling/ArchitectureSection';
import FrameworkExplorer from './threatModeling/FrameworkExplorer';
import FrameworkMatrix from './threatModeling/FrameworkMatrix';
import SelectionGuide from './threatModeling/SelectionGuide';
import ScenarioWorkbench from './threatModeling/ScenarioWorkbench';
import WhyItMatters from './threatModeling/WhyItMatters';
import References from './threatModeling/References';
import SectionNav from './threatModeling/SectionNav';

export const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'frameworks', label: 'Frameworks' },
  { id: 'selection', label: 'Which to use' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'why', label: 'Why it matters' },
  { id: 'references', label: 'References' },
];

const HERO_FLOW = {
  caption: 'The page follows this path. Each stop is a section below.',
  steps: [
    { title: 'Architecture', detail: 'zones, flows, surfaces' },
    { title: 'Frameworks', detail: 'pick one per question', accent: true },
    { title: 'Scenarios', detail: 'six worked examples' },
    { title: 'Mitigations', detail: 'what to do about it', warn: true },
  ],
};

const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const Section = ({ id, title, subtitle, children }) => (
  <Box component="section" id={id} aria-labelledby={`${id}-title`} sx={{ mb: 5, scrollMarginTop: 120 }}>
    <Typography id={`${id}-title`} component="h2" sx={{ fontWeight: 800, fontSize: { xs: '1.375rem', md: '1.625rem' }, letterSpacing: '-0.02em', mb: 0.5 }}>
      {title}
    </Typography>
    {subtitle && <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 2, maxWidth: 820 }}>{subtitle}</Typography>}
    <SectionCard>{children}</SectionCard>
  </Box>
);

Section.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
};

const ThreatModelingPage = () => {
  const [focusRequest, setFocusRequest] = useState(null);

  // A scenario asks the diagram to show one component.
  const openComponent = useCallback((id) => {
    setFocusRequest((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
    const el = document.getElementById('architecture');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        <HubHero
          eyebrow="Threat modeling"
          title="Threat modeling for LLM systems"
          description="An interactive workbench built on AIGoat's real architecture: see the system, choose a framework for the question, and work six scenarios across several methods."
          flow={HERO_FLOW}
          actions={(
            <>
              <Button
                variant="contained"
                size="small"
                endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                onClick={() => scrollToSection('architecture')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                View the architecture
              </Button>
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                component={RouterLink}
                to="/owasp-top-10"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                OWASP hub
              </Button>
            </>
          )}
        />

        <SectionNav sections={SECTIONS} />

        <Section id="intro" title="Start here">
          <IntroSection />
        </Section>

        <Section
          id="architecture"
          title="AIGoat architecture"
          subtitle="One diagram of the whole system: trust zones, directional flows, boundary crossings and attack surfaces. Components that are not in the repo are not drawn."
        >
          <ArchitectureSection focusRequest={focusRequest} />
        </Section>

        <Section
          id="frameworks"
          title="Frameworks and resources"
          subtitle="Methods, AI security frameworks, attack knowledge bases, vulnerability taxonomies and risk management. They answer different questions, so they are grouped by what they are."
        >
          <FrameworkExplorer />
          <Box sx={{ mt: 3 }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.0625rem', mb: 1.5 }}>Comparison matrix</Typography>
            <FrameworkMatrix />
          </Box>
        </Section>

        <Section id="selection" title="Which framework should I use?" subtitle="Start from the question you are asking, not from the framework name.">
          <SelectionGuide />
        </Section>

        <Section id="scenarios" title="Scenario deep dives" subtitle="The same system, six situations. Open each group to see the attack path, the framework lenses, the risk rationale and the mitigations.">
          <ScenarioWorkbench onOpenComponent={openComponent} />
        </Section>

        <Section id="why" title="Why AI threat modeling matters">
          <WhyItMatters />
        </Section>

        <Section id="references" title="References">
          <References />
        </Section>
      </Container>
    </Box>
  );
};

export default ThreatModelingPage;
