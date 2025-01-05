const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const colors = require("colors");
const { WebhookClient } = require('discord.js');
const path = require('path');

class StatusMonitor {
    constructor() {
        this.config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
        this.messageIdFile = 'messageId.json';
        this.serviceHistory = {};
        this.lastMessageId = this.loadMessageId();
        this.webhook = new WebhookClient({ url: this.config.System.webhook_url });
        this.pingInterval = this.config.System.pingInterval; // 5 seconds for ping updates
    }

    loadMessageId() {
        if (fs.existsSync(this.messageIdFile)) {
            try {
                return JSON.parse(fs.readFileSync(this.messageIdFile, 'utf8')).messageId;
            } catch {
                return null;
            }
        }
        return null;
    }

    saveMessageId(messageId) {
        fs.writeFileSync(this.messageIdFile, JSON.stringify({ messageId }));
    }

    initializeServiceHistory() {
        this.config.services.forEach(service => {
            this.serviceHistory[service.name] = {
                status: false,
                uptime: 0,
                checks: 0,
                lastCheck: null,
                responseTime: 0,
                statusHistory: []
            };
        });
    }

    async checkService(service) {
        const startTime = Date.now();
        try {
            const response = await axios.get(service.url, {
                timeout: 5000,
                validateStatus: () => true
            });
            return {
                isUp: response.status >= 200 && response.status < 300,
                responseTime: Date.now() - startTime
            };
        } catch (error) {
            console.error(`[System] Error checking ${service.name}:`.red, error.message);
            return { isUp: false, responseTime: Date.now() - startTime };
        }
    }

    async updatePingOnly(service, io) {
        const startTime = Date.now();
        try {
            const response = await axios.get(service.url, { timeout: 5000 });
            const pingTime = Date.now() - startTime;

            // Update service history
            this.serviceHistory[service.name].responseTime = pingTime;

            // Emit ping update via Socket.IO
            io.emit('pingUpdate', {
                serviceName: service.name,
                ping: pingTime
            });

            // Update Discord embed ping
            await this.updateDiscordEmbedPing(service.name, pingTime);

            return pingTime;
        } catch (error) {
            console.error(`[System] Ping update failed for ${service.name}:`.red, error.message);
            return null;
        }
    }

    async updateDiscordEmbedPing(serviceName, pingTime) {
        if (!this.lastMessageId) return;

        try {
            const message = await this.webhook.fetchMessage(this.lastMessageId);
            const embed = message.embeds[0];

            // Update ping in online services field
            if (embed.fields[0].name === "🟢 Online Services") {
                const lines = embed.fields[0].value.split('\n');
                const updatedLines = lines.map(line => {
                    if (line.includes(serviceName)) {
                        return line.replace(/Ping: \d+ms/, `Ping: ${pingTime}ms`);
                    }
                    return line;
                });
                embed.fields[0].value = updatedLines.join('\n');
            }

            await this.webhook.editMessage(this.lastMessageId, { embeds: [embed] });
        } catch (error) {
            console.error(`[System] Discord embed ping update failed:`.red, error.message);
        }
    }

    async sendStatusWebhook() {
        const onlineServices = this.config.services.filter(service => 
            this.serviceHistory[service.name].status);
        const offlineServices = this.config.services.filter(service => 
            !this.serviceHistory[service.name].status);

        const embed = {
            title: '📊 Service Status Update',
            description: `**${onlineServices.length}/${this.config.services.length}** services are currently online.`,
            color: onlineServices.length === this.config.services.length ? 0x00ff00 : 0xff0000,
            timestamp: new Date(),
            thumbnail: { url: this.config.System.thumbnail },
            fields: [
                {
                    name: "🟢 Online Services",
                    value: onlineServices.length > 0 
                        ? onlineServices.map(service => this.formatServiceStatus(service, true)).join("\n")
                        : "No services are online.",
                    inline: true
                },
                {
                    name: "🔴 Offline Services",
                    value: offlineServices.length > 0
                        ? offlineServices.map(service => this.formatServiceStatus(service, false)).join("\n")
                        : "No services are offline.",
                    inline: true
                }
            ],
            footer: {
                iconURL: this.config.System.thumbnail,
                text: this.config.System.footer || '© 2024 - 2025 Hex Modz'
            }
        };

        try {
            if (this.lastMessageId) {
                await this.webhook.editMessage(this.lastMessageId, { embeds: [embed] });
            } else {
                const message = await this.webhook.send({ embeds: [embed] });
                this.lastMessageId = message.id;
                this.saveMessageId(this.lastMessageId);
            }
        } catch (error) {
            console.log("[System]".red, "Discord notification failed:", error.message);
        }
    }

