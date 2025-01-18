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
        this.socket.on('serviceUpdate', (data) => this.handleServiceUpdate(data));
        this.socket.on('initialState', (data) => this.handleInitialState(data));
        this.socket.on('reconnect', () => this.handleReconnect());
        this.socket.on('pingUpdate', (data) => {
            const pingElement = document.getElementById(`ping-${data.serviceName}`);
            if (pingElement) {
                pingElement.textContent = `${Math.round(data.ping)}ms`;
                pingElement.classList.add('ping-update');
                setTimeout(() => pingElement.classList.remove('ping-update'), 1000);
            }
        });
    }

    async pingIpAndPort(ip, port) {
        return new Promise((resolve) => {
            const start = performance.now();
            const socket = new WebSocket(`ws://${ip}:${port}`);
            socket.onopen = () => {
                const end = performance.now();
                socket.close();
                resolve(end - start);
            };
            socket.onerror = () => resolve(null);
        });
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
        return ms !== null ? `${Math.round(ms)}ms` : 'N/A';
    }

    handleInitialState(services) {
        if (!services || services.length === 0) return;

        services.forEach(async (service) => {
            const ping = await this.pingService(service);
            this.updateServiceDisplay({
                ...service,
                responseTime: ping
            });
        });
        this.updateOverallStats(services);
    }

    async pingService(service) {
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(service.url)) {
            const [ip, port] = service.url.split(':');
            return await this.pingIpAndPort(ip, port || 80);
        }
        return null; // HTTP-based services can use existing logic.
    }

    handleServiceUpdate(data) {
        this.updateServiceDisplay(data);
    }

    updateServiceDisplay(service) {
        const serviceEl = document.getElementById(`service-${service.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!serviceEl) return;

        const uptime = (service.uptime / Math.max(service.checks, 1)) * 100;

        // Update status badge
        const badge = serviceEl.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${service.status ? 'status-online' : 'status-offline'}`;
        }

        // Update metrics
        const uptimeEl = serviceEl.querySelector('.metric-value[id^="uptime-"]');
        if (uptimeEl) {
            uptimeEl.textContent = this.formatUptime(uptime);
        }

        const pingEl = serviceEl.querySelector('.metric-value[id^="ping-"]');
        if (pingEl) {
            pingEl.textContent = this.formatPing(service.responseTime);
        }
    }

    updateOverallStats(services) {
        const stats = {
            totalServices: services.length,
            onlineCount: services.filter(s => s.status).length,
            totalUptime: services.reduce((acc, service) => {
                return acc + ((service.uptime / Math.max(service.checks, 1)) * 100);
            }, 0)
        };

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
}

// Initialize the client
const statusMonitor = new StatusMonitorClient();
