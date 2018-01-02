
import { FileListState } from 'react-simple-file-list'
import { createReducers } from './redux_helper.js'
import { takeLatest, put, select } from 'redux-saga/effects'
import SyncState from 'redux-sync-state'

const PULL = 'FILELIST/PULL'
const PUSH = 'FILELIST/PUSH'

const UPDATE_FILE_LIST_STATE = 'FILELIST/UPDATE_FILE_LIST_STATE'
const PULL_OK = 'FILELIST/PULL_OK'
const PULL_ERR = 'FILELIST/PULL_ERR'
const PUSH_OK = 'FILELIST/PUSH_OK'
const PUSH_ERR = 'FILELIST/PUSH_ERR'


export const actions = {
    updateFileListState: (fileListState) => ({
        type: UPDATE_FILE_LIST_STATE,
        fileListState,
    }),
    pull_ok: (json) => ({
        type: PULL_OK,
        json,
    }),
    pull_err: (info) => ({
        type: PULL_ERR,
        info,
    }),
    push_ok: () => ({
        type: PUSH_OK,
    }),
    push_err: (info) => ({
        type: PUSH_ERR,
        info,
    }),
    cmd: {
        pull: (loader) => ({
            type: PULL,
            loader,
        }),
        push: (saver) => ({
            type: PUSH,
            saver,
        }),
    },
}

function update_fileListState(old, { fileListState }) {
    return fileListState
}

function pull_ok(old, { json }) {
    const fileListState = old.fromJSON(json)
    return fileListState
}

function pull_err(old, { info }) {
    console.error(info)
    return old
}

function push_ok(old) {
    return old
}

function push_err(old, { info }) {
    console.error(info)
    return old
}

export const reducer = createReducers({
    [UPDATE_FILE_LIST_STATE]: update_fileListState,
    [PULL_OK]: pull_ok,
    [PULL_ERR]: pull_err,
    [PUSH_OK]: push_ok,
    [PUSH_ERR]: push_err,
}, FileListState.createEmpty())

function* pull({ loader }) {
    const start = function(workid) {
        console.log('reading', workid)
        return loader()
    }
    const onOk = function*(workid, json) {
        if (json) {
            const text = parseV1(json)
            if (text) {
                yield put(actions.pull_ok(text))
            }
        }
    }
    const onError = function*(id, info) {
        yield put(actions.push_err(info))
    }
    yield put(SyncState.actions.read('fileList', start, onOk, onError))
}

function* push({ saver }) {
    const getFileList = state => (state.fileList)
    const fileList = yield select(getFileList)
    const text = JSON.stringify(fileList)
    const json = toJSONV1(text)

    const start = (workid) => {
        console.log('saving', workid)
        return saver(json)
    }
    const onOk = function*() {
        yield put(actions.push_ok())
    }
    const onError = function*() {
        yield put(actions.push_err())
    }
    yield put(SyncState.actions.write('fileList', start, onOk, onError))
}

function* saga() {
    yield takeLatest(PULL, pull)
    yield takeLatest(PUSH, push)
}

export default {
    actions,
    reducer,
    saga,
}

function parseV1(json) {
    const obj = JSON.parse(json)
    const { version, text } = obj
    console.assert(version === 1)
    return text
}

export function toJSONV1(text) {
    const version = 1
    return JSON.stringify({ version, text })
}
