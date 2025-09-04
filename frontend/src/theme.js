import { createTheme } from '@mui/material/styles';

// Apple-inspired theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#000000', // Black for buttons
      light: '#333333',
      dark: '#000000',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#34C759', // Apple's green
      light: '#6DDC8C',
      dark: '#28A745',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#FF3B30', // Apple's red
      light: '#FF6B6B',
      dark: '#CC2E24',
    },
    warning: {
      main: '#FF9500', // Apple's orange
      light: '#FFB340',
      dark: '#CC7700',
    },
    info: {
      main: '#5AC8FA', // Apple's light blue
      light: '#7DD8FB',
      dark: '#47A0C7',
    },
    success: {
      main: '#34C759', // Apple's green
      light: '#6DDC8C',
      dark: '#28A745',
    },
    background: {
      default: '#F2F2F7', // Apple's light gray background
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1D1D1F', // Apple's dark text
      secondary: '#86868B', // Apple's secondary text
    },
    divider: '#E5E5EA', // Apple's divider color
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 12, // Apple's rounded corners
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
    '0px 4px 6px rgba(0, 0, 0, 0.1), 0px 2px 4px rgba(0, 0, 0, 0.06)',
    '0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)',
    '0px 20px 25px rgba(0, 0, 0, 0.1), 0px 10px 10px rgba(0, 0, 0, 0.04)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: '0.875rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
          },
        },
        contained: {
          backgroundColor: '#000000',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: '#333333',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          },
        },
        outlined: {
          borderColor: '#000000',
          color: '#000000',
          borderWidth: '1.5px',
          '&:hover': {
            borderColor: '#000000',
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            borderWidth: '1.5px',
          },
        },
        text: {
          color: '#000000',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1), 0px 2px 4px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          '&:hover': {
            boxShadow: '0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1), 0px 2px 4px rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              borderColor: '#E5E5EA',
            },
            '&:hover fieldset': {
              borderColor: '#000000',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#000000',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiRating: {
      styleOverrides: {
        root: {
          '& .MuiRating-iconFilled': {
            color: '#FF9500',
          },
          '& .MuiRating-iconHover': {
            color: '#FF9500',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0px 25px 50px rgba(0, 0, 0, 0.15), 0px 10px 20px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
  },
});

export default theme;
