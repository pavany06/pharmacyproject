// src/components/MedicineModal.jsx
import { useState, useEffect } from 'react';
// Corrected import path for supabase
import { supabase } from '../lib/supabase.js';
// Removed useAuth import as user_id filter is removed
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Box,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material';

// --- Helper Functions ---

// Parses the leading integer from the item string (e.g., "10 tablets")
const parseUnitsFromItemString = (itemString) => {
    if (!itemString) return null;
    const match = itemString.match(/^\s*(\d+)/);
    const units = match ? parseInt(match[1], 10) : null;
    return units > 0 ? units : null; // Return null if not a positive number
};

// Helper function to calculate net purchase rate
const calculateNetPurchaseRate = (rate, discount) => {
    const rateNum = parseFloat(rate) || 0;
    const discountNum = parseFloat(discount) || 0;
    if (rateNum <= 0) return 0;
    const discountAmount = rateNum * (discountNum / 100);
    // Round to 2 decimal places to avoid floating point issues
    return parseFloat((rateNum - discountAmount).toFixed(2));
};

// Helper to format YYYY-MM-DD to YYYY-MM for the input field
const formatDateToMonthInput = (dateString) => {
    if (!dateString || dateString.length < 7) return '';
    // Assumes dateString is 'YYYY-MM-DD'
    return dateString.substring(0, 7); // Extracts 'YYYY-MM'
};

// Helper to format YYYY-MM back to YYYY-MM-DD (using 1st day) for saving
const formatMonthInputToDate = (monthString) => {
    if (!monthString || monthString.length !== 7) return null; // Invalid input returns null
    // Appends '-01' to represent the first day of the month
    // Validate if the date is reasonable before returning
    try {
        const [year, month] = monthString.split('-').map(Number);
        if (year < 1970 || year > 2100 || month < 1 || month > 12) return null;
        return `${monthString}-01`;
    } catch (e) {
        return null; // Return null if parsing fails
    }
};
// --- ---

// Initial state updated
const initialFormData = {
  product_name: '',
  shop_name: '',
  batch_no: '',
  no_of_items: '', // Label updated: Units Per Package (e.g., 10 tablets)
  drug_type: 'tablet',
  expiry_date: '', // Will store as YYYY-MM in state, convert before saving
  purchase_rate: '', // Label updated: Purchase Rate (per Pkg)
  purchase_discount: '', // New field
  gst: '',
  mrp: '', // Label updated: MRP (per Pkg)
  discount: '', // Selling discount
  stock: '0', // Label updated: Stock (Full Packages)
  remaining_units: '0', // Added remaining_units, only editable when editing
  reminder_quantity: '5', // Label updated: Reminder At (Packages)
};

const drugTypes = ['tonic', 'syrup', 'tablet', 'capsule', 'ointment', 'other'];

