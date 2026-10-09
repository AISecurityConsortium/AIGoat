import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import LabHeader from '../common/LabHeader';
import Disclosure from '../common/Disclosure';
import RelatedMap from '../common/RelatedMap';
import { labChipLabel } from '../../utils/labTeaching';
import { inset, meta, mono } from './ragStyles';

const oneLine = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).join(' ');

/** Lab context at the top of the workbench panel: objective, starting points, related risks. */
const RagLabIntro = ({ lab }) => {
  const payloads = Array.isArray(lab.example_payloads) ? lab.example_payloads : [];
  return (
    <Box sx={{ mb: 1.5 }}>
      <LabHeader
        lab={lab}
        objective={oneLine(lab.objective) || lab.description || ''}
        labelFor={labChipLabel}
        showDifficulty
      />
      {payloads.length > 0 && (
        <Disclosure title="Starting points" meta={`${payloads.length} example${payloads.length === 1 ? '' : 's'}`} sx={{ mt: 1.25 }}>
          <Typography sx={{ ...meta, mb: 0.75 }}>
            Adapt these to the documents you write. They are a start, not the only way in.
          </Typography>
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {payloads.map((payload) => (
              <Box component="li" key={payload} sx={{ ...inset, p: 1 }}>
                <Typography sx={{ ...mono, fontSize: '0.78rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {String(payload).trim()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Disclosure>
      )}
      <Box sx={{ mt: 1.25 }}>
        <RelatedMap dense relatedLabIds={lab.related_lab_ids || []} />
      </Box>
    </Box>
  );
};

RagLabIntro.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    objective: PropTypes.string,
    description: PropTypes.string,
    surface: PropTypes.string,
    risks: PropTypes.arrayOf(PropTypes.string),
    related_lab_ids: PropTypes.arrayOf(PropTypes.string),
    example_payloads: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
};

export default RagLabIntro;
