const express = require('express');
const mongoose = require('mongoose');
const { connectDatabase } = require('./utils/database');
const { setupRoutes } = require('./routes');
const { WebSocketService } = require('./services/WebSocketService');
const { MonitoringService } = require('./services/MonitoringService');
const { BotService } = require('./services/BotService');
const SettingsService = require('./services/SettingsService');
const colors = require('colors');

class EnhancedStatusMonitor {
    constructor() {
        this.botService = null;
    }

    async startServer() {
        try {
            // Connect to MongoDB with extended timeouts
            await mongoose.connect('mongodb://localhost:27017/Hex-Status', {
                serverSelectionTimeoutMS: 15000,
                connectTimeoutMS: 15000,
                socketTimeoutMS: 45000
            });
            
            console.log("[Database]".green, "Connected to MongoDB");

            const settings = await SettingsService.getSettings();
            this.botService = new BotService(settings);
            const client = await this.botService.initialize();

            const app = express();
            app.locals.settings = settings;
            
            const server = require('http').createServer(app);
            
            setupRoutes(app);
            WebSocketService.setupWebSocket(server);
            MonitoringService.initialize(client, settings);

            const PORT = settings.system.port || 3000;
            server.listen(PORT, () => {
                console.log("[System]".green, "Hex Status:", 'Initialized');
                console.log("[System]".cyan, "Version:", settings.system.version);
                console.log("[System]".yellow, "Server:", `Running on port ${PORT}`);
            });
        } catch (error) {
            console.log("[Error]".red, "Failed to start server:", error.message);
            process.exit(1);
        }
    }
}

new EnhancedStatusMonitor().startServer();