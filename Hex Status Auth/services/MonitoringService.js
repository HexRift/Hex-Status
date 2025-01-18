const axios = require('axios');
const { Service, StatusMessage } = require('../models');
const { EmbedBuilder } = require('discord.js');

class MonitoringService {
    static initialize(client, settings) {
        this.client = client;
        this.settings = settings;
        
        // Start monitoring interval using settings.system.refresh_interval
        setInterval(async () => {
            const services = await Service.find();
            for (const service of services) {
                await this.updateServiceStatus(service);
            }
        }, this.settings.system.refresh_interval || 2000);
        
        console.log("[Monitoring]".green, "Service monitoring initialized");
    }

    static async checkService(service) {
        const ipPortRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):?(\d+)?$/;
        const match = service.url.match(ipPortRegex);

        if (match) {
            const [, ip, port = 80] = match;
            return await this.checkIpPort(ip, parseInt(port));
        }

        // Existing HTTP check code remains the same
        const startTime = process.hrtime.bigint();
        try {
            const response = await axios.get(service.url, {
                timeout: 5000,
                validateStatus: (status) => {
                    return (status >= 200 && status < 400) ||
                        status === 403 ||
                        status === 429 ||
                        status === 503;
                }
            });

            const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;
            return {
                isUp: true,
                responseTime,
                statusCode: response.status
            };
        } catch (error) {
            const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;
            const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
            return {
                isUp: !isTimeout && error.response?.status < 500,
                responseTime,
                statusCode: error.response?.status || 0
            };
        }
    }

    static async updateServiceStatus(service) {
        const result = await this.checkService(service);
        return await Service.findOneAndUpdate(
            { name: service.name },
            {
                $set: {
                    status: result.isUp,
                    responseTime: Math.round(result.responseTime),
                    lastCheck: new Date()
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
                            responseTime: Math.round(result.responseTime)
                        }],
                        $slice: -20
                    }
                }
            },
            { new: true }
        );
    }

static async checkIpPort(ip, port) {
    const net = require('net');
    return new Promise((resolve) => {
        const startTime = process.hrtime.bigint();
        const socket = new net.Socket();
        
        socket.setTimeout(5000);
        
        socket.on('connect', () => {
            const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;
            socket.destroy();
            resolve({ isUp: true, responseTime });
        });

        socket.on('error', () => {
            const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;
            resolve({ isUp: false, responseTime });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ isUp: false, responseTime: 5000 });
        });

        socket.connect(port, ip);
    });
}
}

module.exports = { MonitoringService };