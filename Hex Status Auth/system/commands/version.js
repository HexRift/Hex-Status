const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const PRODUCT_ID = "Hex Status";
const currentVersion = "15.0.0";

async function checkVersionCommand(interaction, { settings, client }) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }

    try {
        const response = await axios.get(
            `https://hexarion.net/api/version/${PRODUCT_ID}?current=${currentVersion}`,
            {
                headers: {
                    "x-api-key": "8IOLaAYzGJNwcYb@bm1&WOcr%aK5!O",
                }
            }
        );

        const versionData = response.data;
        
        const versionEmbed = new EmbedBuilder()
            .setColor(settings.theme?.primary || '#007bff')
            .setTitle(`🚀 ${client.user.username} Version Info`)
            .setThumbnail(settings.urls?.thumbnail || null)
            .addFields({
                name: '📊 Version Information',
                value: [
                    `**Current Version:** ${currentVersion}`,
                    `**Latest Version:** v${versionData?.version || '15.0.0'}`,
                    `**Status:** ${versionData?.same ? '✅ Up to date' : '⚠️ Update required'}`
                ].join('\n'),
                inline: false
            })
            .setTimestamp()
            .setFooter({
                text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '15.0.0'}`,
                iconURL: settings.urls.thumbnail || null
            });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const changelogButton = new ButtonBuilder()
            .setCustomId('view_changelog')
            .setLabel('View Changelog')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(changelogButton);
        await interaction.editReply({ embeds: [versionEmbed], components: [row] });

        const filter = i => i.customId === 'view_changelog' && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const changelogEmbed = createChangelogEmbed(client, settings, versionData);
            await i.reply({ embeds: [changelogEmbed], ephemeral: true });
        });
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`❌ ${client.user.username} Version Check Failed`)
            .setThumbnail(settings.urls?.thumbnail || null)
            .setDescription(`Error: ${error.response?.data?.error || error.message}`)
            .setTimestamp()
            .setFooter({
                text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '15.0.0'}`,
                iconURL: settings.urls.thumbnail || null
            });

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

function createChangelogEmbed(client, settings, versionData) {
    const changelogEmbed = new EmbedBuilder()
        .setTitle(`🚀 ${client.user.username} Changelog Info`)
        .setThumbnail(settings.urls?.thumbnail || null)
        .setColor(settings.theme?.primary || '#007bff')
        .setTimestamp()
        .setFooter({
            text: `${settings.site.footer || 'Hex Status'} • Version ${settings.site.version || '15.0.0'}`,
            iconURL: settings.urls.thumbnail || null
        });

    if (versionData?.changelog) {
        const sections = versionData.changelog.split('##').filter(Boolean);
        for (const section of sections) {
            const [title, ...content] = section.split('\r\n');
            changelogEmbed.addFields({
                name: `📝 ${title.trim()}`,
                value: content.join('\n') || 'No details available',
                inline: false
            });
        }
    }

    return changelogEmbed;
}

module.exports = { checkVersionCommand };