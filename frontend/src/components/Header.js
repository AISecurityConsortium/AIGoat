import React, { useState, useEffect, useCallback } from 'react';
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
  Drawer,
  List,
  ListItem,
  ListItemButton,
  useMediaQuery,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
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
  LibraryBooks as LibraryBooksIcon,
  SmartToy as AIIcon,
  Feedback as FeedbackIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  CardGiftcard as GiftCardIcon,
  Security as SecurityIcon,
  BugReport as BugReportIcon,
  EmojiEvents as ChallengesIcon,
  ExpandMore as ExpandMoreIcon,
  AccountBalanceWallet as WalletIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSearch } from '../contexts/SearchContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { apiClient as axios } from '../config/api';
import { useFeatureFlag } from '../hooks/useFeatureFlags';
import DefenseLevelToggle from './DefenseLevelToggle';

const getNavLinkStyles = (theme) => {
  const { palette } = theme;
  const custom = palette.custom || {};
  return {
    base: {
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      px: 1.5,
      py: 0.75,
      borderRadius: '8px',
      fontSize: '0.82rem',
      fontWeight: 600,
      textDecoration: 'none',
      color: palette.mode === 'dark' ? palette.text.secondary : (custom.text?.body ?? palette.text.secondary),
      whiteSpace: 'nowrap',
      transition: 'all 0.15s',
      '&:hover': {
        color: custom.text?.heading ?? palette.text.primary,
        bgcolor: custom.overlay?.active,
      },
    },
    active: {
      color: custom.text?.accent ?? palette.primary.light,
      bgcolor: custom.overlay?.active,
    },
  };
};
const StyledNavLink = ({ to, children, icon, onClick }) => {
  const theme = useTheme();
  const styles = getNavLinkStyles(theme);
  return (
    <Box
      component={NavLink}
      to={to}
      onClick={onClick}
      sx={{
        ...styles.base,
        '&.active': styles.active,
      }}
    >
      {icon && <Box sx={{ display: 'flex', fontSize: '1.1rem', opacity: 0.85 }}>{icon}</Box>}
      {children}
    </Box>
  );
};

