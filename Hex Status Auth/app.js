const express = require('express');
const mongoose = require('mongoose');
const { connectDatabase } = require('./system/utils/database');
const { setupRoutes } = require('./system/routes');
const { WebSocketService } = require('./system/services/WebSocketService');
const { MonitoringService } = require('./system/services/MonitoringService');
const { BotService } = require('./system/services/BotService');
const SettingsService = require('./system/services/SettingsService');
const colors = require('colors');
const { Auth } = require('./system/services/auth-api');

class EnhancedStatusMonitor {
    constructor() {
        this.botService = null;
        this.server = null;
        this.isShuttingDown = false;
    }

    async startServer() {
        try {
            // Enhanced MongoDB connection with retry logic
            await this.connectWithRetry();
            
            console.log("[Database]".green, "Connected to MongoDB");

             // Verify license after database connection
             await Auth();

            const settings = await SettingsService.getSettings();
            this.botService = new BotService(settings);
            const client = await this.botService.initialize();

            const app = express();
            app.locals.settings = settings;
            
            // Enhanced error handling middleware
            app.use((err, req, res, next) => {
                console.error("[Error]".red, err.stack);
                res.status(500).json({ error: 'Internal Server Error' });
            });
            
            this.server = require('http').createServer(app);
            
            setupRoutes(app);
            WebSocketService.setupWebSocket(this.server);
            MonitoringService.initialize(client, settings);

            const PORT = settings.system.port || 3000;
            this.server.listen(PORT, () => {
                console.log("[System]".green, "Hex Status:", 'Initialized');
                console.log("[System]".cyan, "Version:", settings.system.version);
                console.log("[System]".yellow, "Server:", `Running on port ${PORT}`);
            });

            // Setup graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            console.log("[Error]".red, "Failed to start server:", error.message);
            process.exit(1);
        }
    }

    async connectWithRetry(retries = 5) {
        for (let i = 0; i < retries; i++) {
            try {
                await mongoose.connect('mongodb://localhost:27017/Hex-Status', {
                    serverSelectionTimeoutMS: 15000,
                    connectTimeoutMS: 15000,
                    socketTimeoutMS: 45000,
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                });
                return;
            } catch (err) {
                if (i === retries - 1) throw err;
                console.log("[Database]".yellow, `Connection attempt ${i + 1} failed. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    setupGracefulShutdown() {
        const shutdown = async () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            console.log("[System]".yellow, "Graceful shutdown initiated...");

            // Close HTTP server
            if (this.server) {
                await new Promise(resolve => this.server.close(resolve));
            }

            // Close WebSocket connections
            if (WebSocketService.wss) {
                WebSocketService.wss.close();
            }

            // Cleanup bot service
            if (this.botService) {
                await this.botService.cleanup();
            }

            // Close MongoDB connection
            await mongoose.connection.close();

            console.log("[System]".green, "Graceful shutdown completed");
            process.exit(0);
        };

        // Handle different shutdown signals
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
        process.on('uncaughtException', (error) => {
            console.error("[Error]".red, "Uncaught Exception:", error);
            shutdown();
        });
    }
}

// Add process-wide unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error("[Error]".red, 'Unhandled Rejection at:', promise, 'reason:', reason);
});

new EnhancedStatusMonitor().startServer();
