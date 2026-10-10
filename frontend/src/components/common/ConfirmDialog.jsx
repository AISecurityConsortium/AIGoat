import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';

/**
 * @typedef ConfirmDialogProps
 * @property {boolean} open
 * @property {string} title
 * @property {string} message
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {boolean} [destructive]
 * @property {function} onConfirm
 * @property {function} onCancel
 */

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = 'aigoat-confirm-title';
  const descId = 'aigoat-confirm-desc';

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={descId}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          color={destructive ? 'error' : 'primary'}
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  destructive: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDialog;
