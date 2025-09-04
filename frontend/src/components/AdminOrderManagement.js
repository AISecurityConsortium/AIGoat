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
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as DeliveredIcon,
  Cancel as CancelledIcon,
  Pending as PendingIcon,
  ShoppingBag as OrderIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import axios from 'axios';

const AdminOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDialog, setOrderDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/orders/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.response?.data?.error || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setOrderDialog(true);
  };

  const handleUpdateStatus = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusDialog(true);
  };

  const handleDeleteOrder = (order) => {
    setSelectedOrder(order);
    setDeleteDialog(true);
  };

  const confirmStatusUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `/api/admin/orders/${selectedOrder.id}/`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSuccess(response.data.message);
      setStatusDialog(false);
      fetchOrders(); // Refresh orders
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating order status:', error);
      setError(error.response?.data?.error || 'Failed to update order status');
    }
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `/api/admin/orders/${selectedOrder.id}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSuccess(response.data.message);
      setDeleteDialog(false);
      fetchOrders(); // Refresh orders
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting order:', error);
      setError(error.response?.data?.error || 'Failed to delete order');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'shipped': return 'primary';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <PendingIcon />;
      case 'processing': return <EditIcon />;
      case 'shipped': return <ShippingIcon />;
      case 'delivered': return <DeliveredIcon />;
      case 'cancelled': return <CancelledIcon />;
      default: return <OrderIcon />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Typography>Loading orders...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Order Management
      </Typography>
      
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

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            All Orders ({orders.length})
          </Typography>
          <Button
            variant="outlined"
            onClick={fetchOrders}
            startIcon={<OrderIcon />}
          >
            Refresh Orders
          </Button>
        </Box>

        {orders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No orders found
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {order.order_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          {order.user.first_name} {order.user.last_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{order.user.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order.user.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </Typography>
                        {order.items.slice(0, 2).map((item, index) => (
                          <Typography key={index} variant="body2" color="text.secondary">
                            {item.quantity}x {item.product.name}
                          </Typography>
                        ))}
                        {order.items.length > 2 && (
                          <Typography variant="body2" color="text.secondary">
                            +{order.items.length - 2} more...
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {formatCurrency(order.final_amount || order.total_amount)}
                        </Typography>
                        {order.discount_amount > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            <s>{formatCurrency(order.total_amount)}</s>
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(order.status)}
                        label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(order.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Tooltip title="View Order Details">
                          <IconButton
                            color="primary"
                            onClick={() => handleViewOrder(order)}
                            size="small"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Update Status">
                          <IconButton
                            color="secondary"
                            onClick={() => handleUpdateStatus(order)}
                            size="small"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        {order.status !== 'delivered' && (
                          <Tooltip title="Delete Order">
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteOrder(order)}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Order Details Dialog */}
      <Dialog 
        open={orderDialog} 
        onClose={() => setOrderDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <OrderIcon sx={{ mr: 1 }} />
            Order Details - {selectedOrder?.order_id}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box>
              {/* Customer Information */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Customer Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PersonIcon sx={{ mr: 1, fontSize: 'small' }} />
                        <Typography variant="body2">
                          {selectedOrder.user.first_name} {selectedOrder.user.last_name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <EmailIcon sx={{ mr: 1, fontSize: 'small' }} />
                        <Typography variant="body2">
                          {selectedOrder.user.email}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PhoneIcon sx={{ mr: 1, fontSize: 'small' }} />
                        <Typography variant="body2">
                          {selectedOrder.shipping_info.phone || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocationIcon sx={{ mr: 1, fontSize: 'small' }} />
                        <Typography variant="body2">
                          {selectedOrder.shipping_info.city}, {selectedOrder.shipping_info.state}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Order Items
                  </Typography>
                  {selectedOrder.items.map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                      <Avatar
                        src={item.product.image_url}
                        sx={{ width: 50, height: 50, mr: 2 }}
                      >
                        <OrderIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {item.product.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Quantity: {item.quantity} | Price: {formatCurrency(item.price)}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {formatCurrency(item.total)}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Order Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>Order ID:</strong> {selectedOrder.order_id}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Status:</strong> 
                        <Chip
                          icon={getStatusIcon(selectedOrder.status)}
                          label={selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                          color={getStatusColor(selectedOrder.status)}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      <Typography variant="body2">
                        <strong>Created:</strong> {formatDate(selectedOrder.created_at)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Updated:</strong> {formatDate(selectedOrder.updated_at)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>Subtotal:</strong> {formatCurrency(selectedOrder.total_amount)}
                      </Typography>
                      {selectedOrder.discount_amount > 0 && (
                        <Typography variant="body2">
                          <strong>Discount:</strong> -{formatCurrency(selectedOrder.discount_amount)}
                        </Typography>
                      )}
                      <Typography variant="h6" color="primary" fontWeight="bold">
                        <strong>Total:</strong> {formatCurrency(selectedOrder.final_amount || selectedOrder.total_amount)}
                      </Typography>
                      {selectedOrder.applied_coupon && (
                        <Typography variant="body2" color="text.secondary">
                          Coupon: {selectedOrder.applied_coupon.code} (
                          {selectedOrder.applied_coupon.discount_type === 'percentage' 
                            ? `${selectedOrder.applied_coupon.discount_percent}% off`
                            : `$${selectedOrder.applied_coupon.discount_value} off`
                          })
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)}>
        <DialogTitle>Update Order Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Update status for order <strong>{selectedOrder?.order_id}</strong>
          </Typography>
          <FormControl fullWidth>
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              label="New Status"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="shipped">Shipped</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
          <Button onClick={confirmStatusUpdate} variant="contained" color="primary">
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ color: 'error.main', mr: 1 }} />
            Confirm Delete
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete order <strong>{selectedOrder?.order_id}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. All order data will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete Order
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminOrderManagement;
