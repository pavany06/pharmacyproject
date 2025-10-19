// src/pages/Inventory.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import Layout from '../components/Layout';
import MedicineModal from '../components/MedicineModal';

// Helper function to format dates or return '-' if invalid/null
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date)) return '-';
  return date.toLocaleDateString('en-GB'); // Use dd/mm/yyyy format
};


export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedicines();
  }, []);

  useEffect(() => {
    // Also allow searching by Shop Name or Batch No if desired
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
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMedicines(data);
      setFilteredMedicines(data);
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

  return (
    <Layout>
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

      {/* Make TableContainer take full width */}
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
          // Make table width adjust automatically, minWidth ensures horizontal scroll if needed
          <Table sx={{
            minWidth: 1200, // Adjust this based on how many columns you have
            '& .MuiTableCell-root': {
              border: '1px solid rgba(224, 224, 224, 1)',
              padding: '8px 10px', // Smaller padding
              whiteSpace: 'nowrap', // Prevent text wrapping
            }
          }} size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                {/* --- ALL Headers --- */}
                <TableCell>Product Name</TableCell>
                <TableCell>Shop Name</TableCell>
                <TableCell>Batch No</TableCell>
                <TableCell>Mfg Date</TableCell> {/* Added */}
                <TableCell>Expiry Date</TableCell>
                <TableCell>No of Items</TableCell>
                <TableCell>Drug Type</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Purchase Rate</TableCell> {/* Added */}
                <TableCell>GST (%)</TableCell> {/* Added */}
                <TableCell>MRP</TableCell>
                <TableCell>Discount (%)</TableCell> {/* Added */}
                <TableCell align="right">Actions</TableCell>
                {/* -------------------- */}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMedicines.map((medicine) => (
                <TableRow key={medicine.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  {/* --- ALL Data Cells --- */}
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                    {medicine.product_name}
                  </TableCell>
                  <TableCell>{medicine.shop_name}</TableCell>
                  <TableCell>{medicine.batch_no}</TableCell>
                  <TableCell>{formatDate(medicine.mfg_date)}</TableCell> {/* Added + Formatted */}
                  <TableCell>{formatDate(medicine.expiry_date)}</TableCell> {/* Formatted */}
                  <TableCell>{medicine.no_of_items}</TableCell>
                  <TableCell>{medicine.drug_type}</TableCell>
                  <TableCell>{medicine.stock}</TableCell>
                  <TableCell>₹{medicine.purchase_rate?.toFixed(2)}</TableCell> {/* Added */}
                  <TableCell>{medicine.gst?.toFixed(2)}%</TableCell> {/* Added */}
                  <TableCell>₹{medicine.mrp?.toFixed(2)}</TableCell>
                  <TableCell>{medicine.discount?.toFixed(2)}%</TableCell> {/* Added */}
                  {/* ---------------------- */}
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