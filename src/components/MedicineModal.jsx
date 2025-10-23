// src/components/MedicineModal.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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

// Initial state remains the same
const initialFormData = {
  product_name: '',
  shop_name: '',
  batch_no: '',
  no_of_items: '',
  drug_type: 'tablet',
  expiry_date: '', // Will store as YYYY-MM in state, convert before saving
  purchase_rate: '',
  purchase_discount: '',
  gst: '',
  mrp: '',
  discount: '', // Selling discount
  stock: '0',
  reminder_quantity: '5',
};

const drugTypes = ['tonic', 'syrup', 'tablet', 'capsule', 'ointment', 'other'];

// Helper function to calculate net purchase rate
const calculateNetPurchaseRate = (rate, discount) => {
    const rateNum = parseFloat(rate) || 0;
    const discountNum = parseFloat(discount) || 0;
    if (rateNum <= 0) return 0;
    const discountAmount = rateNum * (discountNum / 100);
    return rateNum - discountAmount;
};

// Helper to format YYYY-MM-DD to YYYY-MM for the input field
const formatDateToMonthInput = (dateString) => {
    if (!dateString || dateString.length < 7) return '';
    // Assumes dateString is 'YYYY-MM-DD'
    return dateString.substring(0, 7); // Extracts 'YYYY-MM'
};

// Helper to format YYYY-MM back to YYYY-MM-DD (using 1st day) for saving
const formatMonthInputToDate = (monthString) => {
    if (!monthString || monthString.length !== 7) return null; // Invalid input
    // Appends '-01' to represent the first day of the month
    return `${monthString}-01`;
};


export default function MedicineModal({ open, medicine, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (medicine) {
      setFormData({
        product_name: medicine.product_name || '',
        shop_name: medicine.shop_name || '',
        batch_no: medicine.batch_no || '',
        no_of_items: medicine.no_of_items || '',
        drug_type: drugTypes.includes(medicine.drug_type) ? medicine.drug_type : 'tablet',
        expiry_date: formatDateToMonthInput(medicine.expiry_date), // Format for month input
        purchase_rate: medicine.purchase_rate?.toString() || '',
        purchase_discount: medicine.purchase_discount?.toString() || '',
        gst: medicine.gst?.toString() || '',
        mrp: medicine.mrp?.toString() || '',
        discount: medicine.discount?.toString() || '', // Selling discount
        stock: medicine.stock?.toString() || '0',
        reminder_quantity: medicine.reminder_quantity?.toString() || '5',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [medicine, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Prevent negative numbers for specific fields
    if (['stock', 'reminder_quantity', 'purchase_rate', 'gst', 'mrp', 'discount', 'purchase_discount'].includes(name) && value !== '' && parseFloat(value) < 0) {
        return;
    }
    // Handle month input specifically or use general handler
    // if (name === 'expiry_date') {
    //     // Basic validation for YYYY-MM format could be added here if needed
    // }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Keep handleDateChange specifically for clarity, linked to the month input
  const handleDateChange = (e) => {
    setFormData((prev) => ({ ...prev, expiry_date: e.target.value }));
  };

  const handleSelectChange = (e) => {
    setFormData((prev) => ({ ...prev, drug_type: e.target.value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const purchaseRate = parseFloat(formData.purchase_rate) || 0;
    const purchaseDiscount = parseFloat(formData.purchase_discount) || 0;
    const actualPurchaseCost = calculateNetPurchaseRate(purchaseRate, purchaseDiscount);

    // Format the expiry_date back to YYYY-MM-DD for Supabase
    const expiryDateForDb = formatMonthInputToDate(formData.expiry_date);
    if (!expiryDateForDb && formData.expiry_date) {
        setError('Invalid Expiry Month/Year format. Please use MM/YYYY.');
        setLoading(false);
        return;
    }

    const data = {
      user_id: user?.id,
      product_name: formData.product_name,
      shop_name: formData.shop_name,
      batch_no: formData.batch_no,
      no_of_items: formData.no_of_items,
      drug_type: formData.drug_type,
      expiry_date: expiryDateForDb, // Save formatted date
      purchase_rate: purchaseRate,
      purchase_discount: formData.purchase_discount === '' ? null : purchaseDiscount,
      actual_purchase_cost: actualPurchaseCost,
      gst: parseFloat(formData.gst) || 0,
      mrp: parseFloat(formData.mrp) || 0,
      discount: formData.discount === '' ? null : (parseFloat(formData.discount) || null),
      stock: parseInt(formData.stock, 10) || 0,
      reminder_quantity: parseInt(formData.reminder_quantity, 10) || 0,
    };

    // Redundant check, already handled above, but keep for safety
     if (data.expiry_date && isNaN(new Date(data.expiry_date))) {
        data.expiry_date = null; // Should not happen if formatMonthInputToDate worked
    }

    let result;
    if (medicine) {
      result = await supabase
        .from('medicines')
        .update(data)
        .eq('id', medicine.id);
    } else {
      result = await supabase.from('medicines').insert([data]);
    }

    if (result.error) {
      console.error("Supabase error:", result.error);
      setError(result.error.message);
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {medicine ? 'Edit Medicine' : 'Add New Medicine'}
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={3} sx={{ mt: 0 }}>
            {/* Rows 1 & 2 remain the same */}
            <Grid item xs={12} sm={6}>
              <TextField name="product_name" label="Product Name" value={formData.product_name} onChange={handleChange} fullWidth required />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="shop_name" label="Shop Name" value={formData.shop_name} onChange={handleChange} fullWidth required />
            </Grid>
             <Grid item xs={12} sm={6}>
              <TextField name="batch_no" label="Batch No" value={formData.batch_no} onChange={handleChange} fullWidth required />
            </Grid>
             <Grid item xs={12} sm={6}>
               <TextField
                name="no_of_items"
                label="No of Items (e.g., 10 tablets, 100ml)"
                value={formData.no_of_items}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>

            {/* Row 3 - Expiry Date & Type */}
             <Grid item xs={12} sm={6}>
               <TextField
                name="expiry_date"
                label="Expiry (MM/YYYY)" // Updated label
                type="month" // Changed type to month
                value={formData.expiry_date} // Value should be YYYY-MM
                onChange={handleDateChange} // Still use dedicated handler
                fullWidth
                required
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

            {/* Rows 4, 5, 6 remain the same */}
             <Grid item xs={12} sm={6}>
              <TextField name="stock" label="Stock (Quantity)" type="number" value={formData.stock} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} />
            </Grid>
             <Grid item xs={12} sm={6}>
               <TextField
                 name="reminder_quantity"
                 label="Reminder At Qty"
                 type="number"
                 value={formData.reminder_quantity}
                 onChange={handleChange}
                 fullWidth
                 required
                 inputProps={{ step: "1", min: "0" }}
               />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="purchase_rate" label="Purchase Rate" type="number" value={formData.purchase_rate} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="purchase_discount"
                label="Purchase Discount (%)"
                type="number"
                value={formData.purchase_discount}
                onChange={handleChange}
                fullWidth
                InputProps={{
                    inputProps: { step: "0.01", min: "0.00" }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField name="mrp" label="MRP" type="number" value={formData.mrp} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
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
                     inputProps: { step: "0.01", min: "0.00" }
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

