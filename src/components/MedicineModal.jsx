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
  Autocomplete,
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
  no_of_items: '',
  drug_type: 'tablet',
  expiry_date: '',
  purchase_rate: '',
  purchase_discount: '',
  cgst: '', // Changed from gst to cgst
  sgst: '', // Added sgst
  mrp: '',
  discount: '',
  stock: '0',
  remaining_units: '0',
  reminder_quantity: '5',
};

const drugTypes = ['tonic', 'syrup', 'tablet', 'capsule', 'ointment', 'other'];

const predefinedShopNames = [
  'SADHU PHARMA',
  'RAMA SATHYA DEVA PHARMA',
  'SRI VIJAYA BHASKARA PHARMACEUTICALS',
  'SAI DHANALAKSHMI MEDICAL AGENCIES',
  'SRI DURGA PHARMA',
  'MANIKANTA MEDICAL AGENCIES',
  'CHANDRA PHARMACEUTICALS',
  'SAI RAM MEDICAL AGENCY',
  'SRK MEDICAL AGENCIES',
  'SRI RAMACHANDRA MEDICAL DISTRIBUTORS',
  'AYYAPPA MEDICAL DISTRIBUTORS',
  'LEELA MEDICALS',
  'NITHYAJEEVA MEDICAL DISTRIBUTORS',
  'MAA MEDICAL AGENCIES',
  'MADHAVI MEDICALS',
  'LAKSHMI MEDICAL AGENCY',
  'SAI PURNA MEDICALS',
  'RAVI CINDICATE',
  'BALA MEDICAL AGENCIES',
  'CHAITANYA MEDICALS',
  'Sai vaishnavi pharma',
  'Maheshwari medicals',
  'Sree revathi distributors',
];

