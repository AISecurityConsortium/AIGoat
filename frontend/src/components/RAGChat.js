import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Chip,
  Alert,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  ShoppingCart as ShoppingCartIcon,
  Info as InfoIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import axios from 'axios';

const RAGChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Generate session ID
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/rag-stats/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Validate input length
    if (input.length > 1000) {
      const errorMessage = { 
        role: 'error', 
        content: 'Message too long. Please keep your message under 1000 characters.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    setLoading(true);
    const userMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await axios.post('/api/rag-chat/', {
        message: input,
        session_id: sessionId
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const botMessage = { 
        role: 'assistant', 
        content: response.data.response,
        context: response.data.context_used,
        suggestions: response.data.suggestions,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, botMessage]);
      setSuggestions(response.data.suggestions || []);
      
    } catch (error) {
      console.error('RAG Chat error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      let errorContent = 'An error occurred while processing your request';
      
      if (error.response?.data?.error) {
        errorContent = error.response.data.error;
      } else if (error.message) {
        errorContent = `Error: ${error.message}`;
      }
      
      const errorMessage = { 
        role: 'error', 
        content: errorContent,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ShoppingCartIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          Product Assistant
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Ask me anything about our Red Team Shop products! I can help you find information about 
          cybersecurity merchandise, red team tools, and security-related products.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Chat Interface */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Product Knowledge Chat
              </Typography>
              
              {/* Messages */}
              <Box sx={{ height: 400, overflowY: 'auto', mb: 2, p: 2, bgcolor: 'grey.50' }}>
                {messages.map((msg, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 1,
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}>
                      <Chip 
                        label={msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : 'Error'} 
                        color={msg.role === 'user' ? 'primary' : msg.role === 'assistant' ? 'success' : 'error'}
                        size="small"
                      />
                      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                    
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: msg.role === 'user' ? 'primary.light' : 'white',
                      color: msg.role === 'user' ? 'white' : 'text.primary',
                      maxWidth: '80%',
                      ml: msg.role === 'user' ? 'auto' : 0
                    }}>
                      <Typography variant="body1">{msg.content}</Typography>
                      
                      {msg.context && msg.context.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Sources: {msg.context.length} product documents referenced
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                ))}
                
                {loading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      Thinking...
                    </Typography>
                  </Box>
                )}
              </Box>
              
              {/* Input */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about products, features, or get recommendations..."
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button 
                  variant="contained" 
                  onClick={sendMessage}
                  disabled={loading}
                  startIcon={<SendIcon />}
                >
                  Send
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Suggestions and Info Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <InfoIcon sx={{ mr: 1 }} />
                Product Suggestions
              </Typography>
              
              {suggestions.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Related Products:
                  </Typography>
                  <List dense>
                    {suggestions.map((suggestion, index) => (
                      <ListItem 
                        key={index} 
                        button 
                        onClick={() => handleSuggestionClick(suggestion)}
                        sx={{ 
                          border: '1px solid #e0e0e0', 
                          borderRadius: 1, 
                          mb: 1,
                          '&:hover': { bgcolor: 'primary.light', color: 'white' }
                        }}
                      >
                        <ListItemText primary={suggestion} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Quick Questions:
              </Typography>
              <List dense>
                <ListItem 
                  button 
                  onClick={() => setInput("What red team tools do you have?")}
                  sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
                >
                  <ListItemText primary="What red team tools do you have?" />
                </ListItem>
                <ListItem 
                  button 
                  onClick={() => setInput("Tell me about cybersecurity apparel")}
                  sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
                >
                  <ListItemText primary="Tell me about cybersecurity apparel" />
                </ListItem>
                <ListItem 
                  button 
                  onClick={() => setInput("What's new in your collection?")}
                  sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
                >
                  <ListItemText primary="What's new in your collection?" />
                </ListItem>
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              {stats && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    System Info:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Knowledge Base: {stats.knowledge_base?.total_documents || 0} documents
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    Your Sessions: {stats.chat_sessions?.user_sessions || 0}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default RAGChat;
