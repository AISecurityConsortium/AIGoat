import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@mui/material';
import HubHero from '../common/HubHero';
import { RAG_FLOWS, RAG_STEPS } from '../../utils/labTeaching';

export const RAG_DESCRIPTION = 'RAG (Retrieval-Augmented Generation) Knowledge base attack surface for AI Goat Shop';

/** Hub-style hero, shared with the MCP and Agentic landing pages. */
const RagHero = ({ onAddDocument, onRunTrace, onShowLabs }) => (
  <HubHero
    eyebrow="Retrieval security"
    title="RAG"
    description={RAG_DESCRIPTION}
    steps={RAG_STEPS}
    flow={RAG_FLOWS.hub}
    actions={(
      <>
        <Button variant="contained" size="small" onClick={onAddDocument} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Add a document
        </Button>
        <Button variant="outlined" size="small" onClick={onRunTrace} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Run a retrieval trace
        </Button>
        <Button variant="outlined" size="small" onClick={onShowLabs} sx={{ textTransform: 'none', fontWeight: 600 }}>
          RAG labs on this page
        </Button>
      </>
    )}
  />
);

RagHero.propTypes = {
  onAddDocument: PropTypes.func.isRequired,
  onRunTrace: PropTypes.func.isRequired,
  onShowLabs: PropTypes.func.isRequired,
};

export default RagHero;
