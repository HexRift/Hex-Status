const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
    name: String,
    url: String,
    status: Boolean,
    uptime: Number,
    checks: Number,
    lastCheck: Date,
    responseTime: Number,
    statusHistory: [{
        status: Boolean,
        timestamp: Date,
        responseTime: Number
    }]
});

module.exports = mongoose.model('Service', ServiceSchema);
