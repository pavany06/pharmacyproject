// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
// import Customers from './pages/Customers'; // Removed
import NewSale from './pages/NewSale';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Inventory />
          </ProtectedRoute>
        }
      />
      {/* <Route
        path="/customers" // Removed
        element={
          <ProtectedRoute>
            <Customers />
          </ProtectedRoute>
        }
      /> */}
      <Route
        path="/new-sale"
        element={
          <ProtectedRoute>
            <NewSale />
          </ProtectedRoute>
        }
      />
      {/* Default route navigates to inventory */}
      <Route path="/" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}

export default App;