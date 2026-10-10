import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Snackbar,
  Tab,
  Tabs,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { apiClient as axios } from '../config/api';
import { useLabs } from '../hooks/useLabs';
import LabSwitcher from './common/LabSwitcher';
import { RAG_NAV_GROUPS, labChipLabel } from '../utils/labTeaching';
import RetrievalTraceInspector from './rag/RetrievalTraceInspector';
import RetrievalAskPanel from './rag/RetrievalAskPanel';
import RagHero from './rag/RagHero';
import RagLabsSection from './rag/RagLabsSection';
import RagLabIntro from './rag/RagLabIntro';
import RagRail from './rag/RagRail';
import RagDocuments from './rag/RagDocuments';
import RagPoisoningExamples from './rag/RagPoisoningExamples';
import { ConfirmKbDialog, DocumentFormDialog } from './rag/RagDocumentDialogs';
import { panel } from './rag/ragStyles';

const TABS = [
  { id: 'documents', label: 'Documents' },
  { id: 'trace', label: 'Retrieval trace' },
  { id: 'ask', label: 'Ask with citations' },
  { id: 'examples', label: 'Poisoning examples' },
];

const EMPTY_FORM = { product_id: '', title: '', content: '', category: 'product_info', trust_tier: 'user' };

const CATEGORIES = [
  { value: 'product_info', label: 'Product Information' },
  { value: 'refund_policy', label: 'Refund Policy' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'support', label: 'Support & Shipping' },
];

const ragLabHref = (id) => `/knowledge-base?lab=${encodeURIComponent(id)}`;

const KnowledgeBaseManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const labFromQuery = searchParams.get('lab');
  const tabParam = searchParams.get('tab');
  const tab = TABS.some((item) => item.id === tabParam) ? tabParam : 'documents';
  const { labs: ragLabs } = useLabs({ surface: 'rag.kb' });
  const [lab, setLab] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, docId: null });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [kbIntegration, setKbIntegration] = useState(() => {
    return localStorage.getItem('kb_integration') === 'true';
  });
  const [ragStats, setRagStats] = useState(null);
  const [trustFilter, setTrustFilter] = useState('all');
  const [injectedOnly, setInjectedOnly] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const categories = CATEGORIES;

  useEffect(() => {
    fetchDocuments();
    fetchProducts();
    fetchRagStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!labFromQuery) {
      setLab(null);
      return undefined;
    }
    let cancelled = false;
    const token = localStorage.getItem('token');
    axios.get(`/api/labs/${labFromQuery}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(({ data }) => {
      if (cancelled) return;
      setLab(data);
      localStorage.setItem('active_lab_id', labFromQuery);
    }).catch(() => {
      if (!cancelled) setLab(null);
    });
    return () => { cancelled = true; };
  }, [labFromQuery]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/knowledge-base/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Handle both old format (array) and new format (object with documents property)
      if (response.data.documents) {
        setDocuments(response.data.documents);
        setStatistics(response.data.statistics);
      } else {
        setDocuments(response.data);
        setStatistics(null);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRagStats = async () => {
    try {
      const response = await axios.get('/api/rag-stats/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRagStats(response.data);
    } catch (error) {
      console.error('Error fetching RAG stats:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/products/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (editingDoc) {
        // Update existing document
        await axios.put(`/api/knowledge-base/${editingDoc.id}/`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        // Add new document
        await axios.post('/api/knowledge-base/', formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      
      setOpenDialog(false);
      setEditingDoc(null);
      setFormData({ product_id: '', title: '', content: '', category: 'product_info', trust_tier: 'user' });
      fetchDocuments();
      fetchRagStats();
      
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({
      product_id: doc.product_id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      trust_tier: doc.trust_tier || 'user',
    });
    setOpenDialog(true);
  };

  const handleDelete = (docId) => {
    setConfirmDialog({ open: true, type: 'delete', docId });
  };

  const handleConfirmDelete = async () => {
    const { docId } = confirmDialog;
    if (!docId) return;
    setConfirmDialog({ open: false, type: null, docId: null });
    try {
      await axios.delete(`/api/knowledge-base/${docId}/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSnack({ open: true, message: 'Document deleted successfully', severity: 'success' });
      fetchDocuments();
      fetchRagStats();
    } catch (error) {
      setSnack({ open: true, message: 'Error deleting document', severity: 'error' });
    }
  };

  const handleRegenerate = () => {
    setConfirmDialog({ open: true, type: 'regenerate', docId: null });
  };

  const handleConfirmRegenerate = async () => {
    setConfirmDialog({ open: false, type: null, docId: null });
    try {
      setLoading(true);
      await axios.put('/api/knowledge-base/', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchDocuments();
      fetchRagStats();
      setSnack({ open: true, message: 'Knowledge base regenerated successfully!', severity: 'success' });
    } catch (error) {
      setSnack({ open: true, message: 'Error regenerating knowledge base', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      const response = await axios.patch('/api/knowledge-base/', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSnack({ open: true, message: `Knowledge base synced successfully! ${response.data.synced || response.data.synced_count || 0} documents synced.`, severity: 'success' });
      fetchRagStats();
    } catch (error) {
      setSnack({ open: true, message: 'Error syncing knowledge base', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKbIntegration = (e) => {
    const enabled = e.target.checked;
    setKbIntegration(enabled);
    localStorage.setItem('kb_integration', enabled ? 'true' : 'false');
    setSnack({
      open: true,
      message: enabled
        ? 'Knowledge Base integration with Cracky AI enabled'
        : 'Knowledge Base integration with Cracky AI disabled',
      severity: enabled ? 'success' : 'info',
    });
  };

  const getProductName = (productId) => {
    if (productId === null || productId === undefined) return 'none (general document)';
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  const changeTab = useCallback((next) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next === 'documents') params.delete('tab');
      else params.set('tab', next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openAdd = () => {
    setEditingDoc(null);
    setFormData(EMPTY_FORM);
    setOpenDialog(true);
  };

  const loadExample = (example) => {
    setEditingDoc(null);
    setFormData({
      ...EMPTY_FORM,
      title: example.sampleTitle,
      content: example.sampleContent,
      category: example.category,
    });
    setOpenDialog(true);
  };

  const closeForm = () => {
    setOpenDialog(false);
    setEditingDoc(null);
    setFormData(EMPTY_FORM);
  };

  const closeConfirm = () => setConfirmDialog({ open: false, type: null, docId: null });

  const visibleDocuments = documents.filter((doc) => {
    if (injectedOnly && !doc.is_user_injected) return false;
    if (trustFilter !== 'all' && (doc.trust_tier || 'user') !== trustFilter) return false;
    return true;
  });

  const labNames = Object.fromEntries((ragLabs || []).map((item) => [item.id, item.name]));

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
        {lab ? (
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
            <Button
              component={RouterLink}
              to="/knowledge-base"
              startIcon={<ArrowBackIcon />}
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
            >
              Back to RAG
            </Button>
            <Box aria-hidden="true" sx={{ display: { xs: 'none', sm: 'block' }, width: '1px', alignSelf: 'stretch', bgcolor: 'divider' }} />
            <LabSwitcher
              groups={RAG_NAV_GROUPS}
              ariaLabel="RAG labs"
              currentId={lab.id}
              labNames={labNames}
              labelFor={labChipLabel}
              hrefFor={ragLabHref}
            />
          </Box>
        ) : (
          <RagHero
            onAddDocument={openAdd}
            onRunTrace={() => { changeTab('trace'); scrollTo('rag-workbench'); }}
            onShowLabs={() => scrollTo('rag-labs')}
          />
        )}

        <Box
          id="rag-workbench"
          sx={{
            display: 'grid',
            gap: 1.5,
            alignItems: 'start',
            scrollMarginTop: '72px',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(300px, 3fr)', lg: 'minmax(0, 7fr) minmax(340px, 3fr)' },
          }}
        >
          <Box sx={{ ...panel, p: 2, minWidth: 0 }}>
            {lab && <RagLabIntro lab={lab} />}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}>
              <Tabs
                value={tab}
                onChange={(_event, next) => changeTab(next)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="RAG workbench"
              >
                {TABS.map((item) => (
                  <Tab
                    key={item.id}
                    value={item.id}
                    label={item.label}
                    id={`rag-tab-${item.id}`}
                    aria-controls={`rag-panel-${item.id}`}
                    sx={{ textTransform: 'none' }}
                  />
                ))}
              </Tabs>
            </Box>
            <Box role="tabpanel" id={`rag-panel-${tab}`} aria-labelledby={`rag-tab-${tab}`} sx={{ minHeight: 280 }}>
              {tab === 'documents' && (
                <RagDocuments
                  documents={documents}
                  visibleDocuments={visibleDocuments}
                  statistics={statistics}
                  categories={categories}
                  getProductName={getProductName}
                  trustFilter={trustFilter}
                  onTrustFilter={setTrustFilter}
                  injectedOnly={injectedOnly}
                  onInjectedOnly={setInjectedOnly}
                  onAdd={openAdd}
                  onSync={handleSync}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  busy={loading}
                />
              )}
              {tab === 'trace' && <RetrievalTraceInspector bare />}
              {tab === 'ask' && <RetrievalAskPanel bare />}
              {tab === 'examples' && <RagPoisoningExamples onUse={loadExample} />}
            </Box>
          </Box>

          <RagRail
            kbIntegration={kbIntegration}
            onToggleIntegration={handleToggleKbIntegration}
            ragStats={ragStats}
            onSync={handleSync}
            busy={loading}
          />
        </Box>

        {!lab && <RagLabsSection />}
      </Box>

      <DocumentFormDialog
        open={openDialog}
        editing={Boolean(editingDoc)}
        formData={formData}
        onChange={setFormData}
        products={products}
        categories={categories}
        loading={loading}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmKbDialog
        open={confirmDialog.open}
        type={confirmDialog.type}
        onClose={closeConfirm}
        onConfirm={confirmDialog.type === 'delete' ? handleConfirmDelete : handleConfirmRegenerate}
      />

      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default KnowledgeBaseManagement;
