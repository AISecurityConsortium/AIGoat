import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  LocalOffer as CouponIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  BarChart as StatsIcon,
  CheckCircle as ValidIcon,
  Cancel as InvalidIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import axios from 'axios';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [usageStats, setUsageStats] = useState(null);

  // Form state for creating/editing coupons
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    minimum_order_amount: '',
    maximum_discount: '',
    usage_limit: '',
    usage_limit_per_user: '',
    target_audience: 'all',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    if (isAdmin !== null) {
      // Add a small delay to ensure the API is ready
      const timer = setTimeout(() => {
        fetchCoupons();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAdmin]);

  // Add a refresh mechanism to ensure data is loaded
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAdmin !== null) {
        fetchCoupons();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAdmin]);

  const checkUserRole = () => {
    const username = localStorage.getItem('username');
    const adminStatus = username === 'admin';
    setIsAdmin(adminStatus);
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const endpoint = isAdmin ? '/api/admin/coupons/' : '/api/coupons/';
      
      console.log('Fetching coupons from:', endpoint);
      
      const response = await axios.get(`${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Coupons fetched:', response.data);
      console.log('Number of coupons:', response.data.length);
      setCoupons(response.data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      setError('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/coupons/usage/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsageStats(response.data);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      setError('Failed to load usage statistics');
    }
  };

  const handleCreateCoupon = () => {
    setEditingCoupon(null);
    
    // Set default dates to current time and 1 year from now
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);
    
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const formatDateTime = (date) => {
      return date.toISOString().slice(0, 16);
    };
    
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      minimum_order_amount: '',
      maximum_discount: '',
      usage_limit: '',
      usage_limit_per_user: '',
      target_audience: 'all',
      valid_from: formatDateTime(now), // Default to current time
      valid_until: formatDateTime(oneYearFromNow), // Default to 1 year from now
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEditCoupon = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      minimum_order_amount: coupon.minimum_order_amount,
      maximum_discount: coupon.maximum_discount || '',
      usage_limit: coupon.usage_limit,
      usage_limit_per_user: coupon.usage_limit_per_user,
      target_audience: coupon.target_audience || 'all',
      valid_from: coupon.valid_from.slice(0, 16), // Format for datetime-local input
      valid_until: coupon.valid_until.slice(0, 16),
      is_active: coupon.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = editingCoupon 
        ? `/api/admin/coupons/${editingCoupon.id}/`
        : '/api/admin/coupons/';
      
      const method = editingCoupon ? 'put' : 'post';
      
      // Validate required fields
      if (!formData.code.trim()) {
        setError('Coupon code is required');
        return;
      }
      if (!formData.name.trim()) {
        setError('Coupon name is required');
        return;
      }
      if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
        setError('Discount value must be greater than 0');
        return;
      }
      if (!formData.usage_limit || parseInt(formData.usage_limit) <= 0) {
        setError('Usage limit must be greater than 0');
        return;
      }
      if (!formData.usage_limit_per_user || parseInt(formData.usage_limit_per_user) <= 0) {
        setError('Usage limit per user must be greater than 0');
        return;
      }
      if (!formData.valid_from) {
        setError('Valid from date is required');
        return;
      }
      if (!formData.valid_until) {
        setError('Valid until date is required');
        return;
      }
      if (new Date(formData.valid_from) >= new Date(formData.valid_until)) {
        setError('Valid from date must be before valid until date');
        return;
      }

      // Clean and prepare form data
      const cleanedData = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        minimum_order_amount: parseFloat(formData.minimum_order_amount) || 0,
        maximum_discount: formData.maximum_discount ? parseFloat(formData.maximum_discount) : null,
        usage_limit: parseInt(formData.usage_limit),
        usage_limit_per_user: parseInt(formData.usage_limit_per_user),
        target_audience: formData.target_audience,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        is_active: formData.is_active
      };
      
      console.log('Sending coupon data:', cleanedData);
      
      const response = await axios[method](`${endpoint}`, cleanedData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(editingCoupon ? 'Coupon updated successfully!' : 'Coupon created successfully!');
      setDialogOpen(false);
      fetchCoupons();
    } catch (error) {
      console.error('Error saving coupon:', error);
      console.error('Error response:', error.response?.data);
      setError(error.response?.data?.error || error.response?.data?.details || 'Failed to save coupon');
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    
    try {
      const token = localStorage.getItem('token');
              await axios.delete(`/api/admin/coupons/${couponId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Coupon deleted successfully!');
      fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      setError('Failed to delete coupon');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'expired': return 'warning';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <ValidIcon />;
      case 'inactive': return <InvalidIcon />;
      case 'expired': return <InvalidIcon />;
      case 'pending': return <PendingIcon />;
      default: return <PendingIcon />;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" align="center">
          Loading coupons...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {isAdmin ? 'Coupon Management' : 'Available Coupons'}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            onClick={fetchCoupons}
            sx={{ mr: isAdmin ? 2 : 0 }}
          >
            Refresh
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outlined"
                startIcon={<StatsIcon />}
                onClick={() => {
                  fetchUsageStats();
                  setStatsDialogOpen(true);
                }}
                sx={{ mr: 2 }}
              >
                Usage Statistics
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateCoupon}
              >
                Create Coupon
              </Button>
            </>
          )}
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {coupons.length === 0 ? (
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CouponIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              {isAdmin ? 'No Coupons Created' : 'No Available Coupons'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {isAdmin 
                ? 'Create your first coupon to start offering discounts to customers.'
                : 'Check back later for available discount coupons.'
              }
            </Typography>
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {coupons.map((coupon) => (
            <Grid item xs={12} md={6} lg={4} key={coupon.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                      {coupon.name}
                    </Typography>
                    {isAdmin && (
                      <Box>
                        <Tooltip title="Edit Coupon">
                          <IconButton
                            size="small"
                            onClick={() => handleEditCoupon(coupon)}
                            sx={{ mr: 0.5 }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Coupon">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                  
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mb: 1 }}>
                    {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Code: <strong>{coupon.code}</strong>
                  </Typography>
                  
                  {coupon.description && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {coupon.description}
                    </Typography>
                  )}
                  
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={coupon.target_audience === 'all' ? 'All Users' : 
                             coupon.target_audience === 'customers' ? 'Customers Only' :
                             coupon.target_audience === 'staff' ? 'Staff Only' : 'Admin Only'}
                      color={coupon.target_audience === 'all' ? 'default' : 
                             coupon.target_audience === 'customers' ? 'primary' :
                             coupon.target_audience === 'staff' ? 'secondary' : 'error'}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={getStatusIcon(coupon.status)}
                      label={coupon.status.toUpperCase()}
                      color={getStatusColor(coupon.status)}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    {coupon.minimum_order_amount > 0 && (
                      <Chip
                        label={`Min $${coupon.minimum_order_amount}`}
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Box>
                  
                  {isAdmin && (
                    <Box sx={{ mt: 'auto' }}>
                      <Typography variant="body2" color="text.secondary">
                        Usage: {coupon.total_usage_count}/{coupon.usage_limit}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Valid: {new Date(coupon.valid_from).toLocaleDateString()} - {new Date(coupon.valid_until).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Coupon Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Coupon Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="SAVE20"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Coupon Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="20% Off Sale"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                placeholder="Description of the coupon offer"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Discount Type"
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                required
              >
                <MenuItem value="percentage">Percentage</MenuItem>
                <MenuItem value="fixed">Fixed Amount</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Discount Value"
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Minimum Order Amount"
                type="number"
                value={formData.minimum_order_amount}
                onChange={(e) => setFormData({ ...formData, minimum_order_amount: e.target.value })}
                placeholder="0.00"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximum Discount (for %)"
                type="number"
                value={formData.maximum_discount}
                onChange={(e) => setFormData({ ...formData, maximum_discount: e.target.value })}
                placeholder="50.00"
                disabled={formData.discount_type === 'fixed'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Usage Limit"
                type="number"
                value={formData.usage_limit}
                onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                placeholder="100"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Usage Limit Per User"
                type="number"
                value={formData.usage_limit_per_user}
                onChange={(e) => setFormData({ ...formData, usage_limit_per_user: e.target.value })}
                placeholder="1"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Target Audience"
                value={formData.target_audience}
                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                required
              >
                <MenuItem value="all">All Users</MenuItem>
                <MenuItem value="customers">Customers Only</MenuItem>
                <MenuItem value="staff">Staff Only</MenuItem>
                <MenuItem value="admin">Admin Only</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Valid From"
                type="datetime-local"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Valid Until"
                type="datetime-local"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCoupon ? 'Update' : 'Create'} Coupon
          </Button>
        </DialogActions>
      </Dialog>

      {/* Usage Statistics Dialog */}
      <Dialog open={statsDialogOpen} onClose={() => setStatsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Coupon Usage Statistics</DialogTitle>
        <DialogContent>
          {usageStats && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {usageStats.total_usage}
                    </Typography>
                    <Typography variant="body2">Total Usage</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      ${usageStats.total_discount_given.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">Total Discount Given</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {usageStats.active_coupons}
                    </Typography>
                    <Typography variant="body2">Active Coupons</Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              <Typography variant="h6" gutterBottom>
                Recent Usage Details
              </Typography>
              <List>
                {usageStats.usage_details.slice(0, 10).map((usage) => (
                  <ListItem key={usage.id} divider>
                    <ListItemText
                      primary={`${usage.coupon_code} - ${usage.user_name}`}
                      secondary={`Order: ${usage.order_id} | Discount: $${usage.discount_amount} | Date: ${new Date(usage.used_at).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Coupons;
