const { EmbedBuilder } = require('discord.js');
const { Service } = require('../models');

async function sendStatusEmbed(interaction, { config, client }) {
    await interaction.deferReply();
    
    const services = await Service.find();
    const onlineServices = services.filter(s => s.status);
    const totalUptime = services.reduce((acc, s) => 
        acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

    const statusEmbed = createStatusEmbed(services, config);
    const reply = await interaction.editReply({ embeds: [statusEmbed] });

    // Set up real-time updates
    const updateInterval = setInterval(async () => {
        const updatedServices = await Service.find();
        const updatedEmbed = createStatusEmbed(updatedServices, config);
        await reply.edit({ embeds: [updatedEmbed] }).catch(() => clearInterval(updateInterval));
    }, config?.System?.refresh_interval || 5000);

    // Clean up interval after 5 minutes
    setTimeout(() => clearInterval(updateInterval), 300000);
}

function createStatusEmbed(services, config) {
    const onlineServices = services.filter(s => s.status);
    const totalUptime = services.reduce((acc, s) => 
        acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

    return new EmbedBuilder()
        .setColor(onlineServices.length === services.length ? '#00ff00' : '#ff0000')
        .setTitle('📊 Service Status Dashboard')
        .setDescription(`System Status: ${onlineServices.length === services.length ? 
            '🟢 All Systems Operational' : '🟡 Partial System Outage'}`)
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
        .setThumbnail(config?.URLs?.thumbnail || null)
        .setTimestamp()
        .setFooter({
            text: `${config?.Site?.footer || 'Hex Status'} • Live Updates`,
            iconURL: config?.URLs?.thumbnail || null
        });
}
module.exports = { sendStatusEmbed };