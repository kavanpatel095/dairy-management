const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const Order = require('./models/Order');
const Customer = require('./models/Customer');
const Product = require('./models/Product');

dotenv.config();

const app = express();

// Passport config
require('./config/passport')(passport);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// Express session
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'secret',
        resave: false,
        saveUninitialized: true,
    })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Middleware for route protection
const { ensureAuthenticated } = require('./middleware/auth');

app.get('/', (req, res) => {
    res.render('landing'); // Render a new landing page
});


// Home route (protected)
// Home route (protected)
app.get('/home', ensureAuthenticated, async (req, res) => {
    try {
        // Get total number of customers, products, and sales data
        const totalCustomers = await Customer.countDocuments({ milkman: req.user._id });
        const totalProducts = await Product.countDocuments({ user: req.user._id });

        // Total sales and revenue
        const orders = await Order.find({ user: req.user._id })
            .populate('customer')
            .populate('product')
            .exec();

        let totalSales = orders.length;
        let totalRevenue = orders.reduce((acc, order) => acc + order.price, 0);

        // Render the home page with these values
        res.render('home', {
            user: req.user,
            totalCustomers,
            totalProducts,
            totalSales,
            totalRevenue
        });
    } catch (err) {
        res.status(500).send('Error fetching data: ' + err.message);
    }
});




// Routes
const customerRoutes = require('./routes/customers');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const billingRouter = require('./routes/billing');
const authRoutes = require('./routes/auth'); // New route for authentication


app.use('/customers', ensureAuthenticated, customerRoutes);
app.use('/products', ensureAuthenticated, productRoutes);
app.use('/orders', ensureAuthenticated, orderRoutes);
app.use('/bill', ensureAuthenticated, billingRouter);
app.use('/auth', authRoutes); // Use the auth routes






// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
});


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
