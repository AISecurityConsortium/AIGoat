import React from 'react';
import { Container, Typography, Box, Chip, Button, Alert, Skeleton, Breadcrumbs, Link } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useRisk } from '../hooks/useFrameworks';
import { RiskChip, EmptyState } from './common';
import HubHero from './common/HubHero';
import HubRail, { RailPanel } from './common/HubRail';
import { chipSx, inset, meta, panel, sectionTitle } from './common/panelStyles';
import { FRAMEWORK_SHORT_LABELS } from '../utils/frameworkOrder';
import { attacksRiskPath, attacksSurfacePath, challengePath, labPath } from '../utils/taxonomyLinks';
import { PRACTICE_LABS } from '../utils/labTeaching';


const Stat = ({ value, label }) => (
  <Box sx={{ ...inset, flex: '1 1 0', minWidth: 0, p: 1.25, textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.1 }}>{value}</Typography>
    <Typography sx={{ ...meta, mt: 0.25 }}>{label}</Typography>
  </Box>
);

const Row = ({ to, title, detail = '', action }) => (
  <Box
    component={RouterLink}
    to={to}
    sx={{
      ...inset,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 1,
      textDecoration: 'none',
      color: 'text.primary',
      '&:hover': { borderColor: 'primary.main' },
      '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
    }}
  >
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{title}</Typography>
      {detail && <Typography sx={meta}>{detail}</Typography>}
    </Box>
    <Typography component="span" sx={{ color: 'primary.light', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {action} →
    </Typography>
  </Box>
);

const Empty = ({ children }) => (
  <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>{children}</Typography>
);

const Block = ({ title, children }) => (
  <Box component="section" aria-label={title} sx={{ ...panel, p: 2 }}>
    <Typography component="h2" sx={{ ...sectionTitle, mb: 1 }}>{title}</Typography>
    {children}
  </Box>
);

const RiskDetailPage = () => {
  const { frameworkId, riskCode } = useParams();
  const navigate = useNavigate();
  const riskId = frameworkId && riskCode ? `${frameworkId}:${riskCode}` : null;
  const { risk, loading, error, refetch } = useRisk(riskId);

  if (loading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 2 }}>
        <Container maxWidth="xl">
          <Skeleton variant="text" width={240} height={28} />
          <Skeleton variant="rounded" height={64} sx={{ mt: 2 }} />
          <Skeleton variant="rounded" height={160} sx={{ mt: 2 }} />
        </Container>
      </Box>
    );
  }

  if (error || !risk) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 2 }}>
        <Container maxWidth="xl">
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
            sx={{ mb: 2 }}
          >
            Could not load this risk.
          </Alert>
          <EmptyState
            title="Risk not found"
            description="This identifier is not in the loaded taxonomies."
            action={<Button onClick={() => navigate('/owasp-top-10')}>Back to frameworks</Button>}
          />
        </Container>
      </Box>
    );
  }

  const labs = risk.labs || [];
  const challenges = risk.challenges || [];
  const surfaces = risk.attack_surfaces || [];
  const related = risk.related_risks || [];
  const practice = PRACTICE_LABS[risk.id] || [];
  const frameworkLabel = FRAMEWORK_SHORT_LABELS[frameworkId] || frameworkId;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 2 }}>
      <Container maxWidth="xl">
        <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
          <Breadcrumbs sx={{ mb: 1.5, fontSize: '0.9375rem' }}>
            <Link component={RouterLink} to="/owasp-top-10" underline="hover" color="inherit">
              Frameworks
            </Link>
            <Link
              component={RouterLink}
              to={`/owasp-top-10?framework=${encodeURIComponent(frameworkId)}`}
              underline="hover"
              color="inherit"
            >
              {frameworkLabel}
            </Link>
            <Typography color="text.primary" sx={{ fontSize: '0.9375rem' }}>{risk.code}</Typography>
          </Breadcrumbs>

          <HubHero
            eyebrow={`${frameworkLabel} risk`}
            title={`${risk.code} ${risk.title}`}
            description={risk.summary}
            actions={(
              <>
                {labs.length > 0 && (
                  <Button
                    variant="contained"
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                    onClick={() => navigate(attacksRiskPath(frameworkId, risk.code))}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Try in Attack Lab
                  </Button>
                )}
                <Button
                  component={RouterLink}
                  to={`/owasp-top-10?framework=${encodeURIComponent(frameworkId)}`}
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Back to {frameworkLabel}
                </Button>
              </>
            )}
            aside={(
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', maxWidth: 420, mx: { md: 'auto' } }}>
                <Stat value={labs.length} label={labs.length === 1 ? 'lab' : 'labs'} />
                <Stat value={challenges.length} label={challenges.length === 1 ? 'challenge' : 'challenges'} />
                <Stat value={surfaces.length} label={surfaces.length === 1 ? 'attack surface' : 'attack surfaces'} />
              </Box>
            )}
          />

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              alignItems: 'start',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(300px, 3fr)', lg: 'minmax(0, 7fr) minmax(340px, 3fr)' },
            }}
          >
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Block title="Description">
                <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
                  {risk.description}
                </Typography>
              </Block>

              {risk.writeup && (
                <Block title="How this works">
                  <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.7, whiteSpace: 'pre-line', mb: practice.length ? 1.5 : 0 }}>
                    {risk.writeup}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {practice.map((lab) => (
                      <Button
                        key={lab.id}
                        component={RouterLink}
                        to={labPath(lab.id)}
                        variant="contained"
                        size="small"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        {lab.label}
                      </Button>
                    ))}
                  </Box>
                </Block>
              )}

              <Block title="Labs that teach this">
                {labs.length === 0 ? (
                  <Empty>No labs mapped to this risk yet.</Empty>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {labs.map((lab) => (
                      <Row key={lab.id} to={labPath(lab)} title={lab.name} detail={lab.surface} action="Open lab" />
                    ))}
                  </Box>
                )}
              </Block>

              <Block title="Challenges">
                {challenges.length === 0 ? (
                  <Empty>No challenges mapped to this risk yet.</Empty>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {challenges.map((challenge) => (
                      <Row key={challenge.id} to={challengePath(challenge.id)} title={challenge.title} action="Open challenge" />
                    ))}
                  </Box>
                )}
              </Block>
            </Box>

            <HubRail label="Risk context">
              <RailPanel title="Attack surfaces">
                {surfaces.length === 0 ? (
                  <Empty>No attack surfaces recorded.</Empty>
                ) : (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                    {surfaces.map((surface) => (
                      <Chip
                        key={surface}
                        label={surface}
                        size="small"
                        component={RouterLink}
                        to={attacksSurfacePath(surface)}
                        clickable
                        sx={{ ...chipSx, textDecoration: 'none' }}
                      />
                    ))}
                  </Box>
                )}
              </RailPanel>

              <RailPanel title="Related risks">
                {related.length === 0 ? (
                  <Empty>No cross-framework relatives recorded.</Empty>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.75 }}>
                    {related.map((item) => {
                      const [relFw, relCode] = item.id.split(':');
                      return (
                        <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <RiskChip
                            code={item.code}
                            framework={item.framework_name}
                            onClick={() => navigate(`/owasp-top-10/${relFw}/${relCode}`)}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.title}</Typography>
                            <Typography sx={meta}>{item.framework_name}</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </RailPanel>
            </HubRail>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default RiskDetailPage;
