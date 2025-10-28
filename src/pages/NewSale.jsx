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
  ToggleButton, // Added
  ToggleButtonGroup, // Added
  CircularProgress, // Added missing import
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
const calculateItemAmounts = (mrpPerUnit, gstPercent, discountPercent, quantityUnits, extraDiscountType, extraDiscountValue) => {
    const mrpUnitNum = parseFloat(mrpPerUnit) || 0;
    const gstNum = parseFloat(gstPercent) || 0;
    const discountNum = parseFloat(discountPercent) || 0; // Standard discount %
    const qtyUnitsNum = parseInt(quantityUnits, 10) || 0;
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    // Return zero amounts if unit price or quantity is invalid
    // Allow mrpUnitNum to be 0 for free items, but ensure qtyUnitsNum is positive
    if (mrpUnitNum < 0 || qtyUnitsNum <= 0) return {
        subtotal: 0,
        gstAmount: 0,
        discountAmount: 0,
        extraDiscountAmount: 0,
        finalSubtotal: 0,
    };

    // Assuming MRP/Unit is the base price per unit before any discounts or taxes.
    const basePricePerUnit = mrpUnitNum;
    const standardDiscountPerUnit = basePricePerUnit * discountNum / 100;

    let extraDiscountPerUnit = 0;
    if (extraDiscountType === 'percent' && extraDiscValNum > 0) {
        extraDiscountPerUnit = basePricePerUnit * extraDiscValNum / 100;
    } else if (extraDiscountType === 'cost' && extraDiscValNum > 0) {
        // Assuming extraDiscountValue is PER UNIT if type is 'cost'.
        extraDiscountPerUnit = extraDiscValNum;
    }

    // Calculate discounted price before GST, ensuring it's not negative
    const totalDiscountPerUnit = standardDiscountPerUnit + extraDiscountPerUnit;
    const priceAfterDiscountsPerUnit = Math.max(0, basePricePerUnit - totalDiscountPerUnit);


    // Calculate GST based on the discounted price
    const gstAmountPerUnit = priceAfterDiscountsPerUnit * gstNum / 100;

    // Final price includes discounted price + GST
    const finalPricePerUnit = priceAfterDiscountsPerUnit + gstAmountPerUnit;

    // Calculate total amounts for the quantity sold
    const totalGstAmount = gstAmountPerUnit * qtyUnitsNum;
    const totalStandardDiscountAmount = standardDiscountPerUnit * qtyUnitsNum;
    const totalExtraDiscountAmount = extraDiscountPerUnit * qtyUnitsNum;
    // Ensure final subtotal isn't negative due to floating point issues
    const finalSubtotal = Math.max(0, parseFloat((finalPricePerUnit * qtyUnitsNum).toFixed(2)));


    // Subtotal before extra discount but including standard discount and GST
    const subtotalBeforeExtra = parseFloat(((basePricePerUnit - standardDiscountPerUnit + (basePricePerUnit - standardDiscountPerUnit) * gstNum / 100) * qtyUnitsNum).toFixed(2));


    return {
        subtotal: subtotalBeforeExtra, // Value before extra discount applied
        gstAmount: parseFloat(totalGstAmount.toFixed(2)),
        discountAmount: parseFloat(totalStandardDiscountAmount.toFixed(2)), // Standard discount only
        extraDiscountAmount: parseFloat(totalExtraDiscountAmount.toFixed(2)), // Extra discount only
        finalSubtotal: finalSubtotal, // Final line item total after all discounts and tax
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
  // Removed user from useAuth()
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
  const [saleUnitType, setSaleUnitType] = useState('Unit'); // New state: 'Unit' or 'Package'
  const [isGeneratingBill, setIsGeneratingBill] = useState(false); // State to disable button during processing


  // --- fetchMedicines updated ---
   // Adding useCallback to showSnackbar dependency
  const showSnackbar = useCallback((message, severity = 'info') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
   }, []); // Now stable

  const fetchMedicines = useCallback(async () => {
     // Select necessary fields including new stock fields and no_of_items
     const { data, error } = await supabase
      .from('medicines')
      .select('id, product_name, batch_no, expiry_date, mrp, stock, remaining_units, gst, discount, no_of_items') // Added remaining_units, no_of_items
      // Removed user_id filter
      .order('product_name', { ascending: true }); // Sort fetched data

    if(error){
        showSnackbar("Error fetching medicine list.", "error"); // showSnackbar is now available
        console.error("Fetch Medicines Error:", error);
        setMedicines([]); // Ensure state is empty on error
        return []; // Return empty array on error
    } else if (data) {
        setMedicines(data);
        return data; // Return data for handleGenerateBill validation
    } else {
        setMedicines([]);
        return []; // Return empty array if no data
    }
  }, [showSnackbar]); // Added showSnackbar to dependency array


  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);
  // --- ---


  const handleSnackbarClose = (event, reason) => {
      if (reason === 'clickaway') { return; }
      setSnackbarOpen(false);
   };
  // --- ---

  // --- handleAddItem updated significantly ---
   const handleAddItem = () => {
     if (isGeneratingBill) return; // Prevent adding items while bill is generating
    const qtyInput = parseInt(quantity, 10);
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    // Basic Validations
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

    // Parse Units Per Package
    const unitsPerPackage = parseUnitsFromItemString(selectedMedicine.no_of_items);
    if (!unitsPerPackage) {
        showSnackbar(`Could not determine units per package for "${selectedMedicine.product_name}". Check the 'Units Per Package' value in inventory.`, "error");
        return;
    }

    // Calculate Total Units to Sell based on input type
    const totalUnitsToSell = saleUnitType === 'Package' ? qtyInput * unitsPerPackage : qtyInput;
     if (totalUnitsToSell <= 0) {
         showSnackbar("Calculated units to sell is zero or less.", "warning");
         return;
     }

    // Calculate Unit MRP for discount validation
    const mrpPerUnit = (selectedMedicine.mrp || 0) / unitsPerPackage;
     if (mrpPerUnit < 0) { // Explicitly block negative unit MRP
         showSnackbar(`Calculated MRP per unit for "${selectedMedicine.product_name}" is negative. Cannot add.`, "error");
         return;
    }


    // Check Extra Discount Value (Cost Type) against Unit MRP only if mrpPerUnit > 0
    if (mrpPerUnit > 0 && extraDiscountType === 'cost' && extraDiscValNum > mrpPerUnit) {
        showSnackbar(`Extra discount cost (₹${extraDiscValNum.toFixed(2)} per unit) cannot exceed the MRP per unit (₹${mrpPerUnit.toFixed(2)}).`, "warning");
        return;
    }


    // Stock Validation
    const currentPackageStock = selectedMedicine.stock ?? 0;
    const currentRemainingUnits = selectedMedicine.remaining_units ?? 0;
    const totalAvailableUnits = (currentPackageStock * unitsPerPackage) + currentRemainingUnits;

    // Find existing units of this medicine already in the bill
    const quantityUnitsAlreadyInBill = billItems
        .filter(item => item.medicine_id === selectedMedicine.id)
        .reduce((sum, item) => sum + item.quantity_units_sold, 0);

    const requestedTotalUnits = quantityUnitsAlreadyInBill + totalUnitsToSell;

    if (requestedTotalUnits > totalAvailableUnits) {
        const availableNow = Math.max(0, totalAvailableUnits - quantityUnitsAlreadyInBill); // Ensure availableNow is not negative
        showSnackbar(`Cannot add ${totalUnitsToSell} units (${quantity} ${saleUnitType}(s)). Only ${availableNow} more units of ${selectedMedicine.product_name} available in stock.`, "error");
        return;
    }

    // Check if item with same medicine ID AND same extra discount exists
     // Handle null/0 discount value correctly in findIndex
    const currentExtraDiscountType = extraDiscValNum > 0 ? extraDiscountType : null;
    const currentExtraDiscountValue = extraDiscValNum > 0 ? extraDiscValNum : 0;
    const existingItemIndex = billItems.findIndex(
        (item) =>
            item.medicine_id === selectedMedicine.id &&
            item.extraDiscountType === currentExtraDiscountType &&
            item.extraDiscountValue === currentExtraDiscountValue
    );


    if (existingItemIndex > -1) {
        // Update existing item
        const updatedItems = [...billItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantityUnits = existingItem.quantity_units_sold + totalUnitsToSell;

        // Recalculate amounts for the new total quantity
        const newAmounts = calculateItemAmounts(
            existingItem.mrp_per_unit,
            existingItem.gst,
            existingItem.discount, // Standard discount %
            newQuantityUnits,
            existingItem.extraDiscountType,
            existingItem.extraDiscountValue
        );

        existingItem.quantity_units_sold = newQuantityUnits;
        existingItem.subtotal = newAmounts.subtotal;
        existingItem.gstAmount = newAmounts.gstAmount;
        existingItem.discountAmount = newAmounts.discountAmount; // Standard discount amount for the new quantity
        existingItem.extraDiscountAmount = newAmounts.extraDiscountAmount; // Extra discount amount for the new quantity
        existingItem.finalSubtotal = newAmounts.finalSubtotal;
        setBillItems(updatedItems);

    } else {
        // Add new item
        const amounts = calculateItemAmounts(
            mrpPerUnit,
            selectedMedicine.gst,
            selectedMedicine.discount,
            totalUnitsToSell, // Pass total units to sell
            currentExtraDiscountType,
            currentExtraDiscountValue
        );

        const newItem = {
           medicine_id: selectedMedicine.id,
           product_name: selectedMedicine.product_name,
           batch_no: selectedMedicine.batch_no,
           expiry_date: selectedMedicine.expiry_date,
           mrp_per_package: selectedMedicine.mrp, // Store original package MRP for reference
           mrp_per_unit: mrpPerUnit, // Store calculated unit MRP
           gst: selectedMedicine.gst ?? 0,
           discount: selectedMedicine.discount ?? 0, // Standard discount %
           quantity_units_sold: totalUnitsToSell, // Store quantity in units
           units_per_package: unitsPerPackage, // Store units per package
           subtotal: amounts.subtotal, // Subtotal before extra discount
           gstAmount: amounts.gstAmount,
           discountAmount: amounts.discountAmount, // Standard discount amount
           extraDiscountType: currentExtraDiscountType,
           extraDiscountValue: currentExtraDiscountValue,
           extraDiscountAmount: amounts.extraDiscountAmount, // Extra discount amount
           finalSubtotal: amounts.finalSubtotal, // Final amount for this line item
        };
        setBillItems([...billItems, newItem]);
    }

    // Reset input fields
    setSelectedMedicine(null);
    setQuantity('');
    setSaleUnitType('Unit'); // Reset to default
    setExtraDiscountType('percent');
    setExtraDiscountValue('');
  };

  const handleRemoveItem = (index) => {
     if (isGeneratingBill) return; // Prevent removing items while bill is generating
      setBillItems(billItems.filter((_, i) => i !== index));
   };
  // --- ---

  // --- Total calculations (summing amounts from billItems) ---
    const grandTotal = billItems.reduce((total, item) => total + item.finalSubtotal, 0);
    // Calculate total standard discount applied across all items
    const totalStandardDiscount = billItems.reduce((total, item) => total + item.discountAmount, 0);
    // Calculate total extra discount applied across all items
    const totalExtraDiscount = billItems.reduce((total, item) => total + item.extraDiscountAmount, 0);
    // Total savings is the sum of both standard and extra discounts
    const totalDiscount = totalStandardDiscount + totalExtraDiscount;
  // --- ---

   // --- handleGenerateBill updated significantly ---
   const handleGenerateBill = async () => {
    if (billItems.length === 0) {
      showSnackbar('Please add at least one item to the bill.', "warning");
      return;
    }
     if (!customerPhone || customerPhone.trim() === '') {
        showSnackbar('Please enter Customer Phone Number.', 'warning');
        return;
    }

    setIsGeneratingBill(true); // Disable buttons

    // 1. Fetch FRESH stock data for items in the bill
    const medicineIdsInBill = [...new Set(billItems.map(item => item.medicine_id))];
     // Await the fetchMedicines call to ensure data is available
    const currentMedicinesDataResult = await fetchMedicines(); // Re-fetch latest stock

    // Check if fetchMedicines returned valid data
    if (!currentMedicinesDataResult || !Array.isArray(currentMedicinesDataResult)) {
         showSnackbar("Could not verify current stock levels (fetch failed). Please try again.", "error");
         setIsGeneratingBill(false); // Re-enable button
         return;
    }
     // Filter the result specifically for the IDs in the bill
    const currentMedicinesData = currentMedicinesDataResult.filter(med => medicineIdsInBill.includes(med.id));


    // 2. Aggregate required units per medicine ID and re-validate stock
    let stockSufficient = true;
    const requiredUnitsMap = billItems.reduce((map, item) => {
        const key = String(item.medicine_id);
        map[key] = (map[key] || 0) + item.quantity_units_sold;
        return map;
    }, {});
    const stockUpdates = []; // To store { id, stock, remaining_units }

    for (const medicineIdStr in requiredUnitsMap) {
        const med = currentMedicinesData.find(m => String(m.id) === medicineIdStr);
        const requiredTotalUnits = requiredUnitsMap[medicineIdStr];

        if (!med) {
            // Attempt to find the product name from bill items for a better error message
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

        // Calculate new stock and remaining units
        let unitsToTake = requiredTotalUnits;
        let newRemainingUnits = currentRemainingUnits;
        let newStockPackages = currentStockPackages;

        // Use remaining units first
        const unitsFromRemaining = Math.min(unitsToTake, newRemainingUnits);
        newRemainingUnits -= unitsFromRemaining;
        unitsToTake -= unitsFromRemaining;

        // If more units needed, "open" packages
        if (unitsToTake > 0) {
            const packagesToOpen = Math.ceil(unitsToTake / unitsPerPackage);
            if (packagesToOpen > newStockPackages) {
                // This should not happen due to the earlier totalAvailableUnits check, but acts as a safeguard
                showSnackbar(`Stock calculation error for ${med.product_name}. Insufficient packages despite availability check. Sale cancelled.`, "error");
                stockSufficient = false;
                break;
            }
            newStockPackages -= packagesToOpen;
            const unitsObtainedFromPackages = packagesToOpen * unitsPerPackage;
            const unitsLeftOver = unitsObtainedFromPackages - unitsToTake;
            // Add leftover units from the last opened package(s) to remaining_units
            newRemainingUnits += unitsLeftOver;
        }

        // Ensure remaining units never exceeds units per package minus 1 (unless unitsPerPackage is 1)
         if (unitsPerPackage > 1 && newRemainingUnits >= unitsPerPackage) {
             console.warn(`Adjusting remaining units: ${newRemainingUnits} >= ${unitsPerPackage} for ${med.product_name}`);
             const extraPackages = Math.floor(newRemainingUnits / unitsPerPackage);
             newStockPackages += extraPackages;
             newRemainingUnits %= unitsPerPackage;
             console.warn(`Adjusted to: ${newStockPackages} pkgs + ${newRemainingUnits} units`);
         }


        stockUpdates.push({ id: med.id, stock: newStockPackages, remaining_units: newRemainingUnits });
    } // End stock validation loop

     if (!stockSufficient) {
         setIsGeneratingBill(false); // Re-enable button if stock check fails
         return;
     }


    // 3. Proceed with saving Sale and SaleItems, then update stock
    const billNumber = `BILL-${Date.now()}`;
    let generatedSaleId = null; // Variable to hold the generated sale ID

    try {
        // Insert Sale Record
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert([ {
              // Removed user_id filter
              bill_number: billNumber,
              customer_name: 'Walk-in', // Default or could add a field
              customer_phone: customerPhone || '-', // Use '-' if empty
              grand_total: parseFloat(grandTotal.toFixed(2)), // Ensure grandTotal is saved correctly
              sale_date: new Date().toISOString(),
            },
          ])
          .select() // Select the inserted record
          .single(); // Expecting a single record back

        if (saleError) throw new Error(`Error creating sale record: ${saleError.message}`);
        if (!saleData) throw new Error('Failed to create sale record, no data returned.');

        generatedSaleId = saleData.id; // Store the generated sale ID

        // Prepare and Insert Sale Items
        const saleItemsData = billItems.map((item) => ({
            sale_id: generatedSaleId, // Use the generated ID
            medicine_id: item.medicine_id,
            product_name: item.product_name,
            batch_no: item.batch_no,
            expiry_date: item.expiry_date,
            mrp: item.mrp_per_package, // Store the original package MRP
            quantity: item.quantity_units_sold, // IMPORTANT: Save UNITS sold in the quantity column
            subtotal: item.finalSubtotal, // Save the final calculated subtotal for the line item
            extra_discount_type: item.extraDiscountType,
            extra_discount_value: item.extraDiscountValue,
            extra_discount_amount: item.extraDiscountAmount,
         }));
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);

        if (itemsError) throw new Error(`Error saving sale items: ${itemsError.message}`);

        // --- Critical point: Sale and Items saved, now show modal BEFORE stock update ---
        setSaleId(generatedSaleId); // Set the ID for the modal
        setShowInvoice(true);      // Open the modal

        // --- Update Stock Levels (asynchronously, after showing modal) ---
        const stockUpdatePromises = stockUpdates.map(update =>
            supabase
                .from('medicines')
                .update({ stock: update.stock, remaining_units: update.remaining_units })
                .eq('id', update.id)
        );

        // Wait for all stock updates to complete
        const stockUpdateResults = await Promise.all(stockUpdatePromises);
        const stockUpdateError = stockUpdateResults.find(result => result && result.error);

        // Handle potential stock update errors AFTER modal is shown
        if (stockUpdateError) {
            console.error("Stock update error details:", stockUpdateError.error);
            // Show a separate, persistent error message or log it prominently
            showSnackbar(`Sale recorded (ID: ${generatedSaleId}), but failed to update stock for one or more items. Please check inventory manually. Error: ${stockUpdateError.error.message}`, "warning");
        } else {
             // Optionally show a success message for stock update if needed, but the main success is the sale record.
             console.log("Stock updated successfully for sale ID:", generatedSaleId);
             // Snackbar might be redundant if invoice is already shown.
             // showSnackbar("Sale recorded and stock updated successfully!", "success");
        }
         // Note: No snackbar needed here for success, modal opening is the indicator


    } catch (error) {
        console.error("Bill Generation Error (Sale/Items Insert):", error);
        showSnackbar(error.message || 'An unexpected error occurred during bill generation.', "error");
        // Do not proceed to show invoice if sale/items failed
        setSaleId(null);
        setShowInvoice(false);
    } finally {
        setIsGeneratingBill(false); // Re-enable button regardless of outcome
    }
  };

  // handleCloseInvoice - Reset new state variables
  const handleCloseInvoice = () => {
    setShowInvoice(false);
    setSaleId(null);
    setBillItems([]);
    setCustomerPhone('');
    setExtraDiscountType('percent'); // Reset extra discount
    setExtraDiscountValue('');
    setSaleUnitType('Unit'); // Reset sale unit type
    fetchMedicines(); // Refresh medicine list
  };
  // --- ---

  // Handle Unit/Package Toggle Change
  const handleSaleUnitChange = (event, newUnitType) => {
    if (newUnitType !== null) { // Prevent unselecting both
      setSaleUnitType(newUnitType);
    }
  };


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

          {/* Row 1: Search Product (Full Width) */}
          <Grid item xs={12}>
              <Autocomplete
                options={medicines}
                // Updated getOptionLabel to show detailed stock
                getOptionLabel={(option) => {
                    const unitsPerPackage = parseUnitsFromItemString(option.no_of_items);
                    const stockDisplay = unitsPerPackage
                        ? `[${option.stock || 0} pkgs + ${option.remaining_units || 0} units]`
                        : `[${option.stock || 0} pkgs]`; // Fallback if no_of_items is invalid
                    return `${option.product_name} ${stockDisplay}` || '';
                }}
                value={selectedMedicine}
                onChange={(event, newValue) => { setSelectedMedicine(newValue); }}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                renderInput={(params) => (<TextField {...params} size="small" label="Search Product" placeholder="Type medicine name..." />)}
                 // Updated renderOption to show detailed stock and handle out of stock visually
                renderOption={(props, option) => {
                     const unitsPerPackage = parseUnitsFromItemString(option.no_of_items);
                     const stockDisplay = unitsPerPackage
                         ? `${option.stock || 0} pkgs + ${option.remaining_units || 0} units`
                         : `${option.stock || 0} pkgs`; // Fallback
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
                // Updated getOptionDisabled based on total units
                getOptionDisabled={(option) => {
                    const unitsPerPackage = parseUnitsFromItemString(option.no_of_items);
                    // Disable if unitsPerPackage is null OR total units is 0 or less
                    const totalUnits = unitsPerPackage ? ((option.stock || 0) * unitsPerPackage) + (option.remaining_units || 0) : (option.stock || 0);
                    return !unitsPerPackage || totalUnits <= 0;
                }}
                size="small"
                sx={{ mb: 1 }}
              />

              {/* Info Box - Updated */}
              <Paper variant="outlined" sx={{ p: '6px 14px', height: 'auto', minHeight: '40px', bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {selectedMedicine
                          ? `Selected: ${selectedMedicine.product_name} | Avail: ${selectedMedicine.stock || 0} pkgs + ${selectedMedicine.remaining_units || 0} units | MRP: ₹${selectedMedicine.mrp?.toFixed(2)}/pkg | Batch: ${selectedMedicine.batch_no}`
                          : 'Select a product from the list above.'
                      }
                  </Typography>
              </Paper>
          </Grid>

           {/* Row 2: Qty, Unit Type, Disc Type, Value, Add Button - Adjusted Grid Layout */}
           <Grid item container spacing={1} xs={12} alignItems="center" sx={{ mt: 1 }}>

               {/* Quantity */}
               <Grid item xs={6} sm={3} md={2} lg={1.5}>
                  <TextField label="Qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} InputProps={{ inputProps: { min: "1" } }} fullWidth required variant="outlined" size="small" sx={numberInputStyles}/>
               </Grid>

               {/* Unit Type Toggle */}
                <Grid item xs={6} sm={3} md={2} lg={2}>
                  <ToggleButtonGroup
                    color="primary"
                    value={saleUnitType}
                    exclusive
                    onChange={handleSaleUnitChange}
                    aria-label="Sale Unit Type"
                    size="small"
                    fullWidth // Make toggle buttons take full width of their grid item
                  >
                    <ToggleButton value="Unit" sx={{ flexGrow: 1 }}>Unit</ToggleButton>
                    <ToggleButton value="Package" sx={{ flexGrow: 1 }}>Package</ToggleButton>
                  </ToggleButtonGroup>
               </Grid>

               {/* Extra Discount Type */}
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

               {/* Extra Discount Value */}
               <Grid item xs={4} sm={2} md={2} lg={1.5}>
                   <TextField
                       label="Value"
                       type="number"
                       value={extraDiscountValue}
                       onChange={(e) => setExtraDiscountValue(e.target.value)}
                       InputProps={{
                           inputProps: { min: "0", step: "0.01" }, // Step 0.01 for both % and cost
                           startAdornment: extraDiscountType === 'cost' ? <InputAdornment position="start">₹</InputAdornment> : null,
                           endAdornment: extraDiscountType === 'percent' ? <InputAdornment position="end">%</InputAdornment> : null,
                       }}
                       fullWidth
                       placeholder="0"
                       variant="outlined" size="small"
                       sx={numberInputStyles}
                       helperText={extraDiscountType === 'cost' ? 'Per Unit' : ''} // Clarify cost is per unit
                   />
               </Grid>

                {/* Add Button */}
                <Grid item xs={4} sm={2} md={2} lg={1.5} sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <Button
                    variant="contained"
                    color="success"
                    onClick={handleAddItem}
                    // Updated disabled check for total units and isGeneratingBill
                    disabled={ isGeneratingBill || !selectedMedicine || !parseUnitsFromItemString(selectedMedicine.no_of_items) || (((selectedMedicine.stock ?? 0) * (parseUnitsFromItemString(selectedMedicine.no_of_items) || 0) ) + (selectedMedicine.remaining_units ?? 0)) <= 0 }
                    fullWidth
                    startIcon={<AddIcon />}
                    size="medium"
                    sx={{ height: '40px'}} // Match input height
                    > Add </Button>
                </Grid>

                {/* Spacer - Adjust as needed */}
                <Grid item md={false} lg={4} sx={{ display: { xs: 'none', lg: 'block' } }} />

           </Grid> {/* End of Row 2 Grid */}


           <Grid item xs={12}><Divider sx={{ my: 2 }} /></Grid>

           {/* Row: Current Bill Table */}
            <Grid item xs={12}>
             <Typography variant="h6" sx={{ mb: 1 }}>Current Bill</Typography>
             <TableContainer component={Paper} variant="outlined">
                {/* Updated Table Headers */}
               <Table size="small" sx={{ minWidth: 950 }}>
                 <TableHead sx={{ bgcolor: 'grey.100' }}>
                   <TableRow>
                     <TableCell sx={{ minWidth: 150 }}>Product</TableCell>
                     <TableCell sx={{ minWidth: 80 }}>Batch</TableCell>
                     <TableCell sx={{ minWidth: 80 }}>MRP/Unit</TableCell> {/* Changed */}
                     <TableCell sx={{ minWidth: 100 }}>Std Disc Amt</TableCell> {/* Changed label */}
                     <TableCell sx={{ minWidth: 100 }}>Extra Disc Amt</TableCell> {/* Changed label */}
                     <TableCell sx={{ minWidth: 100 }}>GST Amt</TableCell>
                     <TableCell align="right" sx={{ minWidth: 60 }}>Qty(Units)</TableCell> {/* Changed */}
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
                      <TableRow key={`${item.medicine_id}-${item.batch_no}-${item.extraDiscountType}-${item.extraDiscountValue}-${index}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                         {/* Updated Cells */}
                         <TableCell component="th" scope="row">{item.product_name}</TableCell>
                         <TableCell>{item.batch_no}</TableCell>
                         <TableCell>₹{item.mrp_per_unit?.toFixed(2)}</TableCell> {/* Display unit MRP */}
                         <TableCell>₹{item.discountAmount?.toFixed(2)} ({item.discount || 0}%)</TableCell> {/* Display standard discount amount */}
                         <TableCell> {/* Display extra discount amount */}
                           ₹{item.extraDiscountAmount?.toFixed(2)}
                           {item.extraDiscountType === 'percent' && ` (${item.extraDiscountValue || 0}%)`}
                           {item.extraDiscountType === 'cost' && ` (₹${item.extraDiscountValue || 0}/unit)`}
                           {(!item.extraDiscountType || item.extraDiscountValue === 0) && ''} {/* Show nothing if no extra discount */}
                         </TableCell>
                         <TableCell>₹{item.gstAmount?.toFixed(2)} ({item.gst || 0}%)</TableCell>
                         <TableCell align="right">{item.quantity_units_sold}</TableCell> {/* Display units sold */}
                         <TableCell align="right" sx={{ fontWeight: 'medium'}}>₹{item.finalSubtotal?.toFixed(2)}</TableCell>
                         <TableCell align="right">
                             {/* Disable remove button while generating bill */}
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

           {/* Customer Phone (No change) */}
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
                  inputProps={{ maxLength: 15 }} // Keep reasonable length limit
                  disabled={isGeneratingBill} // Disable while generating
                />
              </Grid>
               <Grid item xs={false} md={6} />
            </>
          )}

           {/* Total & Generate Bill Button (Updated total savings display) */}
           {billItems.length > 0 && (
            <Grid item xs={12} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mt: 2, gap: 2 }}>
              <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Savings (Std + Extra): ₹{totalDiscount.toFixed(2)} {/* Uses calculated totalDiscount */}
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
                  disabled={isGeneratingBill} // Disable button while processing
                  sx={{ width: { xs: '100%', sm: 'auto' }}}
              >
                 {isGeneratingBill ? 'Generating...' : 'Generate & Print Bill'}
              </Button>
            </Grid>
          )}

        </Grid> {/* End of main container grid */}
      </Paper>

      {/* Snackbar & Invoice Modal (No change needed here) */}
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
