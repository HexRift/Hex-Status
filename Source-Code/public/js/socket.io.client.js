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

    handleInitialState(services) {
        if (!services || services.length === 0) return;
        
        services.forEach(service => {
            this.updateServiceDisplay({
                name: service.name,
                status: service.status,
                uptime: service.uptime,
                checks: service.checks,
                responseTime: service.responseTime,
                statusHistory: service.statusHistory
            });
        });
        this.updateOverallStats(services);
    }

    handleServiceUpdate(data) {
        const serviceEl = document.getElementById(`service-${data.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!serviceEl) return;

        // Update status badge
        const badge = serviceEl.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${data.status ? 'status-online' : 'status-offline'}`;
            badge.innerHTML = `<i class="fas ${data.status ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${data.status ? 'Online' : 'Offline'}`;
        }

        // Update ping
        const pingEl = serviceEl.querySelector('.metric-value[id^="ping-"]');
        if (pingEl) {
            pingEl.textContent = this.formatPing(data.responseTime);
            pingEl.classList.add('ping-update');
            setTimeout(() => pingEl.classList.remove('ping-update'), 1000);
        }
    }

    updateServiceDisplay(service) {
        const serviceEl = document.getElementById(`service-${service.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!serviceEl) return;

        const uptime = (service.uptime / Math.max(service.checks, 1)) * 100;
        
        // Update status badge
        const badge = serviceEl.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${service.status ? 'status-online' : 'status-offline'}`;
            badge.innerHTML = `<i class="fas ${service.status ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${service.status ? 'Online' : 'Offline'}`;
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

        // Update status history
        this.updateStatusHistory(serviceEl, service.statusHistory);
    }

    updateStatusHistory(serviceEl, history) {
        const historyBar = serviceEl.querySelector('.downtime-bar');
        if (!historyBar || !history) return;

        historyBar.innerHTML = history
            .map(check => `
                <div class="status-segment ${check.status ? 'status-up' : 'status-down'}"
                     style="width: ${100 / Math.min(20, history.length)}%">
                </div>
            `).join('');
    }

    handleStatusUpdate(data) {
        if (!data?.services) return;

        requestAnimationFrame(() => {
            data.services.forEach(service => {
                this.updateServiceDisplay(service);
            });
            this.updateOverallStats(data.services);
        });
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
