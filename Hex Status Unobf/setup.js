const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SetupWizard {
    constructor() {
        this.packageJson = this.loadPackageJson();
    }

    loadPackageJson() {
        const packagePath = path.join(process.cwd(), 'package.json');
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }

    async start() {
        console.log('\nInitializing Hex Status installation...\n');
        
        // Install everything from package.json
        await this.installAllDependencies();
        
        // Now we can safely require these packages after installation
        const inquirer = require('inquirer');
        const chalk = require('chalk');
        const figlet = require('figlet');
        const mongoose = require('mongoose');
        const Settings = require('./models/Settings');

        await this.displayWelcome(chalk, figlet);
        await this.runConfigurationWizard(inquirer, chalk, mongoose, Settings);
    }

    async installAllDependencies() {
        console.log('Installing all dependencies from package.json...');
        execSync('npm install', { stdio: 'inherit' });
        console.log('\nAll dependencies installed successfully!\n');
    }

    async displayWelcome(chalk, figlet) {
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

    async runConfigurationWizard(inquirer, chalk, mongoose, Settings) {
        const config = await this.collectConfiguration(inquirer, chalk);
        await this.connectDatabase(config.mongodb.uri, chalk, mongoose);
        await this.saveConfiguration(config, Settings, chalk);
        this.displayCompletionMessage(chalk, inquirer);
    }    

    async collectConfiguration(inquirer, chalk) {
        const config = {
            mongodb: {},
            site: {},
            system: {},
            theme: {},
            bot: {}
        };

        // Database section
        console.log(chalk.cyan.bold('\nDATABASE Configuration\n'));
        const dbConfig = await inquirer.prompt(this.getPromptsBySection('database'));
        config.mongodb.uri = dbConfig.uri;

        // Other sections
        const sections = ['site', 'system', 'theme', 'bot'];
        for (const section of sections) {
            console.log(chalk.cyan.bold(`\n${section.toUpperCase()} Configuration\n`));
            config[section] = await inquirer.prompt(this.getPromptsBySection(section));
        }

        return this.validateConfiguration(config);
    }

    validateConfiguration(config) {
        const requiredFields = {
            'mongodb.uri': 'string',
            'system.port': 'number',
            'bot.token': 'string'
        };

        for (const [field, type] of Object.entries(requiredFields)) {
            const value = field.split('.').reduce((obj, key) => obj[key], config);
            if (!value || typeof value !== type) {
                throw new Error(`Invalid configuration: ${field} must be of type ${type}`);
            }
        }

        return config;
    }

    async connectDatabase(uri, chalk, mongoose) {
        try {
            await mongoose.connect(uri);
            console.log(chalk.green('\nDatabase connection successful!'));
        } catch (error) {
            console.error(chalk.red('\nDatabase connection failed:', error.message));
            process.exit(1);
        }
    }

    async saveConfiguration(config, Settings, chalk) {
        try {
            const settings = new Settings(config);
            await settings.save();
            console.log(chalk.green('\nConfiguration saved successfully!'));
        } catch (error) {
            console.error(chalk.red('\nFailed to save configuration:', error.message));
            process.exit(1);
        }
    }

    async displayCompletionMessage(chalk, inquirer) {
        console.log(chalk.green('\nSetup completed successfully!'));
        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.white('1. Start the server: npm start'));
        console.log(chalk.white('2. Access the dashboard: http://localhost:3000'));
        console.log(chalk.white('3. Configure your services in the admin panel\n'));
    
        const { startNow } = await inquirer.prompt([{
            type: 'confirm',
            name: 'startNow',
            message: 'Would you like to start Hex Status now?',
            default: true
        }]);
    
        if (startNow) {
            console.log(chalk.cyan('\nStarting Hex Status...\n'));
            execSync('npm start', { stdio: 'inherit' });
        } else {
            console.log(chalk.yellow('\nYou can start Hex Status later by running: npm start\n'));
        }
    }
    
    

    getPromptsBySection(section) {
        const prompts = {
            database: [{
                type: 'input',
                name: 'uri',
                message: 'MongoDB URI:',
                default: 'mongodb://localhost:27017/Hex-Status'
            }],
            site: [
                {
                    type: 'input',
                    name: 'name',
                    message: 'Site Name:',
                    default: 'Hex Status'
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Site Description:',
                    default: 'Real-time Service Status Monitor'
                }
            ],
            system: [
                {
                    type: 'number',
                    name: 'port',
                    message: 'Port Number:',
                    default: 3000
                },
                {
                    type: 'number',
                    name: 'refresh_interval',
                    message: 'Refresh Interval (ms):',
                    default: 1000
                }
            ],
            theme: [
                {
                    type: 'input',
                    name: 'primary',
                    message: 'Primary Color:',
                    default: '#ff0000'
                },
                {
                    type: 'input',
                    name: 'background',
                    message: 'Background Color:',
                    default: '#212121'
                }
            ],
            bot: [{
                type: 'input',
                            name: 'token',
                            message: 'Discord Bot Token:',
                            validate: input => {
                                // Discord tokens are typically ~70 characters long and follow a specific format
                                const tokenRegex = /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/;
                                if (!tokenRegex.test(input)) {
                                    return 'Please enter a valid Discord bot token. You can get one from https://discord.com/developers/applications';
                                }
                                return true;
                            }
                        }]
                    };
        return prompts[section] || [];
    }
}

// Initialize and run the setup wizard
new SetupWizard().start();
