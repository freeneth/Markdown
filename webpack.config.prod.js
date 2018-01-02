/* global __dirname */
const path = require('path')
const webpack = require('webpack')
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    entry: {
        main: path.resolve('./src/main.jsx'),
    },
    output: {
        path: __dirname,
        filename: '[name].js',
        library: 'CommonmarkEditor',
        libraryTarget: 'umd',
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],
    devtool: 'source-map',
})
