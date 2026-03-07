import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Chip, Alert, Skeleton, Button,
  Avatar, IconButton, Collapse, Paper,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  LocalShipping as ShipIcon,
  CreditCard as CardIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Schedule as ClockIcon,
  Cancel as CancelIcon,
  Inventory2 as PackageIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient as axios } from '../config/api';

const STATUS_CONFIG = {
  processing: { label: 'Processing', icon: <ClockIcon sx={{ fontSize: '0.8rem' }} />, color: '#3b82f6' },
  shipped:    { label: 'Shipped',    icon: <ShipIcon sx={{ fontSize: '0.8rem' }} />,   color: '#8b5cf6' },
  delivered:  { label: 'Delivered',  icon: <CheckIcon sx={{ fontSize: '0.8rem' }} />,  color: '#22c55e' },
  cancelled:  { label: 'Cancelled',  icon: <CancelIcon sx={{ fontSize: '0.8rem' }} />, color: '#ef4444' },
};

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/orders/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const processed = response.data
        .map(o => ({ ...o, status: o.status === 'pending' ? 'processing' : o.status }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(processed);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const relDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const timeStr = (dateStr) => new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const copyOrderId = (orderId) => {
    navigator.clipboard.writeText(orderId);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const totalItems = orders.reduce((s, o) => s + (o.items?.length || 0), 0);
  const totalSpent = orders.reduce((s, o) => s + (o.final_amount || o.total_amount || 0), 0);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 3 }} />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rectangular" height={140} sx={{ mb: 2, borderRadius: '12px' }} />
        ))}
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', color: 'text.primary', letterSpacing: '-0.03em', mb: 0.5 }}>
          Orders
        </Typography>
        {orders.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 600 }}>
              {fmt(totalSpent)} total
            </Typography>
          </Box>
        )}
      </Box>

      {/* Empty state */}
      {orders.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: '16px',
            bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
            border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
          }}
        >
          <PackageIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'text.primary', mb: 0.5 }}>
            No orders yet
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 3 }}>
            When you place an order, it will appear here.
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/home')}
            sx={{
              textTransform: 'none', fontWeight: 600, borderRadius: '8px', px: 3,
              bgcolor: (t) => t.palette.custom?.brand?.primary ?? 'primary.main',
            }}
          >
            Browse Products
          </Button>
        </Paper>
      )}

      {/* Order grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
        {orders.map((order) => {
          const isOpen = expandedOrder === order.id;
          const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.processing;
          const items = order.items || [];

          return (
            <Paper
              key={order.id}
              elevation={0}
              sx={{
                borderRadius: '12px',
                overflow: 'hidden',
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                border: (t) => `1px solid ${isOpen ? (t.palette.custom?.border?.strong ?? t.palette.primary.main) : (t.palette.custom?.border?.subtle ?? t.palette.divider)}`,
                transition: 'all 0.2s',
                gridColumn: isOpen ? '1 / -1' : 'auto',
                '&:hover': { borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider },
              }}
            >
              {/* Order card */}
              <Box
                onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                sx={{
                  p: 2, cursor: 'pointer',
                  '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.action.hover },
                  transition: 'background 0.15s',
                }}
              >
                {/* Top: status + expand */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Chip
                    icon={statusCfg.icon}
                    label={statusCfg.label}
                    size="small"
                    sx={{
                      height: 22, fontSize: '0.62rem', fontWeight: 700,
                      bgcolor: alpha(statusCfg.color, 0.1),
                      color: statusCfg.color,
                      border: `1px solid ${alpha(statusCfg.color, 0.2)}`,
                      '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                    }}
                  />
                  {isOpen ? <CollapseIcon sx={{ color: 'text.secondary', fontSize: '1rem' }} /> : <ExpandIcon sx={{ color: 'text.secondary', fontSize: '1rem' }} />}
                </Box>

                {/* Thumbnail row */}
                <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, overflow: 'hidden' }}>
                  {items.slice(0, 4).map((item) => (
                    <Avatar
                      key={item.id}
                      src={item.product_image_url}
                      variant="rounded"
                      sx={{
                        width: 44, height: 44, borderRadius: '8px',
                        border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                      }}
                    />
                  ))}
                  {items.length > 4 && (
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: (t) => t.palette.custom?.surface?.sunken ?? t.palette.action.hover,
                      border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary' }}>+{items.length - 4}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Order ID + date */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'text.primary' }}>
                    #{order.order_id}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); copyOrderId(order.order_id); }}
                    sx={{ width: 18, height: 18, color: copiedId === order.order_id ? 'success.main' : 'text.disabled' }}
                  >
                    {copiedId === order.order_id ? <CheckIcon sx={{ fontSize: '0.6rem' }} /> : <CopyIcon sx={{ fontSize: '0.55rem' }} />}
                  </IconButton>
                </Box>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 1.5 }}>
                  {relDate(order.created_at)} at {timeStr(order.created_at)} &middot; {items.length} item{items.length !== 1 ? 's' : ''}
                </Typography>

                {/* Amount */}
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: (t) => t.palette.custom?.brand?.primary ?? 'primary.main' }}>
                  {fmt(order.final_amount || order.total_amount)}
                </Typography>
              </Box>

              {/* Expanded details */}
              <Collapse in={isOpen}>
                <Box sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                  <Box sx={{ borderTop: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`, pt: 2 }}>

                    {/* Items list */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
                      {items.map((item) => (
                        <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            src={item.product_image_url}
                            variant="rounded"
                            sx={{ width: 48, height: 48, borderRadius: '8px' }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.product_name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                              Qty {item.quantity} &times; {fmt(item.price)}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'text.primary', flexShrink: 0 }}>
                            {fmt(item.quantity * item.price)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Shipping + Payment in two columns */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {/* Shipping */}
                      {order.shipping_info && (
                        <Box
                          sx={{
                            flex: 1, minWidth: 200, p: 1.75, borderRadius: '10px',
                            bgcolor: (t) => t.palette.custom?.surface?.sunken ?? t.palette.background.default,
                            border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                            <ShipIcon sx={{ fontSize: '0.85rem', color: 'text.secondary' }} />
                            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Shipping
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.primary', fontWeight: 600, mb: 0.25 }}>
                            {order.shipping_info.name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.5 }}>
                            {order.shipping_info.address}{order.shipping_info.city ? `, ${order.shipping_info.city}` : ''}
                            {order.shipping_info.state ? `, ${order.shipping_info.state}` : ''} {order.shipping_info.zip_code || ''}
                          </Typography>
                          {order.shipping_info.phone && (
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>
                              {order.shipping_info.phone}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Payment */}
                      {order.payment && (
                        <Box
                          sx={{
                            flex: 1, minWidth: 200, p: 1.75, borderRadius: '10px',
                            bgcolor: (t) => t.palette.custom?.surface?.sunken ?? t.palette.background.default,
                            border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                            <CardIcon sx={{ fontSize: '0.85rem', color: 'text.secondary' }} />
                            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Payment
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.primary', fontWeight: 600, mb: 0.25 }}>
                            {order.payment.card_type || 'Card'} &bull;&bull;&bull;&bull; {order.payment.card_number?.slice(-4) || '••••'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                            Charged {fmt(order.payment.amount || 0)}
                          </Typography>
                          {order.applied_coupon && (
                            <Chip
                              label={`${order.applied_coupon} applied`}
                              size="small"
                              sx={{
                                mt: 0.75, height: 20, fontSize: '0.6rem', fontWeight: 700,
                                bgcolor: (t) => alpha(t.palette.success.main, 0.1),
                                color: 'success.main',
                                border: (t) => `1px solid ${alpha(t.palette.success.main, 0.2)}`,
                              }}
                            />
                          )}
                          {order.discount_amount > 0 && (
                            <Typography sx={{ fontSize: '0.7rem', color: 'success.main', fontWeight: 600, mt: 0.5 }}>
                              Saved {fmt(order.discount_amount)}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Box>
    </Container>
  );
};

export default OrderHistory;
