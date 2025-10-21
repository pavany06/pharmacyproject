// src/pages/Inventory.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'; // Icon for low stock
import Layout from '../components/Layout';
import MedicineModal from '../components/MedicineModal';

// Helper function to format dates or return '-' if invalid/null
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return '-';
      // Ensure date is parsed as UTC to avoid timezone issues
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (isNaN(date)) return '-';
      // Format as DD/MM/YYYY
      return date.toLocaleDateString('en-GB', { timeZone: 'UTC' });
  } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return '-';
  }
};


export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiringMedicines, setExpiringMedicines] = useState([]);
  const [lowStockMedicines, setLowStockMedicines] = useState([]); // State for low stock items
  const [showExpiryAlert, setShowExpiryAlert] = useState(true);
  const [showLowStockAlert, setShowLowStockAlert] = useState(true); // State for low stock alert visibility


  // Check both expiry and low stock
  const checkWarnings = (medicineList) => {
    // --- Expiry Check ---
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setUTCMonth(oneMonthFromNow.getUTCMonth() + 1);

    const expiring = medicineList.filter(med => {
      if (!med.expiry_date) return false;
      try {
          const parts = med.expiry_date.split('-');
          if (parts.length !== 3) return false;
          const expiryDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
           expiryDate.setUTCHours(0, 0, 0, 0);

          return !isNaN(expiryDate) && expiryDate >= today && expiryDate < oneMonthFromNow;
      } catch (e) {
          console.error("Error parsing expiry date for", med.product_name, ":", e);
          return false;
      }
    });
    setExpiringMedicines(expiring);
    setShowExpiryAlert(expiring.length > 0); // Show alert only if items exist

    // --- Low Stock Check ---
    const lowStock = medicineList.filter(med => {
        // Check if stock is less than or equal to reminder_quantity
        // Handle cases where reminder_quantity might be null or undefined
        const reminderQty = med.reminder_quantity ?? 0; // Default to 0 if null/undefined
        const currentStock = med.stock ?? 0;
        // Trigger if stock is positive but at or below reminder level
        return currentStock > 0 && reminderQty > 0 && currentStock <= reminderQty;
    });
    setLowStockMedicines(lowStock);
    setShowLowStockAlert(lowStock.length > 0); // Show alert only if items exist
  };


  useEffect(() => {
    fetchMedicines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = medicines.filter(
      (medicine) =>
        (medicine.product_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (medicine.shop_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (medicine.batch_no?.toLowerCase() || '').includes(lowerSearchTerm)
    );
    setFilteredMedicines(filtered);
  }, [searchTerm, medicines]);


  const fetchMedicines = async () => {
    setLoading(true);
    setExpiringMedicines([]);
    setLowStockMedicines([]); // Reset low stock state on fetch
    setShowExpiryAlert(false);
    setShowLowStockAlert(false); // Reset low stock alert visibility
    const { data, error } = await supabase
      .from('medicines')
      // Make sure to select the new reminder_quantity column
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMedicines(data);
      setFilteredMedicines(data);
      checkWarnings(data); // Call the combined check function
    } else if (error) {
       console.error("Error fetching medicines:", error);
       alert("Failed to load inventory.");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;

    const { error } = await supabase.from('medicines').delete().eq('id', id);

    if (!error) {
      fetchMedicines(); // Refetch to update list and warnings
    } else {
      console.error("Error deleting medicine:", error);
      alert("Failed to delete medicine.");
    }
  };


  const handleEdit = (medicine) => {
    setEditingMedicine(medicine);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingMedicine(null);
    fetchMedicines(); // Refetch data after modal closes (add or edit)
  };

  const handleAddNew = () => {
    setEditingMedicine(null);
    setIsModalOpen(true);
  };

  const handleCloseExpiryAlert = () => {
      setShowExpiryAlert(false);
  };
  const handleCloseLowStockAlert = () => {
      setShowLowStockAlert(false);
  };

  return (
    <Layout>
      {/* Expiry Warning Alert */}
      {expiringMedicines.length > 0 && showExpiryAlert && (
        <Alert
            severity="warning"
            icon={<WarningAmberIcon fontSize="inherit" />}
            sx={{ mb: 2 }} // Adjusted margin bottom
            onClose={handleCloseExpiryAlert}
        >
          <AlertTitle>Expiry Warning</AlertTitle>
          The following medicines are expiring within the next month:
          <List dense sx={{ pt: 0, maxHeight: 150, overflowY: 'auto' }}>
            {expiringMedicines.map(med => (
              <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                <ListItemText
                  primary={`${med.product_name} (Batch: ${med.batch_no})`}
                  secondary={`Expires: ${formatDate(med.expiry_date)}`}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Low Stock Warning Alert */}
      {lowStockMedicines.length > 0 && showLowStockAlert && (
        <Alert
            severity="info" // Use info or warning severity as you prefer
            icon={<Inventory2OutlinedIcon fontSize="inherit" />}
            sx={{ mb: 3 }}
            onClose={handleCloseLowStockAlert}
        >
          <AlertTitle>Low Stock Reminder</AlertTitle>
          The following medicines are at or below the set reminder quantity:
          <List dense sx={{ pt: 0, maxHeight: 150, overflowY: 'auto' }}>
            {lowStockMedicines.map(med => (
              <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                <ListItemText
                  primary={`${med.product_name} (Batch: ${med.batch_no})`}
                  secondary={`Current Stock: ${med.stock}, Reminder at: ${med.reminder_quantity}`}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Inventory Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddNew}
        >
          New Medicine
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by Product Name, Shop Name, Batch No..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredMedicines.length === 0 ? (
          <Typography sx={{ p: 4, textAlign: 'center' }}>
            {searchTerm ? 'No medicines found matching your search.' : 'No medicines added yet.'}
          </Typography>
        ) : (
          <Table sx={{
            minWidth: 1100,
            '& .MuiTableCell-root': {
              border: '1px solid rgba(224, 224, 224, 1)',
              padding: '8px 10px',
              whiteSpace: 'nowrap',
            }
          }} size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>Shop Name</TableCell>
                <TableCell>Batch No</TableCell>
                <TableCell>Expiry Date</TableCell>
                <TableCell>No of Items</TableCell>
                <TableCell>Drug Type</TableCell>
                <TableCell>Stock</TableCell> {/* No change here */}
                <TableCell>Purchase Rate</TableCell>
                <TableCell>GST (%)</TableCell>
                <TableCell>MRP</TableCell>
                <TableCell>Discount (%)</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedicines.map((medicine) => {
                const isExpiring = expiringMedicines.some(exp => exp.id === medicine.id);
                const isLowStock = lowStockMedicines.some(low => low.id === medicine.id); // Check if low stock

                return (
                  <TableRow key={medicine.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                      {medicine.product_name}
                    </TableCell>
                    <TableCell>{medicine.shop_name}</TableCell>
                    <TableCell>{medicine.batch_no}</TableCell>
                    {/* Expiry Date Cell Highlighting */}
                    <TableCell sx={{
                        backgroundColor: isExpiring ? 'warning.light' : 'inherit',
                        color: isExpiring ? 'warning.contrastText' : 'inherit',
                      }}>
                      {formatDate(medicine.expiry_date)}
                    </TableCell>
                    <TableCell>{medicine.no_of_items}</TableCell>
                    <TableCell>{medicine.drug_type}</TableCell>
                    {/* Stock Cell Highlighting */}
                    <TableCell sx={{
                        backgroundColor: isLowStock ? 'info.light' : 'inherit', // Use info color for low stock
                        color: isLowStock ? 'info.contrastText' : 'inherit',
                        fontWeight: isLowStock ? 'bold' : 'normal', // Optional: make bold
                      }}>
                      {medicine.stock}
                    </TableCell>
                    <TableCell>₹{medicine.purchase_rate?.toFixed(2)}</TableCell>
                    <TableCell>{medicine.gst?.toFixed(2)}%</TableCell>
                    <TableCell>₹{medicine.mrp?.toFixed(2)}</TableCell>
                    <TableCell>{medicine.discount ? `${medicine.discount.toFixed(2)}%` : '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" onClick={() => handleEdit(medicine)}>
                        <EditIcon fontSize="small"/>
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(medicine.id)}>
                        <DeleteIcon fontSize="small"/>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {isModalOpen && (
        <MedicineModal
          open={isModalOpen}
          medicine={editingMedicine}
          onClose={handleModalClose}
        />
      )}
    </Layout>
  );
}