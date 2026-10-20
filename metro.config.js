const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable the worker pool — fixes "transformFile undefined" crash
config.maxWorkers = 0;

module.exports = config;