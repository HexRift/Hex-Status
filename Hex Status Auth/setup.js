const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");


class SetupWizard {
  constructor() {
    this.packageJson = this.loadPackageJson();
    this.mongoose = null;
  }

  loadPackageJson() {
    const packagePath = path.join(process.cwd(), "package.json");
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  }

  async start() {
    console.log("\nInitializing Hex Status installation...\n");

    await this.installAllDependencies();

    const inquirer = require("inquirer");
    const chalk = require("chalk");
    const figlet = require("figlet");
    const mongoose = require("mongoose");
    const Settings = require("./system/models/Settings");
    const yaml = require('js-yaml');
    const fs = require('fs');

    await this.displayWelcome(chalk, figlet);

    // Get MongoDB URI first
    const { uri } = await inquirer.prompt([{
      type: 'input',
      name: 'uri',
      message: 'Enter MongoDB URI:',
      default: 'mongodb://localhost:27017/Hex-Status'
    }]);

    // Connect to MongoDB
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    this.mongoose = mongoose;

  // License verification
  console.log(chalk.cyan.bold('\nLICENSE Configuration\n'));
  let isValidLicense = false;

  while (!isValidLicense) {
      const licenseResponse = await inquirer.prompt([{
          type: 'input',
          name: 'key',
          message: 'License Key:',
          validate: async (input) => {
              if (!input) return 'License key is required';
            
              try {
                  // Save to config.yml temporarily
                  const config = { auth: { license_key: input } };
                  fs.writeFileSync('license.yml', yaml.dump(config));
                
                  const { Auth } = require('./system/services/auth');
                  const authResult = await Auth();
                
                  if (authResult) {
                      isValidLicense = true;
                      return true;
                  }
                
                  // Remove invalid key by writing empty license
                  fs.writeFileSync('license.yml', yaml.dump({ auth: { license_key: '' } }));
                  return 'Invalid license key. Please check your key and try again.';
              } catch (error) {
                  // Clean up on error
                  fs.writeFileSync('license.yml', yaml.dump({ auth: { license_key: '' } }));
                  return 'Failed to verify license key. Please check your internet connection.';
              }
          }
      }]);
  }

    // Installation type selection
    const { installationType } = await inquirer.prompt([{
      type: 'list',
      name: 'installationType',
      message: 'Select installation type:',
      choices: [
        { name: 'Fresh Install (Wipes database and starts fresh)', value: 'fresh' },
        { name: 'Upgrade (Preserves existing data and adds missing fields)', value: 'upgrade' }
      ]
    }]);
    if (installationType === 'fresh') {
        await mongoose.connection.dropDatabase();

        // Re-prompt for license key after database wipe
        console.log(chalk.cyan.bold('\nLICENSE Configuration\n'));

        const licenseResponse = await inquirer.prompt({
            type: 'input',
            name: 'key',
            message: 'License Key:',
            validate: async function(input) {
                if (!input) return 'License key is required';
                
                try {
                    const License = require('./system/models/License');
                    await License.create({ key: input });
                    
                    const { Auth } = require('./system/services/auth');
                    const authResult = await Auth();
                    
                    if (authResult) {
                        return true;
                    }
                    
                    await License.deleteOne({ key: input });
                    return 'Invalid license key. Please check your key and try again.';
                } catch (error) {
                    if (mongoose.connection.readyState === 1) {
                        const License = require('./system/models/License');
                        await License.deleteOne({ key: input });
                    }
                    return 'Failed to verify license key. Please check your internet connection.';
                }
            }
        });

        await this.runConfigurationWizard(inquirer, chalk, mongoose, Settings);
    } else {
        const existingSettings = await Settings.findOne({});
        const missingConfig = this.identifyMissingFields(existingSettings);
        await this.runUpgradeWizard(inquirer, chalk, mongoose, Settings, missingConfig);
    }  }

