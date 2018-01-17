import string from 'rollup-plugin-string'
import resolve from 'rollup-plugin-node-resolve'
import cjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'

export default {
    input: 'src/main.jsx',
    output: {
        file: 'main.esm.js',
        format: 'es',
    },
    plugins: [
        string({
            include: 'src/*.raw',
        }),
        babel({
            exclude: 'node_modules/**',
        }),
        cjs(),
        resolve(),
        replace({
            'process.env.NODE_ENV': JSON.stringify( 'production' ),
        }),
    ],
    external: [
        'babel-polyfill',
        'immutable',
        'react',
        'react-dom',
        'react-redux',
        'react-modal2',
        'react-simple-file-list',
        'redux',
        'redux-logger',
        'redux-saga',
        'redux-saga/effects',
        'styled-components',
        'commonmark',
        'slate',
        'slate-react',
        'slate-plain-serializer',
    ],
}
