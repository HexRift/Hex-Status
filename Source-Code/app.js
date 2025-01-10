const express = require('express');
const { loadConfig } = require('./utils/config');
const { connectDatabase } = require('./utils/database');
const { setupRoutes } = require('./routes');
const { WebSocketService } = require('./services/WebSocketService');
const { MonitoringService } = require('./services/MonitoringService');
const { BotService } = require('./services/BotService');
const colors = require('colors');

class EnhancedStatusMonitor {
    constructor() {
        this.config = loadConfig();
        this.botService = new BotService(this.config);
    }

    async startServer() {
        await connectDatabase(this.config);
        const client = await this.botService.initialize();

        const app = express();
        app.locals.config = this.config;
        
        const server = require('http').createServer(app);
        
        setupRoutes(app);
        WebSocketService.setupWebSocket(server);
        MonitoringService.initialize(client, this.config);

        const PORT = this.config.System.Port || 3000;
        server.listen(PORT, () => {
            console.log("[System]".green, "Hex Status:", 'Initialized');
            console.log("[System]".cyan, "Version:", this.config.System.version);
            console.log("[System]".yellow, "Server:", `Running on port ${PORT}`);
        });
    }
}
new EnhancedStatusMonitor().startServer();