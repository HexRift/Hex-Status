const { EmbedBuilder } = require('discord.js');
const { Service } = require('../models');
const { generateStatsGraph } = require('../utils/charts');

async function handleStatsCommand(interaction, { config, client }) {
    await interaction.deferReply();

    const services = await Service.find();
    const graphBuffer = await generateStatsGraph(services, config);

    const totalChecks = services.reduce((acc, s) => acc + s.checks, 0);
    const avgResponseTime = services.reduce((acc, s) => acc + s.responseTime, 0) / services.length;
    const overallUptime = services.reduce((acc, s) =>
        acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length;

    const statsEmbed = new EmbedBuilder()
        .setColor(config?.theme?.primary || '#007bff')
        .setTitle(`📊 ${interaction.client.user.username} Performance Analytics`)
        .setDescription('Detailed performance metrics and response time analysis')
        .setThumbnail(config.URLs?.thumbnail || null)
        .addFields({
            name: '📈 System Overview',
            value: [
                `**Services:** ${services.length}`,
                `**Total Checks:** ${totalChecks.toLocaleString()}`,
                `**Average Response:** ${Math.round(avgResponseTime)}ms`,
                `**Overall Uptime:** ${overallUptime.toFixed(2)}%`
            ].join('\n'),
            inline: true
        })
        .setImage('attachment://stats.png')
        .setTimestamp()
        .setFooter({
            text: `${config?.Site?.footer || 'Hex Status'} • Updates every ${config?.System?.refresh_interval || 1000}s`,
            iconURL: config?.URLs?.thumbnail || null
        });

    await interaction.editReply({
        embeds: [statsEmbed],
        files: [{ attachment: graphBuffer, name: 'stats.png' }]
    });
}

module.exports = { handleStatsCommand };