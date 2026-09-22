import React from 'react';
import { Container, Typography, Box, Chip, Button, Alert, Skeleton, Breadcrumbs, Link } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useRisk } from '../hooks/useFrameworks';
import { PageHeader, SectionCard, RiskChip, EmptyState } from './common';
import { attacksRiskPath, attacksSurfacePath, challengePath, labPath } from '../utils/taxonomyLinks';

const RiskDetailPage = () => {
  const { frameworkId, riskCode } = useParams();
  const navigate = useNavigate();
  const riskId = frameworkId && riskCode ? `${frameworkId}:${riskCode}` : null;
  const { risk, loading, error, refetch } = useRisk(riskId);

  if (loading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
          <Skeleton variant="text" width={240} height={28} />
          <Skeleton variant="rounded" height={64} sx={{ mt: 2 }} />
          <Skeleton variant="rounded" height={160} sx={{ mt: 2 }} />
        </Container>
      </Box>
    );
  }

  if (error || !risk) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
        <Container maxWidth="md">
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

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <Breadcrumbs sx={{ mb: 2, fontSize: '0.9375rem' }}>
          <Link component={RouterLink} to="/owasp-top-10" underline="hover" color="inherit">
            Frameworks
          </Link>
          <Link
            component={RouterLink}
            to={`/owasp-top-10?framework=${encodeURIComponent(frameworkId)}`}
            underline="hover"
            color="inherit"
          >
            {frameworkId}
          </Link>
          <Typography color="text.primary" sx={{ fontSize: '0.9375rem' }}>{risk.code}</Typography>
        </Breadcrumbs>

        <PageHeader
          title={`${risk.code} ${risk.title}`}
          subtitle={risk.summary}
          actions={
            (risk.labs || []).length > 0 ? (
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                onClick={() => navigate(attacksRiskPath(frameworkId, risk.code))}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
              >
                Try in Attack Lab
              </Button>
            ) : null
          }
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SectionCard title="Description">
            <Typography sx={{ fontSize: '1rem', lineHeight: 1.7, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
              {risk.description}
            </Typography>
          </SectionCard>

          <SectionCard title="Attack surfaces">
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
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
          </SectionCard>

          <SectionCard title="Labs that teach this">
            {(risk.labs || []).length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                No labs mapped to this risk yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {risk.labs.map((lab) => (
                  <Button
                    key={lab.id}
                    component={RouterLink}
                    to={labPath(lab)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    {lab.name}
                  </Button>
                ))}
              </Box>
            )}
          </SectionCard>

          <SectionCard title="Challenges">
            {(risk.challenges || []).length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                No challenges mapped to this risk yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {risk.challenges.map((challenge) => (
                  <Button
                    key={challenge.id}
                    component={RouterLink}
                    to={challengePath(challenge.id)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    {challenge.title}
                  </Button>
                ))}
              </Box>
            )}
          </SectionCard>

          <SectionCard title="Related risks">
            {(risk.related_risks || []).length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                No cross-framework relatives recorded.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {risk.related_risks.map((related) => {
                  const [relFw, relCode] = related.id.split(':');
                  return (
                    <Box key={related.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <RiskChip
                        code={related.code}
                        framework={related.framework_name}
                        onClick={() => navigate(`/owasp-top-10/${relFw}/${relCode}`)}
                      />
                      <Box>
                        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{related.title}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                          {related.framework_name}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Box>
      </Container>
    </Box>
  );
};

export default RiskDetailPage;
