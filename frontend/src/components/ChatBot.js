import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paper,
  TextField,
  Typography,
  Box,
  Chip,
  Alert,
  Avatar,
  IconButton,
  Fab,
  Collapse,
  Zoom,
  InputAdornment,
  Button,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Chat as ChatIcon,
  Remove as MinimizeIcon,
} from '@mui/icons-material';
import { useSearch } from '../contexts/SearchContext';
import { useChat } from '../contexts/ChatContext';
import { useDefense } from '../contexts/DefenseContext';
import { getApiUrl } from '../config/api';

const chatAnimations = `
  @keyframes bounceDot {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.15); }
  }
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const THINKING_PHRASES = [
  'Thinking',
  'Analyzing your question',
  'Searching knowledge base',
  'Crafting response',
  'Reasoning',
  'Almost there',
];

const ChatBot = () => {
  const { chatInput, setChatInput } = useSearch();
  const { isChatOpen, openChat } = useChat();
  const { defenseLevel, levelDetails } = useDefense();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(0);
  const messagesEndRef = useRef(null);
  const prevDefenseLevel = useRef(defenseLevel);

  const isLoggedIn = !!localStorage.getItem('token');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      setThinkingPhrase(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingPhrase((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [loading]);

  // Inject system message when defense level changes
  useEffect(() => {
    if (prevDefenseLevel.current !== defenseLevel && messages.length > 0) {
      const systemMsg = {
        id: Date.now(),
        text: `Defense level changed to Level ${defenseLevel} (${levelDetails.name}) ${levelDetails.icon}`,
        sender: 'system',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, systemMsg]);
    }
    prevDefenseLevel.current = defenseLevel;
  }, [defenseLevel, levelDetails, messages.length]);

  const getChatHistoryKey = () => {
    const token = localStorage.getItem('token');
    if (token) {
      const parts = token.split('_');
      if (parts.length >= 3) {
        const username = parts[2];
        return `chat_history_${username}`;
      }
    }
    return 'chat_history_default';
  };

  const saveChatHistory = (msgs) => {
    try {
      const key = getChatHistoryKey();
      const historyToSave = msgs.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
      }));
      localStorage.setItem(key, JSON.stringify(historyToSave));
    } catch (err) {
      console.error('Error saving chat history:', err);
    }
  };

  const loadChatHistory = useCallback(() => {
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
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
    return null;
  }, []);

  useEffect(() => {
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
  }, [isLoggedIn, loadChatHistory]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: chatInput,
      sender: 'user',
      timestamp: new Date(),
    };

    const botMsgId = Date.now() + 1;
    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const kbEnabled = localStorage.getItem('kb_integration') === 'true';
      const activeLabId = localStorage.getItem('active_lab_id');
      const chatBody = { message: chatInput, use_kb: kbEnabled };
      if (activeLabId) {
        chatBody.lab_id = activeLabId;
      }
      const resp = await fetch(getApiUrl('/api/chat/stream'), {
        method: 'POST',
        headers,
        body: JSON.stringify(chatBody),
      });

      if (!resp.ok) {
        const status = resp.status;
        if (status === 401) {
          throw new Error('AUTH');
        }
        throw new Error(`HTTP ${status}`);
      }

      setMessages(prev => [
        ...prev,
        { id: botMsgId, text: '', sender: 'bot', timestamp: new Date() },
      ]);
      setLoading(false);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            if (chunk.replace !== undefined) {
              setMessages(prev =>
                prev.map(m => (m.id === botMsgId ? { ...m, text: chunk.replace } : m))
              );
            } else if (chunk.token) {
              setMessages(prev =>
                prev.map(m => (m.id === botMsgId ? { ...m, text: m.text + chunk.token } : m))
              );
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);

      let errorText = "Sorry, I'm having trouble connecting right now. Please try again later.";
      if (err.message === 'AUTH') {
        errorText = "Please log in to chat with Cracky. You can use the demo accounts: Alice, Bob, Charlie, or Frank.";
      }

      setError('Failed to send message. Please try again.');
      setMessages(prev => [
        ...prev,
        { id: botMsgId, text: errorText, sender: 'bot', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleChat = () => {
    if (isChatOpen) {
      setIsMinimized(!isMinimized);
    } else {
      openChat();
      setIsMinimized(false);
    }
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
    } catch (err) {
      console.error('Error clearing chat history:', err);
    }
  };

  // Render a single message bubble
  const renderMessageContent = (message) => {
    // System messages (defense level changes)
    if (message.sender === 'system') {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Chip
            label={message.text}
            size="small"
            sx={{
              bgcolor: (t) => t.palette.custom?.surface?.elevated ?? alpha(t.palette.primary.main, 0.08),
              color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary,
              fontSize: '0.68rem',
              height: 24,
              border: '1px solid',
              borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
            }}
          />
        </Box>
      );
    }

    const isBotMessage = message.sender === 'bot';
    const isUserMessage = message.sender === 'user';

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: isUserMessage ? 'flex-end' : 'flex-start',
          mb: 1,
        }}
      >
        <Box
          sx={{
            maxWidth: '70%',
            p: 1.5,
            borderRadius: isUserMessage ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            bgcolor: isUserMessage
              ? (t) => t.palette.custom?.brand?.primaryMuted ?? alpha(t.palette.primary.main, 0.1)
              : (t) => t.palette.custom?.surface?.elevated ?? alpha(t.palette.background.paper, 0.5),
            border: '1px solid',
            borderColor: isUserMessage
              ? (t) => alpha(t.palette.custom?.brand?.primary ?? t.palette.primary.main, 0.25)
              : (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
            color: (t) => t.palette.text.primary,
            fontSize: '0.875rem',
            lineHeight: 1.4,
            wordWrap: 'break-word',
          }}
        >
          {isBotMessage && !message.text ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                  animation: 'pulseGlow 1.4s ease-in-out infinite',
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary,
                  fontSize: '0.82rem',
                  fontStyle: 'italic',
                }}
              >
                Writing
              </Typography>
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: '2px',
                  height: '14px',
                  bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                  animation: 'cursorBlink 0.8s step-end infinite',
                  ml: -0.25,
                }}
              />
            </Box>
          ) : (
            <>
              {/* L0: render bot HTML unsafely (demonstrates OWASP LLM05); L1+: escaped text */}
              {isBotMessage && defenseLevel === 0 ? (
                <Typography
                  variant="body2"
                  component="div"
                  sx={{ whiteSpace: 'pre-wrap', fontWeight: 400, '& img': { maxWidth: '100%' } }}
                  dangerouslySetInnerHTML={{ __html: message.text }}
                />
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontWeight: isUserMessage ? 500 : 400 }}>
                  {message.text}
                </Typography>
              )}
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.5, opacity: 0.7, fontSize: '0.7rem' }}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </>
          )}
        </Box>
      </Box>
    );
  };

  if (!isLoggedIn) return null;

  return (
    <>
      <style>{chatAnimations}</style>
      
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
            bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
            '&:hover': { bgcolor: (t) => t.palette.primary.dark },
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
            width: isMinimized ? 280 : 380,
            height: isMinimized ? 52 : 520,
            transition: 'all 0.3s ease',
          }}
        >
          <Paper
            elevation={8}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: (t) => t.palette.custom?.surface?.main ?? t.palette.background.paper,
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid',
              borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
            }}
          >
            {/* Header - Frosted glass */}
            <Box
              sx={{
                backdropFilter: 'blur(20px)',
                backgroundColor: (t) => alpha(t.palette.custom?.surface?.elevated ?? t.palette.background.paper, 0.85),
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: '1px solid',
                borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                cursor: 'pointer',
              }}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <Avatar
                sx={{
                  bgcolor: (t) => t.palette.custom?.brand?.primaryMuted ?? alpha(t.palette.primary.main, 0.2),
                  width: 28,
                  height: 28,
                  color: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                }}
              >
                <BotIcon fontSize="small" />
              </Avatar>
              <Typography variant="subtitle1" sx={{ color: (t) => t.palette.text.primary, fontWeight: 600, flex: 1 }}>
                Cracky AI
              </Typography>
              <Chip
                label={levelDetails.shortLabel}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: `${levelDetails.color}30`,
                  color: levelDetails.color,
                  border: `1px solid ${levelDetails.color}50`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                sx={{
                  color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary,
                  ml: 0.25,
                  '&:hover': { color: (t) => t.palette.text.primary },
                }}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                <MinimizeIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>

            {/* Chat Content */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                    <Button
                      size="small"
                      variant="text"
                      onClick={clearChatHistory}
                      sx={{
                        minWidth: 'auto',
                        p: 0,
                        fontSize: '0.75rem',
                        color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary,
                        '&:hover': { color: (t) => t.palette.error.main, bgcolor: 'transparent' },
                      }}
                    >
                      Clear chat
                    </Button>
                  </Box>
                  {messages.map((message) => (
                    <React.Fragment key={message.id}>
                      {renderMessageContent(message)}
                    </React.Fragment>
                  ))}
                  
                  {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1, animation: 'fadeInUp 0.3s ease-out' }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '16px 16px 16px 4px',
                          bgcolor: (t) => t.palette.custom?.surface?.elevated ?? alpha(t.palette.background.paper, 0.5),
                          border: '1px solid',
                          borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.75,
                          minWidth: 180,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {[0, 1, 2].map((i) => (
                              <Box
                                key={i}
                                sx={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                                  animation: `bounceDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                                }}
                              />
                            ))}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary,
                              fontSize: '0.82rem',
                              fontWeight: 500,
                              animation: 'fadeInUp 0.4s ease-out',
                            }}
                            key={thinkingPhrase}
                          >
                            {THINKING_PHRASES[thinkingPhrase]}...
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            height: 2,
                            borderRadius: 1,
                            background: (t) =>
                              `linear-gradient(90deg, transparent, ${t.palette.custom?.brand?.primary ?? t.palette.primary.main}, transparent)`,
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.8s ease-in-out infinite',
                            opacity: 0.5,
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                  
                  <div ref={messagesEndRef} />
                </Box>

                {/* Input Area - Frosted glass */}
                <Box
                  sx={{
                    p: 2,
                    backdropFilter: 'blur(20px)',
                    backgroundColor: (t) => alpha(t.palette.custom?.surface?.elevated ?? t.palette.background.paper, 0.85),
                    borderTop: '1px solid',
                    borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                  }}
                >
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Type your message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    size="small"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleSendMessage}
                            disabled={loading || !chatInput.trim()}
                            size="small"
                            sx={{
                              bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                              color: (t) => t.palette.primary.contrastText,
                              '&:hover': { bgcolor: (t) => t.palette.primary.dark },
                              '&:disabled': {
                                bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                                color: (t) => alpha(t.palette.primary.contrastText ?? '#fff', 0.5),
                              },
                            }}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.875rem',
                        height: 44,
                        borderRadius: 20,
                        backgroundColor: (t) => alpha(t.palette.custom?.surface?.main ?? t.palette.background.paper, 0.6),
                        '& fieldset': {
                          borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                        },
                        '&:hover fieldset': {
                          borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                        },
                      },
                      '& .MuiInputBase-input': {
                        color: (t) => t.palette.text.primary,
                        '&::placeholder': {
                          color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary,
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  {error && (
                    <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem', '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                      {error}
                    </Alert>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Box>
      </Collapse>
    </>
  );
};

export default ChatBot;
