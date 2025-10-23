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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import Layout from '../components/Layout';
import MedicineModal from '../components/MedicineModal';

// Helper function to format YYYY-MM-DD date to MM/YYYY for display
const formatExpiryDisplay = (dateString) => {
  if (!dateString || dateString.length < 7) return '-';
  try {
      // Assumes dateString is 'YYYY-MM-DD'
      const year = dateString.substring(0, 4);
      const month = dateString.substring(5, 7);
      const formattedMonth = month.padStart(2, '0');
      return `${formattedMonth}/${year}`;
  } catch (e) {
      console.error("Error formatting expiry date for display:", dateString, e);
      return '-';
  }
};

// Helper function for full date display (used in alert)
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return '-';
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (isNaN(date)) return '-';
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
  const [lowStockMedicines, setLowStockMedicines] = useState([]);
  const [showExpiryAlert, setShowExpiryAlert] = useState(true);
  const [showLowStockAlert, setShowLowStockAlert] = useState(true);

  // Check both expiry and low stock
  const checkWarnings = (medicineList) => {
    // Expiry Check
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
          console.error("Error parsing expiry date for warning check:", med.product_name, e);
          return false;
      }
    });
    setExpiringMedicines(expiring);
    setShowExpiryAlert(expiring.length > 0);

    // Low Stock Check
    const lowStock = medicineList.filter(med => {
        const reminderQty = med.reminder_quantity ?? 0;
        const currentStock = med.stock ?? 0;
        // Trigger if stock is positive but at or below reminder level
        return currentStock > 0 && reminderQty > 0 && currentStock <= reminderQty;
    });
    setLowStockMedicines(lowStock);
    setShowLowStockAlert(lowStock.length > 0);
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
    setLowStockMedicines([]);
    setShowExpiryAlert(false); // Reset visibility
    setShowLowStockAlert(false); // Reset visibility

    const { data, error } = await supabase
      .from('medicines')
      .select('*') // Selects all columns including the new ones
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMedicines(data);
      setFilteredMedicines(data); // Initialize filtered list
      checkWarnings(data); // Check warnings based on fetched data
    } else if (error) {
       console.error("Error fetching medicines:", error);
       alert("Failed to load inventory.");
       setMedicines([]); // Ensure state is empty on error
       setFilteredMedicines([]);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    // Use window.confirm for simple confirmation
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;

    setLoading(true); // Indicate loading state during deletion
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    setLoading(false); // Stop loading indicator

    if (!error) {
      fetchMedicines(); // Refetch to update list and warnings
    } else {
      console.error("Error deleting medicine:", error);
      alert("Failed to delete medicine."); // Inform user
    }
  };


  const handleEdit = (medicine) => {
    setEditingMedicine(medicine);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingMedicine(null);
    fetchMedicines(); // Refetch data after modal closes (add or edit might have changed data)
  };

  const handleAddNew = () => {
    setEditingMedicine(null); // Ensure no medicine data is passed for adding new
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
            sx={{ mb: 2 }}
            onClose={handleCloseExpiryAlert}
        >
          <AlertTitle>Expiry Warning</AlertTitle>
          Medicines expiring within the next month:
          <List dense sx={{ pt: 0, maxHeight: 150, overflowY: 'auto' }}>
            {expiringMedicines.map(med => (
              <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                <ListItemText
                  primary={`${med.product_name} (Batch: ${med.batch_no})`}
                  secondary={`Expires: ${formatDate(med.expiry_date)}`} // Use full date in alert
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Low Stock Warning Alert */}
      {lowStockMedicines.length > 0 && showLowStockAlert && (
        <Alert
            severity="info"
            icon={<Inventory2OutlinedIcon fontSize="inherit" />}
            sx={{ mb: 3 }}
            onClose={handleCloseLowStockAlert}
        >
          <AlertTitle>Low Stock Reminder</AlertTitle>
          Medicines at or below reminder quantity:
          <List dense sx={{ pt: 0, maxHeight: 150, overflowY: 'auto' }}>
            {lowStockMedicines.map(med => (
              <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                <ListItemText
                  primary={`${med.product_name} (Batch: ${med.batch_no})`}
                  secondary={`Current: ${med.stock}, Reminder at: ${med.reminder_quantity}`}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Header and Search Bar */}
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

      {/* Inventory Table */}
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
            minWidth: 1400, // Adjusted minWidth for the new columns
            '& .MuiTableCell-root': {
              border: '1px solid rgba(224, 224, 224, 1)',
              padding: '8px 10px',
              whiteSpace: 'nowrap',
            }
          }} size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                {/* --- Updated Headers --- */}
                <TableCell sx={{ fontWeight: 'bold' }}>Product Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Shop Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Batch No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Expiry (MM/YYYY)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>No of Items</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Drug Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Stock</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Purchase Rate</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Purch Disc (%)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actual Purch Cost</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>GST (%)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>MRP</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Sell Disc (%)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                {/* ----------------------- */}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedicines.map((medicine) => {
                const isExpiring = expiringMedicines.some(exp => exp.id === medicine.id);
                const isLowStock = lowStockMedicines.some(low => low.id === medicine.id);
                // Directly use the stored actual_purchase_cost
                const actualPurchaseCost = medicine.actual_purchase_cost;

                return (
                  <TableRow key={medicine.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    {/* --- Updated Data Cells --- */}
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                      {medicine.product_name}
                    </TableCell>
                    <TableCell>{medicine.shop_name}</TableCell>
                    <TableCell>{medicine.batch_no}</TableCell>
                    <TableCell sx={{
                        backgroundColor: isExpiring ? 'warning.light' : 'inherit',
                        color: isExpiring ? 'warning.contrastText' : 'inherit',
                      }}>
                      {formatExpiryDisplay(medicine.expiry_date)} {/* Use MM/YYYY format */}
                    </TableCell>
                    <TableCell>{medicine.no_of_items}</TableCell>
                    <TableCell>{medicine.drug_type}</TableCell>
                    <TableCell sx={{
                        backgroundColor: isLowStock ? 'info.light' : 'inherit',
                        color: isLowStock ? 'info.contrastText' : 'inherit',
                        fontWeight: isLowStock ? 'bold' : 'normal',
                      }}>
                      {medicine.stock}
                    </TableCell>
                    <TableCell>
                      {typeof medicine.purchase_rate === 'number' ? `₹${medicine.purchase_rate.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {medicine.purchase_discount ? `${medicine.purchase_discount.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>
                      {typeof actualPurchaseCost === 'number' ? `₹${actualPurchaseCost.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {typeof medicine.gst === 'number' ? `${medicine.gst.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell>
                      {typeof medicine.mrp === 'number' ? `₹${medicine.mrp.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {medicine.discount ? `${medicine.discount.toFixed(2)}%` : '-'}
                    </TableCell>
                    {/* -------------------------- */}
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

      {/* Medicine Modal */}
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
