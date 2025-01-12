const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { Service, Admin } = require('../models');

async function handleBotInfoCommand(interaction, { config, client }) {
    const sent = await interaction.deferReply({ fetchReply: true });
    
    const services = await Service.find();
    const admins = await Admin.find();
    
    const memoryUsage = process.memoryUsage();
    const totalMemory = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const usedMemory = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);
    
    const cpuLoad = process.cpuUsage();
    const cpuUsage = ((cpuLoad.user + cpuLoad.system) / 1000000).toFixed(2);
    
    const onlineServices = services.filter(s => s.status);
    const totalChecks = services.reduce((acc, s) => acc + s.checks, 0);
    const avgResponseTime = services.reduce((acc, s) => acc + s.responseTime, 0) / services.length;
    const overallUptime = services.reduce((acc, s) => 
        acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

    const version = config?.System?.version || '8.0.0';
    const footer = config?.Site?.footer || 'Hex Status';
    const thumbnail = config?.URLs?.thumbnail || null;
    const refresh_interval = config?.System?.refresh_interval || 1000;
   // Convert milliseconds to seconds for display
    const refreshRateInSeconds = (config?.System?.refresh_interval || 1000) / 1000;

    const botInfoEmbed = new EmbedBuilder()
        .setTitle(`📊 ${interaction.client.user.username} Statistics`)
        .setColor(config?.theme?.primary || '#007bff')
        .setDescription(`Advanced monitoring system v${version}`)
        .setThumbnail(config.URLs?.thumbnail || null)
        .addFields(
            {
                name: '🤖 Bot Stats',
                value: [
                    `**Status:** ${interaction.client.user.presence.status}`,
                    `**Latency:** ${Math.round(interaction.client.ws.ping)}ms`,
                    `**Uptime:** ${formatUptime(process.uptime())}`,
                    `**Commands:** ${interaction.client.application.commands.cache.size}`
                ].join('\n'),
                inline: true
            },
            {
                name: '💻 System',
                value: [
                    `**CPU Usage:** ${cpuUsage}%`,
                    `**Memory:** ${usedMemory}MB / ${totalMemory}MB (${memoryUsagePercent}%)`,
                    `**Node.js:** ${process.version}`,
                    `**Platform:** ${process.platform} ${process.arch}`
                ].join('\n'),
                inline: true
            },
            {
                name: '📡 Services',
                value: [
                    `**Monitored:** ${services.length}`,
                    `**Online:** ${onlineServices.length}`,
                    `**Total Checks:** ${totalChecks.toLocaleString()}`,
                    `**Avg Response:** ${Math.round(avgResponseTime)}ms`
                ].join('\n'),
                inline: true
            },
                // Performance
                {
                    name: '⚡ Performance',
                    value: [
                        `**Overall Uptime:** ${overallUptime.toFixed(2)}%`,
                        `**Refresh Rate:** ${refreshRateInSeconds}s`,
                        `**Database:** ${mongoose.connection.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected'}`,
                        `**Cache Size:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`
                    ].join('\n'),
                    inline: true
                },
                // Security
                {
                    name: '🔒 Security',
                    value: [
                        `**Admins:** ${admins.length}`,
                        `**Auth Type:** JWT`,
                        `**Session Length:** 7 days`,
                        `**Last Update:** ${new Date().toLocaleDateString()}`
                    ].join('\n'),
                    inline: true
                },
                // Dependencies
                {
                    name: '📚 Dependencies',
                    value: [
                        `**Discord.js:** v14.x`,
                        `**Mongoose:** ${mongoose.version}`,
                        `**Express:** Latest`,
                        `**Socket.IO:** Latest`
                    ].join('\n'),
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({
                text: `${config.Site?.footer || 'Hex Status'} • Version ${config.System?.version || '8.0.0'}`,
                iconURL: config.URLs?.thumbnail || null
            });

    
        await interaction.editReply({ embeds: [botInfoEmbed] });
    }
    
    function formatUptime(uptime) {
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        return `${days}d ${hours}h ${minutes}m`;
    }
    
    module.exports = { handleBotInfoCommand };