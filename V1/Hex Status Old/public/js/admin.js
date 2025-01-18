class AdminDashboard {
    constructor() {
        this.socket = io();
        this.initializeEventListeners();
        this.initializeSocketEvents();
    }

    initializeEventListeners() {
        document.getElementById('addServiceForm')?.addEventListener('submit', this.handleAddService.bind(this));
        document.getElementById('editServiceForm')?.addEventListener('submit', this.handleEditService.bind(this));
    }

    initializeSocketEvents() {
        this.socket.on('serviceUpdate', this.handleServiceUpdate.bind(this));
        this.socket.on('pingUpdate', this.handlePingUpdate.bind(this));
    }

    handleEditService(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const originalName = formData.get('originalName');

        fetch(`/admin/services/${originalName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.get('name'),
                    url: formData.get('url')
                })
            })
            .then(response => {
                if (response.ok) {
                    closeEditModal();
                    location.reload();
                }
            })
            .catch(error => console.error('Error updating service:', error));
    }

    async handleAddService(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const serviceData = {
            name: formData.get('name'),
            url: formData.get('url')
        };

        try {
            const response = await fetch('/admin/services/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });

            const data = await response.json();

            if (data.success) {
                // Emit socket event for real-time update
                this.socket.emit('serviceAdded', serviceData);
                closeModal();
                location.reload();
            } else {
                throw new Error(data.message || 'Failed to add service');
            }
        } catch (error) {
            console.error('Error adding service:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async deleteService(serviceName) {
        if (!confirm(`Are you sure you want to delete ${serviceName}?`)) return;

        try {
            const response = await fetch(`/admin/services/${serviceName}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                location.reload();
            } else {
                this.showNotification('Failed to delete service', 'error');
            }
        } catch (error) {
            this.showNotification('Error deleting service', 'error');
        }
    }

    handleServiceUpdate(data) {
        const serviceElement = document.querySelector(`[data-service="${data.name}"]`);
        if (!serviceElement) return;

        // Update status badge
        const statusBadge = serviceElement.querySelector('.status-badge');
        statusBadge.className = `status-badge ${data.status ? 'status-online' : 'status-offline'}`;
        statusBadge.innerHTML = `
            <i class="fas ${data.status ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${data.status ? 'Online' : 'Offline'}
        `;

        // Update metrics
        const responseTime = serviceElement.querySelector('.metric-value[id^="ping-"]');
        if (responseTime) {
            responseTime.textContent = `${data.responseTime}ms`;
        }
    }

    handlePingUpdate(data) {
        const pingElement = document.getElementById(`ping-${data.serviceName}`);
        if (!pingElement) return;

        pingElement.textContent = `${Math.round(data.ping)}ms`;
        pingElement.classList.add('ping-update');
        setTimeout(() => pingElement.classList.remove('ping-update'), 800);
    }

    showNotification(message, type = 'success') {
        // Implement notification system
        alert(message);
    }
}

// Global modal functions
function openEditModal(serviceName, serviceUrl) {
    const modal = document.getElementById('editServiceModal');
    document.getElementById('editServiceOriginalName').value = serviceName;
    document.getElementById('editServiceName').value = serviceName;
    document.getElementById('editServiceUrl').value = serviceUrl;
    modal.style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editServiceModal').style.display = 'none';
}

// Modal Functions
function openAddServiceModal() {
    document.getElementById('addServiceModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('addServiceModal').style.display = 'none';
}

function deleteService(serviceName) {
    if (confirm(`Are you sure you want to delete ${serviceName}?`)) {
        fetch(`/admin/services/${serviceName}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Refresh the page to show updated service list
                window.location.reload();
            } else {
                alert('Failed to delete service');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to delete service');
        });
    }
}
// Menu Toggle Functionality
document.getElementById('menuToggle').addEventListener('click', function() {
    document.getElementById('mobileNav').classList.toggle('active');
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const mobileNav = document.getElementById('mobileNav');
    const menuToggle = document.getElementById('menuToggle');
    
    if (!mobileNav.contains(event.target) && !menuToggle.contains(event.target)) {
        mobileNav.classList.remove('active');
        menuToggle.querySelector('i').classList.remove('fa-times');
        menuToggle.querySelector('i').classList.add('fa-bars');
    }
});

// Close menu when pressing escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const mobileNav = document.getElementById('mobileNav');
        const menuToggle = document.getElementById('menuToggle');
        mobileNav.classList.remove('active');
        menuToggle.querySelector('i').classList.remove('fa-times');
        menuToggle.querySelector('i').classList.add('fa-bars');
    }
});

// Initialize dashboard
const adminDashboard = new AdminDashboard();