    formatServiceStatus(service, isOnline) {
        const history = this.serviceHistory[service.name];
        return isOnline
            ? `**${service.name}**\nPing: ${history.responseTime}ms\nUptime: ${this.calculateUptime(history)}%\n`
            : `**${service.name}**\nLast Checked: ${new Date(history.lastCheck).toLocaleString()}\n`;
    }

    calculateUptime(history) {
        return ((history.uptime / Math.max(history.checks, 1)) * 100).toFixed(2);
    }

    async updateStatuses(io) {
        let statusChanged = false;

        await Promise.all(this.config.services.map(async (service) => {
            const { isUp, responseTime } = await this.checkService(service);
            const currentStatus = this.serviceHistory[service.name].status;

            this.updateServiceHistory(service.name, isUp, responseTime);
            if (currentStatus !== isUp) statusChanged = true;
        }));

        if (statusChanged) await this.sendStatusWebhook();
        this.emitStatusUpdate(io);
    }

    updateServiceHistory(serviceName, isUp, responseTime) {
        const service = this.serviceHistory[serviceName];
        service.checks++;
        service.lastCheck = new Date();
        service.responseTime = responseTime;
        service.status = isUp;
        if (isUp) service.uptime++;

        service.statusHistory.push({
            status: isUp,
            timestamp: new Date(),
            responseTime
        });

        if (service.statusHistory.length > 20) {
            service.statusHistory.shift();
        }
    }

    emitStatusUpdate(io) {
        const stats = this.calculateStats();
        io.emit('statusUpdate', {
            statuses: this.getServiceStatuses(),
            history: this.serviceHistory,
            stats
        });
    }

    calculateStats() {
        const onlineCount = Object.values(this.serviceHistory)
            .filter(s => s.status).length;
        const totalUptime = Object.values(this.serviceHistory)
            .reduce((acc, service) => acc + this.calculateUptime(service), 0);

        return {
            totalServices: this.config.services.length,
            onlineServices: onlineCount,
            overallUptime: (totalUptime / this.config.services.length).toFixed(2)
        };
    }

    getServiceStatuses() {
        return Object.fromEntries(
            Object.entries(this.serviceHistory)
                .map(([name, data]) => [name, data.status])
        );
    }

    async startServer() {
        const app = express();
        const http = require('http').Server(app);
        const io = require('socket.io')(http);

        this.initializeServiceHistory();

        app.set('view engine', 'ejs');
        app.use(express.static('public'));
        app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

        app.get('/', (req, res) => {
            res.render('index', {
                config: this.config,
                serviceHistory: this.serviceHistory,
                title: this.config.System.name,
                description: this.config.System.description
            });
        });

        io.on('connection', (socket) => this.emitStatusUpdate(io));

        // Initial status update
        await this.updateStatuses(io);

        // Full status update interval
        setInterval(() => this.updateStatuses(io), this.config.System.refresh_interval * 120);

        // Real-time ping updates for online services
        setInterval(() => {
            this.config.services.forEach(service => {
                if (this.serviceHistory[service.name].status) {
                    this.updatePingOnly(service, io);
                }
            });
        }, this.pingInterval);

        const PORT = this.config.System.Port || 4000;
        http.listen(PORT, () => {
            console.log("[System]".green, "Server running on port:", `${PORT}`);
        });
    }
}

new StatusMonitor().startServer();