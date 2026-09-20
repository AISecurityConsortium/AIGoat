import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Chip, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { attacksSurfacePath, labPath, riskPath } from '../../utils/taxonomyLinks';
import RiskChip from './RiskChip';

/**
 * @typedef RelatedMapProps
 * @property {string[]} [risks]
 * @property {string} [surface]
 * @property {Array<{id: string, name?: string, surface?: string}>|string[]} [labs]
 * @property {string[]} [relatedLabIds]
 * @property {boolean} [dense]
 */

const RelatedMap = ({ risks = [], surface, labs = [], relatedLabIds = [], dense = false }) => {
  const navigate = useNavigate();
  const labItems = labs.length
    ? labs
    : relatedLabIds.map((id) => ({ id }));
  const hasRisks = risks.length > 0;
  const hasLabs = labItems.length > 0;
  const hasSurface = Boolean(surface);
  if (!hasRisks && !hasLabs && !hasSurface) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: dense ? 0 : 2 }}>
      {hasRisks && (
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}>
            Risks
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {risks.map((qualified) => {
              const code = String(qualified).includes(':') ? String(qualified).split(':').slice(1).join(':') : qualified;
              const fw = String(qualified).includes(':') ? String(qualified).split(':')[0] : undefined;
              return (
                <RiskChip
                  key={qualified}
                  code={code}
                  framework={fw}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(riskPath(qualified));
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}
      {hasSurface && (
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}>
            Surface
          </Typography>
          <Chip
            component={RouterLink}
            to={attacksSurfacePath(surface)}
            label={surface}
            size="small"
            clickable
            sx={{ textDecoration: 'none' }}
          />
        </Box>
      )}
      {hasLabs && (
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}>
            Related labs
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
            {labItems.map((item) => {
              const id = typeof item === 'string' ? item : item.id;
              const name = typeof item === 'string' ? item : (item.name || item.id);
              return (
                <Button
                  key={id}
                  component={RouterLink}
                  to={labPath(item)}
                  size="small"
                  sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                >
                  {name}
                </Button>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

RelatedMap.propTypes = {
  risks: PropTypes.arrayOf(PropTypes.string),
  surface: PropTypes.string,
  labs: PropTypes.array,
  relatedLabIds: PropTypes.arrayOf(PropTypes.string),
  dense: PropTypes.bool,
};

export default RelatedMap;
