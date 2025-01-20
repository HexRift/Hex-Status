const socketIO = require('socket.io');
const { Service } = require('../models');
const { MonitoringService } = require('./MonitoringService');
const colors = require('colors');

class WebSocketService {
    static io = null;
    static clients = new Map();
    static updateInterval = null;
    static stats = {
        connectedClients: 0,
        messagesSent: 0,
        lastUpdate: null
    };

    static setupWebSocket(server) {
        this.io = socketIO(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.setupEventHandlers();
        this.startUpdateLoop();
        this.setupHeartbeat();

        console.log("[WebSocket]".green, "Service initialized");
        return this.io;
    }

    static setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
            
            socket.on('disconnect', () => this.handleDisconnect(socket));
            socket.on('initialState', () => this.sendInitialState(socket));
            socket.on('subscribe', (room) => this.handleSubscribe(socket, room));
            socket.on('unsubscribe', (room) => this.handleUnsubscribe(socket, room));
            socket.on('error', (error) => this.handleError(socket, error));
        });
    }

    static async handleConnection(socket) {
        this.clients.set(socket.id, {
            connectedAt: Date.now(),
            lastActivity: Date.now()
        });
        
        this.stats.connectedClients = this.clients.size;
        console.log("[WebSocket]".cyan, `Client connected: ${socket.id}`);
        
        await this.sendInitialState(socket);
    }

    static handleDisconnect(socket) {
        this.clients.delete(socket.id);
        this.stats.connectedClients = this.clients.size;
        console.log("[WebSocket]".yellow, `Client disconnected: ${socket.id}`);
    }

    static async sendInitialState(socket) {
        try {
            const services = await Service.find().lean();
            const stats = await this.calculateSystemStats();
            
            socket.emit('initialState', {
                services,
                stats,
                timestamp: Date.now()
            });
            
            this.stats.messagesSent++;
        } catch (error) {
            this.handleError(socket, error);
        }
    }

    static startUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            await this.broadcastUpdates();
        }, 2000);
    }

    static async broadcastUpdates() {
        try {
            const services = await Service.find().lean();
            const stats = await this.calculateSystemStats();
            
            for (const service of services) {
                const result = await MonitoringService.checkService(service);
                const updatedService = await MonitoringService.updateServiceStatus(service);
                
                this.broadcastServiceUpdate(updatedService, result);
            }

            this.io.emit('statsUpdate', {
                stats,
                timestamp: Date.now()
            });

            this.stats.lastUpdate = Date.now();
            this.stats.messagesSent++;
        } catch (error) {
            console.error("[WebSocket]".red, "Broadcast error:", error);
        }
    }

    static broadcastServiceUpdate(service, result) {
        this.io.emit('serviceUpdate', {
            service,
            ping: Math.round(result.responseTime),
            uptime: this.calculateUptime(service),
            status: service.status,
            timestamp: Date.now()
        });
    }

    static calculateUptime(service) {
        return ((service.uptime / Math.max(service.checks, 1)) * 100).toFixed(2);
    }

    static async calculateSystemStats() {
        const services = await Service.find();
        const onlineServices = services.filter(s => s.status);
        
        return {
            onlineCount: onlineServices.length,
            totalServices: services.length,
            overallUptime: this.calculateOverallUptime(services),
            connectedClients: this.stats.connectedClients,
            messagesSent: this.stats.messagesSent
        };
    }

    static calculateOverallUptime(services) {
        if (!services.length) return 0;
        
        const totalUptime = services.reduce((acc, service) => 
            acc + ((service.uptime / Math.max(service.checks, 1)) * 100), 0);
        
        return (totalUptime / services.length).toFixed(2);
    }

    static setupHeartbeat() {
        setInterval(() => {
            this.io.emit('heartbeat', {
                timestamp: Date.now(),
                stats: this.stats
            });
        }, 30000);
    }

    static handleSubscribe(socket, room) {
        socket.join(room);
        console.log("[WebSocket]".cyan, `Client ${socket.id} subscribed to ${room}`);
    }

    static handleUnsubscribe(socket, room) {
        socket.leave(room);
        console.log("[WebSocket]".yellow, `Client ${socket.id} unsubscribed from ${room}`);
    }

    static handleError(socket, error) {
        console.error("[WebSocket]".red, `Error for client ${socket.id}:`, error);
        socket.emit('error', {
            message: 'An error occurred',
            timestamp: Date.now()
        });
    }

    static cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.io) {
            this.io.close();
            console.log("[WebSocket]".yellow, "Service cleaned up");
        }
    }
}

module.exports = { WebSocketService };
