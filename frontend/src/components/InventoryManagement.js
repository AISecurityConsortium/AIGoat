import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total_products: 0,
    out_of_stock: 0,
    low_stock: 0,
    sold_out: 0,
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/inventory/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setInventory(response.data.products);
      setStats({
        total_products: response.data.total_products,
        out_of_stock: response.data.out_of_stock,
        low_stock: response.data.low_stock,
        sold_out: response.data.sold_out,
      });
    } catch (err) {
      setError('Failed to load inventory data');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      is_sold_out: product.is_sold_out,
    });
    setEditDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/admin/inventory/${editingProduct.id}/`, {
        quantity: editingProduct.quantity,
        is_sold_out: editingProduct.is_sold_out,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Product inventory updated successfully');
      setEditDialogOpen(false);
      setEditingProduct(null);
      fetchInventory();
    } catch (err) {
      setError('Failed to update product inventory');
      console.error('Error updating product:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingProduct(null);
  };

  const getStockStatusColor = (product) => {
    if (product.is_sold_out) return 'error';
    if (product.quantity === 0) return 'error';
    if (product.quantity <= 5) return 'warning';
    return 'success';
  };

  const getStockStatusIcon = (product) => {
    if (product.is_sold_out || product.quantity === 0) return <ErrorIcon />;
    if (product.quantity <= 5) return <WarningIcon />;
    return <CheckCircleIcon />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <InventoryIcon />
          Inventory Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage product inventory, stock levels, and availability
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Products
              </Typography>
              <Typography variant="h4" component="div">
                {stats.total_products}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Out of Stock
              </Typography>
              <Typography variant="h4" component="div" color="error.main">
                {stats.out_of_stock}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Low Stock
              </Typography>
              <Typography variant="h4" component="div" color="warning.main">
                {stats.low_stock}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Sold Out
              </Typography>
              <Typography variant="h4" component="div" color="error.main">
                {stats.sold_out}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
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

      {/* Inventory Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2">
              Product Inventory
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchInventory}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Stock Status</TableCell>
                  <TableCell>Total Orders</TableCell>
                  <TableCell>Total Revenue</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          component="img"
                          src={product.image_url}
                          alt={product.name}
                          sx={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 1 }}
                        />
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {product.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }}>
                            {product.description.substring(0, 100)}...
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {formatCurrency(product.price)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {product.quantity}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStockStatusIcon(product)}
                        label={product.stock_status}
                        color={getStockStatusColor(product)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {product.total_orders}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {formatCurrency(product.total_revenue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit Inventory">
                        <IconButton
                          size="small"
                          onClick={() => handleEditProduct(product)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCancelEdit} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Product Inventory
        </DialogTitle>
        <DialogContent>
          {editingProduct && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {editingProduct.name}
              </Typography>
              
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={editingProduct.quantity}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  quantity: Math.max(0, parseInt(e.target.value) || 0)
                })}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">Qty:</InputAdornment>,
                }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={editingProduct.is_sold_out}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      is_sold_out: e.target.checked
                    })}
                  />
                }
                label="Mark as Sold Out"
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Note: Marking as sold out will remove this product from all user carts.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEdit} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProduct} 
            variant="contained" 
            startIcon={<SaveIcon />}
            color="primary"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default InventoryManagement;
