const colors = require("colors");

window.hexSocket = window.hexSocket || io({
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
});

function formatUptime(percentage) {
    return percentage.toFixed(2) + '%';
}

function updateOverallStats(data) {
    const totalServices = Object.keys(data.statuses).length;
    let onlineCount = 0;
    let totalUptime = 0;

    Object.entries(data.history).forEach(([name, stats]) => {
        if (stats && typeof stats.uptime !== 'undefined') {
            const uptimePercentage = (stats.uptime / Math.max(stats.checks, 1)) * 100;
            totalUptime += uptimePercentage;
            if (data.statuses[name]) onlineCount++;
        }
    });

    const averageUptime = totalServices > 0 ? totalUptime / totalServices : 0;

    const onlineCountEl = document.getElementById('online-count');
    const overallUptimeEl = document.getElementById('overall-uptime');

    if (onlineCountEl) onlineCountEl.textContent = onlineCount;
    if (overallUptimeEl) overallUptimeEl.textContent = formatUptime(averageUptime);
}

function updateServiceStatus(name, status, history) {
    const safeId = name.replace(/[^a-zA-Z0-9]/g, '-');
    const serviceEl = document.getElementById(`service-${safeId}`);
    if (!serviceEl) return;

    const badge = serviceEl.querySelector('.status-badge');
    const uptimeBar = serviceEl.querySelector('.uptime-fill');

    if (!history[name]) {
        history[name] = { uptime: 0, checks: 0 };
    }

    const uptimePercentage = (history[name].uptime / Math.max(history[name].checks, 1)) * 100;

    if (badge) {
        const statusClass = status === undefined ? 'status-checking' : 
                          status ? 'status-online' : 'status-offline';
        badge.className = `status-badge ${statusClass}`;
        badge.textContent = status === undefined ? 'Checking...' : 
                          status ? 'Online' : 'Offline';
    }

    if (uptimeBar) {
        uptimeBar.style.width = `${uptimePercentage.toFixed(1)}%`;
    }
}

hexSocket.on('connect', () => {
    console.log("[System]".green, "Connected to status server");
});

hexSocket.on('statusUpdate', (data) => {
    if (!data || !data.statuses || !data.history) return;

    // Create a queue for updates to prevent UI blocking
    const updates = Object.entries(data.statuses);
    
    function processNextUpdate() {
        if (updates.length > 0) {
            const [name, status] = updates.shift();
            updateServiceStatus(name, status, data.history);
            requestAnimationFrame(processNextUpdate);
        } else {
            updateOverallStats(data);
        }
    }

    requestAnimationFrame(processNextUpdate);
});

hexSocket.on('disconnect', () => {
    console.log("[System]".red, "Disconnected from status server");
});

hexSocket.on('error', (error) => {
    console.error("[System]".red, "Socket connection error:", error);
});
