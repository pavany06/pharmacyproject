// src/pages/Inventory.jsx
import { useState, useEffect } from 'react';
// Corrected import path for supabase
import { supabase } from '../lib/supabase.js';
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

// --- Helper Functions ---

// Parses the leading integer from the item string (e.g., "10 tablets")
const parseUnitsFromItemString = (itemString) => {
    if (!itemString) return null;
    const match = itemString.match(/^\s*(\d+)/);
    const units = match ? parseInt(match[1], 10) : null;
    return units > 0 ? units : null; // Return null if not a positive number
};

// Helper function to format YYYY-MM-DD date to MM/YYYY for display
const formatExpiryDisplay = (dateString) => {
  if (!dateString || dateString.length < 7) return '-';
  try {
      // Assumes dateString is 'YYYY-MM-DD'
      const year = dateString.substring(0, 4);
      const month = dateString.substring(5, 7);
      // Ensure month is two digits
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
      // Use UTC to avoid timezone issues when parsing YYYY-MM-DD
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (isNaN(date)) return '-';
      // Format as DD/MM/YYYY
      return date.toLocaleDateString('en-GB', { timeZone: 'UTC' });
  } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return '-';
  }
};
// --- ---


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

  // --- checkWarnings updated ---
  const checkWarnings = (medicineList) => {
    // Expiry Check (remains the same logic)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Use UTC for comparison
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setUTCMonth(oneMonthFromNow.getUTCMonth() + 1);

    const expiring = medicineList.filter(med => {
      if (!med.expiry_date) return false;
      try {
          const parts = med.expiry_date.split('-');
          if (parts.length !== 3) return false;
          // Parse as UTC
          const expiryDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
           expiryDate.setUTCHours(0, 0, 0, 0); // Ensure time part is zeroed
          return !isNaN(expiryDate) && expiryDate >= today && expiryDate < oneMonthFromNow;
      } catch (e) {
          console.error("Error parsing expiry date for warning check:", med.product_name, e);
          return false;
      }
    });
    setExpiringMedicines(expiring);
    setShowExpiryAlert(expiring.length > 0);

    // Low Stock Check (Updated logic: compare packages)
    const lowStock = medicineList.filter(med => {
        const reminderPackages = med.reminder_quantity ?? 0; // Reminder is in packages
        const currentStockPackages = med.stock ?? 0; // Current stock is in packages
        // Trigger if stock (packages) is positive but at or below reminder level (packages)
        // Also ensure reminder level itself is positive
        return currentStockPackages > 0 && reminderPackages > 0 && currentStockPackages <= reminderPackages;
    });
    setLowStockMedicines(lowStock);
    setShowLowStockAlert(lowStock.length > 0);
  };
  // --- ---

  // --- fetchMedicines updated ---
  const fetchMedicines = async () => {
    setLoading(true);
    setExpiringMedicines([]);
    setLowStockMedicines([]);
    setShowExpiryAlert(false);
    setShowLowStockAlert(false);

    // Select all columns including the new ones and remove user filter
    const { data, error } = await supabase
      .from('medicines')
      .select('*') // Selects all columns
      // Removed .eq('user_id', user.id)
      .order('product_name', { ascending: true }); // Order by product name for consistency

    if (!error && data) {
      setMedicines(data);
      setFilteredMedicines(data);
      checkWarnings(data);
    } else if (error) {
       console.error("Error fetching medicines:", error);
       alert("Failed to load inventory.");
       setMedicines([]);
       setFilteredMedicines([]);
    }
    setLoading(false);
  };
 // --- ---

  useEffect(() => {
    fetchMedicines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    // Filter logic remains the same
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = medicines.filter(
      (medicine) =>
        (medicine.product_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (medicine.shop_name?.toLowerCase() || '').includes(lowerSearchTerm) ||
        (medicine.batch_no?.toLowerCase() || '').includes(lowerSearchTerm)
    );
    setFilteredMedicines(filtered);
  }, [searchTerm, medicines]);


  // --- handleDelete, handleEdit, handleModalClose, handleAddNew, handleCloseExpiryAlert, handleCloseLowStockAlert remain the same ---
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;

    setLoading(true);
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    setLoading(false);

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
    fetchMedicines();
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
  // --- ---

  return (
    <Layout>
      {/* Expiry Warning Alert (Uses formatDate) */}
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
                  secondary={`Expires: ${formatDate(med.expiry_date)}`} 
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Low Stock Warning Alert (Updated text based on package logic) */}
      {lowStockMedicines.length > 0 && showLowStockAlert && (
        <Alert
            severity="info"
            icon={<Inventory2OutlinedIcon fontSize="inherit" />}
            sx={{ mb: 3 }}
            onClose={handleCloseLowStockAlert}
        >
          <AlertTitle>Low Stock Reminder</AlertTitle>
          Medicines at or below reminder package quantity:
          <List dense sx={{ pt: 0, maxHeight: 150, overflowY: 'auto' }}>
            {lowStockMedicines.map(med => (
              <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                <ListItemText
                  primary={`${med.product_name} (Batch: ${med.batch_no})`}
                   // Display current packages and reminder packages
                  secondary={`Current Pkgs: ${med.stock}, Reminder at Pkgs: ${med.reminder_quantity}`}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Header and Search Bar (No change) */}
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

      {/* --- Inventory Table - Updated Headers and Columns --- */}
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
             // Adjusted minWidth significantly for new columns
            minWidth: 1800, // Increase minWidth to accommodate new columns
            '& .MuiTableCell-root': {
              border: '1px solid rgba(224, 224, 224, 1)',
              padding: '8px 10px', // Adjust padding if needed
              whiteSpace: 'nowrap', // Prevent wrapping
              overflow: 'hidden', // Hide overflow
              textOverflow: 'ellipsis', // Add ellipsis for overflow
            },
          }} size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                {/* --- Updated Headers --- */}
                <TableCell sx={{ fontWeight: 'bold' }}>Product Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Shop Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Batch No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Expiry (MM/YYYY)</TableCell> {/* Updated */}
                <TableCell sx={{ fontWeight: 'bold' }}>Units/Pkg</TableCell> {/* Renamed */}
                <TableCell sx={{ fontWeight: 'bold' }}>Drug Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Stock (Pkgs)</TableCell> {/* Updated */}
                <TableCell sx={{ fontWeight: 'bold' }}>Rem Units</TableCell> {/* Added */}
                <TableCell sx={{ fontWeight: 'bold' }}>Total Units</TableCell> {/* Added */}
                <TableCell sx={{ fontWeight: 'bold' }}>Purchase Rate (Pkg)</TableCell> {/* Updated */}
                <TableCell sx={{ fontWeight: 'bold' }}>Purch Disc (%)</TableCell> {/* Added */}
                <TableCell sx={{ fontWeight: 'bold' }}>Actual Purch Cost (Pkg)</TableCell> {/* Added */}
                <TableCell sx={{ fontWeight: 'bold' }}>GST (%)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>MRP (Pkg)</TableCell> {/* Updated */}
                <TableCell sx={{ fontWeight: 'bold' }}>Sell Disc (%)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                {/* ----------------------- */}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedicines.map((medicine) => {
                const isExpiring = expiringMedicines.some(exp => exp.id === medicine.id);
                const isLowStock = lowStockMedicines.some(low => low.id === medicine.id);
                const unitsPerPackage = parseUnitsFromItemString(medicine.no_of_items) || 0;
                const stockPackages = medicine.stock ?? 0;
                const remainingUnits = medicine.remaining_units ?? 0;
                const totalUnits = (stockPackages * unitsPerPackage) + remainingUnits;
                const actualPurchaseCost = medicine.actual_purchase_cost;

                // Return statement needs to be inside the map callback function
                return (
                  <TableRow key={medicine.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                      {medicine.product_name}
                    </TableCell>
                    <TableCell>{medicine.shop_name}</TableCell>
                    <TableCell>{medicine.batch_no}</TableCell>
                    <TableCell sx={{
                        backgroundColor: isExpiring ? 'warning.light' : 'inherit',
                        color: isExpiring ? 'warning.contrastText' : 'inherit',
                      }}>
                      {formatExpiryDisplay(medicine.expiry_date)}
                    </TableCell>
                    <TableCell>{medicine.no_of_items}</TableCell>
                    <TableCell>{medicine.drug_type}</TableCell>
                    <TableCell sx={{
                        backgroundColor: isLowStock ? 'info.light' : 'inherit',
                        color: isLowStock ? 'info.contrastText' : 'inherit',
                        fontWeight: isLowStock ? 'bold' : 'normal',
                      }}>
                      {stockPackages}
                    </TableCell>
                    <TableCell>{remainingUnits}</TableCell>
                    <TableCell>{totalUnits}</TableCell>
                    <TableCell>
                      {typeof medicine.purchase_rate === 'number' ? `₹${medicine.purchase_rate.toFixed(2)}` : '-'}
                    </TableCell>
                     <TableCell>
                      {medicine.purchase_discount != null ? `${medicine.purchase_discount.toFixed(2)}%` : '-'}
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
                      {medicine.discount != null ? `${medicine.discount.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" onClick={() => handleEdit(medicine)}>
                        <EditIcon fontSize="small"/>
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(medicine.id)}>
                        <DeleteIcon fontSize="small"/>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ); // End of map item return
              })} {/* End of map */}
            </TableBody>
          </Table>
        )}
      </TableContainer>
      {/* --- --- */}

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