  async identifyMissingFields(existingSettings) {
    const requiredFields = {
      mongodb: ['uri'],
      site: ['name', 'description', 'footer'],
      system: ['port', 'refresh_interval', 'JWT_SECRET'],
      theme: ['primary', 'secondary', 'accent', 'background'],
      bot: ['token', 'status']
    };

    const missingFields = {};

    for (const [section, fields] of Object.entries(requiredFields)) {
      missingFields[section] = fields.filter(field => 
        !existingSettings?.[section]?.[field]
      );
    }

    return missingFields;
  }

  async runUpgradeWizard(inquirer, chalk, mongoose, Settings, missingConfig) {
    const config = {};
  
    for (const [section, fields] of Object.entries(missingConfig)) {
      if (fields.length > 0) {
        console.log(chalk.red.bold(`\nUpdating ${section.toUpperCase()} Configuration\n`));
        const prompts = this.getPromptsBySection(section).filter(prompt => 
          fields.includes(prompt.name)
        );
        config[section] = await inquirer.prompt(prompts);
      }
    }

    // Update existing settings with new values
    await Settings.findOneAndUpdate({}, { $set: config }, { upsert: true });
    console.log(chalk.green('\nConfiguration updated successfully!'));
  }

  async installAllDependencies() {
    console.log("Installing all dependencies from package.json...");
    execSync("npm install", { stdio: "inherit" });
    console.log("\nAll dependencies installed successfully!\n");
  }

  async displayWelcome(chalk, figlet) {
    console.clear();
    console.log("\n");
    console.log(
      chalk.red(
        figlet.textSync("Hex Status", {
          font: "ANSI Shadow",
          horizontalLayout: "full",
        })
      )
    );
    console.log("\n");
    console.log(chalk.red("━".repeat(70)));
    console.log(
      chalk.white.bold(
        "                Welcome to Hex Status Configuration Wizard"
      )
    );
    console.log(chalk.red("━".repeat(70)), "\n");
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
      bot: {},
    };

    // Database section
    console.log(chalk.red.bold("\nDATABASE Configuration\n"));
    const dbConfig = await inquirer.prompt(
      this.getPromptsBySection("database")
    );
    config.mongodb.uri = dbConfig.uri;

    // Other sections
    const sections = ["site", "system", "theme", "bot"];
    for (const section of sections) {
      console.log(
        chalk.red.bold(`\n${section.toUpperCase()} Configuration\n`)
      );
      config[section] = await inquirer.prompt(
        this.getPromptsBySection(section)
      );
    }

    return this.validateConfiguration(config);
  }

  validateConfiguration(config) {
    const requiredFields = {
      "mongodb.uri": "string",
      "system.port": "number",
      "bot.token": "string",
    };

    for (const [field, type] of Object.entries(requiredFields)) {
      const value = field.split(".").reduce((obj, key) => obj[key], config);
      if (!value || typeof value !== type) {
        throw new Error(
          `Invalid configuration: ${field} must be of type ${type}`
        );
      }
    }

    return config;
  }

  async connectDatabase(uri, chalk, mongoose) {
    try {
      await mongoose.connect(uri);
      console.log(chalk.green("\nDatabase connection successful!"));
    } catch (error) {
      console.error(chalk.red("\nDatabase connection failed:", error.message));
      process.exit(1);
    }
  }

  async saveConfiguration(config, Settings, chalk) {
    try {
      const settings = new Settings(config);
      await settings.save();
      console.log(chalk.green("\nConfiguration saved successfully!"));
    } catch (error) {
      console.error(
        chalk.red("\nFailed to save configuration:", error.message)
      );
      process.exit(1);
    }
  }

