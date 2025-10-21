// src/pages/NewSale.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  Snackbar,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import Layout from '../components/Layout';
import InvoiceModal from '../components/InvoiceModal';

// --- Calculation Helper (remains the same) ---
const calculateItemAmounts = (mrp, gst, discount, quantity, extraDiscountType, extraDiscountValue) => {
    const mrpNum = parseFloat(mrp) || 0;
    const gstNum = parseFloat(gst) || 0;
    const discountNum = parseFloat(discount) || 0; // Standard discount %
    const qtyNum = parseInt(quantity, 10) || 0;
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    if (mrpNum <= 0 || qtyNum <= 0) return {
        subtotal: 0,
        gstAmount: 0,
        discountAmount: 0,
        extraDiscountAmount: 0,
        finalSubtotal: 0,
    };

    const basePrice = mrpNum;
    const gstPerItem = basePrice * gstNum / 100;
    const standardDiscountPerItem = basePrice * discountNum / 100;

    let extraDiscountPerItem = 0;
    if (extraDiscountType === 'percent' && extraDiscValNum > 0) {
        extraDiscountPerItem = basePrice * extraDiscValNum / 100;
    } else if (extraDiscountType === 'cost' && extraDiscValNum > 0) {
        extraDiscountPerItem = extraDiscValNum;
    }

    const priceAfterDiscounts = basePrice - standardDiscountPerItem - extraDiscountPerItem;
    const finalPricePerItem = priceAfterDiscounts + gstPerItem;

    const totalGstAmount = gstPerItem * qtyNum;
    const totalStandardDiscountAmount = standardDiscountPerItem * qtyNum;
    const totalExtraDiscountAmount = extraDiscountPerItem * qtyNum;
    const finalSubtotal = Math.max(0, finalPricePerItem * qtyNum);

    return {
        subtotal: (basePrice + gstPerItem - standardDiscountPerItem) * qtyNum,
        gstAmount: totalGstAmount,
        discountAmount: totalStandardDiscountAmount,
        extraDiscountAmount: totalExtraDiscountAmount,
        finalSubtotal: finalSubtotal,
    };
};
// -----------------------

// --- CSS styles to hide number input spinners (remains the same) ---
const numberInputStyles = {
  // Hide spinners for WebKit browsers (Chrome, Safari, Edge)
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
    display: 'none',
    '-webkit-appearance': 'none',
    margin: 0,
  },
  // Hide spinners for Firefox
  '& input[type=number]': {
    '-moz-appearance': 'textfield',
  },
};
// --- ---


