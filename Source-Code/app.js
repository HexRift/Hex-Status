const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const colors = require("colors");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    SlashCommandBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const Chart = require('chart.js');
const canvas = require('canvas');
const path = require('path');
const {
    createCanvas
} = require('canvas');
const ChartJS = require('chart.js/auto');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class EnhancedStatusMonitor {
    constructor() {
        this.config = this.loadConfig();
        this.serviceHistory = new Map();
        this.maxHistoryLength = 20;
        this.cleanupInterval = 1800000;
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.axiosInstance = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'HexStatus/3.0',
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            },
            maxRedirects: 5,
            validateStatus: () => true
        });
    }

    loadConfig() {
        try {
            return yaml.load(fs.readFileSync('config.yml', 'utf8'));
        } catch (error) {
            console.error("[System]".red, "Failed to load config:", error.message);
            process.exit(1);
        }
    }
    async connectDatabase() {
        try {
            await mongoose.connect(this.config.MongoDB.uri);
            console.log("[Database]".green, "Connected to MongoDB");

            // Define Service Model
            this.ServiceModel = mongoose.model('Service', {
                name: String,
                url: String,
                status: Boolean,
                uptime: Number,
                checks: Number,
                lastCheck: Date,
                responseTime: Number,
                statusHistory: [{
                    status: Boolean,
                    timestamp: Date,
                    responseTime: Number
                }]
            });

            // Define Admin Model
            this.AdminModel = mongoose.model('Admin', {
                username: String,
                email: String,
                password: String,
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            });

            await this.migrateServices();
        } catch (error) {
            console.error("[Database]".red, "MongoDB connection failed:", error.message);
            process.exit(1);
        }
    }


    async migrateServices() {
        const existingServices = await this.ServiceModel.find();
        if (existingServices.length === 0 && this.config.services) {
            for (const service of this.config.services) {
                await new this.ServiceModel({
                    name: service.name,
                    url: service.url,
                    status: false,
                    uptime: 0,
                    checks: 0,
                    statusHistory: []
                }).save();
            }
            console.log("[Database]".cyan, "Services migrated to MongoDB");
        }
    }

    async initializeBot() {
        const commands = [
            new SlashCommandBuilder()
            .setName('status')
            .setDescription('Show current status of all services'),
            new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Show statistical graphs of service performance'),
            new SlashCommandBuilder()
            .setName('help')
            .setDescription('Show available commands and their usage')
        ];

        this.client.on('ready', () => {
            console.log("[Bot]".green, `Logged in as ${this.client.user.tag}`);
            this.client.application.commands.set(commands);
        });

        this.client.on('interactionCreate', this.handleCommands.bind(this));
        await this.client.login(this.config.Bot.token);
    }

    async handleCommands(interaction) {
        if (!interaction.isCommand()) return;

        try {
            switch (interaction.commandName) {
                case 'status':
                    await this.sendStatusEmbed(interaction);
                    break;
                case 'stats':
                    await this.handleStatsCommand(interaction);
                    break;
                    const services = await this.ServiceModel.find();
                    const graphBuffer = await this.generateStatsGraph(services);
                    await interaction.editReply({
                        content: '',
                        files: [{
                            attachment: graphBuffer,
                            name: 'stats.png'
                        }]
                    });
                    break;
                case 'help':
                    await this.sendHelpEmbed(interaction);
                    break;
            }
        } catch (error) {
            console.error("[Bot]".red, "Command error:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing the command.',
                    ephemeral: true
                });
            }
        }
    }

    async checkService(service) {
        const startTime = process.hrtime.bigint();
        try {
            const response = await this.axiosInstance.get(service.url, {
                timeout: 5000, // Reduced timeout for faster checks
                validateStatus: (status) => {
                    // Consider all 2xx, 3xx, and specific status codes as "up"
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
            // Check if the error is due to timeout or connection refused
            const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
            return {
                isUp: !isTimeout && error.response?.status < 500,
                responseTime,
                statusCode: error.response?.status || 0
            };
        }
    }
    async handleStatsCommand(interaction) {
        await interaction.deferReply();

        const services = await this.ServiceModel.find();
        const graphBuffer = await this.generateStatsGraph(services);

        const totalChecks = services.reduce((acc, s) => acc + s.checks, 0);
        const avgResponseTime = services.reduce((acc, s) => acc + s.responseTime, 0) / services.length;
        const overallUptime = services.reduce((acc, s) =>
            acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

        const statsEmbed = new EmbedBuilder()
            .setColor(this.config.theme.primary)
            .setTitle('📊 Performance Analytics')
            .setDescription('Detailed performance metrics and response time analysis')
            .setThumbnail(this.config.URLs.thumbnail)
            .addFields({
                name: '📈 System Overview',
                value: [
                    `**Services:** ${services.length}`,
                    `**Total Checks:** ${totalChecks.toLocaleString()}`,
                    `**Average Response:** ${Math.round(avgResponseTime)}ms`,
                    `**Overall Uptime:** ${overallUptime.toFixed(2)}%`
                ].join('\n'),
                inline: false
            }, {
                name: '🔝 Best Performers',
                value: services
                    .sort((a, b) => b.responseTime - a.responseTime)
                    .slice(0, 3)
                    .map(s => `\`${s.name}\` • ${s.responseTime}ms`)
                    .join('\n') || 'No data',
                inline: true
            }, {
                name: '⚡ Response Times',
                value: services
                    .map(s => `\`${s.name}\`: ${s.responseTime}ms`)
                    .join('\n') || 'No data',
                inline: true
            })
            .setImage('attachment://stats.png')
            .setTimestamp()
            .setFooter({
                text: `${this.config.Site.footer} • Updates every ${this.config.System.refresh_interval}s`,
                iconURL: this.config.URLs.thumbnail
            });

        await interaction.editReply({
            embeds: [statsEmbed],
            files: [{
                attachment: graphBuffer,
                name: 'stats.png'
            }]
        });
    }

    async updateServiceStatus(service, io) {
        const result = await this.checkService(service);

        const updatedService = await this.ServiceModel.findOneAndUpdate({
            name: service.name
        }, {
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
                    $slice: -this.maxHistoryLength
                }
            }
        }, {
            new: true
        });

        if (io) {
            io.emit('serviceUpdate', {
                name: service.name,
                status: result.isUp,
                responseTime: Math.round(result.responseTime),
                statusCode: result.statusCode
            });
        }

        return updatedService;
    }

    async sendStatusEmbed(interaction) {
        const services = await this.ServiceModel.find();
        const onlineServices = services.filter(s => s.status);
        const totalUptime = services.reduce((acc, s) => acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

        const statusEmbed = new EmbedBuilder()
            .setColor(onlineServices.length === services.length ? '#00ff00' : '#ff0000')
            .setTitle('📊 Service Status Dashboard')
            .setDescription(`System Status: ${onlineServices.length === services.length ? '🟢 All Systems Operational' : '🟡 Partial System Outage'}`)
            .addFields({
                name: `🟢 Online Services (${onlineServices.length}/${services.length})`,
                value: onlineServices.length ? onlineServices.map(s =>
                    `\`${s.name}\` • ${s.responseTime}ms • ${((s.uptime / Math.max(s.checks, 1)) * 100).toFixed(2)}% uptime`).join('\n') : 'None',
                inline: false
            }, {
                name: `🔴 Offline Services`,
                value: services.filter(s => !s.status).length ?
                    services.filter(s => !s.status)
                    .map(s => `\`${s.name}\` • Last seen: ${new Date(s.lastCheck).toLocaleString()}`).join('\n') : 'None',
                inline: false
            }, {
                name: '📈 System Metrics',
                value: `Overall Uptime: \`${totalUptime.toFixed(2)}%\`\nTotal Checks: \`${services.reduce((acc, s) => acc + s.checks, 0)}\``,
                inline: false
            })
            .setThumbnail(this.config.URLs.thumbnail)
            .setTimestamp()
            .setFooter({
                text: `${this.config.Site.footer} • Refreshes every ${this.config.System.refresh_interval}s`,
                iconURL: this.config.URLs.thumbnail
            });

        await interaction.reply({
            embeds: [statusEmbed]
        });
    }

    async sendHelpEmbed(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setColor(this.config.theme.primary)
            .setTitle('🎮 Command Center')
            .setDescription('Explore the powerful features of Hex Status through these commands:')
            .setThumbnail(this.config.URLs.thumbnail)
            .addFields({
                name: '📊 /status',
                value: 'View real-time status of all monitored services\n• Response times\n• Uptime statistics\n• System health',
                inline: true
            }, {
                name: '📈 /stats',
                value: 'Generate detailed performance graphs\n• Historical data\n• Response time trends\n• Visual analytics',
                inline: true
            }, {
                name: '❓ /help',
                value: 'Display this help menu with detailed command information',
                inline: true
            })
            .setTimestamp()
            .setFooter({
                text: `${this.config.Site.footer} • Version ${this.config.System.version}`,
                iconURL: this.config.URLs.thumbnail
            });

        await interaction.reply({
            embeds: [helpEmbed]
        });
    }

    async addService(interaction) {
        const name = interaction.options.getString('name');
        const url = interaction.options.getString('url');

        const existingService = await this.ServiceModel.findOne({
            name
        });
        if (existingService) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Service Addition Failed')
                .setDescription(`A service named \`${name}\` already exists!`)
                .setTimestamp()
                .setFooter({
                    text: this.config.Site.footer
                });

            return await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        const newService = new this.ServiceModel({
            name,
            url,
            status: false,
            uptime: 0,
            checks: 0,
            lastCheck: new Date(),
            responseTime: 0,
            statusHistory: []
        });

        await newService.save();

        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Service Added Successfully')
            .setDescription(`New service has been configured and is now being monitored.`)
            .addFields({
                name: 'Service Name',
                value: `\`${name}\``,
                inline: true
            }, {
                name: 'URL',
                value: `\`${url}\``,
                inline: true
            }, {
                name: 'Status',
                value: '🔄 Initializing...',
                inline: true
            })
            .setTimestamp()
            .setFooter({
                text: this.config.Site.footer
            });

        await interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    }

    async removeService(interaction) {
        const name = interaction.options.getString('name');
        const service = await this.ServiceModel.findOne({
            name
        });

        if (!service) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Service Removal Failed')
                .setDescription(`Service \`${name}\` was not found.`)
                .setTimestamp()
                .setFooter({
                    text: this.config.Site.footer
                });

            return await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        await this.ServiceModel.deleteOne({
            name
        });

        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Service Removed Successfully')
            .setDescription(`The service has been removed from monitoring.`)
            .addFields({
                name: 'Service Name',
                value: `\`${name}\``,
                inline: true
            }, {
                name: 'Final Status',
                value: service.status ? '🟢 Online' : '🔴 Offline',
                inline: true
            }, {
                name: 'Uptime',
                value: `${((service.uptime / Math.max(service.checks, 1)) * 100).toFixed(2)}%`,
                inline: true
            })
            .setTimestamp()
            .setFooter({
                text: this.config.Site.footer
            });

        await interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    }
    async generateStatsGraph(services) {
        const {
            createCanvas,
            registerFont
        } = require('canvas');
        const {
            Chart,
            registerables
        } = require('chart.js');

        // Register Chart.js components
        Chart.register(...registerables);

        // Register the font (ensure the path to the font file is correct)
        registerFont('./public/fonts/Arial.ttf', {
            family: 'Arial'
        });

        const canvasWidth = 1000;
        const canvasHeight = 500;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = this.config.theme.background || '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const labels = services[0]?.statusHistory.map(h =>
            new Date(h.timestamp).toLocaleTimeString()
        ) || ['No Data'];

        const datasets = services.map(service => ({
            label: service.name,
            data: service.statusHistory.map(h => h.responseTime),
            borderColor: service.color || this.config.theme.primary || '#007bff',
            backgroundColor: `${this.config.theme.accent || '#007bff'}40`,
            borderWidth: 2,
            tension: 0.4,
            fill: true
        }));

        // Create chart
        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Service Response Times',
                        color: '#ffffff',
                        font: {
                            family: 'Arial',
                            size: 20,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                family: 'Arial',
                                size: 14
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: '#ffffff20'
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Arial',
                                size: 14
                            }
                        },
                        title: {
                            display: true,
                            text: 'Response Time (ms)',
                            color: '#ffffff',
                            font: {
                                family: 'Arial',
                                size: 16
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: '#ffffff20'
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Arial',
                                size: 14
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#ffffff',
                            font: {
                                family: 'Arial',
                                size: 16
                            }
                        }
                    }
                }
            }
        });

        return canvas.toBuffer('image/png');
    }


    async startServer() {
        await this.connectDatabase();
        await this.initializeBot();

        const app = express();
        const server = require('http').createServer(app);
        const io = require('socket.io')(server);

        // Middleware
        app.set('view engine', 'ejs');
        app.use(express.static('public'));
        app.use(express.json());
        app.use(cookieParser());

        // Setup routes and real-time updates
        this.setupRoutes(app, io);
        this.setupRealTimeUpdates(io);

        const PORT = this.config.System.Port || 3000;
        server.listen(PORT, () => {
            console.log("[System]".green, "Hex Status:", 'Initialized');
            console.log("[System]".cyan, "Version:", this.config.System.version);
            console.log("[System]".yellow, "Server:", `Running on port ${PORT}`);
        });
    }
    setupRoutes(app, io) {
        app.get('/', async (req, res) => {
            const services = await this.ServiceModel.find();
            const serviceHistory = {};

            services.forEach(service => {
                serviceHistory[service.name] = {
                    status: service.status,
                    uptime: service.uptime,
                    checks: service.checks,
                    responseTime: service.responseTime,
                    statusHistory: service.statusHistory
                };
            });

            res.render('index', {
                config: this.config,
                services: services,
                serviceHistory: serviceHistory,
                title: this.config.Site.name,
                description: this.config.Site.description,
                footer: this.config.Site.footer,
                github: this.config.URLs.github
            });
        });
        const bodyParser = require('body-parser');

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({
            extended: true
        }));
        this.JWT_SECRET = 'C9YN6pQiO@gBTIcc0v2ZkblN^Fw^m68clLjnaOCU5n!g2';
        // Add cookie parser middleware
        app.use(cookieParser());

        // Update the adminAuth middleware
        // Auth Middleware
        const adminAuth = async (req, res, next) => {
            try {
                const token = req.cookies.adminToken;
                if (!token) return res.redirect('/admin/login');

                const decoded = jwt.verify(token, this.JWT_SECRET);
                const admin = await this.AdminModel.findById(decoded.id);
                if (!admin) return res.redirect('/admin/login');

                req.admin = admin;
                next();
            } catch (err) {
                res.redirect('/admin/login');
            }
        };

        // Public Routes
        app.get('/', async (req, res) => {
            const services = await this.ServiceModel.find();
            res.render('index', {
                config: this.config,
                services,
                title: this.config.Site.name,
                description: this.config.Site.description,
                footer: this.config.Site.footer
            });
        });

        // Auth Routes
        app.get('/admin/login', (req, res) => {
            res.render('admin/login', {
                config: this.config
            });
        });

        app.post('/admin/login', async (req, res) => {
            try {
                const {
                    username,
                    password
                } = req.body;
                const admin = await this.AdminModel.findOne({
                    username
                });

                if (!admin || !(await bcrypt.compare(password, admin.password))) {
                    return res.status(401).json({
                        message: 'Invalid credentials'
                    });
                }

                const token = jwt.sign({
                    id: admin._id
                }, this.JWT_SECRET, {
                    expiresIn: '7d'
                });
                res.cookie('adminToken', token, {
                    httpOnly: true
                });
                res.redirect('/admin/dashboard');
            } catch (error) {
                res.status(500).json({
                    message: 'Login failed'
                });
            }
        });

        // Register Routes
        app.get('/admin/register', async (req, res) => {
            // Check if any admin account exists
            const existingAdmin = await this.AdminModel.findOne({});
            if (existingAdmin) {
                res.render('admin/register', {
                    config: this.config,
                    error: 'An admin account already exists. Registration is disabled.',
                    registrationDisabled: true
                });
            } else {
                res.render('admin/register', {
                    config: this.config,
                    error: null,
                    registrationDisabled: false
                });
            }
        });

        app.post('/admin/register', async (req, res) => {
            try {
                // Check if any admin exists
                const existingAdmin = await this.AdminModel.findOne({});
                if (existingAdmin) {
                    return res.status(403).json({
                        message: 'Registration is disabled. An admin account already exists.'
                    });
                }

                const {
                    username,
                    email,
                    password
                } = req.body;
                const hashedPassword = await bcrypt.hash(password, 10);
                const admin = new this.AdminModel({
                    username,
                    email,
                    password: hashedPassword
                });

                await admin.save();
                res.redirect('/admin/login');
            } catch (error) {
                res.status(500).json({
                    message: 'Registration failed'
                });
            }
        });
        // Admin Routes
        app.get('/admin/dashboard', adminAuth, async (req, res) => {
            const services = await this.ServiceModel.find();
            res.render('admin/dashboard', {
                config: this.config,
                services,
                admin: req.admin
            });
        });

        app.get('/admin/services', adminAuth, async (req, res) => {
            const services = await this.ServiceModel.find();
            res.render('admin/services', {
                config: this.config,
                services,
                admin: req.admin
            });
        });

        app.get('/admin/settings', adminAuth, async (req, res) => {
            res.render('admin/settings', {
                config: this.config,
                admin: req.admin
            });
        });

        app.get('/admin/logout', (req, res) => {
            res.clearCookie('adminToken');
            res.redirect('/admin/login');
        });
        

        // API Routes
        app.post('/admin/services/add', adminAuth, async (req, res) => {
            try {
                const {
                    name,
                    url
                } = req.body;
                const newService = new this.ServiceModel({
                    name,
                    url,
                    status: false,
                    uptime: 0,
                    checks: 0,
                    statusHistory: []
                });
                await newService.save();
                res.json({
                    success: true
                });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to add service'
                });
            }
        });

        app.put('/admin/services/:name', adminAuth, async (req, res) => {
            try {
                const {
                    name
                } = req.params;
                const {
                    url
                } = req.body;
                await this.ServiceModel.findOneAndUpdate({
                    name
                }, {
                    url
                });
                res.json({
                    success: true
                });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update service'
                });
            }
        });

        app.delete('/admin/services/:name', adminAuth, async (req, res) => {
            try {
                const {
                    name
                } = req.params;
                await this.ServiceModel.deleteOne({
                    name
                });
                res.json({
                    success: true
                });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to delete service'
                });
            }
        });

        // Settings Routes
        app.post('/admin/settings/account', adminAuth, async (req, res) => {
            try {
                const {
                    username,
                    email,
                    newPassword
                } = req.body;
                const updateData = {
                    username,
                    email
                };

                if (newPassword) {
                    updateData.password = await bcrypt.hash(newPassword, 10);
                }

                await this.AdminModel.findByIdAndUpdate(req.admin._id, updateData);
                res.json({
                    success: true
                });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update account'
                });
            }
        });

        app.post('/admin/settings/site', adminAuth, async (req, res) => {
            try {
                const {
                    siteName,
                    description,
                    themeColor
                } = req.body;
                this.config.Site.name = siteName;
                this.config.Site.description = description;
                this.config.theme.primary = themeColor;

                fs.writeFileSync('config.yml', yaml.dump(this.config));
                res.json({
                    success: true
                });
            } catch (error) {
                res.status(500).json({
                    message: 'Failed to update site settings'
                });
            }
        });
    }
    

    setupRealTimeUpdates(io) {
        setInterval(async () => {
            const services = await this.ServiceModel.find();
            for (const service of services) {
                const result = await this.checkService(service);
                await this.updateServiceStatus(service, io);

                io.emit('pingUpdate', {
                    serviceName: service.name,
                    ping: Math.round(result.responseTime)
                });
            }
        }, 2000);

        io.on('connection', async (socket) => {
            const services = await this.ServiceModel.find();
            socket.emit('initialState', services);
        });
    }
}

new EnhancedStatusMonitor().startServer();
