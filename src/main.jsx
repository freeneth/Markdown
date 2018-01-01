import { render, unmountComponentAtNode } from 'react-dom'
import { createStore, applyMiddleware} from 'redux'
/* eslint-disable no-unused-vars */
import React from 'react'
import { Provider } from 'react-redux'
import ConnectedCommonmarkEditor from './ConnectedCommonmarkEditor.jsx'
/* eslint-enable */
import { Reducer, Saga } from './store.js'
import { createLogger } from 'redux-logger'
import createSagaMiddleware from 'redux-saga'
import Immutable from 'immutable'

import 'draft-js/dist/Draft.css'

// callbacks: {
//     saveFile: (id, json)=>Promise()
//     saveFileList: (json)=>Promise()
//     loadFile: (id)=>Promise(json)
//     loadFileList: ()=>Promise(json)

//      setShare: (shareid,fileid,options)=>Promise()
//      getShare: (fileid) =>Promise([{options}])
// }
export default function initCommonMark(element, callbacks, readonly=false) {
    const logger = createLogger({
        duration: true,
        stateTransformer: (state)=>{
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

    console.assert(callbacks.saveFile, 'need saveFile')
    console.assert(callbacks.saveFileList, 'need saveFileList')
    console.assert(callbacks.loadFile, 'need loadFile')
    console.assert(callbacks.loadFileList, 'need loadFileList')
    console.assert(callbacks.setShare, 'need setShare')
    console.assert(callbacks.getShare, 'need getShare')

    const {
        saveFile,
        saveFileList,
        loadFile,
        loadFileList,
        setShare,
        getShare,
    } = callbacks
    const externalCmd = {
        saveFile,
        saveFileList,
        loadFile,
        loadFileList,
        setShare,
        getShare,
    }

    render(<Provider store={store}>
        <ConnectedCommonmarkEditor readonly={readonly} externalCmd={externalCmd}></ConnectedCommonmarkEditor>
    </Provider>, element)
}

export function deinit(element) {
    unmountComponentAtNode(element)
}
