const axios = require('axios');
const { Service, StatusMessage } = require('../models');
const { EmbedBuilder } = require('discord.js');
const colors = require('colors');

class MonitoringService {
    static client = null;
    static settings = null;
    static monitoringInterval = null;
    static alertChannels = new Set();

    static initialize(client, settings) {
        this.client = client;
        this.settings = settings;
        this.startMonitoring();
        console.log("[Monitoring]".green, "Service monitoring initialized");
    }

    static startMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(async () => {
            await this.checkAllServices();
        }, this.settings.system.refresh_interval || 2000);
    }

    static async checkAllServices() {
        try {
            const services = await Service.find();
            const results = await Promise.allSettled(
                services.map(service => this.updateServiceStatus(service))
            );

            this.processResults(results, services);
        } catch (error) {
            console.error("[Monitoring]".red, "Error checking services:", error);
        }
    }

    static async checkService(service) {
        const ipPortRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):?(\d+)?$/;
        const match = service.url.match(ipPortRegex);

        return match ? 
            await this.checkIpPort(match[1], parseInt(match[2] || 80)) : 
            await this.checkHttpService(service.url);
    }

    static async checkHttpService(url) {
        const startTime = process.hrtime.bigint();
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                validateStatus: status => (status >= 200 && status < 400) || 
                    [403, 429, 503].includes(status)
            });

            return {
                isUp: true,
                responseTime: this.calculateResponseTime(startTime),
                statusCode: response.status,
                statusText: response.statusText
            };
        } catch (error) {
            return {
                isUp: error.response?.status < 500,
                responseTime: this.calculateResponseTime(startTime),
                statusCode: error.response?.status || 0,
                statusText: error.message
            };
        }
    }

    static async checkIpPort(ip, port) {
        const net = require('net');
        const startTime = process.hrtime.bigint();

        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(5000);

            const cleanup = () => {
                socket.destroy();
                socket.removeAllListeners();
            };

            socket.on('connect', () => {
                cleanup();
                resolve({
                    isUp: true,
                    responseTime: this.calculateResponseTime(startTime),
                    statusCode: 200,
                    statusText: 'Connected'
                });
            });

            socket.on('error', (error) => {
                cleanup();
                resolve({
                    isUp: false,
                    responseTime: this.calculateResponseTime(startTime),
                    statusCode: 0,
                    statusText: error.message
                });
            });

            socket.on('timeout', () => {
                cleanup();
                resolve({
                    isUp: false,
                    responseTime: 5000,
                    statusCode: 0,
                    statusText: 'Connection Timeout'
                });
            });

            socket.connect(port, ip);
        });
    }

    static async updateServiceStatus(service) {
        const result = await this.checkService(service);
        const statusChanged = service.status !== result.isUp;

        const updatedService = await Service.findOneAndUpdate(
            { _id: service._id },
            {
                $set: {
                    status: result.isUp,
                    responseTime: Math.round(result.responseTime),
                    lastCheck: new Date(),
                    statusCode: result.statusCode,
                    statusText: result.statusText
                },
                $inc: {
                    checks: 1,
                    uptime: result.isUp ? 1 : 0
                },
                $push: {
                    statusHistory: {
                        $each: [{
                            status: result.isUp,
                            timestamp: new Date(),
                            responseTime: Math.round(result.responseTime),
                            statusCode: result.statusCode
                        }],
                        $slice: -50
                    }
                }
            },
            { new: true }
        );

        if (statusChanged) {
            await this.sendStatusAlert(updatedService, result);
        }

        return updatedService;
    }

    static calculateResponseTime(startTime) {
        return Number(process.hrtime.bigint() - startTime) / 1e6;
    }

    static async sendStatusAlert(service, result) {
        if (!this.client) return;

        const embed = new EmbedBuilder()
            .setTitle(`Service Status Change: ${service.name}`)
            .setColor(result.isUp ? '#00ff00' : '#ff0000')
            .addFields([
                { name: 'Status', value: result.isUp ? '🟢 Online' : '🔴 Offline', inline: true },
                { name: 'Response Time', value: `${Math.round(result.responseTime)}ms`, inline: true },
                { name: 'Status Code', value: result.statusCode.toString(), inline: true },
                { name: 'URL', value: service.url }
            ])
            .setTimestamp();

        for (const channelId of this.alertChannels) {
            try {
                const channel = await this.client.channels.fetch(channelId);
                await channel.send({ embeds: [embed] });
            } catch (error) {
                console.error("[Monitoring]".red, `Failed to send alert to channel ${channelId}:`, error);
            }
        }
    }

    static processResults(results, services) {
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error("[Monitoring]".red, 
                    `Failed to check service ${services[index].name}:`,
                    result.reason
                );
            }
        });
    }

    static addAlertChannel(channelId) {
        this.alertChannels.add(channelId);
    }

    static removeAlertChannel(channelId) {
        this.alertChannels.delete(channelId);
    }

    static stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
}

module.exports = { MonitoringService };
