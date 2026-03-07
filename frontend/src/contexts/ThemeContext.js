import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

const BODY_FONT = [
  '"Inter"',
  '"SF Pro Display"',
  '-apple-system',
  'BlinkMacSystemFont',
  'sans-serif',
].join(',');

const MONO_FONT = [
  '"JetBrains Mono"',
  '"Fira Code"',
  '"Source Code Pro"',
  'monospace',
].join(',');

const commonTypography = {
  fontFamily: BODY_FONT,
  h1: {
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
  },
  h6: {
    fontSize: '1.05rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
  },
  body1: {
    fontSize: '0.9rem',
    lineHeight: 1.65,
    letterSpacing: '-0.005em',
    fontWeight: 400,
  },
  body2: {
    fontSize: '0.82rem',
    lineHeight: 1.6,
    letterSpacing: '-0.003em',
    fontWeight: 400,
  },
  button: {
    fontSize: '0.82rem',
    fontWeight: 600,
    textTransform: 'none',
    letterSpacing: '0.01em',
  },
  caption: {
    fontSize: '0.72rem',
    lineHeight: 1.4,
    letterSpacing: '0.02em',
    fontWeight: 500,
  },
  overline: {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6366f1', light: '#a5b4fc', dark: '#4f46e5', contrastText: '#FFFFFF' },
    secondary: { main: '#4ade80', light: '#86efac', dark: '#22c55e', contrastText: '#FFFFFF' },
    error: { main: '#ef4444', light: '#fca5a5', dark: '#dc2626' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    info: { main: '#6366f1', light: '#a5b4fc', dark: '#4f46e5' },
    success: { main: '#4ade80', light: '#86efac', dark: '#22c55e' },
    background: { default: '#0a0a0f', paper: '#12121e' },
    text: { primary: '#e2e8f0', secondary: '#94a3b8' },
    divider: 'rgba(255, 255, 255, 0.08)',
    custom: {
      surface: { main: '#12121e', elevated: '#1a1a2e', sunken: '#0a0a0f' },
      border: { subtle: 'rgba(255,255,255,0.06)', medium: 'rgba(255,255,255,0.1)', strong: 'rgba(255,255,255,0.2)' },
      text: { heading: '#e2e8f0', body: '#c8d0db', muted: '#64748b', accent: '#a5b4fc' },
      overlay: { hover: 'rgba(255,255,255,0.04)', active: 'rgba(99,102,241,0.1)', backdrop: 'rgba(0,0,0,0.5)' },
      brand: { primary: '#6366f1', primaryMuted: 'rgba(99,102,241,0.15)', accent: '#4ade80', accentMuted: 'rgba(74,222,128,0.15)' },
    },
  },
  typography: commonTypography,
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.4)',
    '0px 4px 6px rgba(0, 0, 0, 0.35)',
    '0px 10px 15px rgba(0, 0, 0, 0.3)',
    '0px 20px 25px rgba(0, 0, 0, 0.3)',
    ...Array(20).fill('0px 25px 50px rgba(0, 0, 0, 0.4)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 22px',
          fontSize: '0.82rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)' },
        },
        contained: {
          backgroundColor: '#6366f1',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: '#4f46e5', boxShadow: '0px 4px 12px rgba(99, 102, 241, 0.35)' },
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.15)',
          color: '#e2e8f0',
          borderWidth: '1.5px',
          '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderWidth: '1.5px' },
        },
        text: {
          color: '#e2e8f0',
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: '#12121e',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundImage: 'none',
          '&:hover': { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.45)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 14, backgroundImage: 'none', boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.3)' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            color: '#e2e8f0',
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: '2px' },
          },
          '& .MuiInputLabel-root': { color: '#94a3b8' },
          '& .MuiInputBase-input': { color: '#e2e8f0', '&::placeholder': { color: '#64748b', opacity: 1 } },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#0a0a0f', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', boxShadow: 'none', backgroundImage: 'none' },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
    MuiRating: {
      styleOverrides: {
        root: { '& .MuiRating-iconFilled': { color: '#f59e0b' }, '& .MuiRating-iconHover': { color: '#f59e0b' } },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, backgroundColor: '#12121e', backgroundImage: 'none', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0px 25px 50px rgba(0, 0, 0, 0.5)' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, backgroundColor: '#12121e', backgroundImage: 'none', boxShadow: '0px 20px 40px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 8, margin: '2px 8px', color: '#e2e8f0', '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.1)' } },
      },
    },
    MuiTab: { styleOverrides: { root: { color: '#94a3b8', '&.Mui-selected': { color: '#e2e8f0' } } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(255, 255, 255, 0.06)', color: '#e2e8f0' },
        head: { color: '#94a3b8', fontWeight: 600 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(255, 255, 255, 0.08)' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiSelect: { styleOverrides: { icon: { color: '#94a3b8' } } },
    MuiInputLabel: { styleOverrides: { root: { color: '#94a3b8' } } },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4f46e5', light: '#818cf8', dark: '#3730a3', contrastText: '#FFFFFF' },
    secondary: { main: '#16a34a', light: '#4ade80', dark: '#15803d', contrastText: '#FFFFFF' },
    error: { main: '#dc2626', light: '#f87171', dark: '#b91c1c' },
    warning: { main: '#d97706', light: '#fbbf24', dark: '#b45309' },
    info: { main: '#4f46e5', light: '#818cf8', dark: '#3730a3' },
    success: { main: '#16a34a', light: '#4ade80', dark: '#15803d' },
    background: { default: '#f8f9fc', paper: '#ffffff' },
    text: { primary: '#1e293b', secondary: '#64748b' },
    divider: 'rgba(0, 0, 0, 0.08)',
    custom: {
      surface: { main: '#ffffff', elevated: '#f8f9fc', sunken: '#f1f5f9' },
      border: { subtle: 'rgba(0,0,0,0.06)', medium: 'rgba(0,0,0,0.12)', strong: 'rgba(0,0,0,0.2)' },
      text: { heading: '#0f172a', body: '#334155', muted: '#94a3b8', accent: '#4f46e5' },
      overlay: { hover: 'rgba(0,0,0,0.04)', active: 'rgba(79,70,229,0.06)', backdrop: 'rgba(0,0,0,0.12)' },
      brand: { primary: '#4f46e5', primaryMuted: 'rgba(79,70,229,0.1)', accent: '#16a34a', accentMuted: 'rgba(22,163,74,0.1)' },
    },
  },
  typography: commonTypography,
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 22px',
          fontSize: '0.82rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)' },
        },
        contained: {
          backgroundColor: '#4f46e5',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: '#4338ca', boxShadow: '0px 4px 12px rgba(79, 70, 229, 0.3)' },
        },
        outlined: {
          borderColor: 'rgba(0, 0, 0, 0.15)',
          color: '#1e293b',
          borderWidth: '1.5px',
          '&:hover': { borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.04)', borderWidth: '1.5px' },
        },
        text: {
          color: '#1e293b',
          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: '#ffffff',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08), 0px 4px 12px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          backgroundImage: 'none',
          '&:hover': { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.1)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 14, backgroundImage: 'none' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': { borderColor: 'rgba(0, 0, 0, 0.15)' },
            '&:hover fieldset': { borderColor: 'rgba(0, 0, 0, 0.3)' },
            '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px' },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#ffffff', borderBottom: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.04)', backgroundImage: 'none' },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
    MuiRating: {
      styleOverrides: {
        root: { '& .MuiRating-iconFilled': { color: '#f59e0b' }, '& .MuiRating-iconHover': { color: '#f59e0b' } },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, border: '1px solid rgba(0, 0, 0, 0.08)' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(0, 0, 0, 0.06)' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 8, margin: '2px 8px', '&:hover': { backgroundColor: 'rgba(79, 70, 229, 0.06)' } },
      },
    },
    MuiTab: { styleOverrides: { root: { color: '#64748b', '&.Mui-selected': { color: '#1e293b' } } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(0, 0, 0, 0.06)' },
        head: { fontWeight: 600 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(0, 0, 0, 0.08)' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
  },
});

export const ThemeToggleProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('aigoat-theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('aigoat-theme', next);
      return next;
    });
  };

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeToggleProvider');
  return ctx;
};
