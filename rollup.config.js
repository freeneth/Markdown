import string from 'rollup-plugin-string'
import resolve from 'rollup-plugin-node-resolve'
import cjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'

const externals = [
    'babel-polyfill',
    'commonmark',
    'immutable',
    'react',
    'react-dom',
    'react-modal2',
    'react-redux',
    'react-simple-file-list',
    'redux',
    'redux-logger',
    'redux-saga',
    'redux-saga/effects',
    'slate',
    'slate-plain-serializer',
    'slate-react',
    'styled-components',
]


export default [{
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
    external: externals,
}, {
    input: 'src/share_main.jsx',
    output: {
        file: 'share_main.esm.js',
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
    external: externals,
}]
