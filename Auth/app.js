const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const ping = require('node-ping');
const axios = require('axios');
const colors = require("colors");
const { Auth } = require("./Auth");
const { WebhookClient } = require('discord.js');
const messageIdFile = 'messageId.json';

// Enhanced authentication with retry logic
async function authenticate(retries = 3) {
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
}

// Utility to save the last message ID to a file
function saveMessageId(messageId) {
    fs.writeFileSync(messageIdFile, JSON.stringify({ messageId }));
}

// Utility to load the last message ID from a file
function loadMessageId() {
    if (fs.existsSync(messageIdFile)) {
        const data = fs.readFileSync(messageIdFile, 'utf8');
        try {
            return JSON.parse(data).messageId;
        } catch {
            return null;
        }
    }
    return null;
}


// Start the server after authentication is successful
async function startServer() {
    const authenticated = await authenticate();
    
    if (authenticated) {
         const config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
            const app = express();
            const http = require('http').Server(app);
            const io = require('socket.io')(http);
            const path = require('path');
        
            const webhook = new WebhookClient({ url: config.System.webhook_url });
        
            // Load the last sent message ID
            let lastMessageId = loadMessageId();
        
            const serviceHistory = {};
        
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
                res.render('index', {
                    config,
                    serviceHistory,
                    title: config.System.name,
                    description: config.System.description
                });
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
                } catch {
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
                const onlineServices = services.filter(service => serviceHistory[service.name].status);
                const offlineServices = services.filter(service => !serviceHistory[service.name].status);
            
                const fields = [
                    {
                        name: "🟢 Online Services",
                        value: onlineServices.length > 0 
                            ? onlineServices.map(service => 
                                `**${service.name}**\nPing: ${serviceHistory[service.name].responseTime} ms\nUptime: ${(
                                    (serviceHistory[service.name].uptime / serviceHistory[service.name].checks) * 100
                                ).toFixed(2)}%\n`).join("\n") 
                            : "No services are online.",
                        inline: true
                    },
                    {
                        name: "🔴 Offline Services",
                        value: offlineServices.length > 0 
                            ? offlineServices.map(service => 
                                `**${service.name}**\nLast Checked: ${new Date(serviceHistory[service.name].lastCheck).toLocaleString()}\n`).join("\n")
                            : "No services are offline.",
                        inline: true
                    }
                ];
            
                const onlineCount = onlineServices.length;
                const totalServices = services.length;
            
                const embed = {
                    title: '📊 Service Status Update',
                    description: `**${onlineCount}/${totalServices}** services are currently online.`,
                    color: onlineCount === totalServices ? 0x00ff00 : 0xff0000,
                    timestamp: new Date(),
                    thumbnail: {
                        url: config.System.thumbnail_url || 'https://hexmodz.com/Logo-t1.png'
                    },
                    fields: fields,
                    footer: {
                        iconURL: config.System.thumbnail_url || 'https://hexmodz.com/Logo-t1.png',
                        text: config.System.footer || '© 2024 - 2025 Hex Modz',
                    }
                };
            
                try {
                    if (lastMessageId) {
                        await webhook.editMessage(lastMessageId, { embeds: [embed] });
                    } else {
                        const sentMessage = await webhook.send({ embeds: [embed] });
                        lastMessageId = sentMessage.id;
                        saveMessageId(lastMessageId);
                    }
                } catch (error) {
                    console.log("[System]".red, "Failed to send or edit Discord notification:", error.message);
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
                        console.error("[System]".red, "Error checking service:", `${service.name}:`, error);
                        statuses[service.name] = false;
                    }
                });
        
                await Promise.all(servicePromises);
        
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
        
            updateStatuses();
            setInterval(async () => {
                await updateStatuses();
                await sendStatusWebhook(config.services, serviceHistory);
            }, config.System.refresh_interval * 120);
        
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
        
            const PORT = config.System.Port || 4000;
            http.listen(PORT, () => {
                console.log("[System]".green, "Server running on port:", `${PORT}`);
            });
        }
    }    
startServer();