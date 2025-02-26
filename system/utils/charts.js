const { createCanvas, registerFont } = require('canvas');
const { Chart, registerables } = require('chart.js');
const path = require('path');

class ChartGenerator {
    constructor() {
        Chart.register(...registerables);
        this.setupFonts();
        this.defaultConfig = {
            width: 1000,
            height: 500,
            theme: {
                background: '#000000',
                primary: '#007bff',
                accent: '#007bff40',
                text: '#ffffff',
                grid: '#ffffff20'
            }
        };
    }

    setupFonts() {
        const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Arial.ttf');
        registerFont(fontPath, { family: 'Arial' });
    }

    createChartConfig(labels, datasets, config) {
        return {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Service Response Times',
                        color: config.theme.text,
                        font: { family: 'Arial', size: 20, weight: 'bold' }
                    },
                    legend: {
                        labels: {
                            color: config.theme.text,
                            font: { family: 'Arial', size: 14 }
                        }
                    }
                },
                scales: this.createScalesConfig(config)
            }
        };
    }

    createScalesConfig(config) {
        const axisConfig = {
            grid: { color: config.theme.grid },
            ticks: {
                color: config.theme.text,
                font: { family: 'Arial', size: 14 }
            }
        };

        return {
            y: {
                ...axisConfig,
                title: {
                    display: true,
                    text: 'Response Time (ms)',
                    color: config.theme.text,
                    font: { family: 'Arial', size: 16 }
                },
                min: 0,
                suggestedMax: 1000
            },
            x: {
                ...axisConfig,
                title: {
                    display: true,
                    text: 'Time',
                    color: config.theme.text,
                    font: { family: 'Arial', size: 16 }
                }
            }
        };
    }

    processServiceData(services) {
        return {
            labels: services[0]?.statusHistory.map(h => 
                new Date(h.timestamp).toLocaleTimeString()
            ) || ['No Data'],
            datasets: services.map(service => ({
                label: service.name,
                data: service.statusHistory.map(h => h.responseTime),
                borderColor: service.color || this.defaultConfig.theme.primary,
                backgroundColor: service.color ? `${service.color}40` : this.defaultConfig.theme.accent,
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }))
        };
    }

    async generateStatsGraph(services, userConfig = {}) {
        try {
            const config = {
                ...this.defaultConfig,
                ...userConfig,
                theme: { ...this.defaultConfig.theme, ...userConfig.theme }
            };

            const canvas = createCanvas(config.width, config.height);
            const ctx = canvas.getContext('2d');

            // Set background
            ctx.fillStyle = config.theme.background;
            ctx.fillRect(0, 0, config.width, config.height);

            const { labels, datasets } = this.processServiceData(services);
            const chartConfig = this.createChartConfig(labels, datasets, config);

            new Chart(ctx, chartConfig);

            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error("[Charts]".red, "Error generating graph:", error);
            throw new Error(`Failed to generate stats graph: ${error.message}`);
        }
    }
}

module.exports = {
    ChartGenerator: new ChartGenerator(),
    generateStatsGraph: (services, config) => new ChartGenerator().generateStatsGraph(services, config)
};