export default function MedicineModal({ open, medicine, onClose }) {
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError(''); // Clear error when modal opens or medicine changes
    if (medicine) {
      setFormData({
        product_name: medicine.product_name || '',
        shop_name: medicine.shop_name || '',
        batch_no: medicine.batch_no || '',
        no_of_items: medicine.no_of_items || '',
        drug_type: drugTypes.includes(medicine.drug_type) ? medicine.drug_type : 'tablet',
        expiry_date: formatDateToMonthInput(medicine.expiry_date), // Format for month input
        purchase_rate: medicine.purchase_rate?.toString() || '',
        purchase_discount: medicine.purchase_discount?.toString() || '', // Load purchase discount
        gst: medicine.gst?.toString() || '',
        mrp: medicine.mrp?.toString() || '',
        discount: medicine.discount?.toString() || '',
        stock: medicine.stock?.toString() || '0',
        remaining_units: medicine.remaining_units?.toString() || '0', // Load remaining units
        reminder_quantity: medicine.reminder_quantity?.toString() || '5',
      });
    } else {
      setFormData(initialFormData); // Reset for adding new medicine
    }
  }, [medicine, open]); // Depend on medicine and open status

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Prevent negative numbers for specific fields
    const nonNegativeFields = [
        'stock', 'remaining_units', 'reminder_quantity', 'purchase_rate',
        'purchase_discount', 'gst', 'mrp', 'discount'
    ];
    // Allow empty string or non-negative numbers
    if (nonNegativeFields.includes(name) && value !== '' && parseFloat(value) < 0) {
        return; // Do not update state for negative values in these fields
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleSelectChange = (e) => {
    setFormData((prev) => ({ ...prev, drug_type: e.target.value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- Validation ---
    // Validate no_of_items
    const unitsPerPackage = parseUnitsFromItemString(formData.no_of_items);
    if (unitsPerPackage === null || unitsPerPackage <= 0) {
        setError('Invalid "Units Per Package". It must start with a positive number (e.g., "10 tablets").');
        return;
    }

    // Validate remaining_units against unitsPerPackage if editing
     const remainingUnitsInput = parseInt(formData.remaining_units, 10) || 0;
     if (medicine && remainingUnitsInput >= unitsPerPackage && unitsPerPackage > 0) {
         setError(`"Remaining Units" (${remainingUnitsInput}) cannot be equal to or greater than "Units Per Package" (${unitsPerPackage}). Adjust Stock (Packages) instead.`);
         return;
     }


    // Format the expiry_date back to YYYY-MM-DD for Supabase
    const expiryDateForDb = formatMonthInputToDate(formData.expiry_date);
    // Expiry is required, so error if format is wrong OR if it's empty
    if (!expiryDateForDb) {
        setError('Invalid or missing Expiry Month/Year. Please use YYYY-MM format.');
        return; // Prevent submission
    }
    // --- End Validation ---

    setLoading(true);

    const purchaseRate = parseFloat(formData.purchase_rate) || 0;
    const purchaseDiscount = parseFloat(formData.purchase_discount) || 0;
    const actualPurchaseCost = calculateNetPurchaseRate(purchaseRate, purchaseDiscount);

    const data = {
      // Removed user_id
      product_name: formData.product_name,
      shop_name: formData.shop_name,
      batch_no: formData.batch_no,
      no_of_items: formData.no_of_items, // Contains unit info like "10 tablets"
      drug_type: formData.drug_type,
      expiry_date: expiryDateForDb, // Save formatted date (YYYY-MM-DD)
      purchase_rate: purchaseRate,
      purchase_discount: formData.purchase_discount === '' ? null : purchaseDiscount,
      actual_purchase_cost: actualPurchaseCost, // Save calculated cost
      gst: parseFloat(formData.gst) || 0,
      mrp: parseFloat(formData.mrp) || 0,
      discount: formData.discount === '' ? null : (parseFloat(formData.discount) || null),
      stock: parseInt(formData.stock, 10) || 0,
      // Handle remaining_units: set to 0 if new, otherwise use parsed input.
      remaining_units: !medicine ? 0 : remainingUnitsInput,
      reminder_quantity: parseInt(formData.reminder_quantity, 10) || 0,
    };

    let result;
    if (medicine) {
       // When editing, update all fields including potentially changed remaining_units
      result = await supabase
        .from('medicines')
        .update(data) // Send the whole validated data object
        .eq('id', medicine.id);
    } else {
      // Ensure remaining_units is explicitly set to 0 for new entries in the data object
      data.remaining_units = 0;
      result = await supabase.from('medicines').insert([data]);
    }

    if (result.error) {
      console.error("Supabase error:", result.error);
      setError(`Failed to save medicine: ${result.error.message}`); // More specific error
      setLoading(false);
    } else {
      setLoading(false);
      onClose(); // Close modal on success
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="md" fullWidth> {/* Prevent close while loading */}
      <DialogTitle>
        {medicine ? 'Edit Medicine' : 'Add New Medicine'}
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={3} sx={{ mt: 0 }}>
            {/* Row 1 */}
            <Grid item xs={12} sm={6}>
              <TextField name="product_name" label="Product Name" value={formData.product_name} onChange={handleChange} fullWidth required />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="shop_name" label="Shop Name" value={formData.shop_name} onChange={handleChange} fullWidth required />
            </Grid>
             {/* Row 2 */}
             <Grid item xs={12} sm={6}>
              <TextField name="batch_no" label="Batch No" value={formData.batch_no} onChange={handleChange} fullWidth required />
            </Grid>
             <Grid item xs={12} sm={6}>
               <TextField
                name="no_of_items"
                // Updated label
                label="Units Per Package (e.g., 10 tablets)"
                value={formData.no_of_items}
                onChange={handleChange}
                fullWidth
                required
                helperText="Must start with a number. Used for unit calculations."
              />
            </Grid>

            {/* Row 3 - Expiry Date & Type */}
             <Grid item xs={12} sm={6}>
               <TextField
                name="expiry_date"
                label="Expiry (MM/YYYY)" // Updated label
                type="month" // Changed type to month
                value={formData.expiry_date} // Value should be YYYY-MM
                onChange={handleChange} // Use general handler
                fullWidth
                required // Expiry is required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                    <InputLabel id="drug-type-select-label">Drug Type</InputLabel>
                    <Select
                        labelId="drug-type-select-label"
                        id="drug_type_select"
                        name="drug_type"
                        value={formData.drug_type}
                        label="Drug Type"
                        onChange={handleSelectChange}
                    >
                        {drugTypes.map((type) => (
                         <MenuItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                         </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>

            {/* Row 4 - Stock */}
             <Grid item xs={12} sm={medicine ? 4 : 6}> {/* Adjust grid size if editing */}
               {/* Updated label */}
              <TextField name="stock" label="Stock (Full Packages)" type="number" value={formData.stock} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} />
            </Grid>
             {/* Row 7 - Remaining Units (only shown when editing) */}
            {medicine && (
               <Grid item xs={12} sm={4}>
                  <TextField name="remaining_units" label="Remaining Units" type="number" value={formData.remaining_units} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} helperText="Units in open pkg"/>
               </Grid>
            )}
            <Grid item xs={12} sm={medicine ? 4 : 6}> {/* Adjust grid size */}
               {/* Updated label */}
               <TextField
                 name="reminder_quantity"
                 label="Reminder At (Packages)"
                 type="number"
                 value={formData.reminder_quantity}
                 onChange={handleChange}
                 fullWidth
                 required
                 inputProps={{ step: "1", min: "0" }}
               />
            </Grid>
            {/* Row 5 - Purchase */}
            <Grid item xs={12} sm={6}>
              {/* Updated label */}
              <TextField name="purchase_rate" label="Purchase Rate (per Pkg)" type="number" value={formData.purchase_rate} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              {/* New field */}
              <TextField
                name="purchase_discount"
                label="Purchase Discount (%)"
                type="number"
                value={formData.purchase_discount}
                onChange={handleChange}
                fullWidth
                InputProps={{
                    inputProps: { step: "0.01", min: "0.00" } // Allow decimals, min 0
                }}
              />
            </Grid>
             {/* Row 6 - Pricing */}
            <Grid item xs={12} sm={4}>
               {/* Updated label */}
              <TextField name="mrp" label="MRP (per Pkg)" type="number" value={formData.mrp} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField name="gst" label="GST (%)" type="number" value={formData.gst} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
            </Grid>
            <Grid item xs={12} sm={4}>
               <TextField
                 name="discount"
                 label="Selling Discount (%)"
                 type="number"
                 value={formData.discount}
                 onChange={handleChange}
                 fullWidth
                 InputProps={{
                     inputProps: { step: "0.01", min: "0.00" } // Allow decimals, min 0
                 }}
               />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: '0 24px 20px' }}>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : (medicine ? 'Update Medicine' : 'Add Medicine')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}