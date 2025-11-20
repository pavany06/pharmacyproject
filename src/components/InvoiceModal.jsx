// src/components/InvoiceModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
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

const parseUnitsFromItemString = (itemString) => {
    if (!itemString) return null;
    const match = itemString.match(/^\s*(\d+)/);
    const units = match ? parseInt(match[1], 10) : null;
    return units > 0 ? units : null;
};

// Updated Calculation Helper for Invoice Display
// GST Logic REMOVED: MRP is inclusive.
const calculateInvoiceItemAmounts = (packageMrp, standardDiscountPercent, unitsSold, unitsPerPackage, extraDiscountType, extraDiscountValue) => {
    const pkgMrpNum = parseFloat(packageMrp) || 0;
    const stdDiscountNum = parseFloat(standardDiscountPercent) || 0;
    const qtyUnitsNum = parseInt(unitsSold, 10) || 0;
    const unitsPerPkgNum = Math.max(1, parseInt(unitsPerPackage, 10) || 1);
    const extraDiscValNum = parseFloat(extraDiscountValue) || 0;

    if (pkgMrpNum < 0 || qtyUnitsNum <= 0 || unitsPerPkgNum <= 0) return {
        unitMrpDisplay: 0,
        totalDiscountAmount: 0,
        finalSubtotal: 0,
    };

    const mrpPerUnit = pkgMrpNum / unitsPerPkgNum;
    const basePricePerUnit = mrpPerUnit;
    const standardDiscountPerUnit = basePricePerUnit * stdDiscountNum / 100;

    let extraDiscountPerUnit = 0;
    if (extraDiscountType === 'percent' && extraDiscValNum > 0) {
        extraDiscountPerUnit = basePricePerUnit * extraDiscValNum / 100;
    } else if (extraDiscountType === 'cost' && extraDiscValNum > 0) {
        extraDiscountPerUnit = extraDiscValNum;
    }

    const totalDiscountPerUnit = standardDiscountPerUnit + extraDiscountPerUnit;
    const finalPricePerUnit = Math.max(0, basePricePerUnit - totalDiscountPerUnit);

    const totalStandardDiscountAmount = standardDiscountPerUnit * qtyUnitsNum;
    const totalExtraDiscountAmount = extraDiscountPerUnit * qtyUnitsNum;
    
    const finalSubtotal = Math.max(0, parseFloat((finalPricePerUnit * qtyUnitsNum).toFixed(2)));
    const totalDiscountApplied = parseFloat((totalStandardDiscountAmount + totalExtraDiscountAmount).toFixed(2));

    return {
        unitMrpDisplay: parseFloat(mrpPerUnit.toFixed(2)),
        totalDiscountAmount: totalDiscountApplied,
        finalSubtotal: finalSubtotal,
    };
};
// --- ---

