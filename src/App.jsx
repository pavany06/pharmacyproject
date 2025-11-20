// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Inventory from './pages/Inventory';
import NewSale from './pages/NewSale';
import History from './pages/History'; // Import the new History page

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
      <Route
        path="/new-sale"
        element={
          <ProtectedRoute>
            <NewSale />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history" // Added History Route
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />
      {/* Default route navigates to inventory */}
      <Route path="/" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}

export default App;