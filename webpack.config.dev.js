/* global __dirname */
const path = require('path')
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
let webpack = require('webpack');
module.exports = merge(common, {
    entry: {
        app: ['babel-polyfill', path.resolve('./src/app.jsx')],
        //test: path.resolve('./src/test_store.js'),
    },
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
    },
    plugins: [
        new UglifyJSPlugin({
            parallel: true,
        }),
        new webpack.DefinePlugin({
            ISPRODUCTION: JSON.stringify(true),
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],
    devtool: 'source-map',
})
