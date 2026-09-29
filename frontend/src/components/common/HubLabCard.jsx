import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import SectionCard from './SectionCard';
import RiskChip from './RiskChip';
import DifficultyChip from './DifficultyChip';
import { LAB_SERIES, doneWhen, openLabel } from '../../utils/labTeaching';

const oneLine = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';

const HubLabCard = ({ lab, index }) => {
  const code = (lab.primary_risk || '').includes(':')
    ? lab.primary_risk.split(':').slice(1).join(':')
    : (lab.owasp || '');
  const series = LAB_SERIES[lab.id];
  const done = doneWhen(lab);
  return (
    <SectionCard dense>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
          {index}. {lab.name}
        </Typography>
        {code && <RiskChip code={code} />}
        {lab.difficulty && <DifficultyChip difficulty={lab.difficulty} />}
      </Box>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', lineHeight: 1.5, mb: series || done ? 1 : 1.5 }}>
        {oneLine(lab.objective) || lab.description}
      </Typography>
      {series && (
        <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.5, mb: 1 }}>
          {series}
        </Typography>
      )}
      {done && (
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.5, mb: 1.5 }}>
          Done when: {done}
        </Typography>
      )}
      <Button
        component={RouterLink}
        to={`/labs/${lab.id}`}
        size="small"
        variant="outlined"
        endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        {openLabel(lab)}
      </Button>
    </SectionCard>
  );
};

HubLabCard.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    primary_risk: PropTypes.string,
    owasp: PropTypes.string,
    difficulty: PropTypes.string,
    objective: PropTypes.string,
    description: PropTypes.string,
    surface: PropTypes.string,
    expected_by_level: PropTypes.objectOf(PropTypes.string),
  }).isRequired,
  index: PropTypes.number.isRequired,
};

export default HubLabCard;
