const { createCanvas, registerFont } = require('canvas');
const { Chart, registerables } = require('chart.js');

async function generateStatsGraph(services, config) {
    const { createCanvas, registerFont } = require('canvas');
    const { Chart, registerables } = require('chart.js');

    Chart.register(...registerables);
    registerFont('./public/fonts/Arial.ttf', { family: 'Arial' });

    const canvasWidth = 1000;
    const canvasHeight = 500;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Use optional chaining and default values for config
    ctx.fillStyle = config?.theme?.background || '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const labels = services[0]?.statusHistory.map(h =>
        new Date(h.timestamp).toLocaleTimeString()
    ) || ['No Data'];

    const datasets = services.map(service => ({
        label: service.name,
        data: service.statusHistory.map(h => h.responseTime),
        borderColor: service.color || config?.theme?.primary || '#007bff',
        backgroundColor: `${config?.theme?.accent || '#007bff'}40`,
        borderWidth: 2,
        tension: 0.4,
        fill: true
    }));

    // Create chart with all configurations
    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Service Response Times',
                    color: '#ffffff',
                    font: { family: 'Arial', size: 20, weight: 'bold' }
                },
                legend: {
                    labels: {
                        color: '#ffffff',
                        font: { family: 'Arial', size: 14 }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: '#ffffff20' },
                    ticks: {
                        color: '#ffffff',
                        font: { family: 'Arial', size: 14 }
                    },
                    title: {
                        display: true,
                        text: 'Response Time (ms)',
                        color: '#ffffff',
                        font: { family: 'Arial', size: 16 }
                    }
                },
                x: {
                    grid: { color: '#ffffff20' },
                    ticks: {
                        color: '#ffffff',
                        font: { family: 'Arial', size: 14 }
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#ffffff',
                        font: { family: 'Arial', size: 16 }
                    }
                }
            }
        }
    });

    return canvas.toBuffer('image/png');
}

module.exports = { generateStatsGraph };