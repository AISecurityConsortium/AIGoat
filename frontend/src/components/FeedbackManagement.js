import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  LinearProgress,
  Avatar,
  Divider,
  Pagination,
  Stack,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  ShoppingBag as ProductIcon,
  AttachFile as FileIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Feedback as FeedbackIcon,
  Analytics as AnalyticsIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { getApiUrl } from '../config/api';

const FeedbackManagement = () => {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTips, setSelectedTips] = useState([]);
  const [stats, setStats] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, tip: null });
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState({ open: false, count: 0 });
  const [filters, setFilters] = useState({
    search: '',
    product_id: '',
    user_id: '',
    has_file: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total_count: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false
  });

  useEffect(() => {
    fetchTips();
    fetchStats();
  }, [pagination.page, filters]);

  const fetchTips = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.page,
        page_size: pagination.page_size,
        ...filters
      });

      const response = await axios.get(`${getApiUrl()}/api/admin/feedback/?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTips(response.data.tips);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching tips:', error);
      if (error.response?.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (error.response?.status === 401) {
        setError('Authentication required. Please log in as admin.');
      } else {
        setError('Failed to fetch feedback data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/api/admin/feedback/stats/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDeleteTip = (tip) => {
    setDeleteDialog({ open: true, tip });
  };

  const handleBulkDelete = () => {
    if (selectedTips.length === 0) {
      setError('Please select tips to delete');
      return;
    }
    setBulkDeleteDialog({ open: true, count: selectedTips.length });
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${getApiUrl()}/api/admin/feedback/${deleteDialog.tip.id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Tip deleted successfully');
      setDeleteDialog({ open: false, tip: null });
      fetchTips();
      fetchStats();
    } catch (error) {
      console.error('Error deleting tip:', error);
      setError('Failed to delete tip');
      setDeleteDialog({ open: false, tip: null });
    }
  };

  const confirmBulkDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${getApiUrl()}/api/admin/feedback/`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { tip_ids: selectedTips }
      });

      setSuccess(`Successfully deleted ${selectedTips.length} tips`);
      setSelectedTips([]);
      setBulkDeleteDialog({ open: false, count: 0 });
      fetchTips();
      fetchStats();
    } catch (error) {
      console.error('Error bulk deleting tips:', error);
      setError('Failed to delete tips');
      setBulkDeleteDialog({ open: false, count: 0 });
    }
  };

  const handleSelectTip = (tipId) => {
    setSelectedTips(prev => 
      prev.includes(tipId) 
        ? prev.filter(id => id !== tipId)
        : [...prev, tipId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTips.length === tips.length) {
      setSelectedTips([]);
    } else {
      setSelectedTips(tips.map(tip => tip.id));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getFileIcon = (extension) => {
    const iconMap = {
      '.pdf': '📄',
      '.doc': '📝',
      '.docx': '📝',
      '.txt': '📄',
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      '.mp4': '🎥',
      '.avi': '🎥',
      '.mov': '🎥',
      '.zip': '📦',
      '.rar': '📦',
      '.7z': '📦'
    };
    return iconMap[extension] || '📎';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="400px">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
            Loading feedback data...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          <FeedbackIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Feedback Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage user feedback, tips, and security reports
        </Typography>
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Total Tips
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                      {stats.total_tips}
                    </Typography>
                  </Box>
                  <AnalyticsIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      With Files
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                      {stats.tips_with_files}
                    </Typography>
                  </Box>
                  <FileIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Recent (7 days)
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                      {stats.recent_tips}
                    </Typography>
                  </Box>
                  <ScheduleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <FilterIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Filters</Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search"
              placeholder="Search tips, products, or users..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Has File</InputLabel>
              <Select
                value={filters.has_file}
                onChange={(e) => handleFilterChange('has_file', e.target.value)}
                label="Has File"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Bulk Actions */}
      {selectedTips.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button color="error" onClick={handleBulkDelete} startIcon={<DeleteIcon />}>
              Delete Selected ({selectedTips.length})
            </Button>
          }
        >
          {selectedTips.length} tip(s) selected for bulk action
        </Alert>
      )}

      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Tips Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedTips.length === tips.length && tips.length > 0}
                    indeterminate={selectedTips.length > 0 && selectedTips.length < tips.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Product
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    User
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Tip Text
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    File
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Date
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Actions
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tips.map((tip) => (
                <TableRow key={tip.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedTips.includes(tip.id)}
                      onChange={() => handleSelectTip(tip.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        <ProductIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {tip.product_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {tip.product_id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {tip.user_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {tip.user}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        maxWidth: 200, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tip.tip_text || 'No text provided'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {tip.tip_file_url ? (
                      <Box display="flex" alignItems="center">
                        <FileIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Box>
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon />}
                            href={tip.tip_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </Button>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {formatFileSize(tip.file_size)}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No file
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(tip.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete tip">
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteTip(tip)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={pagination.total_pages}
              page={pagination.page}
              onChange={(event, page) => handlePageChange(page)}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, tip: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this tip from <strong>{deleteDialog.tip?.user_name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, tip: null })}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialog.open} onClose={() => setBulkDeleteDialog({ open: false, count: 0 })}>
        <DialogTitle>Confirm Bulk Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{bulkDeleteDialog.count}</strong> selected tips?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialog({ open: false, count: 0 })}>
            Cancel
          </Button>
          <Button onClick={confirmBulkDelete} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FeedbackManagement;
