import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PerimeterTrace from './PerimeterTrace';
import DifficultyChip from './DifficultyChip';

/**
 * Lab page header shared by the MCP and Agentic tracks: id and title, completion and
 * risk chips, the optional series line with a Next link, and the Objective box.
 */
const plainLabel = (id) => id;

const LabHeader = ({
  lab, goalMet = false, objective = '', series = undefined, labelFor = plainLabel, showDifficulty = false,
}) => {
  const seriesIndex = series ? series.labs.indexOf(lab.id) : -1;
  const seriesNext = series && seriesIndex >= 0 ? series.labs[seriesIndex + 1] : '';
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, flex: '1 1 auto', minWidth: 0 }}>
          <Box component="span" sx={{ color: 'primary.light', mr: 1 }}>{String(lab.id).toUpperCase()}</Box>
          {String(lab.name || '').replace(/^[A-Za-z]+\d+\s*[-–]\s*/, '')}
        </Typography>
        {goalMet && (
          <Chip label="Lab complete" size="small" color="success" variant="outlined" sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.72rem', fontWeight: 700 } }} />
        )}
        {showDifficulty && lab.difficulty && <DifficultyChip difficulty={lab.difficulty} />}
        {(lab.risks || []).length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mr: 0.25 }}>Risks</Typography>
            {lab.risks.map((risk) => (
              <Chip
                key={risk}
                label={String(risk).split(':').pop()}
                size="small"
                variant="outlined"
                sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } }}
              />
            ))}
          </Box>
        )}
      </Box>
      {series && seriesIndex >= 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {`${series.label} series · Step ${seriesIndex + 1} of ${series.labs.length}: ${series.steps[lab.id]}`}
          </Typography>
          {seriesNext && (
            <Button
              component={RouterLink}
              to={`/labs/${seriesNext}`}
              size="small"
              sx={{ textTransform: 'none', fontSize: '0.78rem', py: 0, minHeight: 0 }}
            >
              {`Next: ${labelFor(seriesNext)} ${series.steps[seriesNext]} →`}
            </Button>
          )}
        </Box>
      )}
      <Box
        sx={{
          position: 'relative',
          mt: 1.25,
          px: 1.5,
          py: 1,
          borderRadius: '8px',
          border: (t) => `1px solid ${goalMet ? alpha(t.palette.success.main, 0.5) : alpha(t.palette.primary.light, 0.22)}`,
          bgcolor: (t) => alpha(goalMet ? t.palette.success.main : t.palette.primary.main, 0.05),
        }}
      >
        {!goalMet && <PerimeterTrace radius={8} />}
        <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Objective
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.5, mt: 0.25 }}>{objective}</Typography>
      </Box>
    </Box>
  );
};

LabHeader.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    difficulty: PropTypes.string,
    risks: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  goalMet: PropTypes.bool,
  objective: PropTypes.string,
  series: PropTypes.shape({
    label: PropTypes.string,
    labs: PropTypes.arrayOf(PropTypes.string),
    steps: PropTypes.objectOf(PropTypes.string),
  }),
  labelFor: PropTypes.func,
  showDifficulty: PropTypes.bool,
};

export default LabHeader;
