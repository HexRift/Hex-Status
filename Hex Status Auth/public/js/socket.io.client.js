class StatusMonitorClient {
    constructor() {
        this.socket = io();
        this.retryDelay = 5000;
        this.maxRetries = 5;
        this.retryCount = 0;
        this.services = [];
        this.initializeSocketListeners();
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => this.handleConnect());
        this.socket.on('disconnect', () => this.handleDisconnect());
        this.socket.on('error', (error) => this.handleError(error));
        this.socket.on('serviceUpdate', (data) => this.handleServiceUpdate(data));
        this.socket.on('reconnect', () => this.handleReconnect());
        
        // Add this new handler for initial state
        this.socket.on('initialState', (data) => {
            this.services = data;
            this.updateOverallStats();
        });

        // Update the statusUpdate handler
        this.socket.on('statusUpdate', (data) => {
            if (!data || !data.serviceName) return;
            
            // Update the service in our local array
            const serviceIndex = this.services.findIndex(s => s.name === data.serviceName);
            if (serviceIndex !== -1) {
                this.services[serviceIndex] = {...this.services[serviceIndex], ...data};
            }

            const serviceElement = document.getElementById(`service-${data.serviceName.replace(/[^a-zA-Z0-9]/g, '_')}`);
            if (serviceElement) {
                const statusBadge = serviceElement.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.className = `status-badge ${data.status ? 'status-online' : 'status-offline'}`;
                    statusBadge.textContent = data.status ? 'Online' : 'Offline';
                }
            }
            
            // Update overall stats after each status update
            this.updateOverallStats();
        });

        // Fixed ping update handler
        this.socket.on('pingUpdate', (data) => {
            const pingElement = document.getElementById(`ping-${data.serviceName}`);
            if (pingElement) {
                pingElement.textContent = `${Math.round(data.ping)}ms`;
                pingElement.classList.add('ping-update');
                setTimeout(() => pingElement.classList.remove('ping-update'), 3000);
            }
        });
    }

    updateDowntimeBar(downtimeBar, statusHistory) {
        downtimeBar.innerHTML = '';
        statusHistory.forEach(check => {
            const segment = document.createElement('div');
            segment.className = `status-segment ${check.status ? 'status-up' : 'status-down'}`;
            segment.style.width = `${100 / Math.min(20, statusHistory.length)}%`;
            downtimeBar.appendChild(segment);
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
        console.error('Socket error:', error);
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

    handleServiceUpdate(data) {
        this.updateServiceDisplay(data);
    }

    updateServiceDisplay(service) {
        const serviceEl = document.getElementById(`service-${service.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!serviceEl) return;

        const uptime = (service.uptime / Math.max(service.checks, 1)) * 100;
        
        const badge = serviceEl.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${service.status ? 'status-online' : 'status-offline'}`;
            badge.textContent = service.status ? 'Online' : 'Offline';
        }

        const uptimeEl = serviceEl.querySelector(`#uptime-${service.name}`);
        if (uptimeEl) {
            uptimeEl.textContent = `${uptime.toFixed(2)}%`;
        }

        const pingEl = serviceEl.querySelector(`#ping-${service.name}`);
        if (pingEl) {
            pingEl.textContent = `${Math.round(service.responseTime || 0)}ms`;
        }
    }

    updateOverallStats() {
        const onlineCount = this.services.filter(s => s.status).length;
        const totalUptime = this.services.reduce((acc, service) => {
            const uptime = (service.uptime / Math.max(service.checks, 1)) * 100;
            return acc + uptime;
        }, 0);
        
        const averageUptime = this.services.length > 0 ? totalUptime / this.services.length : 0;

        // Update UI elements with animation
        this.updateElement('overall-uptime', `${averageUptime.toFixed(2)}%`);
        this.updateElement('online-count', onlineCount);
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
