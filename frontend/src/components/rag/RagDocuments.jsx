import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, Chip, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Switch, Tooltip, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import EmptyState from '../common/EmptyState';
import {
  chipSx, inset, meta, quietButton, sectionTitle,
} from './ragStyles';

const CATEGORY_COLORS = {
  product_info: 'primary',
  features: 'success',
  usage: 'warning',
  care_instructions: 'info',
  specifications: 'secondary',
};

const MiniChip = ({ label, color = 'default', variant = 'outlined' }) => (
  <Chip label={label} size="small" color={color} variant={variant} sx={chipSx} />
);

MiniChip.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  variant: PropTypes.string,
};

const DocumentCard = ({ doc, productName, categoryLabel, onEdit, onDelete }) => (
  <Box component="article" aria-label={doc.title} sx={{ ...inset, p: 1.25, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="h3" sx={{ ...sectionTitle, fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{doc.title}</Typography>
        <Typography sx={meta}>Product: {productName}</Typography>
      </Box>
      <Tooltip title="Edit">
        <IconButton size="small" aria-label={`Edit ${doc.title}`} onClick={() => onEdit(doc)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton size="small" color="error" aria-label={`Delete ${doc.title}`} onClick={() => onDelete(doc.id)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      <MiniChip label={categoryLabel} color={CATEGORY_COLORS[doc.category] || 'default'} />
      <MiniChip label={doc.is_user_injected ? 'injected' : 'seeded'} color={doc.is_user_injected ? 'warning' : 'default'} />
      <MiniChip label={doc.trust_tier || 'user'} />
      {doc.is_latest === false && <MiniChip label={`v${doc.version || 1} stale`} color="warning" />}
      {doc.valid_until && <MiniChip label={`until ${doc.valid_until}`} />}
    </Box>
    <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
      {doc.content.length > 200 ? `${doc.content.substring(0, 200)}...` : doc.content}
    </Typography>
    <Typography sx={{ ...meta, fontSize: '0.72rem' }}>
      Created: {new Date(doc.created_at).toLocaleDateString()}
      {doc.embedding_id && ` | Embedding ID: ${doc.embedding_id}`}
    </Typography>
  </Box>
);

DocumentCard.propTypes = {
  doc: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  productName: PropTypes.string.isRequired,
  categoryLabel: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

const StatChip = ({ label, value }) => (
  <Chip
    size="small"
    variant="outlined"
    label={`${value} ${label}`}
    sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.72rem', fontWeight: 600 } }}
  />
);

StatChip.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired };

const PAGE_SIZE = 6;

/** Document list, filters, and the document actions. */
const RagDocuments = ({
  documents, visibleDocuments, statistics = null, categories, getProductName,
  trustFilter, onTrustFilter, injectedOnly, onInjectedOnly,
  onAdd, onSync, onRegenerate, onEdit, onDelete, busy = false,
}) => {
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => { setShown(PAGE_SIZE); }, [trustFilter, injectedOnly]);
  const rows = visibleDocuments.slice(0, shown);
  const remaining = visibleDocuments.length - rows.length;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography component="h2" sx={sectionTitle}>
          {`Knowledge documents (${visibleDocuments.length})`}
        </Typography>
        {statistics && (
          <>
            <StatChip value={statistics.total_documents} label="total" />
            <StatChip value={statistics.products_with_knowledge} label="products covered" />
            <StatChip value={statistics.categories} label="categories" />
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onAdd} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Add Document
        </Button>
      </Box>

      <Box sx={{ ...inset, p: 1, mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="rag-trust-filter-label">Trust tier</InputLabel>
          <Select
            labelId="rag-trust-filter-label"
            value={trustFilter}
            label="Trust tier"
            onChange={(event) => onTrustFilter(event.target.value)}
          >
            <MenuItem value="all">All tiers</MenuItem>
            <MenuItem value="system">system</MenuItem>
            <MenuItem value="partner">partner</MenuItem>
            <MenuItem value="user">user</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={injectedOnly} onChange={(event) => onInjectedOnly(event.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: '0.85rem' }}>Injected only</Typography>}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" color="inherit" size="small" onClick={onSync} disabled={busy} sx={quietButton}>
          Sync to Vector DB
        </Button>
        <Button variant="outlined" color="warning" size="small" onClick={onRegenerate} disabled={busy} sx={{ ...quietButton, color: 'warning.main', borderColor: 'warning.main' }}>
          Regenerate All
        </Button>
      </Box>

      {visibleDocuments.length === 0 ? (
        <EmptyState
          title={documents.length ? 'No documents match these filters' : 'No documents yet'}
          description={documents.length ? 'Clear the trust tier or injected filter to see every document.' : 'Add a document to start poisoning the knowledge base.'}
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
          {rows.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              productName={getProductName(doc.product_id)}
              categoryLabel={categories.find((c) => c.value === doc.category)?.label || doc.category}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Box>
      )}
      {remaining > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={() => setShown((count) => count + PAGE_SIZE)} sx={quietButton}>
            {`Show ${Math.min(PAGE_SIZE, remaining)} more (${remaining} remaining)`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

RagDocuments.propTypes = {
  documents: PropTypes.arrayOf(PropTypes.object).isRequired, // eslint-disable-line react/forbid-prop-types
  visibleDocuments: PropTypes.arrayOf(PropTypes.object).isRequired, // eslint-disable-line react/forbid-prop-types
  statistics: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  categories: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })).isRequired,
  getProductName: PropTypes.func.isRequired,
  trustFilter: PropTypes.string.isRequired,
  onTrustFilter: PropTypes.func.isRequired,
  injectedOnly: PropTypes.bool.isRequired,
  onInjectedOnly: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onSync: PropTypes.func.isRequired,
  onRegenerate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};

export default RagDocuments;
