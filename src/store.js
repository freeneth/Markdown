import {
    combineReducers
} from 'redux'
import File from './file.js'
import FileList from './fileList.js'
import FileShare from './fileShare.js'
import SyncState from 'redux-sync-state'
export function mock_saveFile(id, json) {
    return new Promise((res) => {
        if (id) {
            if (json === null) {
                console.log('remove file', id)
                window.localStorage.removeItem(id)
            } else if (json !== undefined) {
                console.log('save file', json)
                window.localStorage.setItem(id, json)
            }
        }
        setTimeout(res, 500)
    })
}

export function mock_saveFileList(json) {
    return new Promise((res) => {
        if (json) {
            console.log('save fileList', json)
            window.localStorage.setItem('cmList', json)
        }
        setTimeout(res, 500)
    })
}

export function mock_loadFile(id) {
    return new Promise((res) => {
        const file = window.localStorage.getItem(id)
        setTimeout(() => res(file), 500)
    })
}

export function mock_loadFileList() {
    return new Promise((res) => {
        const fileList = window.localStorage.getItem('cmList')
        console.log('load fileList', fileList)
        setTimeout(() => res(fileList), 500)
    })
}

export function mock_setShare(shareid, fileid, json) {
    return new Promise((res) => {
        if (json) {
            console.log('set share option', json)

            let shareidListJson = window.localStorage.getItem('shareidList' + fileid)
            let shareidList = JSON.parse(shareidListJson)
            if (!shareidList) {
                shareidList = []
            }
            const t = shareidList.find(id => (id === shareid))
            if (!t) {
                shareidList.push(shareid)
                window.localStorage.setItem('shareidList' + fileid, JSON.stringify(shareidList))
            }
            window.localStorage.setItem(shareid, json)
        }
        setTimeout(res, 500);
    })
}

export function mock_getShare(fileid) {
    return new Promise(res => {
        const shareidList = JSON.parse(window.localStorage.getItem('shareidList' + fileid))
        if (shareidList) {
            setTimeout(() => {
                const list = shareidList.map((id) => {
                    return window.localStorage.getItem(id)
                })
                res(list)
            }, 500);
        } else {
            setTimeout(() => res([]), 500)
        }
    })
}

const Action = {
    file: File.actions,
    fileList: FileList.actions,
    fileShare: FileShare.actions,
}

const Reducer = combineReducers({
    syncState: SyncState.reducer,
    file: File.reducer,
    fileList: FileList.reducer,
    fileShare: FileShare.reducer,
})

function* Saga() {
    yield* SyncState.saga()
    yield* File.saga()
    yield* FileList.saga()
    yield* FileShare.saga()
}

export {
    Action,
    Reducer,
    Saga,
}