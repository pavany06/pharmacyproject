// src/pages/History.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  CircularProgress,
  Button,
  TextField,
  InputAdornment
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SearchIcon from '@mui/icons-material/Search';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Helper: Format Date as DD-MM-YYYY ---
const formatDateDDMMYYYY = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return '-';
  }
};

// --- Helper: Row Component for Collapsible Table ---
function Row({ sale }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {sale.bill_number}
        </TableCell>
        {/* Date formatted as DD-MM-YYYY in the table */}
        <TableCell>
            {formatDateDDMMYYYY(sale.sale_date)}&nbsp;
            <Typography variant="caption" color="text.secondary">
                ({new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </Typography>
        </TableCell>
        <TableCell>{sale.customer_name}</TableCell>
        <TableCell>{sale.customer_phone}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 'bold' }}>₹{sale.grand_total?.toFixed(2)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div" size="small">
                Bill Items
              </Typography>
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell>Batch No</TableCell>
                    <TableCell>Expiry</TableCell>
                    <TableCell align="right">MRP</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sale.sale_items && sale.sale_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell component="th" scope="row">
                        {item.product_name}
                      </TableCell>
                      <TableCell>{item.batch_no}</TableCell>
                      {/* Ensure expiry is formatted nicely if needed, or just display string */}
                      <TableCell>{item.expiry_date}</TableCell> 
                      <TableCell align="right">{item.mrp}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">
                        ₹{item.subtotal?.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function History() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    // Fetch sales and join sale_items, ordered by created_at descending (newest first)
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales history:', error);
    } else {
      setSales(data);
    }
    setLoading(false);
  };

  // --- Filter Logic ---
  const filteredSales = sales.filter((sale) =>
    (sale.bill_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (sale.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (sale.customer_phone || '').includes(searchTerm)
  );

  // --- PDF Download Logic ---
  const handleDownloadDailyReport = () => {
    const doc = new jsPDF();
    const today = new Date();
    
    // Updated Date Format for PDF Header and Filename
    const dateString = formatDateDDMMYYYY(today); 
    
    // Filter sales for today
    const todaysSales = sales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate.toDateString() === today.toDateString();
    });

    if (todaysSales.length === 0) {
        alert("No sales found for today to generate a report.");
        return;
    }

    const totalSalesAmount = todaysSales.reduce((sum, sale) => sum + (sale.grand_total || 0), 0);

    // Header
    doc.setFontSize(18);
    doc.text("Sri Sai Pharmacy - Daily Sales Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Date: ${dateString}`, 14, 30); // Shows DD-MM-YYYY
    doc.text(`Total Sales Today: Rs. ${totalSalesAmount.toFixed(2)}`, 14, 36);

    const tableColumn = ["Bill No", "Time", "Customer", "Phone", "Medicines", "Amount"];
    const tableRows = [];

    todaysSales.forEach(sale => {
      const saleTime = new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Format medicines list for the report
      // Create a string like "Paracetamol (2), Cough Syrup (1)"
      const medicinesList = sale.sale_items && sale.sale_items.length > 0 
        ? sale.sale_items.map(item => `${item.product_name} (${item.quantity})`).join(', ')
        : '-';

      const saleData = [
        sale.bill_number,
        saleTime,
        sale.customer_name,
        sale.customer_phone,
        medicinesList,
        sale.grand_total.toFixed(2),
      ];
      tableRows.push(saleData);
    });

    // Use autoTable as a function directly
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { fontSize: 8, cellPadding: 1.5 }, // Reduce font size to fit medicines
      columnStyles: {
        0: { cellWidth: 25 }, // Bill No
        1: { cellWidth: 15 }, // Time
        2: { cellWidth: 25 }, // Customer
        3: { cellWidth: 25 }, // Phone
        4: { cellWidth: 'auto' }, // Medicines (takes remaining space)
        5: { cellWidth: 20, halign: 'right' }, // Amount
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text('Generated by Sri Sai Pharmacy System', 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    doc.save(`Sales_Report_${dateString}.pdf`);
  };

  return (
    <Layout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Sales History
        </Typography>
        
        <Button
            variant="contained"
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadDailyReport}
        >
            Download Today's Report
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by Bill No, Customer Name, or Phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        ) : filteredSales.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                No sales records found.
            </Typography>
        ) : (
            <Table aria-label="collapsible table">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>Bill Number</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Grand Total</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {filteredSales.map((sale) => (
                <Row key={sale.id} sale={sale} />
                ))}
            </TableBody>
            </Table>
        )}
      </TableContainer>
    </Layout>
  );
}