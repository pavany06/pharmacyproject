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
import Layout from '../components/Layout';
import MedicineModal from '../components/MedicineModal';

// Helper function to format dates or return '-' if invalid/null
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return '-';
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (isNaN(date)) return '-';
      return date.toLocaleDateString('en-GB');
  } catch (e) {
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
  const [showExpiryAlert, setShowExpiryAlert] = useState(true);

  const checkExpiryDates = (medicineList) => {
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
    if (expiring.length > 0) {
        setShowExpiryAlert(true);
    }
  };


  useEffect(() => {
    fetchMedicines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = medicines.filter(
      (medicine) =>
        medicine.product_name.toLowerCase().includes(lowerSearchTerm) ||
        medicine.shop_name.toLowerCase().includes(lowerSearchTerm) ||
        medicine.batch_no.toLowerCase().includes(lowerSearchTerm)
    );
    setFilteredMedicines(filtered);
  }, [searchTerm, medicines]);


  const fetchMedicines = async () => {
    setLoading(true);
    setExpiringMedicines([]);
    setShowExpiryAlert(false);
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMedicines(data);
      setFilteredMedicines(data);
      checkExpiryDates(data);
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

  const handleCloseAlert = () => {
      setShowExpiryAlert(false);
  };

  return (
    <Layout>
      {expiringMedicines.length > 0 && showExpiryAlert && (
        <Alert
            severity="warning"
            icon={<WarningAmberIcon fontSize="inherit" />}
            sx={{ mb: 3 }}
            onClose={handleCloseAlert}
        >
          <AlertTitle>Expiry Warning</AlertTitle>
          The following medicines are expiring within the next month:
          <List dense sx={{ pt: 0, maxHeight: 150, overflowY: 'auto' }}>
            {expiringMedicines.map(med => (
              <ListItem key={med.id} disablePadding sx={{ pl: 2 }}>
                <ListItemText
                  primary={med.product_name}
                  secondary={`Batch: ${med.batch_no}, Expires: ${formatDate(med.expiry_date)}`}
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
            minWidth: 1100, // Adjusted minWidth slightly
            '& .MuiTableCell-root': {
              border: '1px solid rgba(224, 224, 224, 1)',
              padding: '8px 10px',
              whiteSpace: 'nowrap',
            }
          }} size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                {/* --- Updated Headers (Mfg Date removed) --- */}
                <TableCell>Product Name</TableCell>
                <TableCell>Shop Name</TableCell>
                <TableCell>Batch No</TableCell>
                {/* <TableCell>Mfg Date</TableCell> */} {/* Removed */}
                <TableCell>Expiry Date</TableCell>
                <TableCell>No of Items</TableCell>
                <TableCell>Drug Type</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Purchase Rate</TableCell>
                <TableCell>GST (%)</TableCell>
                <TableCell>MRP</TableCell>
                <TableCell>Discount (%)</TableCell>
                <TableCell align="right">Actions</TableCell>
                {/* ------------------------------------------- */}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedicines.map((medicine) => (
                <TableRow key={medicine.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  {/* --- Updated Data Cells (Mfg Date removed) --- */}
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                    {medicine.product_name}
                  </TableCell>
                  <TableCell>{medicine.shop_name}</TableCell>
                  <TableCell>{medicine.batch_no}</TableCell>
                  {/* <TableCell>{formatDate(medicine.mfg_date)}</TableCell> */} {/* Removed */}
                  <TableCell sx={{
                      backgroundColor: expiringMedicines.some(exp => exp.id === medicine.id)
                        ? 'warning.light'
                        : 'inherit',
                       color: expiringMedicines.some(exp => exp.id === medicine.id)
                        ? 'warning.contrastText'
                        : 'inherit',
                    }}>
                    {formatDate(medicine.expiry_date)}
                  </TableCell>
                  <TableCell>{medicine.no_of_items}</TableCell>
                  <TableCell>{medicine.drug_type}</TableCell>
                  <TableCell>{medicine.stock}</TableCell>
                  <TableCell>₹{medicine.purchase_rate?.toFixed(2)}</TableCell>
                  <TableCell>{medicine.gst?.toFixed(2)}%</TableCell>
                  <TableCell>₹{medicine.mrp?.toFixed(2)}</TableCell>
                   {/* Display discount or '-' if null/zero */}
                  <TableCell>{medicine.discount ? `${medicine.discount.toFixed(2)}%` : '-'}</TableCell>
                  {/* --------------------------------------------- */}
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => handleEdit(medicine)}>
                      <EditIcon fontSize="small"/>
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(medicine.id)}>
                      <DeleteIcon fontSize="small"/>
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
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