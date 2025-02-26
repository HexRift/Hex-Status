const mongoose = require('mongoose');

const BotStatusSchema = new mongoose.Schema({
    status: String,
    type: String,
    timestamp: Date
});

module.exports = mongoose.model('BotStatus', BotStatusSchema);
