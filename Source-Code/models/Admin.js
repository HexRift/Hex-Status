const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Admin', AdminSchema);
