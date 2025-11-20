// src/pages/Inventory.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import Layout from '../components/Layout';
import MedicineModal from '../components/MedicineModal';

// --- Helper Functions ---

const parseUnitsFromItemString = (itemString) => {
    if (!itemString) return null;
    const match = itemString.match(/^\s*(\d+)/);
    const units = match ? parseInt(match[1], 10) : null;
    return units > 0 ? units : null;
};

const formatExpiryDisplay = (dateString) => {
  if (!dateString || dateString.length < 7) return '-';
  try {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(5, 7);
      const formattedMonth = month.padStart(2, '0');
      return `${formattedMonth}/${year}`;
  } catch (e) {
      console.error("Error formatting expiry date for display:", dateString, e);
      return '-';
  }
};

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
  
  // State to toggle visibility of warnings
  const [showWarnings, setShowWarnings] = useState(false); 

  // Optimize lookups using Sets for performance
  const expiringIds = useMemo(() => new Set(expiringMedicines.map(m => m.id)), [expiringMedicines]);
  const lowStockIds = useMemo(() => new Set(lowStockMedicines.map(m => m.id)), [lowStockMedicines]);

  const checkWarnings = (medicineList) => {
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

    const lowStock = medicineList.filter(med => {
        const reminderPackages = med.reminder_quantity ?? 0;
        const currentStockPackages = med.stock ?? 0;
        return currentStockPackages > 0 && reminderPackages > 0 && currentStockPackages <= reminderPackages;
    });
    setLowStockMedicines(lowStock);
  };

  // FIX: Wrap fetchMedicines in useCallback to fix lint warning
  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    setExpiringMedicines([]);
    setLowStockMedicines([]);
    
    // Updated select to include cgst and sgst
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .order('product_name', { ascending: true });

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
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;

    setLoading(true);
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    setLoading(false);

    if (!error) {
      fetchMedicines();
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
  
  const toggleWarnings = () => {
    setShowWarnings(!showWarnings);
  };

  const totalWarnings = expiringMedicines.length + lowStockMedicines.length;

  return (
    <Layout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Inventory Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
           <Button
            variant="outlined"
            color={showWarnings ? "primary" : "warning"}
            startIcon={showWarnings ? <NotificationsOffIcon /> : <NotificationsActiveIcon />}
            onClick={toggleWarnings}
            disabled={totalWarnings === 0}
          >
            {showWarnings ? 'Hide Alerts' : `Show Alerts (${totalWarnings})`}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
          >
            New Medicine
          </Button>
        </Box>
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

      <Collapse in={showWarnings}>
        <Box sx={{ mb: 3 }}>
            {expiringMedicines.length > 0 && (
                <Alert
                    severity="warning"
                    icon={<WarningAmberIcon fontSize="inherit" />}
                    sx={{ mb: 2 }}
                >
                <AlertTitle>Expiry Warning ({expiringMedicines.length})</AlertTitle>
                Medicines expiring within the next month:
                <List dense sx={{ pt: 0, maxHeight: 200, overflowY: 'auto' }}>
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

            {lowStockMedicines.length > 0 && (
                <Alert
                    severity="info"
                    icon={<Inventory2OutlinedIcon fontSize="inherit" />}
                    sx={{ mb: 2 }}
                >
                <AlertTitle>Low Stock Reminder ({lowStockMedicines.length})</AlertTitle>
                Medicines at or below reminder package quantity:
                <List dense sx={{ pt: 0, maxHeight: 200, overflowY: 'auto' }}>
                    {lowStockMedicines.map(med => (
                    <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                        <ListItemText
                        primary={`${med.product_name} (Batch: ${med.batch_no})`}
                        secondary={`Current Pkgs: ${med.stock}, Reminder at Pkgs: ${med.reminder_quantity}`}
                        />
                    </ListItem>
                    ))}
                </List>
                </Alert>
            )}
             
             {totalWarnings === 0 && showWarnings && (
                 <Alert severity="success" sx={{ mb: 2 }}>No active warnings.</Alert>
             )}
        </Box>
      </Collapse>

      {/* --- Inventory Table: Full View, No Wrap --- */}
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
            // Use max-content to force table to be as wide as necessary to fit content on one line
            minWidth: 'max-content', 
            '& .MuiTableCell-root': {
              border: '1px solid rgba(224, 224, 224, 1)',
              padding: '8px 12px',
              whiteSpace: 'nowrap', // PREVENT WRAPPING
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
            '& .MuiTableCell-head': {
                fontWeight: 'bold',
                backgroundColor: 'grey.100',
            }
          }} size="small">
            <TableHead>
              <TableRow>
                {/* Expanded S.No */}
                <TableCell sx={{ fontWeight: 'bold', width: '60px', minWidth: '60px' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Product Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Shop Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Batch No</TableCell>
                
                {/* Expanded Expiry */}
                <TableCell sx={{ fontWeight: 'bold', minWidth: '130px' }}>Expiry (MM/YYYY)</TableCell>
                
                <TableCell sx={{ fontWeight: 'bold' }}>Units/Pkg</TableCell>
                
                {/* Expanded Drug Type */}
                <TableCell sx={{ fontWeight: 'bold', minWidth: '120px' }}>Drug Type</TableCell>
                
                <TableCell sx={{ fontWeight: 'bold' }}>Stock (Pkgs)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Rem Units</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Total Units</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Purchase Rate (Pkg)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Purch Disc (%)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actual Purch Cost (Pkg)</TableCell>
                
                {/* Updated Headers: CGST & SGST */}
                <TableCell sx={{ fontWeight: 'bold' }}>CGST (%)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>SGST (%)</TableCell>
                
                <TableCell sx={{ fontWeight: 'bold' }}>MRP (Pkg)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Sell Disc (%)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedicines.map((medicine, index) => {
                const isExpiring = expiringIds.has(medicine.id);
                const isLowStock = lowStockIds.has(medicine.id);
                
                const unitsPerPackage = parseUnitsFromItemString(medicine.no_of_items) || 0;
                const stockPackages = medicine.stock ?? 0;
                const remainingUnits = medicine.remaining_units ?? 0;
                const totalUnits = (stockPackages * unitsPerPackage) + remainingUnits;
                const actualPurchaseCost = medicine.actual_purchase_cost;

                const serialNumber = index + 1;

                return (
                  <TableRow key={medicine.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      {serialNumber}
                    </TableCell>
                    
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
                    
                    {/* CGST Column */}
                    <TableCell>
                      {typeof medicine.cgst === 'number' ? `${medicine.cgst.toFixed(2)}%` : '-'}
                    </TableCell>
                    
                    {/* SGST Column */}
                    <TableCell>
                      {typeof medicine.sgst === 'number' ? `${medicine.sgst.toFixed(2)}%` : '-'}
                    </TableCell>

                    <TableCell>
                      {typeof medicine.mrp === 'number' ? `₹${medicine.mrp.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {medicine.discount != null ? `${medicine.discount.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <IconButton size="small" color="primary" onClick={() => handleEdit(medicine)} sx={{ padding: 0.5 }}>
                          <EditIcon fontSize="small"/>
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(medicine.id)} sx={{ padding: 0.5 }}>
                          <DeleteIcon fontSize="small"/>
                        </IconButton>
                      </Box>
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