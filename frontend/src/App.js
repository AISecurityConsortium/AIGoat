import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, IconButton } from '@mui/material';
import { GitHub as GitHubIcon, Favorite as HeartIcon, OpenInNew as ExternalIcon } from '@mui/icons-material';
import { ThemeToggleProvider, useThemeMode } from './contexts/ThemeContext';
import Header from './components/Header';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import Login from './components/Login';
import SignUp from './components/SignUp';
import OrderHistory from './components/OrderHistory';
import ProtectedRoute from './components/ProtectedRoute';

import ChatBot from './components/ChatBot';
import UserProfile from './components/UserProfile';
import UserManagement from './components/UserManagement';
import AdminOrderManagement from './components/AdminOrderManagement';
import AdminDashboard from './components/AdminDashboard';
import Coupons from './components/Coupons';
import InventoryManagement from './components/InventoryManagement';
import OllamaAIServicePage from './components/OllamaAIServicePage';
import OwaspTop10Page from './components/OwaspTop10Page';
import AttacksPage from './components/AttacksPage';
import ChallengePage from './components/ChallengePage';
import { SearchProvider } from './contexts/SearchContext';
import { ChatProvider } from './contexts/ChatContext';
import { DefenseProvider } from './contexts/DefenseContext';
import { useFeatureFlag } from './hooks/useFeatureFlags';

const GITHUB_REPO = 'AISecurityConsortium/AIGoat';

const Footer = () => {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const muted = isDark ? '#475569' : '#cbd5e1';
  const text = isDark ? '#64748b' : '#94a3b8';
  const accent = isDark ? '#818cf8' : '#6366f1';

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? '#070710' : '#f8f9fc',
      }}
    >
      {/* Main footer content */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>

        {/* Left — brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/media/logo.jpg"
            alt="AI Goat"
            sx={{ width: 28, height: 28, borderRadius: '8px', opacity: 0.85 }}
          />
          <Box>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              AI Goat
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: text, lineHeight: 1.2 }}>
              AI Security Learning Platform
            </Typography>
          </Box>
        </Box>

        {/* Center — made with love */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: text }}>
            Made with
          </Typography>
          <HeartIcon sx={{ fontSize: '0.72rem', color: '#ef4444' }} />
          <Typography sx={{ fontSize: '0.7rem', color: text }}>
            by{' '}
            <Box component="span" sx={{ fontWeight: 700, color: isDark ? '#c8d0db' : '#475569' }}>Farooq</Box>
            {' & '}
            <Box component="span" sx={{ fontWeight: 700, color: isDark ? '#c8d0db' : '#475569' }}>Nal</Box>
          </Typography>
        </Box>

        {/* Right — links */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="a"
            href="https://www.aisecurityconsortium.org/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.4,
              fontSize: '0.65rem', fontWeight: 600, color: text, textDecoration: 'none',
              px: 1, py: 0.4, borderRadius: '6px',
              border: `1px solid ${muted}`,
              transition: 'all 0.15s',
              '&:hover': { color: accent, borderColor: accent, bgcolor: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)' },
            }}
          >
            <ExternalIcon sx={{ fontSize: '0.65rem' }} />
            AI Security Consortium
          </Box>
          <IconButton
            component="a"
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{
              width: 28, height: 28, color: text,
              border: `1px solid ${muted}`, borderRadius: '6px',
              '&:hover': { color: accent, borderColor: accent, bgcolor: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)' },
            }}
          >
            <GitHubIcon sx={{ fontSize: '0.85rem' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Bottom bar */}
      <Box sx={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`, py: 1.25, px: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.58rem', color: '#FFFFFF', letterSpacing: '0.04em', fontWeight: 500 }}>
          &copy; {new Date().getFullYear()} AI Goat &mdash; Deliberately vulnerable. For educational purposes only.
        </Typography>
      </Box>
    </Box>
  );
};

const DynamicKnowledgeBase = () => {
  const { enabled: ragEnabled, loading } = useFeatureFlag('rag_system');
  if (loading) return <div>Loading...</div>;
  if (!ragEnabled) return <div>RAG system is disabled</div>;
  const KnowledgeBaseManagement = require('./components/KnowledgeBaseManagement').default;
  return <KnowledgeBaseManagement />;
};

function AppContent() {
  const { theme } = useThemeMode();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <SearchProvider>
          <ChatProvider>
          <DefenseProvider>
            <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Header />
              <Box sx={{ flex: 1 }}>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/search" element={<Navigate to="/home" replace />} />
                <Route path="/cart" element={
                  <ProtectedRoute>
                    <Cart />
                  </ProtectedRoute>
                } />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/orders" element={
                  <ProtectedRoute>
                    <OrderHistory />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                } />
                <Route path="/admin-dashboard" element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/user-management" element={
                  <ProtectedRoute>
                    <UserManagement />
                  </ProtectedRoute>
                } />
                <Route path="/order-management" element={
                  <ProtectedRoute>
                    <AdminOrderManagement />
                  </ProtectedRoute>
                } />
                <Route path="/coupons" element={
                  <ProtectedRoute>
                    <Coupons />
                  </ProtectedRoute>
                } />
                <Route path="/inventory" element={
                  <ProtectedRoute>
                    <InventoryManagement />
                  </ProtectedRoute>
                } />
                <Route path="/knowledge-base" element={
                  <ProtectedRoute>
                    <DynamicKnowledgeBase />
                  </ProtectedRoute>
                } />
                
                <Route path="/ollama-ai-service" element={
                  <ProtectedRoute>
                    <OllamaAIServicePage />
                  </ProtectedRoute>
                } />

                <Route path="/owasp-top-10" element={<OwaspTop10Page />} />
                <Route path="/attacks" element={
                  <ProtectedRoute>
                    <AttacksPage />
                  </ProtectedRoute>
                } />
                <Route path="/challenges" element={
                  <ProtectedRoute>
                    <ChallengePage />
                  </ProtectedRoute>
                } />

              </Routes>
              </Box>
              
              <ChatBot />
              <Footer />
            </div>
          </DefenseProvider>
          </ChatProvider>
        </SearchProvider>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ThemeToggleProvider>
      <AppContent />
    </ThemeToggleProvider>
  );
}

export default App;