async displayCompletionMessage(chalk, inquirer) {
  console.log(chalk.green("\nSetup completed successfully!"));
  console.log(chalk.red("\nNext steps:"));
  console.log(chalk.white("1. Start the server: npm start"));
  console.log(chalk.white("2. Access the dashboard: http://localhost:3000"));
  console.log(chalk.white("3. Configure your services in the admin panel\n"));

  const { startNow } = await inquirer.prompt([
      {
          type: "confirm",
          name: "startNow",
          message: "Would you like to start Hex Status now?",
          default: true,
      },
  ]);

  if (startNow) {
      console.log(chalk.red("\nStarting Hex Status...\n"));
      try {
          process.chdir(process.cwd());
          require('./app.js');
      } catch (error) {
          console.log(chalk.yellow("\nPlease start Hex Status manually by running: npm start\n"));
          process.exit(0);
      }
  } else {
      console.log(chalk.yellow("\nYou can start Hex Status later by running: npm start\n"));
  }
}
  getPromptsBySection(section) {
    const prompts = {
      database: [
        {
          type: "input",
          name: "uri",
          message: "MongoDB URI:",
          default: "mongodb://localhost:27017/Hex-Status",
        },
      ],
      site: [
        {
          type: "input",
          name: "name",
          message: "Site Name:",
          default: "Hex Status",
        },
        {
          type: "input",
          name: "description",
          message: "Site Description:",
          default: "Real-time Service Status Monitor",
        },
        {
          type: "input",
          name: "footer",
          message: "Footer Text:",
          default: "Hex Status",
        },
      ],
      system: [
        {
          type: "number",
          name: "port",
          message: "Port Number:",
          default: 3000,
        },
        {
          type: "number",
          name: "refresh_interval",
          message: "Refresh Interval (ms):",
          default: 1000,
          validate: (input) => input >= 1000,
        },
        {
          type: "input",
          name: "JWT_SECRET",
          message: "JWT Secret (or press enter for default):",
          default:
            "4Od!MwUh3lbU7kTJPqeocffWbtM75#1e01#6xS5y75ICk5^dKMefV5kmuvMj5FJ!^@n97A4Mcu9c@HDc",
        },
      ],
      urls: [
        {
          type: "input",
          name: "thumbnail",
          message: "Thumbnail URL:",
          default: "https://hexarion.net/Hex-Status.png",
          validate: (input) => {
            const urlPattern =
              /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
            return urlPattern.test(input) || "Please enter a valid URL";
          },
        },
      ],
      theme: [
        {
          type: "input",
          name: "primary",
          message: "Primary Color (hex):",
          default: "#ff0000",
          validate: (input) => /^#[0-9A-Fa-f]{6}$/.test(input),
        },
        {
          type: "input",
          name: "secondary",
          message: "Secondary Color (hex):",
          default: "#000000",
          validate: (input) => /^#[0-9A-Fa-f]{6}$/.test(input),
        },
        {
          type: "input",
          name: "accent",
          message: "Accent Color (hex):",
          default: "#ff3333",
          validate: (input) => /^#[0-9A-Fa-f]{6}$/.test(input),
        },
        {
          type: "input",
          name: "background",
          message: "Background Color (hex):",
          default: "#1a1a1a",
          validate: (input) => /^#[0-9A-Fa-f]{6}$/.test(input),
        },
      ],
      bot: [
        {
          type: "input",
          name: "token",
          message: "Discord Bot Token:",
          validate: (input) => {
            // Discord tokens are typically ~70 characters long and follow a specific format
            const tokenRegex = /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/;
            if (!tokenRegex.test(input)) {
              return "Please enter a valid Discord bot token. You can get one from https://discord.com/developers/applications";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "status",
          message: "Bots Status Text:",
          default: "Hex Status",
        },
      ],
      license: [{
        type: 'input',
        name: 'key',
        message: 'License Key:',
        validate: async function(input) {
            if (!input) return 'License key is required';
            
            try {
                const License = require('./system/models/License');
                await License.create({ key: input });
                
                const { Auth } = require('./system/services/auth');
                const authResult = await Auth();
                
                if (authResult) {
                    return true;
                }
                
                await License.deleteOne({ key: input });
                return 'Invalid license key. Please check your key and try again.';
            } catch (error) {
                if (mongoose.connection.readyState === 1) {
                    const License = require('./system/models/License');
                    await License.deleteOne({ key: input });
                }
                return 'Failed to verify license key. Please check your internet connection.';
            }
        }
    }]
    };
    return prompts[section] || [];
  }
}

// Initialize and run the setup wizard
new SetupWizard().start();