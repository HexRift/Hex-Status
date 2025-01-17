const { EmbedBuilder } = require('discord.js');
const { Service } = require('../models');
const { generateStatsGraph } = require('../utils/charts');

async function sendStatusEmbed(interaction, { config, client }) {
    await interaction.deferReply();
    
    const services = await Service.find().lean();
    const graphBuffer = await generateStatsGraph(services, config, 'status');
    const statusData = calculateStatusMetrics(services);
    
    const statusEmbed = createEnhancedStatusEmbed(statusData, config);
    const reply = await interaction.editReply({
        embeds: [statusEmbed],
        files: [{ attachment: graphBuffer, name: 'status-graph.png' }]
    });

    let lastGraphUpdate = Date.now();
    const graphUpdateInterval = 60000 + Math.random() * 60000; // Random interval between 1-2 minutes

    const updateInterval = setInterval(async () => {
        try {
            const updatedServices = await Service.find().lean();
            const updatedData = calculateStatusMetrics(updatedServices);
            const updates = {
                embeds: [createEnhancedStatusEmbed(updatedData, config)]
            };

            // Generate new graph every 1-2 minutes
            if (Date.now() - lastGraphUpdate >= graphUpdateInterval) {
                const newGraphBuffer = await generateStatsGraph(updatedServices, config, 'status');
                updates.files = [{ attachment: newGraphBuffer, name: 'status-graph.png' }];
                lastGraphUpdate = Date.now();
            }

            await reply.edit(updates);
        } catch (error) {
            clearInterval(updateInterval);
        }
    }, config?.System?.refresh_interval || 5000);

}function calculateStatusMetrics(services) {
    return {
        onlineServices: services.filter(s => s.status),
        totalServices: services.length,
        avgResponseTime: services.reduce((acc, s) => acc + s.responseTime, 0) / services.length,
        lastHourChecks: services.reduce((acc, s) => acc + (Date.now() - s.lastCheck < 3600000 ? 1 : 0), 0),
        degradedServices: services.filter(s => s.responseTime > 1000).length,
        totalUptime: services.reduce((acc, s) => acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length,
        offlineServices: services.filter(s => !s.status)
    };
}

function createEnhancedStatusEmbed({ onlineServices, totalServices, avgResponseTime, lastHourChecks, degradedServices, totalUptime, offlineServices }, config) {
    const statusColor = getStatusColor(onlineServices.length, totalServices);

    return new EmbedBuilder()
        .setColor(statusColor)
        .setTitle('📊 Live Service Status')
        .setDescription(`${getStatusEmoji(onlineServices.length, totalServices)} **System Status:** ${getStatusMessage(onlineServices.length, totalServices)}`)
        .addFields(
            {
                name: '🟢 Operational Services',
                value: onlineServices.length ? onlineServices.map(s =>
                    `\`${s.name}\` • ${s.responseTime}ms • ${((s.uptime / Math.max(s.checks, 1)) * 100).toFixed(2)}% uptime`).join('\n') : 'None',
                inline: false
            },
            {
                name: '🔴 Service Outages',
                value: offlineServices.length ?
                    offlineServices.map(s => `\`${s.name}\` • Down for: ${getDowntime(s.lastCheck)}`).join('\n') : 'No outages detected',
                inline: false
            },
            {
                name: '📈 Real-Time Metrics',
                value: [
                    `• Response Time: \`${Math.round(avgResponseTime)}ms\``,
                    `• Degraded Services: \`${degradedServices}\``,
                    `• Hourly Checks: \`${lastHourChecks}\``,
                    `• System Uptime: \`${totalUptime.toFixed(2)}%\``
                ].join('\n'),
                inline: false
            }
        )
        .setImage('attachment://status-graph.png')
        .setTimestamp()
        .setFooter({
            text: `${config?.Site?.footer || 'Hex Status'} • Live Updates`,
            iconURL: config?.URLs?.thumbnail || null
        });
}

const getStatusColor = (online, total) => 
    online === total ? '#00ff00' : online === 0 ? '#ff0000' : '#ffaa00';

const getStatusEmoji = (online, total) =>
    online === total ? '🟢' : online === 0 ? '🔴' : '🟡';

const getStatusMessage = (online, total) =>
    online === total ? 'All Systems Operational' :
    online === 0 ? 'Major System Outage' :
    `Partial Outage (${online}/${total} Online)`;

const getDowntime = lastCheck => {
    const minutes = Math.floor((Date.now() - new Date(lastCheck)) / 60000);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};

module.exports = { sendStatusEmbed };