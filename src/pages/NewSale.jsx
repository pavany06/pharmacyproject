// src/pages/NewSale.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
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
  Snackbar, // <-- Import Snackbar
  Alert,    // <-- Import Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import Layout from '../components/Layout';
import InvoiceModal from '../components/InvoiceModal';

export default function NewSale() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]); // Will now include stock
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [billItems, setBillItems] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [saleId, setSaleId] = useState(null);

  // --- State for Snackbar ---
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info'); // 'success' | 'error' | 'warning' | 'info'
  // -------------------------

  // --- Wrap fetchMedicines in useCallback ---
  const fetchMedicines = useCallback(async () => {
    console.log("Fetching medicines..."); // Log start
    // --- Include 'stock' in the select query ---
    const { data, error } = await supabase
      .from('medicines')
      .select('id, product_name, batch_no, expiry_date, mrp, stock'); // <-- Added stock
    // ------------------------------------------

    if(error){
      console.error("Error fetching medicines:", error);
      showSnackbar("Error fetching medicine list.", "error"); // Show error notification
    } else if (data) {
        data.sort((a, b) => a.product_name.localeCompare(b.product_name));
        setMedicines(data);
        console.log("Medicines fetched:", data.length); // Log success
    } else {
        console.warn("No medicine data returned.");
        setMedicines([]); // Ensure it's an empty array if no data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Empty dependency array for useCallback
  // ------------------------------------------

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]); // <-- Add fetchMedicines dependency

  // --- Snackbar Helper ---
  const showSnackbar = (message, severity = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };
  // ----------------------


  const handleAddItem = () => {
    if (!selectedMedicine || quantity <= 0) {
        showSnackbar("Please select a medicine and enter a valid quantity.", "warning");
        return;
    };

    // --- Stock Check Logic ---
    const availableStock = selectedMedicine.stock ?? 0; // Use ?? to handle null/undefined stock
    const quantityAlreadyInBill = billItems
        .filter(item => item.medicine_id === selectedMedicine.id)
        .reduce((sum, item) => sum + item.quantity, 0);

    const requestedTotalQuantity = quantityAlreadyInBill + quantity;

    console.log(`Adding Item: ${selectedMedicine.product_name}, Qty: ${quantity}, In Bill: ${quantityAlreadyInBill}, Available: ${availableStock}`); // Debug log

    if (requestedTotalQuantity > availableStock) {
        showSnackbar(`Cannot add ${quantity}. Only ${availableStock - quantityAlreadyInBill} of ${selectedMedicine.product_name} available in stock.`, "error");
        return; // Stop the function here
    }
    // --- End Stock Check ---


    const existingItem = billItems.find(
      (item) => item.medicine_id === selectedMedicine.id
    );

    if (existingItem) {
      setBillItems(
        billItems.map((item) =>
          item.medicine_id === selectedMedicine.id
            ? {
                ...item,
                quantity: item.quantity + quantity, // Already checked stock allows this
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

  // --- Stock Update Function ---
  const updateStockLevels = async (itemsSold) => {
      console.log("Attempting to update stock for items:", itemsSold);
      const updates = itemsSold.map(async (item) => {
          // Fetch the current stock again just before updating (more robust)
          const { data: currentMedicineData, error: fetchError } = await supabase
              .from('medicines')
              .select('stock')
              .eq('id', item.medicine_id)
              .single();

          if (fetchError || !currentMedicineData) {
              console.error(`Error fetching current stock for ${item.product_name} (ID: ${item.medicine_id}):`, fetchError);
              throw new Error(`Could not verify stock for ${item.product_name}. Update failed.`); // Throw error to potentially stop others
          }

          const currentStock = currentMedicineData.stock ?? 0; // Handle null stock
          const newStock = currentStock - item.quantity;

          if (newStock < 0) {
              console.warn(`Stock for ${item.product_name} would go below zero (${newStock}). Setting to 0 instead.`);
          }

          const { error: updateError } = await supabase
              .from('medicines')
              .update({ stock: Math.max(0, newStock) }) // Ensure stock doesn't go negative
              .eq('id', item.medicine_id);

          if (updateError) {
              console.error(`Error updating stock for ${item.product_name} (ID: ${item.medicine_id}):`, updateError);
              throw new Error(`Failed to update stock for ${item.product_name}.`); // Throw error
          }
           console.log(`Successfully updated stock for ${item.product_name} to ${Math.max(0, newStock)}`);
          return true; // Indicate success for this item
      });

      // Wait for all update promises to settle
      try {
          await Promise.all(updates);
          console.log("All stock levels updated successfully.");
          return true; // Overall success
      } catch (error) {
          console.error("One or more stock updates failed:", error);
          showSnackbar(`Error updating stock levels: ${error.message}`, "error");
          return false; // Indicate overall failure
      }
  };
  // ----------------------------


  const handleGenerateBill = async () => {
    if (billItems.length === 0) {
      showSnackbar('Please add at least one item to the bill.', "warning");
      return;
    }

    // --- Re-verify Stock Before Generating Bill (Optional but Safer) ---
    // This adds an extra check right before committing the sale
    let stockSufficient = true;
    for (const item of billItems) {
        const med = medicines.find(m => m.id === item.medicine_id);
        if (!med || (med.stock ?? 0) < item.quantity) {
             showSnackbar(`Stock changed for ${item.product_name}. Only ${med?.stock ?? 0} available. Please remove item or reduce quantity.`, "error");
             stockSufficient = false;
             break; // Stop checking
        }
    }
    if (!stockSufficient) {
        fetchMedicines(); // Refresh list to show updated stock
        return; // Prevent bill generation
    }
    // --- End Re-verification ---


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
      showSnackbar(`Error creating sale record: ${saleError.message}`, "error");
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
      showSnackbar(`Error saving sale items: ${itemsError.message}`, "error");
      // Optional: Delete the 'sales' record if items fail
      // await supabase.from('sales').delete().eq('id', saleData.id);
      return;
    }

    // --- 3. Update Stock Levels ---
    const stockUpdateSuccess = await updateStockLevels(billItems);
    // ----------------------------

    if (stockUpdateSuccess) {
        showSnackbar("Sale recorded and stock updated successfully!", "success"); // Success message
        setSaleId(saleData.id);
        setShowInvoice(true);
    } else {
         showSnackbar("Sale recorded, but failed to update stock levels automatically. Please check inventory manually.", "error");
         // Decide if you still want to show the invoice
         // setSaleId(saleData.id);
         // setShowInvoice(true); // Maybe still show invoice but with a stronger warning?
    }
  };

  const handleCloseInvoice = () => {
    setShowInvoice(false);
    setSaleId(null);
    setBillItems([]);
    fetchMedicines(); // Fetch medicines again to reflect updated stock
  };

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
          <Grid item xs={12} md={8}>
            <Autocomplete
              options={medicines}
              getOptionLabel={(option) => `${option.product_name} (Stock: ${option.stock ?? 'N/A'})` || ''}
              value={selectedMedicine}
              onChange={(event, newValue) => {
                setSelectedMedicine(newValue);
              }}
              isOptionEqualToValue={(option, value) => option?.id === value?.id} // Safer check
              renderInput={(params) => (
                <TextField {...params} label="Search Product" placeholder="Type medicine name..." />
              )}
              renderOption={(props, option) => (
                // Use React.Fragment to avoid invalid DOM nesting if needed, ensure key is on top element
                <Box component="li" {...props} key={option.id}>
                  <Grid container spacing={1} sx={{ width: '100%' }}>
                     <Grid item xs={5}>
                      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                        {option.product_name}
                      </Typography>
                    </Grid>
                     <Grid item xs={2}>
                      <Typography variant="body2" color={option.stock > 0 ? 'text.secondary' : 'error.main'}> {/* Highlight zero stock */}
                        Stock: {option.stock ?? 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={2}>
                      <Typography variant="body2" color="text.secondary">
                        Batch: {option.batch_no}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                        MRP: ₹{option.mrp?.toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
              ListboxProps={{ style: { maxHeight: 300 } }}
              // Disable options with zero stock
              getOptionDisabled={(option) => (option.stock ?? 0) <= 0}
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
                      Stock: {selectedMedicine.stock ?? 'N/A'} | MRP: ₹{selectedMedicine.mrp?.toFixed(2)} | Batch: {selectedMedicine.batch_no} | Expiry: {new Date(selectedMedicine.expiry_date).toLocaleDateString()}
                    </Typography>
                  </>
              ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Select a product from the list above.
                  </Typography>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              label="Qty"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              InputProps={{ inputProps: { min: 1 } }}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleAddItem}
              disabled={!selectedMedicine || (selectedMedicine.stock ?? 0) <= 0} // Also disable if selected item has 0 stock
              fullWidth
              startIcon={<AddIcon />}
              sx={{ height: '100%' }}
            >
              Add Item
            </Button>
          </Grid>

           <Grid item xs={12}><Divider sx={{ my: 2 }} /></Grid>

          {/* --- Row 2: Current Bill Table --- */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 1 }}>Current Bill</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
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
                        <TableCell>₹{item.mrp?.toFixed(2)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.subtotal?.toFixed(2)}</TableCell>
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

          {/* --- Row 3: Total & Generate Bill Button --- */}
          {billItems.length > 0 && (
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Box>
                  <Typography variant="h5" component="span">
                    Grand Total:{' '}
                  </Typography>
                  <Typography variant="h4" component="span" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>
                    ₹{grandTotal.toFixed(2)}
                  </Typography>
              </Box>
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

      {/* --- Snackbar for Notifications --- */}
       <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000} // 6 seconds
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* Important: Put key here if Snackbar content changes, or wrap Alert */}
        {/* Using Alert directly is fine if message/severity updates */}
        <Alert
          onClose={handleSnackbarClose} // Adds close button to Alert
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      {/* ------------------------------- */}


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