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

// Updated initial state
const initialFormData = {
  product_name: '',
  shop_name: '',
  batch_no: '',
  no_of_items: '',
  drug_type: 'tablet',
  // mfg_date: '', // <-- Removed
  expiry_date: '',
  purchase_rate: '',
  gst: '',
  mrp: '',
  discount: '', // <-- Changed default from '0.00' to empty string ''
  stock: '0',
};

const drugTypes = ['tonic', 'syrup', 'tablet', 'capsule', 'ointment', 'other'];


export default function MedicineModal({ open, medicine, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (medicine) {
      // Populate form without mfg_date, handle null discount
      setFormData({
        product_name: medicine.product_name,
        shop_name: medicine.shop_name,
        batch_no: medicine.batch_no,
        no_of_items: medicine.no_of_items,
        drug_type: drugTypes.includes(medicine.drug_type) ? medicine.drug_type : 'tablet',
        // mfg_date: medicine.mfg_date || '', // <-- Removed
        expiry_date: medicine.expiry_date || '', // Handle null expiry date
        purchase_rate: medicine.purchase_rate?.toString() || '', // Handle null
        gst: medicine.gst?.toString() || '', // Handle null
        mrp: medicine.mrp?.toString() || '', // Handle null
        discount: medicine.discount?.toString() || '', // <-- Populate discount, default to '' if null
        stock: medicine.stock?.toString() || '0', // Handle null
      });
    } else {
      setFormData(initialFormData);
    }
  }, [medicine, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Only one date handler needed now
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

    // Prepare data without mfg_date, handle potentially empty discount
    const data = {
      user_id: user?.id,
      product_name: formData.product_name,
      shop_name: formData.shop_name,
      batch_no: formData.batch_no,
      no_of_items: formData.no_of_items,
      drug_type: formData.drug_type,
      // mfg_date: formData.mfg_date || null, // <-- Removed
      expiry_date: formData.expiry_date || null, // Allow null expiry date if needed
      purchase_rate: parseFloat(formData.purchase_rate) || 0, // Default to 0 if empty/invalid
      gst: parseFloat(formData.gst) || 0, // Default to 0 if empty/invalid
      mrp: parseFloat(formData.mrp) || 0, // Default to 0 if empty/invalid
      // Send discount as null if the input is empty, otherwise parse float (default to null if invalid)
      discount: formData.discount === '' ? null : (parseFloat(formData.discount) || null),
      stock: parseInt(formData.stock, 10) || 0, // Default to 0 if empty/invalid
    };

     // Ensure expiry_date is valid or null before sending
    if (data.expiry_date && isNaN(new Date(data.expiry_date))) {
        data.expiry_date = null;
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
                label="No of Items (e.g., 10 tablets, 100ml)"
                value={formData.no_of_items}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>

            {/* Row 3 - Expiry Date Only */}
             <Grid item xs={12} sm={6}>
               <TextField
                name="expiry_date"
                label="Expiry Date"
                type="date"
                value={formData.expiry_date}
                onChange={handleDateChange} // Use date handler
                fullWidth
                required // Keep required? Or make optional?
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {/* Removed Mfg Date Field */}
            <Grid item xs={12} sm={6}> {/* Type */}
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


             {/* Row 4 - Stock & Purchase Rate */}
            <Grid item xs={12} sm={6}>
              <TextField name="stock" label="Stock (Quantity)" type="number" value={formData.stock} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField name="purchase_rate" label="Purchase Rate" type="number" value={formData.purchase_rate} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
            </Grid>

             {/* Row 5 - Pricing */}
            <Grid item xs={12} sm={4}>
              <TextField name="mrp" label="MRP" type="number" value={formData.mrp} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField name="gst" label="GST (%)" type="number" value={formData.gst} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
            </Grid>
            <Grid item xs={12} sm={4}>
               <TextField
                 name="discount"
                 label="Discount (%)" // Label remains same
                 type="number"
                 value={formData.discount} // Value reads from state (now defaults to '')
                 onChange={handleChange}
                 fullWidth
                 // required // Make it NOT required
                 InputProps={{ // Keep input props for decimals/min
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