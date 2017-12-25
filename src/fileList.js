import Immutable from 'immutable'

import { FileListState } from 'react-simple-file-list'
import { createReducers } from './redux_helper.js'
import { takeLatest, put, call, select } from 'redux-saga/effects'

const PULL = 'FILELIST/PULL'
const PUSH = 'FILELIST/PUSH'

const UPDATE_FILE_LIST_STATE = 'FILELIST/UPDATE_FILE_LIST_STATE'
const PULL_REQ = 'FILELIST/PULL_REQ'
const PULL_OK = 'FILELIST/PULL_OK'
const PULL_ERR = 'FILELIST/PULL_ERR'
const PUSH_REQ = 'FILELIST/PUSH_REQ'
const PUSH_OK = 'FILELIST/PUSH_OK'
const PUSH_ERR = 'FILELIST/PUSH_ERR'

export function defaultValue() {
    return {
        syncingQ: [],
        syncingIdx: -1,
        syncingErr: false,
        fileListState: FileListState.createEmpty(),
    }
}

export const actions = {
    updateFileListState: (fileListState) => ({
        type: UPDATE_FILE_LIST_STATE,
        fileListState,
    }),
    pull_req: () => ({
        type: PULL_REQ,
    }),
    pull_ok: (id, json) => ({
        type: PULL_OK,
        id,
        json,
    }),
    pull_err: (info) => ({
        type: PULL_ERR,
        info,
    }),
    push_req: (json) => ({
        type: PUSH_REQ,
        json,
    }),
    push_ok: () => ({
        type: PUSH_OK,
    }),
    push_err: (info) => ({
        type: PUSH_ERR,
        info,
    }),
    cmd: {
        pull: (id, loader) => ({
            type: PULL,
            id,
            loader,
        }),
        push: (id, saver) => ({
            type: PUSH,
            id,
            saver,
        }),
    },
}

function update_fileListState(old, { fileListState }) {
    return Object.assign({}, old, { fileListState })
}

function pull_req(old) {
    return old.set('syncing', true)
}

function pull_ok(old, { id, json }) {
    const text = parseV1(json)
    const state = Object.assign({}, old.editor.getCurrentContent().createFromText(text))
    return state
}

function pull_err(old, { info }) {
    console.error(info)
    return old.set('syncing', false)
}

function push_req(old, { text }) {
    const oldText = old.file.editor.getCurrentContent().getPlainText()
    let state = old
    if (text !== oldText) {
        state = old.syncingQ.push(text)
    }
    return state
}

function push_ok(old, { syncingIdx }) {
    return old.set('syncingErr', false).set('syncingIdx', -1).set('syncingQ').slice(syncingIdx)
}

function push_err(old, { info }) {
    console.error(info)
    return old.set('syncingErr', false).set('syncingIdx', -1)
}

export const reducer = createReducers({
    [UPDATE_FILE_LIST_STATE]: update_fileListState,
    [PULL_REQ]: pull_req,
    [PULL_OK]: pull_ok,
    [PULL_ERR]: pull_err,
    [PUSH_REQ]: push_req,
    [PUSH_OK]: push_ok,
    [PUSH_ERR]: push_err,
}, defaultValue())

function* pull({ id, loader, saver }) {
    try {
        const json = yield call(loader, id)
        let text = ''
        if (!json) {
            yield this.push(id, saver)
        } else {
            text = parseV1(json)
        }
        yield put(actions.pull_ok(id, text))
    } catch (e) {
        yield put(actions.pull_err(e))
    }
}

function* push({ id, saver }) {
    const getFile = state => (state.file)
    const file = yield select(getFile)
    let { editor, syncingIdx, syncingQ } = file
    const text = editor.getCurrentContent().getPlainText()
    yield put(actions.push_req(text))

    if (syncingIdx < 0) {
        syncingIdx = syncingQ.length - 1
        try {
            yield call(saver, id, syncingQ[syncingIdx])
            yield put(actions.push_ok(syncingIdx))
        } catch (e) {
            yield put(actions.push_err(e))
        }
    }
}

function* saga() {
    yield takeLatest(PULL, pull)
    yield takeLatest(PUSH, push)
}

export default {
    defaultValue,
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