export default function MedicineModal({ open, medicine, onClose }) {
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (medicine) {
      setFormData({
        product_name: medicine.product_name || '',
        shop_name: medicine.shop_name || '',
        batch_no: medicine.batch_no || '',
        no_of_items: medicine.no_of_items || '',
        drug_type: drugTypes.includes(medicine.drug_type) ? medicine.drug_type : 'tablet',
        expiry_date: formatDateToMonthInput(medicine.expiry_date),
        purchase_rate: medicine.purchase_rate?.toString() || '',
        purchase_discount: medicine.purchase_discount?.toString() || '',
        cgst: medicine.cgst?.toString() || '', // Load CGST
        sgst: medicine.sgst?.toString() || '', // Load SGST
        mrp: medicine.mrp?.toString() || '',
        discount: medicine.discount?.toString() || '',
        stock: medicine.stock?.toString() || '0',
        remaining_units: medicine.remaining_units?.toString() || '0',
        reminder_quantity: medicine.reminder_quantity?.toString() || '5',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [medicine, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Prevent negative numbers for specific fields
    const nonNegativeFields = [
        'stock', 'remaining_units', 'reminder_quantity', 'purchase_rate',
        'purchase_discount', 'cgst', 'sgst', 'mrp', 'discount'
    ];
    if (nonNegativeFields.includes(name) && value !== '' && parseFloat(value) < 0) {
        return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleSelectChange = (e) => {
    setFormData((prev) => ({ ...prev, drug_type: e.target.value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const unitsPerPackage = parseUnitsFromItemString(formData.no_of_items);
    if (unitsPerPackage === null || unitsPerPackage <= 0) {
        setError('Invalid "Units Per Package". It must start with a positive number (e.g., "10 tablets").');
        return;
    }

     const remainingUnitsInput = parseInt(formData.remaining_units, 10) || 0;
     if (medicine && remainingUnitsInput >= unitsPerPackage && unitsPerPackage > 0) {
         setError(`"Remaining Units" (${remainingUnitsInput}) cannot be equal to or greater than "Units Per Package" (${unitsPerPackage}). Adjust Stock (Packages) instead.`);
         return;
     }

    const expiryDateForDb = formatMonthInputToDate(formData.expiry_date);
    if (!expiryDateForDb) {
        setError('Invalid or missing Expiry Month/Year. Please use YYYY-MM format.');
        return;
    }

    setLoading(true);

    const purchaseRate = parseFloat(formData.purchase_rate) || 0;
    const purchaseDiscount = parseFloat(formData.purchase_discount) || 0;
    const actualPurchaseCost = calculateNetPurchaseRate(purchaseRate, purchaseDiscount);

    const data = {
      product_name: formData.product_name,
      shop_name: formData.shop_name,
      batch_no: formData.batch_no,
      no_of_items: formData.no_of_items,
      drug_type: formData.drug_type,
      expiry_date: expiryDateForDb,
      purchase_rate: purchaseRate,
      purchase_discount: formData.purchase_discount === '' ? null : purchaseDiscount,
      actual_purchase_cost: actualPurchaseCost,
      cgst: parseFloat(formData.cgst) || 0, // Save CGST
      sgst: parseFloat(formData.sgst) || 0, // Save SGST
      mrp: parseFloat(formData.mrp) || 0,
      discount: formData.discount === '' ? null : (parseFloat(formData.discount) || null),
      stock: parseInt(formData.stock, 10) || 0,
      remaining_units: !medicine ? 0 : remainingUnitsInput,
      reminder_quantity: parseInt(formData.reminder_quantity, 10) || 0,
    };

    let result;
    if (medicine) {
      result = await supabase
        .from('medicines')
        .update(data)
        .eq('id', medicine.id);
    } else {
      data.remaining_units = 0;
      result = await supabase.from('medicines').insert([data]);
    }

    if (result.error) {
      console.error("Supabase error:", result.error);
      setError(`Failed to save medicine: ${result.error.message}`);
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
    }
  };

  // Custom onClose handler
  const handleDialogClose = (event, reason) => {
    if (reason && reason === "backdropClick") 
        return;
    if (!loading) {
        onClose();
    }
  }

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth>
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
              <Autocomplete
                freeSolo
                options={predefinedShopNames}
                value={formData.shop_name}
                onInputChange={(event, newInputValue) => {
                  setFormData((prev) => ({
                    ...prev,
                    shop_name: newInputValue || '',
                  }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Shop Name"
                    required
                    fullWidth
                  />
                )}
              />
            </Grid>
            
              {/* Row 2 */}
              <Grid item xs={12} sm={6}>
                <TextField name="batch_no" label="Batch No" value={formData.batch_no} onChange={handleChange} fullWidth required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="no_of_items"
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
                  label="Expiry (MM/YYYY)"
                  type="month"
                  value={formData.expiry_date}
                  onChange={handleChange}
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

            {/* Row 4 - Stock */}
              <Grid item xs={12} sm={medicine ? 4 : 6}>
                <TextField name="stock" label="Stock (Full Packages)" type="number" value={formData.stock} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} />
              </Grid>
            {medicine && (
                <Grid item xs={12} sm={4}>
                  <TextField name="remaining_units" label="Remaining Units" type="number" value={formData.remaining_units} onChange={handleChange} fullWidth required inputProps={{ step: "1", min: "0" }} helperText="Units in open pkg"/>
                </Grid>
            )}
            <Grid item xs={12} sm={medicine ? 4 : 6}>
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
              <TextField name="purchase_rate" label="Purchase Rate (per Pkg)" type="number" value={formData.purchase_rate} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
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
              {/* Row 6 - Pricing & Taxes */}
            <Grid item xs={12} sm={4}>
              <TextField name="mrp" label="MRP (per Pkg)" type="number" value={formData.mrp} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
            </Grid>
            {/* Replaced GST with CGST and SGST */}
            <Grid item xs={12} sm={4}>
              <TextField name="cgst" label="CGST (%)" type="number" value={formData.cgst} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField name="sgst" label="SGST (%)" type="number" value={formData.sgst} onChange={handleChange} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
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