const Header = () => {
  const [cartCount, setCartCount] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { searchBarQuery, setSearchBarQuery } = useSearch();
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:900px)');

  const { enabled: ragSystemEnabled, loading: ragLoading } = useFeatureFlag('rag_system');

  const isLoggedIn = !!localStorage.getItem('token');
  const isAdmin = userProfile?.username === 'admin';
  const isShopper = isAdmin; // Admin is the "shopper-only" role; everyone else sees workshop features

  const fetchCartCount = useCallback(async () => {
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
  }, []);

  const fetchUserProfile = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchCartCount();
    if (isLoggedIn) {
      fetchUserProfile();
    } else {
      setUserProfile(null);
    }
    const handleCartUpdate = () => fetchCartCount();
    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, [isLoggedIn, fetchCartCount, fetchUserProfile]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('chat_history_')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setProfileAnchorEl(null);
    setMobileOpen(false);
    navigate('/home');
  };

  const handleProfileMenuClick = (path) => {
    setProfileAnchorEl(null);
    navigate(path);
  };

  const handleSearchChange = (value) => {
    setSearchBarQuery(value);
    if (location.pathname !== '/home') {
      navigate('/home');
    }
  };

  // ─── Desktop Navbar ───────────────────────────────────────────────
  const renderDesktopNav = () => (
    <Toolbar sx={{ minHeight: '56px !important', gap: 0.5 }}>
      {/* Brand */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2, flexShrink: 0 }}
        onClick={() => { navigate('/home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      >
        <Box
          component="img"
          src="/media/logo.jpg"
          alt="AI Goat Shop Logo"
          sx={{ height: 34, width: 'auto', mr: 1.5, borderRadius: '6px' }}
        />
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            letterSpacing: '-0.01em',
            fontSize: '1rem',
          }}
        >
          AI Goat Shop
        </Typography>
      </Box>

      {/* Public nav links */}
      <Box
        component="span"
        onClick={() => {
          if (location.pathname === '/home') {
            document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
          } else {
            navigate('/home');
            setTimeout(() => document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' }), 300);
          }
        }}
        sx={{ ...getNavLinkStyles(theme).base, cursor: 'pointer' }}
      >
        Shop
      </Box>
      <StyledNavLink to="/owasp-top-10">OWASP Top 10</StyledNavLink>

      {/* Logged-in, non-shopper nav links */}
      {isLoggedIn && !isShopper && (
        <>
          <StyledNavLink to="/attacks">Attack Labs</StyledNavLink>
          <StyledNavLink to="/challenges">Challenges</StyledNavLink>
          {ragSystemEnabled && !ragLoading && (
            <StyledNavLink to="/knowledge-base">Knowledge Base</StyledNavLink>
          )}
        </>
      )}

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Search bar (logged in only) */}
      {isLoggedIn && (
        <Box sx={{ maxWidth: 280, minWidth: 160, mr: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search products..."
            value={searchBarQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'text.primary',
                backgroundColor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.divider,
                borderRadius: '8px',
                fontSize: '0.82rem',
                height: 36,
                '& fieldset': { borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider },
                '&:hover fieldset': { borderColor: (t) => t.palette.custom?.border?.strong ?? 'primary.main' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
              },
              '& .MuiInputBase-input': {
                color: 'text.primary',
                '&::placeholder': { color: 'text.secondary', opacity: 1 },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: '1rem' }} />
                </InputAdornment>
              ),
              endAdornment: searchBarQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchBarQuery('')} sx={{ p: 0.25 }}>
                    <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700 }}>✕</Box>
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}

      {/* Defense Level Toggle (logged-in non-shopper) */}
      {isLoggedIn && !isShopper && <DefenseLevelToggle />}

      {/* Theme Toggle */}
      <IconButton
        onClick={toggleTheme}
        sx={{
          color: (t) => (t.palette.mode === 'dark' ? t.palette.warning.main : t.palette.primary.main),
          ml: 0.5,
          '&:hover': { bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.warning.main, 0.1) : t.palette.custom?.overlay?.active) },
        }}
        title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {mode === 'dark' ? <LightModeIcon sx={{ fontSize: '1.1rem' }} /> : <DarkModeIcon sx={{ fontSize: '1.1rem' }} />}
      </IconButton>

      {/* Right-side actions */}
      {isLoggedIn ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
          {/* Wallet */}
          {userProfile?.wallet_balance !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: '8px', bgcolor: (t) => alpha(t.palette.warning.main, 0.1), border: (t) => `1px solid ${alpha(t.palette.warning.main, 0.2)}` }}>
              <WalletIcon sx={{ fontSize: '0.9rem', color: 'warning.main' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'warning.main' }}>
                ₹{parseFloat(userProfile.wallet_balance).toFixed(0)}
              </Typography>
            </Box>
          )}

          {/* Cart */}
          <IconButton onClick={() => navigate('/cart')} sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.divider } }}>
            <Badge badgeContent={cartCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
              <CartIcon sx={{ fontSize: '1.2rem' }} />
            </Badge>
          </IconButton>

          {/* Orders */}
          {!isAdmin && (
            <StyledNavLink to="/orders" icon={<ShoppingBagIcon sx={{ fontSize: '1rem' }} />}>Orders</StyledNavLink>
          )}

          {/* Profile dropdown */}
          <Box
            onClick={(e) => setProfileAnchorEl(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.divider },
            }}
          >
            <PersonIcon sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userProfile?.username || 'User'}
            </Typography>
            <ExpandMoreIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
          </Box>

          {/* Profile Menu */}
          <Menu
            anchorEl={profileAnchorEl}
            open={Boolean(profileAnchorEl)}
            onClose={() => setProfileAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
                border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
                borderRadius: '12px',
                mt: 1,
                minWidth: 220,
                boxShadow: (t) => (t.palette.mode === 'dark' ? `0 20px 40px ${t.palette.custom?.overlay?.backdrop}` : `0 8px 24px ${t.palette.custom?.overlay?.backdrop}`),
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
              <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.85rem' }}>
                {userProfile?.first_name || userProfile?.username || 'User'}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                @{userProfile?.username}
              </Typography>
            </Box>

            <MenuItem onClick={() => handleProfileMenuClick('/profile')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
              <ListItemIcon><AccountCircleIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
              <ListItemText>Profile</ListItemText>
            </MenuItem>

            {!isAdmin && (
              <MenuItem onClick={() => handleProfileMenuClick('/orders')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                <ListItemIcon><ShoppingBagIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                <ListItemText>Orders</ListItemText>
              </MenuItem>
            )}

            <MenuItem onClick={() => handleProfileMenuClick('/coupons')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
              <ListItemIcon><CouponIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Coupon Management' : 'Coupons'}</ListItemText>
            </MenuItem>

            {isAdmin && (
              <>
                <Divider sx={{ borderColor: 'divider', my: 0.5 }} />
                <MenuItem onClick={() => handleProfileMenuClick('/admin-dashboard')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                  <ListItemIcon><AdminIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                  <ListItemText>Admin Dashboard</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleProfileMenuClick('/user-management')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                  <ListItemIcon><PeopleIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                  <ListItemText>User Management</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleProfileMenuClick('/order-management')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                  <ListItemIcon><OrderManagementIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                  <ListItemText>Order Management</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleProfileMenuClick('/feedback-management')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                  <ListItemIcon><FeedbackIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                  <ListItemText>Feedback Management</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleProfileMenuClick('/inventory')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                  <ListItemIcon><InventoryIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                  <ListItemText>Inventory</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleProfileMenuClick('/ollama-ai-service')} sx={{ color: 'text.primary', '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active } }}>
                  <ListItemIcon><AIIcon sx={{ color: 'text.secondary' }} fontSize="small" /></ListItemIcon>
                  <ListItemText>AI Service Status</ListItemText>
                </MenuItem>
              </>
            )}

            <Divider sx={{ borderColor: 'divider', my: 0.5 }} />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, 0.08) } }}>
              <ListItemIcon><LogoutIcon sx={{ color: 'error.main' }} fontSize="small" /></ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/signup')}
            sx={{
              color: (t) => (t.palette.mode === 'dark' ? t.palette.text.secondary : t.palette.primary.dark),
              borderColor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.text.secondary : t.palette.primary.main, 0.4),
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              '&:hover': { borderColor: 'primary.main', color: (t) => (t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.primary.dark), bgcolor: (t) => t.palette.custom?.overlay?.active },
            }}
          >
            Register
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/login')}
            sx={{
              bgcolor: 'primary.main',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            Login
          </Button>
        </Box>
      )}
    </Toolbar>
  );

  // ─── Mobile section helpers ────────────────────────────────────────
  const MobileSection = ({ title, children }) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', px: 3, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em' }}>
        {title}
      </Typography>
      <List disablePadding>{children}</List>
    </Box>
  );

  const MobileNavItem = ({ to, icon, label, onClick }) => (
    <ListItem disablePadding>
      <ListItemButton
        component={to ? NavLink : 'div'}
        to={to}
        onClick={onClick || (() => setMobileOpen(false))}
        sx={{
          px: 3,
          py: 1.25,
          color: 'text.primary',
          '&.active': { bgcolor: (t) => t.palette.custom?.overlay?.active, color: (t) => t.palette.custom?.text?.accent ?? t.palette.primary.light },
          '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.divider },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: 'inherit', opacity: 0.7 }}>{icon}</ListItemIcon>
        <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
      </ListItemButton>
    </ListItem>
  );

  // ─── Mobile Drawer ─────────────────────────────────────────────────
  const renderMobileDrawer = () => (
    <Drawer
      anchor="right"
      open={mobileOpen}
      onClose={() => setMobileOpen(false)}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 360,
          bgcolor: 'background.default',
          backgroundImage: 'none',
        },
      }}
    >
      {/* Drawer header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="img" src="/media/logo.jpg" alt="AI Goat" sx={{ height: 30, borderRadius: '6px' }} />
          <Typography sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.95rem' }}>AI Goat Shop</Typography>
        </Box>
        <IconButton onClick={() => setMobileOpen(false)} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Search (logged in) */}
      {isLoggedIn && (
        <Box sx={{ px: 2, py: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search products..."
            value={searchBarQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'text.primary',
                bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.divider,
                borderRadius: '8px',
                '& fieldset': { borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider },
                '&:hover fieldset': { borderColor: (t) => t.palette.custom?.border?.strong ?? 'primary.main' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
              },
              '& .MuiInputBase-input': { color: 'text.primary', '&::placeholder': { color: 'text.secondary', opacity: 1 } },
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment> }}
          />
        </Box>
      )}

      {/* Defense Level (logged-in non-shopper) */}
      {isLoggedIn && !isShopper && (
        <Box sx={{ px: 3, pb: 2 }}>
          <DefenseLevelToggle />
        </Box>
      )}

      <Divider sx={{ borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider }} />

      {/* Shop section */}
      <MobileSection title="Shop">
        <MobileNavItem to="/home" icon={<GiftCardIcon />} label="Shop" />
        {isLoggedIn && (
          <>
            <MobileNavItem to="/cart" icon={
              <Badge badgeContent={cartCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 14, height: 14 } }}>
                <CartIcon />
              </Badge>
            } label="Cart" />
            {!isAdmin && <MobileNavItem to="/orders" icon={<ShoppingBagIcon />} label="Orders" />}
            <MobileNavItem to="/coupons" icon={<CouponIcon />} label="Coupons" />
          </>
        )}
      </MobileSection>

      {/* Workshop section (logged-in non-shopper) */}
      {isLoggedIn && !isShopper && (
        <MobileSection title="Workshop">
          <MobileNavItem to="/owasp-top-10" icon={<SecurityIcon />} label="OWASP Top 10" />
          <MobileNavItem to="/attacks" icon={<BugReportIcon />} label="Attack Labs" />
          <MobileNavItem to="/challenges" icon={<ChallengesIcon />} label="Challenges" />
        </MobileSection>
      )}

      {/* Not logged in — still show OWASP */}
      {!isLoggedIn && (
        <MobileSection title="Learn">
          <MobileNavItem to="/owasp-top-10" icon={<SecurityIcon />} label="OWASP Top 10" />
        </MobileSection>
      )}

      {/* Tools section */}
      {isLoggedIn && ragSystemEnabled && !ragLoading && (
        <MobileSection title="Tools">
          <MobileNavItem to="/knowledge-base" icon={<LibraryBooksIcon />} label="Knowledge Base" />
        </MobileSection>
      )}

      {/* Admin section */}
      {isAdmin && (
        <MobileSection title="Admin">
          <MobileNavItem to="/admin-dashboard" icon={<AdminIcon />} label="Dashboard" />
          <MobileNavItem to="/user-management" icon={<PeopleIcon />} label="User Management" />
          <MobileNavItem to="/order-management" icon={<OrderManagementIcon />} label="Order Management" />
          <MobileNavItem to="/feedback-management" icon={<FeedbackIcon />} label="Feedback" />
          <MobileNavItem to="/inventory" icon={<InventoryIcon />} label="Inventory" />
          <MobileNavItem to="/ollama-ai-service" icon={<AIIcon />} label="AI Service Status" />
        </MobileSection>
      )}

      <Box sx={{ flex: 1 }} />

      {/* Account section at bottom */}
      <Box sx={{ borderTop: (t) => `1px solid ${t.palette.divider}`, mt: 2 }}>
        {isLoggedIn ? (
          <>
            <MobileNavItem to="/profile" icon={<AccountCircleIcon />} label={`Profile (${userProfile?.username || 'User'})`} />
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout} sx={{ px: 3, py: 1.25, color: 'error.main', '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, 0.06) } }}>
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => { navigate('/signup'); setMobileOpen(false); }}
              sx={{ color: (t) => (t.palette.mode === 'dark' ? t.palette.text.secondary : t.palette.primary.dark), borderColor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.text.secondary : t.palette.primary.main, 0.4), borderRadius: '8px', textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: 'primary.main', color: (t) => (t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.primary.dark) } }}
            >
              Register
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={() => { navigate('/login'); setMobileOpen(false); }}
              sx={{ bgcolor: 'primary.main', borderRadius: '8px', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: 'primary.dark' } }}
            >
              Login
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );

  // ─── Mobile Toolbar ────────────────────────────────────────────────
  const renderMobileToolbar = () => (
    <Toolbar sx={{ minHeight: '56px !important', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/home')}>
        <Box component="img" src="/media/logo.jpg" alt="AI Goat Shop" sx={{ height: 30, width: 'auto', mr: 1, borderRadius: '6px' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.95rem' }}>
          AI Goat Shop
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {isLoggedIn && (
          <IconButton onClick={() => navigate('/cart')} sx={{ color: 'text.secondary' }}>
            <Badge badgeContent={cartCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 14, height: 14 } }}>
              <CartIcon sx={{ fontSize: '1.2rem' }} />
            </Badge>
          </IconButton>
        )}
        <IconButton onClick={() => setMobileOpen(true)} sx={{ color: 'text.primary' }}>
          <MenuIcon />
        </IconButton>
      </Box>
    </Toolbar>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.default',
          borderBottom: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
          backgroundImage: 'none',
          borderRadius: '0 !important',
        }}
      >
        {isMobile ? renderMobileToolbar() : renderDesktopNav()}
      </AppBar>
      {isMobile && renderMobileDrawer()}
    </>
  );
};

export default Header;
