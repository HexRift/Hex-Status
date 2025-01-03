const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const ping = require('node-ping');
const axios = require('axios');
const colors = require("colors");
const { WebhookClient } = require('discord.js');

// Start the server after authentication is successful
async function startServer() {
        // Load config
        const config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
        const app = express();
        const http = require('http').Server(app);
        const io = require('socket.io')(http);
        const path = require('path');

        const webhook = new WebhookClient({ url: config.System.webhook_url });

        // Store service status history
        const serviceHistory = {};

        // Initialize service history
        function initializeServiceHistory() {
            config.services.forEach(service => {
                serviceHistory[service.name] = {
                    status: false,
                    uptime: 0,
                    checks: 0,
                    lastCheck: null,
                    responseTime: 0
                };
            });
        }

        initializeServiceHistory();

        app.set('view engine', 'ejs');
        app.use(express.static('public'));
        app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

        app.get('/', (req, res) => {
            res.render('index', { config, serviceHistory, title: config.System.name, description: config.System.description });
        });

        async function checkService(service) {
            const startTime = Date.now();

            try {
                if (service.type === 'http') {
                    const response = await axios.get(service.url, {
                        timeout: 5000,
                        validateStatus: false,
                        httpsAgent: new require('https').Agent({
                            rejectUnauthorized: false
                        })
                    });
                    return {
                        isUp: response.status === 200,
                        responseTime: Date.now() - startTime
                    };
                }

                if (service.type === 'tcp') {
                    const result = await ping.promise.probe(service.host, {
                        port: service.port,
                        timeout: 5
                    });
                    return {
                        isUp: result.alive,
                        responseTime: Date.now() - startTime
                    };
                }
            } catch (error) {
                return {
                    isUp: false,
                    responseTime: Date.now() - startTime
                };
            }

            return {
                isUp: false,
                responseTime: 0
            };
        }

        async function sendStatusWebhook(services, serviceHistory) {
            const fields = services.map(service => ({
                name: service.name,
                value: serviceHistory[service.name].status ? '🟢 Online' : '🔴 Offline',
                inline: false
            }));

            const onlineCount = Object.values(serviceHistory).filter(s => s.status).length;
            const totalServices = services.length;

            const embed = {
                title: '📊 Service Status Update',
                description: `**${onlineCount}/${totalServices}** services online`,
                color: onlineCount === totalServices ? 0x00ff00 : 0xff0000,
                timestamp: new Date(),
                thumbnail: {
                    url: config.System.thumbnail_url || 'https://hexmodz.com/Logo-t1.png'
                },
                fields: fields,
                footer: {
                    iconURL: config.System.thumbnail_url,
                    text: config.System.footer,
                }
            };

            try {
                await webhook.send({ embeds: [embed] });
            } catch (error) {
                console.log("[WEBHOOK]".red, "Failed to send Discord notification:", error.message);
            }
        }

        async function updateStatuses() {
            const statuses = {};
            const allServiceData = [];
            let statusChanged = false;

            const servicePromises = config.services.map(async (service) => {
                try {
                    const { isUp, responseTime } = await checkService(service);

                    if (!serviceHistory[service.name]) {
                        serviceHistory[service.name] = {
                            status: false,
                            uptime: 0,
                            checks: 0,
                            lastCheck: null,
                            responseTime: 0
                        };
                    }

                    if (serviceHistory[service.name].status !== isUp) {
                        statusChanged = true;
                    }

                    serviceHistory[service.name].checks++;
                    serviceHistory[service.name].lastCheck = new Date();
                    serviceHistory[service.name].responseTime = responseTime;
                    serviceHistory[service.name].status = isUp;

                    if (isUp) {
                        serviceHistory[service.name].uptime++;
                    }

                    statuses[service.name] = isUp;

                    const currentUptime = (serviceHistory[service.name].uptime / serviceHistory[service.name].checks) * 100;
                    allServiceData.push({
                        name: service.name,
                        status: isUp,
                        uptimePercentage: currentUptime
                    });
                } catch (error) {
                    console.error(`Error checking service ${service.name}:`, error);
                    statuses[service.name] = false;
                }
            });

            await Promise.all(servicePromises);

            // Send single webhook if any status changed
            if (statusChanged) {
                await sendStatusWebhook(config.services, serviceHistory);
            }

            const currentOnlineServices = Object.values(statuses).filter(status => status).length;
            const currentOverallUptime = allServiceData.length > 0 
                ? allServiceData.reduce((acc, data) => acc + data.uptimePercentage, 0) / allServiceData.length 
                : 0;

            io.emit('statusUpdate', {
                statuses,
                history: serviceHistory,
                stats: {
                    totalServices: config.services.length,
                    onlineServices: currentOnlineServices,
                    overallUptime: currentOverallUptime
                }
            });
        }
        // Initial check
        updateStatuses();

        // Schedule regular updates
        setInterval(updateStatuses, config.System.refresh_interval * 1000);

        // Socket connection handling
        io.on('connection', (socket) => {
            socket.emit('statusUpdate', {
                statuses: Object.fromEntries(
                    Object.entries(serviceHistory).map(([name, data]) => [name, data.status])
                ),
                history: serviceHistory,
                stats: {
                    totalServices: config.services.length,
                    onlineServices: Object.values(serviceHistory).filter(s => s.status).length,
                    overallUptime: Object.values(serviceHistory).reduce((acc, service) => {
                        return acc + (service.uptime / Math.max(service.checks, 1) * 100);
                    }, 0) / config.services.length
                }
            });
        });

        const PORT = config.System.PORT || 3000;
        http.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }

startServer();