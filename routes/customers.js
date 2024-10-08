const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { ensureAuthenticated } = require('../middleware/auth');

// Get All Customers
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Fetch and sort customers by sr_no for the logged-in milkman
        const customers = await Customer.find({ milkman: req.user._id }).sort({ sr_no: 1 });
        res.render('customers', { customers });
    } catch (err) {
        res.status(500).send('Error retrieving customers: ' + err.message);
    }
});

// Add New Customer
router.post('/add', ensureAuthenticated, async (req, res) => {
    try {
        const { sr_no, customer_name, address, phone_number } = req.body;

        // Check if the serial number already exists for the logged-in milkman
        const existingCustomer = await Customer.findOne({ sr_no: sr_no, milkman: req.user._id });
        if (existingCustomer) {
            return res.render('customers', {
                errorMessage: 'Serial number already exists for your account. Please use a different serial number.',
                customers: await Customer.find({ milkman: req.user._id }).sort({ sr_no: 1 })
            });
        }

        const newCustomer = new Customer({
            sr_no,
            customer_name,
            address,
            phone_number,
            milkman: req.user._id
        });
        await newCustomer.save();
        res.redirect('/customers');
    } catch (err) {
        res.status(500).send('Error adding customer: ' + err.message);
    }
});

// Edit Customer
router.post('/edit/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { sr_no, customer_name, address, phone_number } = req.body;
        const customerId = req.params.id;

        // Check if the new serial number is unique for the logged-in milkman
        const existingCustomer = await Customer.findOne({ sr_no: sr_no, milkman: req.user._id });

        if (existingCustomer && existingCustomer._id.toString() !== customerId) {
            return res.render('customers', {
                errorMessage: 'Serial number already exists for your account. Please use a different serial number.',
                customers: await Customer.find({ milkman: req.user._id }).sort({ sr_no: 1 })
            });
        }

        await Customer.findByIdAndUpdate(customerId, {
            sr_no,
            customer_name,
            address,
            phone_number
        });
        res.redirect('/customers');
    } catch (err) {
        res.status(500).send('Error editing customer: ' + err.message);
    }
});

// Delete Customer
router.post('/delete/:id', ensureAuthenticated, async (req, res) => {
    try {
        await Customer.findByIdAndDelete(req.params.id);
        await Order.deleteMany({ customer: req.params.id });

        res.redirect('/customers');
    } catch (err) {
        res.status(500).send('Error deleting customer: ' + err.message);
    }
});

module.exports = router;
