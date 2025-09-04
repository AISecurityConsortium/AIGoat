import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Box,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ShoppingBag as ShoppingBagIcon,
  CalendarToday as CalendarIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import axios from 'axios';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/orders/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Process orders: remove PENDING status, sort by date (recent first), and group by date
      const processedOrders = response.data
        .map(order => ({
          ...order,
          status: order.status === 'pending' ? 'processing' : order.status
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setOrders(processedOrders);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return 'info';
      case 'shipped': return 'primary';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const groupOrdersByDate = (orders) => {
    const groups = {};
    orders.forEach(order => {
      const dateKey = new Date(order.created_at).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(order);
    });
    return groups;
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

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (orders.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ShoppingBagIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              No Orders Yet
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You haven't placed any orders yet. Start shopping to see your order history here.
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  const groupedOrders = groupOrdersByDate(orders);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Order History
      </Typography>

      {Object.entries(groupedOrders).map(([dateKey, dateOrders]) => (
        <Box key={dateKey} sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
            {formatDateHeader(dateOrders[0].created_at)}
          </Typography>
          
          <Grid container spacing={3}>
            {dateOrders.map((order) => (
              <Grid item xs={12} key={order.id}>
                <Card sx={{ 
                  height: 'auto', 
                  display: 'flex', 
                  flexDirection: 'column',
                  minHeight: '200px'
                }}>
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box>
                        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }} gutterBottom>
                          Order #{order.order_id}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(order.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box textAlign="right">
                        <Chip
                          label={order.status.toUpperCase()}
                          color={getStatusColor(order.status)}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
                          {formatCurrency(order.final_amount || order.total_amount)}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <ShoppingBagIcon />
                          <Typography>Order Items ({order.items?.length || 0})</Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense>
                          {order.items?.map((item) => (
                            <ListItem key={item.id} sx={{ px: 0 }}>
                              <ListItemAvatar>
                                <Avatar
                                  src={item.product_image_url}
                                  alt={item.product_name}
                                  variant="rounded"
                                  sx={{ width: 40, height: 40 }}
                                />
                              </ListItemAvatar>
                              <ListItemText
                                primary={item.product_name}
                                secondary={`Qty: ${item.quantity} × ${formatCurrency(item.price)}`}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                                secondaryTypographyProps={{ variant: 'body2' }}
                              />
                              <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(item.quantity * item.price)}
                              </Typography>
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>

                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <ReceiptIcon />
                          <Typography>Order Details</Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box>
                          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
                            Shipping Information
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Name:</strong> {order.shipping_info?.name || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Email:</strong> {order.shipping_info?.email || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Phone:</strong> {order.shipping_info?.phone || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Address:</strong> {order.shipping_info?.address || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>City:</strong> {order.shipping_info?.city || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>State:</strong> {order.shipping_info?.state || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>ZIP:</strong> {order.shipping_info?.zip_code || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Country:</strong> {order.shipping_info?.country || 'N/A'}
                          </Typography>

                          <Divider sx={{ my: 2 }} />

                          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
                            Payment Information
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Card Type:</strong> {order.payment?.card_type || 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Card Number:</strong> {order.payment?.card_number ? `****${order.payment.card_number.slice(-4)}` : 'N/A'}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Amount:</strong> {formatCurrency(order.payment?.amount || 0)}
                          </Typography>
                          {order.applied_coupon && (
                            <Typography variant="body2" color="success.main" gutterBottom>
                              <strong>Coupon Applied:</strong> {order.applied_coupon}
                            </Typography>
                          )}
                          {order.discount_amount > 0 && (
                            <Typography variant="body2" color="success.main">
                              <strong>Discount:</strong> -{formatCurrency(order.discount_amount)}
                            </Typography>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Container>
  );
};

export default OrderHistory; 