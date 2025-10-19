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

// Add new fields to initial state
const initialFormData = {
  product_name: '',
  shop_name: '',
  batch_no: '',
  no_of_items: '',
  drug_type: 'tablet',
  mfg_date: '', // <-- Added Manufacturing Date
  expiry_date: '',
  purchase_rate: '',
  gst: '',
  mrp: '',
  discount: '0.00', // <-- Added Discount, default to 0.00
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
      // Populate form including new fields
      setFormData({
        product_name: medicine.product_name,
        shop_name: medicine.shop_name,
        batch_no: medicine.batch_no,
        no_of_items: medicine.no_of_items,
        drug_type: drugTypes.includes(medicine.drug_type) ? medicine.drug_type : 'tablet',
        mfg_date: medicine.mfg_date || '', // <-- Populate mfg_date (handle null)
        expiry_date: medicine.expiry_date,
        purchase_rate: medicine.purchase_rate.toString(),
        gst: medicine.gst.toString(),
        mrp: medicine.mrp.toString(),
        discount: medicine.discount?.toString() || '0.00', // <-- Populate discount (handle null)
        stock: medicine.stock.toString(),
      });
    } else {
      setFormData(initialFormData);
    }
  }, [medicine, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Separate handlers for dates remain the same
  const handleDateChange = (e) => {
    const { name, value } = e.target; // Get name to handle both dates
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleSelectChange = (e) => {
    setFormData((prev) => ({ ...prev, drug_type: e.target.value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Prepare data including new fields
    const data = {
      user_id: user?.id,
      product_name: formData.product_name,
      shop_name: formData.shop_name,
      batch_no: formData.batch_no,
      no_of_items: formData.no_of_items,
      drug_type: formData.drug_type,
      mfg_date: formData.mfg_date || null, // <-- Send mfg_date (allow null)
      expiry_date: formData.expiry_date,
      purchase_rate: parseFloat(formData.purchase_rate),
      gst: parseFloat(formData.gst),
      mrp: parseFloat(formData.mrp),
      discount: parseFloat(formData.discount) || 0.00, // <-- Send discount (default to 0 if empty/invalid)
      stock: parseInt(formData.stock, 10),
    };

    // Make sure mfg_date is valid or null before sending
    if (isNaN(new Date(data.mfg_date))) {
        data.mfg_date = null;
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
          {/* Increased spacing */}
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

            {/* Row 3 - Dates */}
             <Grid item xs={12} sm={6}>
               <TextField
                name="mfg_date" // <-- Field for Manufacturing Date
                label="Manufacturing Date"
                type="date"
                value={formData.mfg_date}
                onChange={handleDateChange} // Use same handler
                fullWidth
                required // Make required if necessary
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
               <TextField
                name="expiry_date"
                label="Expiry Date"
                type="date"
                value={formData.expiry_date}
                onChange={handleDateChange} // Use same handler
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>


             {/* Row 4 - Type and Stock */}
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
            <Grid item xs={12} sm={6}>
              <TextField name="stock" label="Stock (Quantity)" type="number" value={formData.stock} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} />
            </Grid>


             {/* Row 5 - Pricing */}
            <Grid item xs={12} sm={4}> {/* Adjusted grid size */}
              <TextField name="purchase_rate" label="Purchase Rate" type="number" value={formData.purchase_rate} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
            </Grid>
             <Grid item xs={12} sm={4}> {/* Adjusted grid size */}
              <TextField name="mrp" label="MRP" type="number" value={formData.mrp} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
            </Grid>
            <Grid item xs={12} sm={4}> {/* Adjusted grid size */}
              <TextField name="gst" label="GST (%)" type="number" value={formData.gst} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
            </Grid>

             {/* Row 6 - Discount */}
            <Grid item xs={12} sm={4}>
               <TextField
                 name="discount" // <-- Field for Discount
                 label="Discount (%)"
                 type="number"
                 value={formData.discount}
                 onChange={handleChange}
                 fullWidth
                 required // Make required if necessary
                 inputProps={{ step: "0.01", min: "0.00" }} // Allow decimals for percent
               />
            </Grid>
             {/* Add empty Grid items if needed to fill the row */}
             <Grid item sm={8} />


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