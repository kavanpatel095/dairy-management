const bcrypt = require('bcrypt');
const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // Optional for validation


// Register Page
router.get('/register', (req, res) => {
    res.render('register');
});

// Registration Route
router.post('/register', async (req, res) => {
    const { name, email, password, password2 } = req.body;

    if (password !== password2) {
        req.flash('error_msg', 'Passwords do not match');
        return res.redirect('/auth/register');
    }

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            req.flash('error_msg', 'Email is already registered');
            return res.redirect('/auth/register');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();
        req.flash('success_msg', 'You are now registered and can log in');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Server error. Please try again later.');
        res.redirect('/auth/register');
    }
});

// Login Page
router.get('/login', (req, res) => {
    res.render('login');
});

// Login Handle
// Login Handle
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error_msg', 'Invalid email or password');
            return res.redirect('/auth/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid email or password');
            return res.redirect('/auth/login');
        }

        req.login(user, (err) => {
            if (err) {
                req.flash('error_msg', 'Error logging in');
                return res.redirect('/auth/login');
            }
            req.flash('success_msg', 'You are now logged in');
            res.redirect('/home');
        });
    } catch (err) {
        req.flash('error_msg', 'Server error. Please try again later.');
        res.redirect('/auth/login');
    }
});


// Logout Handle
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/auth/login');
    });
});

module.exports = router;
