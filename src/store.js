import {combineReducers} from 'redux'
import File from './file.js'
import FileList from './fileList.js'
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
        setTimeout(()=>res(fileList), 500)
    })
}


const Action = {
    file: File.actions,
    fileList: FileList.actions,
}

const Reducer = combineReducers({
    file: File.reducer,
    fileList: FileList.reducer,
})

function* Saga() {
    yield* File.saga()
}

export {
    Action,
    Reducer,
    Saga,
}
