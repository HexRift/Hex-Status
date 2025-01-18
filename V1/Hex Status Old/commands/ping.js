const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { Service } = require('../models');

async function handlePingCommand(interaction, { config, client }) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;

    const dbPingStart = Date.now();
    await Service.findOne();
    const dbPing = Date.now() - dbPingStart;

    const services = await Service.find();
    const avgResponseTime = services.reduce((acc, s) => acc + s.responseTime, 0) / services.length;

    const load = process.cpuUsage();
    const cpuLoad = ((load.user + load.system) / 1000000).toFixed(2);

    const pingEmbed = new EmbedBuilder()
        .setTitle(`🏓 ${client.user.username} Ping Statistics`)
        .setColor(determineLatencyColor(roundTripLatency))
        .setDescription(`Detailed latency and performance metrics`)
        .setThumbnail(config.URLs?.thumbnail || null)
        .addFields({
            name: '🤖 Bot Latency',
            value: `Round-trip: \`${roundTripLatency}ms\`\nWebSocket: \`${client.ws.ping}ms\``,
            inline: true
        }, {
            name: '📡 API Status',
            value: `Discord API: \`${Math.round(client.ws.ping)}ms\`\nREST: \`${roundTripLatency - client.ws.ping}ms\``,
            inline: true
        }, {
            name: '💾 Database',
            value: `Query Time: \`${dbPing}ms\`\nConnection: \`${mongoose.connection.readyState === 1 ? '🟢' : '🔴'}\``,
            inline: true
        }, {
            name: '🔄 Services',
            value: `Average Response: \`${Math.round(avgResponseTime)}ms\`\nMonitored: \`${services.length}\``,
            inline: true
        }, {
            name: '⚡ System',
            value: `CPU Load: \`${cpuLoad}%\`\nUptime: \`${formatUptime(process.uptime())}\``,
            inline: true
        })
        .setTimestamp()
        .setFooter({ 
            text: `${config.Site.footer} • Refreshed`,
            iconURL: config.URLs?.thumbnail || null 
        });

    await interaction.editReply({ embeds: [pingEmbed] });
}

function determineLatencyColor(ping) {
    if (ping < 100) return '#00ff00';
    if (ping < 200) return '#ffff00';
    return '#ff0000';
}

function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor(uptime / 3600) % 24;
    const minutes = Math.floor(uptime / 60) % 60;
    return `${days}d ${hours}h ${minutes}m`;
}

module.exports = { handlePingCommand };
