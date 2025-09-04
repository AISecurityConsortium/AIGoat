import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Header from './components/Header';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import Login from './components/Login';
import SignUp from './components/SignUp';
import OrderHistory from './components/OrderHistory';
import SearchResults from './components/SearchResults';
import ProtectedRoute from './components/ProtectedRoute';

import ChatBot from './components/ChatBot';
import UserProfile from './components/UserProfile';
import UserManagement from './components/UserManagement';
import AdminOrderManagement from './components/AdminOrderManagement';
import AdminDashboard from './components/AdminDashboard';
import Coupons from './components/Coupons';
import InventoryManagement from './components/InventoryManagement';
import OllamaAIServicePage from './components/OllamaAIServicePage';
import { SearchProvider } from './contexts/SearchContext';
import { ChatProvider } from './contexts/ChatContext';

// Feature flag imports
import { useFeatureFlag } from './hooks/useFeatureFlags';

// Dynamic RAG component wrapper
const DynamicRAGChat = () => {
  const { enabled: ragEnabled, loading } = useFeatureFlag('rag_system');
  
  if (loading) return null;
  if (!ragEnabled) return null;
  
  const RAGChat = require('./components/RAGChat').default;
  return <RAGChat />;
};

const DynamicKnowledgeBase = () => {
  const { enabled: ragEnabled, loading } = useFeatureFlag('rag_system');
  
  if (loading) return null;
  if (!ragEnabled) return null;
  
  const KnowledgeBaseManagement = require('./components/KnowledgeBaseManagement').default;
  return <KnowledgeBaseManagement />;
};



function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <SearchProvider>
          <ChatProvider>
            <div className="App">
              <Header />
              <Routes>
                <Route path="/" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/search" element={
                  <ProtectedRoute>
                    <SearchResults />
                  </ProtectedRoute>
                } />
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
                <Route path="/rag-chat" element={
                  <ProtectedRoute>
                    <DynamicRAGChat />
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

              </Routes>
              
              {/* Floating Chat Bot - appears on all pages when logged in */}
              <ChatBot />
            </div>
          </ChatProvider>
        </SearchProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
