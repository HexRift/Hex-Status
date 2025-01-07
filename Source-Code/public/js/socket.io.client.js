class StatusMonitorClient {
    constructor() {
        this.socket = io({
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            timeout: 15000,
            pingTimeout: 10000,
            pingInterval: 5000
        });
        
        this.retryDelay = 5000;
        this.maxRetries = 5;
        this.retryCount = 0;
        this.initializeSocketListeners();
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => this.handleConnect());
        this.socket.on('disconnect', () => this.handleDisconnect());
        this.socket.on('error', (error) => this.handleError(error));
        this.socket.on('statusUpdate', (data) => this.handleStatusUpdate(data));
        this.socket.on('pingUpdate', (data) => this.handlePingUpdate(data));
        this.socket.on('reconnect', () => this.handleReconnect());
    }

    handleConnect() {
        this.updateConnectionStatus('connected');
        this.retryCount = 0;
    }

    handleDisconnect() {
        this.updateConnectionStatus('disconnected');
        this.handleReconnection();
    }

    handleReconnect() {
        this.updateConnectionStatus('connected');
        this.retryCount = 0;
    }

    handleError(error) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.updateConnectionStatus('warning');
            setTimeout(() => this.socket.connect(), this.retryDelay * this.retryCount);
        }
    }

    handleReconnection() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => {
                if (this.socket.disconnected) {
                    this.socket.connect();
                }
            }, this.retryDelay * this.retryCount);
        }
    }

    updateConnectionStatus(status) {
        const statusIndicator = document.querySelector('.connection-status');
        if (statusIndicator) {
            statusIndicator.className = `connection-status status-${status}`;
        }
    }

    formatUptime(percentage) {
        return `${Number(percentage).toFixed(2)}%`;
    }

    formatPing(ms) {
        return `${Math.round(ms)}ms`;
    }

    updateOverallStats(data) {
        const stats = {
            totalServices: Object.keys(data.statuses).length,
            onlineCount: 0,
            totalUptime: 0
        };

        Object.entries(data.history).forEach(([name, serviceStats]) => {
            if (serviceStats?.uptime !== undefined) {
                const uptimePercentage = (serviceStats.uptime / Math.max(serviceStats.checks, 1)) * 100;
                stats.totalUptime += uptimePercentage;
                if (data.statuses[name]) stats.onlineCount++;
            }
        });

        const averageUptime = stats.totalServices > 0 ? stats.totalUptime / stats.totalServices : 0;

        this.updateElement('online-count', stats.onlineCount);
        this.updateElement('overall-uptime', this.formatUptime(averageUptime));
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element && element.textContent !== value.toString()) {
            element.textContent = value;
            element.classList.add('value-update');
            setTimeout(() => element.classList.remove('value-update'), 1000);
        }
    }

    updateServiceStatus(name, status, history) {
        const safeId = name.replace(/[^a-zA-Z0-9-]/g, '_');
        const serviceEl = document.getElementById(`service-${safeId}`);
        if (!serviceEl) return;

        const elements = {
            badge: serviceEl.querySelector('.status-badge'),
            uptimeValue: document.getElementById(`uptime-${safeId}`),
            pingValue: document.getElementById(`ping-${safeId}`),
            downtimeBar: serviceEl.querySelector('.downtime-bar')
        };

        this.updateStatusBadge(elements.badge, status);
        this.updateServiceMetrics(safeId, history[name], elements);
        this.updateDowntimeBar(elements.downtimeBar, history[name]?.statusHistory || []);
    }

    updateStatusBadge(badge, status) {
        if (!badge) return;
        
        const statusClass = status ? 'status-online' : 'status-offline';
        const statusText = status ? 'Online' : 'Offline';
        const iconClass = status ? 'fa-check-circle' : 'fa-times-circle';

        badge.className = `status-badge ${statusClass}`;
        badge.innerHTML = `<i class="fas ${iconClass}"></i> ${statusText}`;
    }

    updateServiceMetrics(name, stats, elements) {
        if (!stats) return;

        const uptime = (stats.uptime / Math.max(stats.checks, 1)) * 100;
        
        if (elements.uptimeValue) {
            elements.uptimeValue.textContent = this.formatUptime(uptime);
        }
        
        if (elements.pingValue) {
            elements.pingValue.textContent = this.formatPing(stats.responseTime);
        }
    }

    updateDowntimeBar(barElement, history) {
        if (!barElement || !history.length) return;

        barElement.innerHTML = history
            .map(check => `
                <div class="status-segment ${check.status ? 'status-up' : 'status-down'}"
                     style="width: ${100 / Math.min(20, history.length)}%">
                </div>
            `).join('');
    }

    handleStatusUpdate(data) {
        if (!data?.statuses || !data?.history) return;

        requestAnimationFrame(() => {
            this.updateOverallStats(data);
            Object.entries(data.statuses).forEach(([name, status]) => {
                this.updateServiceStatus(name, status, data.history);
            });
        });
    }

    handlePingUpdate(data) {
        const { serviceName, ping } = data;
        this.updateElement(`ping-${serviceName}`, this.formatPing(ping));
    }
}

// Initialize the client
const statusMonitor = new StatusMonitorClient();
