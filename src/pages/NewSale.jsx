// src/pages/NewSale.jsx
import React, { useState, useEffect, useCallback } from 'react';
// Corrected import path for supabase
import { supabase } from '../lib/supabase.js';
// Removed useAuth import as user_id filter is removed
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
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import Layout from '../components/Layout';
import InvoiceModal from '../components/InvoiceModal';

// --- Helper Functions ---

// Parses the leading integer from the item string (e.g., "10 tablets")
const parseUnitsFromItemString = (itemString) => {
    if (!itemString) return null;
    const match = itemString.match(/^\s*(\d+)/);
    const units = match ? parseInt(match[1], 10) : null;
    // Ensure it's a positive number, return null otherwise
    return units !== null && units > 0 ? units : null;
};


// Calculates amounts based on UNIT price and UNIT quantity
// GST logic REMOVED: MRP is inclusive
const calculateItemAmounts = (mrpPerUnit, discountPercent, quantityUnits, extraDiscountType, extraDiscountValue) => {
    const mrpUnitNum = parseFloat(mrpPerUnit) || 0;
    const discountNum = parseFloat(discountPercent) || 0; // Standard discount %
    const qtyUnitsNum = parseInt(quantityUnits, 10) || 0;
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    if (mrpUnitNum < 0 || qtyUnitsNum <= 0) return {
        subtotal: 0,
        gstAmount: 0, // Will be 0 now
        discountAmount: 0,
        extraDiscountAmount: 0,
        finalSubtotal: 0,
    };

    // Base price is MRP (inclusive of tax)
    const basePricePerUnit = mrpUnitNum;
    const standardDiscountPerUnit = basePricePerUnit * discountNum / 100;

    let extraDiscountPerUnit = 0;
    if (extraDiscountType === 'percent' && extraDiscValNum > 0) {
        extraDiscountPerUnit = basePricePerUnit * extraDiscValNum / 100;
    } else if (extraDiscountType === 'cost' && extraDiscValNum > 0) {
        extraDiscountPerUnit = extraDiscValNum;
    }

    const totalDiscountPerUnit = standardDiscountPerUnit + extraDiscountPerUnit;
    const finalPricePerUnit = Math.max(0, basePricePerUnit - totalDiscountPerUnit);

    // GST is NOT calculated or added. It is considered part of the MRP/Final Price.
    
    const totalStandardDiscountAmount = standardDiscountPerUnit * qtyUnitsNum;
    const totalExtraDiscountAmount = extraDiscountPerUnit * qtyUnitsNum;
    const finalSubtotal = Math.max(0, parseFloat((finalPricePerUnit * qtyUnitsNum).toFixed(2)));

    // Subtotal before extra discount (for record keeping if needed, similar to before)
    // This logic tries to replicate "Subtotal" as "Price after Std Disc" * Qty
    const subtotalBeforeExtra = parseFloat(((basePricePerUnit - standardDiscountPerUnit) * qtyUnitsNum).toFixed(2));

    return {
        subtotal: subtotalBeforeExtra,
        gstAmount: 0, // No GST amount calculated
        discountAmount: parseFloat(totalStandardDiscountAmount.toFixed(2)),
        extraDiscountAmount: parseFloat(totalExtraDiscountAmount.toFixed(2)),
        finalSubtotal: finalSubtotal,
    };
};
// --- ---

// --- CSS styles to hide number input spinners (remains the same) ---
const numberInputStyles = {
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
    display: 'none',
    '-webkit-appearance': 'none',
    margin: 0,
  },
  '& input[type=number]': {
    '-moz-appearance': 'textfield',
  },
};
// --- ---


