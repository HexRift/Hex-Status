class SettingsManager {
    constructor() {
        this.initializeEventListeners();
        this.initializeColorPickers();
    }

    initializeEventListeners() {
        document.getElementById('accountForm')?.addEventListener('submit', this.handleAccountUpdate.bind(this));
        document.getElementById('siteConfigForm')?.addEventListener('submit', this.handleSiteConfigUpdate.bind(this));
    }

    initializeColorPickers() {
        const colorInputs = document.querySelectorAll('.color-input input[type="color"]');
        colorInputs.forEach(input => {
            // Real-time preview
            input.addEventListener('input', (e) => {
                const property = e.target.dataset.property;
                const value = e.target.value;
                if (property) {
                    document.documentElement.style.setProperty(`--${property}`, value);
                    const valueDisplay = e.target.parentElement.querySelector('.color-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = value;
                    }
                }
            });

            // Final color selection
            input.addEventListener('change', (e) => {
                const property = e.target.dataset.property;
                const value = e.target.value;
                if (property) {
                    this.updateThemeConfig({
                        [property]: value
                    });
                }
            });
        });
    }

    async updateThemeConfig(updates) {
        try {
            const response = await fetch('/settings/site', {  // Changed from /settings/theme
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    theme: updates 
                })
            });

            if (response.ok) {
                this.showNotification('Theme updated successfully');
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to update theme', 'error');
            }
        } catch (error) {
            this.showNotification('Error updating theme settings', 'error');
        }
    }

    async handleAccountUpdate(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

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
        
        // Collect all color values from color pickers
        const colorInputs = document.querySelectorAll('.color-input input[type="color"]');
        const themeColors = {};
        
        colorInputs.forEach(input => {
            const property = input.dataset.property;
            themeColors[property] = input.value;
        });
    
        const formData = new FormData(event.target);
        const data = {
            siteName: formData.get('siteName'),
            description: formData.get('description'),
            theme: themeColors
        };
    
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

document.getElementById('menuToggle')?.addEventListener('click', function() {
    document.getElementById('mobileNav').classList.toggle('active');
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

const settingsManager = new SettingsManager();
