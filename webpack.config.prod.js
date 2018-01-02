/* global __dirname */
const path = require('path')
const webpack = require('webpack')
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = merge(common, {
    entry: {
        main: path.resolve('./src/main.jsx'),
    },
    externals: {
        commonmark: 'commonmark',
        immutable: 'Immutable',
        react: 'React',
        redux: 'Redux',
        'react-redux': 'ReactRedux',
        'redux-saga': 'ReduxSaga',
        'redux-saga/effects': 'ReduxSaga/effects',
        'draft-js': 'DraftJs',
        'styled-components': 'styled',
        'react-dom': 'ReactDom',
        'prop-types': 'PropTypes',
        'react-modal2': 'ReactModal2',
        'react-simple-file-list': 'SimpleFileList',
    },
    output: {
        path: __dirname,
        filename: '[name].js',
        library: 'CommonmarkEditor',
        libraryTarget: 'umd',
    },
    plugins: [
        new UglifyJSPlugin({
            parallel: true,
            sourceMap: true,
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],
    devtool: 'source-map',
})
