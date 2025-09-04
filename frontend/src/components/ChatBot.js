import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  TextField,
  Typography,
  Box,
  Chip,
  Alert,
  Avatar,
  IconButton,
  CircularProgress,
  Fab,
  Collapse,
  Zoom,
} from '@mui/material';
import { 
  Send as SendIcon, 
  SmartToy as BotIcon,
  Chat as ChatIcon,
  Close as CloseIcon,
  Minimize as MinimizeIcon,
} from '@mui/icons-material';
import { useSearch } from '../contexts/SearchContext';
import { useChat } from '../contexts/ChatContext';
import axios from 'axios';

// Add CSS keyframes for pulse animation
const pulseKeyframes = `
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;

const ChatBot = () => {
  const { chatInput, setChatInput } = useSearch();
  const { isChatOpen, openChat, closeChat } = useChat();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 400, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef(null);

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('token');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // Save chat history whenever messages change
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  // Helper function to get user-specific storage key
  const getChatHistoryKey = () => {
    const token = localStorage.getItem('token');
    if (token) {
      // Extract username from token (demo_token_username_userid)
      const parts = token.split('_');
      if (parts.length >= 3) {
        const username = parts[2]; // username is the third part
        return `chat_history_${username}`;
      }
    }
    return 'chat_history_default';
  };

  // Helper function to save chat history
  const saveChatHistory = (messages) => {
    try {
      const key = getChatHistoryKey();
      const historyToSave = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
      }));
      localStorage.setItem(key, JSON.stringify(historyToSave));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  // Helper function to load chat history
  const loadChatHistory = () => {
    try {
      const key = getChatHistoryKey();
      const savedHistory = localStorage.getItem(key);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        return parsedHistory.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
    return null;
  };

  useEffect(() => {
    // Load existing chat history or add welcome message
    const savedHistory = loadChatHistory();
    if (savedHistory && savedHistory.length > 0) {
      setMessages(savedHistory);
    } else {
      setMessages([
        {
          id: 1,
          text: "Hi! I'm Cracky, your AI assistant. I can help you with products, orders, and more. What can I help you with?",
          sender: 'bot',
          timestamp: new Date(),
        }
      ]);
    }
  }, [isLoggedIn]); // Re-run when login status changes

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: chatInput,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setLoading(true);
    setError('');

    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      const headers = {};
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post('http://localhost:8000/api/chat/', {
        message: chatInput
      }, { headers });

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.reply,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      let errorText = "Sorry, I'm having trouble connecting right now. Please try again later.";
      
      // Check if it's an authentication error
      if (error.response && error.response.status === 401) {
        errorText = "Please log in to chat with Cracky. You can use the demo accounts: Alice, Bob, or Charlie.";
      }
      
      setError('Failed to send message. Please try again.');
      
      const errorMessage = {
        id: Date.now() + 1,
        text: errorText,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    setChatInput(action);
    // Auto-send the message after a short delay
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    "Show me all products",
    "What's in my cart?",
    "Place an order",
    "Show my order history",
    "Add red team t-shirt to cart",
    "Clear my cart"
  ];

  const handleToggleChat = () => {
    if (isChatOpen) {
      setIsMinimized(!isMinimized);
    } else {
      openChat();
      setIsMinimized(false);
    }
  };

  const handleCloseChat = () => {
    closeChat();
    setIsMinimized(false);
  };

  const clearChatHistory = () => {
    try {
      const key = getChatHistoryKey();
      localStorage.removeItem(key);
      setMessages([
        {
          id: Date.now(),
          text: "Chat history cleared. Hi! I'm Cracky, your AI assistant. I can help you with products, orders, and more. What can I help you with?",
          sender: 'bot',
          timestamp: new Date(),
        }
      ]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  // Resize handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;
    
    const newWidth = Math.max(300, Math.min(800, e.clientX - (window.innerWidth - windowSize.width - 20)));
    const newHeight = Math.max(400, Math.min(700, window.innerHeight - e.clientY - 20));
    
    setWindowSize({
      width: newWidth,
      height: newHeight
    });
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, windowSize.width, windowSize.height]);

  // Don't render anything if user is not logged in
  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      {/* Add CSS keyframes */}
      <style>{pulseKeyframes}</style>
      
      {/* Floating Chat Button */}
      <Zoom in={!isChatOpen}>
        <Fab
          color="primary"
          aria-label="chat"
          onClick={handleToggleChat}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
            },
          }}
        >
          <ChatIcon />
        </Fab>
      </Zoom>

      {/* Chat Window */}
      <Collapse in={isChatOpen} timeout={300}>
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1001,
            width: isMinimized ? '300px' : `${windowSize.width}px`,
            height: isMinimized ? '60px' : `${windowSize.height}px`,
            transition: isResizing ? 'none' : 'all 0.3s ease',
            cursor: isResizing ? 'nw-resize' : 'default',
          }}
        >
          <Paper 
            elevation={8} 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Header */}
            <Box sx={{ 
              background: 'rgba(255,255,255,0.1)', 
              backdropFilter: 'blur(10px)',
              p: 1.5, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              borderBottom: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
            onClick={() => setIsMinimized(!isMinimized)}
            >
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 28, height: 28 }}>
                <BotIcon fontSize="small" />
              </Avatar>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, flex: 1 }}>
                Cracky AI
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  bgcolor: '#4caf50',
                  animation: 'pulse 2s infinite'
                }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Online
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  clearChatHistory();
                }}
                sx={{ color: 'white', ml: 1 }}
                title="Clear chat history"
              >
                <Avatar sx={{ bgcolor: 'transparent', color: 'white', width: 24, height: 24, fontSize: 16, boxShadow: 'none' }}>C</Avatar>
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                sx={{ color: 'white', ml: 1 }}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                <MinimizeIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseChat();
                }}
                sx={{ color: 'white', ml: 1 }}
                title="Close chat"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Chat Content - Only show when not minimized */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <Box sx={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}>
                  {messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '70%',
                          p: 1.5,
                          borderRadius: 2,
                          background: message.sender === 'user' 
                            ? 'rgba(255,255,255,0.9)' 
                            : 'rgba(255,255,255,0.1)',
                          backdropFilter: 'blur(10px)',
                          border: message.sender === 'user' 
                            ? 'none' 
                            : '1px solid rgba(255,255,255,0.2)',
                          color: message.sender === 'user' ? '#333' : 'white',
                          fontSize: '0.875rem',
                          lineHeight: 1.4,
                          wordWrap: 'break-word',
                          position: 'relative',
                        }}
                      >
                        <Typography variant="body2" sx={{ 
                          whiteSpace: 'pre-wrap',
                          fontWeight: message.sender === 'user' ? 500 : 400
                        }}>
                          {message.text}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            display: 'block',
                            mt: 0.5,
                            opacity: 0.7,
                            fontSize: '0.7rem'
                          }}
                        >
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  
                  {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                      <Box sx={{ 
                        p: 1.5,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <CircularProgress size={16} sx={{ color: 'white' }} />
                        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.875rem' }}>
                          Cracky is typing...
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  
                  <div ref={messagesEndRef} />
                </Box>

                {/* Quick Actions */}
                {messages.length === 1 && (
                  <Box sx={{ 
                    p: 2, 
                    background: 'rgba(255,255,255,0.05)',
                    borderTop: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      display: 'block', 
                      mb: 1,
                      fontSize: '0.75rem'
                    }}>
                      Quick actions:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {quickActions.map((action, index) => (
                        <Chip
                          key={index}
                          label={action}
                          size="small"
                          onClick={() => handleQuickAction(action)}
                          sx={{
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            fontSize: '0.7rem',
                            height: 24,
                            '&:hover': {
                              background: 'rgba(255,255,255,0.2)',
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Input Area */}
                <Box sx={{ 
                  p: 2, 
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  borderTop: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      placeholder="Type your message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '0.875rem',
                          height: 40,
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          borderRadius: 2,
                          '& fieldset': {
                            borderColor: 'transparent',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255,255,255,0.3)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'rgba(255,255,255,0.5)',
                          },
                        },
                        '& .MuiInputBase-input': {
                          color: '#333',
                          '&::placeholder': {
                            color: '#666',
                            opacity: 1,
                          },
                        },
                      }}
                    />
                    <IconButton
                      onClick={handleSendMessage}
                      disabled={loading || !chatInput.trim()}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.9)',
                        color: '#333',
                        height: 40,
                        width: 40,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,1)',
                        },
                        '&:disabled': {
                          bgcolor: 'rgba(255,255,255,0.3)',
                          color: 'rgba(255,255,255,0.5)',
                        },
                      }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  {error && (
                    <Alert severity="error" sx={{ 
                      mt: 1, 
                      fontSize: '0.75rem',
                      '& .MuiAlert-message': {
                        fontSize: '0.75rem'
                      }
                    }}>
                      {error}
                    </Alert>
                  )}
                </Box>
              </>
            )}
            
            {/* Resize Handle */}
            {!isMinimized && (
              <Box
                onMouseDown={handleMouseDown}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 20,
                  height: 20,
                  cursor: 'nw-resize',
                  background: 'rgba(255,255,255,0.1)',
                  borderTopLeftRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.2)',
                  },
                  '&::after': {
                    content: '""',
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    borderWidth: '0 0 8px 8px',
                    borderColor: 'transparent transparent rgba(255,255,255,0.6) transparent',
                  }
                }}
                title="Resize chat window"
              />
            )}
          </Paper>
        </Box>
      </Collapse>
    </>
  );
};

export default ChatBot; 