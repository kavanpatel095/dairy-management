const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit'); // Add PDFKit
const { ensureAuthenticated } = require('../middleware/auth');

// Get All Orders
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { startDate, endDate, timeOfDay } = req.query;
        let query = { user: req.user._id };

        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        if (timeOfDay) {
            query.timeOfDay = timeOfDay;
        }

        const orders = await Order.find(query)
            .populate('customer')
            .populate('product')
            .exec();

        const filteredOrders = orders.filter(order => order.customer && order.product);

        filteredOrders.sort((a, b) => {
            if (a.customer.sr_no !== b.customer.sr_no) {
                return a.customer.sr_no - b.customer.sr_no;
            }
            return new Date(a.date) - new Date(b.date);
        });

        // Calculate total quantity and total amount
        const totalQuantity = filteredOrders.reduce((sum, order) => sum + order.quantity, 0);
        const totalAmount = filteredOrders.reduce((sum, order) => sum + order.price, 0);

        // Calculate total quantity for each product
        const productQuantities = {};
        filteredOrders.forEach(order => {
            const productName = order.product.product_name;
            if (!productQuantities[productName]) {
                productQuantities[productName] = 0;
            }
            productQuantities[productName] += order.quantity;
        });

        res.render('orders', {
            orders: filteredOrders,
            startDate,
            endDate,
            timeOfDay,
            totalQuantity,
            totalAmount,
            productQuantities
        });
    } catch (err) {
        res.status(500).send('Error retrieving orders: ' + err.message);
    }
});




// Create New Order
router.get('/create', ensureAuthenticated, async (req, res) => {
    try {
        const customers = await Customer.find({ milkman: req.user._id }); // Use 'milkman' instead of 'user'
        const products = await Product.find({ user: req.user._id });
        res.render('create-order', { customers, products });
    } catch (err) {
        res.status(500).send('Error retrieving customers or products: ' + err.message);
    }
});


router.post('/create', ensureAuthenticated, async (req, res) => {
    const { date, customer, product, quantity, timeOfDay } = req.body;
    const selectedProduct = await Product.findById(product);
    const price = selectedProduct.price * quantity;

    const newOrder = new Order({
        date,
        customer,
        product,
        quantity,
        price,
        timeOfDay, // Capture time of day
        user: req.user._id
    });

    await newOrder.save();
    res.redirect('/orders');
});


// Delete Order
router.post('/delete/:id', ensureAuthenticated, async (req, res) => {
    try {
        await Order.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        res.redirect('/orders');
    } catch (err) {
        res.status(500).send('Error deleting order: ' + err.message);
    }
});

//PDF Download
router.post('/download', ensureAuthenticated, async (req, res) => {
    try {
        const { startDate, endDate, timeOfDay } = req.body;

        // Debug log
        console.log("Starting PDF generation...");

        let query = { user: req.user._id };

        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        if (timeOfDay) {
            query.timeOfDay = timeOfDay;
        }

        const orders = await Order.find(query)
            .populate('customer')
            .populate('product')
            .exec();

        const filteredOrders = orders.filter(order => order.customer && order.product);

        filteredOrders.sort((a, b) => {
            if (a.customer.sr_no !== b.customer.sr_no) {
                return a.customer.sr_no - b.customer.sr_no;
            }
            return new Date(a.date) - new Date(b.date);
        });

        // Calculate total quantity and total amount
        const totalQuantity = filteredOrders.reduce((sum, order) => sum + order.quantity, 0);
        const totalAmount = filteredOrders.reduce((sum, order) => sum + order.price, 0);

        // Calculate product-wise quantities
        const productQuantities = filteredOrders.reduce((quantities, order) => {
            const productName = order.product.product_name;
            if (quantities[productName]) {
                quantities[productName] += order.quantity;
            } else {
                quantities[productName] = order.quantity;
            }
            return quantities;
        }, {});

        // Create PDF document
        const doc = new PDFDocument({ margin: 30 });
        res.setHeader('Content-Disposition', `attachment; filename="filtered_orders_${startDate}_to_${endDate}.pdf"`);
        doc.pipe(res);

        // Add title
        doc.fontSize(20).text('Filtered Orders', { align: 'center' });

        // Add date range
        doc.fontSize(12).text(`Date Range: ${new Date(startDate).toDateString()} - ${new Date(endDate).toDateString()}`, { align: 'center' });

        // Add some space before the table
        doc.moveDown(2);

        // Define table headers and column widths
        const tableHeaders = ['Sr No', 'Date', 'Customer Name', 'Product', 'Quantity', 'Time', 'Price'];
        const columnWidths = [50, 80, 120, 90, 50, 80, 80];
        const startX = 30;
        let currentY = doc.y;

        // Draw table headers
        doc.fontSize(10).font('Helvetica-Bold');
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

        // Draw table rows
        doc.fontSize(10).font('Helvetica');
        filteredOrders.forEach(order => {
            const row = [
                order.customer.sr_no,
                new Date(order.date).toDateString(),
                order.customer.customer_name,
                order.product.product_name,
                order.quantity,
                order.timeOfDay,
                `Rs.${order.price.toFixed(2)}`
            ];

            // Handle page breaks
            if (currentY + 20 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                currentY = doc.page.margins.top;
            }

            row.forEach((text, i) => {
                doc.text(text, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, {
                    width: columnWidths[i],
                    align: 'center'
                });
            });

            currentY += 20;
        });

        // Add totals and product-wise quantities section (aligned to leftmost corner)
        if (currentY + 80 > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            currentY = doc.page.margins.top;
        }

        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');

        // Add totals section
        doc.text(`Total Quantity: ${totalQuantity}`, { align: 'left' });
        doc.text(`Total Amount: Rs.${totalAmount.toFixed(2)}`, { align: 'left' });

        // Move to the next line
        doc.moveDown(2);

        // Add product-wise quantities section with left alignment
        doc.text('Product-wise Quantities:', { underline: true, align: 'left' });

        doc.moveDown(1);

        Object.entries(productQuantities).forEach(([productName, quantity]) => {
            doc.text(`${productName}: ${quantity}`, { align: 'left' });
            doc.moveDown(1);
        });

        // Finalize the PDF and end the stream
        doc.end();

        // Debug log
        console.log("PDF generation completed successfully!");

    } catch (err) {
        // Log the error and return a response
        console.error('Error generating PDF:', err);
        res.status(500).send('Error generating PDF: ' + err.message);
    }
});



module.exports = router;
