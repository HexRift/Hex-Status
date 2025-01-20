class AdminDashboard {
    constructor() {
        this.socket = io();
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeEventListeners();
            this.initializeSocketEvents();
        });
    }

    initializeEventListeners() {
        const addServiceForm = document.getElementById('addServiceForm');
        const editServiceForm = document.getElementById('editServiceForm');

        if (addServiceForm) {
            addServiceForm.addEventListener('submit', this.handleAddService.bind(this));
        }

        if (editServiceForm) {
            editServiceForm.addEventListener('submit', this.handleEditService.bind(this));
        }
    }

    initializeSocketEvents() {
        this.socket.on('serviceUpdate', this.handleServiceUpdate.bind(this));
        this.socket.on('pingUpdate', this.handlePingUpdate.bind(this));
    }

    async handleAddService(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const serviceData = {
            name: formData.get('name'),
            url: formData.get('url')
        };

        try {
            const response = await fetch('/services/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });

            const data = await response.json();

            if (data.success) {
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

    async handleEditService(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const originalName = formData.get('originalName');

        try {
            const response = await fetch(`/services/${originalName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.get('name'),
                    url: formData.get('url')
                })
            });

            if (response.ok) {
                closeEditModal();
                location.reload();
            }
        } catch (error) {
            console.error('Error updating service:', error);
            this.showNotification('Error updating service', 'error');
        }
    }

    async deleteService(serviceName) {
        if (!confirm(`Are you sure you want to delete ${serviceName}?`)) return;

        try {
            const response = await fetch(`/services/${serviceName}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                location.reload();
            } else {
                this.showNotification('Failed to delete service', 'error');
            }
        } catch (error) {
            console.error('Error deleting service:', error);
            this.showNotification('Error deleting service', 'error');
        }
    }

    handleServiceUpdate(data) {
        const serviceElement = document.querySelector(`[data-service="${data.name}"]`);
        if (!serviceElement) return;

        const statusBadge = serviceElement.querySelector('.status-badge');
        statusBadge.className = `status-badge ${data.status ? 'status-online' : 'status-offline'}`;
        statusBadge.innerHTML = `
            <i class="fas ${data.status ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${data.status ? 'Online' : 'Offline'}
        `;

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
        alert(message);
    }
}

function openEditModal(serviceName, serviceUrl) {
    // First verify the modal exists
    const modal = document.getElementById('editServiceModal');
    if (!modal) {
        console.log('Modal element not found');
        return;
    }

    // Get form elements with error checking
    const nameInput = document.querySelector('#editServiceForm input[name="name"]');
    const urlInput = document.querySelector('#editServiceForm input[name="url"]');
    const originalNameInput = document.querySelector('#editServiceForm input[name="originalName"]');

    // Set values if elements exist
    if (nameInput) nameInput.value = serviceName;
    if (urlInput) urlInput.value = serviceUrl;
    if (originalNameInput) originalNameInput.value = serviceName;

    // Show modal
    modal.style.display = 'block';
}
async function handleEditService(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        url: formData.get('url')
    };

    try {
        const response = await fetch(`/api/services/${formData.get('originalName')}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            window.location.reload();
        } else {
            throw new Error('Failed to update service');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Add event listener to the form

const editServiceForm = document.getElementById('editServiceForm');
if (editServiceForm) {
    editServiceForm.addEventListener('submit', handleEditService);
}


function closeEditModal() {
    const modal = document.getElementById('editServiceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openAddServiceModal() {
    const modal = document.getElementById('addServiceModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal() {
    const modal = document.getElementById('addServiceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            const mobileNav = document.getElementById('mobileNav');
            if (mobileNav) {
                mobileNav.classList.toggle('active');
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-bars');
                    icon.classList.toggle('fa-times');
                }
            }
        });
    }
});


// Menu Toggle Functionality
const menuToggle = document.getElementById('menuToggle');
if (menuToggle) {
    menuToggle.addEventListener('click', function() {
        document.getElementById('mobileNav').classList.toggle('active');
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });
}

const mobileNav = document.getElementById('mobileNav');

if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
        const icon = menuToggle.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        }
    });

    document.addEventListener('click', (event) => {
        if (!mobileNav.contains(event.target) && !menuToggle.contains(event.target)) {
            mobileNav.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            mobileNav.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
}
async function deleteService(serviceName) {
    try {
        const response = await fetch(`/api/services/${serviceName}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            // Refresh the page or update the UI
            window.location.reload();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Initialize dashboard
const adminDashboard = new AdminDashboard();
