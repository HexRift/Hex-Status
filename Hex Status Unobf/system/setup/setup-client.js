let currentStep = 1;
const totalSteps = 5;

// Update progress bar
function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById('setupProgress').style.width = `${progress}%`;
}

// Show/hide steps
function showStep(step) {
    document.querySelectorAll('.setup-step').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step${step}`).classList.remove('hidden');
    
    // Update buttons
    document.getElementById('prevBtn').disabled = step === 1;
    document.getElementById('nextBtn').textContent = step === totalSteps ? 'Finish' : 'Next';
    
    updateProgress();
}

function showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

async function validateStep(step) {
    switch(step) {
        case 1: // Database
            return await validateDatabase();
        case 2: // Site Settings
            return validateSiteSettings();
        case 3: // Theme
            return validateTheme();
        case 4: // Bot
            return validateBot();
        case 5: // Admin
            return validateAdmin();
        default:
            return true;
    }
}

async function validateDatabase() {
    const mongoUri = document.getElementById('mongoUri').value;
    try {
        const response = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uri: mongoUri })
        });
        const data = await response.json();
        if (!data.success) {
            showNotification(data.error);
            return false;
        }
        return true;
    } catch (err) {
        showNotification('Database connection failed: ' + err.message);
        return false;
    }
}

function validateSiteSettings() {
    const siteName = document.getElementById('siteName').value;
    const sitePort = document.getElementById('sitePort').value;
    const refreshInterval = document.getElementById('refresh_interval').value;

    if (!siteName) {
        showNotification('Site name is required');
        return false;
    }
    if (sitePort < 1 || sitePort > 65535) {
        showNotification('Port must be between 1 and 65535');
        return false;
    }
    if (refreshInterval < 1000) {
        showNotification('Refresh interval must be at least 1000ms');
        return false;
    }
    return true;
}

function validateTheme() {
    const colorInputs = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor'];
    for (const input of colorInputs) {
        const value = document.getElementById(input).value;
        if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
            showNotification(`Invalid ${input.replace('Color', '')} color format`);
            return false;
        }
    }
    return true;
}

function validateBot() {
    const botToken = document.getElementById('botToken').value;
    if (!/[\w-]{24}\.[\w-]{6}\.[\w-]{27}/.test(botToken)) {
        showNotification('Invalid Discord bot token format');
        return false;
    }
    return true;
}

function validateAdmin() {
    const username = document.getElementById('adminUsername').value;
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminPasswordConfirm').value;

    if (username.length < 3) {
        showNotification('Username must be at least 3 characters');
        return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Invalid email format');
        return false;
    }
    if (password.length < 8) {
        showNotification('Password must be at least 8 characters');
        return false;
    }
    if (password !== confirmPassword) {
        showNotification('Passwords do not match');
        return false;
    }
    return true;
}

async function nextStep() {
    if (await validateStep(currentStep)) {
        if (currentStep === totalSteps) {
            await saveConfiguration();
        } else {
            currentStep++;
            showStep(currentStep);
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

async function saveConfiguration() {
    const config = {
        mongodb: {
            uri: document.getElementById('mongoUri').value
        },
        site: {
            name: document.getElementById('siteName').value,
            description: document.getElementById('siteDescription').value,
            footer: document.getElementById('siteFooter').value
        },
        system: {
            port: parseInt(document.getElementById('sitePort').value),
            refresh_interval: parseInt(document.getElementById('refresh_interval').value),
            JWT_SECRET: document.getElementById('JWT_SECRET').value
        },
        theme: {
            primary: document.getElementById('primaryColor').value,
            secondary: document.getElementById('secondaryColor').value,
            accent: document.getElementById('accentColor').value,
            background: document.getElementById('backgroundColor').value
        },
        bot: {
            token: document.getElementById('botToken').value,
            status: document.getElementById('botStatus').value
        },
        admin: {
            username: document.getElementById('adminUsername').value,
            email: document.getElementById('adminEmail').value,
            password: document.getElementById('adminPassword').value
        }
    };

    try {
        const response = await fetch('/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const data = await response.json();
        if (data.success) {
            showNotification('Setup completed successfully!', 'success');
            window.location.href = '/dashboard';
        } else {
            showNotification(data.error);
        }
    } catch (err) {
        showNotification('Failed to save configuration: ' + err.message);
    }
}

function updateThemePreview() {
    const preview = document.getElementById('themePreview');
    preview.style.backgroundColor = document.getElementById('backgroundColor').value;
    preview.style.color = document.getElementById('primaryColor').value;
    preview.style.borderColor = document.getElementById('accentColor').value;
}

// Initialize setup
document.addEventListener('DOMContentLoaded', () => {
    showStep(1);
    updateThemePreview();
});
// Add this function to the existing setup-client.js
async function testConnection() {
    const mongoUri = document.getElementById('mongoUri').value;
    
    if (!mongoUri) {
        showNotification('Please enter a MongoDB URI');
        return;
    }

    try {
        const response = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uri: mongoUri })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Database connection successful!', 'success');
        } else {
            showNotification(data.error);
        }
    } catch (err) {
        showNotification('Failed to connect to database: ' + err.message);
    }
}
