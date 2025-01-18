const {
    execSync
} = require('child_process');
const fs = require('fs');
const authConfig = {
    license: ''
};

// Install essential dependencies if needed
if (!fs.existsSync('node_modules/colors')) {
    console.log('\nInstalling core dependencies...\n');
    execSync('npm install colors chalk figlet inquirer mongoose', {
        stdio: 'inherit'
    });
}

// Handle remaining dependencies
if (!fs.existsSync('node_modules')) {
    console.log('[Installer]:'.cyan, 'Installing project dependencies...\n');
    execSync('npm install', {
        stdio: 'inherit'
    });
    console.log('[Installer]:'.green, 'Dependencies installed successfully!\n');
}

const inquirer = require('inquirer');
const mongoose = require('mongoose');
const chalk = require('chalk');
const figlet = require('figlet');
const colors = require('colors');
const Settings = require('./models/Settings');

const {
    Auth
} = require('./Auth/api');

const License = require('./models/License');


async function connectToDatabase(uri) {
    try {
        await mongoose.connect(uri);
        console.log(chalk.green('[Database]'), 'Connected successfully');
    } catch (error) {
        console.log(chalk.red('[Database]'), 'Connection failed:', error.message);
        process.exit(1);
    }
}

async function saveSettings(config) {
    try {
        const settings = new Settings(config);
        await settings.save();
        console.log(chalk.green('[Database]'), 'Settings saved successfully');
    } catch (error) {
        console.log(chalk.red('[Database]'), 'Failed to save settings:', error.message);
        process.exit(1);
    }
}

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
        },
        {
            type: 'input',
            name: 'JWT_SECRET',
            message: chalk.blue('JWT Secret (or press enter for default):'),
            default: '4Od!MwUh3lbU7kTJPqeocffWbtM75#1e01#6xS5y75ICk5^dKMefV5kmuvMj5FJ!^@n97A4Mcu9c@HDc'
        }
    ],
    urls: [{

        type: 'input',
        name: 'thumbnail',
        message: chalk.blue('Thumbnail URL:'),
        default: 'https://hexarion.net/assets/logo.png',
        validate: input => {
            const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
            return urlPattern.test(input) || 'Please enter a valid URL';
        }
    }],
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

        // Database Configuration First
        console.log(chalk.cyan.bold('\nDatabase Configuration\n'));
        const dbConfig = await inquirer.prompt([{
            type: 'input',
            name: 'mongoUri',
            message: chalk.blue('MongoDB URI:'),
            default: 'mongodb://localhost:27017/Hex-Status',
            validate: input => input.length > 0
        }]);

        // Connect to MongoDB immediately
        await connectToDatabase(dbConfig.mongoUri);

        // After database connection
        console.log('[Database]'.green, 'Testing connection...');
        const testLicense = new License({ key: 'test' });
        await testLicense.save();
        const found = await License.findOne({ key: 'test' });
        console.log('[Database]'.green, 'Test document:', found);
        await License.deleteOne({ key: 'test' });

        // Get license key and verify
        console.log(chalk.cyan.bold('\nLicense Configuration\n'));
        const licenseResponse = await inquirer.prompt([{
            type: 'input',
            name: 'license',
            message: chalk.blue('License Key:'),
            validate: input => input.length > 0
        }]);

        authConfig.license = licenseResponse.license;
          // Save license to database first
          try {
              const license = new License({
                  key: licenseResponse.license
              });
              const savedLicense = await license.save();
              console.log('[Database]'.green, 'License saved successfully:', savedLicense.key);
            
              // Verify it was saved
              const checkLicense = await License.findOne().sort({ _id: -1 });
              console.log('[Database]'.green, 'License verification:', checkLicense.key);
          } catch (error) {
              console.log('[Database]'.red, 'Failed to save license:', error.message);
              process.exit(1);
          }
        // Verify authentication using saved license
        console.log("[Auth]:".yellow, `Verifying license...`);
        const isAuthenticated = await Auth();

        if (!isAuthenticated) {
            console.log("[Auth]:".red, `Authentication failed. Please check your license key.`);
            process.exit(1);
        }
        console.log("[Auth]:".green, `License verified successfully!`);

        // Continue with remaining configuration...
        console.log(chalk.cyan.bold('\nSite Configuration\n'));
        const siteConfig = await inquirer.prompt(configSections.site);

        console.log(chalk.cyan.bold('\nSystem Configuration\n'));
        const systemConfig = await inquirer.prompt(configSections.system);

        console.log(chalk.cyan.bold('\nURL Configuration\n'));
        const urlConfig = await inquirer.prompt(configSections.urls);

        console.log(chalk.cyan.bold('\nTheme Configuration\n'));
        const themeConfig = await inquirer.prompt(configSections.theme);

        console.log(chalk.cyan.bold('\nBot Configuration\n'));
        const botConfig = await inquirer.prompt([{
            type: 'input',
            name: 'token',
            message: chalk.blue('Discord Bot Token:'),
            validate: input => input.length > 0
        }]);

        const config = {
            site: siteConfig,
            urls: urlConfig,
            system: {
                ...systemConfig,
                version: "11.0.0"
            },
            theme: themeConfig,
            mongodb: {
                uri: dbConfig.mongoUri
            },
            bot: {
                token: botConfig.token
            },
            Auth: {
                license: licenseResponse.license // Add this line
            }
        };

        await saveSettings(config);

        console.log(chalk.green('\nSetup completed successfully!'));
        console.log(chalk.cyan('\n[System]'), 'Start Hex Status with:', chalk.white('npm start\n'));

    } catch (error) {
        console.log(chalk.red('\n[Error]'), 'Setup failed:', error.message);
        process.exit(1);
    }
}

// Start setup directly
setupWizard();