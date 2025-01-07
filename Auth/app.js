const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const colors = require("colors");
const { WebhookClient } = require('discord.js');
const { Auth } = require("./Auth");
const path = require('path');

class OptimizedStatusMonitor {
    constructor() {
        this.config = this.loadConfig();
        this.messageIdFile = 'messageId.json';
        this.serviceHistory = new Map();
        this.lastMessageId = this.loadMessageId();
        this.webhook = this.config.URLs.webhook_url ? new WebhookClient({ url: this.config.URLs.webhook_url }) : null;
        this.maxHistoryLength = 20;
        this.cleanupInterval = 1800000;
        this.axiosInstance = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'HexStatus/2.0',
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            },
            maxRedirects: 5,
            validateStatus: () => true
        });
    }

    
    async authenticate(retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                await Auth();
                console.log("[AUTH]".green, "Hex Status: Authentication successful!");
                return true;
            } catch (error) {
                console.log("[AUTH]".yellow, `Attempt ${i + 1}/${retries} failed:`, error.message);
                if (i === retries - 1) {
                    console.log("[AUTH]".brightRed, "Authentication failed after all attempts");
                    process.exit(1);
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        return false;
    }

    loadConfig() {
        try {
            return yaml.load(fs.readFileSync('config.yml', 'utf8'));
        } catch (error) {
            console.error("[System]".red, "Failed to load config:", error.message);
            process.exit(1);
        }
    }

    loadMessageId() {
        try {
            return fs.existsSync(this.messageIdFile) 
                ? JSON.parse(fs.readFileSync(this.messageIdFile, 'utf8')).messageId 
                : null;
        } catch {
            return null;
        }
    }

    initializeServices() {
        this.config.services.forEach(service => {
            this.serviceHistory.set(service.name, {
                status: false,
                uptime: 0,
                checks: 0,
                lastCheck: null,
                responseTime: 0,
                statusHistory: []
            });
        });
    }

    async checkService(service) {
        const startTime = process.hrtime.bigint();
        try {
            const response = await this.axiosInstance.get(service.url);
            const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;

            const isUp = (response.status >= 200 && response.status < 300) || 
                        response.status === 403 || 
                        response.status === 503;

            return { isUp, responseTime };
        } catch {
            const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;
            return { isUp: false, responseTime };
        }
    }

   
    async updateServiceStatus(service, io) {
        const result = await this.checkService(service);
        const serviceData = this.serviceHistory.get(service.name);
        
        if (!serviceData) return false;

        const statusChanged = serviceData.status !== result.isUp;
        
        // Round the ping immediately when sending
        const roundedPing = Math.round(result.responseTime);
        
        if (io) {
            io.emit('pingUpdate', {
                serviceName: service.name,
                ping: roundedPing
            });
        }
        
        serviceData.responseTime = roundedPing; // Store rounded value
        serviceData.checks++;
        serviceData.lastCheck = new Date();
        serviceData.status = result.isUp;
        if (result.isUp) serviceData.uptime++;

        serviceData.statusHistory.push({
            status: result.isUp,
            timestamp: new Date(),
            responseTime: roundedPing
        });

        if (serviceData.statusHistory.length > this.maxHistoryLength) {
            serviceData.statusHistory = serviceData.statusHistory.slice(-this.maxHistoryLength);
        }

        return statusChanged;
    }

    async updateAllServices(io) {
        const statusChanges = await Promise.all(
            this.config.services.map(service => this.updateServiceStatus(service, io))
        );

        if (statusChanges.some(changed => changed)) {
            await this.sendDiscordUpdate();
        }

        this.emitFullUpdate(io);
    }

    async sendDiscordUpdate() {
        if (!this.webhook) return;

        const embed = this.createStatusEmbed();
        try {
            if (this.lastMessageId) {
                await this.webhook.editMessage(this.lastMessageId, { embeds: [embed] });
            } else {
                const message = await this.webhook.send({ embeds: [embed] });
                this.lastMessageId = message.id;
                fs.writeFileSync(this.messageIdFile, JSON.stringify({ messageId: this.lastMessageId }));
            }
        } catch (error) {
            console.log("[System]".red, "Discord update failed:", error.message);
        }
    }

    createStatusEmbed() {
        const services = Array.from(this.serviceHistory.entries());
        const onlineServices = services.filter(([, data]) => data.status);
        const offlineServices = services.filter(([, data]) => !data.status);

        return {
            title: '📊 Service Status Update',
            description: `**${onlineServices.length}/${services.length}** services online`,
            color: onlineServices.length === services.length ? 0x00ff00 : 0xff0000,
            timestamp: new Date(),
            thumbnail: { url: this.config.URLs.thumbnail },
            fields: [
                {
                    name: "🟢 Online Services",
                    value: this.formatServiceList(onlineServices, true),
                    inline: true
                },
                {
                    name: "🔴 Offline Services",
                    value: this.formatServiceList(offlineServices, false),
                    inline: true
                }
            ],
            footer: {
                iconURL: this.config.URLs.thumbnail,
                text: this.config.Site.footer
            }
        };
    }

    formatServiceList(services, isOnline) {
        return services.length > 0 
            ? services.map(([name, data]) => this.formatServiceEntry(name, data, isOnline)).join("\n")
            : "No services";
    }

    formatServiceEntry(name, data, isOnline) {
        const uptime = ((data.uptime / Math.max(data.checks, 1)) * 100).toFixed(2);
        const ping = Math.round(data.responseTime);
        
        return isOnline
            ? `**${name}**\nPing: ${ping}ms\nUptime: ${uptime}%`
            : `**${name}**\nLast Seen: ${new Date(data.lastCheck).toLocaleString()}`;
    }

    emitFullUpdate(io) {
        const stats = this.calculateStats();
        io.emit('statusUpdate', {
            statuses: Object.fromEntries(Array.from(this.serviceHistory.entries())
                .map(([name, data]) => [name, data.status])),
            history: Object.fromEntries(this.serviceHistory),
            stats
        });
    }

    calculateStats() {
        const services = Array.from(this.serviceHistory.values());
        const onlineCount = services.filter(s => s.status).length;
        const totalUptime = services.reduce((acc, service) => {
            return acc + ((service.uptime / Math.max(service.checks, 1)) * 100);
        }, 0);

        return {
            totalServices: this.serviceHistory.size,
            onlineServices: onlineCount,
            overallUptime: (totalUptime / this.serviceHistory.size).toFixed(2)
        };
    }

    async startServer() {
        const authenticated = await this.authenticate();
        if (authenticated) {
        const app = express();
        const server = require('http').createServer(app);
        const io = require('socket.io')(server);

        this.initializeServices();

    // Real-time ping updates for both web and Discord
    setInterval(async () => {
        for (const service of this.config.services) {
            const startTime = process.hrtime.bigint();
            try {
                await this.axiosInstance.get(service.url);
                const pingTime = Math.round(Number(process.hrtime.bigint() - startTime) / 1e6);
                
                // Update service history with new ping
                const serviceData = this.serviceHistory.get(service.name);
                if (serviceData) {
                    serviceData.responseTime = pingTime;
                }

                // Emit to web clients
                io.emit('pingUpdate', {
                    serviceName: service.name,
                    ping: pingTime
                });

                // Update Discord embed with latest data
                if (this.webhook && this.lastMessageId) {
                    const embed = this.createStatusEmbed();
                    await this.webhook.editMessage(this.lastMessageId, { embeds: [embed] });
                }
            } catch (error) {
                // Silent fail for clean operation
            }
        }
    }, 2000);
 
        app.set('view engine', 'ejs');
        app.use(express.static('public'));

        app.get('/', (req, res) => {
            res.render('index', {
                config: this.config,
                serviceHistory: Object.fromEntries(this.serviceHistory),
                title: this.config.Site.name,
                description: this.config.Site.description,
                footer: this.config.Site.footer,
                github: this.config.URLs.github
            });
        });

        io.on('connection', () => this.emitFullUpdate(io));

        await this.updateAllServices(io);

        setInterval(() => this.updateAllServices(io), 
            this.config.System.refresh_interval * 1000);

        const PORT = this.config.System.Port || 3000;
        server.listen(PORT, () => {
            console.log("[System]".green, "Hex Status:", 'Initialized');
            console.log("[System]".cyan, "Version:", this.config.System.version);
            console.log("[System]".yellow, "Server:", `Running on port ${PORT}`);
        });
    }
}
}

new OptimizedStatusMonitor().startServer();