export default function InvoiceModal({ open, saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medicineDetails, setMedicineDetails] = useState({});

  const fetchSaleData = useCallback(async () => {
    if (!saleId) {
        setLoading(false);
        return;
    }
    setLoading(true);
    setSale(null);
    setSaleItems([]);
    setMedicineDetails({});

    try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .select('*')
          .eq('id', saleId)
          .maybeSingle();

        if (saleError) throw new Error(`Error loading sale data: ${saleError.message}`);
        if (!saleData) {
            setSale('not-found');
            setLoading(false);
            return;
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', saleId);

        if (itemsError) {
             console.error(`Error loading sale items for sale ID ${saleId}:`, itemsError.message);
        }
        const validItemsData = itemsData || [];

        setSale(saleData);
        setSaleItems(validItemsData);

        const medicineIds = [...new Set(validItemsData.map(item => item.medicine_id).filter(Boolean))];
        if (medicineIds.length > 0) {
          // Fetch CGST and SGST here
          const { data: medDetails, error: medError } = await supabase
            .from('medicines')
            .select('id, cgst, sgst, discount, no_of_items')
            .in('id', medicineIds);

          if (medError) {
              console.error('Error fetching medicine details:', medError);
          } else if (medDetails) {
            const detailsMap = medDetails.reduce((acc, med) => {
              acc[med.id] = {
                cgst: med.cgst ?? 0,
                sgst: med.sgst ?? 0,
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
        if (onClose) onClose();
    } finally {
        setLoading(false);
    }
  }, [saleId, onClose]);

  useEffect(() => {
    if (open && saleId) {
        fetchSaleData();
    }
  }, [open, saleId, fetchSaleData]);

  const handlePrint = () => window.print();

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #invoice-content, #invoice-content * { visibility: visible; }
      #invoice-content { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; margin: 0; }
      .no-print { display: none !important; }
      table, th, td { border-color: #000 !important; color: #000 !important; }
      .MuiDialog-paper { box-shadow: none !important; border: none !important; }
      #invoice-total-box { background-color: #f0f0f0 !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    #invoice-total-box { background-color: #1976d2; color: white; }
    @media screen {
       #invoice-total-box { background-color: #1976d2; color: white; }
     }
  `;

  const formatDate = (dateString, options = { year: '2-digit', month: '2-digit', day: '2-digit' }) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return '-';
      return date.toLocaleDateString(['en-IN', 'en-GB'], options);
    } catch {
      return '-';
    }
  };

  const formatExpiry = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date)) return '-';
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${year}`;
    } catch (e) {
        return '-';
    }
};


  const totalDiscountApplied = saleItems.reduce((sum, item) => {
    const details = medicineDetails[item.medicine_id];
    if (!details) return sum;
    const unitsPerPackage = parseUnitsFromItemString(details.no_of_items);
    if (!unitsPerPackage) return sum;

    const amounts = calculateInvoiceItemAmounts(
        item.mrp,
        details.discount,
        item.quantity,
        unitsPerPackage,
        item.extra_discount_type,
        item.extra_discount_value
    );
    return sum + (amounts.totalDiscountAmount || 0);
  }, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <style>{printStyles}</style>

      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}
        className="no-print"
      >
        <Typography variant="h5">Invoice: {sale === 'not-found' ? 'Not Found' : sale?.bill_number}</Typography>
        <Box>
          <MuiButton variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ mr: 2 }} disabled={!sale || sale === 'not-found'}>
            Print
          </MuiButton>
          <MuiIconButton onClick={onClose}>
            <CloseIcon />
          </MuiIconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
            <CircularProgress />
          </Box>
        ) : sale === 'not-found' ? (
           <Typography sx={{ textAlign: 'center', p: 4 }}>Sale data not found for the provided ID.</Typography>
        ) : !sale ? (
           <Typography sx={{ textAlign: 'center', p: 4 }}>Could not load sale data.</Typography>
        ) : (
          <Box id="invoice-content" sx={{ p: { xs: 1, md: 2 }, fontFamily: 'monospace', color: '#000' }}>

            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>Sri Sai Pharmacy</Typography>
              <Typography variant="body2">High School Road bus stop, Patamata</Typography>
              <Typography variant="body2">Vijayawada-10</Typography>
              <Typography variant="body2">Phone: +91 99634 03097</Typography>
              <Typography variant="body2">D.L. No: 141268, 141269 | GST: APPLIED</Typography>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

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

            <TableContainer>
              <Table size="small" sx={{ border: '1px solid #000' }}>
                <TableHead>
                  <TableRow sx={{ '& th': { border: '1px solid #000', fontWeight: 'bold', padding: '4px 8px' } }}>
                    <TableCell>Product</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Exp</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">MRP</TableCell>
                    <TableCell align="right">Disc</TableCell>
                    {/* CGST and SGST Columns */}
                    <TableCell align="right">CGST%</TableCell>
                    <TableCell align="right">SGST%</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {saleItems.map((item, i) => {
                    const details = medicineDetails[item.medicine_id];
                    const unitsPerPackage = details ? (parseUnitsFromItemString(details.no_of_items) || 1) : 1;

                    const amounts = calculateInvoiceItemAmounts(
                        item.mrp,
                        details?.discount ?? 0,
                        item.quantity,
                        unitsPerPackage,
                        item.extra_discount_type,
                        item.extra_discount_value
                    );

                    return (
                      <TableRow key={`${item.id || i}`} sx={{ '& td': { border: '1px solid #000', padding: '4px 8px' } }}>
                        <TableCell>{item.product_name || 'N/A'}</TableCell>
                        <TableCell>{item.batch_no || '-'}</TableCell>
                        <TableCell>{formatExpiry(item.expiry_date)}</TableCell>
                        <TableCell align="right">{item.quantity || 0}</TableCell>
                        <TableCell align="right">{amounts.unitMrpDisplay.toFixed(2)}</TableCell>
                        <TableCell align="right">{amounts.totalDiscountAmount.toFixed(2)}</TableCell>
                        {/* CGST and SGST Values */}
                        <TableCell align="right">{details?.cgst ?? 0}</TableCell>
                        <TableCell align="right">{details?.sgst ?? 0}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{amounts.finalSubtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1, borderColor: '#000', borderStyle: 'dashed' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 1 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">Items: {saleItems.length}</Typography>
                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.8rem' }}>
                    *PLEASE CHECK YOUR MEDICINES BEFORE USE*
                </Typography>
              </Box>
              <Box
                id="invoice-total-box"
                sx={{ textAlign: 'right', p: 1, minWidth: 250, borderRadius: 1 }}
               >
                <Typography variant="body2" sx={{ color: 'inherit' }}>Amount Saved: ₹{totalDiscountApplied.toFixed(2)}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, color: 'inherit' }}>
                  Total Amount: ₹{sale.grand_total?.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'inherit' }}>
                  (including GST)
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000' }} />

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                Each item subject to V/J/Tax/Disc/Distribution only.
                <br />
                Once goods sold will not be taken back or exchanged.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', fontSize: '0.8rem' }}>
                For Sri Sai Pharmacy<br /><br />
                (Authorised Signatory)
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}