// src/pages/NewSale.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'; //
import { useAuth } from '../contexts/AuthContext'; //
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
  Snackbar,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import Layout from '../components/Layout'; //
import InvoiceModal from '../components/InvoiceModal'; //

// --- Calculation Helper ---
const calculateItemAmounts = (mrp, gst, discount, quantity) => {
    const mrpNum = parseFloat(mrp) || 0;
    const gstNum = parseFloat(gst) || 0;
    const discountNum = parseFloat(discount) || 0;
    const qtyNum = parseInt(quantity, 10) || 0;
    if (mrpNum <= 0 || qtyNum <= 0) return { subtotal: 0, gstAmount: 0, discountAmount: 0 };
    const gstAmountTotal = (mrpNum * gstNum / 100) * qtyNum;
    const discountAmountTotal = (mrpNum * discountNum / 100) * qtyNum;
    const priceBeforeDiscount = mrpNum + (mrpNum * gstNum / 100);
    const finalPricePerItem = priceBeforeDiscount - (mrpNum * discountNum / 100);
    const subtotal = finalPricePerItem * qtyNum;
    return { subtotal: Math.max(0, subtotal), gstAmount: gstAmountTotal, discountAmount: discountAmountTotal };
};
// -----------------------

export default function NewSale() {
  const { user } = useAuth(); //
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');

  // --- Customer State (Phone Only) ---
  // Removed customerName state and DEFAULT_CUSTOMER_NAME constant
  const [customerPhone, setCustomerPhone] = useState('');
  // ------------------------------------

  const fetchMedicines = useCallback(async () => {
    const { data, error } = await supabase //
      .from('medicines')
      .select('id, product_name, batch_no, expiry_date, mrp, stock, gst, discount');

    if(error){ showSnackbar("Error fetching medicine list.", "error"); }
    else if (data) {
        data.sort((a, b) => a.product_name.localeCompare(b.product_name));
        setMedicines(data);
    } else { setMedicines([]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);

  const showSnackbar = (message, severity = 'info') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
   };
  const handleSnackbarClose = (event, reason) => {
      if (reason === 'clickaway') { return; }
      setSnackbarOpen(false);
   };


  const handleAddItem = () => {
    const qtyToAdd = parseInt(quantity, 10);
    if (!selectedMedicine || isNaN(qtyToAdd) || qtyToAdd <= 0) { showSnackbar("Please select a medicine and enter a valid positive quantity.", "warning"); return; };
    const availableStock = selectedMedicine.stock ?? 0;
    const quantityAlreadyInBill = billItems.filter(item => item.medicine_id === selectedMedicine.id).reduce((sum, item) => sum + item.quantity, 0);
    const requestedTotalQuantity = quantityAlreadyInBill + qtyToAdd;
    if (requestedTotalQuantity > availableStock) { showSnackbar(`Cannot add ${qtyToAdd}. Only ${availableStock - quantityAlreadyInBill} of ${selectedMedicine.product_name} available in stock.`, "error"); return; }

    const amounts = calculateItemAmounts( selectedMedicine.mrp, selectedMedicine.gst, selectedMedicine.discount, qtyToAdd );
    const existingItemIndex = billItems.findIndex((item) => item.medicine_id === selectedMedicine.id);

    if (existingItemIndex > -1) {
        const updatedItems = [...billItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + qtyToAdd;
        const newAmounts = calculateItemAmounts( existingItem.mrp, existingItem.gst, existingItem.discount, newQuantity );
        existingItem.quantity = newQuantity;
        existingItem.subtotal = newAmounts.subtotal;
        existingItem.gstAmount = newAmounts.gstAmount;
        existingItem.discountAmount = newAmounts.discountAmount;
        setBillItems(updatedItems);
    } else {
      const newItem = {
         medicine_id: selectedMedicine.id, product_name: selectedMedicine.product_name, batch_no: selectedMedicine.batch_no,
         expiry_date: selectedMedicine.expiry_date, mrp: selectedMedicine.mrp, gst: selectedMedicine.gst ?? 0,
         discount: selectedMedicine.discount ?? 0, quantity: qtyToAdd, subtotal: amounts.subtotal,
         gstAmount: amounts.gstAmount, discountAmount: amounts.discountAmount,
      };
      setBillItems([...billItems, newItem]);
    }
    setSelectedMedicine(null); setQuantity('');
  };

  const handleRemoveItem = (index) => {
      setBillItems(billItems.filter((_, i) => i !== index));
   };

  const grandTotal = billItems.reduce((total, item) => total + item.subtotal, 0);
  const totalDiscount = billItems.reduce((total, item) => total + item.discountAmount, 0);

  // Removed Customer Name handlers

  const handleGenerateBill = async () => {
    // --- Updated Validation (Phone Only) ---
    if (billItems.length === 0) {
      showSnackbar('Please add at least one item to the bill.', "warning");
      return;
    }
    // Simple check for non-empty phone (could add more complex validation like length/digits)
     if (!customerPhone || customerPhone.trim() === '') {
        showSnackbar('Please enter Customer Phone Number.', 'warning');
        return;
    }
    // --------------------------------------

    // Optional stock re-check...
    let stockSufficient = true;
    for (const item of billItems) {
         const med = medicines.find(m => m.id === item.medicine_id);
        if (!med || (med.stock ?? 0) < item.quantity) {
             showSnackbar(`Stock changed for ${item.product_name}. Only ${med?.stock ?? 0} available.`, "error"); stockSufficient = false; break;
        }
    }
    if (!stockSufficient) { fetchMedicines(); return; }


    const billNumber = `BILL-${Date.now()}`;

    // 1. Create the sale record (Set customer_name to default)
    const { data: saleData, error: saleError } = await supabase //
      .from('sales')
      .insert([ {
          user_id: user.id, //
          bill_number: billNumber,
          customer_name: 'Walk-in', // Use a fixed default name
          customer_phone: customerPhone, // Use state value
          grand_total: grandTotal,
          sale_date: new Date().toISOString(),
        },
      ])
      .select().single();

    if (saleError) { showSnackbar(`Error creating sale record: ${saleError.message}`, "error"); return; }

    // 2. Create the sale_items records
    const saleItemsData = billItems.map((item) => ({
        sale_id: saleData.id, medicine_id: item.medicine_id, product_name: item.product_name, batch_no: item.batch_no,
        expiry_date: item.expiry_date, mrp: item.mrp, quantity: item.quantity, subtotal: item.subtotal,
     }));
    const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData); //

    if (itemsError) { showSnackbar(`Error saving sale items: ${itemsError.message}`, "error"); return; }

    showSnackbar("Sale recorded successfully!", "success");
    setSaleId(saleData.id);
    setShowInvoice(true);
  };

  const handleCloseInvoice = () => {
    setShowInvoice(false);
    setSaleId(null);
    setBillItems([]);
    // Removed setCustomerName
    setCustomerPhone(''); // Reset phone
    fetchMedicines();
  };

  return (
    <Layout> {/* */}
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}> New Sale </Typography>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>

          {/* Row 1: Add Item Section */}
          <Grid item xs={12}> <Typography variant="h6" sx={{ mb: 1 }}>Add Item to Bill</Typography> </Grid>
          <Grid item xs={12} md={8}> {/* Search */}
             <Autocomplete
              options={medicines}
              getOptionLabel={(option) => `${option.product_name} (Stock: ${option.stock ?? 'N/A'})` || ''}
              value={selectedMedicine}
              onChange={(event, newValue) => { setSelectedMedicine(newValue); }}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              renderInput={(params) => (<TextField {...params} label="Search Product" placeholder="Type medicine name..." />)}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Grid container spacing={1} sx={{ width: '100%' }}>
                     <Grid item xs={4}> <Typography variant="body1" sx={{ fontWeight: 'medium' }}> {option.product_name} </Typography> </Grid>
                     <Grid item xs={1}> <Typography variant="body2" color={option.stock > 0 ? 'text.secondary' : 'error.main'}> S: {option.stock ?? 'N/A'} </Typography> </Grid>
                     <Grid item xs={1}> <Typography variant="body2" color="text.secondary"> G: {option.gst ?? 0}% </Typography> </Grid>
                     <Grid item xs={1}> <Typography variant="body2" color="text.secondary"> D: {option.discount ?? 0}% </Typography> </Grid>
                     <Grid item xs={2}> <Typography variant="body2" color="text.secondary"> B: {option.batch_no} </Typography> </Grid>
                     <Grid item xs={3}> <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}> MRP: ₹{option.mrp?.toFixed(2)} </Typography> </Grid>
                  </Grid>
                </Box>
              )}
              ListboxProps={{ style: { maxHeight: 300 } }}
              getOptionDisabled={(option) => (option.stock ?? 0) <= 0}
            />
            <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: selectedMedicine ? 'action.hover' : 'background.paper', minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', }}>
              {selectedMedicine ? (
                  <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}> Selected: {selectedMedicine.product_name} </Typography>
                      <Typography variant="body2" color="text.secondary"> Stock: {selectedMedicine.stock ?? 'N/A'} | MRP: ₹{selectedMedicine.mrp?.toFixed(2)} | GST: {selectedMedicine.gst ?? 0}% | Disc: {selectedMedicine.discount ?? 0}% | Batch: {selectedMedicine.batch_no} </Typography>
                  </>
               ) : ( <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}> Select a product from the list above. </Typography> )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={2}> {/* Qty */}
             <TextField label="Qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} InputProps={{ inputProps: { min: "1" } }} fullWidth required />
          </Grid>
          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'stretch' }}> {/* Add Button */}
            <Button variant="contained" color="success" onClick={handleAddItem} disabled={!selectedMedicine || (selectedMedicine.stock ?? 0) <= 0} fullWidth startIcon={<AddIcon />} sx={{ height: '100%' }} > Add Item </Button>
          </Grid>

           <Grid item xs={12}><Divider sx={{ my: 2 }} /></Grid>

          {/* Row 2: Current Bill Table */}
          <Grid item xs={12}>
             <Typography variant="h6" sx={{ mb: 1 }}>Current Bill</Typography>
             <TableContainer component={Paper} variant="outlined">
               <Table size="small" sx={{ minWidth: 750 }}>
                 <TableHead sx={{ bgcolor: 'grey.100' }}>
                   <TableRow>
                     <TableCell>Product Name</TableCell> <TableCell>Batch</TableCell> <TableCell>MRP</TableCell> <TableCell>GST Amt</TableCell> <TableCell>Disc Amt</TableCell> <TableCell>Qty</TableCell> <TableCell>Amount</TableCell> <TableCell align="right">Action</TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {billItems.length === 0 ? (
                    <TableRow> <TableCell colSpan={8} align="center"> No items added to bill </TableCell> </TableRow>
                   ) : (
                    billItems.map((item, index) => (
                      <TableRow key={index}>
                         <TableCell>{item.product_name}</TableCell> <TableCell>{item.batch_no}</TableCell> <TableCell>₹{item.mrp?.toFixed(2)}</TableCell> <TableCell>₹{item.gstAmount?.toFixed(2)}</TableCell> <TableCell>₹{item.discountAmount?.toFixed(2)}</TableCell> <TableCell>{item.quantity}</TableCell> <TableCell>₹{item.subtotal?.toFixed(2)}</TableCell>
                         <TableCell align="right"> <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}> <DeleteIcon fontSize="small" /> </IconButton> </TableCell>
                      </TableRow>
                    ))
                   )}
                 </TableBody>
               </Table>
             </TableContainer>
          </Grid>

          {/* --- Row 3: Customer Phone (Conditionally Rendered) --- */}
          {billItems.length > 0 && (
            <>
              <Grid item xs={12}>
                 <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Customer Details</Typography>
              </Grid>
              {/* Removed Customer Name Grid item */}
              <Grid item xs={12} md={6}> {/* Phone takes half width now */}
                <TextField
                  label="Customer Phone"
                  value={customerPhone} //
                  onChange={(e) => setCustomerPhone(e.target.value)} //
                  fullWidth
                  required // Keep visual cue
                  type="tel" // Use type tel for phone numbers
                />
              </Grid>
              {/* Add empty grid item to fill space if desired */}
               <Grid item xs={12} md={6} />
            </>
          )}
          {/* ---------------------------------------------------- */}


          {/* --- Row 4: Total & Generate Bill Button --- */}
          {billItems.length > 0 && (
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
               {/* Total Display Box */}
              <Box>
                  <Typography variant="body2" color="text.secondary"> Total Discount Applied: ₹{totalDiscount.toFixed(2)} </Typography>
                  <Typography variant="h5" component="span" sx={{ mt: 1 }}> Grand Total:{' '} </Typography>
                  <Typography variant="h4" component="span" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}> ₹{grandTotal.toFixed(2)} </Typography>
              </Box>
               {/* Generate Bill Button */}
              <Button variant="contained" size="large" startIcon={<PrintIcon />} onClick={handleGenerateBill} > Generate & Print Bill </Button>
            </Grid>
          )}

        </Grid>
      </Paper>

      {/* --- Snackbar & Invoice Modal --- */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} >
         <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} variant="filled" sx={{ width: '100%' }} > {snackbarMessage} </Alert>
      </Snackbar>
      {showInvoice && saleId && ( <InvoiceModal open={showInvoice} saleId={saleId} onClose={handleCloseInvoice} /> )} {/* */}

    </Layout> //
  );
}