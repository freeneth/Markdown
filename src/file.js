import { ContentState, EditorState } from 'draft-js'
import {createReducers} from './redux_helper.js'
import {takeEvery, put, call, select} from 'redux-saga/effects'

const PULL = 'FILE/PULL'
const PUSH = 'FILE/PUSH'

const UPDATE_SYNCING_IDX = 'FILE/UPDATE_SYNCING_IDX'
const UPDATE_EDITOR = 'FILE/UPDATE_EDITOR'
const CREATE_DEFAULT = 'FILE/CREATE_DEFAULT'

const PULL_REQ = 'FILE/PULL_REQ'
const PULL_OK = 'FILE/PULL_OK'
const PULL_ERR = 'FILE/PULL_ERR'
const PUSH_REQ = 'FILE/PUSH_REQ'
const PUSH_OK = 'FILE/PUSH_OK'
const PUSH_ERR = 'FILE/PUSH_ERR'

export function defaultValue() {
    return {
        syncingQ: [],
        syncingIdx: -1,
        syncingErr: false,
        editor: EditorState.createEmpty(),
    }
}

export const actions = {
    createDefault: () => ({
        type: CREATE_DEFAULT,
    }),
    updateEditor: (editor)=>({
        type: UPDATE_EDITOR,
        editor,
    }),
    updateSyncingIdx: (syncingIdx)=>({
        type: UPDATE_SYNCING_IDX,
        syncingIdx,
    }),
    pull_req: ()=>({
        type: PULL_REQ,
    }),
    pull_ok: (text)=>({
        type: PULL_OK,
        text,
    }),
    pull_err: (info)=>({
        type: PULL_ERR,
        info,
    }),
    push_req: (text)=>({
        type: PUSH_REQ,
        text,
    }),
    push_ok: (syncingIdx)=>({
        type: PUSH_OK,
        syncingIdx,
    }),
    push_err: (info)=>({
        type: PUSH_ERR,
        info,
    }),
    cmd: {
        pull: (id, loader, saver)=>({
            type: PULL,
            id,
            loader,
            saver,
        }),
        push: (id, saver)=>({
            type: PUSH,
            id,
            saver,
        }),
    },
}

function create_default(old) {
    
}

function update_editor(old, {editor}) {
    return Object.assign({},old,{editor})
}

function update_syncingIdx(old, {syncingIdx}) {
    return Object.assign({}, old, {syncingIdx})
}

function pull_req(old) {
    return old.set('syncing', true)
}

function pull_ok(old, {text}) {
    const editorContentState = ContentState.createFromText(text)
    const editorState = EditorState.createWithContent(editorContentState)
    const state = Object.assign({}, old, {editor: editorState})
    return state
}

function pull_err(old, {info}) {
    console.error(info)
    return old;
}

function push_req(old, {text}) {
    let state = Object.assign({}, old)
    state.syncingQ.push(text)
    return state
}

function push_ok(old, { syncingIdx}) {
    console.assert(syncingIdx >= 0)
    const state = Object.assign({}, old)
    state.syncingQ = state.syncingQ.slice(syncingIdx+1)
    state.syncingErr = false
    state.syncingIdx = -1
    return state
}

function push_err(old, {info}) {
    console.error(info)
    const state = Object.assign({}, old)
    state.syncingErr = true
    state.syncingIdx = -1
    return state
}

export const reducer = createReducers({
    [UPDATE_EDITOR]: update_editor,
    [UPDATE_SYNCING_IDX]: update_syncingIdx,
    [PULL_REQ]: pull_req,
    [PULL_OK]: pull_ok,
    [PULL_ERR]: pull_err,
    [PUSH_REQ]: push_req,
    [PUSH_OK]: push_ok,
    [PUSH_ERR]: push_err,
}, defaultValue())

function* pull({ id, loader, saver}) {
    try {
        const json = yield call(loader, id)
        let text = ''
        if(!json){
            yield* push({id, saver})
        }else {
            text = parseV1(json)
        }
        yield put(actions.pull_ok(text))
    } catch (e) {
        yield put(actions.pull_err(e))
    }
}

function* push({id, saver, remove = false}) {
    const getFile = state => (state.file)
    let file = yield select(getFile)
    const text = file.editor.getCurrentContent().getPlainText()
    yield put(actions.push_req(text))
    file = yield select(getFile)

    let {syncingIdx, syncingQ } = file
    if (syncingIdx < 0){
        syncingIdx = syncingQ.length -1
        const text = syncingQ[syncingIdx]
        if (text !== undefined) {
            try {
                yield put(actions.updateSyncingIdx(syncingIdx))
                if (remove) {
                    yield call(saver, id, null)
                } else {
                    const json = toJSONV1(text)
                    yield call(saver, id, json)
                }
                yield put(actions.push_ok(syncingIdx))
                file = yield select(getFile)
                if (file.syncingQ.length > 0) {
                    yield put(actions.cmd.push(id, saver))
                }
            } catch (e) {
                yield put(actions.push_err(e))
            }
        }
    }
}

function* saga() {
    yield takeEvery(PULL, pull)
    yield takeEvery(PUSH, push)
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
    return JSON.stringify({version, text})
}
