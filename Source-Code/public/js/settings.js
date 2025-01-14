class SettingsManager {
    constructor() {
        this.initializeEventListeners();
        this.initializeColorPickers();
    }

    initializeEventListeners() {
        document.getElementById('accountForm')?.addEventListener('submit', this.handleAccountUpdate.bind(this));
        document.getElementById('siteConfigForm')?.addEventListener('submit', this.handleSiteConfigUpdate.bind(this));

        // Real-time theme preview
        const colorPicker = document.querySelector('input[name="themeColor"]');
        if (colorPicker) {
            colorPicker.addEventListener('input', this.handleThemePreview.bind(this));
        }
    }

    initializeColorPickers() {
        const colorInputs = document.querySelectorAll('input[type="color"]');
        colorInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const property = e.target.dataset.property;
                if (property) {
                    document.documentElement.style.setProperty(`--${property}`, e.target.value);
                }
            });
        });
    }

    async handleAccountUpdate(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        // Only include password if it's not empty
        if (!data.newPassword) {
            delete data.newPassword;
        }

        try {
            const response = await fetch('/settings/account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification('Account settings updated successfully');
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to update account settings', 'error');
            }
        } catch (error) {
            this.showNotification('Error updating account settings', 'error');
        }
    }

    async handleSiteConfigUpdate(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/settings/site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification('Site configuration updated successfully');
                setTimeout(() => location.reload(), 1000);
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to update site configuration', 'error');
            }
        } catch (error) {
            this.showNotification('Error updating site configuration', 'error');
        }
    }

    handleThemePreview(event) {
        const color = event.target.value;
        document.documentElement.style.setProperty('--primary', color);
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

document.getElementById('menuToggle').addEventListener('click', function() {
    document.getElementById('mobileNav').classList.toggle('active');
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

const settingsManager = new SettingsManager();