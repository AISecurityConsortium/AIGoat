import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Badge,
  IconButton,
  Box,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ShoppingCart as CartIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  People as PeopleIcon,
  LocalOffer as CouponIcon,
  AccountCircle as AccountCircleIcon,
  ShoppingBag as ShoppingBagIcon,
  Inventory as InventoryIcon,
  Assignment as OrderManagementIcon,
  Chat as ChatIcon,
  LibraryBooks as LibraryBooksIcon,
  SmartToy as AIIcon,
  Feedback as FeedbackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../contexts/SearchContext';
import axios from 'axios';
import { useFeatureFlag } from '../hooks/useFeatureFlags';

const Header = () => {
  const [cartCount, setCartCount] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { searchBarQuery, setSearchBarQuery } = useSearch();

  // Feature flags
  const { enabled: ragSystemEnabled, loading: ragLoading } = useFeatureFlag('rag_system');

  // Check authentication status on every render
  const isLoggedIn = !!localStorage.getItem('token');

  const fetchCartCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await axios.get('/api/cart/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCartCount(response.data.items?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await axios.get('/api/profile/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserProfile(response.data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    fetchCartCount();
    if (isLoggedIn) {
      fetchUserProfile();
    }
    // Listen for cart updates
    const handleCartUpdate = () => {
      fetchCartCount();
    };
    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, [isLoggedIn]);

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // Clear chat history for all users
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('chat_history_')) {
        localStorage.removeItem(key);
      }
    });
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setAnchorEl(null);
    navigate('/');
  };

  const handleMenuClick = (path) => {
    setAnchorEl(null);
    navigate(path);
  };

  const isAdmin = userProfile?.username === 'admin';

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchBarQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchBarQuery.trim())}`);
    }
  };

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar sx={{ minHeight: '64px' }}>
        {/* Left side: Logo and Brand Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 200 }}>
          <Box
            component="img"
            src="/media/rts-logo.png"
            alt="Red Team Shop Logo"
            sx={{ 
              height: 40,
              width: 'auto',
              cursor: 'pointer',
              mr: 2,
              transition: 'transform 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.05)',
              }
            }}
            onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/')}
          />
          
          <Typography
            variant="h5"
            component="div"
            sx={{ 
              cursor: 'pointer', 
              fontWeight: 700,
              color: '#1D1D1F',
              letterSpacing: '-0.02em',
              transition: 'transform 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
              }
            }}
            onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/')}
          >
            RED TEAM SHOP
          </Typography>
        </Box>
        
        {/* Center: Search Bar */}
        {isLoggedIn && (
          <Box
            component="form"
            onSubmit={handleSearch}
            sx={{
              flex: 1,
              mx: 4,
              minWidth: 500,
              maxWidth: 800,
            }}
          >
              <TextField
                fullWidth
                size="small"
                placeholder="Search products..."
                value={searchBarQuery}
                onChange={(e) => setSearchBarQuery(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#1D1D1F',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: 3,
                    '& fieldset': {
                      borderColor: 'rgba(0, 0, 0, 0.1)',
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.08)',
                      '& fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.15)',
                      },
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(0, 0, 0, 0.08)',
                      '& fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.15)',
                      },
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: '#1D1D1F',
                    '&::placeholder': {
                      color: '#86868B',
                      opacity: 1,
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton
                        type="submit"
                        size="small"
                        sx={{ color: '#000000' }}
                      >
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

        {/* Right side: Navigation buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          {isLoggedIn ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#1D1D1F', 
                    maxWidth: 120, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}
                >
                  {userProfile?.username || 'User'}
                </Typography>
                <IconButton
                  color="inherit"
                  onClick={handleUserMenuOpen}
                  sx={{ 
                    color: '#1D1D1F',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    }
                  }}
                >
                  <PersonIcon />
                </IconButton>
              </Box>
              
              <IconButton
                color="inherit"
                onClick={() => navigate('/cart')}
                sx={{ 
                  color: '#1D1D1F',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  }
                }}
              >
                <Badge badgeContent={cartCount} color="error">
                  <CartIcon />
                </Badge>
              </IconButton>
              
              {/* User Menu */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleUserMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={() => handleMenuClick('/profile')}>
                  <ListItemIcon>
                    <AccountCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Profile</ListItemText>
                </MenuItem>
                
                {!isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/orders')}>
                    <ListItemIcon>
                      <ShoppingBagIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Orders</ListItemText>
                  </MenuItem>
                )}
                
                {isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/admin-dashboard')}>
                    <ListItemIcon>
                      <AdminIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Admin Dashboard</ListItemText>
                  </MenuItem>
                )}
                
                {isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/user-management')}>
                    <ListItemIcon>
                      <PeopleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>User Management</ListItemText>
                  </MenuItem>
                )}
                
                {isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/order-management')}>
                    <ListItemIcon>
                      <OrderManagementIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Order Management</ListItemText>
                  </MenuItem>
                )}
                
                {isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/feedback-management')}>
                    <ListItemIcon>
                      <FeedbackIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Feedback Management</ListItemText>
                  </MenuItem>
                )}
                
                {isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/inventory')}>
                    <ListItemIcon>
                      <InventoryIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Inventory Management</ListItemText>
                  </MenuItem>
                )}
                
                <MenuItem onClick={() => handleMenuClick('/coupons')}>
                  <ListItemIcon>
                    <CouponIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{isAdmin ? 'Coupon Management' : 'Coupons'}</ListItemText>
                </MenuItem>
                
                {isAdmin && ragSystemEnabled && !ragLoading && (
                  <MenuItem onClick={() => handleMenuClick('/knowledge-base')}>
                    <ListItemIcon>
                      <LibraryBooksIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Knowledge Base</ListItemText>
                  </MenuItem>
                )}
                
                {isAdmin && (
                  <MenuItem onClick={() => handleMenuClick('/ollama-ai-service')}>
                    <ListItemIcon>
                      <AIIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>AI Service Status</ListItemText>
                  </MenuItem>
                )}
                
                {isLoggedIn && (
                  <MenuItem onClick={() => handleMenuClick('/rag-chat')}>
                    <ListItemIcon>
                      <ChatIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>RAG Chat</ListItemText>
                  </MenuItem>
                )}
                
                <Divider />
                
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Logout</ListItemText>
                </MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                onClick={() => navigate('/signup')}
                sx={{ 
                  color: '#000000', 
                  borderColor: '#000000',
                  mr: 1,
                  '&:hover': {
                    borderColor: '#000000',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  }
                }}
              >
                Sign Up
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{ 
                  backgroundColor: '#000000',
                  '&:hover': {
                    backgroundColor: '#333333',
                  }
                }}
              >
                Login
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 