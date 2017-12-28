import {combineReducers} from 'redux'
import File from './file.js'
import FileList from './fileList.js'
import SyncState from 'redux-sync-state'
export function mock_saveFile(id, json){
    return new Promise((res)=>{
        if (id) {
            if (json === null) {
                console.log('remove file', id)
                window.localStorage.removeItem(id)
            } else if(json !== undefined){
                console.log('save file', json)
                window.localStorage.setItem(id, json)
            }
        }
        setTimeout(res, 500)
    })
}

export function mock_saveFileList(json){
    return new Promise((res)=>{
        if (json) {
            console.log('save fileList', json)
            window.localStorage.setItem('cmList', json)
        }
        setTimeout(res, 500)
    })
}

export function mock_loadFile(id) {
    return new Promise((res)=>{
        const file = window.localStorage.getItem(id)
        setTimeout(()=>res(file), 500)
    })
}

export function mock_loadFileList() {
    return new Promise((res)=>{
        const fileList = window.localStorage.getItem('cmlist')
        console.log('load fileList', fileList)
        setTimeout(()=>res(fileList), 500)
    })
}

const Action = {
    file: {
        ...File.actions,
        syncState: SyncState.actions,
    },
    fileList: {
        ...FileList.actions,
        syncState: SyncState.actions,
    },
}

const Reducer = combineReducers({
    syncState: SyncState.reducer,
    file: File.reducer,
    fileList: FileList.reducer,
})

function* Saga() {
    yield* SyncState.saga()
    yield* File.saga()
    yield* FileList.saga()
}

export {
    Action,
    Reducer,
    Saga,
}
