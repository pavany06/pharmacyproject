// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Import MUI components
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

// A simple default theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // A standard blue
    },
    background: {
      default: '#f4f6f8' // A light gray background
    }
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          {/* CssBaseline resets browser styles */}
          <CssBaseline />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);