export default function NewSale() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [customerPhone, setCustomerPhone] = useState('');
  const [extraDiscountType, setExtraDiscountType] = useState('percent');
  const [extraDiscountValue, setExtraDiscountValue] = useState('');

  // --- fetchMedicines, showSnackbar, handleSnackbarClose remain the same ---
  const fetchMedicines = useCallback(async () => {
     const { data, error } = await supabase
      .from('medicines')
      .select('id, product_name, batch_no, expiry_date, mrp, stock, gst, discount');

    if(error){
        showSnackbar("Error fetching medicine list.", "error");
        console.error("Fetch Medicines Error:", error);
        return [];
    } else if (data) {
        data.sort((a, b) => a.product_name.localeCompare(b.product_name));
        setMedicines(data);
        return data;
    } else {
        setMedicines([]);
        return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const showSnackbar = (message, severity = 'info') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
   };
  const handleSnackbarClose = (event, reason) => {
      if (reason === 'clickaway') { return; }
      setSnackbarOpen(false);
   };
  // --- ---

  // --- handleAddItem, handleRemoveItem remain the same ---
   const handleAddItem = () => {
    const qtyToAdd = parseInt(quantity, 10);
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    if (!selectedMedicine || isNaN(qtyToAdd) || qtyToAdd <= 0) {
        showSnackbar("Please select a medicine and enter a valid positive quantity.", "warning");
        return;
    };
    if (extraDiscValNum < 0) {
        showSnackbar("Extra discount value cannot be negative.", "warning");
        return;
    }
    if (extraDiscountType === 'percent' && extraDiscValNum > 100) {
        showSnackbar("Extra discount percentage cannot exceed 100.", "warning");
        return;
    }
     if (extraDiscountType === 'cost' && extraDiscValNum > (selectedMedicine.mrp || 0)) {
        showSnackbar(`Extra discount cost (₹${extraDiscValNum.toFixed(2)}) cannot exceed the MRP (₹${(selectedMedicine.mrp || 0).toFixed(2)}).`, "warning");
        return;
    }

    const availableStock = selectedMedicine.stock ?? 0;
    const existingItemIndex = billItems.findIndex(
        (item) =>
            item.medicine_id === selectedMedicine.id &&
            item.extraDiscountType === (extraDiscValNum > 0 ? extraDiscountType : null) &&
            item.extraDiscountValue === extraDiscValNum
    );

    let quantityAlreadyInBill = 0;
    if (existingItemIndex > -1) {
        quantityAlreadyInBill = billItems[existingItemIndex].quantity;
    } else {
        quantityAlreadyInBill = billItems
            .filter(item => item.medicine_id === selectedMedicine.id)
            .reduce((sum, item) => sum + item.quantity, 0);
    }

    const requestedTotalQuantity = quantityAlreadyInBill + qtyToAdd;
    if (requestedTotalQuantity > availableStock) {
        showSnackbar(`Cannot add ${qtyToAdd}. Only ${availableStock - quantityAlreadyInBill} of ${selectedMedicine.product_name} available in stock (including items already in bill).`, "error");
        return;
    }

    const amounts = calculateItemAmounts(
        selectedMedicine.mrp,
        selectedMedicine.gst,
        selectedMedicine.discount,
        qtyToAdd,
        extraDiscValNum > 0 ? extraDiscountType : null,
        extraDiscValNum
    );

    if (existingItemIndex > -1) {
        const updatedItems = [...billItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + qtyToAdd;
        const newAmounts = calculateItemAmounts(
            existingItem.mrp, existingItem.gst, existingItem.discount, newQuantity,
            existingItem.extraDiscountType, existingItem.extraDiscountValue
        );
        existingItem.quantity = newQuantity;
        existingItem.subtotal = newAmounts.subtotal;
        existingItem.gstAmount = newAmounts.gstAmount;
        existingItem.discountAmount = newAmounts.discountAmount;
        existingItem.extraDiscountAmount = newAmounts.extraDiscountAmount;
        existingItem.finalSubtotal = newAmounts.finalSubtotal;
        setBillItems(updatedItems);
    } else {
        const newItem = {
           medicine_id: selectedMedicine.id,
           product_name: selectedMedicine.product_name,
           batch_no: selectedMedicine.batch_no,
           expiry_date: selectedMedicine.expiry_date,
           mrp: selectedMedicine.mrp,
           gst: selectedMedicine.gst ?? 0,
           discount: selectedMedicine.discount ?? 0,
           quantity: qtyToAdd,
           subtotal: amounts.subtotal,
           gstAmount: amounts.gstAmount,
           discountAmount: amounts.discountAmount,
           extraDiscountType: extraDiscValNum > 0 ? extraDiscountType : null,
           extraDiscountValue: extraDiscValNum > 0 ? extraDiscValNum : 0,
           extraDiscountAmount: amounts.extraDiscountAmount,
           finalSubtotal: amounts.finalSubtotal,
        };
        setBillItems([...billItems, newItem]);
    }

    setSelectedMedicine(null);
    setQuantity('');
    setExtraDiscountType('percent');
    setExtraDiscountValue('');
  };

  const handleRemoveItem = (index) => {
      setBillItems(billItems.filter((_, i) => i !== index));
   };
  // --- ---

  // --- Total calculations remain the same ---
    const grandTotal = billItems.reduce((total, item) => total + item.finalSubtotal, 0);
    const totalStandardDiscount = billItems.reduce((total, item) => total + item.discountAmount, 0);
    const totalExtraDiscount = billItems.reduce((total, item) => total + item.extraDiscountAmount, 0);
    const totalDiscount = totalStandardDiscount + totalExtraDiscount;
  // --- ---

  // --- handleGenerateBill and handleCloseInvoice remain the same (with previous fix) ---
   const handleGenerateBill = async () => {
    if (billItems.length === 0) {
      showSnackbar('Please add at least one item to the bill.', "warning");
      return;
    }
     if (!customerPhone || customerPhone.trim() === '') {
        showSnackbar('Please enter Customer Phone Number.', 'warning');
        return;
    }

     const currentMedicinesData = await fetchMedicines();
     if (!currentMedicinesData || currentMedicinesData.length === 0) {
         showSnackbar("Could not verify current stock levels. Please try again.", "error");
         return;
     }

    let stockSufficient = true;
    const stockMap = billItems.reduce((map, item) => {
        const key = String(item.medicine_id);
        map[key] = (map[key] || 0) + item.quantity;
        return map;
    }, {});


    for (const medicineId in stockMap) {
        const med = currentMedicinesData.find(m => String(m.id) === String(medicineId)); // Use string comparison
        const requiredQty = stockMap[medicineId];
        const currentStock = med?.stock ?? 0;

        if (!med || currentStock < requiredQty) {
            showSnackbar(`Stock changed for ${med?.product_name || `ID ${medicineId}`}. Only ${currentStock} available, ${requiredQty} required in bill.`, "error");
            stockSufficient = false;
            break;
        }
    }
     if (!stockSufficient) { return; }

    const billNumber = `BILL-${Date.now()}`;

    try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert([ {
              user_id: user.id,
              bill_number: billNumber,
              customer_name: 'Walk-in',
              customer_phone: customerPhone,
              grand_total: grandTotal,
              sale_date: new Date().toISOString(),
            },
          ])
          .select().single();

        if (saleError) throw new Error(`Error creating sale record: ${saleError.message}`);
        if (!saleData) throw new Error('Failed to create sale record, no data returned.');


        const saleItemsData = billItems.map((item) => ({
            sale_id: saleData.id,
            medicine_id: item.medicine_id,
            product_name: item.product_name,
            batch_no: item.batch_no,
            expiry_date: item.expiry_date,
            mrp: item.mrp,
            quantity: item.quantity,
            subtotal: item.finalSubtotal,
            extra_discount_type: item.extraDiscountType,
            extra_discount_value: item.extraDiscountValue,
            extra_discount_amount: item.extraDiscountAmount,
         }));
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);

        if (itemsError) throw new Error(`Error saving sale items: ${itemsError.message}`);

        const stockUpdatePromises = Object.entries(stockMap).map(([medicineIdStr, quantitySold]) => {
            const originalMedicine = currentMedicinesData.find(med => String(med.id) === String(medicineIdStr));
            if (!originalMedicine) {
                console.error(`Medicine with ID ${medicineIdStr} not found in fresh data for stock update.`);
                return Promise.resolve({ error: { message: `Medicine ID ${medicineIdStr} not found.`} });
            }
            const newStock = (originalMedicine.stock ?? 0) - quantitySold;
            return supabase
                .from('medicines')
                .update({ stock: Math.max(0, newStock) })
                .eq('id', originalMedicine.id); // Use correct ID type
        });

        const stockUpdateResults = await Promise.all(stockUpdatePromises);
        const stockUpdateError = stockUpdateResults.find(result => result && result.error);
        if (stockUpdateError) {
            console.error("Stock update error details:", stockUpdateError.error);
            throw new Error(`Sale recorded, but failed to update stock for one or more items. Please check inventory manually. Error: ${stockUpdateError.error.message}`);
        }

        showSnackbar("Sale recorded and stock updated successfully!", "success");
        setSaleId(saleData.id);
        setShowInvoice(true);

    } catch (error) {
        console.error("Bill Generation/Stock Update Error:", error);
        showSnackbar(error.message || 'An unexpected error occurred during bill generation.', "error");
    }
  };

  const handleCloseInvoice = () => {
    setShowInvoice(false);
    setSaleId(null);
    setBillItems([]);
    setCustomerPhone('');
    setExtraDiscountType('percent');
    setExtraDiscountValue('');
    fetchMedicines();
  };
  // --- ---

  return (
    <Layout>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        New Sale
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}> {/* Main Container */}

          <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1 }}>Add Item to Bill</Typography>
          </Grid>

          {/* === START: MODIFIED Grid Layout for Add Item section === */}

          {/* Row 1: Search Product (Full Width) */}
          <Grid item xs={12}>
              <Autocomplete
                options={medicines}
                getOptionLabel={(option) => `${option.product_name} (Stock: ${option.stock ?? 'N/A'})` || ''}
                value={selectedMedicine}
                onChange={(event, newValue) => { setSelectedMedicine(newValue); }}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                renderInput={(params) => (<TextField {...params} size="small" label="Search Product" placeholder="Type medicine name..." />)}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.id}>
                    <Grid container spacing={1} sx={{ width: '100%' }}>
                      <Grid item xs={4}><Typography variant="body1" sx={{ fontWeight: 'medium' }}>{option.product_name}</Typography></Grid>
                      <Grid item xs={1}><Typography variant="body2" color={option.stock > 0 ? 'text.secondary' : 'error.main'}>S: {option.stock ?? 'N/A'}</Typography></Grid>
                      <Grid item xs={1}><Typography variant="body2" color="text.secondary">G: {option.gst ?? 0}%</Typography></Grid>
                      <Grid item xs={1}><Typography variant="body2" color="text.secondary">D: {option.discount ?? 0}%</Typography></Grid>
                      <Grid item xs={2}><Typography variant="body2" color="text.secondary">B: {option.batch_no}</Typography></Grid>
                      <Grid item xs={3}><Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>MRP: ₹{option.mrp?.toFixed(2)}</Typography></Grid>
                    </Grid>
                  </Box>
                )}
                ListboxProps={{ style: { maxHeight: 300 } }}
                getOptionDisabled={(option) => (option.stock ?? 0) <= 0}
                size="small"
                sx={{ mb: 1 }} // Add margin below Autocomplete
              />

              {/* Info Box - Moved Directly Below Autocomplete */}
              <Paper variant="outlined" sx={{ p: '6px 14px', height: '40px', bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }} noWrap>
                      {selectedMedicine
                          ? `Stock: ${selectedMedicine.stock ?? 'N/A'} | MRP: ₹${selectedMedicine.mrp?.toFixed(2)} | Batch: ${selectedMedicine.batch_no}`
                          : 'Select a product from the list above.'
                      }
                  </Typography>
              </Paper>
          </Grid>

           {/* Row 2: Qty, Disc Type, Value, Add Button (Now below the info box) */}
           <Grid item container spacing={2} xs={12} alignItems="center" sx={{ mt: 1 }}> {/* Add margin top */}

               {/* Quantity - Adjusted Grid size */}
               <Grid item xs={4} sm={3} md={2} lg={1}>
                  <TextField label="Qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} InputProps={{ inputProps: { min: "1" } }} fullWidth required variant="outlined" size="small" sx={numberInputStyles}/>
               </Grid>

               {/* Extra Discount Type - Adjusted Grid size */}
               <Grid item xs={4} sm={3} md={2} lg={1}>
                   <FormControl fullWidth size="small">
                       <InputLabel id="extra-discount-type-label">Disc Type</InputLabel>
                       <Select
                           labelId="extra-discount-type-label"
                           value={extraDiscountType}
                           label="Disc Type"
                           onChange={(e) => setExtraDiscountType(e.target.value)}
                       >
                           <MenuItem value={'percent'}>%</MenuItem>
                           <MenuItem value={'cost'}>₹</MenuItem>
                       </Select>
                   </FormControl>
               </Grid>

               {/* Extra Discount Value - Adjusted Grid size */}
               <Grid item xs={4} sm={3} md={2} lg={1}>
                   <TextField
                       label="Value"
                       type="number"
                       value={extraDiscountValue}
                       onChange={(e) => setExtraDiscountValue(e.target.value)}
                       InputProps={{
                           inputProps: { min: "0", step: "0.01" },
                           startAdornment: extraDiscountType === 'cost' ? <InputAdornment position="start">₹</InputAdornment> : null,
                           endAdornment: extraDiscountType === 'percent' ? <InputAdornment position="end">%</InputAdornment> : null,
                       }}
                       fullWidth
                       placeholder="0"
                       variant="outlined" size="small"
                       sx={numberInputStyles}
                   />
               </Grid>

                {/* Add Button - Adjusted Grid size and alignment */}
                <Grid item xs={12} sm={3} md={2} lg={2} sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <Button
                    variant="contained"
                    color="success"
                    onClick={handleAddItem}
                    disabled={!selectedMedicine || (selectedMedicine.stock ?? 0) <= 0}
                    fullWidth
                    startIcon={<AddIcon />}
                    size="medium"
                    sx={{ height: '40px'}}
                    > Add Item </Button>
                </Grid>

                {/* Optional Spacer Grid item if needed for alignment on larger screens */}
                <Grid item md={4} lg={7} sx={{ display: { xs: 'none', md: 'block' } }} />

           </Grid> {/* End of Row 2 Grid */}

           {/* === END: MODIFIED Grid Layout === */}

           <Grid item xs={12}><Divider sx={{ my: 2 }} /></Grid>

           {/* --- Current Bill Table, Customer Details, Totals (remain the same) --- */}
           {/* Row: Current Bill Table */}
            <Grid item xs={12}>
             <Typography variant="h6" sx={{ mb: 1 }}>Current Bill</Typography>
             <TableContainer component={Paper} variant="outlined">
               <Table size="small" sx={{ minWidth: 950 }}> {/* Adjust minWidth as needed */}
                 <TableHead sx={{ bgcolor: 'grey.100' }}>
                   <TableRow>
                     <TableCell sx={{ minWidth: 150 }}>Product</TableCell>
                     <TableCell sx={{ minWidth: 80 }}>Batch</TableCell>
                     <TableCell sx={{ minWidth: 70 }}>MRP</TableCell>
                     <TableCell sx={{ minWidth: 100 }}>Std Disc</TableCell>
                     <TableCell sx={{ minWidth: 100 }}>Extra Disc</TableCell>
                     <TableCell sx={{ minWidth: 100 }}>GST Amt</TableCell>
                     <TableCell align="right" sx={{ minWidth: 50 }}>Qty</TableCell>
                     <TableCell align="right" sx={{ minWidth: 90 }}>Amount</TableCell>
                     <TableCell align="right" sx={{ minWidth: 60 }}>Action</TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {billItems.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            No items added to bill
                        </TableCell>
                    </TableRow>
                   ) : (
                    billItems.map((item, index) => (
                      <TableRow key={`${item.medicine_id}-${item.batch_no}-${index}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                         <TableCell component="th" scope="row">{item.product_name}</TableCell>
                         <TableCell>{item.batch_no}</TableCell>
                         <TableCell>₹{item.mrp?.toFixed(2)}</TableCell>
                         <TableCell>₹{item.discountAmount?.toFixed(2)} ({item.discount || 0}%)</TableCell>
                         <TableCell>
                           ₹{item.extraDiscountAmount?.toFixed(2)}
                           {item.extraDiscountType === 'percent' && ` (${item.extraDiscountValue || 0}%)`}
                           {item.extraDiscountType === 'cost' && ` (₹${item.extraDiscountValue || 0})`}
                           {!item.extraDiscountType && '₹0.00'} {/* Show 0 if no extra discount */}
                         </TableCell>
                         <TableCell>₹{item.gstAmount?.toFixed(2)} ({item.gst || 0}%)</TableCell>
                         <TableCell align="right">{item.quantity}</TableCell>
                         <TableCell align="right" sx={{ fontWeight: 'medium'}}>₹{item.finalSubtotal?.toFixed(2)}</TableCell>
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

           {/* Row: Customer Phone */}
           {billItems.length > 0 && (
            <>
              <Grid item xs={12}>
                 <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Customer Details</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Customer Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  fullWidth
                  required
                  type="tel"
                  inputProps={{ maxLength: 15 }}
                />
              </Grid>
               <Grid item xs={false} md={6} />
            </>
          )}

           {/* Row: Total & Generate Bill Button */}
           {billItems.length > 0 && (
            <Grid item xs={12} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mt: 2, gap: 2 }}>
              <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Savings (Std+Extra): ₹{totalDiscount.toFixed(2)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 1 }}>
                     <Typography variant="h5" component="span">
                        Grand Total:{' '}
                     </Typography>
                     <Typography variant="h4" component="span" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>
                        ₹{grandTotal.toFixed(2)}
                     </Typography>
                  </Box>
              </Box>
              <Button
                  variant="contained"
                  size="large"
                  startIcon={<PrintIcon />}
                  onClick={handleGenerateBill}
                  sx={{ width: { xs: '100%', sm: 'auto' }}}
              >
                 Generate & Print Bill
              </Button>
            </Grid>
          )}
          {/* --- --- */}

        </Grid> {/* End of main container grid */}
      </Paper>

      {/* --- Snackbar & Invoice Modal (remain the same) --- */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} variant="filled" sx={{ width: '100%' }}>
            {snackbarMessage}
        </Alert>
      </Snackbar>

      {showInvoice && saleId && (
        <InvoiceModal
            open={showInvoice}
            saleId={saleId}
            onClose={handleCloseInvoice}
        />
      )}
      {/* --- --- */}

    </Layout>
  );
}