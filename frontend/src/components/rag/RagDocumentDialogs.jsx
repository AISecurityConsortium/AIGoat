import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, Grid, InputLabel, MenuItem, Select, TextField,
} from '@mui/material';

/** Add or edit a knowledge base document. */
export const DocumentFormDialog = ({
  open, editing, formData, onChange, products, categories, loading, onClose, onSubmit,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>{editing ? 'Edit Document' : 'Add New Document'}</DialogTitle>
    <DialogContent>
      <Box sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Product</InputLabel>
              <Select
                value={formData.product_id}
                onChange={(e) => onChange({ ...formData, product_id: e.target.value })}
                label="Product"
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => onChange({ ...formData, title: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => onChange({ ...formData, category: e.target.value })}
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Trust tier</InputLabel>
              <Select
                value={formData.trust_tier || 'user'}
                onChange={(e) => onChange({ ...formData, trust_tier: e.target.value })}
                label="Trust tier"
              >
                <MenuItem value="user">user (default for injected docs)</MenuItem>
                <MenuItem value="partner">partner</MenuItem>
                <MenuItem value="system">system (spoofable: the trust-tier lab)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Content"
              value={formData.content}
              onChange={(e) => onChange({ ...formData, content: e.target.value })}
              placeholder="Enter detailed content about the product, security features, vulnerabilities, etc."
            />
          </Grid>
        </Grid>
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        onClick={onSubmit}
        variant="contained"
        disabled={loading || !formData.product_id || !formData.title || !formData.content}
      >
        {loading ? 'Saving...' : (editing ? 'Update' : 'Save')}
      </Button>
    </DialogActions>
  </Dialog>
);

DocumentFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  editing: PropTypes.bool.isRequired,
  formData: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  onChange: PropTypes.func.isRequired,
  products: PropTypes.arrayOf(PropTypes.object).isRequired, // eslint-disable-line react/forbid-prop-types
  categories: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })).isRequired,
  loading: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

/** Confirm a delete or a full regenerate. */
export const ConfirmKbDialog = ({ type = null, open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>{type === 'delete' ? 'Delete Document' : 'Regenerate Knowledge Base'}</DialogTitle>
    <DialogContent>
      <DialogContentText>
        {type === 'delete'
          ? 'Are you sure you want to delete this document?'
          : 'This will regenerate the entire knowledge base. Are you sure?'}
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm} color="primary" variant="contained">
        {type === 'delete' ? 'Delete' : 'Regenerate'}
      </Button>
    </DialogActions>
  </Dialog>
);

ConfirmKbDialog.propTypes = {
  type: PropTypes.string,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
