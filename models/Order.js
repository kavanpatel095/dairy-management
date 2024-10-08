const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    timeOfDay: { type: String, enum: ['Morning', 'Evening'], required: true }, // New field for time
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User (Milkman)
});

module.exports = mongoose.model('Order', orderSchema);
