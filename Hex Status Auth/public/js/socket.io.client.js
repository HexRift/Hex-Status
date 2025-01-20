class StatusMonitorClient {
    constructor() {
        this.socket = io({
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });
        this.retryDelay = 5000;
        this.maxRetries = 5;
        this.retryCount = 0;
        this.services = [];
        this.stats = {
            lastUpdate: Date.now(),
            messageCount: 0,
            connectionUptime: 0
        };
        this.connectionStartTime = Date.now();
        
        this.initializeSocketListeners();
        this.setupPerformanceMonitoring();
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => this.handleConnect());
        this.socket.on('disconnect', () => this.handleDisconnect());
        this.socket.on('error', (error) => this.handleError(error));
        this.socket.on('serviceUpdate', (data) => this.handleServiceUpdate(data));
        this.socket.on('reconnect', () => this.handleReconnect());
        this.socket.on('initialState', (data) => this.handleInitialState(data));
        this.socket.on('statusUpdate', (data) => this.handleStatusUpdate(data));
        this.socket.on('pingUpdate', (data) => this.handlePingUpdate(data));
        this.socket.on('heartbeat', () => this.handleHeartbeat());
    }

    setupPerformanceMonitoring() {
        setInterval(() => {
            this.stats.connectionUptime = (Date.now() - this.connectionStartTime) / 1000;
            this.updatePerformanceMetrics();
        }, 1000);
    }

    handleConnect() {
        this.updateConnectionStatus('connected');
        this.retryCount = 0;
        this.connectionStartTime = Date.now();
        this.triggerVisualFeedback('connection-success');
    }

    handleDisconnect() {
        this.updateConnectionStatus('disconnected');
        this.handleReconnection();
        this.triggerVisualFeedback('connection-lost');
    }

    handleReconnect() {
        this.updateConnectionStatus('connected');
        this.retryCount = 0;
        this.requestInitialState();
        this.triggerVisualFeedback('connection-restored');
    }

    handleError(error) {
        console.error('Socket error:', error);
        this.updateConnectionStatus('error');
        this.handleReconnection();
        this.triggerVisualFeedback('connection-error');
    }

    handleInitialState(data) {
        this.services = data.services;
        this.updateOverallStats();
        this.renderServiceList();
        this.stats.messageCount++;
    }

    handleStatusUpdate(data) {
        if (!data || !data.serviceName) return;
        
        this.updateServiceData(data);
        this.updateServiceDisplay(data);
        this.updateOverallStats();
        this.stats.messageCount++;
    }

    handlePingUpdate(data) {
        const pingElement = document.getElementById(`ping-${data.serviceName}`);
        if (pingElement) {
            this.animateValue(pingElement, data.ping);
            this.updatePingTrend(data);
        }
    }

    handleHeartbeat() {
        this.stats.lastUpdate = Date.now();
        this.updateConnectionStatus('active');
    }

    updateServiceData(data) {
        const serviceIndex = this.services.findIndex(s => s.name === data.serviceName);
        if (serviceIndex !== -1) {
            this.services[serviceIndex] = {...this.services[serviceIndex], ...data};
        }
    }

    updateServiceDisplay(service) {
        const serviceEl = document.getElementById(`service-${service.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!serviceEl) return;

        this.updateStatusBadge(serviceEl, service);
        this.updateUptimeDisplay(serviceEl, service);
        this.updateResponseTime(serviceEl, service);
        this.updateStatusHistory(serviceEl, service);
    }

    updateStatusBadge(element, service) {
        const badge = element.querySelector('.status-badge');
        if (badge) {
            const newStatus = service.status ? 'status-online' : 'status-offline';
            if (!badge.classList.contains(newStatus)) {
                badge.className = `status-badge ${newStatus}`;
                badge.textContent = service.status ? 'Online' : 'Offline';
                this.triggerVisualFeedback(newStatus);
            }
        }
    }

    updateUptimeDisplay(element, service) {
        const uptimeEl = element.querySelector(`#uptime-${service.name}`);
        if (uptimeEl) {
            const uptime = ((service.uptime / Math.max(service.checks, 1)) * 100).toFixed(2);
            this.animateValue(uptimeEl, uptime, '%');
        }
    }

    updateResponseTime(element, service) {
        const pingEl = element.querySelector(`#ping-${service.name}`);
        if (pingEl) {
            this.animateValue(pingEl, Math.round(service.responseTime), 'ms');
        }
    }

    updateStatusHistory(element, service) {
        const historyEl = element.querySelector('.status-history');
        if (historyEl && service.statusHistory) {
            this.renderStatusHistory(historyEl, service.statusHistory);
        }
    }

    animateValue(element, value, suffix = '') {
        const current = parseFloat(element.textContent);
        const target = parseFloat(value);
        
        if (current === target) return;

        element.classList.add('value-update');
        element.textContent = `${value}${suffix}`;
        
        setTimeout(() => element.classList.remove('value-update'), 1000);
    }

    updateOverallStats() {
        const onlineCount = this.services.filter(s => s.status).length;
        const totalUptime = this.services.reduce((acc, service) => {
            return acc + ((service.uptime / Math.max(service.checks, 1)) * 100);
        }, 0);
        
        const averageUptime = this.services.length > 0 ? 
            (totalUptime / this.services.length).toFixed(2) : '0.00';

        this.updateStatDisplay('overall-uptime', averageUptime, '%');
        this.updateStatDisplay('online-count', onlineCount);
        this.updateStatDisplay('total-services', this.services.length);
    }

    updateStatDisplay(id, value, suffix = '') {
        const element = document.getElementById(id);
        if (element) {
            this.animateValue(element, value, suffix);
        }
    }

    triggerVisualFeedback(type) {
        const feedbackEl = document.createElement('div');
        feedbackEl.className = `visual-feedback ${type}`;
        document.body.appendChild(feedbackEl);
        
        setTimeout(() => feedbackEl.remove(), 1000);
    }

    updatePerformanceMetrics() {
        const metrics = {
            messageRate: this.stats.messageCount,
            uptime: this.stats.connectionUptime.toFixed(0),
            lastUpdate: new Date(this.stats.lastUpdate).toLocaleTimeString()
        };

        Object.entries(metrics).forEach(([key, value]) => {
            const element = document.getElementById(`metric-${key}`);
            if (element) element.textContent = value;
        });
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

    requestInitialState() {
        this.socket.emit('initialState');
    }

    renderServiceList() {
        const servicesList = document.querySelector('.services-list');
        if (!servicesList) return;
    
        servicesList.innerHTML = this.services.map(service => `
            <div class="service-item" id="service-${service.name.replace(/[^a-zA-Z0-9]/g, '_')}">
                <div class="service-header">
                    <div class="service-info">
                        <h2>${service.name}</h2>
                    </div>
                    <div class="service-metrics">
                        <div class="metric">
                            <i class="fas fa-tachometer-alt metric-icon"></i>
                            <span class="metric-label">Ping</span>
                            <span class="metric-value" id="ping-${service.name}">
                                ${service.responseTime}ms
                            </span>
                        </div>
                        <div class="metric">
                            <i class="fas fa-clock metric-icon"></i>
                            <span class="metric-label">Uptime</span>
                            <span class="metric-value" id="uptime-${service.name}">
                                ${((service.uptime / Math.max(service.checks, 1)) * 100).toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <div class="status-badge ${service.status ? 'status-online' : 'status-offline'}">
                        ${service.status ? 'Online' : 'Offline'}
                    </div>
                </div>
                <div class="downtime-bar">
                    ${service.statusHistory.map(check => `
                        <div class="status-segment ${check.status ? 'status-up' : 'status-down'}"
                            style="width: ${100 / Math.min(20, service.statusHistory.length)}%">
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }


}
// Initialize the client
const statusMonitor = new StatusMonitorClient();
