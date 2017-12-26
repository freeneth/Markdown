/* global __dirname */
const path = require('path')
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    entry: {
        app: path.resolve('./src/app.jsx'),
        //test: path.resolve('./src/test_store.js'),
    },
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
    },
    devtool: 'source-map',
})
