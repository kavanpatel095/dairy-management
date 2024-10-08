const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');
const { ensureAuthenticated } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');


// Get Bill Page
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const customers = await Customer.find({ milkman: req.user._id });
        res.render('bill', { customers });
    } catch (err) {
        res.status(500).send('Error retrieving customers: ' + err.message);
    }
});

// Get Bill Details
router.post('/view', ensureAuthenticated, async (req, res) => {
    try {
        const { customer, startDate, endDate } = req.body;
        let query = {
            customer: customer,
            date: { $gte: new Date(startDate), $lte: new Date(endDate) },
            user: req.user._id
        };

        const orders = await Order.find(query)
            .populate('customer')
            .populate('product')
            .exec();

        // Sort the orders by date in ascending order
        orders.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate total amount
        const totalAmount = orders.reduce((sum, order) => sum + order.price, 0);

        res.render('bill-details', { orders, totalAmount, startDate, endDate });
    } catch (err) {
        res.status(500).send('Error retrieving bill details: ' + err.message);
    }
});




// Download Bill as PDF
router.post('/download', ensureAuthenticated, async (req, res) => {
    try {
        const { customer, startDate, endDate } = req.body;
        let query = {
            customer: customer,
            date: { $gte: new Date(startDate), $lte: new Date(endDate) },
            user: req.user._id
        };

        const orders = await Order.find(query)
            .populate('customer')
            .populate('product')
            .exec();

        // Sort orders by date
        orders.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate total amount
        const totalAmount = orders.reduce((sum, order) => sum + order.price, 0);

        // Create a PDF document
        const doc = new PDFDocument({ margin: 30 });
        res.setHeader('Content-Disposition', `attachment; filename="bill_${startDate}_to_${endDate}.pdf"`);
        doc.pipe(res);

        // Add a title
        doc.fontSize(20).text('Bill Details', { align: 'center' });

        // Add date range
        doc.fontSize(12).text(`Date Range: ${new Date(startDate).toDateString()} - ${new Date(endDate).toDateString()}`, { align: 'center' });

        // Add some space before the table
        doc.moveDown(2);

        // Define table headers and column widths
        const tableHeaders = ['Sr No', 'Date', 'Customer Name', 'Product', 'Quantity', 'Time', 'Price'];
        const columnWidths = [40, 90, 120, 90, 50, 80, 80];
        const startX = 30;
        const headerY = doc.y;
        let currentY = doc.y;

        // Draw table headers
        doc.fontSize(10).font('Helvetica');
        tableHeaders.forEach((header, i) => {
            doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, {
                width: columnWidths[i],
                align: 'center'
            });
        });

        // Draw a line under headers
        doc.moveTo(startX, currentY + 15)
            .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), currentY + 15)
            .stroke();

        // Move to the next row
        currentY += 20;

        // Function to handle page break
        function handlePageBreak() {
            if (currentY > doc.page.height - 100) { // Leave space for footer and margins
                doc.addPage();
                currentY = doc.y;
                // Redraw table headers on new page
                doc.fontSize(10).font('Helvetica');
                tableHeaders.forEach((header, i) => {
                    doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, {
                        width: columnWidths[i],
                        align: 'center'
                    });
                });

                // Draw a line under headers
                doc.moveTo(startX, currentY + 15)
                    .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), currentY + 15)
                    .stroke();

                // Move to the next row
                currentY += 20;
            }
        }

        // Draw table rows
        doc.fontSize(10).font('Helvetica');
        orders.forEach(order => {
            handlePageBreak();

            const row = [
                order.customer.sr_no,
                new Date(order.date).toDateString(),
                order.customer.customer_name,
                order.product.product_name,
                order.quantity,
                order.timeOfDay,
                `$${order.price.toFixed(2)}`
            ];

            row.forEach((text, i) => {
                doc.text(text, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, {
                    width: columnWidths[i],
                    align: 'center'
                });
            });

            currentY += 20;
        });

        // Draw a line before the total amount
        doc.moveDown(2);
        const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
        doc.lineWidth(1)
            .moveTo(startX, currentY)
            .lineTo(startX + tableWidth, currentY)
            .stroke();

        // Add total amount
        currentY += 20;
        doc.fontSize(12).font('Helvetica-Bold')
            .text(`Total Amount: $${totalAmount.toFixed(2)}`, { align: 'center' });

        // Finalize the PDF and end the stream
        doc.end();
    } catch (err) {
        res.status(500).send('Error generating PDF: ' + err.message);
    }
});


module.exports = router;
