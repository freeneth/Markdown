import json from 'rollup-plugin-json';
import postcss from 'rollup-plugin-postcss';
import resolve from 'rollup-plugin-node-resolve';
import cjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace'

export default {
    input: 'src/main.jsx',
    output: {
        file: 'main.esm.js',
        format: 'es',
    },
    plugins: [
        json(),
        postcss(),
        babel({
            exclude: 'node_modules/**',
        }),
        resolve(),
        cjs({
            namedExports: {
                'redux-logger': [ 'createLogger' ],
                'draft-js': [ 'EditorState', 'ContentState', 'Editor' ],
            },
        }),
        replace({
            'process.env.NODE_ENV': JSON.stringify( 'production' ),
        }),
    ],
    external: [
        'immutable',
        'react',
        'react-dom',
        'react-redux',
        'react-simple-file-list',
        'redux',
        'redux-saga',
        'redux-saga/effects',
    ],
}
