const socketIO = require('socket.io');
const { Service } = require('../models');
const { MonitoringService } = require('./MonitoringService');

class WebSocketService {
    static setupWebSocket(server) {
        const io = socketIO(server);

        setInterval(async () => {
            try {
                const services = await Service.find();
                const onlineServices = services.filter(s => s.status);
                const totalUptime = services.reduce((acc, s) => 
                    acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

                io.emit('statusUpdate', {
                    services,
                    stats: {
                        onlineCount: onlineServices.length,
                        totalServices: services.length,
                        overallUptime: totalUptime.toFixed(2)
                    }
                });

                for (const service of services) {
                    const result = await MonitoringService.checkService(service);
                    await MonitoringService.updateServiceStatus(service, io);

                    io.emit('pingUpdate', {
                        serviceName: service.name,
                        ping: Math.round(result.responseTime),
                        uptime: ((service.uptime / Math.max(service.checks, 1)) * 100).toFixed(2),
                        status: service.status
                    });
                }

            } catch (error) {
                console.error("[System]".red, "Real-time update error:", error);
            }
        }, 2000);

        io.on('connection', (socket) => {
            socket.on('initialState', async () => {
                const services = await Service.find();
                socket.emit('initialState', services);
            });
        });

        return io;
    }
}

module.exports = { WebSocketService };
