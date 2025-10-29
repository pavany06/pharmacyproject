// src/components/InvoiceModal.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Ensured useEffect is imported
// Corrected import path for supabase - ensuring extension
import { supabase } from '../lib/supabase.js';
import {
  Box,
  Button as MuiButton,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton as MuiIconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';

// --- Helper Functions ---

// Parses the leading integer from the item string (e.g., "10 tablets")
const parseUnitsFromItemString = (itemString) => {
    if (!itemString) return null;
    const match = itemString.match(/^\s*(\d+)/);
    const units = match ? parseInt(match[1], 10) : null;
    return units > 0 ? units : null; // Return null if not a positive number or zero
};

// Updated Calculation Helper for Invoice Display
const calculateInvoiceItemAmounts = (packageMrp, gstPercent, standardDiscountPercent, unitsSold, unitsPerPackage, extraDiscountType, extraDiscountValue) => {
    const pkgMrpNum = parseFloat(packageMrp) || 0;
    const gstNum = parseFloat(gstPercent) || 0;
    const stdDiscountNum = parseFloat(standardDiscountPercent) || 0;
    const qtyUnitsNum = parseInt(unitsSold, 10) || 0;
    // Ensure unitsPerPackage is at least 1 to prevent division by zero
    const unitsPerPkgNum = Math.max(1, parseInt(unitsPerPackage, 10) || 1);
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    // Check for invalid inputs that would lead to division by zero or nonsensical calculations
    // Allow pkgMrpNum = 0 for free items.
    if (pkgMrpNum < 0 || qtyUnitsNum <= 0 || unitsPerPkgNum <= 0) return {
        unitMrpDisplay: 0,
        gstAmount: 0,
        totalDiscountAmount: 0,
        finalSubtotal: 0,
    };

    // Calculate MRP per unit from the package MRP stored in sale_items
    const mrpPerUnit = pkgMrpNum / unitsPerPkgNum;

    // Use the unit MRP for further calculations
    const basePricePerUnit = mrpPerUnit;
    const standardDiscountPerUnit = basePricePerUnit * stdDiscountNum / 100;

    let extraDiscountPerUnit = 0;
    if (extraDiscountType === 'percent' && extraDiscValNum > 0) {
        extraDiscountPerUnit = basePricePerUnit * extraDiscValNum / 100;
    } else if (extraDiscountType === 'cost' && extraDiscValNum > 0) {
        // Assume extraDiscountValue stored in sale_items is PER UNIT if type is 'cost'
        extraDiscountPerUnit = extraDiscValNum;
    }

    // Ensure discounts don't make the price negative
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
    // Round final subtotal to 2 decimal places to avoid floating point issues
    const finalSubtotal = Math.max(0, parseFloat((finalPricePerUnit * qtyUnitsNum).toFixed(2)));
    const totalDiscountApplied = parseFloat((totalStandardDiscountAmount + totalExtraDiscountAmount).toFixed(2));

    return {
        unitMrpDisplay: parseFloat(mrpPerUnit.toFixed(2)), // The list price per unit
        gstAmount: parseFloat(totalGstAmount.toFixed(2)),
        totalDiscountAmount: totalDiscountApplied, // Sum of standard and extra discount amounts
        finalSubtotal: finalSubtotal,
    };
};
// --- ---

export default function InvoiceModal({ open, saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medicineDetails, setMedicineDetails] = useState({}); // Store { id: { gst, discount, no_of_items } }

  // --- fetchSaleData updated (now wrapped in useCallback) ---
  // Marked as used by adding it to the useEffect dependency array
  const fetchSaleData = useCallback(async () => {
    if (!saleId) {
        setLoading(false); // Ensure loading stops if no saleId
        return;
    }
    setLoading(true);
    // Reset state before fetching new data
    setSale(null);
    setSaleItems([]);
    setMedicineDetails({});

    try {
        // Fetch Sale Info
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .select('*')
          .eq('id', saleId)
          .maybeSingle();

        if (saleError) throw new Error(`Error loading sale data: ${saleError.message}`);
        if (!saleData) {
            console.warn(`Sale with ID ${saleId} not found.`);
            setSale('not-found'); // Use special state
            setLoading(false);
            return;
        }

        // Fetch Sale Items
        const { data: itemsData, error: itemsError } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', saleId);

        // Handle potential item fetch error gracefully
        if (itemsError) {
             console.error(`Error loading sale items for sale ID ${saleId}:`, itemsError.message);
        }
        const validItemsData = itemsData || [];

        setSale(saleData);
        setSaleItems(validItemsData);

        // Fetch associated medicine details
        const medicineIds = [...new Set(validItemsData.map(item => item.medicine_id).filter(Boolean))];
        if (medicineIds.length > 0) {
          const { data: medDetails, error: medError } = await supabase
            .from('medicines')
            .select('id, gst, discount, no_of_items')
            .in('id', medicineIds);

          if (medError) {
              console.error('Error fetching medicine details:', medError);
          } else if (medDetails) {
            const detailsMap = medDetails.reduce((acc, med) => {
              acc[med.id] = {
                gst: med.gst ?? 0,
                discount: med.discount ?? 0,
                no_of_items: med.no_of_items || '',
              };
              return acc;
            }, {});
            setMedicineDetails(detailsMap);
          }
        }
    } catch (error) {
        console.error("Fetch Sale Data Error:", error);
        alert(error.message || 'An error occurred loading the invoice.');
        if (onClose) onClose(); // Close modal on critical error
    } finally {
        setLoading(false);
    }
  }, [saleId, onClose]); // Dependencies for useCallback
  // --- ---

  // --- useEffect to call fetchSaleData ---
  useEffect(() => {
    // Only fetch if the modal is open and has a valid saleId
    if (open && saleId) {
        fetchSaleData();
    }
     // Optional: Reset state when closing if needed, handled also by fetchSaleData start
    // else if (!open) {
    //     setSale(null);
    //     setSaleItems([]);
    //     setMedicineDetails({});
    //     setLoading(true); // Reset loading state for next open
    // }
  }, [open, saleId, fetchSaleData]); // Correct dependencies, now includes fetchSaleData
  // --- ---


  // --- handlePrint, printStyles, formatDate, formatExpiry remain the same ---
  const handlePrint = () => window.print();

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #invoice-content, #invoice-content * { visibility: visible; }
      #invoice-content { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; margin: 0; }
      .no-print { display: none !important; }
      table, th, td { border-color: #000 !important; color: #000 !important; }
      .MuiDialog-paper { box-shadow: none !important; border: none !important; }
      /* Ensure background colors don't print unless necessary */
      #invoice-total-box { background-color: #f0f0f0 !important; /* Light gray for print */ color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
     /* Style for the totals box specifically for print */
    #invoice-total-box { background-color: #1976d2; color: white; } /* Default blue bg */
     @media screen {
       #invoice-total-box { background-color: #1976d2; color: white; }
     }
  `;

  const formatDate = (dateString, options = { year: '2-digit', month: '2-digit', day: '2-digit' }) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return '-';
      // Use 'en-IN' for DD/MM/YY common in India, fallback to 'en-GB'
      return date.toLocaleDateString(['en-IN', 'en-GB'], options);
    } catch {
      return '-';
    }
  };

  const formatExpiry = (dateString) => {
    if (!dateString) return '-';
    try {
        // Handle potential full timestamp string from database
        const date = new Date(dateString);
        if (isNaN(date)) return '-';
        // Use UTC methods to avoid timezone shifting the month/year
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${year}`;
    } catch (e) {
        console.error("Error formatting expiry date:", dateString, e);
        return '-';
    }
};

  // --- ---

  // Calculate total discount applied (based on unit calculations)
  const totalDiscountApplied = saleItems.reduce((sum, item) => {
    const details = medicineDetails[item.medicine_id];
    if (!details) return sum; // Skip if details missing
    const unitsPerPackage = parseUnitsFromItemString(details.no_of_items);
    if (!unitsPerPackage) return sum; // Cannot calculate if units per package is unknown

    // Recalculate amounts based on stored item data and fetched medicine details
    const amounts = calculateInvoiceItemAmounts(
        item.mrp, // package MRP stored in sale_items
        details.gst,
        details.discount, // standard discount % from medicineDetails
        item.quantity, // quantity from sale_items is units sold
        unitsPerPackage,
        item.extra_discount_type,
        item.extra_discount_value
    );
    // Add the calculated total discount (standard + extra) for this item
    return sum + (amounts.totalDiscountAmount || 0); // Ensure NaN doesn't break sum
  }, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <style>{printStyles}</style>

      {/* Header (No change) */}
      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }} // Reduced padding bottom
        className="no-print"
      >
        <Typography variant="h5">Invoice: {sale === 'not-found' ? 'Not Found' : sale?.bill_number}</Typography>
        <Box>
           {/* Disable print if sale not found */}
          <MuiButton variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ mr: 2 }} disabled={!sale || sale === 'not-found'}>
            Print
          </MuiButton>
          <MuiIconButton onClick={onClose}>
            <CloseIcon />
          </MuiIconButton>
        </Box>
      </DialogTitle>

      {/* Body */}
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
            <CircularProgress />
          </Box>
        ) : sale === 'not-found' ? ( // Handle sale not found case
           <Typography sx={{ textAlign: 'center', p: 4 }}>Sale data not found for the provided ID.</Typography>
        ) : !sale ? ( // Handle case where sale is null after loading (unexpected error)
           <Typography sx={{ textAlign: 'center', p: 4 }}>Could not load sale data.</Typography>
        ) : (
          <Box id="invoice-content" sx={{ p: { xs: 1, md: 2 }, fontFamily: 'monospace', color: '#000' }}> {/* Adjusted padding */}

            {/* Pharmacy Header (No change) */}
            <Box sx={{ textAlign: 'center', mb: 1 }}> {/* Reduced margin bottom */}
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>Sri Sai Pharmacy</Typography>
              <Typography variant="body2">High School Road bus stop, Patamata</Typography>
              <Typography variant="body2">Vijayawada-10</Typography>
              <Typography variant="body2">Phone: +91 99634 03097</Typography>
              <Typography variant="body2">D.L. No: 141268, 141269 | GST: APPLIED</Typography>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

            {/* Bill Info (No change) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', mb: 1 }}>
              <Box>
                <Typography variant="body2">
                  <strong>Customer Phone:</strong>{' '}
                  {sale.customer_phone && sale.customer_phone !== '-' ? sale.customer_phone : 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2"><strong>Inv No:</strong> {sale.bill_number}</Typography>
                <Typography variant="body2"><strong>Inv Date:</strong> {formatDate(sale.sale_date)}</Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />

            {/* --- Items Table Updated --- */}
            <TableContainer>
              <Table size="small" sx={{ border: '1px solid #000' }}>
                <TableHead>
                  <TableRow sx={{ '& th': { border: '1px solid #000', fontWeight: 'bold', padding: '4px 8px' } }}> {/* Compact padding */}
                      {/* Updated Headers */}
                    <TableCell>Product</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Exp</TableCell>
                    <TableCell align="right">Qty(Units)</TableCell> {/* Updated */}
                    <TableCell align="right">MRP/Unit</TableCell> {/* Updated */}
                    <TableCell align="right">Total Disc</TableCell> {/* Combined Discount */}
                    {/* --- REMOVED GST Amt Header --- */}
                    {/* <TableCell align="right">GST Amt</TableCell> */}
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {saleItems.map((item, i) => {
                    const details = medicineDetails[item.medicine_id];
                    // Attempt to parse unitsPerPackage, default to 1 if missing/invalid
                    const unitsPerPackage = details ? (parseUnitsFromItemString(details.no_of_items) || 1) : 1;

                    // Use the invoice calculation helper
                    const amounts = calculateInvoiceItemAmounts(
                        item.mrp, // package MRP stored in sale_items
                        details?.gst ?? 0, // Use details if available, else 0
                        details?.discount ?? 0, // Use details if available, else 0
                        item.quantity, // quantity from sale_items is units sold
                        unitsPerPackage,
                        item.extra_discount_type,
                        item.extra_discount_value
                    );

                    return (
                      <TableRow key={`${item.id || i}`} sx={{ '& td': { border: '1px solid #000', padding: '4px 8px' } }}> {/* Use item.id if available, compact padding */}
                        {/* Updated Cells */}
                        <TableCell>{item.product_name || 'N/A'}</TableCell>
                        <TableCell>{item.batch_no || '-'}</TableCell>
                        <TableCell>{formatExpiry(item.expiry_date)}</TableCell>
                        <TableCell align="right">{item.quantity || 0}</TableCell> {/* Display units sold */}
                        <TableCell align="right">{amounts.unitMrpDisplay.toFixed(2)}</TableCell> {/* Display unit MRP */}
                        <TableCell align="right">{amounts.totalDiscountAmount.toFixed(2)}</TableCell> {/* Display total discount */}
                        {/* --- REMOVED GST Amt Cell --- */}
                        {/* <TableCell align="right">{amounts.gstAmount.toFixed(2)}</TableCell> */}
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{amounts.finalSubtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {/* --- --- */}

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />

            {/* Totals (Updated to use recalculated totalDiscountApplied) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 1 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">Items: {saleItems.length}</Typography>
                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.8rem' }}>
                    *PLEASE CHECK YOUR MEDICINES BEFORE USE*
                </Typography>
              </Box>
              <Box
                id="invoice-total-box" // ID for print styling
                sx={{ textAlign: 'right', p: 1, minWidth: 250, borderRadius: 1 }} // Added border radius
               >
                {/* Updated savings display */}
                <Typography variant="body2" sx={{ color: 'inherit' }}>Amount Saved: ₹{totalDiscountApplied.toFixed(2)}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, color: 'inherit' }}>
                  Total Amount: ₹{sale.grand_total?.toFixed(2)}
                </Typography>
                {/* --- ADDED "including GST" Text --- */}
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'inherit' }}>
                  (including GST)
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

            {/* Footer (No change) */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                Each item subject to V/J/Tax/Disc/Distribution only.
                <br />
                Once goods sold will not be taken back or exchanged.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', fontSize: '0.8rem' }}>
                For Sri Sai Pharmacy<br /><br />
                (Authorised Signatory) {/* Added clarification */}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}