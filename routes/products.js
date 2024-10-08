const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ensureAuthenticated } = require('../middleware/auth');

// Get All Products
router.get('/', ensureAuthenticated, async (req, res) => {
    const products = await Product.find({ user: req.user._id });
    res.render('products', { products });
});

// Add New Product
router.post('/add', ensureAuthenticated, async (req, res) => {
    const { product_name, price } = req.body;
    const newProduct = new Product({
        product_name,
        price,
        user: req.user._id
    });
    await newProduct.save();
    res.redirect('/products');
});

// Edit Product
router.post('/edit/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    await Product.findOneAndUpdate({ _id: id, user: req.user._id }, req.body);
    res.redirect('/products');
});

// Delete Product
router.post('/delete/:id', ensureAuthenticated, async (req, res) => {
    try {
        await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        await Order.deleteMany({ product: req.params.id, user: req.user._id });

        res.redirect('/products');
    } catch (err) {
        res.status(500).send('Error deleting product: ' + err.message);
    }
});

module.exports = router;
