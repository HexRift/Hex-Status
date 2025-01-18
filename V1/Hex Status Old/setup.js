const {
    execSync
} = require('child_process');
const fs = require('fs');
const authConfig = {
    license: ''
};

// Install essential dependencies first
if (!fs.existsSync('node_modules/colors')) {
    console.log('\nInstalling core dependencies...\n');
    execSync('npm install colors chalk figlet inquirer js-yaml', {
        stdio: 'inherit'
    });
}

const colors = require('colors');

// Then handle remaining dependencies
if (!fs.existsSync('node_modules')) {
    console.log('[Installer]:'.cyan, 'Installing project dependencies...\n');
    execSync('npm install', {
        stdio: 'inherit'
    });
    console.log('[Installer]:'.green, 'Dependencies installed successfully!\n');
}
const inquirer = require('inquirer');
const yaml = require('js-yaml');
const chalk = require('chalk');
const figlet = require('figlet');
const {
    Auth
} = require('./Auth/api');

async function displayWelcome() {
    console.clear();
    console.log('\n');
    console.log(chalk.cyan(figlet.textSync('Hex Status', {
        font: 'ANSI Shadow',
        horizontalLayout: 'full'
    })));
    console.log('\n');
    console.log(chalk.cyan('━'.repeat(70)));
    console.log(chalk.white.bold('                Welcome to Hex Status Configuration Wizard'));
    console.log(chalk.cyan('━'.repeat(70)), '\n');
}

const configSections = {
    license: [{
        type: 'input',
        name: 'license',
        message: chalk.blue('License Key:'),
        default: 'XXX-XXX-XXX-XXX',
        validate: input => input.length > 0
    }, ],
    site: [{
            type: 'input',
            name: 'name',
            message: chalk.blue('Site Name:'),
            default: 'Hex Status'
        },
        {
            type: 'input',
            name: 'description',
            message: chalk.blue('Site Description:'),
            default: 'Real-time Service Status Monitor'
        },
        {
            type: 'input',
            name: 'footer',
            message: chalk.blue('Footer Text:'),
            default: 'Hex Status'
        }
    ],
    system: [{
            type: 'number',
            name: 'Port',
            message: chalk.blue('Port Number:'),
            default: 3000,
            validate: input => input > 0 && input < 65536
        },
        {
            type: 'number',
            name: 'refresh_interval',
            message: chalk.blue('Refresh Interval (ms):'),
            default: 1000,
            validate: input => input >= 1000
        }
    ],
    urls: [{
            type: 'input',
            name: 'github',
            message: chalk.blue('GitHub URL:'),
            default: 'https://hexmodz.com/github'
        },
        {
            type: 'input',
            name: 'thumbnail',
            message: chalk.blue('Thumbnail URL:'),
            default: 'https://hexmodz.com/assets/logo.png',
            validate: input => {
                const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
                return urlPattern.test(input) || 'Please enter a valid URL';
            }
        }
    ],
    theme: [{
            type: 'input',
            name: 'primary',
            message: chalk.blue('Primary Color (hex):'),
            default: '#ff0000',
            validate: input => /^#[0-9A-Fa-f]{6}$/.test(input)
        },
        {
            type: 'input',
            name: 'secondary',
            message: chalk.blue('Secondary Color (hex):'),
            default: '#000000',
            validate: input => /^#[0-9A-Fa-f]{6}$/.test(input)
        },
        {
            type: 'input',
            name: 'accent',
            message: chalk.blue('Accent Color (hex):'),
            default: '#ff3333',
            validate: input => /^#[0-9A-Fa-f]{6}$/.test(input)
        },
        {
            type: 'input',
            name: 'background',
            message: chalk.blue('Background Color (hex):'),
            default: '#1a1a1a',
            validate: input => /^#[0-9A-Fa-f]{6}$/.test(input)
        }
    ]
};

async function setupWizard() {
    try {
        await displayWelcome();

        // Get license key first
        const licenseResponse = await inquirer.prompt([{
            type: 'input',
            name: 'license',
            message: chalk.blue('License Key:'),
            default: 'XXX-XXX-XXX-XXX',
            validate: input => input.length > 0
        }]);

        authConfig.license = licenseResponse.license;

        // Create temporary config file for auth check
        const tempConfig = {
            Auth: authConfig
        };
        fs.writeFileSync('config.yml', yaml.dump(tempConfig));

        // Verify authentication
        console.log("[Auth]:".yellow, `Verifying license...`);
        const isAuthenticated = await Auth();

        if (!isAuthenticated) {
            console.log("[Auth]:".red, `Authentication failed. Please check your license key.`);
            process.exit(1);
        }
        console.log("[Auth]:".green, `License verified successfully!`);

        // Site Configuration
        console.log(chalk.cyan.bold('\nSite Configuration\n'));
        const siteConfig = await inquirer.prompt(configSections.site);

        // System Configuration
        console.log(chalk.cyan.bold('\nSystem Configuration\n'));
        const systemConfig = await inquirer.prompt(configSections.system);

        // URLs Configuration
        console.log(chalk.cyan.bold('\nURL Configuration\n'));
        const urlConfig = await inquirer.prompt(configSections.urls);

        // Theme Configuration
        console.log(chalk.cyan.bold('\nTheme Configuration\n'));
        const themeConfig = await inquirer.prompt(configSections.theme);

        // Critical Services Configuration
        console.log(chalk.cyan.bold('\nCritical Configuration\n'));
        const criticalConfig = await inquirer.prompt([{
                type: 'input',
                name: 'mongoUri',
                message: chalk.blue('MongoDB URI:'),
                validate: input => input.length > 0
            },
            {
                type: 'input',
                name: 'botToken',
                message: chalk.blue('Discord Bot Token:'),
                validate: input => input.length > 0
            }
        ]);

        const config = {
            Auth: authConfig,
            Site: siteConfig,
            URLs: urlConfig,
            System: {
                ...systemConfig,
                version: "10.0.0"
            },
            theme: themeConfig,
            MongoDB: {
                uri: criticalConfig.mongoUri
            },
            Bot: {
                token: criticalConfig.botToken
            }
        };

        console.log(chalk.yellow('\n[System]'), 'Saving configuration...');
        fs.writeFileSync('config.yml', yaml.dump(config));

        console.log(chalk.green('\nConfiguration saved successfully!'));
        console.log(chalk.cyan('\n[System]'), 'Start Hex Status with:', chalk.white('npm start\n'));

    } catch (error) {
        console.log(chalk.red('\n[Error]'), 'Setup failed:', error.message);
        process.exit(1);
    }
}

if (!fs.existsSync('config.yml')) {
    setupWizard();
} else {
    console.log(chalk.red('[System]'), 'Configuration file already exists. Delete config.yml to run setup again.');
}