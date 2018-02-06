import 'babel-polyfill'
import { render, unmountComponentAtNode } from 'react-dom'
/* eslint-disable no-unused-vars */
import React from 'react'
import ShareCommonmark from './component/ShareCommonmark.jsx'
/* eslint-enable */

// callbacks: {
//     getFileid: ()=>Promise(fileid)
//     loadShareFile: (id)=>Promise(json)
// }
export function initShareCommonMark(element, callbacks) {
    console.assert(callbacks.loadShareFile, 'need loadShareFile')
    const { loadShareFile} = callbacks

    render(<ShareCommonmark loadShareFile={loadShareFile}/>, element)
}

export function deinit(element) {
    unmountComponentAtNode(element)
}
