const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: Boolean,
        default: false
    },
    uptime: {
        type: Number,
        default: 0
    },
    checks: {
        type: Number,
        default: 0
    },
    lastCheck: {
        type: Date,
        default: Date.now
    },
    responseTime: {
        type: Number,
        default: 0
    },
    statusHistory: [{
        status: Boolean,
        timestamp: {
            type: Date,
            default: Date.now
        },
        responseTime: Number
    }],
    position: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Add index for better query performance
ServiceSchema.index({ name: 1 });
ServiceSchema.index({ status: 1 });

module.exports = mongoose.model('Service', ServiceSchema);