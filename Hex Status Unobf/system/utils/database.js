const mongoose = require('mongoose');
const colors = require('colors');

class DatabaseService {
    static instance = null;
    
    constructor() {
        this.isConnected = false;
        this.retryAttempts = 5;
        this.retryDelay = 5000;
        this.connectionOptions = {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            useNewUrlParser: true,
            useUnifiedTopology: true
        };
    }

    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    async connectDatabase(config) {
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const uri = config?.MongoDB?.uri || 'mongodb://localhost:27017/Hex-Status';
                await mongoose.connect(uri, this.connectionOptions);
                
                this.isConnected = true;
                this.setupMonitoring();
                
                console.log("[Database]".green, "Connected to MongoDB");
                console.log("[Database]".cyan, `Connection URI: ${uri}`);
                return true;

            } catch (error) {
                console.error("[Database]".yellow, 
                    `Connection attempt ${attempt}/${this.retryAttempts} failed:`, 
                    error.message
                );

                if (attempt === this.retryAttempts) {
                    console.error("[Database]".red, "All connection attempts failed");
                    throw error;
                }

                await this.delay(this.retryDelay);
            }
        }
    }

    setupMonitoring() {
        mongoose.connection.on('disconnected', () => {
            console.log("[Database]".yellow, "MongoDB disconnected");
            this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            console.log("[Database]".green, "MongoDB reconnected");
            this.isConnected = true;
        });

        mongoose.connection.on('error', (error) => {
            console.error("[Database]".red, "MongoDB error:", error);
        });
    }

    async disconnect() {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("[Database]".yellow, "MongoDB connection closed");
        }
    }

    getDatabaseStats() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            collections: mongoose.connection.collections,
            models: mongoose.models
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = {
    DatabaseService: DatabaseService.getInstance(),
    connectDatabase: (config) => DatabaseService.getInstance().connectDatabase(config)
};
