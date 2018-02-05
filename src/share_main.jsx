import 'babel-polyfill'
import { render, unmountComponentAtNode } from 'react-dom'
/* eslint-disable no-unused-vars */
import React from 'react'
import ConnectedShareCommonmark from './ConnectedShareCommonmark.jsx'
/* eslint-enable */

// callbacks: {
//     getFileid: ()=>Promise(fileid)
//     loadShareFile: (id)=>Promise(json)
// }
export function initShareCommonMark(element, callbacks) {
    console.assert(callbacks.loadShareFile, 'need loadShareFile')
    console.assert(callbacks.getFileid, 'need getFileid')
    const { loadShareFile, getFileid } = callbacks
    const externalCmd = { loadShareFile, getFileid }

    render(<ConnectedShareCommonmark externalCmd={externalCmd}></ConnectedShareCommonmark>, element)
}

export function deinit(element) {
    unmountComponentAtNode(element)
}
