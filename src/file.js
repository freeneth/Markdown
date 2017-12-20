import Immutable from 'immutable'

import {createReducers} from './redux_helper.js'
import {takeLatest, put, call, select} from 'redux-saga/effects'

const CREATE = 'FILE/CREATE'
const REMOVE = 'FILE/REMOVE'
const SET_CONTENT = 'FILE/CONTENT'

const PULL = 'FILE/PULL'
const PUSH = 'FILE/PUSH'

const PULL_REQ = 'FILE/PULL_REQ'
const PULL_OK = 'FILE/PULL_OK'
const PULL_ERR = 'FILE/PULL_ERR'
const PUSH_REQ = 'FILE/PUSH_REQ'
const PUSH_OK = 'FILE/PUSH_OK'
const PUSH_ERR = 'FILE/PUSH_ERR'

export function defaultValue() {
    return Immutable.fromJS({
        files: {},
        syncing: false,
        pushing: null,
    })
}

export const actions = {
    create: (id)=>({
        type: CREATE,
        id,
    }),
    remove: (id)=>({
        type: REMOVE,
        id,
    }),
    setContent: (id, content)=>({
        type: SET_CONTENT,
        id,
        content,
    }),
    pull_req: ()=>({
        type: PULL_REQ,
    }),
    pull_ok: (id, json)=>({
        type: PULL_OK,
        id,
        json,
    }),
    pull_err: (info)=>({
        type: PULL_ERR,
        info,
    }),
    push_req: (json)=>({
        type: PUSH_REQ,
        json,
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
        push: (id, saver)=>({
            type: PUSH,
            id,
            saver,
        }),
    },
}

function create(files, {id}) {
    const newFile = Immutable.fromJS({ id: id, content: '', ctime: Date.now(), mtime: Date.now() })
    return files.set(id, newFile)
}

function remove(files, {id}) {
    return files.delete(id)
}

function setContent(files, {id, content}) {
    return files.update(id, (f)=>{
        return f.set('content', content)
            .set('mtime', Date.now())
    })
}

function pull_req(old) {
    return old.set('syncing', true)
}

function pull_ok(old, {id, json}) {
    const obj = parseV1(json)
    return old.update('files', (f)=>{
        return f.set(id, obj)
    }).set('syncing', false)
}

function pull_err(old, {info}) {
    console.error(info)
    return old.set('syncing', false)
}

function push_req(old, {json}) {
    return old.set('syncing', true).set('pushing', json)
}

function push_ok(old) {
    return old.set('syncing', false).set('pushing', null)
}

function push_err(old, {info}) {
    console.error(info)
    return old.set('syncing', false)
}

const fileReducer = createReducers({
    [CREATE]: create,
    [REMOVE]: remove,
    [SET_CONTENT]: setContent,
}, Immutable.List())

export const reducer = createReducers({
    [PULL_REQ]: pull_req,
    [PULL_OK]: pull_ok,
    [PULL_ERR]: pull_err,
    [PUSH_REQ]: push_req,
    [PUSH_OK]: push_ok,
    [PUSH_ERR]: push_err,
}, defaultValue(), (state, action)=>{
    return state.update('files', (s)=>(fileReducer(s, action)))
})

function* pull({id, loader}) {
    try {
        const json = yield call(loader, id)
        const file = parseV1(json)
        yield put(actions.pull_ok(id, file))
    } catch (e) {
        yield put(actions.pull_err(e))
    }
}

function* push({id, saver}) {
    const getFile = state=>(state.file.getIn(['files', id]))
    const file = yield select(getFile)
    const json = toJSONV1(file.toJS())
    yield put(actions.push_req(json))
    try {
        yield call(saver, id, json)
        yield put(actions.push_ok())
    } catch(e) {
        yield put(actions.push_err(e))
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
    const { version, file } = obj
    console.assert(version === 1)
    return Immutable.fromJS(file)
}

export function toJSONV1(file) {
    const version = 1
    return JSON.stringify({version, file})
}
