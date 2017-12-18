/* global __dirname */
const path = require('path')
const webpack = require('webpack')
const merge = require('webpack-merge');
const common = require('./webpack.common.babel.js');
//const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

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
        // new UglifyJSPlugin({
        //     parallel: true,
        //     sourceMap: true,
        // }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],
    devtool: 'source-map',
})