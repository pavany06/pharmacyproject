// src/components/Layout.jsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import InventoryIcon from '@mui/icons-material/Inventory';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import HistoryIcon from '@mui/icons-material/History'; // Imported History Icon
import LogoutIcon from '@mui/icons-material/Logout';

export default function Layout({ children }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Updated navItems to include History
  const navItems = [
    { path: '/inventory', label: 'Inventory', icon: <InventoryIcon sx={{ mr: 1 }} /> },
    { path: '/new-sale', label: 'New Sale', icon: <ShoppingCartIcon sx={{ mr: 1 }} /> },
    { path: '/history', label: 'History', icon: <HistoryIcon sx={{ mr: 1 }} /> }, // Added History button
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <MedicalServicesIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Sri Sai Pharmacy
          </Typography>

          {/* Navigation for larger screens */}
          <Box sx={{ display: { xs: 'none', sm: 'block' }, mr: 2 }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    color: 'white',
                    borderBottom: isActive ? '2px solid white' : 'none',
                    borderRadius: 0,
                    paddingBottom: '4px',
                    mr: 1
                  }}
                  startIcon={item.icon}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          <Button
            color="inherit"
            onClick={handleSignOut}
            startIcon={<LogoutIcon />}
          >
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>
      
      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for the fixed AppBar */}
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>
    </Box>
  );
}