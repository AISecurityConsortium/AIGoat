import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, IconButton, Tooltip, Typography, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ContentCopy as CopyIcon } from '@mui/icons-material';

/**
 * @typedef CodeBlockProps
 * @property {string} code
 * @property {string} [language]
 * @property {boolean} [copyable]
 * @property {number} [maxLines]
 * @property {function} [onCopy]
 */

const CodeBlock = ({ code, language, copyable = true, maxLines, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lines = (code || '').split('\n');
  const collapsed = Boolean(maxLines) && lines.length > maxLines && !expanded;
  const display = collapsed ? lines.slice(0, maxLines).join('\n') : code;

  const handleCopy = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (onCopy) onCopy(code);
  }, [code, onCopy]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.25 : 0.04),
          borderRadius: '8px',
          p: 1.5,
          border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
        }}
      >
        <Typography
          component="pre"
          sx={{
            color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
            fontSize: '0.82rem',
            flex: 1,
            fontFamily: 'monospace',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            m: 0,
          }}
        >
          {display}
        </Typography>
        {copyable && (
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label={`Copy ${language || 'code'}`}
              sx={{
                color: copied ? 'secondary.main' : (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                flexShrink: 0,
              }}
            >
              <CopyIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {Boolean(maxLines) && lines.length > maxLines && (
        <Button
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ mt: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Box>
  );
};

CodeBlock.propTypes = {
  code: PropTypes.string.isRequired,
  language: PropTypes.string,
  copyable: PropTypes.bool,
  maxLines: PropTypes.number,
  onCopy: PropTypes.func,
};

export default CodeBlock;
