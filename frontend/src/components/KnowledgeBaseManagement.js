import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import axios from 'axios';

const KnowledgeBaseManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formData, setFormData] = useState({
    product_id: '',
    title: '',
    content: '',
    category: 'product_info'
  });

  const categories = [
    { value: 'product_info', label: 'Product Information' },
    { value: 'security_features', label: 'Security Features' },
    { value: 'red_team_use', label: 'Red Team Usage' },
    { value: 'vulnerabilities', label: 'Known Vulnerabilities' },
    { value: 'mitigation', label: 'Mitigation Strategies' }
  ];

  useEffect(() => {
    fetchDocuments();
    fetchProducts();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/knowledge-base/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
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
      setFormData({ product_id: '', title: '', content: '', category: 'product_info' });
      fetchDocuments();
      
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({
      product_id: doc.product,
      title: doc.title,
      content: doc.content,
      category: doc.category
    });
    setOpenDialog(true);
  };

  const handleDelete = async (docId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await axios.delete(`/api/knowledge-base/${docId}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        fetchDocuments();
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'product_info': 'primary',
      'security_features': 'success',
      'red_team_use': 'warning',
      'vulnerabilities': 'error',
      'mitigation': 'info'
    };
    return colors[category] || 'default';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SecurityIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          Knowledge Base Management
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Manage product knowledge base for the RAG system. This data will be used to provide 
          contextual responses to user queries about products and security.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Knowledge Documents ({documents.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Document
        </Button>
      </Box>

      <Grid container spacing={3}>
        {documents.map((doc) => (
          <Grid item xs={12} md={6} key={doc.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {doc.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Product: {getProductName(doc.product)}
                    </Typography>
                    <Chip 
                      label={categories.find(c => c.value === doc.category)?.label || doc.category}
                      color={getCategoryColor(doc.category)}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(doc)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(doc.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {doc.content.length > 200 
                    ? `${doc.content.substring(0, 200)}...` 
                    : doc.content
                  }
                </Typography>
                
                <Typography variant="caption" color="text.secondary">
                  Created: {new Date(doc.created_at).toLocaleDateString()}
                  {doc.embedding_id && ` | Embedding ID: ${doc.embedding_id}`}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingDoc ? 'Edit Document' : 'Add New Document'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Product</InputLabel>
                  <Select
                    value={formData.product_id}
                    onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                    label="Product"
                  >
                    {products.map((product) => (
                      <MenuItem key={product.id} value={product.id}>
                        {product.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    label="Category"
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.value} value={category.value}>
                        {category.label}
                      </MenuItem>
                    ))}
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
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Enter detailed content about the product, security features, vulnerabilities, etc."
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || !formData.product_id || !formData.title || !formData.content}
          >
            {loading ? 'Saving...' : (editingDoc ? 'Update' : 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default KnowledgeBaseManagement;
