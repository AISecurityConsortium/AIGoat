import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import CodeBlock from './CodeBlock';
import EmptyState from './EmptyState';

/**
 * @typedef TranscriptViewerProps
 * @property {Array<Object>} [events]
 * @property {string} [emptyDescription]
 */

const pretty = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const TranscriptViewer = ({ events = [], emptyDescription = 'No transcript events yet.' }) => {
  if (!events.length) {
    return <EmptyState title="No transcript" description={emptyDescription} />;
  }
  return (
    <Box>
      {events.map((event, idx) => (
        <Box key={`${event.seq ?? idx}-${event.ts ?? idx}`} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
            {event.type || 'event'}
            {event.seq != null ? ` #${event.seq}` : ''}
          </Typography>
          <CodeBlock code={pretty(event)} language="json" maxLines={10} />
        </Box>
      ))}
    </Box>
  );
};

TranscriptViewer.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object),
  emptyDescription: PropTypes.string,
};

export default TranscriptViewer;
