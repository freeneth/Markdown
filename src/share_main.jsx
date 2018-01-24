import 'babel-polyfill'
import { render, unmountComponentAtNode } from 'react-dom'
import { createStore, applyMiddleware} from 'redux'
/* eslint-disable no-unused-vars */
import React from 'react'
import { Provider } from 'react-redux'
import ConnectedShareCommonmark from './ConnectedShareCommonmark.jsx'
/* eslint-enable */
import { Reducer, Saga } from './store.js'
import { createLogger } from 'redux-logger'
import createSagaMiddleware from 'redux-saga'
import Immutable from 'immutable'

// callbacks: {
//     getFileid: ()=>Promise(fileid)
//     loadShareFile: (id)=>Promise(json)
// }
export function initShareCommonMark(element, callbacks) {
    const logger = createLogger({
        duration: true,
        stateTransformer: (state) => {
            let newState = {}

            for (var i of Object.keys(state)) {
                if (Immutable.Iterable.isIterable(state[i])) {
                    newState[i] = state[i].toJS()
                } else {
                    newState[i] = state[i]
                }
            }

            return newState
        },
    })
    const sagaMiddleware = createSagaMiddleware()

    let middlewares = applyMiddleware(sagaMiddleware, logger)
    /* globals process */
    if (process.env.NODE_ENV === 'production') {
        middlewares = applyMiddleware(sagaMiddleware)
    }
    const store = createStore(Reducer, middlewares)
    sagaMiddleware.run(Saga)

    console.assert(callbacks.loadShareFile, 'need loadShareFile')
    console.assert(callbacks.getFileid, 'need getFileid')
    const { loadShareFile, getFileid } = callbacks
    const externalCmd = { loadShareFile, getFileid }

    render(<Provider store={store}>
        <ConnectedShareCommonmark externalCmd={externalCmd}></ConnectedShareCommonmark>
    </Provider>, element)
}

export function deinit(element) {
    unmountComponentAtNode(element)
}
