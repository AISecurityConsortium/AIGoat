import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import OllamaStatus from './OllamaStatus';
import {
  People as PeopleIcon,
  ShoppingBag as OrderIcon,
  Inventory as InventoryIcon,
  LocalOffer as CouponIcon,
  Feedback as FeedbackIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Assignment as OrderManagementIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as VisibilityIcon,
  ShoppingCart as CartIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCoupons: 0,
    totalRevenue: '0.00',
    recentOrders: [],
    orderStatusCounts: {},
    inventoryStats: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get('/api/admin/dashboard/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = response.data;
      setStats({
        totalUsers: data.total_users,
        totalOrders: data.total_orders,
        totalProducts: data.total_products,
        totalCoupons: data.total_coupons,
        totalRevenue: data.total_revenue,
        recentOrders: data.recent_orders || [],
        orderStatusCounts: data.order_status_counts || {},
        inventoryStats: data.inventory_stats || {},
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
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
      case 'pending': return <WarningIcon />;
      case 'processing': return <InfoIcon />;
      case 'shipped': return <TrendingUpIcon />;
      case 'delivered': return <CheckCircleIcon />;
      case 'cancelled': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Prepare data for charts
  const orderStatusData = Object.entries(stats.orderStatusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    status: status
  }));

  const revenueTrendData = [
    { name: 'Jan', revenue: 1200 },
    { name: 'Feb', revenue: 1800 },
    { name: 'Mar', revenue: 1600 },
    { name: 'Apr', revenue: 2200 },
    { name: 'May', revenue: 1900 },
    { name: 'Jun', revenue: 2400 },
    { name: 'Jul', revenue: 2100 },
    { name: 'Aug', revenue: parseFloat(stats.totalRevenue) || 0 },
  ];

  const orderTrendData = [
    { name: 'Jan', orders: 15 },
    { name: 'Feb', orders: 22 },
    { name: 'Mar', orders: 18 },
    { name: 'Apr', orders: 28 },
    { name: 'May', orders: 25 },
    { name: 'Jun', orders: 32 },
    { name: 'Jul', orders: 29 },
    { name: 'Aug', orders: stats.totalOrders || 0 },
  ];

  const inventoryData = [
    { name: 'In Stock', value: stats.totalProducts - (stats.inventoryStats?.out_of_stock || 0) - (stats.inventoryStats?.low_stock || 0) },
    { name: 'Low Stock', value: stats.inventoryStats?.low_stock || 0 },
    { name: 'Out of Stock', value: stats.inventoryStats?.out_of_stock || 0 },
  ];

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AdminIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Admin Dashboard
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardStats}
          disabled={loading}
        >
          Refresh Data
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MoneyIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div" fontWeight="bold">
                    {formatCurrency(stats.totalRevenue)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Revenue
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  +12.5% from last month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <OrderIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div" fontWeight="bold">
                    {stats.totalOrders}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Orders
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  +8.2% from last month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PeopleIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div" fontWeight="bold">
                    {stats.totalUsers}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Users
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  +15.3% from last month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <InventoryIcon sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" component="div" fontWeight="bold">
                    {stats.totalProducts}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Products
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 1 }} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  +5.7% from last month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Revenue Trend Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Revenue Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Status Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Order Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Second Row Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Order Trend Chart */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Order Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={orderTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#82ca9d" 
                    strokeWidth={3}
                    dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Inventory Status */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Inventory Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions and Recent Orders */}
      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<OrderManagementIcon />}
                  onClick={() => navigate('/order-management')}
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Manage Orders
                </Button>
                <Button
                  variant="contained"
                  startIcon={<FeedbackIcon />}
                  onClick={() => navigate('/feedback-management')}
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Manage Feedback
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PeopleIcon />}
                  onClick={() => navigate('/user-management')}
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Manage Users
                </Button>
                <Button
                  variant="contained"
                  startIcon={<InventoryIcon />}
                  onClick={() => navigate('/inventory')}
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Manage Inventory
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CouponIcon />}
                  onClick={() => navigate('/coupons')}
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Manage Coupons
                </Button>
                  <Button
                    variant="contained"
                    startIcon={<AIIcon />}
                    onClick={() => navigate('/ollama-ai-service')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    AI Service Status
                  </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Orders */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Recent Orders
              </Typography>
              <List>
                {stats.recentOrders.map((order, index) => (
                  <React.Fragment key={order.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: getStatusColor(order.status) }}>
                          {getStatusIcon(order.status)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`Order ${order.order_id}`}
                        secondary={`${order.user} • ${formatCurrency(order.total_amount)} • ${formatDate(order.created_at)}`}
                      />
                      <Chip 
                        label={order.status} 
                        color={getStatusColor(order.status)} 
                        size="small" 
                        variant="outlined"
                      />
                    </ListItem>
                    {index < stats.recentOrders.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Ollama AI Service Status */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <OllamaStatus />
        </Grid>
      </Grid>
    </Container>
  );
};

export default AdminDashboard;
