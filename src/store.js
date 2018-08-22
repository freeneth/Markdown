import {
    combineReducers
} from 'redux'
import File from './file.js'
import FileList from './fileList.js'
import FileShare from './fileShare.js'
import SyncState from 'redux-sync-state'
import { G } from './api.js';
export function mock_saveFile(id, json) {
    return new Promise(async (res) => {
        if (id) {
            if (json === null) {
                console.log('remove file', id);
                await G.api.hDel(await G.sidP, await G.userIdP, 'file', id);
               // window.localStorage.removeItem(id)
            } else if (json !== undefined) {
                console.log('save file', json)
                await G.api.hSet(await G.sidP, await G.userIdP, 'file', id,json);
                //window.localStorage.setItem(id, json)
            }
        }
        setTimeout(res, 500)
    })
}

export function mock_saveFileList(json) {
    return new Promise(async (res) => {
        if (json) {
            console.log('save fileList', json)
            await G.api.hSet(await G.sidP, await G.userIdP, 'fileList', 'cmList',json);
            //window.localStorage.setItem('cmList', json)
        }
        setTimeout(res, 500)
    })
}

export function mock_loadFile(id) {
    return new Promise(async (res) => {
        //const file = window.localStorage.getItem(id);
        const file= await G.api.hGet(await G.sidP, await G.userIdP, 'file',id);
        setTimeout(() => res(file), 500)
    })
}

export function mock_loadFileList() {
    return new Promise(async (res) => {
        //const fileList = window.localStorage.getItem('cmList')
        const fileList = await G.api.hGet(await G.sidP, await G.userIdP, 'fileList','cmList');
        console.log('load fileList', fileList)
        setTimeout(() => res(fileList), 500)
    })
}

export function mock_setShare(shareid, fileid, json) {
    return new Promise(async (res) => {
        if (json) {
            console.log('set share option', json)

            //let shareidListJson = window.localStorage.getItem('shareidList' + fileid)
            let shareidListJson =await G.api.hGet(await G.sidP, await G.userIdP, 'Share','shareidList' + fileid);
            let shareidList = JSON.parse(shareidListJson)
            if (!shareidList) {
                shareidList = []
            }
            const t = shareidList.find(id => (id === shareid))
            if (!t) {
                shareidList.push(shareid)

                // window.localStorage.setItem('shareidList' + fileid, JSON.stringify(shareidList))
                await G.api.hSet(await G.sidP, await G.userIdP, 'Share', 'shareidList' + fileid,JSON.stringify(shareidList));
            }
            //window.localStorage.setItem(shareid, json)
            await G.api.hSet(await G.sidP, await G.userIdP, 'Share', shareid,json);
        }
        setTimeout(res, 500);
    })
}

export function mock_getShare(fileid) {
    return new Promise(async res => {
        // const shareidList = JSON.parse(window.localStorage.getItem('shareidList' + fileid))
        const shareidList = JSON.parse(await G.api.hGet(await G.sidP, await G.userIdP, 'Share', 'shareidList' + fileid))
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

export function mock_getFileid() {
    return new Promise((res) => {
        setTimeout(() => res('pafdpduq56'), 500)
    })
}

export function mock_loadShareFile() {
    return new Promise(async (res) => {
        // const filejson = window.localStorage.getItem('pafdpduq56')
        const filejson = await  G.api.hGet(await G.sidP, await G.userIdP, 'ShareFile', 'pafdpduq56');
        const file = JSON.parse(filejson)
        setTimeout(() => res(file.text), 500)
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