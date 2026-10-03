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

const JSON_TOKEN = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g;

const highlightJson = (text) => {
  const parts = [];
  let last = 0;
  JSON_TOKEN.lastIndex = 0;
  let match = JSON_TOKEN.exec(text);
  while (match) {
    if (match.index > last) {
      parts.push({ type: 'plain', text: text.slice(last, match.index) });
    }
    const raw = match[0];
    let type = 'punct';
    if (raw.startsWith('"')) {
      type = /^\s*:/.test(text.slice(JSON_TOKEN.lastIndex)) ? 'key' : 'string';
    } else if (raw === 'true' || raw === 'false' || raw === 'null') {
      type = 'literal';
    } else if (raw === '-' || /^-?\d/.test(raw)) {
      type = 'number';
    }
    parts.push({ type, text: raw });
    last = JSON_TOKEN.lastIndex;
    match = JSON_TOKEN.exec(text);
  }
  if (last < text.length) parts.push({ type: 'plain', text: text.slice(last) });
  return parts;
};

const jsonColor = (theme, type) => {
  const dark = theme.palette.mode === 'dark';
  if (type === 'key') return dark ? theme.palette.primary.light : theme.palette.primary.dark;
  if (type === 'string') return dark ? theme.palette.success.light : theme.palette.success.dark;
  if (type === 'number') return dark ? theme.palette.warning.light : theme.palette.warning.dark;
  if (type === 'literal') return dark ? theme.palette.error.light : theme.palette.error.main;
  if (type === 'punct') return theme.palette.text.secondary;
  return theme.palette.text.primary;
};

const CodeBlock = ({ code, language, copyable = true, maxLines, onCopy, compact = false }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lines = (code || '').split('\n');
  const collapsed = Boolean(maxLines) && lines.length > maxLines && !expanded;
  const display = collapsed ? lines.slice(0, maxLines).join('\n') : code;
  const rich = language === 'json' ? highlightJson(display || '') : null;

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
          p: compact ? 1 : 1.5,
          border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
        }}
      >
        <Typography
          component="pre"
          sx={{
            color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
            fontSize: compact ? '0.75rem' : '0.9375rem',
            flex: 1,
            fontFamily: 'monospace',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            m: 0,
          }}
        >
          {rich
            ? rich.map((part, index) => (
              <Box
                key={`${part.type}-${index}`}
                component="span"
                sx={{ color: (theme) => jsonColor(theme, part.type) }}
              >
                {part.text}
              </Box>
            ))
            : display}
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
          sx={{ mt: 0.5, textTransform: 'none', fontSize: compact ? '0.75rem' : '0.9375rem' }}
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
  compact: PropTypes.bool,
};

export default CodeBlock;
