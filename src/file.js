import { ContentState, EditorState } from 'draft-js'
import {createReducers} from './redux_helper.js'
import { takeLatest, put, select } from 'redux-saga/effects'
import SyncState from 'redux-sync-state'

const PULL = 'FILE/PULL'
const PUSH = 'FILE/PUSH'

const UPDATE_EDITOR = 'FILE/UPDATE_EDITOR'
const CREATE_DEFAULT = 'FILE/CREATE_DEFAULT'

const PULL_OK = 'FILE/PULL_OK'
const PULL_ERR = 'FILE/PULL_ERR'
const PUSH_OK = 'FILE/PUSH_OK'
const PUSH_ERR = 'FILE/PUSH_ERR'

export function defaultValue() {
    return {
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
    pull_ok: (text)=>({
        type: PULL_OK,
        text,
    }),
    pull_err: (info)=>({
        type: PULL_ERR,
        info,
    }),
    push_ok: ()=>({
        type: PUSH_OK,
    }),
    push_err: (info)=>({
        type: PUSH_ERR,
        info,
    }),
    cmd: {
        pull: (id, loader)=>({
            type: PULL,
            id,
            loader,
        }),
        push: (id, saver, remove)=>({
            type: PUSH,
            id,
            saver,
            remove,
        }),
    },
}

function update_editor(old, {editor}) {
    return Object.assign({},old,{editor})
}

function create_default(old) {
    const defaultText = require('./defaultText.raw')

    const editorContentState = ContentState.createFromText(defaultText)
    const editorState = EditorState.createWithContent(editorContentState)
    const state = Object.assign({}, old, {editor: editorState})
    return state
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

function push_ok(old) {
    return old
}

function push_err(old, {info}) {
    console.error(info)
    return old
}

export const reducer = createReducers({
    [CREATE_DEFAULT]: create_default,
    [UPDATE_EDITOR]: update_editor,
    [PULL_OK]: pull_ok,
    [PULL_ERR]: pull_err,
    [PUSH_OK]: push_ok,
    [PUSH_ERR]: push_err,
}, defaultValue())

function* pull({ id, loader}) {
    const start = function(workid) {
        console.log('reading', workid)
        return loader(id)
    }
    const onOk = function*(workid, json) {
        if (json) {
            const text = parseV1(json)
            yield put(actions.pull_ok(text))
        } else {
            yield put(actions.pull_ok(''))
        }
    }
    const onError = function*(workid, info) {
        yield put(actions.push_err(info))
    }
    yield put(SyncState.actions.read('file', start, onOk, onError))
}

function* push({id, saver, remove}) {
    const getFile = state => (state.file)
    let file = yield select(getFile)
    const text = file.editor.getCurrentContent().getPlainText()
    file = yield select(getFile)

    const start = (workid) => {
        console.log('saving', workid)
        if (remove) {
            return saver(id, null)
        } else {
            const json = toJSONV1(text)
            return saver(id, json)
        }
    }
    const onOk = function*() {
        yield put(actions.push_ok())
    }
    const onError = function*() {
        yield put(actions.push_err())
    }
    yield put(SyncState.actions.write('file', start, onOk, onError))
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
    return JSON.stringify({version, text})
}
