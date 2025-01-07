const { execSync } = require('child_process');
const fs = require('fs');

// Install colors first
if (!fs.existsSync('node_modules/colors')) {
    console.log('\nInstalling colors package...\n');
    try {
        execSync('npm install colors', { stdio: 'inherit' });
    } catch (error) {
        console.error('Failed to install colors package');
        process.exit(1);
    }
}

// Now we can require and use colors
const colors = require('colors');

// Then install remaining dependencies
if (!fs.existsSync('node_modules')) {
    console.log('[Installer]:'.cyan, 'Installing required dependencies...\n');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('[Installer]:'.green, 'Dependencies installed successfully!\n');
    } catch (error) {
        console.log('[Installer]:'.red, 'Failed to install dependencies. Please run npm install manually.\n');
        process.exit(1);
    }
}

const inquirer = require('inquirer');
const yaml = require('js-yaml');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');

async function displayWelcome() {
    console.clear();
    console.log('\n');
    console.log(chalk.cyan(figlet.textSync('Hex Status', {
        font: 'Big',
        horizontalLayout: 'full'
    })));
    console.log('\n');
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white.bold('                Welcome to Hex Status Wizard'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

async function setupWizard() {
    try {
        await displayWelcome();
        console.log("[Wizard]:".cyan, `Site Configuration\n`);  
        const siteConfig = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: console.log("[System]:".blue, `Site name:`),
                default: 'Hex Status'
            },
            {
                type: 'input',
                name: 'description',
                message: console.log("[System]:".blue, `Site description:`),
                default: 'Check real-time updates on the status of Hex Modz services'
            },
            {
                type: 'input',
                name: 'footer',
                message: console.log("[System]:".blue, `Footer text:`),
                default: 'Hex Modz'
            }
        ]);
        console.log("[Wizard]:".cyan, `System Configuration\n`);  
        const systemConfig = await inquirer.prompt([
            {
                type: 'number',
                name: 'Port',
                message: console.log("[System]:".blue, `Port number:`),
                default: 3000
            },
            {
                type: 'number',
                name: 'refresh_interval',
                message: console.log("[System]:".blue, `Refresh interval (seconds):`),
                default: 120
            }
        ]);
        console.log("[Wizard]:".cyan, `URLs Configurationn\n`); 
        const urlsConfig = await inquirer.prompt([
            {
                type: 'input',
                name: 'github',
                message: console.log("[System]:".blue, `GitHub URL:`),
                default: 'https://hexmodz.com/github'
            },
            {
                type: 'input',
                name: 'webhook_url',
                message: console.log("[System]:".blue, `Discord webhook URL:`),
                default: ''
            },
            {
                type: 'input',
                name: 'thumbnail',
                message: console.log("[System]:".blue, `Thumbnail URL:`),
                default: ''
            }
        ]);
        console.log("[Wizard]:".cyan, `Theme Configuration\n`); 
        const themeConfig = await inquirer.prompt([
            {
                type: 'input',
                name: 'primary',
                message: console.log("[System]:".blue, `Primary color (hex):`),
                default: '#ff0000'
            },
            {
                type: 'input',
                name: 'secondary',
                message: console.log("[System]:".blue, `Secondary color (hex):`),
                default: '#000000'
            },
            {
                type: 'input',
                name: 'accent',
                message: console.log("[System]:".blue, `Accent color (hex):`),
                default: '#ff3333'
            },
            {
                type: 'input',
                name: 'background',
                message: console.log("[System]:".blue, `Background color (hex):`),
                default: '#1a1a1a'
            }
        ]);
        console.log("[Wizard]:".cyan, `Services Configuration\n`); 
        const services = [];
        let addMore = true;

        while (addMore) {
            console.log("[Wizard]:".yellow, `Adding new service...`); 
            const service = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: console.log("[System]:".blue, `Service name:`),
                },
                {
                    type: 'input',
                    name: 'url',
                    message: console.log("[System]:".blue, `Service URL:`),
                },
                {
                    type: 'input',
                    name: 'description',
                    message: console.log("[System]:".blue, `Service description:`),
                }
            ]);

            services.push(service);

            const { continue: shouldContinue } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continue',
                    message: console.log("[System]:".blue, `Add another service?`),
                    default: true
                }
            ]);

            addMore = shouldContinue;
        }

        const config = {
            Site: siteConfig,
            System: {
                ...systemConfig,
                version: "5.2.2"
            },
            URLs: urlsConfig,
            theme: themeConfig,
            services: services
        };

        console.log("[System]:".yellow, `Saving configuration...`); 
        fs.writeFileSync('config.yml', yaml.dump(config));
        console.log("[System]:".green, `Configuration saved successfully!`); 
        console.log("[System]:".green, `Setup complete! Your status page is ready to go.`); 
        console.log("[System]:".cyan, `Start your Hex Status with: npm start\n`); 

    } catch (error) {
        console.log("[System]:".red, `Error during setup:`, error); 
        process.exit(1);
    }
}

if (!fs.existsSync('config.yml')) {
    setupWizard();
} else {
     console.log("[System]:".red, `Configuration file already exists. Delete config.yml to run setup again.`); 
}