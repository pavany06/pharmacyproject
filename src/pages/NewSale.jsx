// src/pages/NewSale.jsx
import React, { useState, useEffect, useCallback } from 'react'; // <-- Import useCallback
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Autocomplete,
  Box,
  Button,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import Layout from '../components/Layout';
import InvoiceModal from '../components/InvoiceModal';

export default function NewSale() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [billItems, setBillItems] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [saleId, setSaleId] = useState(null);

  // --- Wrap fetchMedicines in useCallback ---
  const fetchMedicines = useCallback(async () => {
    // console.log("Fetching medicines..."); // Optional: Add log for debugging
    const { data, error } = await supabase
      .from('medicines')
      .select('id, product_name, batch_no, expiry_date, mrp');

    if (error) {
        console.error("Error fetching medicines:", error);
        // Maybe show a snackbar error here
    } else if (data) {
        data.sort((a, b) => a.product_name.localeCompare(b.product_name));
        setMedicines(data);
    }
  }, []); // <-- Empty dependency array for useCallback as it doesn't depend on component state/props
  // ------------------------------------------

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]); // <-- Add fetchMedicines to dependency array

  const handleAddItem = () => {
    if (!selectedMedicine || quantity <= 0) return;

    const existingItem = billItems.find(
      (item) => item.medicine_id === selectedMedicine.id
    );

    if (existingItem) {
      setBillItems(
        billItems.map((item) =>
          item.medicine_id === selectedMedicine.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.mrp,
              }
            : item
        )
      );
    } else {
      const newItem = {
        medicine_id: selectedMedicine.id,
        product_name: selectedMedicine.product_name,
        batch_no: selectedMedicine.batch_no,
        expiry_date: selectedMedicine.expiry_date,
        mrp: selectedMedicine.mrp,
        quantity: quantity,
        subtotal: selectedMedicine.mrp * quantity,
      };
      setBillItems([...billItems, newItem]);
    }

    setSelectedMedicine(null);
    setQuantity(1);
  };

  const handleRemoveItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const grandTotal = billItems.reduce((total, item) => total + item.subtotal, 0);

  const handleGenerateBill = async () => {
    if (billItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const billNumber = `BILL-${Date.now()}`;

    // 1. Create the sale record
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([
        {
          user_id: user.id,
          bill_number: billNumber,
          customer_name: 'Walk-in',
          customer_phone: '-',
          grand_total: grandTotal,
          sale_date: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (saleError) {
      alert('Error creating sale: ' + saleError.message);
      return;
    }

    // 2. Create the sale_items records
    const saleItems = billItems.map((item) => ({
      sale_id: saleData.id,
      medicine_id: item.medicine_id,
      product_name: item.product_name,
      batch_no: item.batch_no,
      expiry_date: item.expiry_date,
      mrp: item.mrp,
      quantity: item.quantity,
      subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);

    if (itemsError) {
      alert('Error saving sale items: ' + itemsError.message);
      return;
    }

    setSaleId(saleData.id);
    setShowInvoice(true);
  };

  const handleCloseInvoice = () => {
    setShowInvoice(false);
    setSaleId(null);
    setBillItems([]);
  };

  // ... rest of the component remains the same ...
  return (
    <Layout>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        New Sale
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>

          {/* --- Row 1: Add Item Section --- */}
          <Grid item xs={12}>
             <Typography variant="h6" sx={{ mb: 1 }}>Add Item to Bill</Typography>
          </Grid>
          <Grid item xs={12} md={8}> {/* Search takes more space */}
            <Autocomplete
              options={medicines}
              getOptionLabel={(option) => option.product_name || ''} // Ensure label is always a string
              value={selectedMedicine}
              onChange={(event, newValue) => {
                setSelectedMedicine(newValue);
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id} // Important for object comparison
              renderInput={(params) => (
                <TextField {...params} label="Search Product" placeholder="Type medicine name..." />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Grid container spacing={1} sx={{ width: '100%' }}>
                    <Grid item xs={6}>
                      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                        {option.product_name}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary">
                        Batch: {option.batch_no}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                        MRP: ₹{option.mrp.toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
               ListboxProps={{ style: { maxHeight: 300 } }} // Limit dropdown height
            />
             <Paper
              variant="outlined"
              sx={{
                  p: 1.5,
                  mt: 1,
                  bgcolor: selectedMedicine ? 'action.hover' : 'background.paper',
                  minHeight: '60px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
              }}
            >
              {selectedMedicine ? (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        Selected: {selectedMedicine.product_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                       MRP: ₹{selectedMedicine.mrp.toFixed(2)} | Batch: {selectedMedicine.batch_no} | Expiry: {new Date(selectedMedicine.expiry_date).toLocaleDateString()}
                    </Typography>
                  </>
              ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Select a product from the list above.
                  </Typography>
              )}
            </Paper>

          </Grid>

          <Grid item xs={12} md={2}> {/* Qty */}
            <TextField
              label="Qty"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              InputProps={{ inputProps: { min: 1 } }}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'stretch' }}> {/* Add Button */}
            <Button
              variant="contained"
              color="success" // Changed color to green
              onClick={handleAddItem}
              disabled={!selectedMedicine}
              fullWidth
              startIcon={<AddIcon />}
              sx={{ height: '100%' }} // Makes button same height as text field
            >
              Add Item
            </Button>
          </Grid>

           <Grid item xs={12}><Divider sx={{ my: 2 }} /></Grid> {/* Divider */}


          {/* --- Row 2: Current Bill Table --- */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 1 }}>Current Bill</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small"> {/* Make table compact */}
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell>Batch No</TableCell>
                    <TableCell>MRP</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Subtotal</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {billItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No items added to bill
                      </TableCell>
                    </TableRow>
                  ) : (
                    billItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.batch_no}</TableCell>
                        <TableCell>₹{item.mrp.toFixed(2)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.subtotal.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* --- Row 3: Total & Generate Bill Button (only if items exist) --- */}
          {billItems.length > 0 && (
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              {/* Grand Total on the left */}
              <Box>
                  <Typography variant="h5" component="span">
                    Grand Total:{' '}
                  </Typography>
                  <Typography variant="h4" component="span" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>
                    ₹{grandTotal.toFixed(2)}
                  </Typography>
              </Box>

              {/* Generate Bill Button on the right */}
              <Button
                variant="contained"
                size="large"
                startIcon={<PrintIcon />}
                onClick={handleGenerateBill}
              >
                Generate & Print Bill
              </Button>
            </Grid>
          )}

        </Grid>
      </Paper>

      {showInvoice && saleId && (
        <InvoiceModal
          open={showInvoice}
          saleId={saleId}
          onClose={handleCloseInvoice}
        />
      )}
    </Layout>
  );
}