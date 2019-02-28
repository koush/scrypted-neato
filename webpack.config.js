const defaultWebpackConfig = require('@scrypted/sdk').getDefaultWebpackConfig();
const merge = require('webpack-merge');
const path = require('path');

const webpackConfig = {
    resolve: {
        alias: {
            crypto: path.resolve(__dirname, 'src/crypto'),
        }
    },
}

module.exports = merge(defaultWebpackConfig, webpackConfig);
