import Immutable from 'immutable'

import {
    createReducers
} from './redux_helper.js'
import {
    takeLatest,
    put,
    call,
    select
} from 'redux-saga/effects'

const ENABLE = 'FILE_SHARE/ENABLE'
const DISABLE = 'FILE_SHARE/DISABLE'

const CREATE = 'FILE_SHARE/CREATE'
const REMOVE = 'FILE_SHARE/REMOVE'

const SET_REQ = 'FILE_SHARE/SET_REQ'
const SET_OK = 'FILE_SHARE/SET_OK'
const SET_ERR = 'FILE_SHARE/SET_ERR'
const GET_REQ = 'FILE_SHARE/GET_REQ'
const GET_OK = 'FILE_SHARE/GET_OK'
const GET_ERR = 'FILE_SHARE/GET_ERR'

const SET = 'FILE_SHARE/SET'
const GET = 'FILE_SHARE/GET'

export function defaultValue() {
    return Immutable.fromJS({
        shareidList: [],
        fileid: '',
        shareOptions: {}, //shareid => Options
        syncing: false,
    })
}

export function defaultOptions() {
    return Immutable.fromJS({
        shareid: '',
        fileid: '',
        enable: true,
    })
}

export const actions = {
    enable: (shareid) => ({
        type: ENABLE,
        shareid,
    }),
    disable: (shareid) => ({
        type: DISABLE,
        shareid,
    }),
    create: (fileid, shareid) => ({
        type: CREATE,
        fileid,
        shareid,
    }),
    remove: (shareid) => ({
        type: REMOVE,
        shareid,
    }),
    set: (shareid, setShare) => ({
        type: SET,
        shareid,
        setShare,
    }),
    get: (fileid, getShare) => ({
        type: GET,
        fileid,
        getShare,
    }),
    set_req: () => ({
        type: SET_REQ,
    }),
    set_ok: () => ({
        type: SET_OK,
    }),
    set_err: (info) => ({
        type: SET_ERR,
        info,
    }),
    get_req: () => ({
        type: GET_REQ,
    }),
    get_ok: (shareOptionsList) => ({
        type: GET_OK,
        shareOptionsList,
    }),
    get_err: (info) => ({
        type: GET_ERR,
        info,
    }),
}

function enable(fileShare, {shareid}) {
    return fileShare.setIn(['shareOptions', shareid, 'enable'], true)
}

function disable(fileShare, {shareid}) {
    return fileShare.setIn(['shareOptions', shareid, 'enable'], false)
}

function create(fileShare, {fileid, shareid}) {
    const options = defaultOptions().set('fileid',fileid).set('shareid',shareid)
    return fileShare.withMutations((m) => {
        m.set('fileid', fileid)
        m.setIn(['shareOptions', shareid], options)
        m.update('shareidList', (l) => {
            return l.push(shareid)
        })
    })
}

function remove(fileShare, {shareid}) {
    return fileShare.withMutations((m) => {
        const index = m.get('shareidList').findIndex((id)=>(id===shareid))
        m.removeIn(['shareidList',index])
        m.removeIn(['shareOptions',shareid])
    })
}

function set_req(old) {
    return old.set('syncing', true)
}

function set_ok(old) {
    return old.set('syncing', false)
}

function set_err(old, { info }) {
    console.error(info)
    return old.set('syncing', false)
}

function get_req(old) {
    return old.set('syncing', true)
}

function get_ok(old, { shareOptionsList }) {
    console.warn(shareOptionsList.toJS())
    const list = shareOptionsList.map((so) => so.get('shareid'))
    const shareOptions = Immutable.Map().withMutations((m) => {
        shareOptionsList.forEach((so) => {
            m.set(so.get('shareid'), so)
        })
    })

    return old.update('shareOptions', (s) => (s.mergeDeep(shareOptions)))
        .set('shareidList', list)
        .set('syncing', false)
}

function get_err(old, { info }) {
    console.error(info)
    return old.set('syncing', false)
}

function* set({ shareid, setShare }) {
    const getShareOptions = state => (state.fileShare.get('shareOptions'))
    const shareOptions = yield select(getShareOptions)
    const options = shareOptions.get(shareid)
    const fileid = options.get('fileid')
    try {
        yield put(actions.set_req())
        yield call(setShare, shareid, fileid, JSON.stringify(options))
        yield put(actions.set_ok())
    } catch (e) {
        yield put(actions.set_err(e))
    }
}

function* get({ fileid, getShare }) {
    try {
        yield put(actions.get_req())
        const shareOptionsList = yield call(getShare, fileid)
        const l = shareOptionsList.map((o) => {
            return JSON.parse(o)
        })
        yield put(actions.get_ok(Immutable.fromJS(l)))
    } catch (e) {
        yield put(actions.get_err(e))
    }
}

export const reducer = createReducers({
    [ENABLE]: enable,
    [DISABLE]: disable,
    [CREATE]: create,
    [REMOVE]: remove,
    [SET_REQ]: set_req,
    [SET_OK]: set_ok,
    [SET_ERR]: set_err,
    [GET_REQ]: get_req,
    [GET_OK]: get_ok,
    [GET_ERR]: get_err,
}, defaultValue())

function* saga() {
    yield takeLatest(SET, set)
    yield takeLatest(GET, get)
}

export default {
    defaultValue,
    actions,
    reducer,
    saga,
}