'use client';
import { createTheme } from '@mui/material/styles';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    primary: {
      main: '#4CAF50', // Green for "On Track"
    },
    error: {
      main: '#F44336', // Red for "Nothing Completed"
    },
    warning: {
      main: '#FFC107', // Yellow for "Partial"
    },
    text: {
      primary: '#E0E0E0',
      secondary: '#A0A0A0',
    },
    action: {
      disabledBackground: '#333333', // Gray for "No Data" / Off-system
    }
  },
  typography: {
    fontFamily: roboto.style.fontFamily,
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 500 },
    h3: { fontSize: '1.25rem', fontWeight: 500 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.4 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove elevation overlay in dark mode
        },
      },
    },
  },
});

export default theme;
