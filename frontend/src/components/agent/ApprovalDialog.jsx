import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box, Typography,
} from '@mui/material';

/**
 * @typedef ApprovalDialogProps
 * @property {boolean} open
 * @property {string} [tool]
 * @property {object} [arguments]
 * @property {function} onApprove
 * @property {function} onDeny
 */

const ApprovalDialog = ({ open, tool, arguments: args, onApprove, onDeny }) => {
  const titleId = 'aigoat-agent-approve-title';
  const descId = 'aigoat-agent-approve-desc';
  const rendered = JSON.stringify(args || {}, null, 2);

  return (
    <Dialog
      open={open}
      onClose={onDeny}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <DialogTitle id={titleId}>Approve tool call?</DialogTitle>
      <DialogContent>
        <DialogContentText id={descId} component="div">
          Read the raw action, not the model&apos;s story about it.
        </DialogContentText>
        <Typography sx={{ mt: 2, fontWeight: 700, fontFamily: 'monospace' }}>
          {tool || 'unknown tool'}
        </Typography>
        <Box
          component="pre"
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 1,
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.100',
            fontSize: '0.9375rem',
            overflow: 'auto',
          }}
        >
          {rendered}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onDeny} color="inherit">Deny</Button>
        <Button onClick={onApprove} variant="contained" color="warning">Approve</Button>
      </DialogActions>
    </Dialog>
  );
};

ApprovalDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  tool: PropTypes.string,
  arguments: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  onApprove: PropTypes.func.isRequired,
  onDeny: PropTypes.func.isRequired,
};

ApprovalDialog.defaultProps = {
  tool: '',
  arguments: {},
};

export default ApprovalDialog;
