const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('License', licenseSchema);
