const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    site: {
        name: { type: String, default: 'Hex Status' },
        description: { type: String, default: 'Real-time Service Status Monitor' },
        footer: { type: String, default: 'Hex Status' }
    },
    urls: {
        github: { type: String, default: 'https://hexmodz.com/github' },
        thumbnail: { type: String, default: 'https://hexarion.net/Hex-Status.png' }
    },
    system: {
        port: { type: Number, default: 3000 },
        refresh_interval: { type: Number, default: 1000 },
        version: { type: String, default: '13.0.0' }
    },
    theme: {
        primary: { type: String, default: '#ff0000' },
        secondary: { type: String, default: '#1a1a1a' },
        accent: { type: String, default: '#ff3333' },
        background: { type: String, default: '#0a0a0a' },
        text: { type: String, default: '#ffffff' },
        cardBg: { type: String, default: '#1f1f1f' },
        hover: { type: String, default: '#ff1a1a' }
    },
    mongodb: {
        uri: { type: String, default: 'mongodb://localhost:27017/Hex-Status' }
    },
    bot: {
        token: { type: String, required: true },
        status: { type: String,  default: 'Hex Status', required: true }
    }
});



module.exports = mongoose.model('Settings', SettingsSchema);
