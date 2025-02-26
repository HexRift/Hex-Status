const mongoose = require('mongoose');

const StatusMessageSchema = new mongoose.Schema({
    channelId: String,
    messageId: String,
    timestamp: Date,
    guildId: String
});

module.exports = mongoose.model('StatusMessage', StatusMessageSchema);