export default function NewSale() {
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
  const [saleUnitType, setSaleUnitType] = useState('Unit');
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);


  const showSnackbar = useCallback((message, severity = 'info') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
   }, []);

  const fetchMedicines = useCallback(async () => {
     // Removed gst, added cgst, sgst
     const { data, error } = await supabase
      .from('medicines')
      .select('id, product_name, batch_no, expiry_date, mrp, stock, remaining_units, cgst, sgst, discount, no_of_items') 
      .order('product_name', { ascending: true });

    if(error){
        showSnackbar("Error fetching medicine list.", "error");
        console.error("Fetch Medicines Error:", error);
        setMedicines([]);
        return [];
    } else if (data) {
        setMedicines(data);
        return data;
    } else {
        setMedicines([]);
        return [];
    }
  }, [showSnackbar]);


  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const handleSnackbarClose = (event, reason) => {
      if (reason === 'clickaway') { return; }
      setSnackbarOpen(false);
   };

   const handleAddItem = () => {
     if (isGeneratingBill) return;
    const qtyInput = parseInt(quantity, 10);
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    if (!selectedMedicine || isNaN(qtyInput) || qtyInput <= 0) {
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

    const unitsPerPackage = parseUnitsFromItemString(selectedMedicine.no_of_items);
    if (!unitsPerPackage) {
        showSnackbar(`Could not determine units per package for "${selectedMedicine.product_name}". Check the 'Units Per Package' value in inventory.`, "error");
        return;
    }

    const totalUnitsToSell = saleUnitType === 'Package' ? qtyInput * unitsPerPackage : qtyInput;
     if (totalUnitsToSell <= 0) {
         showSnackbar("Calculated units to sell is zero or less.", "warning");
         return;
     }

    const mrpPerUnit = (selectedMedicine.mrp || 0) / unitsPerPackage;
     if (mrpPerUnit < 0) {
         showSnackbar(`Calculated MRP per unit for "${selectedMedicine.product_name}" is negative. Cannot add.`, "error");
         return;
    }

    if (mrpPerUnit > 0 && extraDiscountType === 'cost' && extraDiscValNum > mrpPerUnit) {
        showSnackbar(`Extra discount cost (₹${extraDiscValNum.toFixed(2)} per unit) cannot exceed the MRP per unit (₹${mrpPerUnit.toFixed(2)}).`, "warning");
        return;
    }

    const currentPackageStock = selectedMedicine.stock ?? 0;
    const currentRemainingUnits = selectedMedicine.remaining_units ?? 0;
    const totalAvailableUnits = (currentPackageStock * unitsPerPackage) + currentRemainingUnits;

    const quantityUnitsAlreadyInBill = billItems
        .filter(item => item.medicine_id === selectedMedicine.id)
        .reduce((sum, item) => sum + item.quantity_units_sold, 0);

    const requestedTotalUnits = quantityUnitsAlreadyInBill + totalUnitsToSell;

    if (requestedTotalUnits > totalAvailableUnits) {
        const availableNow = Math.max(0, totalAvailableUnits - quantityUnitsAlreadyInBill);
        showSnackbar(`Cannot add ${totalUnitsToSell} units (${quantity} ${saleUnitType}(s)). Only ${availableNow} more units of ${selectedMedicine.product_name} available in stock.`, "error");
        return;
    }

    const currentExtraDiscountType = extraDiscValNum > 0 ? extraDiscountType : null;
    const currentExtraDiscountValue = extraDiscValNum > 0 ? extraDiscValNum : 0;
    const existingItemIndex = billItems.findIndex(
        (item) =>
            item.medicine_id === selectedMedicine.id &&
            item.extraDiscountType === currentExtraDiscountType &&
            item.extraDiscountValue === currentExtraDiscountValue
    );


    if (existingItemIndex > -1) {
        const updatedItems = [...billItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantityUnits = existingItem.quantity_units_sold + totalUnitsToSell;

        // Recalculate amounts
        const newAmounts = calculateItemAmounts(
            existingItem.mrp_per_unit,
            existingItem.discount, // Standard discount %
            newQuantityUnits,
            existingItem.extraDiscountType,
            existingItem.extraDiscountValue
        );

        existingItem.quantity_units_sold = newQuantityUnits;
        existingItem.subtotal = newAmounts.subtotal;
        // existingItem.gstAmount = newAmounts.gstAmount; // Removed
        existingItem.discountAmount = newAmounts.discountAmount;
        existingItem.extraDiscountAmount = newAmounts.extraDiscountAmount;
        existingItem.finalSubtotal = newAmounts.finalSubtotal;
        setBillItems(updatedItems);

    } else {
        // Add new item
        const amounts = calculateItemAmounts(
            mrpPerUnit,
            selectedMedicine.discount,
            totalUnitsToSell,
            currentExtraDiscountType,
            currentExtraDiscountValue
        );

        const newItem = {
           medicine_id: selectedMedicine.id,
           product_name: selectedMedicine.product_name,
           batch_no: selectedMedicine.batch_no,
           expiry_date: selectedMedicine.expiry_date,
           mrp_per_package: selectedMedicine.mrp,
           mrp_per_unit: mrpPerUnit,
           cgst: selectedMedicine.cgst ?? 0, // Store CGST
           sgst: selectedMedicine.sgst ?? 0, // Store SGST
           discount: selectedMedicine.discount ?? 0,
           quantity_units_sold: totalUnitsToSell,
           units_per_package: unitsPerPackage,
           subtotal: amounts.subtotal,
           // gstAmount: amounts.gstAmount, // Removed
           discountAmount: amounts.discountAmount,
           extraDiscountType: currentExtraDiscountType,
           extraDiscountValue: currentExtraDiscountValue,
           extraDiscountAmount: amounts.extraDiscountAmount,
           finalSubtotal: amounts.finalSubtotal,
        };
        setBillItems([...billItems, newItem]);
    }

    setSelectedMedicine(null);
    setQuantity('');
    setSaleUnitType('Unit');
    setExtraDiscountType('percent');
    setExtraDiscountValue('');
  };

  const handleRemoveItem = (index) => {
     if (isGeneratingBill) return;
      setBillItems(billItems.filter((_, i) => i !== index));
   };

  // --- Total calculations (summing amounts from billItems) ---
    const grandTotal = billItems.reduce((total, item) => total + item.finalSubtotal, 0);
    const totalStandardDiscount = billItems.reduce((total, item) => total + item.discountAmount, 0);
    const totalExtraDiscount = billItems.reduce((total, item) => total + item.extraDiscountAmount, 0);
    const totalDiscount = totalStandardDiscount + totalExtraDiscount;
  // --- ---

   // --- handleGenerateBill updated ---
   const handleGenerateBill = async () => {
    if (billItems.length === 0) {
      showSnackbar('Please add at least one item to the bill.', "warning");
      return;
    }
     if (!customerPhone || customerPhone.trim() === '') {
        showSnackbar('Please enter Customer Phone Number.', 'warning');
        return;
    }

    setIsGeneratingBill(true);

    // 1. Fetch FRESH stock data
    const medicineIdsInBill = [...new Set(billItems.map(item => item.medicine_id))];
    const currentMedicinesDataResult = await fetchMedicines();

    if (!currentMedicinesDataResult || !Array.isArray(currentMedicinesDataResult)) {
         showSnackbar("Could not verify current stock levels (fetch failed). Please try again.", "error");
         setIsGeneratingBill(false);
         return;
    }
    const currentMedicinesData = currentMedicinesDataResult.filter(med => medicineIdsInBill.includes(med.id));


    // 2. Aggregate required units per medicine ID and re-validate stock
    let stockSufficient = true;
    const requiredUnitsMap = billItems.reduce((map, item) => {
        const key = String(item.medicine_id);
        map[key] = (map[key] || 0) + item.quantity_units_sold;
        return map;
    }, {});
    const stockUpdates = [];

    for (const medicineIdStr in requiredUnitsMap) {
        const med = currentMedicinesData.find(m => String(m.id) === medicineIdStr);
        const requiredTotalUnits = requiredUnitsMap[medicineIdStr];

        if (!med) {
            const billItemForName = billItems.find(item => String(item.medicine_id) === medicineIdStr);
            const productName = billItemForName ? billItemForName.product_name : `ID ${medicineIdStr}`;
            showSnackbar(`Error: Medicine "${productName}" not found in current inventory data. Sale cancelled.`, "error");
            stockSufficient = false;
            break;
        }

        const unitsPerPackage = parseUnitsFromItemString(med.no_of_items);
        if (!unitsPerPackage) {
            showSnackbar(`Error: Cannot parse units per package for ${med.product_name}. Sale cancelled.`, "error");
            stockSufficient = false;
            break;
        }

        const currentStockPackages = med.stock ?? 0;
        const currentRemainingUnits = med.remaining_units ?? 0;
        const totalAvailableUnits = (currentStockPackages * unitsPerPackage) + currentRemainingUnits;

        if (requiredTotalUnits > totalAvailableUnits) {
            showSnackbar(`Stock changed for ${med.product_name}. Only ${totalAvailableUnits} units available, ${requiredTotalUnits} required in bill. Sale cancelled.`, "error");
            stockSufficient = false;
            break;
        }

        // Calculate new stock
        let unitsToTake = requiredTotalUnits;
        let newRemainingUnits = currentRemainingUnits;
        let newStockPackages = currentStockPackages;

        const unitsFromRemaining = Math.min(unitsToTake, newRemainingUnits);
        newRemainingUnits -= unitsFromRemaining;
        unitsToTake -= unitsFromRemaining;

        if (unitsToTake > 0) {
            const packagesToOpen = Math.ceil(unitsToTake / unitsPerPackage);
            newStockPackages -= packagesToOpen;
            const unitsObtainedFromPackages = packagesToOpen * unitsPerPackage;
            const unitsLeftOver = unitsObtainedFromPackages - unitsToTake;
            newRemainingUnits += unitsLeftOver;
        }
        
        if (unitsPerPackage > 1 && newRemainingUnits >= unitsPerPackage) {
             const extraPackages = Math.floor(newRemainingUnits / unitsPerPackage);
             newStockPackages += extraPackages;
             newRemainingUnits %= unitsPerPackage;
        }


        stockUpdates.push({ id: med.id, stock: newStockPackages, remaining_units: newRemainingUnits });
    }

     if (!stockSufficient) {
         setIsGeneratingBill(false);
         return;
     }


    // 3. Proceed with saving Sale and SaleItems
    const billNumber = `BILL-${Date.now()}`;
    let generatedSaleId = null;

    try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert([ {
              bill_number: billNumber,
              customer_name: 'Walk-in',
              customer_phone: customerPhone || '-',
              grand_total: parseFloat(grandTotal.toFixed(2)),
              sale_date: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (saleError) throw new Error(`Error creating sale record: ${saleError.message}`);
        if (!saleData) throw new Error('Failed to create sale record, no data returned.');

        generatedSaleId = saleData.id;

        // Prepare Sale Items - include cgst/sgst values here if needed for future record, 
        // though invoice modal usually fetches from medicines. 
        // To be safe and consistent with "No Logic" request, we just save the basic item info.
        // If your DB scheme for sale_items doesn't have cgst/sgst columns, this won't break it.
        const saleItemsData = billItems.map((item) => ({
            sale_id: generatedSaleId,
            medicine_id: item.medicine_id,
            product_name: item.product_name,
            batch_no: item.batch_no,
            expiry_date: item.expiry_date,
            mrp: item.mrp_per_package,
            quantity: item.quantity_units_sold,
            subtotal: item.finalSubtotal,
            extra_discount_type: item.extraDiscountType,
            extra_discount_value: item.extraDiscountValue,
            extra_discount_amount: item.extraDiscountAmount,
            // Note: Not saving tax amounts here as requested "no logic"
         }));
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);

        if (itemsError) throw new Error(`Error saving sale items: ${itemsError.message}`);

        setSaleId(generatedSaleId);
        setShowInvoice(true);

        const stockUpdatePromises = stockUpdates.map(update =>
            supabase
                .from('medicines')
                .update({ stock: update.stock, remaining_units: update.remaining_units })
                .eq('id', update.id)
        );

        const stockUpdateResults = await Promise.all(stockUpdatePromises);
        const stockUpdateError = stockUpdateResults.find(result => result && result.error);

        if (stockUpdateError) {
            console.error("Stock update error details:", stockUpdateError.error);
            showSnackbar(`Sale recorded, but stock update failed: ${stockUpdateError.error.message}`, "warning");
        }

    } catch (error) {
        console.error("Bill Generation Error:", error);
        showSnackbar(error.message || 'An unexpected error occurred.', "error");
        setSaleId(null);
        setShowInvoice(false);
    } finally {
        setIsGeneratingBill(false);
    }
  };

  const handleCloseInvoice = () => {
    setShowInvoice(false);
    setSaleId(null);
    setBillItems([]);
    setCustomerPhone('');
    setExtraDiscountType('percent');
    setExtraDiscountValue('');
    setSaleUnitType('Unit');
    fetchMedicines();
  };

  const handleSaleUnitChange = (event, newUnitType) => {
    if (newUnitType !== null) {
      setSaleUnitType(newUnitType);
    }
  };


  return (
    <Layout>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        New Sale
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>

          <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1 }}>Add Item to Bill</Typography>
          </Grid>

          {/* Row 1: Search Product */}
          <Grid item xs={12}>
              <Autocomplete
                options={medicines}
                getOptionLabel={(option) => {
                    const unitsPerPackage = parseUnitsFromItemString(option.no_of_items);
                    const stockDisplay = unitsPerPackage
                        ? `[${option.stock || 0} pkgs + ${option.remaining_units || 0} units]`
                        : `[${option.stock || 0} pkgs]`;
                    return `${option.product_name} ${stockDisplay}` || '';
                }}
                value={selectedMedicine}
                onChange={(event, newValue) => { setSelectedMedicine(newValue); }}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                renderInput={(params) => (<TextField {...params} size="small" label="Search Product" placeholder="Type medicine name..." />)}
                renderOption={(props, option) => {
                     const unitsPerPackage = parseUnitsFromItemString(option.no_of_items);
                     const stockDisplay = unitsPerPackage
                         ? `${option.stock || 0} pkgs + ${option.remaining_units || 0} units`
                         : `${option.stock || 0} pkgs`;
                      const totalAvailableUnits = unitsPerPackage ? ((option.stock || 0) * unitsPerPackage) + (option.remaining_units || 0) : (option.stock || 0);
                     const isOutOfStock = totalAvailableUnits <= 0;

                    return (
                        <Box component="li" {...props} key={option.id}>
                            <Grid container spacing={1} sx={{ width: '100%' }}>
                                <Grid item xs={4}>
                                    <Typography variant="body1" sx={{ fontWeight: 'medium', color: isOutOfStock ? 'text.disabled' : 'inherit' }}>
                                        {option.product_name}
                                    </Typography>
                                </Grid>
                                <Grid item xs={3}>
                                    <Typography variant="body2" color={isOutOfStock ? 'error.main' : 'text.secondary'}>
                                        Stock: {stockDisplay}
                                    </Typography>
                                </Grid>
                                <Grid item xs={2}>
                                    <Typography variant="body2" color="text.secondary">
                                        Batch: {option.batch_no}
                                    </Typography>
                                </Grid>
                                <Grid item xs={3}>
                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                                        MRP: ₹{option.mrp?.toFixed(2)}/pkg
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    );
                }}
                ListboxProps={{ style: { maxHeight: 300 } }}
                getOptionDisabled={(option) => {
                    const unitsPerPackage = parseUnitsFromItemString(option.no_of_items);
                    const totalUnits = unitsPerPackage ? ((option.stock || 0) * unitsPerPackage) + (option.remaining_units || 0) : (option.stock || 0);
                    return !unitsPerPackage || totalUnits <= 0;
                }}
                size="small"
                sx={{ mb: 1 }}
              />

              <Paper variant="outlined" sx={{ p: '6px 14px', height: 'auto', minHeight: '40px', bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {selectedMedicine
                          ? `Selected: ${selectedMedicine.product_name} | Avail: ${selectedMedicine.stock || 0} pkgs + ${selectedMedicine.remaining_units || 0} units | MRP: ₹${selectedMedicine.mrp?.toFixed(2)}/pkg | CGST: ${selectedMedicine.cgst || 0}% | SGST: ${selectedMedicine.sgst || 0}%`
                          : 'Select a product from the list above.'
                      }
                  </Typography>
              </Paper>
          </Grid>

           {/* Row 2: Qty, Unit Type, Disc Type, Value, Add Button */}
           <Grid item container spacing={1} xs={12} alignItems="center" sx={{ mt: 1 }}>
               <Grid item xs={6} sm={3} md={2} lg={1.5}>
                  <TextField label="Qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} InputProps={{ inputProps: { min: "1" } }} fullWidth required variant="outlined" size="small" sx={numberInputStyles}/>
               </Grid>
                <Grid item xs={6} sm={3} md={2} lg={2}>
                  <ToggleButtonGroup
                    color="primary"
                    value={saleUnitType}
                    exclusive
                    onChange={handleSaleUnitChange}
                    aria-label="Sale Unit Type"
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="Unit" sx={{ flexGrow: 1 }}>Unit</ToggleButton>
                    <ToggleButton value="Package" sx={{ flexGrow: 1 }}>Package</ToggleButton>
                  </ToggleButtonGroup>
               </Grid>
               <Grid item xs={4} sm={2} md={2} lg={1.5}>
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
               <Grid item xs={4} sm={2} md={2} lg={1.5}>
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
                       helperText={extraDiscountType === 'cost' ? 'Per Unit' : ''}
                   />
               </Grid>
                <Grid item xs={4} sm={2} md={2} lg={1.5} sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <Button
                    variant="contained"
                    color="success"
                    onClick={handleAddItem}
                    disabled={ isGeneratingBill || !selectedMedicine || !parseUnitsFromItemString(selectedMedicine.no_of_items) || (((selectedMedicine.stock ?? 0) * (parseUnitsFromItemString(selectedMedicine.no_of_items) || 0) ) + (selectedMedicine.remaining_units ?? 0)) <= 0 }
                    fullWidth
                    startIcon={<AddIcon />}
                    size="medium"
                    sx={{ height: '40px'}}
                    > Add </Button>
                </Grid>
                <Grid item md={false} lg={4} sx={{ display: { xs: 'none', lg: 'block' } }} />
           </Grid>


           <Grid item xs={12}><Divider sx={{ my: 2 }} /></Grid>

           {/* Row: Current Bill Table */}
            <Grid item xs={12}>
             <Typography variant="h6" sx={{ mb: 1 }}>Current Bill</Typography>
             <TableContainer component={Paper} variant="outlined">
               <Table size="small" sx={{ minWidth: 950 }}>
                 <TableHead sx={{ bgcolor: 'grey.100' }}>
                   <TableRow>
                     <TableCell sx={{ minWidth: 150 }}>Product</TableCell>
                     <TableCell sx={{ minWidth: 80 }}>Batch</TableCell>
                     <TableCell sx={{ minWidth: 80 }}>MRP/Unit</TableCell>
                     <TableCell sx={{ minWidth: 100 }}>Std Disc Amt</TableCell>
                     <TableCell sx={{ minWidth: 100 }}>Extra Disc Amt</TableCell>
                     {/* Replaced GST with CGST/SGST columns */}
                     <TableCell sx={{ minWidth: 80 }}>CGST %</TableCell>
                     <TableCell sx={{ minWidth: 80 }}>SGST %</TableCell>
                     <TableCell align="right" sx={{ minWidth: 60 }}>Qty(Units)</TableCell>
                     <TableCell align="right" sx={{ minWidth: 90 }}>Amount</TableCell>
                     <TableCell align="right" sx={{ minWidth: 60 }}>Action</TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {billItems.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            No items added to bill
                        </TableCell>
                    </TableRow>
                   ) : (
                    billItems.map((item, index) => (
                      <TableRow key={`${item.medicine_id}-${item.batch_no}-${item.extraDiscountType}-${item.extraDiscountValue}-${index}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                         <TableCell component="th" scope="row">{item.product_name}</TableCell>
                         <TableCell>{item.batch_no}</TableCell>
                         <TableCell>₹{item.mrp_per_unit?.toFixed(2)}</TableCell>
                         <TableCell>₹{item.discountAmount?.toFixed(2)} ({item.discount || 0}%)</TableCell>
                         <TableCell>
                           ₹{item.extraDiscountAmount?.toFixed(2)}
                           {item.extraDiscountType === 'percent' && ` (${item.extraDiscountValue || 0}%)`}
                           {item.extraDiscountType === 'cost' && ` (₹${item.extraDiscountValue || 0}/unit)`}
                           {(!item.extraDiscountType || item.extraDiscountValue === 0) && ''}
                         </TableCell>
                         {/* Display CGST/SGST */}
                         <TableCell>{item.cgst || 0}%</TableCell>
                         <TableCell>{item.sgst || 0}%</TableCell>
                         <TableCell align="right">{item.quantity_units_sold}</TableCell>
                         <TableCell align="right" sx={{ fontWeight: 'medium'}}>₹{item.finalSubtotal?.toFixed(2)}</TableCell>
                         <TableCell align="right">
                             <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)} disabled={isGeneratingBill}>
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

           {/* Customer Phone */}
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
                  disabled={isGeneratingBill}
                />
              </Grid>
               <Grid item xs={false} md={6} />
            </>
          )}

           {/* Total & Generate Bill Button */}
           {billItems.length > 0 && (
            <Grid item xs={12} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mt: 2, gap: 2 }}>
              <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Savings: ₹{totalDiscount.toFixed(2)}
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
                  startIcon={isGeneratingBill ? <CircularProgress size={24} color="inherit" /> : <PrintIcon />}
                  onClick={handleGenerateBill}
                  disabled={isGeneratingBill}
                  sx={{ width: { xs: '100%', sm: 'auto' }}}
              >
                 {isGeneratingBill ? 'Generating...' : 'Generate & Print Bill'}
              </Button>
            </Grid>
          )}

        </Grid>
      </Paper>

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

    </Layout>
  );
}