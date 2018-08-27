import { render, unmountComponentAtNode } from 'react-dom';
import { applyMiddleware, combineReducers, createStore } from 'redux';
import React, { PureComponent } from 'react';
import { Provider, connect } from 'react-redux';
import { actionChannel, call, cancel, cancelled, fork, join, put, select, take, takeLatest } from 'redux-saga/effects';
import Immutable from 'immutable';
import createSagaMiddleware, { channel, delay } from 'redux-saga';
import { Value } from 'slate';
import Plain from 'slate-plain-serializer';
import { FileListState, SimpleFileList } from 'react-simple-file-list';
import styled from 'styled-components';
import { HtmlRenderer, Parser } from 'commonmark';
import ReactModal2 from 'react-modal2';
import { Editor } from 'slate-react';
import { createLogger } from 'redux-logger';

function handleDefault(state) {
    return state;
}

function createReducers(handlerMap, initState, defaultHandler) {
    return (state = initState, action) => {
        if (handlerMap.hasOwnProperty(action.type)) {
            return handlerMap[action.type](state, action);
        } else {
            if (defaultHandler) {
                return defaultHandler(state, action);
            } else {
                return handleDefault(state, action);
            }
        }
    };
}

function handleDefault$1(state) {
    return state
}

function createReducers$1(handlerMap, initState, defaultHandler) {
    return (state=initState, action)=>{
        if (handlerMap.hasOwnProperty(action.type)) {
            return handlerMap[action.type](state, action)
        } else {
            if (defaultHandler){
                return defaultHandler(state, action)
            } else {
                return handleDefault$1(state, action)
            }
        }
    }
}

const READ_DELAY = 25;
const WRITE_DELAY = 500;

class SyncState extends Immutable.Record({
    readError: null,
    writeError: null,
    syncing: false,
}){
}

class Work extends Immutable.Record({
    type: '',
    id: null,
    start: null,
    onOk: null,
    onError: (id, info)=>{console.error(`WorkError: ${info}\nid: ${id}`);},
    onCancel: null,
}){
}

class ReadWork extends Work {
    constructor(obj) {
        obj.type = 'read';
        super(obj);
    }
}

class WriteWork extends Work {
    constructor(obj) {
        obj.type = 'write';
        super(obj);
    }
}

const ADD_WORK = 'SYNC_STATE/ADD_WORK';
const WORK_START = 'SYNC_STATE/WORK_START';
const WORK_DONE = 'SYNC_STATE/WORK_DONE';
const WORK_ERROR = 'SYNC_STATE/WORK_ERROR';
const actions = {
    read: (id, start, onOk, onError, onCancel)=>({
        type: ADD_WORK,
        work: new ReadWork({id, start, onOk, onError, onCancel}),
    }),
    write: (id, start, onOk, onError, onCancel)=>({
        type: ADD_WORK,
        work: new WriteWork({id, start, onOk, onError, onCancel}),
    }),
};
const internal_actions = {
    workStart: (work)=>({
        type: WORK_START,
        work,
    }),
    workDone: (work)=>({
        type: WORK_DONE,
        work,
    }),
    workError: (work, info)=>({
        type: WORK_ERROR,
        work,
        info,
    }),
};

const reducer = createReducers$1({
    [WORK_START]: (state)=>{
        return state.set('syncing', true)
    },
    [WORK_DONE]: (state)=>{
        return state.set('syncing', false)
    },
    [WORK_ERROR]: (state, {work})=>{
        const {type} = work;
        if (type === 'read') {
            return state.set('readError', work)
        } else {
            return state.set('writeError', work)
        }
    },
}, new SyncState());

function* handleWork(work, delayT=0) {
    const {id, start, onOk, onError, onCancel} = work;
    try {
        if (start) {
            yield put(internal_actions.workStart(work));
            yield delay(delayT);
            const value = yield call(start, id);
            if (onOk) {
                yield call(onOk, id, value);
            }
        }
    } catch(err){
        if (onError) {
            yield put(internal_actions.workError(work, err));
            yield call(onError, id, err);
        }
    } finally {
        yield put(internal_actions.workDone(work));
        if (yield cancelled()) {
            if (onCancel) {
                yield call(onCancel, id);
            }
        }
    }
}

function* handle(channel$$1) {
    while (true) {
        const {lastObj, work} = yield take(channel$$1);
        const {type} = work;
        const delayT = type === 'read' ? READ_DELAY : WRITE_DELAY;
        const {lastType, lastTask} = lastObj;
        if (type === lastType) {
            console.info('cancelling for', work);
            yield cancel(lastTask);
        } else {
            if (lastTask) {
                yield join(lastTask);
                console.info('joined for', work);
            }
            lastObj.lastType = type;
        }
        lastObj.lastTask = yield fork(handleWork, work, delayT);
    }
}

function* saga() {
    yield fork(function*() {
        const workChan = yield actionChannel(ADD_WORK);
        const channelMap = {};
        const lastMap = {};
        while(true) {
            const {work} = yield take(workChan);
            const {id} = work;
            if (!channelMap[id]) {
                channelMap[id] = yield call(channel);
                yield fork(handle, channelMap[id]);
                lastMap[id] = {};
            }
            yield put(channelMap[id], {lastObj: lastMap[id], work});
        }
    });
}

var main = {
    actions,
    reducer,
    saga,
    Work,
    ReadWork,
    WriteWork,
};

var defaultText = "# Markdown 操作手册\r\n\r\n\r\n# 常用语法\r\n\r\n## 分割线\r\n你可以在一行中用三个以上的星号、减号、底线来建立一个分隔线，行内不能有其他东西。你也可以在星号或是减号中间插入空格。下面每种写法都可以建立分隔线：\r\n\r\n```\r\n***\r\n---\r\n* * *\r\n```\r\n\r\n\r\n## 段落和换行\r\n```\r\n在 Markdown 中段落由一行或者多行文本组成，相邻的两行文字会被视为同一段落，如果存在空行则被视为不同段落( Markdown 对空行的定义是看起来是空行就是空行，即使空行中存在 空格 TAB 回车 等不可见字符，同样会被视为空行)。\r\nMarkdown支持段内换行，如果你想进行段落内换行可以在上一行结尾插入两个以上的空格后再回车。\r\n```\r\n\r\n\r\n## 字体样式\r\n\r\n```\r\n字体样式有斜体，加粗，删除线，引用\r\n```\r\n\r\n#### **例如：**\r\n\r\n#### *我是斜体样式*\r\n\r\n#### **我是粗体样式**\r\n\r\n>我是引用样式\r\n\r\n\r\n## 标题\r\n\r\n```\r\n标题是通过#号加上标题内容组成的，#号个数决定标题的等级，最多可以达到6级标题。\r\n```\r\n#### **例如**：\r\n\r\n# 这是一级标题\r\n\r\n## 这是二级标题\r\n\r\n### 这是三级标题\r\n\r\n#### 这是四级标题\r\n\r\n##### 这是五级标题\r\n\r\n###### 这是六级标题\r\n\r\n\r\n\r\n## 列表\r\n```\r\n无序列表前面可以用 * + - 等，结果是相同的。\r\n有序列表的数字即便不按照顺序排列，结果仍是有序的。\r\n```\r\n### 无序列表\r\n```\r\n* 项目1\r\n  * 子项目1.1\r\n  * 子项目1.2\r\n    * 子项目1.2.1\r\n* 项目2\r\n* 项目3\r\n\r\n+ 项目1\r\n  + 子项目1.1\r\n  + 子项目1.2\r\n    + 子项目1.2.1\r\n+ 项目2\r\n+ 项目3\r\n\r\n- 项目1\r\n  - 子项目1.1\r\n  - 子项目1.2\r\n    - 子项目1.2.1\r\n- 项目2\r\n- 项目3\r\n```\r\n\r\n### 有序列表\r\n```\r\n1. 项目1\r\n2. 项目2\r\n3. 项目3\r\n   1. 项目3.1\r\n   2. 项目3.2\r\n```\r\n\r\n或者\r\n```\r\n1. 项目1\r\n1. 项目2\r\n1. 项目3\r\n   1. 项目3.1\r\n   1. 项目3.2\r\n```\r\n\r\n\r\n### 链接和图片\r\n```\r\n为了规避某些平台的防盗链机制，图片推荐使用图床，否则在不同平台上发布需要重新上传很麻烦的，图床最好选大平台的图床，一时半会不会倒闭的那种。\r\n\r\n链接地址的用法为：[链接名称](链接地址)\r\n图片的用法为！[名称](图片地址)\r\n```\r\n#### **例如：**\r\n[百度地址](http://www.baidu.com)\r\n\r\n![](https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1515067462048&di=03d12197457c7f707f58e1ced654f099&imgtype=0&src=http%3A%2F%2Fgz.feixin.10086.cn%2FPublic%2FUploads%2Fuser%2F0%2F0%2F16%2F6%2F148320016%2Fimgs%2F55823aa2e2e69.jpg)\r\n\r\n\r\n\r\n## 代码\r\n### 行内代码\r\n\r\n行内代码可以使用反引号来标记(反引号一般位于键盘左上角，要用英文):\r\n\r\nvar x =` \"hello world\"`\r\n\r\n### 块代码\r\n``` html\r\n// 我是注释\r\nint a = '5';\r\n```\r\n\r\n";

const PULL = 'FILE/PULL';
const PUSH = 'FILE/PUSH';

const UPDATE_EDITOR = 'FILE/UPDATE_EDITOR';
const CREATE_DEFAULT = 'FILE/CREATE_DEFAULT';

const PULL_OK = 'FILE/PULL_OK';
const PULL_ERR = 'FILE/PULL_ERR';
const PUSH_OK = 'FILE/PUSH_OK';
const PUSH_ERR = 'FILE/PUSH_ERR';

function defaultValue() {
    return {
        editor: Value.fromJSON({
            document: {
                nodes: [{
                    object: 'block',
                    type: 'paragraph',
                    nodes: [{
                        object: 'text',
                        leaves: [{ text: '' }]
                    }]
                }]
            }
        })
    };
}

const actions$1 = {
    createDefault: () => ({
        type: CREATE_DEFAULT
    }),
    updateEditor: editor => ({
        type: UPDATE_EDITOR,
        editor
    }),
    pull_ok: text => ({
        type: PULL_OK,
        text
    }),
    pull_err: info => ({
        type: PULL_ERR,
        info
    }),
    push_ok: () => ({
        type: PUSH_OK
    }),
    push_err: info => ({
        type: PUSH_ERR,
        info
    }),
    cmd: {
        pull: (id, loader) => ({
            type: PULL,
            id,
            loader
        }),
        push: (id, saver, remove) => ({
            type: PUSH,
            id,
            saver,
            remove
        })
    }
};

function update_editor(old, { editor }) {
    return Object.assign({}, old, { editor });
}

function create_default(old) {
    const defaultValue = Plain.deserialize(defaultText);
    const state = Object.assign({}, old, { editor: defaultValue });
    return state;
}

function pull_ok(old, { text }) {
    const defaultValue = Plain.deserialize(text);
    const state = Object.assign({}, old, { editor: defaultValue });
    return state;
}

function pull_err(old, { info }) {
    console.error(info);
    return old;
}

function push_ok(old) {
    return old;
}

function push_err(old, { info }) {
    console.error(info);
    return old;
}

const reducer$1 = createReducers({
    [CREATE_DEFAULT]: create_default,
    [UPDATE_EDITOR]: update_editor,
    [PULL_OK]: pull_ok,
    [PULL_ERR]: pull_err,
    [PUSH_OK]: push_ok,
    [PUSH_ERR]: push_err
}, defaultValue());

function* pull({ id, loader }) {
    const start = function (workid) {
        console.log('reading', workid);
        return loader(id);
    };
    const onOk = function* (workid, json) {
        if (json) {
            const text = parseV1(json);
            yield put(actions$1.pull_ok(text));
        } else {
            yield put(actions$1.pull_ok(''));
        }
    };
    const onError = function* (workid, info) {
        yield put(actions$1.push_err(info));
    };
    yield put(main.actions.read('file', start, onOk, onError));
}

function* push({ id, saver, remove }) {
    const getFile = state => state.file;
    let file = yield select(getFile);
    const text = Plain.serialize(file.editor);
    file = yield select(getFile);

    const start = workid => {
        console.log('saving', workid);
        if (remove) {
            return saver(id, null);
        } else {
            const json = toJSONV1(text);
            return saver(id, json);
        }
    };
    const onOk = function* () {
        yield put(actions$1.push_ok());
    };
    const onError = function* () {
        yield put(actions$1.push_err());
    };
    yield put(main.actions.write('file', start, onOk, onError));
}

function* saga$1() {
    yield takeLatest(PULL, pull);
    yield takeLatest(PUSH, push);
}

var File = {
    defaultValue,
    actions: actions$1,
    reducer: reducer$1,
    saga: saga$1
};

function parseV1(json) {
    const obj = JSON.parse(json);
    const { version, text } = obj;
    console.assert(version === 1);
    return text;
}

function toJSONV1(text) {
    const version = 1;
    return JSON.stringify({ version, text });
}

const PULL$1 = 'FILELIST/PULL';
const PUSH$1 = 'FILELIST/PUSH';

const UPDATE_FILE_LIST_STATE = 'FILELIST/UPDATE_FILE_LIST_STATE';
const PULL_OK$1 = 'FILELIST/PULL_OK';
const PULL_ERR$1 = 'FILELIST/PULL_ERR';
const PUSH_OK$1 = 'FILELIST/PUSH_OK';
const PUSH_ERR$1 = 'FILELIST/PUSH_ERR';

const actions$2 = {
    updateFileListState: fileListState => ({
        type: UPDATE_FILE_LIST_STATE,
        fileListState
    }),
    pull_ok: json => ({
        type: PULL_OK$1,
        json
    }),
    pull_err: info => ({
        type: PULL_ERR$1,
        info
    }),
    push_ok: () => ({
        type: PUSH_OK$1
    }),
    push_err: info => ({
        type: PUSH_ERR$1,
        info
    }),
    cmd: {
        pull: loader => ({
            type: PULL$1,
            loader
        }),
        push: saver => ({
            type: PUSH$1,
            saver
        })
    }
};

function update_fileListState(old, { fileListState }) {
    return fileListState;
}

function pull_ok$1(old, { json }) {
    return FileListState.fromJSON(json);
}

function pull_err$1(old, { info }) {
    console.error(info);
    return old;
}

function push_ok$1(old) {
    return old;
}

function push_err$1(old, { info }) {
    console.error(info);
    return old;
}

const reducer$2 = createReducers({
    [UPDATE_FILE_LIST_STATE]: update_fileListState,
    [PULL_OK$1]: pull_ok$1,
    [PULL_ERR$1]: pull_err$1,
    [PUSH_OK$1]: push_ok$1,
    [PUSH_ERR$1]: push_err$1
}, FileListState.createEmpty());

function* pull$1({ loader }) {
    const start = function (workid) {
        console.log('reading', workid);
        return loader();
    };
    const onOk = function* (workid, json) {
        if (json) {
            const text = parseV1$1(json);
            if (text) {
                yield put(actions$2.pull_ok(text));
            }
        }
    };
    const onError = function* (id, info) {
        yield put(actions$2.push_err(info));
    };
    yield put(main.actions.read('fileList', start, onOk, onError));
}

function* push$1({ saver }) {
    const getFileList = state => state.fileList;
    const fileList = yield select(getFileList);
    const text = JSON.stringify(fileList);
    const json = toJSONV1$1(text);

    const start = workid => {
        console.log('saving', workid);
        return saver(json);
    };
    const onOk = function* () {
        yield put(actions$2.push_ok());
    };
    const onError = function* () {
        yield put(actions$2.push_err());
    };
    yield put(main.actions.write('fileList', start, onOk, onError));
}

function* saga$2() {
    yield takeLatest(PULL$1, pull$1);
    yield takeLatest(PUSH$1, push$1);
}

var FileList = {
    actions: actions$2,
    reducer: reducer$2,
    saga: saga$2
};

function parseV1$1(json) {
    const obj = JSON.parse(json);
    const { version, text } = obj;
    console.assert(version === 1);
    return text;
}

function toJSONV1$1(text) {
    const version = 1;
    return JSON.stringify({ version, text });
}

const ENABLE = 'FILE_SHARE/ENABLE';
const DISABLE = 'FILE_SHARE/DISABLE';

const CREATE = 'FILE_SHARE/CREATE';
const REMOVE = 'FILE_SHARE/REMOVE';

const SET_REQ = 'FILE_SHARE/SET_REQ';
const SET_OK = 'FILE_SHARE/SET_OK';
const SET_ERR = 'FILE_SHARE/SET_ERR';
const GET_REQ = 'FILE_SHARE/GET_REQ';
const GET_OK = 'FILE_SHARE/GET_OK';
const GET_ERR = 'FILE_SHARE/GET_ERR';

const SET = 'FILE_SHARE/SET';
const GET = 'FILE_SHARE/GET';

function defaultValue$1() {
    return Immutable.fromJS({
        shareidList: [],
        fileid: '',
        shareOptions: {}, //shareid => Options
        syncing: false
    });
}

function defaultOptions() {
    return Immutable.fromJS({
        shareid: '',
        fileid: '',
        enable: true
    });
}

const actions$3 = {
    enable: shareid => ({
        type: ENABLE,
        shareid
    }),
    disable: shareid => ({
        type: DISABLE,
        shareid
    }),
    create: (fileid, shareid) => ({
        type: CREATE,
        fileid,
        shareid
    }),
    remove: shareid => ({
        type: REMOVE,
        shareid
    }),
    set: (shareid, setShare) => ({
        type: SET,
        shareid,
        setShare
    }),
    get: (fileid, getShare) => ({
        type: GET,
        fileid,
        getShare
    }),
    set_req: () => ({
        type: SET_REQ
    }),
    set_ok: () => ({
        type: SET_OK
    }),
    set_err: info => ({
        type: SET_ERR,
        info
    }),
    get_req: () => ({
        type: GET_REQ
    }),
    get_ok: shareOptionsList => ({
        type: GET_OK,
        shareOptionsList
    }),
    get_err: info => ({
        type: GET_ERR,
        info
    })
};

function enable(fileShare, { shareid }) {
    return fileShare.setIn(['shareOptions', shareid, 'enable'], true);
}

function disable(fileShare, { shareid }) {
    return fileShare.setIn(['shareOptions', shareid, 'enable'], false);
}

function create(fileShare, { fileid, shareid }) {
    const options = defaultOptions().set('fileid', fileid).set('shareid', shareid);
    return fileShare.withMutations(m => {
        m.set('fileid', fileid);
        m.setIn(['shareOptions', shareid], options);
        m.update('shareidList', l => {
            return l.push(shareid);
        });
    });
}

function remove(fileShare, { shareid }) {
    return fileShare.withMutations(m => {
        const index = m.get('shareidList').findIndex(id => id === shareid);
        m.removeIn(['shareidList', index]);
        m.removeIn(['shareOptions', shareid]);
    });
}

function set_req(old) {
    return old.set('syncing', true);
}

function set_ok(old) {
    return old.set('syncing', false);
}

function set_err(old, { info }) {
    console.error(info);
    return old.set('syncing', false);
}

function get_req(old) {
    return old.set('syncing', true);
}

function get_ok(old, { shareOptionsList }) {
    console.warn(shareOptionsList.toJS());
    const list = shareOptionsList.map(so => so.get('shareid'));
    const shareOptions = Immutable.Map().withMutations(m => {
        shareOptionsList.forEach(so => {
            m.set(so.get('shareid'), so);
        });
    });

    return old.update('shareOptions', s => s.mergeDeep(shareOptions)).set('shareidList', list).set('syncing', false);
}

function get_err(old, { info }) {
    console.error(info);
    return old.set('syncing', false);
}

function* set({ shareid, setShare }) {
    const getShareOptions = state => state.fileShare.get('shareOptions');
    const shareOptions = yield select(getShareOptions);
    const options = shareOptions.get(shareid);
    const fileid = options.get('fileid');
    try {
        yield put(actions$3.set_req());
        yield call(setShare, shareid, fileid, JSON.stringify(options));
        yield put(actions$3.set_ok());
    } catch (e) {
        yield put(actions$3.set_err(e));
    }
}

function* get({ fileid, getShare }) {
    try {
        yield put(actions$3.get_req());
        const shareOptionsList = yield call(getShare, fileid);
        const l = shareOptionsList.map(o => {
            return JSON.parse(o);
        });
        yield put(actions$3.get_ok(Immutable.fromJS(l)));
    } catch (e) {
        yield put(actions$3.get_err(e));
    }
}

const reducer$3 = createReducers({
    [ENABLE]: enable,
    [DISABLE]: disable,
    [CREATE]: create,
    [REMOVE]: remove,
    [SET_REQ]: set_req,
    [SET_OK]: set_ok,
    [SET_ERR]: set_err,
    [GET_REQ]: get_req,
    [GET_OK]: get_ok,
    [GET_ERR]: get_err
}, defaultValue$1());

function* saga$3() {
    yield takeLatest(SET, set);
    yield takeLatest(GET, get);
}

var FileShare = {
    defaultValue: defaultValue$1,
    actions: actions$3,
    reducer: reducer$3,
    saga: saga$3
};

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};





function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var hproseHtml5_src = createCommonjsModule(function (module) {
// Hprose for HTML5 v2.0.36
// Copyright (c) 2008-2016 http://hprose.com
// Hprose is freely distributable under the MIT license.
// For all details and documentation:
// https://github.com/hprose/hprose-html5

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Init.js                                                *
 *                                                        *
 * hprose init for HTML5.                                 *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

var hprose = Object.create(null);

/* global global, window, self */
hprose.global = (
    // Among the various tricks for obtaining a reference to the global
    // object, this seems to be the most reliable technique that does not
    // use indirect eval (which violates Content Security Policy).
    typeof commonjsGlobal === "object" ? commonjsGlobal :
    typeof window === "object" ? window :
    typeof self === "object" ? self : commonjsGlobal
);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Helper.js                                              *
 *                                                        *
 * hprose helper for HTML5.                               *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, undefined) {
    function generic(method) {
        if (typeof method !== "function") {
            throw new TypeError(method + " is not a function");
        }
        return function(context) {
            return method.apply(context, Array.prototype.slice.call(arguments, 1));
        };
    }

    var arrayLikeObjectArgumentsEnabled = true;

    try {
        String.fromCharCode.apply(String, new Uint8Array([1]));
    }
    catch (e) {
        arrayLikeObjectArgumentsEnabled = false;
    }

    function toArray(arrayLikeObject) {
        var n = arrayLikeObject.length;
        var a = new Array(n);
        for (var i = 0; i < n; ++i) {
            a[i] = arrayLikeObject[i];
        }
        return a;
    }

    var getCharCodes = arrayLikeObjectArgumentsEnabled ? function(bytes) { return bytes; } : toArray;

    function toBinaryString(bytes) {
        if (bytes instanceof ArrayBuffer) {
            bytes = new Uint8Array(bytes);
        }
        var n = bytes.length;
        if (n < 0xFFFF) {
            return String.fromCharCode.apply(String, getCharCodes(bytes));
        }
        var remain = n & 0x7FFF;
        var count = n >> 15;
        var a = new Array(remain ? count + 1 : count);
        for (var i = 0; i < count; ++i) {
            a[i] = String.fromCharCode.apply(String, getCharCodes(bytes.subarray(i << 15, (i + 1) << 15)));
        }
        if (remain) {
            a[count] = String.fromCharCode.apply(String, getCharCodes(bytes.subarray(count << 15, n)));
        }
        return a.join('');
    }

    function toUint8Array(bs) {
        var n = bs.length;
        var data = new Uint8Array(n);
        for (var i = 0; i < n; i++) {
            data[i] = bs.charCodeAt(i) & 0xFF;
        }
        return data;
    }

    var parseuri = function(url) {
        var pattern = new RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?");
        var matches =  url.match(pattern);
        var host = matches[4].split(':', 2);
        return {
            protocol: matches[1],
            host: matches[4],
            hostname: host[0],
            port: parseInt(host[1], 10) || 0,
            path: matches[5],
            query: matches[7],
            fragment: matches[9]
        };
    };

    var isObjectEmpty = function (obj) {
        if (obj) {
            var prop;
            for (prop in obj) {
                return false;
            }
        }
        return true;
    };

    hprose.generic = generic;
    hprose.toBinaryString = toBinaryString;
    hprose.toUint8Array = toUint8Array;
    hprose.toArray = toArray;
    hprose.parseuri = parseuri;
    hprose.isObjectEmpty = isObjectEmpty;

})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Polyfill.js                                            *
 *                                                        *
 * Polyfill for JavaScript.                               *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (generic, undefined) {
    if (!Function.prototype.bind) {
        Object.defineProperty(Function.prototype, 'bind', { value: function(oThis) {
            if (typeof this !== 'function') {
                throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
            }
            var aArgs   = Array.prototype.slice.call(arguments, 1),
                toBind = this,
                NOP    = function() {},
                bound  = function() {
                    return toBind.apply(this instanceof NOP ? this : oThis,
                            aArgs.concat(Array.prototype.slice.call(arguments)));
                };
            if (this.prototype) {
                NOP.prototype = this.prototype;
            }
            bound.prototype = new NOP();
            return bound;
        } });
    }
    /* Array */
    if (!Array.prototype.includes) {
        Object.defineProperty(Array.prototype, 'includes', { value: function(searchElement /*, fromIndex*/ ) {
            var O = Object(this);
            var len = parseInt(O.length, 10) || 0;
            if (len === 0) {
                return false;
            }
            var n = parseInt(arguments[1], 10) || 0;
            var k;
            if (n >= 0) {
                k = n;
            }
            else {
                k = len + n;
                if (k < 0) { k = 0; }
            }
            var currentElement;
            while (k < len) {
                currentElement = O[k];
                if (searchElement === currentElement ||
                    (searchElement !== searchElement && currentElement !== currentElement)) { // NaN !== NaN
                    return true;
                }
                k++;
            }
            return false;
        } });
    }
    if (!Array.prototype.find) {
        Object.defineProperty(Array.prototype, 'find', { value: function(predicate) {
            if (this === null || this === undefined) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;
            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        } });
    }
    if (!Array.prototype.findIndex) {
        Object.defineProperty(Array.prototype, 'findIndex', { value: function(predicate) {
            if (this === null || this === undefined) {
                throw new TypeError('Array.prototype.findIndex called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return i;
                }
            }
            return -1;
        } });
    }
    if (!Array.prototype.fill) {
        Object.defineProperty(Array.prototype, 'fill', { value: function(value) {
            if (this === null || this === undefined) {
                throw new TypeError('this is null or not defined');
            }
            var O = Object(this);
            var len = O.length >>> 0;
            var start = arguments[1];
            var relativeStart = start >> 0;
            var k = relativeStart < 0 ? Math.max(len + relativeStart, 0) : Math.min(relativeStart, len);
            var end = arguments[2];
            var relativeEnd = end === undefined ? len : end >> 0;
            var f = relativeEnd < 0 ? Math.max(len + relativeEnd, 0) : Math.min(relativeEnd, len);

            while (k < f) {
                O[k] = value;
                k++;
            }
            return O;
        } });
    }
    if (!Array.prototype.copyWithin) {
        Object.defineProperty(Array.prototype, 'copyWithin', { value: function(target, start/*, end*/) {
            if (this === null || this === undefined) {
                throw new TypeError('this is null or not defined');
            }
            var O = Object(this);
            var len = O.length >>> 0;
            var relativeTarget = target >> 0;
            var to = relativeTarget < 0 ? Math.max(len + relativeTarget, 0) : Math.min(relativeTarget, len);
            var relativeStart = start >> 0;
            var from = relativeStart < 0 ? Math.max(len + relativeStart, 0) : Math.min(relativeStart, len);
            var end = arguments[2];
            var relativeEnd = end === undefined ? len : end >> 0;
            var f = relativeEnd < 0 ? Math.max(len + relativeEnd, 0) : Math.min(relativeEnd, len);
            var count = Math.min(f - from, len - to);
            var direction = 1;
            if (from < to && to < (from + count)) {
                direction = -1;
                from += count - 1;
                to += count - 1;
            }
            while (count > 0) {
                if (from in O) {
                    O[to] = O[from];
                }
                else {
                    delete O[to];
                }
                from += direction;
                to += direction;
                count--;
            }
            return O;
        } });
    }
    if (!Array.from) {
        Object.defineProperty(Array, 'from', { value: (function() {
            var toStr = Object.prototype.toString;
            var isCallable = function(fn) {
                return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
            };
            var toInteger = function(value) {
                var number = Number(value);
                if (isNaN(number)) { return 0; }
                if (number === 0 || !isFinite(number)) { return number; }
                return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
            };
            var maxSafeInteger = Math.pow(2, 53) - 1;
            var toLength = function(value) {
                var len = toInteger(value);
                return Math.min(Math.max(len, 0), maxSafeInteger);
            };

            return function(arrayLike/*, mapFn, thisArg */) {
                var C = this;
                var items = Object(arrayLike);
                if (arrayLike === null || arrayLike === undefined) {
                    throw new TypeError("Array.from requires an array-like object - not null or undefined");
                }
                var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
                var T;
                if (typeof mapFn !== 'undefined') {
                    if (!isCallable(mapFn)) {
                        throw new TypeError('Array.from: when provided, the second argument must be a function');
                    }
                    if (arguments.length > 2) {
                        T = arguments[2];
                    }
                }
                var len = toLength(items.length);
                var A = isCallable(C) ? Object(new C(len)) : new Array(len);
                var k = 0;
                var kValue;
                while (k < len) {
                    kValue = items[k];
                    if (mapFn) {
                        A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                    }
                    else {
                        A[k] = kValue;
                    }
                    k += 1;
                }
                A.length = len;
                return A;
            };
        }()) });
    }
    if (!Array.of) {
        Object.defineProperty(Array, 'of', { value: function() {
            return Array.prototype.slice.call(arguments);
        } });
    }
    /* String */
    if (!String.prototype.startsWith) {
        Object.defineProperty(String.prototype, 'startsWith', { value: function(searchString, position){
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        } });
    }
    if (!String.prototype.endsWith) {
        Object.defineProperty(String.prototype, 'endsWith', { value: function(searchString, position) {
            var subjectString = this.toString();
            if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
                position = subjectString.length;
            }
            position -= searchString.length;
            var lastIndex = subjectString.indexOf(searchString, position);
            return lastIndex !== -1 && lastIndex === position;
        } });
    }
    if (!String.prototype.includes) {
        Object.defineProperty(String.prototype, 'includes', { value: function() {
            if (typeof arguments[1] === "number") {
                if (this.length < arguments[0].length + arguments[1].length) {
                    return false;
                }
                else {
                    return this.substr(arguments[1], arguments[0].length) === arguments[0];
                }
            }
            else {
                return String.prototype.indexOf.apply(this, arguments) !== -1;
            }
        } });
    }
    if (!String.prototype.repeat) {
        Object.defineProperty(String.prototype, 'repeat', { value: function(count) {
            var str = this.toString();
            count = +count;
            if (count !== count) {
                count = 0;
            }
            if (count < 0) {
                throw new RangeError('repeat count must be non-negative');
            }
            if (count === Infinity) {
                throw new RangeError('repeat count must be less than infinity');
            }
            count = Math.floor(count);
            if (str.length === 0 || count === 0) {
                return '';
            }
            // Ensuring count is a 31-bit integer allows us to heavily optimize the
            // main part. But anyway, most current (August 2014) browsers can't handle
            // strings 1 << 28 chars or longer, so:
            if (str.length * count >= 1 << 28) {
              throw new RangeError('repeat count must not overflow maximum string size');
            }
            var rpt = '';
            for (;;) {
                if ((count & 1) === 1) {
                    rpt += str;
                }
                count >>>= 1;
                if (count === 0) {
                    break;
                }
                str += str;
            }
            // Could we try:
            // return Array(count + 1).join(this);
            return rpt;
        } });
    }
    if (!String.prototype.trim) {
        Object.defineProperty(String.prototype, 'trim', { value: function() {
            return this.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
        } });
    }
    if (!String.prototype.trimLeft) {
        Object.defineProperty(String.prototype, 'trimLeft', { value: function() {
            return this.toString().replace(/^[\s\xa0]+/, '');
        } });
    }
    if (!String.prototype.trimRight) {
        Object.defineProperty(String.prototype, 'trimRight', { value: function() {
            return this.toString().replace(/[\s\xa0]+$/, '');
        } });
    }
    /* Object */
    if (!Object.keys) {
        Object.defineProperty(Object, 'keys', { value: (function () {
            var hasOwnProperty = Object.prototype.hasOwnProperty,
                hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
                dontEnums = [
                    'toString',
                    'toLocaleString',
                    'valueOf',
                    'hasOwnProperty',
                    'isPrototypeOf',
                    'propertyIsEnumerable',
                    'constructor'
                ],
                dontEnumsLength = dontEnums.length;
            return function (obj) {
                if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) {
                    throw new TypeError('Object.keys called on non-object');
                }
                var result = [];
                for (var prop in obj) {
                    if (hasOwnProperty.call(obj, prop)) {
                        result.push(prop);
                    }
                }
                if (hasDontEnumBug) {
                    for (var i=0; i < dontEnumsLength; i++) {
                        if (hasOwnProperty.call(obj, dontEnums[i])) {
                            result.push(dontEnums[i]);
                        }
                    }
                }
                return result;
            };
        })() });
    }

    function genericMethods(obj, properties) {
        var proto = obj.prototype;
        for (var i = 0, len = properties.length; i < len; i++) {
            var property = properties[i];
            var method = proto[property];
            if (typeof method === 'function' && typeof obj[property] === 'undefined') {
                Object.defineProperty(obj, property, { value: generic(method) });
            }
        }
    }
    genericMethods(Array, [
        "pop",
        "push",
        "reverse",
        "shift",
        "sort",
        "splice",
        "unshift",
        "concat",
        "join",
        "slice",
        "indexOf",
        "lastIndexOf",
        "filter",
        "forEach",
        "every",
        "map",
        "some",
        "reduce",
        "reduceRight",
        "includes",
        "find",
        "findIndex"
    ]);
    genericMethods(String, [
        'quote',
        'substring',
        'toLowerCase',
        'toUpperCase',
        'charAt',
        'charCodeAt',
        'indexOf',
        'lastIndexOf',
        'include',
        'startsWith',
        'endsWith',
        'repeat',
        'trim',
        'trimLeft',
        'trimRight',
        'toLocaleLowerCase',
        'toLocaleUpperCase',
        'match',
        'search',
        'replace',
        'split',
        'substr',
        'concat',
        'slice'
    ]);

})(hprose.generic);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * HarmonyMaps.js                                         *
 *                                                        *
 * Harmony Maps for HTML5.                                *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (global) {
    var hasWeakMap = 'WeakMap' in global;
    var hasMap = 'Map' in global;
    var hasForEach = true;

    if (hasMap) {
        hasForEach = 'forEach' in new global.Map();
    }

    if (hasWeakMap && hasMap && hasForEach) { return; }

    var namespaces = Object.create(null);
    var count = 0;
    var reDefineValueOf = function (obj) {
        var privates = Object.create(null);
        var baseValueOf = obj.valueOf;
        Object.defineProperty(obj, 'valueOf', {
            value: function (namespace, n) {
                    if ((this === obj) &&
                        (n in namespaces) &&
                        (namespaces[n] === namespace)) {
                        if (!(n in privates)) {
                            privates[n] = Object.create(null);
                        }
                        return privates[n];
                    }
                    else {
                        return baseValueOf.apply(this, arguments);
                    }
                },
            writable: true,
            configurable: true,
            enumerable: false
        });
    };

    if (!hasWeakMap) {
        global.WeakMap = function WeakMap() {
            var namespace = Object.create(null);
            var n = count++;
            namespaces[n] = namespace;
            var map = function (key) {
                if (key !== Object(key)) {
                    throw new Error('value is not a non-null object');
                }
                var privates = key.valueOf(namespace, n);
                if (privates !== key.valueOf()) {
                    return privates;
                }
                reDefineValueOf(key);
                return key.valueOf(namespace, n);
            };
            var m = Object.create(WeakMap.prototype, {
                get: {
                    value: function (key) {
                        return map(key).value;
                    }
                },
                set: {
                    value: function (key, value) {
                        map(key).value = value;
                    }
                },
                has: {
                    value: function (key) {
                        return 'value' in map(key);
                    }
                },
                'delete': {
                    value: function (key) {
                        return delete map(key).value;
                    }
                },
                clear: {
                    value: function () {
                        delete namespaces[n];
                        n = count++;
                        namespaces[n] = namespace;
                    }
                }
            });
            if (arguments.length > 0 && Array.isArray(arguments[0])) {
                var iterable = arguments[0];
                for (var i = 0, len = iterable.length; i < len; i++) {
                    m.set(iterable[i][0], iterable[i][1]);
                }
            }
            return m;
        };
    }

    if (!hasMap) {
        var objectMap = function () {
            var namespace = Object.create(null);
            var n = count++;
            var nullMap = Object.create(null);
            namespaces[n] = namespace;
            var map = function (key) {
                if (key === null) { return nullMap; }
                var privates = key.valueOf(namespace, n);
                if (privates !== key.valueOf()) { return privates; }
                reDefineValueOf(key);
                return key.valueOf(namespace, n);
            };
            return {
                get: function (key) { return map(key).value; },
                set: function (key, value) { map(key).value = value; },
                has: function (key) { return 'value' in map(key); },
                'delete': function (key) { return delete map(key).value; },
                clear: function () {
                    delete namespaces[n];
                    n = count++;
                    namespaces[n] = namespace;
                }
            };
        };
        var noKeyMap = function () {
            var map = Object.create(null);
            return {
                get: function () { return map.value; },
                set: function (_, value) { map.value = value; },
                has: function () { return 'value' in map; },
                'delete': function () { return delete map.value; },
                clear: function () { map = Object.create(null); }
            };
        };
        var scalarMap = function () {
            var map = Object.create(null);
            return {
                get: function (key) { return map[key]; },
                set: function (key, value) { map[key] = value; },
                has: function (key) { return key in map; },
                'delete': function (key) { return delete map[key]; },
                clear: function () { map = Object.create(null); }
            };
        };
        global.Map = function Map() {
            var map = {
                'number': scalarMap(),
                'string': scalarMap(),
                'boolean': scalarMap(),
                'object': objectMap(),
                'function': objectMap(),
                'unknown': objectMap(),
                'undefined': noKeyMap(),
                'null': noKeyMap()
            };
            var size = 0;
            var keys = [];
            var m = Object.create(Map.prototype, {
                size: {
                    get : function () { return size; }
                },
                get: {
                    value: function (key) {
                        return map[typeof(key)].get(key);
                    }
                },
                set: {
                    value: function (key, value) {
                        if (!this.has(key)) {
                            keys.push(key);
                            size++;
                        }
                        map[typeof(key)].set(key, value);
                    }
                },
                has: {
                    value: function (key) {
                        return map[typeof(key)].has(key);
                    }
                },
                'delete': {
                    value: function (key) {
                        if (this.has(key)) {
                            size--;
                            keys.splice(keys.indexOf(key), 1);
                            return map[typeof(key)]['delete'](key);
                        }
                        return false;
                    }
                },
                clear: {
                    value: function () {
                        keys.length = 0;
                        for (var key in map) { map[key].clear(); }
                        size = 0;
                    }
                },
                forEach: {
                    value: function (callback, thisArg) {
                        for (var i = 0, n = keys.length; i < n; i++) {
                            callback.call(thisArg, this.get(keys[i]), keys[i], this);
                        }
                    }
                }
            });
            if (arguments.length > 0 && Array.isArray(arguments[0])) {
                var iterable = arguments[0];
                for (var i = 0, len = iterable.length; i < len; i++) {
                    m.set(iterable[i][0], iterable[i][1]);
                }
            }
            return m;
        };
    }

    if (!hasForEach) {
        var OldMap = global.Map;
        global.Map = function Map() {
            var map = new OldMap();
            var size = 0;
            var keys = [];
            var m = Object.create(Map.prototype, {
                size: {
                    get : function () { return size; }
                },
                get: {
                    value: function (key) {
                        return map.get(key);
                    }
                },
                set: {
                    value: function (key, value) {
                        if (!map.has(key)) {
                            keys.push(key);
                            size++;
                        }
                        map.set(key, value);
                    }
                },
                has: {
                    value: function (key) {
                        return map.has(key);
                    }
                },
                'delete': {
                    value: function (key) {
                        if (map.has(key)) {
                            size--;
                            keys.splice(keys.indexOf(key), 1);
                            return map['delete'](key);
                        }
                        return false;
                    }
                },
                clear: {
                    value: function () {
                        if ('clear' in map) {
                            map.clear();
                        }
                        else {
                            for (var i = 0, n = keys.length; i < n; i++) {
                                map['delete'](keys[i]);
                            }
                        }
                        keys.length = 0;
                        size = 0;
                    }
                },
                forEach: {
                    value: function (callback, thisArg) {
                        for (var i = 0, n = keys.length; i < n; i++) {
                            callback.call(thisArg, this.get(keys[i]), keys[i], this);
                        }
                    }
                }
            });
            if (arguments.length > 0 && Array.isArray(arguments[0])) {
                var iterable = arguments[0];
                for (var i = 0, len = iterable.length; i < len; i++) {
                    m.set(iterable[i][0], iterable[i][1]);
                }
            }
            return m;
        };
    }
})(hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * TimeoutError.js                                        *
 *                                                        *
 * TimeoutError for HTML5.                                *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function(global) {
    function TimeoutError(message) {
        Error.call(this);
        this.message = message;
        this.name = TimeoutError.name;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, TimeoutError);
        }
    }
    TimeoutError.prototype = Object.create(Error.prototype);
    TimeoutError.prototype.constructor = TimeoutError;
    global.TimeoutError = TimeoutError;
})(hprose.global);
/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * setImmediate.js                                        *
 *                                                        *
 * setImmediate for HTML5.                                *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function(global, undefined) {
    if (global.setImmediate) { return; }

    var doc = global.document;
    var MutationObserver = global.MutationObserver || global.WebKitMutationObserver || global.MozMutationOvserver;
    var polifill = {};
    var nextId = 1;
    var tasks = {};

    function wrap(handler) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function() {
            handler.apply(undefined, args);
        };
    }

    function clear(handleId) {
        delete tasks[handleId];
    }

    function run(handleId) {
        var task = tasks[handleId];
        if (task) {
            try {
                task();
            }
            finally {
                clear(handleId);
            }
        }
    }

    function create(args) {
        tasks[nextId] = wrap.apply(undefined, args);
        return nextId++;
    }

    polifill.mutationObserver = function() {
        var queue = [],
            node = doc.createTextNode(''),
            observer = new MutationObserver(function() {
                while (queue.length > 0) {
                    run(queue.shift());
                }
            });

        observer.observe(node, {"characterData": true});

        return function() {
            var handleId = create(arguments);
            queue.push(handleId);
            node.data = handleId & 1;
            return handleId;
        };
    };

    polifill.messageChannel = function() {
        var channel$$1 = new global.MessageChannel();

        channel$$1.port1.onmessage = function(event) {
            run(Number(event.data));
        };

        return function() {
            var handleId = create(arguments);
            channel$$1.port2.postMessage(handleId);
            return handleId;
        };
    };

    polifill.nextTick = function() {
        return function() {
            var handleId = create(arguments);
            global.process.nextTick( wrap( run, handleId ) );
            return handleId;
        };
    };

    polifill.postMessage = function() {
        var iframe = doc.createElement('iframe');
        iframe.style.display = 'none';
        doc.documentElement.appendChild(iframe);
        var iwin = iframe.contentWindow;
        iwin.document.write('<script>window.onmessage=function(){parent.postMessage(1, "*");};</script>');
        iwin.document.close();
        var queue = [];
        window.addEventListener('message', function() {
            while (queue.length > 0) {
                run(queue.shift());
            }
        });
        return function() {
            var handleId = create(arguments);
            queue.push(handleId);
            iwin.postMessage(1, "*");
            return handleId;
        };
    };

    polifill.readyStateChange = function() {
        var html = doc.documentElement;

        return function() {
            var handleId = create(arguments);
            var script = doc.createElement('script');

            script.onreadystatechange = function() {
                run(handleId);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };

            html.appendChild(script);

            return handleId;
        };
    };

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = (attachTo && attachTo.setTimeout ? attachTo : global);

    polifill.setTimeout = function() {
        return function() {
            var handleId = create(arguments);
            attachTo.setTimeout( wrap( run, handleId ), 0 );
            return handleId;
        };
    };

    // Don't get fooled by e.g. browserify environments.
    // For Node.js before 0.9
    if (typeof(global.process) !== 'undefined' &&
        Object.prototype.toString.call(global.process) === '[object process]' &&
        !global.process.browser) {
        attachTo.setImmediate = polifill.nextTick();
    }
    // For IE 6–9
    else if (doc && ('onreadystatechange' in doc.createElement('script'))) {
        attachTo.setImmediate = polifill.readyStateChange();
    }
    // For MutationObserver, where supported
    else if (doc && MutationObserver) {
        attachTo.setImmediate = polifill.mutationObserver();
    }
    // For web workers, where supported
    else if (global.MessageChannel) {
        attachTo.setImmediate = polifill.messageChannel();
    }
    // For non-IE modern browsers
    else if (doc && 'postMessage' in global && 'addEventListener' in global) {
        attachTo.setImmediate = polifill.postMessage();
    }
    // For older browsers
    else {
        attachTo.setImmediate = polifill.setTimeout();
    }

    attachTo.clearImmediate = clear;
})(hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Future.js                                              *
 *                                                        *
 * hprose Future for HTML5.                               *
 *                                                        *
 * LastModified: Dec 5, 2016                              *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var PENDING = 0;
    var FULFILLED = 1;
    var REJECTED = 2;

    var hasPromise = 'Promise' in global;
    var setImmediate = global.setImmediate;
    var setTimeout = global.setTimeout;
    var clearTimeout = global.clearTimeout;
    var TimeoutError = global.TimeoutError;

    var foreach = Array.prototype.forEach;
    var slice = Array.prototype.slice;

    function Future(computation) {
        var self = this;
        Object.defineProperties(this, {
            _subscribers: { value: [] },
            resolve: { value: this.resolve.bind(this) },
            reject: { value: this.reject.bind(this) }
        });
        if (typeof computation === 'function') {
            setImmediate(function() {
                try {
                    self.resolve(computation());
                }
                catch(e) {
                    self.reject(e);
                }
            });
        }
    }

    function isFuture(obj) {
        return obj instanceof Future;
    }

    function toFuture(obj) {
        return isFuture(obj) ? obj : value(obj);
    }

    function isPromise(obj) {
        return 'function' === typeof obj.then;
    }

    function delayed(duration, value) {
        var computation = (typeof value === 'function') ?
                          value :
                          function() { return value; };
        var future = new Future();
        setTimeout(function() {
            try {
                future.resolve(computation());
            }
            catch(e) {
                future.reject(e);
            }
        }, duration);
        return future;
    }

    function error(e) {
        var future = new Future();
        future.reject(e);
        return future;
    }

    function value(v) {
        var future = new Future();
        future.resolve(v);
        return future;
    }

    function sync(computation) {
        try {
            var result = computation();
            return value(result);
        }
        catch(e) {
            return error(e);
        }
    }

    function promise(executor) {
        var future = new Future();
        executor(future.resolve, future.reject);
        return future;
    }

    function arraysize(array) {
        var size = 0;
        foreach.call(array, function() { ++size; });
        return size;
    }

    function all(array) {
        return toFuture(array).then(function(array) {
            var n = array.length;
            var count = arraysize(array);
            var result = new Array(n);
            if (count === 0) { return result; }
            var future = new Future();
            foreach.call(array, function(element, index) {
                toFuture(element).then(function(value) {
                    result[index] = value;
                    if (--count === 0) {
                        future.resolve(result);
                    }
                },
                future.reject);
            });
            return future;
        });
    }

    function join$$1() {
        return all(arguments);
    }

    function race(array) {
        return toFuture(array).then(function(array) {
            var future = new Future();
            foreach.call(array, function(element) {
                toFuture(element).fill(future);
            });
            return future;
        });
    }

    function any(array) {
        return toFuture(array).then(function(array) {
            var n = array.length;
            var count = arraysize(array);
            if (count === 0) {
                throw new RangeError('any(): array must not be empty');
            }
            var reasons = new Array(n);
            var future = new Future();
            foreach.call(array, function(element, index) {
                toFuture(element).then(future.resolve, function(e) {
                    reasons[index] = e;
                    if (--count === 0) {
                        future.reject(reasons);
                    }
                });
            });
            return future;
        });
    }

    function settle(array) {
        return toFuture(array).then(function(array) {
            var n = array.length;
            var count = arraysize(array);
            var result = new Array(n);
            if (count === 0) { return result; }
            var future = new Future();
            foreach.call(array, function(element, index) {
                var f = toFuture(element);
                f.complete(function() {
                    result[index] = f.inspect();
                    if (--count === 0) {
                        future.resolve(result);
                    }
                });
            });
            return future;
        });
    }

    function attempt(handler/*, arg1, arg2, ... */) {
        var thisArg = (function() { return this; })();
        var args = slice.call(arguments, 1);
        return all(args).then(function(args) {
            return handler.apply(thisArg, args);
        });
    }

    function run(handler, thisArg/*, arg1, arg2, ... */) {
        var args = slice.call(arguments, 2);
        return all(args).then(function(args) {
            return handler.apply(thisArg, args);
        });
    }

    function isGenerator(obj) {
        if (!obj) {
            return false;
        }
        return 'function' == typeof obj.next && 'function' == typeof obj['throw'];
    }

    function isGeneratorFunction(obj) {
        if (!obj) {
            return false;
        }
        var constructor = obj.constructor;
        if (!constructor) {
            return false;
        }
        if ('GeneratorFunction' === constructor.name ||
            'GeneratorFunction' === constructor.displayName) {
            return true;
        }
        return isGenerator(constructor.prototype);
    }

    function getThunkCallback(future) {
        return function(err, res) {
            if (err instanceof Error) {
                return future.reject(err);
            }
            if (arguments.length < 2) {
                return future.resolve(err);
            }
            if (err === null || err === undefined) {
                res = slice.call(arguments, 1);
            }
            else {
                res = slice.call(arguments, 0);
            }
            if (res.length == 1) {
                future.resolve(res[0]);
            }
            else {
                future.resolve(res);
            }
        };
    }

    function thunkToPromise(fn) {
        if (isGeneratorFunction(fn) || isGenerator(fn)) {
            return co(fn);
        }
        var thisArg = (function() { return this; })();
        var future = new Future();
        fn.call(thisArg, getThunkCallback(future));
        return future;
    }

    function thunkify(fn) {
        return function() {
            var args = slice.call(arguments, 0);
            var thisArg = this;
            var results = new Future();
            args.push(function() {
                thisArg = this;
                results.resolve(arguments);
            });
            try {
                fn.apply(this, args);
            }
            catch (err) {
                results.resolve([err]);
            }
            return function(done) {
                results.then(function(results) {
                    done.apply(thisArg, results);
                });
            };
        };
    }

    function promisify(fn) {
        return function() {
            var args = slice.call(arguments, 0);
            var future = new Future();
            args.push(getThunkCallback(future));
            try {
                fn.apply(this, args);
            }
            catch (err) {
                future.reject(err);
            }
            return future;
        };
    }

    function toPromise(obj) {
        if (isGeneratorFunction(obj) || isGenerator(obj)) {
            return co(obj);
        }
        return toFuture(obj);
    }

    function co(gen) {
        var thisArg = (function() { return this; })();
        if (typeof gen === 'function') {
            var args = slice.call(arguments, 1);
            gen = gen.apply(thisArg, args);
        }

        if (!gen || typeof gen.next !== 'function') {
            return toFuture(gen);
        }

        var future = new Future();

        function onFulfilled(res) {
            try {
                next(gen.next(res));
            }
            catch (e) {
                future.reject(e);
            }
        }

        function onRejected(err) {
            try {
                next(gen['throw'](err));
            }
            catch (e) {
                future.reject(e);
            }
        }

        function next(ret) {
            if (ret.done) {
                future.resolve(ret.value);
            }
            else {
                (('function' == typeof ret.value) ?
                thunkToPromise(ret.value) :
                toPromise(ret.value)).then(onFulfilled, onRejected);
            }
        }

        onFulfilled();

        return future;
    }

    function wrap(handler, thisArg) {
        return function() {
            thisArg = thisArg || this;
            return all(arguments).then(function(args) {
                var result = handler.apply(thisArg, args);
                if (isGeneratorFunction(result) || isGenerator(result)) {
                    return co.call(thisArg, result);
                }
                return result;
            });
        };
    }

    co.wrap = wrap;

    function forEach(array, callback, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.forEach(callback, thisArg);
        });
    }

    function every(array, callback, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.every(callback, thisArg);
        });
    }

    function some(array, callback, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.some(callback, thisArg);
        });
    }

    function filter(array, callback, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.filter(callback, thisArg);
        });
    }

    function map(array, callback, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.map(callback, thisArg);
        });
    }

    function reduce(array, callback, initialValue) {
        if (arguments.length > 2) {
            return all(array).then(function(array) {
                return toFuture(initialValue).then(function(value) {
                    return array.reduce(callback, value);
                });
            });
        }
        return all(array).then(function(array) {
            return array.reduce(callback);
        });
    }

    function reduceRight(array, callback, initialValue) {
        if (arguments.length > 2) {
            return all(array).then(function(array) {
                return toFuture(initialValue).then(function(value) {
                    return array.reduceRight(callback, value);
                });
            });
        }
        return all(array).then(function(array) {
            return array.reduceRight(callback);
        });
    }

    function indexOf(array, searchElement, fromIndex) {
        return all(array).then(function(array) {
            return toFuture(searchElement).then(function(searchElement) {
                return array.indexOf(searchElement, fromIndex);
            });
        });
    }

    function lastIndexOf(array, searchElement, fromIndex) {
        return all(array).then(function(array) {
            return toFuture(searchElement).then(function(searchElement) {
                if (fromIndex === undefined) {
                    fromIndex = array.length - 1;
                }
                return array.lastIndexOf(searchElement, fromIndex);
            });
        });
    }

    function includes(array, searchElement, fromIndex) {
        return all(array).then(function(array) {
            return toFuture(searchElement).then(function(searchElement) {
                return array.includes(searchElement, fromIndex);
            });
        });
    }

    function find(array, predicate, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.find(predicate, thisArg);
        });
    }

    function findIndex(array, predicate, thisArg) {
        thisArg = thisArg || (function() { return this; })();
        return all(array).then(function(array) {
            return array.findIndex(predicate, thisArg);
        });
    }

    Object.defineProperties(Future, {
        // port from Dart
        delayed: { value: delayed },
        error: { value: error },
        sync: { value: sync },
        value: { value: value },
        // Promise compatible
        all: { value: all },
        race: { value: race },
        resolve: { value: value },
        reject: { value: error },
        // extended methods
        promise: { value: promise },
        isFuture: { value: isFuture },
        toFuture: { value: toFuture },
        isPromise: { value: isPromise },
        toPromise: { value: toPromise },
        join: { value: join$$1 },
        any: { value: any },
        settle: { value: settle },
        attempt: { value: attempt },
        run: { value: run },
        thunkify: { value: thunkify },
        promisify: { value: promisify },
        co: { value: co },
        wrap: { value: wrap },
        // for array
        forEach: { value: forEach },
        every: { value: every },
        some: { value: some },
        filter: { value: filter },
        map: { value: map },
        reduce: { value: reduce },
        reduceRight: { value: reduceRight },
        indexOf: { value: indexOf },
        lastIndexOf: { value: lastIndexOf },
        includes: { value: includes },
        find: { value: find },
        findIndex: { value: findIndex }
    });

    function _call(callback, next, x) {
        setImmediate(function() {
            try {
                var r = callback(x);
                next.resolve(r);
            }
            catch(e) {
                next.reject(e);
            }
        });
    }

    function _resolve(onfulfill, next, x) {
        if (onfulfill) {
            _call(onfulfill, next, x);
        }
        else {
            next.resolve(x);
        }
    }

    function _reject(onreject, next, e) {
        if (onreject) {
            _call(onreject, next, e);
        }
        else {
            next.reject(e);
        }
    }

    Object.defineProperties(Future.prototype, {
        _value: { writable: true },
        _reason: { writable: true },
        _state: { value: PENDING, writable: true },
        resolve: { value: function(value) {
            if (value === this) {
                this.reject(new TypeError('Self resolution'));
                return;
            }
            if (isFuture(value)) {
                value.fill(this);
                return;
            }
            if ((value !== null) &&
                (typeof value === 'object') ||
                (typeof value === 'function')) {
                var then;
                try {
                    then = value.then;
                }
                catch (e) {
                    this.reject(e);
                    return;
                }
                if (typeof then === 'function') {
                    var notrun = true;
                    try {
                        var self = this;
                        then.call(value, function(y) {
                            if (notrun) {
                                notrun = false;
                                self.resolve(y);
                            }
                        }, function(r) {
                            if (notrun) {
                                notrun = false;
                                self.reject(r);
                            }
                        });
                        return;
                    }
                    catch (e) {
                        if (notrun) {
                            notrun = false;
                            this.reject(e);
                        }
                    }
                    return;
                }
            }
            if (this._state === PENDING) {
                this._state = FULFILLED;
                this._value = value;
                var subscribers = this._subscribers;
                while (subscribers.length > 0) {
                    var subscriber = subscribers.shift();
                    _resolve(subscriber.onfulfill, subscriber.next, value);
                }
            }
        } },
        reject: { value: function(reason) {
            if (this._state === PENDING) {
                this._state = REJECTED;
                this._reason = reason;
                var subscribers = this._subscribers;
                while (subscribers.length > 0) {
                    var subscriber = subscribers.shift();
                    _reject(subscriber.onreject, subscriber.next, reason);
                }
            }
        } },
        then: { value: function(onfulfill, onreject) {
            if (typeof onfulfill !== 'function') { onfulfill = null; }
            if (typeof onreject !== 'function') { onreject = null; }
            var next = new Future();
            if (this._state === FULFILLED) {
                _resolve(onfulfill, next, this._value);
            }
            else if (this._state === REJECTED) {
                _reject(onreject, next, this._reason);
            }
            else {
                this._subscribers.push({
                    onfulfill: onfulfill,
                    onreject: onreject,
                    next: next
                });
            }
            return next;
        } },
        done: { value: function(onfulfill, onreject) {
            this.then(onfulfill, onreject).then(null, function(error) {
                setImmediate(function() { throw error; });
            });
        } },
        inspect: { value: function() {
            switch (this._state) {
                case PENDING: return { state: 'pending' };
                case FULFILLED: return { state: 'fulfilled', value: this._value };
                case REJECTED: return { state: 'rejected', reason: this._reason };
            }
        } },
        catchError: { value: function(onreject, test) {
            if (typeof test === 'function') {
                var self = this;
                return this['catch'](function(e) {
                    if (test(e)) {
                        return self['catch'](onreject);
                    }
                    else {
                        throw e;
                    }
                });
            }
            return this['catch'](onreject);
        } },
        'catch': { value: function(onreject) {
            return this.then(null, onreject);
        } },
        fail: { value: function(onreject) {
            this.done(null, onreject);
        } },
        whenComplete: { value: function(action) {
            return this.then(
                function(v) { action(); return v; },
                function(e) { action(); throw e; }
            );
        } },
        complete: { value: function(oncomplete) {
            oncomplete = oncomplete || function(v) { return v; };
            return this.then(oncomplete, oncomplete);
        } },
        always: { value: function(oncomplete) {
           this.done(oncomplete, oncomplete);
        } },
        fill: { value: function(future) {
           this.then(future.resolve, future.reject);
        } },
        timeout: { value: function(duration, reason) {
            var future = new Future();
            var timeoutId = setTimeout(function() {
                future.reject(reason || new TimeoutError('timeout'));
            }, duration);
            this.whenComplete(function() { clearTimeout(timeoutId); })
                .fill(future);
            return future;
        } },
        delay: { value: function(duration) {
            var future = new Future();
            this.then(function(result) {
                setTimeout(function() {
                    future.resolve(result);
                }, duration);
            },
            future.reject);
            return future;
        } },
        tap: { value: function(onfulfilledSideEffect, thisArg) {
            return this.then(function(result) {
                onfulfilledSideEffect.call(thisArg, result);
                return result;
            });
        } },
        spread: { value: function(onfulfilledArray, thisArg) {
            return this.then(function(array) {
                return onfulfilledArray.apply(thisArg, array);
            });
        } },
        get: { value: function(key) {
            return this.then(function(result) {
                return result[key];
            });
        } },
        set: { value: function(key, value) {
            return this.then(function(result) {
                result[key] = value;
                return result;
            });
        } },
        apply: { value: function(method, args) {
            args = args || [];
            return this.then(function(result) {
                return all(args).then(function(args) {
                    return result[method].apply(result, args);
                });
            });
        } },
        call: { value: function(method) {
            var args = slice.call(arguments, 1);
            return this.then(function(result) {
                return all(args).then(function(args) {
                    return result[method].apply(result, args);
                });
            });
        } },
        bind: { value: function(method) {
            var bindargs = slice.call(arguments);
            if (Array.isArray(method)) {
                for (var i = 0, n = method.length; i < n; ++i) {
                    bindargs[0] = method[i];
                    this.bind.apply(this, bindargs);
                }
                return;
            }
            bindargs.shift();
            var self = this;
            Object.defineProperty(this, method, { value: function() {
                var args = slice.call(arguments);
                return self.then(function(result) {
                    return all(bindargs.concat(args)).then(function(args) {
                        return result[method].apply(result, args);
                    });
                });
            } });
            return this;
        } },
        forEach: { value: function(callback, thisArg) {
            return forEach(this, callback, thisArg);
        } },
        every: { value: function(callback, thisArg) {
            return every(this, callback, thisArg);
        } },
        some: { value: function(callback, thisArg) {
            return some(this, callback, thisArg);
        } },
        filter: { value: function(callback, thisArg) {
            return filter(this, callback, thisArg);
        } },
        map: { value: function(callback, thisArg) {
            return map(this, callback, thisArg);
        } },
        reduce: { value: function(callback, initialValue) {
            if (arguments.length > 1) {
                return reduce(this, callback, initialValue);
            }
            return reduce(this, callback);
        } },
        reduceRight: { value: function(callback, initialValue) {
            if (arguments.length > 1) {
                return reduceRight(this, callback, initialValue);
            }
            return reduceRight(this, callback);
        } },
        indexOf: { value: function(searchElement, fromIndex) {
            return indexOf(this, searchElement, fromIndex);
        } },
        lastIndexOf: { value: function(searchElement, fromIndex) {
            return lastIndexOf(this, searchElement, fromIndex);
        } },
        includes: { value: function(searchElement, fromIndex) {
            return includes(this, searchElement, fromIndex);
        } },
        find: { value: function(predicate, thisArg) {
            return find(this, predicate, thisArg);
        } },
        findIndex: { value: function(predicate, thisArg) {
            return findIndex(this, predicate, thisArg);
        } }
    });

    hprose.Future = Future;

    hprose.thunkify = thunkify;
    hprose.promisify = promisify;
    hprose.co = co;
    hprose.co.wrap = hprose.wrap = wrap;

    function Completer() {
        var future = new Future();
        Object.defineProperties(this, {
            future: { value: future },
            complete: { value: future.resolve },
            completeError: { value: future.reject },
            isCompleted: { get: function() {
                return ( future._state !== PENDING );
            } }
        });
    }

    hprose.Completer = Completer;

    hprose.resolved = value;

    hprose.rejected = error;

    hprose.deferred = function() {
        var self = new Future();
        return Object.create(null, {
            promise: { value: self },
            resolve: { value: self.resolve },
            reject: { value: self.reject }
        });
    };

    if (hasPromise) { return; }

    function MyPromise(executor) {
        Future.call(this);
        executor(this.resolve, this.reject);
    }

    MyPromise.prototype = Object.create(Future.prototype);
    MyPromise.prototype.constructor = Future;

    Object.defineProperties(MyPromise, {
        all: { value: all },
        race: { value: race },
        resolve: { value: value },
        reject: { value: error }
    });

    global.Promise = MyPromise;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * BytesIO.js                                             *
 *                                                        *
 * hprose BytesIO for HTML5.                              *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, undefined) {
    var toBinaryString = hprose.toBinaryString;

    var _EMPTY_BYTES = new Uint8Array(0);
    var _INIT_SIZE = 1024;

    function writeInt32BE(bytes, p, i) {
        bytes[p++] = i >>> 24 & 0xFF;
        bytes[p++] = i >>> 16 & 0xFF;
        bytes[p++] = i >>> 8  & 0xFF;
        bytes[p++] = i        & 0xFF;
        return p;
    }

    function writeInt32LE(bytes, p, i) {
        bytes[p++] = i        & 0xFF;
        bytes[p++] = i >>> 8  & 0xFF;
        bytes[p++] = i >>> 16 & 0xFF;
        bytes[p++] = i >>> 24 & 0xFF;
        return p;
    }

    function writeString(bytes, p, str) {
        var n = str.length;
        for (var i = 0; i < n; ++i) {
            var codeUnit = str.charCodeAt(i);
            if (codeUnit < 0x80) {
                bytes[p++] = codeUnit;
            }
            else if (codeUnit < 0x800) {
                bytes[p++] = 0xC0 | (codeUnit >> 6);
                bytes[p++] = 0x80 | (codeUnit & 0x3F);
            }
            else if (codeUnit < 0xD800 || codeUnit > 0xDFFF) {
                bytes[p++] = 0xE0 | (codeUnit >> 12);
                bytes[p++] = 0x80 | ((codeUnit >> 6) & 0x3F);
                bytes[p++] = 0x80 | (codeUnit & 0x3F);
            }
            else {
                if (i + 1 < n) {
                    var nextCodeUnit = str.charCodeAt(i + 1);
                    if (codeUnit < 0xDC00 && 0xDC00 <= nextCodeUnit && nextCodeUnit <= 0xDFFF) {
                        var rune = (((codeUnit & 0x03FF) << 10) | (nextCodeUnit & 0x03FF)) + 0x010000;
                        bytes[p++] = 0xF0 | (rune >> 18);
                        bytes[p++] = 0x80 | ((rune >> 12) & 0x3F);
                        bytes[p++] = 0x80 | ((rune >> 6) & 0x3F);
                        bytes[p++] = 0x80 | (rune & 0x3F);
                        ++i;
                        continue;
                    }
                }
                throw new Error('Malformed string');
            }
        }
        return p;
    }

    function readShortString(bytes, n) {
        var charCodes = new Array(n);
        var i = 0, off = 0;
        for (var len = bytes.length; i < n && off < len; i++) {
            var unit = bytes[off++];
            switch (unit >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                charCodes[i] = unit;
                break;
            case 12:
            case 13:
                if (off < len) {
                    charCodes[i] = ((unit & 0x1F) << 6) |
                                    (bytes[off++] & 0x3F);
                    break;
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            case 14:
                if (off + 1 < len) {
                    charCodes[i] = ((unit & 0x0F) << 12) |
                                   ((bytes[off++] & 0x3F) << 6) |
                                   (bytes[off++] & 0x3F);
                    break;
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            case 15:
                if (off + 2 < len) {
                    var rune = (((unit & 0x07) << 18) |
                                ((bytes[off++] & 0x3F) << 12) |
                                ((bytes[off++] & 0x3F) << 6) |
                                (bytes[off++] & 0x3F)) - 0x10000;
                    if (0 <= rune && rune <= 0xFFFFF) {
                        charCodes[i++] = (((rune >> 10) & 0x03FF) | 0xD800);
                        charCodes[i] = ((rune & 0x03FF) | 0xDC00);
                        break;
                    }
                    throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16));
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            default:
                throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16));
            }
        }
        if (i < n) {
            charCodes.length = i;
        }
        return [String.fromCharCode.apply(String, charCodes), off];
    }

    function readLongString(bytes, n) {
        var buf = [];
        var charCodes = new Array(0x8000);
        var i = 0, off = 0;
        for (var len = bytes.length; i < n && off < len; i++) {
            var unit = bytes[off++];
            switch (unit >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                charCodes[i] = unit;
                break;
            case 12:
            case 13:
                if (off < len) {
                    charCodes[i] = ((unit & 0x1F) << 6) |
                                    (bytes[off++] & 0x3F);
                    break;
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            case 14:
                if (off + 1 < len) {
                    charCodes[i] = ((unit & 0x0F) << 12) |
                                   ((bytes[off++] & 0x3F) << 6) |
                                   (bytes[off++] & 0x3F);
                    break;
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            case 15:
                if (off + 2 < len) {
                    var rune = (((unit & 0x07) << 18) |
                                ((bytes[off++] & 0x3F) << 12) |
                                ((bytes[off++] & 0x3F) << 6) |
                                (bytes[off++] & 0x3F)) - 0x10000;
                    if (0 <= rune && rune <= 0xFFFFF) {
                        charCodes[i++] = (((rune >> 10) & 0x03FF) | 0xD800);
                        charCodes[i] = ((rune & 0x03FF) | 0xDC00);
                        break;
                    }
                    throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16));
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            default:
                throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16));
            }
            if (i >= 0x7FFF - 1) {
                var size = i + 1;
                charCodes.length = size;
                buf.push(String.fromCharCode.apply(String, charCodes));
                n -= size;
                i = -1;
            }
        }
        if (i > 0) {
            charCodes.length = i;
            buf.push(String.fromCharCode.apply(String, charCodes));
        }
        return [buf.join(''), off];
    }

    function readString(bytes, n) {
        if (n === undefined || n === null || (n < 0)) { n = bytes.length; }
        if (n === 0) { return ['', 0]; }
        return ((n < 0xFFFF) ?
                readShortString(bytes, n) :
                readLongString(bytes, n));
    }

    function readStringAsBytes(bytes, n) {
        if (n === undefined) { n = bytes.length; }
        if (n === 0) { return [_EMPTY_BYTES, 0]; }
        var i = 0, off = 0;
        for (var len = bytes.length; i < n && off < len; i++) {
            var unit = bytes[off++];
            switch (unit >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                break;
            case 12:
            case 13:
                if (off < len) {
                    off++;
                    break;
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            case 14:
                if (off + 1 < len) {
                    off += 2;
                    break;
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            case 15:
                if (off + 2 < len) {
                    var rune = (((unit & 0x07) << 18) |
                                ((bytes[off++] & 0x3F) << 12) |
                                ((bytes[off++] & 0x3F) << 6) |
                                (bytes[off++] & 0x3F)) - 0x10000;
                    if (0 <= rune && rune <= 0xFFFFF) {
                        i++;
                        break;
                    }
                    throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16));
                }
                throw new Error('Unfinished UTF-8 octet sequence');
            default:
                throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16));
            }
        }
        return [bytes.subarray(0, off), off];
    }

    function pow2roundup(x) {
        --x;
        x |= x >> 1;
        x |= x >> 2;
        x |= x >> 4;
        x |= x >> 8;
        x |= x >> 16;
        return x + 1;
    }

    function BytesIO() {
        var a = arguments;
        switch (a.length) {
        case 1:
            switch (a[0].constructor) {
            case Uint8Array:
                this._bytes = a[0];
                this._length = a[0].length;
                break;
            case BytesIO:
                this._bytes = a[0].toBytes();
                this._length = a[0].length;
                break;
            case String:
                this.writeString(a[0]);
                break;
            case Number:
                this._bytes = new Uint8Array(a[0]);
                break;
            default:
                this._bytes = new Uint8Array(a[0]);
                this._length = this._bytes.length;
                break;
            }
            break;
        case 2:
            this._bytes = new Uint8Array(a[0], a[1]);
            this._length = a[1];
            break;
        case 3:
            this._bytes = new Uint8Array(a[0], a[1], a[2]);
            this._length = a[2];
            break;
        }
        this.mark();
    }

    Object.defineProperties(BytesIO.prototype, {
        _bytes: { value: null, writable: true },
        _length: { value: 0, writable: true },
        _wmark: { value: 0, writable: true },
        _off: { value: 0, writable: true },
        _rmark: { value: 0, writable: true },
        _grow: { value: function(n) {
            var bytes = this._bytes;
            var required = this._length + n;
            var size = pow2roundup(required);
            if (bytes) {
                size *= 2;
                if (size > bytes.length) {
                    var buf = new Uint8Array(size);
                    buf.set(bytes);
                    this._bytes = buf;
                }
            }
            else {
                size = Math.max(size, _INIT_SIZE);
                this._bytes = new Uint8Array(size);
            }
        } },
        length: { get: function() { return this._length; } },
        capacity: { get: function() {
            return this._bytes ? this._bytes.length : 0;
        } },
        position: { get: function() { return this._off; } },
        // returns a view of the the internal buffer.
        bytes: { get : function() {
            return (this._bytes === null) ?
                    _EMPTY_BYTES :
                    this._bytes.subarray(0, this._length);
        } },
        buffer: { get : function() {
            if (this._bytes === null) {
                return _EMPTY_BYTES.buffer;
            }
            if (this._bytes.buffer.slice) {
                return this._bytes.buffer.slice(0, this._length);
            }
            var buf = new Uint8Array(this._length);
            buf.set(this._bytes.subarray(0, this._length));
            return buf.buffer;
        } },
        mark: { value: function() {
            this._wmark = this._length;
            this._rmark = this._off;
        } },
        reset: { value: function() {
            this._length = this._wmark;
            this._off = this._rmark;
        } },
        clear: { value: function() {
            this._bytes = null;
            this._length = 0;
            this._wmark = 0;
            this._off = 0;
            this._rmark = 0;
        } },
        writeByte: { value: function(b) {
            this._grow(1);
            this._bytes[this._length++] = b;
        } },
        writeInt32BE: { value: function(i) {
            if ((i === (i | 0)) && (i <= 2147483647)) {
                this._grow(4);
                this._length = writeInt32BE(this._bytes, this._length, i);
                return;
            }
            throw new TypeError('value is out of bounds');
        } },
        writeUInt32BE: { value: function(i) {
            if (((i & 0x7FFFFFFF) + 0x80000000 === i) && (i >= 0)) {
                this._grow(4);
                this._length = writeInt32BE(this._bytes, this._length, i | 0);
                return;
            }
            throw new TypeError('value is out of bounds');
        } },
        writeInt32LE: { value: function(i) {
            if ((i === (i | 0)) && (i <= 2147483647)) {
                this._grow(4);
                this._length = writeInt32LE(this._bytes, this._length, i);
                return;
            }
            throw new TypeError('value is out of bounds');
        } },
        writeUInt32LE: { value: function(i) {
            if (((i & 0x7FFFFFFF) + 0x80000000 === i) && (i >= 0)) {
                this._grow(4);
                this._length = writeInt32LE(this._bytes, this._length, i | 0);
                return;
            }
            throw new TypeError('value is out of bounds');
        } },
        write: { value: function(data) {
            var n = data.byteLength || data.length;
            if (n === 0) { return; }
            this._grow(n);
            var bytes = this._bytes;
            var length = this._length;
            switch (data.constructor) {
            case ArrayBuffer:
                bytes.set(new Uint8Array(data), length);
                break;
            case Uint8Array:
                bytes.set(data, length);
                break;
            case BytesIO:
                bytes.set(data.bytes, length);
                break;
            default:
                for (var i = 0; i < n; i++) {
                    bytes[length + i] = data[i];
                }
                break;
            }
            this._length += n;
        } },
        writeAsciiString: { value: function(str) {
            var n = str.length;
            if (n === 0) { return; }
            this._grow(n);
            var bytes = this._bytes;
            var l = this._length;
            for (var i = 0; i < n; ++i, ++l) {
                bytes[l] = str.charCodeAt(i);
            }
            this._length = l;
        } },
        writeString: { value: function(str) {
            var n = str.length;
            if (n === 0) { return; }
            // A single code unit uses at most 3 bytes.
            // Two code units at most 4.
            this._grow(n * 3);
            this._length = writeString(this._bytes, this._length, str);
        } },
        readByte: { value: function() {
            if (this._off < this._length) {
                return this._bytes[this._off++];
            }
            return -1;
        } },
        readInt32BE: { value: function() {
            var bytes = this._bytes;
            var off = this._off;
            if (off + 3 < this._length) {
                var result = bytes[off++] << 24 |
                             bytes[off++] << 16 |
                             bytes[off++] << 8  |
                             bytes[off++];
                this._off = off;
                return result;
            }
            throw new Error('EOF');
        } },
        readUInt32BE: { value: function() {
            var value = this.readInt32BE();
            if (value < 0) {
                return (value & 0x7FFFFFFF) + 0x80000000;
            }
            return value;
        } },
        readInt32LE: { value: function() {
            var bytes = this._bytes;
            var off = this._off;
            if (off + 3 < this._length) {
                var result = bytes[off++]       |
                             bytes[off++] << 8  |
                             bytes[off++] << 16 |
                             bytes[off++] << 24;
                this._off = off;
                return result;
            }
            throw new Error('EOF');
        } },
        readUInt32LE: { value: function() {
            var value = this.readInt32LE();
            if (value < 0) {
                return (value & 0x7FFFFFFF) + 0x80000000;
            }
            return value;
        } },
        read: { value: function(n) {
            if (this._off + n > this._length) {
                n = this._length - this._off;
            }
            if (n === 0) { return _EMPTY_BYTES; }
            return this._bytes.subarray(this._off, this._off += n);
        } },
        skip: { value: function(n) {
            if (this._off + n > this._length) {
                n = this._length - this._off;
                this._off = this._length;
            }
            else {
                this._off += n;
            }
            return n;
        } },
        // the result is an Uint8Array, and includes tag.
        readBytes: { value: function(tag) {
            var pos = Array.indexOf(this._bytes, tag, this._off);
            var buf;
            if (pos === -1) {
                buf = this._bytes.subarray(this._off, this._length);
                this._off = this._length;
            }
            else {
                buf = this._bytes.subarray(this._off, pos + 1);
                this._off = pos + 1;
            }
            return buf;
        } },
        // the result is a String, and doesn't include tag.
        // but the position is the same as readBytes
        readUntil: { value: function(tag) {
            var pos = Array.indexOf(this._bytes, tag, this._off);
            var str = '';
            if (pos === this._off) {
                this._off++;
            }
            else if (pos === -1) {
                str = readString(this._bytes.subarray(this._off, this._length))[0];
                this._off = this._length;
            }
            else {
                str = readString(this._bytes.subarray(this._off, pos))[0];
                this._off = pos + 1;
            }
            return str;
        } },
        readAsciiString: { value: function(n) {
            if (this._off + n > this._length) {
                n = this._length - this._off;
            }
            if (n === 0) { return ''; }
            return toBinaryString(this._bytes.subarray(this._off, this._off += n));
        } },
        // n is the UTF16 length
        readStringAsBytes: { value: function(n) {
            var r = readStringAsBytes(this._bytes.subarray(this._off, this._length), n);
            this._off += r[1];
            return r[0];
        } },
        // n is the UTF16 length
        readString: { value: function(n) {
            var r = readString(this._bytes.subarray(this._off, this._length), n);
            this._off += r[1];
            return r[0];
        } },
        // returns a view of the the internal buffer and clears `this`.
        takeBytes: { value: function() {
            var buffer = this.bytes;
            this.clear();
            return buffer;
        } },
        // returns a copy of the current contents and leaves `this` intact.
        toBytes: { value: function() {
            return new Uint8Array(this.bytes);
        } },
        toString: { value: function() {
            return readString(this.bytes, this._length)[0];
        } },
        clone: { value: function() {
            return new BytesIO(this.toBytes());
        } },
        trunc: { value: function() {
            this._bytes = this._bytes.subarray(this._off, this._length);
            this._length = this._bytes.length;
            this._off = 0;
            this._wmark = 0;
            this._rmark = 0;
        } }
    });

    function toString(data) {
        /* jshint -W086 */
        if (data.length === 0) { return ''; }
        switch(data.constructor) {
        case String: return data;
        case BytesIO: data = data.bytes;
        case ArrayBuffer: data = new Uint8Array(data);
        case Uint8Array: return readString(data, data.length)[0];
        default: return String.fromCharCode.apply(String, data);
        }
    }

    Object.defineProperty(BytesIO, 'toString', { value: toString });

    hprose.BytesIO = BytesIO;

})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * Tags.js                                                *
 *                                                        *
 * hprose tags enum for HTML5.                            *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose) {
    hprose.Tags = {
        /* Serialize Tags */
        TagInteger     : 0x69, //  'i'
        TagLong        : 0x6C, //  'l'
        TagDouble      : 0x64, //  'd'
        TagNull        : 0x6E, //  'n'
        TagEmpty       : 0x65, //  'e'
        TagTrue        : 0x74, //  't'
        TagFalse       : 0x66, //  'f'
        TagNaN         : 0x4E, //  'N'
        TagInfinity    : 0x49, //  'I'
        TagDate        : 0x44, //  'D'
        TagTime        : 0x54, //  'T'
        TagUTC         : 0x5A, //  'Z'
        TagBytes       : 0x62, //  'b'
        TagUTF8Char    : 0x75, //  'u'
        TagString      : 0x73, //  's'
        TagGuid        : 0x67, //  'g'
        TagList        : 0x61, //  'a'
        TagMap         : 0x6d, //  'm'
        TagClass       : 0x63, //  'c'
        TagObject      : 0x6F, //  'o'
        TagRef         : 0x72, //  'r'
        /* Serialize Marks */
        TagPos         : 0x2B, //  '+'
        TagNeg         : 0x2D, //  '-'
        TagSemicolon   : 0x3B, //  ','
        TagOpenbrace   : 0x7B, //  '{'
        TagClosebrace  : 0x7D, //  '}'
        TagQuote       : 0x22, //  '"'
        TagPoint       : 0x2E, //  '.'
        /* Protocol Tags */
        TagFunctions   : 0x46, //  'F'
        TagCall        : 0x43, //  'C'
        TagResult      : 0x52, //  'R'
        TagArgument    : 0x41, //  'A'
        TagError       : 0x45, //  'E'
        TagEnd         : 0x7A  //  'z'
    };
})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * ClassManager.js                                        *
 *                                                        *
 * hprose ClassManager for HTML5.                         *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global) {
    var WeakMap = global.WeakMap;

    var classCache = Object.create(null);
    var aliasCache = new WeakMap();

    function register(cls, alias) {
        aliasCache.set(cls, alias);
        classCache[alias] = cls;
    }

    function getClassAlias(cls) {
        return aliasCache.get(cls);
    }

    function getClass(alias) {
        return classCache[alias];
    }

    hprose.ClassManager = Object.create(null, {
        register: { value: register },
        getClassAlias: { value: getClassAlias },
        getClass: { value: getClass }
    });

    hprose.register = register;

    register(Object, 'Object');

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Writer.js                                              *
 *                                                        *
 * hprose Writer for HTML5.                               *
 *                                                        *
 * LastModified: Feb 13, 2017                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var Map = global.Map;
    var BytesIO = hprose.BytesIO;
    var Tags = hprose.Tags;
    var ClassManager = hprose.ClassManager;

    function getClassName(obj) {
        var cls = obj.constructor;
        if (!cls) {
            return 'Object';
        }
        var classname = ClassManager.getClassAlias(cls);
        if (classname) { return classname; }
        if (cls.name) {
            classname = cls.name;
        }
        else {
            var ctor = cls.toString();
            classname = ctor.substr(0, ctor.indexOf('(')).replace(/(^\s*function\s*)|(\s*$)/ig, '');
            if (classname === '' || classname === 'Object') {
                return (typeof(obj.getClassName) === 'function') ? obj.getClassName() : 'Object';
            }
        }
        if (classname !== 'Object') {
            ClassManager.register(cls, classname);
        }
        return classname;
    }

    var fakeWriterRefer = Object.create(null, {
        set: { value: function () {} },
        write: { value: function () { return false; } },
        reset: { value: function () {} }
    });

    function RealWriterRefer(stream) {
        Object.defineProperties(this, {
            _stream: { value: stream },
            _ref: { value: new Map(), writable: true }
        });
    }

    Object.defineProperties(RealWriterRefer.prototype, {
        _refcount: { value: 0, writable: true },
        set: { value: function (val) {
            this._ref.set(val, this._refcount++);
        } },
        write: { value: function (val) {
            var index = this._ref.get(val);
            if (index !== undefined) {
                this._stream.writeByte(Tags.TagRef);
                this._stream.writeString('' + index);
                this._stream.writeByte(Tags.TagSemicolon);
                return true;
            }
            return false;
        } },
        reset: { value: function () {
            this._ref = new Map();
            this._refcount = 0;
        } }
    });

    function realWriterRefer(stream) {
        return new RealWriterRefer(stream);
    }

    function Writer(stream, simple) {
        Object.defineProperties(this, {
            stream: { value: stream },
            _classref: { value: Object.create(null), writable: true },
            _fieldsref: { value: [], writable: true },
            _refer: { value: simple ? fakeWriterRefer : realWriterRefer(stream) }
        });
    }

    function serialize(writer, value) {
        var stream = writer.stream;
        if (value === undefined || value === null) {
            stream.writeByte(Tags.TagNull);
            return;
        }
        switch (value.constructor) {
        case Function:
            stream.writeByte(Tags.TagNull);
            return;
        case Number:
            writeNumber(writer, value);
            return;
        case Boolean:
            writeBoolean(writer, value);
            return;
        case String:
            switch (value.length) {
            case 0:
                stream.writeByte(Tags.TagEmpty);
                return;
            case 1:
                stream.writeByte(Tags.TagUTF8Char);
                stream.writeString(value);
                return;
            }
            writer.writeStringWithRef(value);
            return;
        case Date:
            writer.writeDateWithRef(value);
            return;
        case Map:
            writer.writeMapWithRef(value);
            return;
        case ArrayBuffer:
        case Uint8Array:
        case BytesIO:
            writer.writeBytesWithRef(value);
            return;
        case Int8Array:
        case Int16Array:
        case Int32Array:
        case Uint16Array:
        case Uint32Array:
            writeIntListWithRef(writer, value);
            return;
        case Float32Array:
        case Float64Array:
            writeDoubleListWithRef(writer, value);
            return;
        default:
            if (Array.isArray(value)) {
                writer.writeListWithRef(value);
            }
            else {
                var classname = getClassName(value);
                if (classname === 'Object') {
                    writer.writeMapWithRef(value);
                }
                else {
                    writer.writeObjectWithRef(value);
                }
            }
            break;
        }
    }

    function writeNumber(writer, n) {
        var stream = writer.stream;
        n = n.valueOf();
        if (n === (n | 0)) {
            if (0 <= n && n <= 9) {
                stream.writeByte(n + 0x30);
            }
            else {
                stream.writeByte(Tags.TagInteger);
                stream.writeAsciiString('' + n);
                stream.writeByte(Tags.TagSemicolon);
            }
        }
        else if (isNaN(n)) {
            stream.writeByte(Tags.TagNaN);
        }
        else if (isFinite(n)) {
            stream.writeByte(Tags.TagDouble);
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagSemicolon);
        }
        else {
            stream.writeByte(Tags.TagInfinity);
            stream.writeByte((n > 0) ? Tags.TagPos : Tags.TagNeg);
        }
    }

    function writeInteger(writer, n) {
        var stream = writer.stream;
        if (0 <= n && n <= 9) {
            stream.writeByte(n + 0x30);
        }
        else {
            if (n < -2147483648 || n > 2147483647) {
                stream.writeByte(Tags.TagLong);
            }
            else {
                stream.writeByte(Tags.TagInteger);
            }
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagSemicolon);
        }
    }

    function writeDouble(writer, n) {
        var stream = writer.stream;
        if (isNaN(n)) {
            stream.writeByte(Tags.TagNaN);
        }
        else if (isFinite(n)) {
            stream.writeByte(Tags.TagDouble);
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagSemicolon);
        }
        else {
            stream.writeByte(Tags.TagInfinity);
            stream.writeByte((n > 0) ? Tags.TagPos : Tags.TagNeg);
        }
    }

    function writeBoolean(writer, b) {
        writer.stream.writeByte(b.valueOf() ? Tags.TagTrue : Tags.TagFalse);
    }

    function writeUTCDate(writer, date) {
        writer._refer.set(date);
        var stream = writer.stream;
        var year = ('0000' + date.getUTCFullYear()).slice(-4);
        var month = ('00' + (date.getUTCMonth() + 1)).slice(-2);
        var day = ('00' + date.getUTCDate()).slice(-2);
        var hour = ('00' + date.getUTCHours()).slice(-2);
        var minute = ('00' + date.getUTCMinutes()).slice(-2);
        var second = ('00' + date.getUTCSeconds()).slice(-2);
        var millisecond = ('000' + date.getUTCMilliseconds()).slice(-3);
        stream.writeByte(Tags.TagDate);
        stream.writeAsciiString(year + month + day);
        stream.writeByte(Tags.TagTime);
        stream.writeAsciiString(hour + minute + second);
        if (millisecond !== '000') {
            stream.writeByte(Tags.TagPoint);
            stream.writeAsciiString(millisecond);
        }
        stream.writeByte(Tags.TagUTC);
    }

    function writeDate(writer, date) {
        writer._refer.set(date);
        var stream = writer.stream;
        var year = ('0000' + date.getFullYear()).slice(-4);
        var month = ('00' + (date.getMonth() + 1)).slice(-2);
        var day = ('00' + date.getDate()).slice(-2);
        var hour = ('00' + date.getHours()).slice(-2);
        var minute = ('00' + date.getMinutes()).slice(-2);
        var second = ('00' + date.getSeconds()).slice(-2);
        var millisecond = ('000' + date.getMilliseconds()).slice(-3);
        if ((hour === '00') && (minute === '00') &&
            (second === '00') && (millisecond === '000')) {
            stream.writeByte(Tags.TagDate);
            stream.writeAsciiString(year + month + day);
        }
        else if ((year === '1970') && (month === '01') && (day === '01')) {
            stream.writeByte(Tags.TagTime);
            stream.writeAsciiString(hour + minute + second);
            if (millisecond !== '000') {
                stream.writeByte(Tags.TagPoint);
                stream.writeAsciiString(millisecond);
            }
        }
        else {
            stream.writeByte(Tags.TagDate);
            stream.writeAsciiString(year + month + day);
            stream.writeByte(Tags.TagTime);
            stream.writeAsciiString(hour + minute + second);
            if (millisecond !== '000') {
                stream.writeByte(Tags.TagPoint);
                stream.writeAsciiString(millisecond);
            }
        }
        stream.writeByte(Tags.TagSemicolon);
    }

    function writeTime(writer, time) {
        writer._refer.set(time);
        var stream = writer.stream;
        var hour = ('00' + time.getHours()).slice(-2);
        var minute = ('00' + time.getMinutes()).slice(-2);
        var second = ('00' + time.getSeconds()).slice(-2);
        var millisecond = ('000' + time.getMilliseconds()).slice(-3);
        stream.writeByte(Tags.TagTime);
        stream.writeAsciiString(hour + minute + second);
        if (millisecond !== '000') {
            stream.writeByte(Tags.TagPoint);
            stream.writeAsciiString(millisecond);
        }
        stream.writeByte(Tags.TagSemicolon);
    }

    function writeBytes(writer, bytes) {
        writer._refer.set(bytes);
        var stream = writer.stream;
        stream.writeByte(Tags.TagBytes);
        var n = bytes.byteLength || bytes.length;
        if (n > 0) {
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagQuote);
            stream.write(bytes);
        }
        else {
            stream.writeByte(Tags.TagQuote);
        }
        stream.writeByte(Tags.TagQuote);
    }

    function writeString(writer, str) {
        writer._refer.set(str);
        var stream = writer.stream;
        var n = str.length;
        stream.writeByte(Tags.TagString);
        if (n > 0) {
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagQuote);
            stream.writeString(str);
        }
        else {
            stream.writeByte(Tags.TagQuote);
        }
        stream.writeByte(Tags.TagQuote);
    }

    function writeArray(writer, array, writeElem) {
        writer._refer.set(array);
        var stream = writer.stream;
        var n = array.length;
        stream.writeByte(Tags.TagList);
        if (n > 0) {
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagOpenbrace);
            for (var i = 0; i < n; i++) {
                writeElem(writer, array[i]);
            }
        }
        else {
            stream.writeByte(Tags.TagOpenbrace);
        }
        stream.writeByte(Tags.TagClosebrace);
    }

    function writeIntListWithRef(writer, list) {
        if (!writer._refer.write(list)) {
            writeArray(writer, list, writeInteger);
        }
    }

    function writeDoubleListWithRef(writer, list) {
        if (!writer._refer.write(list)) {
            writeArray(writer, list, writeDouble);
        }
    }

    function writeMap(writer, map) {
        writer._refer.set(map);
        var stream = writer.stream;
        var fields = [];
        for (var key in map) {
            if (map.hasOwnProperty(key) &&
                typeof(map[key]) !== 'function') {
                fields[fields.length] = key;
            }
        }
        var n = fields.length;
        stream.writeByte(Tags.TagMap);
        if (n > 0) {
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagOpenbrace);
            for (var i = 0; i < n; i++) {
                serialize(writer, fields[i]);
                serialize(writer, map[fields[i]]);
            }
        }
        else {
            stream.writeByte(Tags.TagOpenbrace);
        }
        stream.writeByte(Tags.TagClosebrace);
    }

    function writeHarmonyMap(writer, map) {
        writer._refer.set(map);
        var stream = writer.stream;
        var n = map.size;
        stream.writeByte(Tags.TagMap);
        if (n > 0) {
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagOpenbrace);
            map.forEach(function(value, key) {
                serialize(writer, key);
                serialize(writer, value);
            });
        }
        else {
            stream.writeByte(Tags.TagOpenbrace);
        }
        stream.writeByte(Tags.TagClosebrace);
    }

    function writeObject(writer, obj) {
        var stream = writer.stream;
        var classname = getClassName(obj);
        var fields, index;
        if (classname in writer._classref) {
            index = writer._classref[classname];
            fields = writer._fieldsref[index];
        }
        else {
            fields = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key) &&
                    typeof(obj[key]) !== 'function') {
                    fields[fields.length] = key.toString();
                }
            }
            index = writeClass(writer, classname, fields);
        }
        stream.writeByte(Tags.TagObject);
        stream.writeAsciiString('' + index);
        stream.writeByte(Tags.TagOpenbrace);
        writer._refer.set(obj);
        var n = fields.length;
        for (var i = 0; i < n; i++) {
            serialize(writer, obj[fields[i]]);
        }
        stream.writeByte(Tags.TagClosebrace);
    }

    function writeClass(writer, classname, fields) {
        var stream = writer.stream;
        var n = fields.length;
        stream.writeByte(Tags.TagClass);
        stream.writeAsciiString('' + classname.length);
        stream.writeByte(Tags.TagQuote);
        stream.writeString(classname);
        stream.writeByte(Tags.TagQuote);
        if (n > 0) {
            stream.writeAsciiString('' + n);
            stream.writeByte(Tags.TagOpenbrace);
            for (var i = 0; i < n; i++) {
                writeString(writer, fields[i]);
            }
        }
        else {
            stream.writeByte(Tags.TagOpenbrace);
        }
        stream.writeByte(Tags.TagClosebrace);
        var index = writer._fieldsref.length;
        writer._classref[classname] = index;
        writer._fieldsref[index] = fields;
        return index;
    }

    Object.defineProperties(Writer.prototype, {
        serialize: { value: function(value) {
            serialize(this, value);
        } },
        writeInteger: { value: function(value) {
            writeInteger(this, value);
        } },
        writeDouble: { value: function(value) {
            writeDouble(this, value);
        } },
        writeBoolean: { value: function(value) {
            writeBoolean(this, value);
        } },
        writeUTCDate: { value: function(value) {
            writeUTCDate(this, value);
        } },
        writeUTCDateWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeUTCDate(this, value);
            }
        } },
        writeDate: { value: function(value) {
            writeDate(this, value);
        } },
        writeDateWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeDate(this, value);
            }
        } },
        writeTime: { value: function(value) {
            writeTime(this, value);
        } },
        writeTimeWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeTime(this, value);
            }
        } },
        writeBytes: { value: function(value) {
            writeBytes(this, value);
        } },
        writeBytesWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeBytes(this, value);
            }
        } },
        writeString: { value: function(value) {
            writeString(this, value);
        } },
        writeStringWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeString(this, value);
            }
        } },
        writeList: { value: function(value) {
            writeArray(this, value, serialize);
        } },
        writeListWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeArray(this, value, serialize);
            }
        } },
        writeMap: { value: function(value) {
            if (value instanceof Map) {
                writeHarmonyMap(this, value);
            }
            else {
                writeMap(this, value);
            }
        } },
        writeMapWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                if (value instanceof Map) {
                    writeHarmonyMap(this, value);
                }
                else {
                    writeMap(this, value);
                }
            }
        } },
        writeObject: { value: function(value) {
            writeObject(this, value);
        } },
        writeObjectWithRef: { value: function(value) {
            if (!this._refer.write(value)) {
                writeObject(this, value);
            }
        } },
        reset: { value: function() {
            this._classref = Object.create(null);
            this._fieldsref.length = 0;
            this._refer.reset();
        } }
    });

    hprose.Writer = Writer;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Reader.js                                              *
 *                                                        *
 * hprose Reader for HTML5.                               *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var Map = global.Map;
    var BytesIO = hprose.BytesIO;
    var Tags = hprose.Tags;
    var ClassManager = hprose.ClassManager;

    function unexpectedTag(tag, expectTags) {
        if (tag && expectTags) {
            var expectTagStr = '';
            if (typeof(expectTags) === 'number') {
                expectTagStr = String.fromCharCode(expectTags);
            }
            else {
                expectTagStr = String.fromCharCode.apply(String, expectTags);
            }
            throw new Error('Tag "' + expectTagStr + '" expected, but "' + String.fromCharCode(tag) + '" found in stream');
        }
        else if (tag) {
            throw new Error('Unexpected serialize tag "' + String.fromCharCode(tag) + '" in stream');
        }
        else {
            throw new Error('No byte found in stream');
        }
    }

    function readRaw(stream) {
        var ostream = new BytesIO();
        _readRaw(stream, ostream);
        return ostream.bytes;
    }

    function _readRaw(stream, ostream) {
        __readRaw(stream, ostream, stream.readByte());
    }

    function __readRaw(stream, ostream, tag) {
        ostream.writeByte(tag);
        switch (tag) {
            case 48:
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57:
            case Tags.TagNull:
            case Tags.TagEmpty:
            case Tags.TagTrue:
            case Tags.TagFalse:
            case Tags.TagNaN:
                break;
            case Tags.TagInfinity:
                ostream.writeByte(stream.readByte());
                break;
            case Tags.TagInteger:
            case Tags.TagLong:
            case Tags.TagDouble:
            case Tags.TagRef:
                readNumberRaw(stream, ostream);
                break;
            case Tags.TagDate:
            case Tags.TagTime:
                readDateTimeRaw(stream, ostream);
                break;
            case Tags.TagUTF8Char:
                readUTF8CharRaw(stream, ostream);
                break;
            case Tags.TagBytes:
                readBytesRaw(stream, ostream);
                break;
            case Tags.TagString:
                readStringRaw(stream, ostream);
                break;
            case Tags.TagGuid:
                readGuidRaw(stream, ostream);
                break;
            case Tags.TagList:
            case Tags.TagMap:
            case Tags.TagObject:
                readComplexRaw(stream, ostream);
                break;
            case Tags.TagClass:
                readComplexRaw(stream, ostream);
                _readRaw(stream, ostream);
                break;
            case Tags.TagError:
                _readRaw(stream, ostream);
                break;
            default: unexpectedTag(tag);
        }
    }
    function readNumberRaw(stream, ostream) {
        var tag;
        do {
            tag = stream.readByte();
            ostream.writeByte(tag);
        } while (tag !== Tags.TagSemicolon);
    }
    function readDateTimeRaw(stream, ostream) {
        var tag;
        do {
            tag = stream.readByte();
            ostream.writeByte(tag);
        } while (tag !== Tags.TagSemicolon &&
                 tag !== Tags.TagUTC);
    }
    function readUTF8CharRaw(stream, ostream) {
        ostream.writeString(stream.readString(1));
    }
    function readBytesRaw(stream, ostream) {
        var count = 0;
        var tag = 48;
        do {
            count *= 10;
            count += tag - 48;
            tag = stream.readByte();
            ostream.writeByte(tag);
        } while (tag !== Tags.TagQuote);
        ostream.write(stream.read(count + 1));
    }
    function readStringRaw(stream, ostream) {
        var count = 0;
        var tag = 48;
        do {
            count *= 10;
            count += tag - 48;
            tag = stream.readByte();
            ostream.writeByte(tag);
        } while (tag !== Tags.TagQuote);
        ostream.write(stream.readStringAsBytes(count + 1));
    }
    function readGuidRaw(stream, ostream) {
        ostream.write(stream.read(38));
    }
    function readComplexRaw(stream, ostream) {
        var tag;
        do {
            tag = stream.readByte();
            ostream.writeByte(tag);
        } while (tag !== Tags.TagOpenbrace);
        while ((tag = stream.readByte()) !== Tags.TagClosebrace) {
            __readRaw(stream, ostream, tag);
        }
        ostream.writeByte(tag);
    }

    function RawReader(stream) {
        Object.defineProperties(this, {
            stream: { value : stream },
            readRaw: { value: function() { return readRaw(stream); } }
        });
    }

    hprose.RawReader = RawReader;

    var fakeReaderRefer = Object.create(null, {
        set: { value: function() {} },
        read: { value: function() { unexpectedTag(Tags.TagRef); } },
        reset: { value: function() {} }
    });

    function RealReaderRefer() {
        Object.defineProperties(this, {
            ref: { value: [] }
        });
    }

    Object.defineProperties(RealReaderRefer.prototype, {
        set: { value: function(val) { this.ref.push(val); } },
        read: { value: function(index) { return this.ref[index]; } },
        reset: { value: function() { this.ref.length = 0; } }
    });

    function realReaderRefer() {
        return new RealReaderRefer();
    }

    function getter(str) {
        var obj = global;
        var names = str.split('.');
        var i;
        for (i = 0; i < names.length; i++) {
            obj = obj[names[i]];
            if (obj === undefined) {
                return null;
            }
        }
        return obj;
    }
    function findClass(cn, poslist, i, c) {
        if (i < poslist.length) {
            var pos = poslist[i];
            cn[pos] = c;
            var cls = findClass(cn, poslist, i + 1, '.');
            if (i + 1 < poslist.length) {
                if (cls === null) {
                    cls = findClass(cn, poslist, i + 1, '_');
                }
            }
            return cls;
        }
        var classname = cn.join('');
        try {
            var cl = getter(classname);
            return ((typeof(cl) === 'function') ? cl : null);
        } catch (e) {
            return null;
        }
    }

    function getClass(classname) {
        var cls = ClassManager.getClass(classname);
        if (cls) { return cls; }
        cls = getter(classname);
        if (typeof(cls) === 'function') {
            ClassManager.register(cls, classname);
            return cls;
        }
        var poslist = [];
        var pos = classname.indexOf('_');
        while (pos >= 0) {
            poslist[poslist.length] = pos;
            pos = classname.indexOf('_', pos + 1);
        }
        if (poslist.length > 0) {
            var cn = classname.split('');
            cls = findClass(cn, poslist, 0, '.');
            if (cls === null) {
                cls = findClass(cn, poslist, 0, '_');
            }
            if (typeof(cls) === 'function') {
                ClassManager.register(cls, classname);
                return cls;
            }
        }
        cls = function () {};
        Object.defineProperty(cls.prototype, 'getClassName', { value: function () {
            return classname;
        }});
        ClassManager.register(cls, classname);
        return cls;
    }


    function readInt(stream, tag) {
        var s = stream.readUntil(tag);
        if (s.length === 0) { return 0; }
        return parseInt(s, 10);
    }
    function unserialize(reader) {
        var stream = reader.stream;
        var tag = stream.readByte();
        switch (tag) {
            case 48:
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57: return tag - 48;
            case Tags.TagInteger: return readIntegerWithoutTag(stream);
            case Tags.TagLong: return readLongWithoutTag(stream);
            case Tags.TagDouble: return readDoubleWithoutTag(stream);
            case Tags.TagNull: return null;
            case Tags.TagEmpty: return '';
            case Tags.TagTrue: return true;
            case Tags.TagFalse: return false;
            case Tags.TagNaN: return NaN;
            case Tags.TagInfinity: return readInfinityWithoutTag(stream);
            case Tags.TagDate: return readDateWithoutTag(reader);
            case Tags.TagTime: return readTimeWithoutTag(reader);
            case Tags.TagBytes: return readBytesWithoutTag(reader);
            case Tags.TagUTF8Char: return readUTF8CharWithoutTag(reader);
            case Tags.TagString: return readStringWithoutTag(reader);
            case Tags.TagGuid: return readGuidWithoutTag(reader);
            case Tags.TagList: return readListWithoutTag(reader);
            case Tags.TagMap: return reader.useHarmonyMap ? readHarmonyMapWithoutTag(reader) : readMapWithoutTag(reader);
            case Tags.TagClass: readClass(reader); return readObject(reader);
            case Tags.TagObject: return readObjectWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            case Tags.TagError: throw new Error(readString(reader));
            default: unexpectedTag(tag);
        }
    }
    function readIntegerWithoutTag(stream) {
        return readInt(stream, Tags.TagSemicolon);
    }
    function readInteger(stream) {
        var tag = stream.readByte();
        switch (tag) {
            case 48:
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57: return tag - 48;
            case Tags.TagInteger: return readIntegerWithoutTag(stream);
            default: unexpectedTag(tag);
        }
    }
    function readLongWithoutTag(stream) {
        var s = stream.readUntil(Tags.TagSemicolon);
        var l = parseInt(s, 10);
        if (l.toString() === s) { return l; }
        return s;
    }
    function readLong(stream) {
        var tag = stream.readByte();
        switch (tag) {
            case 48:
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57: return tag - 48;
            case Tags.TagInteger:
            case Tags.TagLong: return readLongWithoutTag(stream);
            default: unexpectedTag(tag);
        }
    }
    function readDoubleWithoutTag(stream) {
        return parseFloat(stream.readUntil(Tags.TagSemicolon));
    }
    function readDouble(stream) {
        var tag = stream.readByte();
        switch (tag) {
            case 48:
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57: return tag - 48;
            case Tags.TagInteger:
            case Tags.TagLong:
            case Tags.TagDouble: return readDoubleWithoutTag(stream);
            case Tags.TagNaN: return NaN;
            case Tags.TagInfinity: return readInfinityWithoutTag(stream);
            default: unexpectedTag(tag);
        }
    }
    function readInfinityWithoutTag(stream) {
        return ((stream.readByte() === Tags.TagNeg) ? -Infinity : Infinity);
    }
    function readBoolean(stream) {
        var tag = stream.readByte();
        switch (tag) {
            case Tags.TagTrue: return true;
            case Tags.TagFalse: return false;
            default: unexpectedTag(tag);
        }
    }
    function readDateWithoutTag(reader) {
        var stream = reader.stream;
        var year = parseInt(stream.readAsciiString(4), 10);
        var month = parseInt(stream.readAsciiString(2), 10) - 1;
        var day = parseInt(stream.readAsciiString(2), 10);
        var date;
        var tag = stream.readByte();
        if (tag === Tags.TagTime) {
            var hour = parseInt(stream.readAsciiString(2), 10);
            var minute = parseInt(stream.readAsciiString(2), 10);
            var second = parseInt(stream.readAsciiString(2), 10);
            var millisecond = 0;
            tag = stream.readByte();
            if (tag === Tags.TagPoint) {
                millisecond = parseInt(stream.readAsciiString(3), 10);
                tag = stream.readByte();
                if ((tag >= 48) && (tag <= 57)) {
                    stream.skip(2);
                    tag = stream.readByte();
                    if ((tag >= 48) && (tag <= 57)) {
                        stream.skip(2);
                        tag = stream.readByte();
                    }
                }
            }
            if (tag === Tags.TagUTC) {
                date = new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
            }
            else {
                date = new Date(year, month, day, hour, minute, second, millisecond);
            }
        }
        else if (tag === Tags.TagUTC) {
            date = new Date(Date.UTC(year, month, day));
        }
        else {
            date = new Date(year, month, day);
        }
        reader.refer.set(date);
        return date;
    }
    function readDate(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagDate: return readDateWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readTimeWithoutTag(reader) {
        var stream = reader.stream;
        var time;
        var hour = parseInt(stream.readAsciiString(2), 10);
        var minute = parseInt(stream.readAsciiString(2), 10);
        var second = parseInt(stream.readAsciiString(2), 10);
        var millisecond = 0;
        var tag = stream.readByte();
        if (tag === Tags.TagPoint) {
            millisecond = parseInt(stream.readAsciiString(3), 10);
            tag = stream.readByte();
            if ((tag >= 48) && (tag <= 57)) {
                stream.skip(2);
                tag = stream.readByte();
                if ((tag >= 48) && (tag <= 57)) {
                    stream.skip(2);
                    tag = stream.readByte();
                }
            }
        }
        if (tag === Tags.TagUTC) {
            time = new Date(Date.UTC(1970, 0, 1, hour, minute, second, millisecond));
        }
        else {
            time = new Date(1970, 0, 1, hour, minute, second, millisecond);
        }
        reader.refer.set(time);
        return time;
    }
    function readTime(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagTime: return readTimeWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readBytesWithoutTag(reader) {
        var stream = reader.stream;
        var count = readInt(stream, Tags.TagQuote);
        var bytes = stream.read(count);
        stream.skip(1);
        reader.refer.set(bytes);
        return bytes;
    }
    function readBytes(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagEmpty: return new Uint8Array(0);
            case Tags.TagBytes: return readBytesWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readUTF8CharWithoutTag(reader) {
        return reader.stream.readString(1);
    }
    function _readString(reader) {
        var stream = reader.stream;
        var s = stream.readString(readInt(stream, Tags.TagQuote));
        stream.skip(1);
        return s;
    }
    function readStringWithoutTag(reader) {
        var s = _readString(reader);
        reader.refer.set(s);
        return s;
    }
    function readString(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagEmpty: return '';
            case Tags.TagUTF8Char: return readUTF8CharWithoutTag(reader);
            case Tags.TagString: return readStringWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readGuidWithoutTag(reader) {
        var stream = reader.stream;
        stream.skip(1);
        var s = stream.readAsciiString(36);
        stream.skip(1);
        reader.refer.set(s);
        return s;
    }
    function readGuid(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagGuid: return readGuidWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readListWithoutTag(reader) {
        var stream = reader.stream;
        var list = [];
        reader.refer.set(list);
        var count = readInt(stream, Tags.TagOpenbrace);
        for (var i = 0; i < count; i++) {
            list[i] = unserialize(reader);
        }
        stream.skip(1);
        return list;
    }
    function readList(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagList: return readListWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readMapWithoutTag(reader) {
        var stream = reader.stream;
        var map = {};
        reader.refer.set(map);
        var count = readInt(stream, Tags.TagOpenbrace);
        for (var i = 0; i < count; i++) {
            var key = unserialize(reader);
            var value = unserialize(reader);
            map[key] = value;
        }
        stream.skip(1);
        return map;
    }
    function readMap(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagMap: return readMapWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readHarmonyMapWithoutTag(reader) {
        var stream = reader.stream;
        var map = new Map();
        reader.refer.set(map);
        var count = readInt(stream, Tags.TagOpenbrace);
        for (var i = 0; i < count; i++) {
            var key = unserialize(reader);
            var value = unserialize(reader);
            map.set(key, value);
        }
        stream.skip(1);
        return map;
    }
    function readHarmonyMap(reader) {
        var tag = reader.stream.readByte();
        switch (tag) {
            case Tags.TagNull: return null;
            case Tags.TagMap: return readHarmonyMapWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readObjectWithoutTag(reader) {
        var stream = reader.stream;
        var cls = reader.classref[readInt(stream, Tags.TagOpenbrace)];
        var obj = new cls.classname();
        reader.refer.set(obj);
        for (var i = 0; i < cls.count; i++) {
            obj[cls.fields[i]] = unserialize(reader);
        }
        stream.skip(1);
        return obj;
    }
    function readObject(reader) {
        var tag = reader.stream.readByte();
        switch(tag) {
            case Tags.TagNull: return null;
            case Tags.TagClass: readClass(reader); return readObject(reader);
            case Tags.TagObject: return readObjectWithoutTag(reader);
            case Tags.TagRef: return readRef(reader);
            default: unexpectedTag(tag);
        }
    }
    function readClass(reader) {
        var stream = reader.stream;
        var classname = _readString(reader);
        var count = readInt(stream, Tags.TagOpenbrace);
        var fields = [];
        for (var i = 0; i < count; i++) {
            fields[i] = readString(reader);
        }
        stream.skip(1);
        classname = getClass(classname);
        reader.classref.push({
            classname: classname,
            count: count,
            fields: fields
        });
    }
    function readRef(reader) {
        return reader.refer.read(readInt(reader.stream, Tags.TagSemicolon));
    }

    function Reader(stream, simple, useHarmonyMap) {
        RawReader.call(this, stream);
        this.useHarmonyMap = !!useHarmonyMap;
        Object.defineProperties(this, {
            classref: { value: [] },
            refer: { value: simple ? fakeReaderRefer : realReaderRefer() }
        });
    }

    Reader.prototype = Object.create(RawReader.prototype);
    Reader.prototype.constructor = Reader;

    Object.defineProperties(Reader.prototype, {
        useHarmonyMap: { value: false, writable: true },
        checkTag: { value: function(expectTag, tag) {
            if (tag === undefined) { tag = this.stream.readByte(); }
            if (tag !== expectTag) { unexpectedTag(tag, expectTag); }
        } },
        checkTags: { value: function(expectTags, tag) {
            if (tag === undefined) { tag = this.stream.readByte(); }
            if (expectTags.indexOf(tag) >= 0) { return tag; }
            unexpectedTag(tag, expectTags);
        } },
        unserialize: { value: function() {
            return unserialize(this);
        } },
        readInteger: { value: function() {
            return readInteger(this.stream);
        } },
        readLong: { value: function() {
            return readLong(this.stream);
        } },
        readDouble: { value: function() {
            return readDouble(this.stream);
        } },
        readBoolean: { value: function() {
            return readBoolean(this.stream);
        } },
        readDateWithoutTag: { value: function() {
            return readDateWithoutTag(this);
        } },
        readDate: { value: function() {
            return readDate(this);
        } },
        readTimeWithoutTag: { value: function() {
            return readTimeWithoutTag(this);
        } },
        readTime: { value: function() {
            return readTime(this);
        } },
        readBytesWithoutTag: { value: function() {
            return readBytesWithoutTag(this);
        } },
        readBytes: { value: function() {
            return readBytes(this);
        } },
        readStringWithoutTag: { value: function() {
            return readStringWithoutTag(this);
        } },
        readString: { value: function() {
            return readString(this);
        } },
        readGuidWithoutTag: { value: function() {
            return readGuidWithoutTag(this);
        } },
        readGuid: { value: function() {
            return readGuid(this);
        } },
        readListWithoutTag: { value: function() {
            return readListWithoutTag(this);
        } },
        readList: { value: function() {
            return readList(this);
        } },
        readMapWithoutTag: { value: function() {
            return this.useHarmonyMap ?
                   readHarmonyMapWithoutTag(this) :
                   readMapWithoutTag(this);
        } },
        readMap: { value: function() {
            return this.useHarmonyMap ?
                   readHarmonyMap(this) :
                   readMap(this);
        } },
        readObjectWithoutTag: { value: function() {
            return readObjectWithoutTag(this);
        } },
        readObject: { value: function() {
            return readObject(this);
        } },
        reset: { value: function() {
            this.classref.length = 0;
            this.refer.reset();
        } }
    });

    hprose.Reader = Reader;
})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Formatter.js                                           *
 *                                                        *
 * hprose Formatter for HTML5.                            *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose) {
    var BytesIO = hprose.BytesIO;
    var Writer = hprose.Writer;
    var Reader = hprose.Reader;

    function serialize(value, simple) {
        var stream = new BytesIO();
        var writer = new Writer(stream, simple);
        writer.serialize(value);
        return stream;
    }

    function unserialize(stream, simple, useHarmonyMap) {
        if (!(stream instanceof BytesIO)) {
            stream = new BytesIO(stream);
        }
        return new Reader(stream, simple, useHarmonyMap).unserialize();
    }

    hprose.Formatter = {
        serialize: function (value, simple) {
            return serialize(value, simple).bytes;
        },
        unserialize: unserialize
    };

    hprose.serialize = serialize;

    hprose.unserialize = unserialize;

})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * ResultMode.js                                          *
 *                                                        *
 * hprose ResultMode for HTML5.                           *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose) {
    hprose.ResultMode = {
        Normal: 0,
        Serialized: 1,
        Raw: 2,
        RawWithEndTag: 3
    };
    hprose.Normal        = hprose.ResultMode.Normal;
    hprose.Serialized    = hprose.ResultMode.Serialized;
    hprose.Raw           = hprose.ResultMode.Raw;
    hprose.RawWithEndTag = hprose.ResultMode.RawWithEndTag;

})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * Client.js                                              *
 *                                                        *
 * hprose client for HTML5.                               *
 *                                                        *
 * LastModified: Apr 24, 2018                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

/* global Proxy */
(function (hprose, global, undefined) {
    var setImmediate = global.setImmediate;
    var Tags = hprose.Tags;
    var ResultMode = hprose.ResultMode;
    var BytesIO = hprose.BytesIO;
    var Writer = hprose.Writer;
    var Reader = hprose.Reader;
    var Future = hprose.Future;
    var parseuri = hprose.parseuri;
    var isObjectEmpty = hprose.isObjectEmpty;

    var GETFUNCTIONS = new Uint8Array(1);
    GETFUNCTIONS[0] = Tags.TagEnd;

    function noop(){}

    var s_boolean = 'boolean';
    var s_string = 'string';
    var s_number = 'number';
    var s_function = 'function';
    var s_object = 'object';

    function HproseProxy(setFunction, ns) {
        var settings = {};
        this.get = function(target, prop/*, receiver*/) {
            var name = prop.toString();
            if (ns) { name = ns + '_' + name; }
            if (name === 'then') { return undefined; }
            if (!target.hasOwnProperty(name)) {
                settings[name] = {};
                var handler = new HproseProxy(setFunction, name);
                var func = setFunction(settings, name);
                handler.apply = function(target, thisArg, argumentsList) {
                    return func.apply(null, argumentsList);
                };
                handler.set = function(target, prop, value/*, receiver*/) {
                    settings[name][prop] = value;
                    return true;
                };
                target[name] = new Proxy(function() {}, handler);
            }
            return target[name];
        };
    }

    function Client(uri, functions, settings) {

        // private members
        var _uri,
            _uriList                = [],
            _index                  = -1,
            _byref                  = false,
            _simple                 = false,
            _timeout                = 30000,
            _retry                  = 10,
            _idempotent             = false,
            _failswitch             = false,
            _failround              = 0,
            _lock                   = false,
            _tasks                  = [],
            _useHarmonyMap          = false,
            _onerror                = noop,
            _onfailswitch           = noop,
            _filters                = [],
            _batch                  = false,
            _batches                = [],
            _ready                  = new Future(),
            _topics                 = Object.create(null),
            _id                     = null,
            _keepAlive              = true,
            _invokeHandler          = invokeHandler,
            _batchInvokeHandler     = batchInvokeHandler,
            _beforeFilterHandler    = beforeFilterHandler,
            _afterFilterHandler     = afterFilterHandler,
            _invokeHandlers         = [],
            _batchInvokeHandlers    = [],
            _beforeFilterHandlers   = [],
            _afterFilterHandlers    = [],

            self = this;

        function outputFilter(request, context) {
            for (var i = 0, n = _filters.length; i < n; i++) {
                request = _filters[i].outputFilter(request, context);
            }
            return request;
        }

        function inputFilter(response, context) {
            for (var i = _filters.length - 1; i >= 0; i--) {
                response = _filters[i].inputFilter(response, context);
            }
            return response;
        }

        function beforeFilterHandler(request, context) {
            request = outputFilter(request, context);
            return _afterFilterHandler(request, context)
            .then(function(response) {
                if (context.oneway) { return; }
                return inputFilter(response, context);
            });
        }

        function afterFilterHandler(request, context) {
            return self.sendAndReceive(request, context).catchError(function(e) {
                var response = retry(request, context);
                if (response !== null) {
                    return response;
                }
                throw e;
            });
        }

        function sendAndReceive(request, context, onsuccess, onerror) {
            _beforeFilterHandler(request, context).then(onsuccess, onerror);
        }

        function failswitch() {
            var n = _uriList.length;
            if (n > 1) {
                var i = _index + 1;
                if (i >= n) {
                    i = 0;
                    _failround++;
                }
                _index = i;
                _uri = _uriList[_index];
            }
            else {
                _failround++;
            }
            _onfailswitch(self);
        }

        function retry(data, context) {
            if (context.failswitch) {
                failswitch();
            }
            if (context.idempotent && (context.retried < context.retry)) {
                var interval = ++context.retried * 500;
                if (context.failswitch) {
                    interval -= (_uriList.length - 1) * 500;
                }
                if (interval > 5000) {
                    interval = 5000;
                }
                if (interval > 0) {
                    return Future.delayed(interval, function() {
                        return afterFilterHandler(data, context);
                    });
                }
                else {
                    return afterFilterHandler(data, context);
                }
            }
            return null;
        }

        function normalizeFunctions(functions) {
            var root = [Object.create(null)];
            for (var i in functions) {
                var func = functions[i].split('_');
                var n = func.length - 1;
                if (n > 0) {
                    var node = root;
                    for (var j = 0; j < n; j++) {
                        var f = func[j];
                        if (node[0][f] === undefined) {
                            node[0][f] = [Object.create(null)];
                        }
                        node = node[0][f];
                    }
                    node.push(func[n]);
                }
                root.push(functions[i]);
            }
            return root;
        }

        function initService(stub) {
            var context = {
                retry: _retry,
                retried: 0,
                idempotent: true,
                failswitch: true,
                timeout: _timeout,
                client: self,
                userdata: {}
            };
            var onsuccess = function(data) {
                var error = null;
                try {
                    var stream = new BytesIO(data);
                    var reader = new Reader(stream, true);
                    var tag = stream.readByte();
                    switch (tag) {
                        case Tags.TagError:
                            error = new Error(reader.readString());
                            break;
                        case Tags.TagFunctions:
                            var functions = normalizeFunctions(reader.readList());
                            reader.checkTag(Tags.TagEnd);
                            setFunctions(stub, functions);
                            break;
                        default:
                            error = new Error('Wrong Response:\r\n' + BytesIO.toString(data));
                            break;
                    }
                }
                catch (e) {
                    error = e;
                }
                if (error !== null) {
                    _ready.reject(error);
                }
                else {
                    _ready.resolve(stub);
                }
            };
            sendAndReceive(GETFUNCTIONS, context, onsuccess, _ready.reject);
        }

        function setFunction(stub, name) {
            return function() {
                if (_batch) {
                    return _invoke(stub, name, Array.slice(arguments), true);
                }
                else {
                    return Future.all(arguments).then(function(args) {
                        return _invoke(stub, name, args, false);
                    });
                }
            };
        }

        function setMethods(stub, obj, namespace, name, methods) {
            if (obj[name] !== undefined) { return; }
            obj[name] = {};
            if (typeof(methods) === s_string || methods.constructor === Object) {
                methods = [methods];
            }
            if (Array.isArray(methods)) {
                for (var i = 0; i < methods.length; i++) {
                    var m = methods[i];
                    if (typeof(m) === s_string) {
                        obj[name][m] = setFunction(stub, namespace + name + '_' + m);
                    }
                    else {
                        for (var n in m) {
                            setMethods(stub, obj[name], namespace + name + '_', n, m[n]);
                        }
                    }
                }
            }
        }

        function setFunctions(stub, functions) {
            for (var i = 0; i < functions.length; i++) {
                var f = functions[i];
                if (typeof(f) === s_string) {
                    if (stub[f] === undefined) {
                        stub[f] = setFunction(stub, f);
                    }
                }
                else {
                    for (var name in f) {
                        setMethods(stub, stub, '', name, f[name]);
                    }
                }
            }
        }

        function copyargs(src, dest) {
            var n = Math.min(src.length, dest.length);
            for (var i = 0; i < n; ++i) { dest[i] = src[i]; }
        }

        function initContext(batch) {
            if (batch) {
                return {
                    mode: ResultMode.Normal,
                    byref: _byref,
                    simple: _simple,
                    onsuccess: undefined,
                    onerror: undefined,
                    useHarmonyMap: _useHarmonyMap,
                    client: self,
                    userdata: {}
                };
            }
            return {
                mode: ResultMode.Normal,
                byref: _byref,
                simple: _simple,
                timeout: _timeout,
                retry: _retry,
                retried: 0,
                idempotent: _idempotent,
                failswitch: _failswitch,
                oneway: false,
                sync: false,
                onsuccess: undefined,
                onerror: undefined,
                useHarmonyMap: _useHarmonyMap,
                client: self,
                userdata: {}
            };
        }

        function getContext(stub, name, args, batch) {
            var context = initContext(batch);
            if (name in stub) {
                var method = stub[name];
                for (var key in method) {
                    if (key in context) {
                        context[key] = method[key];
                    }
                }
            }
            var i = 0, n = args.length;
            for (; i < n; ++i) {
                if (typeof args[i] === s_function) { break; }
            }
            if (i === n) { return context; }
            var extra = args.splice(i, n - i);
            context.onsuccess = extra[0];
            n = extra.length;
            for (i = 1; i < n; ++i) {
                var arg = extra[i];
                switch (typeof arg) {
                case s_function:
                    context.onerror = arg; break;
                case s_boolean:
                    context.byref = arg; break;
                case s_number:
                    context.mode = arg; break;
                case s_object:
                    for (var k in arg) {
                        if (k in context) {
                            context[k] = arg[k];
                        }
                    }
                    break;
                }
            }
            return context;
        }

        function encode(name, args, context) {
            var stream = new BytesIO();
            stream.writeByte(Tags.TagCall);
            var writer = new Writer(stream, context.simple);
            writer.writeString(name);
            if (args.length > 0 || context.byref) {
                writer.reset();
                writer.writeList(args);
                if (context.byref) {
                    writer.writeBoolean(true);
                }
            }
            return stream;
        }

        function __invoke(name, args, context, batch) {
            if (_lock) {
                return Future.promise(function(resolve, reject) {
                    _tasks.push({
                        batch: batch,
                        name: name,
                        args: args,
                        context: context,
                        resolve: resolve,
                        reject: reject
                    });
                });
            }
            if (batch) {
                return multicall(name, args, context);
            }
            return call$$1(name, args, context);
        }

        function _invoke(stub, name, args, batch) {
            return __invoke(name, args, getContext(stub, name, args, batch), batch);
        }

        function errorHandling(name, error, context, reject) {
            try {
                if (context.onerror) {
                    context.onerror(name, error);
                }
                else {
                    _onerror(name, error);
                }
                reject(error);
            }
            catch (e) {
                reject(e);
            }
        }

        function invokeHandler(name, args, context) {
            var request = encode(name, args, context);
            request.writeByte(Tags.TagEnd);
            return Future.promise(function(resolve, reject) {
                sendAndReceive(request.bytes, context, function(response) {
                    if (context.oneway) {
                        resolve();
                        return;
                    }
                    var result = null;
                    var error = null;
                    try {
                        if (context.mode === ResultMode.RawWithEndTag) {
                            result = response;
                        }
                        else if (context.mode === ResultMode.Raw) {
                            result = response.subarray(0, response.byteLength - 1);
                        }
                        else {
                            var stream = new BytesIO(response);
                            var reader = new Reader(stream, false, context.useHarmonyMap);
                            var tag = stream.readByte();
                            if (tag === Tags.TagResult) {
                                if (context.mode === ResultMode.Serialized) {
                                    result = reader.readRaw();
                                }
                                else {
                                    result = reader.unserialize();
                                }
                                tag = stream.readByte();
                                if (tag === Tags.TagArgument) {
                                    reader.reset();
                                    var _args = reader.readList();
                                    copyargs(_args, args);
                                    tag = stream.readByte();
                                }
                            }
                            else if (tag === Tags.TagError) {
                                error = new Error(reader.readString());
                                tag = stream.readByte();
                            }
                            if (tag !== Tags.TagEnd) {
                                error = new Error('Wrong Response:\r\n' + BytesIO.toString(response));
                            }
                        }
                    }
                    catch (e) {
                        error = e;
                    }
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(result);
                    }
                }, reject);
            });
        }

        function unlock(sync) {
            return function() {
                if (sync) {
                    _lock = false;
                    setImmediate(function(tasks) {
                        tasks.forEach(function(task) {
                            if ('settings' in task) {
                                endBatch(task.settings)
                                .then(task.resolve, task.reject);
                            }
                            else {
                                __invoke(task.name, task.args, task.context, task.batch).then(task.resolve, task.reject);
                            }
                        });
                    }, _tasks);
                    _tasks = [];
                }
            };
        }

        function call$$1(name, args, context) {
            if (context.sync) { _lock = true; }
            var promise = Future.promise(function(resolve, reject) {
                _invokeHandler(name, args, context).then(function(result) {
                    try {
                        if (context.onsuccess) {
                            try {
                                context.onsuccess(result, args);
                            }
                            catch (e) {
                                if (context.onerror) {
                                    context.onerror(name, e);
                                }
                                reject(e);
                            }
                        }
                        resolve(result);
                    }
                    catch (e) {
                        reject(e);
                    }
                }, function(error) {
                    errorHandling(name, error, context, reject);
                });
            });
            promise.whenComplete(unlock(context.sync));
            return promise;
        }

        function multicall(name, args, context) {
            return Future.promise(function(resolve, reject) {
                _batches.push({
                    args: args,
                    name: name,
                    context: context,
                    resolve: resolve,
                    reject: reject
                });
            });
        }

        function getBatchContext(settings) {
            var context = {
                timeout: _timeout,
                retry: _retry,
                retried: 0,
                idempotent: _idempotent,
                failswitch: _failswitch,
                oneway: false,
                sync: false,
                client: self,
                userdata: {}
            };
            for (var k in settings) {
                if (k in context) {
                    context[k] = settings[k];
                }
            }
            return context;
        }

        function batchInvokeHandler(batches, context) {
            var request = batches.reduce(function(stream, item) {
                stream.write(encode(item.name, item.args, item.context));
                return stream;
            }, new BytesIO());
            request.writeByte(Tags.TagEnd);
            return Future.promise(function(resolve, reject) {
                sendAndReceive(request.bytes, context, function(response) {
                    if (context.oneway) {
                        resolve(batches);
                        return;
                    }
                    var i = -1;
                    var stream = new BytesIO(response);
                    var reader = new Reader(stream, false);
                    var tag = stream.readByte();
                    try {
                        while (tag !== Tags.TagEnd) {
                            var result = null;
                            var error = null;
                            var mode = batches[++i].context.mode;
                            if (mode >= ResultMode.Raw) {
                                result = new BytesIO();
                            }
                            if (tag === Tags.TagResult) {
                                if (mode === ResultMode.Serialized) {
                                    result = reader.readRaw();
                                }
                                else if (mode >= ResultMode.Raw) {
                                    result.writeByte(Tags.TagResult);
                                    result.write(reader.readRaw());
                                }
                                else {
                                    reader.useHarmonyMap = batches[i].context.useHarmonyMap;
                                    reader.reset();
                                    result = reader.unserialize();
                                }
                                tag = stream.readByte();
                                if (tag === Tags.TagArgument) {
                                    if (mode >= ResultMode.Raw) {
                                        result.writeByte(Tags.TagArgument);
                                        result.write(reader.readRaw());
                                    }
                                    else {
                                        reader.reset();
                                        var _args = reader.readList();
                                        copyargs(_args, batches[i].args);
                                    }
                                    tag = stream.readByte();
                                }
                            }
                            else if (tag === Tags.TagError) {
                                if (mode >= ResultMode.Raw) {
                                    result.writeByte(Tags.TagError);
                                    result.write(reader.readRaw());
                                }
                                else {
                                    reader.reset();
                                    error = new Error(reader.readString());
                                }
                                tag = stream.readByte();
                            }
                            if ([Tags.TagEnd,
                                 Tags.TagResult,
                                 Tags.TagError].indexOf(tag) < 0) {
                                reject(new Error('Wrong Response:\r\n' + BytesIO.toString(response)));
                                return;
                            }
                            if (mode >= ResultMode.Raw) {
                                if (mode === ResultMode.RawWithEndTag) {
                                    result.writeByte(Tags.TagEnd);
                                }
                                batches[i].result = result.bytes;
                            }
                            else {
                                batches[i].result = result;
                            }
                            batches[i].error = error;
                        }
                    }
                    catch (e) {
                        reject(e);
                        return;
                    }
                    resolve(batches);
                }, reject);
            });
        }

        function beginBatch() {
            _batch = true;
        }

        function endBatch(settings) {
            settings = settings || {};
            _batch = false;
            if (_lock) {
                return Future.promise(function(resolve, reject) {
                    _tasks.push({
                        batch: true,
                        settings: settings,
                        resolve: resolve,
                        reject: reject
                    });
                });
            }
            var batchSize = _batches.length;
            if (batchSize === 0) { return Future.value([]); }
            var context = getBatchContext(settings);
            if (context.sync) { _lock = true; }
            var batches = _batches;
            _batches = [];
            var promise = Future.promise(function(resolve, reject) {
                _batchInvokeHandler(batches, context).then(function(batches) {
                    batches.forEach(function(i) {
                        if (i.error) {
                            errorHandling(i.name, i.error, i.context, i.reject);
                        }
                        else {
                            try {
                                if (i.context.onsuccess) {
                                    try {
                                        i.context.onsuccess(i.result, i.args);
                                    }
                                    catch (e) {
                                        if (i.context.onerror) {
                                            i.context.onerror(i.name, e);
                                        }
                                        i.reject(e);
                                    }
                                }
                                i.resolve(i.result);
                            }
                            catch (e) {
                                i.reject(e);
                            }
                        }
                        delete i.context;
                        delete i.resolve;
                        delete i.reject;
                    });
                    resolve(batches);
                }, function(error) {
                    batches.forEach(function(i) {
                        if ('reject' in i) {
                            errorHandling(i.name, error, i.context, i.reject);
                        }
                    });
                    reject(error);
                });
            });
            promise.whenComplete(unlock(context.sync));
            return promise;
        }

        function getOnError() {
            return _onerror;
        }
        function setOnError(value) {
            if (typeof(value) === s_function) {
                _onerror = value;
            }
        }
        function getOnFailswitch() {
            return _onfailswitch;
        }
        function setOnFailswitch(value) {
            if (typeof(value) === s_function) {
                _onfailswitch = value;
            }
        }
        function getUri() {
            return _uri;
        }
        function getUriList() {
            return _uriList;
        }
        function setUriList(uriList) {
            if (typeof(uriList) === s_string) {
                _uriList = [uriList];
            }
            else if (Array.isArray(uriList)) {
                _uriList = uriList.slice(0);
                _uriList.sort(function() { return Math.random() - 0.5; });
            }
            else {
                return;
            }
            _index = 0;
            _uri = _uriList[_index];
        }
        function getFailswitch() {
            return _failswitch;
        }
        function setFailswitch(value) {
            _failswitch = !!value;
        }
        function getFailround() {
            return _failround;
        }
        function getTimeout() {
            return _timeout;
        }
        function setTimeout(value) {
            if (typeof(value) === 'number') {
                _timeout = value | 0;
            }
            else {
                _timeout = 0;
            }
        }
        function getRetry() {
            return _retry;
        }
        function setRetry(value) {
            if (typeof(value) === 'number') {
                _retry = value | 0;
            }
            else {
                _retry = 0;
            }
        }
        function getIdempotent() {
            return _idempotent;
        }
        function setIdempotent(value) {
            _idempotent = !!value;
        }
        function setKeepAlive(value) {
            _keepAlive = !!value;
        }
        function getKeepAlive() {
            return _keepAlive;
        }
        function getByRef() {
            return _byref;
        }
        function setByRef(value) {
            _byref = !!value;
        }
        function getSimpleMode() {
            return _simple;
        }
        function setSimpleMode(value) {
            _simple = !!value;
        }
        function getUseHarmonyMap() {
            return _useHarmonyMap;
        }
        function setUseHarmonyMap(value) {
            _useHarmonyMap = !!value;
        }
        function getFilter() {
            if (_filters.length === 0) {
                return null;
            }
            if (_filters.length === 1) {
                return _filters[0];
            }
            return _filters.slice();
        }
        function setFilter(filter) {
            _filters.length = 0;
            if (Array.isArray(filter)) {
                filter.forEach(function(filter) {
                    addFilter(filter);
                });
            }
            else {
                addFilter(filter);
            }
        }
        function addFilter(filter) {
            if (filter &&
                typeof filter.inputFilter === 'function' &&
                typeof filter.outputFilter === 'function') {
                _filters.push(filter);
            }
        }
        function removeFilter(filter) {
            var i = _filters.indexOf(filter);
            if (i === -1) {
                return false;
            }
            _filters.splice(i, 1);
            return true;
        }
        function filters() {
            return _filters;
        }
        function useService(uri, functions, create) {
            if (create === undefined) {
                if (typeof(functions) === s_boolean) {
                    create = functions;
                    functions = false;
                }
                if (!functions) {
                    if (typeof(uri) === s_boolean) {
                        create = uri;
                        uri = false;
                    }
                    else if (uri && uri.constructor === Object ||
                             Array.isArray(uri)) {
                        functions = uri;
                        uri = false;
                    }
                }
            }
            var stub = self;
            if (create) {
                stub = {};
            }
            if (!uri && !_uri) {
                return new Error('You should set server uri first!');
            }
            if (uri) {
                _uri = uri;
            }
            if (typeof(functions) === s_string ||
                (functions && functions.constructor === Object)) {
                functions = [functions];
            }
            if (Array.isArray(functions)) {
                setFunctions(stub, functions);
            }
            else if (typeof(Proxy) === 'undefined') {
                setImmediate(initService, stub);
                return _ready;
            }
            else {
                stub = new Proxy({}, new HproseProxy(setFunction));
            }
            _ready.resolve(stub);
            return stub;
        }
        function invoke(name, args, onsuccess/*, onerror, settings*/) {
            var argc = arguments.length;
            if ((argc < 1) || (typeof name !== s_string)) {
                throw new Error('name must be a string');
            }
            if (argc === 1) { args = []; }
            if (argc === 2) {
                if (!Array.isArray(args)) {
                    var _args = [];
                    if (typeof args !== s_function) {
                        _args.push(noop);
                    }
                    _args.push(args);
                    args = _args;
                }
            }
            if (argc > 2) {
                if (typeof onsuccess !== s_function) {
                    args.push(noop);
                }
                for (var i = 2; i < argc; i++) {
                    args.push(arguments[i]);
                }
            }
            return _invoke(self, name, args, _batch);
        }
        function ready(onComplete, onError) {
            return _ready.then(onComplete, onError);
        }
        function getTopic(name, id) {
            if (_topics[name]) {
                var topics = _topics[name];
                if (topics[id]) {
                    return topics[id];
                }
            }
            return null;
        }
        // subscribe(name, callback, timeout, failswitch)
        // subscribe(name, id, callback, timeout, failswitch)
        function subscribe(name, id, callback, timeout, failswitch) {
            if (typeof name !== s_string) {
                throw new TypeError('topic name must be a string.');
            }
            if (id === undefined || id === null) {
                if (typeof callback === s_function) {
                    id = callback;
                }
                else {
                    throw new TypeError('callback must be a function.');
                }
            }
            if (!_topics[name]) {
                _topics[name] = Object.create(null);
            }
            if (typeof id === s_function) {
                timeout = callback;
                callback = id;
                autoId().then(function(id) {
                    subscribe(name, id, callback, timeout, failswitch);
                });
                return;
            }
            if (typeof callback !== s_function) {
                throw new TypeError('callback must be a function.');
            }
            if (Future.isPromise(id)) {
                id.then(function(id) {
                    subscribe(name, id, callback, timeout, failswitch);
                });
                return;
            }
            // Default subscribe timeout is 5 minutes.
            if (timeout === undefined) { timeout = 300000; }
            var topic = getTopic(name, id);
            if (topic === null) {
                var cb = function() {
                    _invoke(self, name, [id, topic.handler, cb, {
                        idempotent: true,
                        failswitch: failswitch,
                        timeout: timeout
                    }], false);
                };
                topic = {
                    handler: function(result) {
                        var topic = getTopic(name, id);
                        if (topic) {
                            if (result !== null) {
                                var callbacks = topic.callbacks;
                                for (var i = 0, n = callbacks.length; i < n; ++i) {
                                    try {
                                        callbacks[i](result);
                                    }
                                    catch (e) {}
                                }
                            }
                            if (getTopic(name, id) !== null) { cb(); }
                        }
                    },
                    callbacks: [callback]
                };
                _topics[name][id] = topic;
                cb();
            }
            else if (topic.callbacks.indexOf(callback) < 0) {
                topic.callbacks.push(callback);
            }
        }
        function delTopic(topics, id, callback) {
            if (topics) {
                if (typeof callback === s_function) {
                    var topic = topics[id];
                    if (topic) {
                        var callbacks = topic.callbacks;
                        var p = callbacks.indexOf(callback);
                        if (p >= 0) {
                            callbacks[p] = callbacks[callbacks.length - 1];
                            callbacks.length--;
                        }
                        if (callbacks.length === 0) {
                            delete topics[id];
                        }
                    }
                }
                else {
                    delete topics[id];
                }
            }
        }
        // unsubscribe(name)
        // unsubscribe(name, callback)
        // unsubscribe(name, id)
        // unsubscribe(name, id, callback)
        function unsubscribe(name, id, callback) {
            if (typeof name !== s_string) {
                throw new TypeError('topic name must be a string.');
            }
            if (id === undefined || id === null) {
                if (typeof callback === s_function) {
                    id = callback;
                }
                else {
                    delete _topics[name];
                    return;
                }
            }
            if (typeof id === s_function) {
                callback = id;
                id = null;
            }
            if (id === null) {
                if (_id === null) {
                    if (_topics[name]) {
                        var topics = _topics[name];
                        for (id in topics) {
                            delTopic(topics, id, callback);
                        }
                    }
                }
                else {
                    _id.then(function(id) {
                        unsubscribe(name, id, callback);
                    });
                }
            }
            else if (Future.isPromise(id)) {
                id.then(function(id) {
                    unsubscribe(name, id, callback);
                });
            }
            else {
                delTopic(_topics[name], id, callback);
            }
            if (isObjectEmpty(_topics[name])) {
                delete _topics[name];
            }
        }
        function isSubscribed(name) {
            return !!_topics[name];
        }
        function subscribedList() {
            var list = [];
            for (var name in _topics) {
                list.push(name);
            }
            return list;
        }
        function getId() {
            return _id;
        }
        function autoId() {
            if (_id === null) {
                _id = _invoke(self, '#', [], false);
            }
            return _id;
        }
        autoId.sync = true;
        autoId.idempotent = true;
        autoId.failswitch = true;
        function addInvokeHandler(handler) {
            _invokeHandlers.push(handler);
            _invokeHandler = _invokeHandlers.reduceRight(
            function(next, handler) {
                return function(name, args, context) {
                    return Future.toPromise(handler(name, args, context, next));
                };
            }, invokeHandler);
        }
        function addBatchInvokeHandler(handler) {
            _batchInvokeHandlers.push(handler);
            _batchInvokeHandler = _batchInvokeHandlers.reduceRight(
            function(next, handler) {
                return function(batches, context) {
                    return Future.toPromise(handler(batches, context, next));
                };
            }, batchInvokeHandler);
        }
        function addBeforeFilterHandler(handler) {
            _beforeFilterHandlers.push(handler);
            _beforeFilterHandler = _beforeFilterHandlers.reduceRight(
            function(next, handler) {
                return function(request, context) {
                    return Future.toPromise(handler(request, context, next));
                };
            }, beforeFilterHandler);
        }
        function addAfterFilterHandler(handler) {
            _afterFilterHandlers.push(handler);
            _afterFilterHandler = _afterFilterHandlers.reduceRight(
            function(next, handler) {
                return function(request, context) {
                    return Future.toPromise(handler(request, context, next));
                };
            }, afterFilterHandler);
        }
        function use(handler) {
            addInvokeHandler(handler);
            return self;
        }
        var batch = Object.create(null, {
            begin: { value: beginBatch },
            end: { value: endBatch },
            use: { value: function(handler) {
                addBatchInvokeHandler(handler);
                return batch;
            } }
        });
        var beforeFilter = Object.create(null, {
            use: { value: function(handler) {
                addBeforeFilterHandler(handler);
                return beforeFilter;
            } }
        });
        var afterFilter = Object.create(null, {
            use: { value: function(handler) {
                addAfterFilterHandler(handler);
                return afterFilter;
            } }
        });
        Object.defineProperties(this, {
            '#': { value: autoId },
            onerror: { get: getOnError, set: setOnError },
            onfailswitch: { get: getOnFailswitch, set: setOnFailswitch },
            uri: { get: getUri },
            uriList: { get: getUriList, set: setUriList },
            id: { get: getId },
            failswitch: { get: getFailswitch, set: setFailswitch },
            failround: { get: getFailround },
            timeout: { get: getTimeout, set: setTimeout },
            retry: { get: getRetry, set: setRetry },
            idempotent: { get: getIdempotent, set: setIdempotent },
            keepAlive: { get: getKeepAlive, set: setKeepAlive },
            byref: { get: getByRef, set: setByRef },
            simple: { get: getSimpleMode, set: setSimpleMode },
            useHarmonyMap: { get: getUseHarmonyMap, set: setUseHarmonyMap },
            filter: { get: getFilter, set: setFilter },
            addFilter: { value: addFilter },
            removeFilter: { value: removeFilter },
            filters: { get: filters },
            useService: { value: useService },
            invoke: { value: invoke },
            ready: { value: ready },
            subscribe: { value: subscribe },
            unsubscribe: { value: unsubscribe },
            isSubscribed: { value : isSubscribed },
            subscribedList: { value : subscribedList },
            use: { value: use },
            batch: { value: batch },
            beforeFilter: { value: beforeFilter },
            afterFilter: { value: afterFilter }
        });
        /* function constructor */ {
            if ((settings) && (typeof settings === s_object)) {
                ['failswitch', 'timeout', 'retry', 'idempotent',
                 'keepAlive', 'byref', 'simple','useHarmonyMap',
                 'filter'].forEach(function(key) {
                     if (key in settings) {
                         self[key] = settings[key];
                     }
                });
            }
            if (uri) {
                setUriList(uri);
                useService(functions);
            }
        }
    }

    function checkuri(uri) {
        var parser = parseuri(uri);
        var protocol = parser.protocol;
        if (protocol === 'http:' ||
            protocol === 'https:' ||
            protocol === 'tcp:' ||
            protocol === 'tcp4:'||
            protocol === 'tcp6:' ||
            protocol === 'tcps:' ||
            protocol === 'tcp4s:' ||
            protocol === 'tcp6s:' ||
            protocol === 'tls:' ||
            protocol === 'ws:' ||
            protocol === 'wss:') {
            return;
        }
        throw new Error('The ' + protocol + ' client isn\'t implemented.');
    }

    function create(uri, functions, settings) {
        try {
            return hprose.HttpClient.create(uri, functions, settings);
        }
        catch(e) {}
        try {
            return hprose.TcpClient.create(uri, functions, settings);
        }
        catch(e) {}
        try {
            return hprose.WebSocketClient.create(uri, functions, settings);
        }
        catch(e) {}
        if (typeof uri === 'string') {
            checkuri(uri);
        }
        else if (Array.isArray(uri)) {
            uri.forEach(function(uri) { checkuri(uri); });
            throw new Error('Not support multiple protocol.');
        }
        throw new Error('You should set server uri first!');
    }

    Object.defineProperty(Client, 'create', { value: create });

    hprose.Client = Client;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * CookieManager.js                                       *
 *                                                        *
 * hprose CookieManager for HTML5.                        *
 *                                                        *
 * LastModified: Dec 2, 2016                              *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose) {
    var parseuri = hprose.parseuri;

    var s_cookieManager = {};

    function setCookie(headers, uri) {
        var parser = parseuri(uri);
        var host = parser.host;
        var name, values;
        function _setCookie(value) {
            var cookies, cookie, i;
            cookies = value.replace(/(^\s*)|(\s*$)/g, '').split(';');
            cookie = {};
            value = cookies[0].replace(/(^\s*)|(\s*$)/g, '').split('=', 2);
            if (value[1] === undefined) { value[1] = null; }
            cookie.name = value[0];
            cookie.value = value[1];
            for (i = 1; i < cookies.length; i++) {
                value = cookies[i].replace(/(^\s*)|(\s*$)/g, '').split('=', 2);
                if (value[1] === undefined) { value[1] = null; }
                cookie[value[0].toUpperCase()] = value[1];
            }
            // Tomcat can return SetCookie2 with path wrapped in "
            if (cookie.PATH) {
                if (cookie.PATH.charAt(0) === '"') {
                    cookie.PATH = cookie.PATH.substr(1);
                }
                if (cookie.PATH.charAt(cookie.PATH.length - 1) === '"') {
                    cookie.PATH = cookie.PATH.substr(0, cookie.PATH.length - 1);
                }
            }
            else {
                cookie.PATH = '/';
            }
            if (cookie.EXPIRES) {
                cookie.EXPIRES = Date.parse(cookie.EXPIRES);
            }
            if (cookie.DOMAIN) {
                cookie.DOMAIN = cookie.DOMAIN.toLowerCase();
            }
            else {
                cookie.DOMAIN = host;
            }
            cookie.SECURE = (cookie.SECURE !== undefined);
            if (s_cookieManager[cookie.DOMAIN] === undefined) {
                s_cookieManager[cookie.DOMAIN] = {};
            }
            s_cookieManager[cookie.DOMAIN][cookie.name] = cookie;
        }
        for (name in headers) {
            values = headers[name];
            name = name.toLowerCase();
            if ((name === 'set-cookie') || (name === 'set-cookie2')) {
                if (typeof(values) === 'string') {
                    values = [values];
                }
                values.forEach(_setCookie);
            }
        }
    }

    function getCookie(uri) {
        var parser = parseuri(uri);
        var host = parser.host;
        var path = parser.path;
        var secure = (parser.protocol === 'https:');
        var cookies = [];
        for (var domain in s_cookieManager) {
            if (host.indexOf(domain) > -1) {
                var names = [];
                for (var name in s_cookieManager[domain]) {
                    var cookie = s_cookieManager[domain][name];
                    if (cookie.EXPIRES && ((new Date()).getTime() > cookie.EXPIRES)) {
                        names.push(name);
                    }
                    else if (path.indexOf(cookie.PATH) === 0) {
                        if (((secure && cookie.SECURE) ||
                            !cookie.SECURE) && (cookie.value !== null)) {
                            cookies.push(cookie.name + '=' + cookie.value);
                        }
                    }
                }
                for (var i in names) {
                    delete s_cookieManager[domain][names[i]];
                }
            }
        }
        if (cookies.length > 0) {
            return cookies.join('; ');
        }
        return '';
    }

    hprose.cookieManager = {
        setCookie: setCookie,
        getCookie: getCookie
    };
})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * HttpClient.js                                          *
 *                                                        *
 * hprose http client for HTML5.                          *
 *                                                        *
 * LastModified: Dec 2, 2016                              *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var Client = hprose.Client;
    var Future = hprose.Future;
    var BytesIO = hprose.BytesIO;
    var TimeoutError = global.TimeoutError;
    var localfile = (global.location !== undefined && global.location.protocol === 'file:');
    var XMLHttpRequest = global.XMLHttpRequest;
    var nativeXHR = (typeof(XMLHttpRequest) !== 'undefined');
    var corsSupport = (!localfile && nativeXHR && 'withCredentials' in new XMLHttpRequest());
    var parseuri = hprose.parseuri;
    var cookieManager = hprose.cookieManager;

    function noop(){}

    function getResponseHeader(headers) {
        var header = Object.create(null);
        if (headers) {
            headers = headers.split("\r\n");
            for (var i = 0, n = headers.length; i < n; i++) {
                if (headers[i] !== "") {
                    var kv = headers[i].split(": ", 2);
                    var k = kv[0].trim();
                    var v = kv[1].trim();
                    if (k in header) {
                        if (Array.isArray(header[k])) {
                            header[k].push(v);
                        }
                        else {
                            header[k] = [header[k], v];
                        }
                    }
                    else {
                        header[k] = v;
                    }
                }
            }
        }
        return header;
    }

    function HttpClient(uri, functions, settings) {
        if (this.constructor !== HttpClient) {
            return new HttpClient(uri, functions, settings);
        }
        Client.call(this, uri, functions, settings);
        var _header = Object.create(null);
        var _onreqprogress = noop;
        var _onresprogress = noop;

        var self = this;

        function getRequestHeader(headers) {
            var header = Object.create(null);
            var name, value;
            for (name in _header) {
                header[name] = _header[name];
            }
            if (headers) {
                for (name in headers) {
                    value = headers[name];
                    if (Array.isArray(value)) {
                        header[name] = value.join(', ');
                    }
                    else {
                        header[name] = value;
                    }
                }
            }
            return header;
        }

        function xhrPost(request, context) {
            var future = new Future();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', self.uri, true);
            if (corsSupport) {
                xhr.withCredentials = 'true';
            }
            xhr.responseType = 'arraybuffer';
            var header = getRequestHeader(context.httpHeader);
            for (var name in header) {
                xhr.setRequestHeader(name, header[name]);
            }
            xhr.onload = function() {
                xhr.onload = noop;
                if (xhr.status) {
                    var headers = xhr.getAllResponseHeaders();
                    context.httpHeader = getResponseHeader(headers);
                    if (xhr.status === 200) {
                        future.resolve(new Uint8Array(xhr.response));
                    }
                    else {
                        future.reject(new Error(xhr.status + ':' + xhr.statusText));
                    }
                }
            };
            xhr.onerror = function() {
                future.reject(new Error('error'));
            };
            if (xhr.upload !== undefined) {
                xhr.upload.onprogress = _onreqprogress;
            }
            xhr.onprogress = _onresprogress;
            if (context.timeout > 0) {
                future = future.timeout(context.timeout).catchError(function(e) {
                    xhr.onload = noop;
                    xhr.onerror = noop;
                    xhr.abort();
                    throw e;
                },
                function(e) {
                    return e instanceof TimeoutError;
                });
            }
            if (request.constructor === String || ArrayBuffer.isView) {
                xhr.send(request);
            }
            else if (request.buffer.slice) {
                xhr.send(request.buffer.slice(0, request.length));
            }
            else {
                var buf = new Uint8Array(request.length);
                buf.set(request);
                xhr.send(buf.buffer);
            }
            return future;
        }

        function apiPost(request, context) {
            var future = new Future();
            var header = getRequestHeader(context.httpHeader);
            var cookie = cookieManager.getCookie(self.uri());
            if (cookie !== '') {
                header['Cookie'] = cookie;
            }
            global.api.ajax({
                url: self.uri,
                method: 'post',
                data: { body: BytesIO.toString(request) },
                timeout: context.timeout,
                dataType: 'text',
                headers: header,
                returnAll: true,
                certificate: self.certificate
            }, function(ret, err) {
                if (ret) {
                    context.httpHeader = ret.headers;
                    if (ret.statusCode === 200) {
                        cookieManager.setCookie(ret.headers, self.uri);
                        future.resolve((new BytesIO(ret.body)).takeBytes());
                    }
                    else {
                        future.reject(new Error(ret.statusCode+':'+ret.body));
                    }
                }
                else {
                    future.reject(new Error(err.msg));
                }                
            });
            return future;
        }

        function sendAndReceive(request, context) {
            var apicloud = (typeof(global.api) !== "undefined" &&
                           typeof(global.api.ajax) !== "undefined");
            var future = apicloud ? apiPost(request, context) :
                                    xhrPost(request, context);
            if (context.oneway) { future.resolve(); }
            return future;
        }

        function setOnRequestProgress(value) {
            if (typeof(value) === 'function') {
                _onreqprogress = value;
            }
        }
        function getOnRequestProgress() {
            return _onreqprogress;
        }
        function setOnResponseProgress(value) {
            if (typeof(value) === 'function') {
                _onresprogress = value;
            }
        }
        function getOnResponseProgress() {
            return _onresprogress;
        }
        function setHeader(name, value) {
            if (name.toLowerCase() !== 'content-type' &&
                name.toLowerCase() !== 'content-length') {
                if (value) {
                    _header[name] = value;
                }
                else {
                    delete _header[name];
                }
            }
        }
        Object.defineProperties(this, {
            onprogress: { get: getOnRequestProgress, set: setOnRequestProgress },
            onRequestProgress: { get: getOnRequestProgress, set: setOnRequestProgress },
            onResponseProgress: { get: getOnResponseProgress, set: setOnResponseProgress },
            setHeader: { value: setHeader },
            sendAndReceive: { value: sendAndReceive }
        });
    }

    function checkuri(uri) {
        var parser = parseuri(uri);
        if (parser.protocol === 'http:' ||
            parser.protocol === 'https:') {
            return;
        }
        throw new Error('This client desn\'t support ' + parser.protocol + ' scheme.');
    }

    function create(uri, functions, settings) {
        if (typeof uri === 'string') {
            checkuri(uri);
        }
        else if (Array.isArray(uri)) {
            uri.forEach(function(uri) { checkuri(uri); });
        }
        else {
            throw new Error('You should set server uri first!');
        }
        return new HttpClient(uri, functions, settings);
    }

    Object.defineProperty(HttpClient, 'create', { value: create });

    hprose.HttpClient = HttpClient;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * WebSocketClient.js                                     *
 *                                                        *
 * hprose websocket client for HTML5.                     *
 *                                                        *
 * LastModified: Aug 20, 2017                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var BytesIO = hprose.BytesIO;
    var Client = hprose.Client;
    var Future = hprose.Future;
    var TimeoutError = global.TimeoutError;
    var parseuri = hprose.parseuri;

    var WebSocket = global.WebSocket || global.MozWebSocket;

    function noop(){}
    function WebSocketClient(uri, functions, settings) {
        if (typeof(WebSocket) === "undefined") {
            throw new Error('WebSocket is not supported by this browser.');
        }
        if (this.constructor !== WebSocketClient) {
            return new WebSocketClient(uri, functions, settings);
        }

        Client.call(this, uri, functions, settings);

        var _id = 0;
        var _count = 0;
        var _futures = [];
        var _requests = [];
        var _ready = null;
        var ws = null;

        var self = this;

        function getNextId() {
            return (_id < 0x7fffffff) ? ++_id : _id = 0;
        }
        function send(id, request) {
            var bytes = new BytesIO();
            bytes.writeInt32BE(id);
            if (request.constructor === String) {
                bytes.writeString(request);
            }
            else {
                bytes.write(request);
            }
            var message = bytes.bytes;
            if (ArrayBuffer.isView) {
                ws.send(message);
            }
            else if (message.buffer.slice) {
                ws.send(message.buffer.slice(0, message.length));
            }
            else {
                ws.send(message.buffer);
            }
        }
        function onopen(e) {
            _ready.resolve(e);
        }
        function onmessage(e) {
            var bytes = new BytesIO(e.data);
            var id = bytes.readInt32BE();
            var future = _futures[id];
            delete _futures[id];
            if (future !== undefined) {
                --_count;
                future.resolve(bytes.read(bytes.length - 4));
            }
            if ((_count < 100) && (_requests.length > 0)) {
                ++_count;
                var request = _requests.pop();
                _ready.then(function() { send(request[0], request[1]); });
            }
            if (_count === 0 && !self.keepAlive) {
                close();
            }
        }
        function onclose(e) {
            _futures.forEach(function(future, id) {
                future.reject(new Error(e.code + ':' + e.reason));
                delete _futures[id];
            });
            _count = 0;
            ws = null;
        }
        function connect$$1() {
            _ready = new Future();
            ws = new WebSocket(self.uri);
            ws.binaryType = 'arraybuffer';
            ws.onopen = onopen;
            ws.onmessage = onmessage;
            ws.onerror = noop;
            ws.onclose = onclose;
        }
        function sendAndReceive(request, context) {
            var id = getNextId();
            var future = new Future();
            _futures[id] = future;
            if (context.timeout > 0) {
                future = future.timeout(context.timeout).catchError(function(e) {
                    delete _futures[id];
                    --_count;
                    close();
                    throw e;
                },
                function(e) {
                    return e instanceof TimeoutError;
                });
            }
            if (ws === null ||
                ws.readyState === WebSocket.CLOSING ||
                ws.readyState === WebSocket.CLOSED) {
                connect$$1();
            }
            if (_count < 100) {
                ++_count;
                _ready.then(function() { send(id, request); });
            }
            else {
                _requests.push([id, request]);
            }
            if (context.oneway) { future.resolve(); }
            return future;
        }
        function close() {
            if (ws !== null) {
                ws.onopen = noop;
                ws.onmessage = noop;
                ws.onclose = noop;
                ws.close();
            }
        }

        Object.defineProperties(this, {
            sendAndReceive: { value: sendAndReceive },
            close: { value: close }
        });
    }

    function checkuri(uri) {
        var parser = parseuri(uri);
        if (parser.protocol === 'ws:' ||
            parser.protocol === 'wss:') {
            return;
        }
        throw new Error('This client desn\'t support ' + parser.protocol + ' scheme.');
    }

    function create(uri, functions, settings) {
        if (typeof uri === 'string') {
            checkuri(uri);
        }
        else if (Array.isArray(uri)) {
            uri.forEach(function(uri) { checkuri(uri); });
        }
        else {
            throw new Error('You should set server uri first!');
        }
        return new WebSocketClient(uri, functions, settings);
    }

    Object.defineProperty(WebSocketClient, 'create', { value: create });

    hprose.WebSocketClient = WebSocketClient;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * ChromeTcpSocket.js                                     *
 *                                                        *
 * chrome tcp socket for JavaScript.                      *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var Future = hprose.Future;

    function noop(){}

    var socketPool = {};
    var socketManager = null;

    function receiveListener(info) {
        var socket = socketPool[info.socketId];
        socket.onreceive(info.data);
    }

    function receiveErrorListener(info) {
        var socket = socketPool[info.socketId];
        socket.onerror(info.resultCode);
        socket.destroy();
    }

    function ChromeTcpSocket() {
        if (socketManager === null) {
            socketManager = global.chrome.sockets.tcp;
            socketManager.onReceive.addListener(receiveListener);
            socketManager.onReceiveError.addListener(receiveErrorListener);
        }
        this.socketId = new Future();
        this.connected = false;
        this.timeid = undefined;
        this.onclose = noop;
        this.onconnect = noop;
        this.onreceive = noop;
        this.onerror = noop;
    }

    Object.defineProperties(ChromeTcpSocket.prototype, {
        connect: { value: function(address, port, options) {
            var self = this;
            socketManager.create({ persistent: options && options.persistent }, function(createInfo) {
                if (options) {
                    if ('noDelay' in options) {
                        socketManager.setNoDelay(createInfo.socketId, options.noDelay, function(result) {
                            if (result < 0) {
                                self.socketId.reject(result);
                                socketManager.disconnect(createInfo.socketId);
                                socketManager.close(createInfo.socketId);
                                self.onclose();
                            }
                        });
                    }
                    if ('keepAlive' in options) {
                        socketManager.setKeepAlive(createInfo.socketId, options.keepAlive, function(result) {
                            if (result < 0) {
                                self.socketId.reject(result);
                                socketManager.disconnect(createInfo.socketId);
                                socketManager.close(createInfo.socketId);
                                self.onclose();
                            }
                        });
                    }
                }
                if (options && options.tls) {
                    socketManager.setPaused(createInfo.socketId, true, function() {
                        socketManager.connect(createInfo.socketId, address, port, function(result) {
                            if (result < 0) {
                                self.socketId.reject(result);
                                socketManager.disconnect(createInfo.socketId);
                                socketManager.close(createInfo.socketId);
                                self.onclose();
                            }
                            else {
                                socketManager.secure(createInfo.socketId, function(secureResult) {
                                    if (secureResult !== 0) {
                                        self.socketId.reject(result);
                                        socketManager.disconnect(createInfo.socketId);
                                        socketManager.close(createInfo.socketId);
                                        self.onclose();
                                    }
                                    else {
                                        socketManager.setPaused(createInfo.socketId, false, function() {
                                            self.socketId.resolve(createInfo.socketId);
                                        });
                                    }
                                });
                            }
                        });
                    });
                }
                else {
                    socketManager.connect(createInfo.socketId, address, port, function(result) {
                        if (result < 0) {
                            self.socketId.reject(result);
                            socketManager.disconnect(createInfo.socketId);
                            socketManager.close(createInfo.socketId);
                            self.onclose();
                        }
                        else {
                            self.socketId.resolve(createInfo.socketId);
                        }
                    });
                }
            });
            this.socketId.then(function(socketId) {
                socketPool[socketId] = self;
                self.connected = true;
                self.onconnect(socketId);
            }, function(reason) {
                self.onerror(reason);
            });
        } },
        send: { value: function(data) {
            var self = this;
            var promise = new Future();
            this.socketId.then(function(socketId) {
                socketManager.send(socketId, data, function(sendInfo) {
                    if (sendInfo.resultCode < 0) {
                        self.onerror(sendInfo.resultCode);
                        promise.reject(sendInfo.resultCode);
                        self.destroy();
                    }
                    else {
                        promise.resolve(sendInfo.bytesSent);
                    }
                });
            });
            return promise;
        } },
        destroy: { value: function() {
            var self = this;
            this.connected = false;
            this.socketId.then(function(socketId) {
                socketManager.disconnect(socketId);
                socketManager.close(socketId);
                delete socketPool[socketId];
                self.onclose();
            });
        } },
        ref: { value: function() {
            this.socketId.then(function(socketId) {
                socketManager.setPaused(socketId, false);
            });
        } },
        unref: { value: function() {
            this.socketId.then(function(socketId) {
                socketManager.setPaused(socketId, true);
            });
        } },
        clearTimeout: { value: function() {
            if (this.timeid !== undefined) {
                global.clearTimeout(this.timeid);
            }
        } },
        setTimeout: { value: function(timeout, fn) {
            this.clearTimeout();
            this.timeid = global.setTimeout(fn, timeout);
        } }
    });

    hprose.ChromeTcpSocket = ChromeTcpSocket;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * APICloudTcpSocket.js                                   *
 *                                                        *
 * APICloud tcp socket for HTML5.                         *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var Future = hprose.Future;
    var atob = global.atob;
    var btoa = global.btoa;
    var toUint8Array = hprose.toUint8Array;
    var toBinaryString = hprose.toBinaryString;

    function noop(){}

    var socketManager = null;

    function APICloudTcpSocket() {
        if (socketManager === null) {
            socketManager = global.api.require('socketManager');
        }
        this.socketId = new Future();
        this.connected = false;
        this.timeid = undefined;
        this.onclose = noop;
        this.onconnect = noop;
        this.onreceive = noop;
        this.onerror = noop;
    }

    Object.defineProperties(APICloudTcpSocket.prototype, {
        connect: { value: function(address, port, options) {
            var self = this;
            socketManager.createSocket({
                type: 'tcp',
                host: address,
                port: port,
                timeout: options.timeout,
                returnBase64: true
            },
            function(ret/*, err*/) {
                if (ret) {
                    switch(ret.state) {
                        case 101: break;
                        case 102: self.socketId.resolve(ret.sid); break;
                        case 103: self.onreceive(toUint8Array(atob(ret.data.replace(/\s+/g, '')))); break;
                        case 201: self.socketId.reject(new Error('Create TCP socket failed')); break;
                        case 202: self.socketId.reject(new Error('TCP connection failed')); break;
                        case 203: self.onclose(); self.onerror(new Error('Abnormal disconnect connection')); break;
                        case 204: self.onclose(); break;
                        case 205: self.onclose(); self.onerror(new Error('Unknown error')); break;
                    }
                }
            });
            this.socketId.then(function(socketId) {
                self.connected = true;
                self.onconnect(socketId);
            }, function(reason) {
                self.onerror(reason);
            });
        } },
        send: { value: function(data) {
            var self = this;
            var promise = new Future();
            this.socketId.then(function(socketId) {
                socketManager.write({
                    sid: socketId,
                    data: btoa(toBinaryString(data)),
                    base64: true
                },
                function(ret, err) {
                    if (ret.status) {
                        promise.resolve();
                    }
                    else {
                        self.onerror(new Error(err.msg));
                        promise.reject(err.msg);
                        self.destroy();
                    }
                });
            });
            return promise;
        } },
        destroy: { value: function() {
            var self = this;
            this.connected = false;
            this.socketId.then(function(socketId) {
                socketManager.closeSocket({
                    sid: socketId
                },
                function(ret, err) {
                    if (!ret.status) {
                        self.onerror(new Error(err.msg));
                    }
                });
                
                //self.onclose();
            });
        } },
        ref: { value: noop },
        unref: { value: noop },
        clearTimeout: { value: function() {
            if (this.timeid !== undefined) {
                global.clearTimeout(this.timeid);
            }
        } },
        setTimeout: { value: function(timeout, fn) {
            this.clearTimeout();
            this.timeid = global.setTimeout(fn, timeout);
        } }
    });

    hprose.APICloudTcpSocket = APICloudTcpSocket;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/
/**********************************************************\
 *                                                        *
 * TcpClient.js                                           *
 *                                                        *
 * hprose tcp client for HTML5.                           *
 *                                                        *
 * LastModified: Dec 2, 2016                              *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

(function (hprose, global, undefined) {
    var ChromeTcpSocket = hprose.ChromeTcpSocket;
    var APICloudTcpSocket = hprose.APICloudTcpSocket;
    var Client = hprose.Client;
    var BytesIO = hprose.BytesIO;
    var Future = hprose.Future;
    var TimeoutError = global.TimeoutError;
    var parseuri = hprose.parseuri;

    function noop(){}

    function setReceiveHandler(socket, onreceive) {
        socket.onreceive = function(data) {
            if (!('receiveEntry' in socket)) {
                socket.receiveEntry = {
                    stream: new BytesIO(),
                    headerLength: 4,
                    dataLength: -1,
                    id: null
                };
            }
            var entry = socket.receiveEntry;
            var stream = entry.stream;
            var headerLength = entry.headerLength;
            var dataLength = entry.dataLength;
            var id = entry.id;
            stream.write(data);
            while (true) {
                if ((dataLength < 0) && (stream.length >= headerLength)) {
                    dataLength = stream.readInt32BE();
                    if ((dataLength & 0x80000000) !== 0) {
                        dataLength &= 0x7fffffff;
                        headerLength = 8;
                    }
                }
                if ((headerLength === 8) && (id === null) && (stream.length >= headerLength)) {
                    id = stream.readInt32BE();
                }
                if ((dataLength >= 0) && ((stream.length - headerLength) >= dataLength)) {
                    onreceive(stream.read(dataLength), id);
                    headerLength = 4;
                    id = null;
                    stream.trunc();
                    dataLength = -1;
                }
                else {
                    break;
                }
            }
            entry.stream = stream;
            entry.headerLength = headerLength;
            entry.dataLength = dataLength;
            entry.id = id;
        };
    }

    function TcpTransporter(client) {
        if (client) {
            this.client = client;
            this.uri = this.client.uri;
            this.size = 0;
            this.pool = [];
            this.requests = [];
        }
    }

    Object.defineProperties(TcpTransporter.prototype, {
        create: { value: function() {
            var parser = parseuri(this.uri);
            var protocol = parser.protocol;
            var address = parser.hostname;
            var port = parseInt(parser.port, 10);
            var tls;
            if (protocol === 'tcp:' ||
                protocol === 'tcp4:' ||
                protocol === 'tcp6:') {
                tls = false;
            }
            else if (protocol === 'tcps:' ||
                protocol === 'tcp4s:' ||
                protocol === 'tcp6s:' ||
                protocol === 'tls:') {
                tls = true;
            }
            else {
                throw new Error('Unsupported ' + protocol + ' protocol!');
            }
            var conn;
            if (global.chrome && global.chrome.sockets && global.chrome.sockets.tcp) {
                conn = new ChromeTcpSocket();
            }
            else if (global.api && global.api.require) {
                conn = new APICloudTcpSocket();
            }
            else {
                throw new Error('TCP Socket is not supported by this browser or platform.');
            }
            var self = this;
            conn.connect(address, port, {
                persistent: true,
                tls: tls,
                timeout: this.client.timeout,
                noDelay: this.client.noDelay,
                keepAlive: this.client.keepAlive
            });
            conn.onclose = function() { --self.size; };
            ++this.size;
            return conn;
        } }
    });

    function FullDuplexTcpTransporter(client) {
        TcpTransporter.call(this, client);
    }

    FullDuplexTcpTransporter.prototype = Object.create(
        TcpTransporter.prototype, {
        fetch: { value: function() {
            var pool = this.pool;
            while (pool.length > 0) {
                var conn = pool.pop();
                if (conn.connected) {
                    if (conn.count === 0) {
                        conn.clearTimeout();
                        conn.ref();
                    }
                    return conn;
                }
            }
            return null;
        } },
        init: { value: function(conn) {
            var self = this;
            conn.count = 0;
            conn.futures = {};
            conn.timeoutIds = {};
            setReceiveHandler(conn, function(data, id) {
                var future = conn.futures[id];
                if (future) {
                    self.clean(conn, id);
                    if (conn.count === 0) {
                        self.recycle(conn);
                    }
                    future.resolve(data);
                }
            });
            conn.onerror = function (e) {
                var futures = conn.futures;
                for (var id in futures) {
                    var future = futures[id];
                    self.clean(conn, id);
                    future.reject(e);
                }
            };
        } },
        recycle: { value: function(conn) {
            conn.unref();
            conn.setTimeout(this.client.poolTimeout, function() {
                 conn.destroy();
            });
        } },
        clean: { value: function(conn, id) {
            if (conn.timeoutIds[id] !== undefined) {
                global.clearTimeout(conn.timeoutIds[id]);
                delete conn.timeoutIds[id];
            }
            delete conn.futures[id];
            --conn.count;
            this.sendNext(conn);
        } },
        sendNext: { value: function(conn) {
            if (conn.count < 10) {
                if (this.requests.length > 0) {
                    var request = this.requests.pop();
                    request.push(conn);
                    this.send.apply(this, request);
                }
                else {
                    if (this.pool.lastIndexOf(conn) < 0) {
                        this.pool.push(conn);
                    }
                }
            }
        } },
        send: { value: function(request, future, id, context, conn) {
            var self = this;
            var timeout = context.timeout;
            if (timeout > 0) {
                conn.timeoutIds[id] = global.setTimeout(function() {
                    self.clean(conn, id);
                    if (conn.count === 0) {
                        self.recycle(conn);
                    }
                    future.reject(new TimeoutError('timeout'));
                }, timeout);
            }
            conn.count++;
            conn.futures[id] = future;

            var len = request.length;
            var buf = new BytesIO(8 + len);
            buf.writeInt32BE(len | 0x80000000);
            buf.writeInt32BE(id);
            buf.write(request);
            conn.send(buf.buffer).then(function() {
                self.sendNext(conn);
            });
        } },
        getNextId: { value: function() {
            return (this.nextid < 0x7fffffff) ? ++this.nextid : this.nextid = 0;
        } },
        sendAndReceive: { value: function(request, future, context) {
            var conn = this.fetch();
            var id = this.getNextId();
            if (conn) {
                this.send(request, future, id, context, conn);
            }
            else if (this.size < this.client.maxPoolSize) {
                conn = this.create();
                conn.onerror = function(e) {
                    future.reject(e);
                };
                var self = this;
                conn.onconnect = function() {
                    self.init(conn);
                    self.send(request, future, id, context, conn);
                };
            }
            else {
                this.requests.push([request, future, id, context]);
            }
        } }
    });

    FullDuplexTcpTransporter.prototype.constructor = TcpTransporter;

    function HalfDuplexTcpTransporter(client) {
        TcpTransporter.call(this, client);
    }

    HalfDuplexTcpTransporter.prototype = Object.create(
        TcpTransporter.prototype, {
        fetch: { value: function() {
            var pool = this.pool;
            while (pool.length > 0) {
                var conn = pool.pop();
                if (conn.connected) {
                    conn.clearTimeout();
                    conn.ref();
                    return conn;
                }
            }
            return null;
        } },
        recycle: { value: function(conn) {
            if (this.pool.lastIndexOf(conn) < 0) {
                conn.unref();
                conn.setTimeout(this.client.poolTimeout, function() {
                    conn.destroy();
                });
                this.pool.push(conn);
            }
        } },
        clean: { value: function(conn) {
            conn.onreceive = noop;
            conn.onerror = noop;
            if (conn.timeoutId !== undefined) {
                global.clearTimeout(conn.timeoutId);
                delete conn.timeoutId;
            }
        } },
        sendNext: { value: function(conn) {
            if (this.requests.length > 0) {
                var request = this.requests.pop();
                request.push(conn);
                this.send.apply(this, request);
            }
            else {
                this.recycle(conn);
            }
        } },
        send: { value: function(request, future, context, conn) {
            var self = this;
            var timeout = context.timeout;
            if (timeout > 0) {
                conn.timeoutId = global.setTimeout(function() {
                    self.clean(conn);
                    conn.destroy();
                    future.reject(new TimeoutError('timeout'));
                }, timeout);
            }
            setReceiveHandler(conn, function(data) {
                self.clean(conn);
                self.sendNext(conn);
                future.resolve(data);
            });
            conn.onerror = function(e) {
                self.clean(conn);
                future.reject(e);
            };

            var len = request.length;
            var buf = new BytesIO(4 + len);
            buf.writeInt32BE(len);
            buf.write(request);
            conn.send(buf.buffer);
        } },
        sendAndReceive: { value: function(request, future, context) {
            var conn = this.fetch();
            if (conn) {
                this.send(request, future, context, conn);
            }
            else if (this.size < this.client.maxPoolSize) {
                conn = this.create();
                var self = this;
                conn.onerror = function(e) {
                    future.reject(e);
                };
                conn.onconnect = function() {
                    self.send(request, future, context, conn);
                };
            }
            else {
                this.requests.push([request, future, context]);
            }
        } }
    });

    HalfDuplexTcpTransporter.prototype.constructor = TcpTransporter;

    function TcpClient(uri, functions, settings) {
        if (this.constructor !== TcpClient) {
            return new TcpClient(uri, functions, settings);
        }
        Client.call(this, uri, functions, settings);

        var self = this;
        var _noDelay = true;
        var _fullDuplex = false;
        var _maxPoolSize = 10;
        var _poolTimeout = 30000;
        var fdtrans = null;
        var hdtrans = null;

        function getNoDelay() {
            return _noDelay;
        }

        function setNoDelay(value) {
            _noDelay = !!value;
        }

        function getFullDuplex() {
            return _fullDuplex;
        }

        function setFullDuplex(value) {
            _fullDuplex = !!value;
        }

        function getMaxPoolSize() {
            return _maxPoolSize;
        }

        function setMaxPoolSize(value) {
            if (typeof(value) === 'number') {
                _maxPoolSize = value | 0;
                if (_maxPoolSize < 1) {
                    _maxPoolSize = 10;
                }
            }
            else {
                _maxPoolSize = 10;
            }
        }

        function getPoolTimeout() {
            return _poolTimeout;
        }

        function setPoolTimeout(value) {
            if (typeof(value) === 'number') {
                _poolTimeout = value | 0;
            }
            else {
                _poolTimeout = 0;
            }
        }

        function sendAndReceive(request, context) {
            var future = new Future();
            if (_fullDuplex) {
                if ((fdtrans === null) || (fdtrans.uri !== self.uri)) {
                    fdtrans = new FullDuplexTcpTransporter(self);
                }
                fdtrans.sendAndReceive(request, future, context);
            }
            else {
                if ((hdtrans === null) || (hdtrans.uri !== self.uri)) {
                    hdtrans = new HalfDuplexTcpTransporter(self);
                }
                hdtrans.sendAndReceive(request, future, context);
            }
            if (context.oneway) { future.resolve(); }
            return future;
        }

        Object.defineProperties(this, {
            noDelay: { get: getNoDelay, set: setNoDelay },
            fullDuplex: { get: getFullDuplex, set: setFullDuplex },
            maxPoolSize: { get: getMaxPoolSize, set: setMaxPoolSize },
            poolTimeout: { get: getPoolTimeout, set: setPoolTimeout },
            sendAndReceive: { value: sendAndReceive }
        });
    }

    function checkuri(uri) {
        var parser = parseuri(uri);
        var protocol = parser.protocol;
        if (protocol === 'tcp:' ||
            protocol === 'tcp4:'||
            protocol === 'tcp6:' ||
            protocol === 'tcps:' ||
            protocol === 'tcp4s:' ||
            protocol === 'tcp6s:' ||
            protocol === 'tls:') {
            return;
        }
        throw new Error('This client desn\'t support ' + protocol + ' scheme.');
    }

    function create(uri, functions, settings) {
        if (typeof uri === 'string') {
            checkuri(uri);
        }
        else if (Array.isArray(uri)) {
            uri.forEach(function(uri) { checkuri(uri); });
        }
        else {
            throw new Error('You should set server uri first!');
        }
        return new TcpClient(uri, functions, settings);
    }

    Object.defineProperty(TcpClient, 'create', { value: create });

    hprose.TcpClient = TcpClient;

})(hprose, hprose.global);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * JSONRPCClientFilter.js                                 *
 *                                                        *
 * jsonrpc client filter for JavaScript.                  *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

/* global JSON */
(function (hprose) {
    var Tags = hprose.Tags;
    var BytesIO = hprose.BytesIO;
    var Writer = hprose.Writer;
    var Reader = hprose.Reader;

    var s_id = 1;

    function JSONRPCClientFilter(version) {
        this.version = version || '2.0';
    }

    JSONRPCClientFilter.prototype.inputFilter = function inputFilter(data/*, context*/) {
        var json = BytesIO.toString(data);
        if (json.charAt(0) === '{') {
            json = '[' + json + ']';
        }
        var responses = JSON.parse(json);
        var stream = new BytesIO();
        var writer = new Writer(stream, true);
        for (var i = 0, n = responses.length; i < n; ++i) {
            var response = responses[i];
            if (response.error) {
                stream.writeByte(Tags.TagError);
                writer.writeString(response.error.message);
            }
            else {
                stream.writeByte(Tags.TagResult);
                writer.serialize(response.result);
            }
        }
        stream.writeByte(Tags.TagEnd);
        return stream.bytes;
    };

    JSONRPCClientFilter.prototype.outputFilter = function outputFilter(data/*, context*/) {
        var requests = [];
        var stream = new BytesIO(data);
        var reader = new Reader(stream, false, false);
        var tag = stream.readByte();
        do {
            var request = {};
            if (tag === Tags.TagCall) {
                request.method = reader.readString();
                tag = stream.readByte();
                if (tag === Tags.TagList) {
                    request.params = reader.readListWithoutTag();
                    tag = stream.readByte();
                }
                if (tag === Tags.TagTrue) {
                    tag = stream.readByte();
                }
            }
            if (this.version === '1.1') {
                request.version = '1.1';
            }
            else if (this.version === '2.0') {
                request.jsonrpc = '2.0';
            }
            request.id = s_id++;
            requests.push(request);
        } while (tag === Tags.TagCall);
        if (requests.length > 1) {
            return JSON.stringify(requests);
        }
        return JSON.stringify(requests[0]);
    };

    hprose.JSONRPCClientFilter = JSONRPCClientFilter;

})(hprose);

/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * Loader.js                                              *
 *                                                        *
 * hprose CommonJS/AMD/CMD loader for HTML5.              *
 *                                                        *
 * LastModified: Nov 18, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

/* global define, module */
(function (hprose) {
    hprose.common = {
        Completer: hprose.Completer,
        Future: hprose.Future,
        ResultMode: hprose.ResultMode
    };

    hprose.io = {
        BytesIO: hprose.BytesIO,
        ClassManager: hprose.ClassManager,
        Tags: hprose.Tags,
        RawReader: hprose.RawReader,
        Reader: hprose.Reader,
        Writer: hprose.Writer,
        Formatter: hprose.Formatter
    };

    hprose.client = {
        Client: hprose.Client,
        HttpClient: hprose.HttpClient,
        TcpClient: hprose.TcpClient,
        WebSocketClient: hprose.WebSocketClient
    };

    hprose.filter = {
        JSONRPCClientFilter: hprose.JSONRPCClientFilter
    };

    if (typeof undefined === 'function') {
        if (undefined.cmd) {
            undefined('hprose', [], hprose);
        }
        else if (undefined.amd) {
            undefined('hprose', [], function() { return hprose; });
        }
    }
    {
        module.exports = hprose;
    }
})(hprose);
});

const timeout=3e4; const apiMethods=["accept","act","begin","commit","checkFile","checkRight","closeTunnel","createInvCode","createFileByData","deleteFile","deleteInvCode","del","exit","expire","get","getAppDownloadKey","getGShortUrlKey","getInvCodeInfo","getInvTemplate","getLFileData","getLShortUrlKey","getResByName","getTempFileMac","getUserInfo","getVar","getVarByContext","grant","hDel","hGet","hGetAll","hKeys","hLen","hMClear","hMGet","hMSet","hRevScan","hScan","hset","hSet","incr","invite","lClear","lExpire","lExpireAt","lIndex","lLen","login","lPersist","lPop","lPush","lRange","lSet","lTtl","lMClear","openTempFile","openTunnel","proxyGet","proxyPost","pullMsg","readMsg","register","restart","rollback","rPop","rPush","runScript","registerScript","runByScriptID","taskRunInBackground","run","sAdd","scan","sCard","sClear","sDiff","sendmail","sendMsg","set","setData","setHostIp","setInvTemplate","setLFileData","setUserInfo","sInter","sMClear","sMembers","sRem","sUnion","temp2LFile","test","updateInvCode","ugVerifyCode","userGroupAddManager","userGroupAddMember","userGroupCreate","userGroupDelManager","userGroupDelMember","userGroupDestroy","userGroupGetInfo","userGroupJoin","userGroupSetInfo","unInstallApp","uploadApp","uploadAppFile","veni","version","zAdd","zCard","zCount","zRange","zRangeByScore","zRank","zRem","zScore","hIncrBy","removeUser","logout","strLen","zRemRangeByScore","zMClear","zClear","setDomain","showDomain","delDomain"];function initLAPI(e,t=!1){return(t?hproseHtml5_src.Client.create:hproseHtml5_src.HttpClient.bind(hproseHtml5_src))(e,apiMethods,{timeout:timeout})}

//const api = initLAPI('http://localhost' + '/webapi/')//本地测试
//const api = initLAPI('http://192.168.1.187' + '/webapi/')//异地测试阿里云
const api = initLAPI(location.origin + '/webapi/'); //正式

const loginP = api.login('admin', '123456', 'byname');

const G = {
    api,
    sidP: loginP.then(({ sid }) => sid),
    userIdP: loginP.then(({ user: { id } }) => id)
};

window.G = G;

const Action = {
    file: File.actions,
    fileList: FileList.actions,
    fileShare: FileShare.actions
};

const Reducer = combineReducers({
    syncState: main.reducer,
    file: File.reducer,
    fileList: FileList.reducer,
    fileShare: FileShare.reducer
});

function* Saga() {
    yield* main.saga();
    yield* File.saga();
    yield* FileList.saga();
    yield* FileShare.saga();
}

class Random {
    static string(length = 10) {
        let s = '';
        for (let i = 0; i < length; i++) {
            s += Number(Math.floor(Math.random() * 32)).toString(32);
        }
        return s;
    }
}

function m(...objs) {
    return Object.assign({}, ...objs);
}

const NonSelectDiv = styled.div.withConfig({
    displayName: 'style__NonSelectDiv'
})(['user-select:none;cursor:default;']);
const ClickableDiv = styled(NonSelectDiv).withConfig({
    displayName: 'style__ClickableDiv'
})(['cursor:pointer;']);

/* eslint-disable no-unused-vars */
/* eslint-enable */
/* eslint-disable no-unused-vars */
const ContentDiv = styled.div.withConfig({
    displayName: 'CommonmarkRenderer__ContentDiv'
})(['max-width:60em;margin:0 auto;padding:2.5em;word-wrap:break-word;font-size:16px;line-height:1.5;p,blockquote,ul,ol,dl,pre{margin-top:0;margin-bottom:16px;overflow:auto}h1{padding-bottom:0.3em;font-size:2em;border-bottom:1px solid #eaecef}h2{padding-bottom:0.3em;font-size:1.5em;border-bottom:1px solid #eaecef}h3{font-size:1.25em}h4{font-size:1em}h5{font-size:0.875em}h6{font-size:0.85em;color:#6a737d}hr{height:0.25em;padding:0;margin:24px 0;background-color:#e1e4e8;border:0}blockquote{padding:0 1em;color:#6a737d;border-left:0.25em solid #dfe2e5}blockquote>:first-child{margin-top:0}blockquote>:last-child{margin-bottom:0}kbd{display:inline-block;padding:3px 5px;font-size:11px;line-height:10px;color:#444d56;vertical-align:middle;background-color:#fafbfc;border:solid 1px #c6cbd1;border-bottom-color:#959da5;border-radius:3px;box-shadow:inset 0 -1px 0 #959da5}ul,ol{padding-left:2em}ul ul,ul ol,ol ol,ol ul{margin-top:0;margin-bottom:0}li{word-wrap:break-word;list-style:inherit}li>p{margin-top:16px}li+li{margin-top:0.25em}ol ol ul,ol ul ul,ul ol ul,ul ul ul{list-style-type:square}ol ul,ul ul{list-style-type:circle}ul{list-style-type:disc}ol{list-style:decimal}img{max-width:100%}pre,xmp,plaintext,listing{padding:1em;background-color:#dfebf5}tt,code,kbd,samp{background-color:#dfebf5}a{color:#0366d6;text-decoration:none}a:hover{color:#1a03d6}a:active{color:#ba23d6}']);
/* eslint-enable */

class CommonmarkRenderer extends React.PureComponent {
    constructor(props) {
        super(props);
        this.reader = new Parser();
        this.writer = new HtmlRenderer({
            safe: true
        });
    }

    render() {
        const { markdown, styles } = this.props;
        const parsed = this.reader.parse(markdown);
        const html = this.writer.render(parsed);

        return React.createElement(
            'div',
            {
                style: m(CommonmarkRenderer.styles, styles)
            },
            React.createElement(ContentDiv, {
                dangerouslySetInnerHTML: { __html: html }
            })
        );
    }
}

CommonmarkRenderer.styles = {
    background: '#fcfdf5',
    overflowY: 'auto'
};

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

function makeEmptyFunction(arg) {
  return function () {
    return arg;
  };
}

/**
 * This function accepts and discards inputs; it has no side effects. This is
 * primarily useful idiomatically for overridable function endpoints which
 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
 */
var emptyFunction = function emptyFunction() {};

emptyFunction.thatReturns = makeEmptyFunction;
emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
emptyFunction.thatReturnsNull = makeEmptyFunction(null);
emptyFunction.thatReturnsThis = function () {
  return this;
};
emptyFunction.thatReturnsArgument = function (arg) {
  return arg;
};

var emptyFunction_1 = emptyFunction;

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

function invariant(condition, format, a, b, c, d, e, f) {
  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
}

var invariant_1 = invariant;

/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

var ReactPropTypesSecret_1 = ReactPropTypesSecret;

var factoryWithThrowingShims = function() {
  function shim(props, propName, componentName, location, propFullName, secret) {
    if (secret === ReactPropTypesSecret_1) {
      // It is still safe when called from React.
      return;
    }
    invariant_1(
      false,
      'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
      'Use PropTypes.checkPropTypes() to call them. ' +
      'Read more at http://fb.me/use-check-prop-types'
    );
  }
  shim.isRequired = shim;
  function getShim() {
    return shim;
  }
  // Important!
  // Keep this list in sync with production version in `./factoryWithTypeCheckers.js`.
  var ReactPropTypes = {
    array: shim,
    bool: shim,
    func: shim,
    number: shim,
    object: shim,
    string: shim,
    symbol: shim,

    any: shim,
    arrayOf: getShim,
    element: shim,
    instanceOf: getShim,
    node: shim,
    objectOf: getShim,
    oneOf: getShim,
    oneOfType: getShim,
    shape: getShim,
    exact: getShim
  };

  ReactPropTypes.checkPropTypes = emptyFunction_1;
  ReactPropTypes.PropTypes = ReactPropTypes;

  return ReactPropTypes;
};

var propTypes = createCommonjsModule(function (module) {
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

{
  // By explicitly using `prop-types` you are opting into new production behavior.
  // http://fb.me/prop-types-in-prod
  module.exports = factoryWithThrowingShims();
}
});

/* eslint-disable no-unused-vars */
/* eslint-enable */

class DocEventMask extends PureComponent {
    constructor() {
        super();
        this.saved = {};
    }

    componentDidMount() {
        const { events } = this.props;
        if (events) {
            Object.keys(events).forEach(key => {
                this.saved[key] = document['on' + key];
                document['on' + key] = events[key];
            });
        }
    }

    componentWillUnmount() {
        Object.keys(this.saved).forEach(key => {
            const handler = this.saved[key];
            if (handler) {
                document['on' + key] = handler;
            }
        });
    }

    render() {
        return this.props.children;
    }
}

DocEventMask.propTypes = {
    events: propTypes.objectOf(propTypes.func).isRequired
};

/* eslint-disable no-unused-vars */
/* eslint-enable */

class ModalDialog extends PureComponent {
    constructor() {
        super();
        this.saved = {};
    }

    render() {
        const {
            children,
            display,
            title,
            onOk,
            onClose,
            modalClassName,
            backdropClassName,
            modalStyles,
            backdropStyles
        } = this.props;
        if (display) {
            let footer;
            if (onOk) {
                footer = React.createElement(
                    'div',
                    { style: ModalDialog.styles.footer },
                    React.createElement(
                        'button',
                        { style: ModalDialog.styles.footer.button, onClick: onOk },
                        '\u786E\u5B9A'
                    ),
                    React.createElement(
                        'button',
                        { style: ModalDialog.styles.footer.button, onClick: onClose },
                        '\u5173\u95ED'
                    )
                );
            } else {
                footer = React.createElement(
                    'div',
                    { style: ModalDialog.styles.footer },
                    React.createElement(
                        'button',
                        { style: ModalDialog.styles.footer.button, onClick: onClose },
                        '\u5173\u95ED'
                    )
                );
            }
            return React.createElement(
                ReactModal2,
                {
                    onClose: onClose,
                    style: ModalDialog.styles.modal,
                    modalClassName: modalClassName,
                    backdropClassName: backdropClassName,
                    modalStyles: m(ModalDialog.styles.modal, modalStyles),
                    backdropStyles: m(ModalDialog.styles.backdrop, backdropStyles)
                },
                React.createElement(
                    'div',
                    { style: ModalDialog.styles.header },
                    React.createElement(
                        'h2',
                        { style: ModalDialog.styles.header.h2 },
                        title
                    )
                ),
                React.createElement(
                    'div',
                    { style: ModalDialog.styles.body },
                    children
                ),
                footer
            );
        } else {
            return null;
        }
    }
}

ModalDialog.styles = {
    modal: {
        position: 'fixed',
        display: 'flex',
        flexFlow: 'column nowrap',
        justifyContent: 'center',
        top: '25vh',
        bottom: '25vh',
        left: '30vw',
        right: '30vw',
        border: 1,
        boxShadow: '1px 1px 7px 2px rgba(0, 0, 0, 0.2)',
        borderRadius: 8,
        outline: 'none',
        zIndex: 10000
    },
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 9999
    },
    header: {
        position: 'static',
        margin: 5,
        height: '3.5em',
        h2: {
            fontSize: 26,
            padding: '5px 1em',
            margin: 5
        }
    },
    body: {
        flexGrow: 8,
        display: 'flex',
        flexFlow: 'column nowrap',
        justifyContent: 'center',
        position: 'static',
        margin: 5
    },
    footer: {
        display: 'flex',
        flexFlow: 'row nowrap',
        justifyContent: 'flex-end',
        position: 'static',
        margin: 5,
        button: {
            fontSize: 16,
            margin: '5px 10px',
            padding: '0.5em 1em',
            borderRadius: 5
        }
    }
};

ModalDialog.propTypes = {
    display: propTypes.bool.isRequired,
    title: propTypes.string.isRequired,
    onClose: propTypes.func.isRequired,
    onOk: propTypes.func,
    modalClassName: propTypes.string,
    backdropClassName: propTypes.string,
    modalStyles: propTypes.object,
    backdropStyles: propTypes.object
};

/* eslint-disable no-unused-vars */
/* eslint-enable */
class ShareDialog extends PureComponent {
    constructor() {
        super();
    }

    componentDidMount() {
        const { fileShareIOCmd, fileid } = this.props;
        fileShareIOCmd.get(fileid);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.fileid) {
            const list = nextProps.fileShare.shareidList;
            if (list && list.length) {
                if (this.creating) {
                    this.props.fileShareIOCmd.set(this.creating);
                    this.creating = '';
                }
                return;
            } else {
                if (!this.creating) {
                    if (!nextProps.fileShare.syncing) {
                        const shareid = this.props.fileShareCmd.create(nextProps.fileid);
                        this.creating = shareid;
                    }
                }
            }
        }
    }

    switchShare(tag, shareid) {
        if (tag) {
            this.props.fileShareCmd.enable(shareid);
        } else {
            this.props.fileShareCmd.disable(shareid);
        }
        this.props.fileShareIOCmd.set(shareid);
    }

    copyInput() {
        this.input.select();
        document.execCommand('copy');
    }

    render() {
        const { display, title, onClose, fileShare } = this.props;
        const url = window.location.host;
        let enable = null;
        let shareSwtch = null;
        if (fileShare.shareidList[0]) {
            enable = fileShare.shareOptions[fileShare.shareidList[0]].enable;
        }
        if (!fileShare.syncing) {
            if (enable) {
                shareSwtch = React.createElement(
                    'div',
                    { style: ShareDialog.styles.offButton, onClick: () => this.switchShare(false, fileShare.shareidList[0]) },
                    '\u5173\u95ED\u94FE\u63A5'
                );
            } else {
                shareSwtch = React.createElement(
                    'div',
                    { style: ShareDialog.styles.onButton, onClick: () => this.switchShare(true, fileShare.shareidList[0]) },
                    '\u5F00\u542F\u94FE\u63A5'
                );
            }
        } else {
            shareSwtch = React.createElement(
                'div',
                { style: ShareDialog.styles.disableButton },
                '\u5904\u7406\u4E2D...'
            );
        }
        const shareUrl = fileShare.syncing ? '处理中...' : 'http://' + url + '/#!/share/editor/' + fileShare.shareidList[0];

        let inputdiv = React.createElement(
            'div',
            { style: ShareDialog.styles.inputdiv },
            React.createElement('input', { type: 'text', style: m(ShareDialog.styles.input, ShareDialog.styles.disableStyle), readOnly: 'readonly', autoComplete: 'off', value: shareUrl }),
            React.createElement(
                'div',
                { style: m(ShareDialog.styles.button, ShareDialog.styles.disableStyle) },
                '\u590D\u5236\u8FDE\u63A5'
            )
        );

        if (enable) {
            inputdiv = React.createElement(
                'div',
                { style: ShareDialog.styles.inputdiv },
                React.createElement('input', { ref: input => this.input = input, type: 'text', style: ShareDialog.styles.input, readOnly: 'readonly', autoComplete: 'off', value: shareUrl }),
                React.createElement(
                    'div',
                    { style: ShareDialog.styles.button, onClick: this.copyInput.bind(this) },
                    '\u590D\u5236\u8FDE\u63A5'
                )
            );
        }
        return React.createElement(
            DocEventMask,
            {
                events: {
                    keydown: null,
                    mousemove: null,
                    mouseup: null,
                    doubleclick: null,
                    contextmenu: null
                } },
            React.createElement(
                ModalDialog,
                {
                    display: display,
                    title: title,
                    onClose: onClose,
                    modalStyles: {
                        backgroundColor: '#FFFFFF',
                        top: '36vh', bottom: '36vh',
                        left: '32vw', right: '32vw'
                    }
                },
                React.createElement(
                    'div',
                    { style: ShareDialog.styles.content },
                    inputdiv,
                    React.createElement(
                        'div',
                        { style: { marginTop: '1em', alignSelf: 'flex-end' } },
                        shareSwtch
                    )
                )
            )
        );
    }

}
ShareDialog.styles = {
    content: {
        border: '1px solid #dddddd',
        borderRadius: 4,
        flexGrow: 1,
        boxShadow: '0 0 10px -2px #aeadad inset',
        display: 'flex',
        flexFlow: 'column nowrap',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 'auto 15px',
        padding: '0 3em'
    },
    inputdiv: {
        display: 'flex',
        flexFlow: 'row nowrap',
        alignItems: 'stretch',
        justifyContent: 'center',
        width: '100%',
        height: '2.5em',
        border: '1px solid #ddd',
        borderRadius: 4
    },
    button: {
        padding: '0.5em',
        cursor: 'pointer',
        color: '#333'
    },
    offButton: {
        padding: '0.1em 0.9em',
        cursor: 'pointer',
        color: 'red',
        border: '1px solid #696969',
        borderRadius: 4,
        fontSize: 14
    },
    onButton: {
        padding: '0.1em 0.9em',
        cursor: 'pointer',
        color: 'blue',
        border: '1px solid #696969',
        borderRadius: 4,
        fontSize: 14
    },
    disableButton: {
        padding: '0.1em 0.9em',
        color: '#000',
        border: '1px solid #696969',
        borderRadius: 4,
        fontSize: 14,
        opacity: 0.5,
        cursor: 'not-allowed'
    },
    disableStyle: {
        color: '#000',
        opacity: 0.5,
        cursor: 'not-allowed',
        userSelect: 'none'
    },
    input: {
        fontSize: 16,
        padding: '0 10px',
        width: 'calc(100% - 7em)',
        flexGrow: 1,
        borderRadius: 4,
        border: 0,
        backgroundColor: '#eee',
        borderRight: '1px solid #ddd',
        boxShadow: 'inset 0 1px 1px rgba(0,0,0,.075)',
        cursor: 'text'
    }
};

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/* eslint-disable no-unused-vars */
/* eslint-enable */
const defaultShareDialog = Immutable.fromJS({
    title: '分享文档',
    display: false,
    fileid: ''
});
class Toolbar extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            shareDialog: defaultShareDialog
        };
    }

    showShareDialog(id) {
        this.setState(state => _extends({}, state, { shareDialog: state.shareDialog.set('display', true).set('fileid', id) }));
    }

    hideShareDialog() {
        this.setState(state => _extends({}, state, { shareDialog: state.shareDialog.set('display', false).set('fileid', '') }));
    }

    render() {
        const { syncing, fileid, fileShare, fileShareCmd, fileShareIOCmd, showEditor, toggle } = this.props;
        const syncingText = syncing ? '同步中...' : '准备就绪';
        const toggleText = showEditor ? '预览' : '编辑';
        let shareDialog = null;
        if (this.state.shareDialog.get('display')) {
            shareDialog = React.createElement(ShareDialog, {
                title: this.state.shareDialog.get('title'),
                display: true,
                onClose: this.hideShareDialog.bind(this),
                fileid: this.state.shareDialog.get('fileid'),
                fileShare: fileShare,
                fileShareCmd: fileShareCmd,
                fileShareIOCmd: fileShareIOCmd
            });
        }
        return React.createElement(
            'div',
            null,
            React.createElement(
                'div',
                { style: Toolbar.styles.bar },
                React.createElement(
                    NonSelectDiv,
                    { style: { padding: '1em', marginLeft: '1em' } },
                    syncingText
                ),
                React.createElement(
                    ClickableDiv,
                    { style: { padding: '1em' }, onClick: toggle },
                    toggleText
                ),
                React.createElement(
                    ClickableDiv,
                    { style: { padding: '1em' }, onClick: () => this.showShareDialog(fileid) },
                    '\u5206\u4EAB'
                )
            ),
            shareDialog
        );
    }
}

Toolbar.styles = {
    bar: {
        display: 'flex',
        flexFlow: 'row nowrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: 50,
        float: 'left',
        background: '#ffffff',
        borderBottom: '1px solid #ededed'
    }
};

/* eslint-disable no-unused-vars */
/* eslint-enable */
/* eslint-disable no-unused-vars */
const DIV = styled.div.withConfig({
    displayName: 'Sidebar__DIV'
})(['position:relative;height:100%;']);

const BUTTON = styled.div.withConfig({
    displayName: 'Sidebar__BUTTON'
})(['position:absolute;top:0.65em;width:1.1em;height:2em;text-align:center;cursor:pointer;user-select:none;background-color:rgba(0,160,233,0.7);color:#ffdcea;border-radius:10px 0 0 10px;']);

const BUTTONO = styled(BUTTON).withConfig({
    displayName: 'Sidebar__BUTTONO'
})(['border-radius:0 10px 10px 0;left:0;']);
const BUTTONC = styled(BUTTON).withConfig({
    displayName: 'Sidebar__BUTTONC'
})(['border-radius:10px 0 0 10px;right:0;']);
/* eslint-enable */

class Sidebar extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            hide: false
        };
        this.toggleHide = this.toggleHide.bind(this);
    }

    toggleHide() {
        this.setState(old => ({ hide: !old.hide }));
    }

    render() {
        const { children } = this.props;
        const button = this.state.hide ? React.createElement(
            BUTTONO,
            { onClick: this.toggleHide },
            ' ',
            '»',
            ' '
        ) : React.createElement(
            BUTTONC,
            { onClick: this.toggleHide },
            ' ',
            '«',
            ' '
        );
        const content = this.state.hide ? null : React.createElement(
            'div',
            { style: {
                    minWidth: '30em',
                    height: '100%'
                } },
            children
        );
        return React.createElement(
            DIV,
            this.props,
            button,
            content
        );
    }
}

Sidebar.propTypes = {
    children: propTypes.object.isRequired
};

/* eslint-disable no-unused-vars */
/* eslint-enable */
const HLayout = styled.div.withConfig({
        displayName: 'Layout__HLayout'
})(['display:flex;border-style:solid;flex-flow:row nowrap;justify-content:flex-start;flex:1;']);

const VLayout = styled.div.withConfig({
        displayName: 'Layout__VLayout'
})(['display:flex;border-style:solid;flex-flow:column nowrap;justify-content:flex-start;flex:1;']);

/* eslint-disable no-unused-vars */
/* eslint-enable */
class PlainTextEditor extends React.Component {
    constructor(props) {
        super(props);
    }

    setDomEditorRef(ref) {
        this.domEditor = ref;
    }

    focus() {
        this.domEditor.focus();
    }

    componentDidMount() {
        this.domEditor.focus();
    }

    componentDidUpdate() {}

    render() {
        const { state, onChange, styles } = this.props;
        return React.createElement(
            'div',
            {
                style: m(PlainTextEditor.styles, styles),
                onClick: this.focus.bind(this)
            },
            React.createElement(Editor, {
                value: state,
                placeholder: '\u5728\u8FD9\u91CC\u8F93\u5165\u5185\u5BB9...',
                onChange: onChange,
                ref: this.setDomEditorRef.bind(this)
            })
        );
    }
}

PlainTextEditor.styles = {
    display: 'block',
    cursor: 'text',
    padding: '1em',
    overflowY: 'auto',
    fontFamily: 'monospace'
};

/* eslint-disable no-unused-vars */
/* eslint-enable */
class EditorController extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidMount() {
        //console.log('EditorController componentDidMount')
    }

    componentWillReceiveProps(nextProps) {
        const { fileid, FileIOCmd, fileList, updateFileListState, createDefaultEditor } = this.props;
        const nextFileid = nextProps.fileid;
        console.log('hasFile', nextProps.fileList.hasFile(fileid));
        if (fileid && !nextProps.fileList.hasFile(fileid)) {
            //remove
            FileIOCmd.push(fileid, true);
        }
        if (fileList.files.size > 0 && nextProps.fileList.files.size === 0) {
            // user deleting last file, so create new default
            const id = Random.string();
            let s = nextProps.fileList.createFile(id);
            s = s.setFile(id, { title: 'Markdown操作手册' });
            createDefaultEditor();
            FileIOCmd.push(id);
            updateFileListState(s);
            return;
        }
        if (nextFileid && nextFileid !== fileid) {
            FileIOCmd.pull(nextFileid);
        }
    }

    componentDidUpdate(prevProps) {
        const { fileid, FileIOCmd } = this.props;
        const oldText = Plain.serialize(prevProps.file.editor);
        const newText = Plain.serialize(this.props.file.editor);
        if (oldText !== newText) {
            FileIOCmd.push(fileid);
        }
    }

    onChange({ value }) {
        const { updateEditor } = this.props;
        updateEditor(value);
    }

    render() {
        const { file, styles } = this.props;
        return React.createElement(PlainTextEditor, {
            state: file.editor,
            onChange: this.onChange.bind(this),
            styles: styles
        });
    }
}

/* eslint-disable no-unused-vars */
/* eslint-enable */
class CommonmarkEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showEditor: true
        };
        this.toggleShowEditor = this.toggleShowEditor.bind(this);
    }

    componentDidMount() {
        const ioCmd = this.props.FileListIOCmd;
        ioCmd.pull();
    }

    componentWillReceiveProps(nextProps) {
        const { FileListIOCmd, fileList } = this.props;
        if (!fileList.equals(nextProps.fileList)) {
            FileListIOCmd.push();
        }
    }

    toggleShowEditor() {
        this.setState({ showEditor: !this.state.showEditor });
    }

    render() {
        const {
            file,
            syncState,
            fileList,
            updateFileListState,
            updateEditor,
            createDefaultEditor,
            FileIOCmd,
            fileShare,
            FileShareIOCmd,
            FileShareCmd
        } = this.props;
        const styles = CommonmarkEditor.styles;
        const markdown = Plain.serialize(file.editor);
        const fileid = fileList.selectedFile;

        const editorDisplay = { display: this.state.showEditor ? 'block' : 'none' };
        return React.createElement(
            'div',
            { style: styles.root },
            React.createElement(
                HLayout,
                { style: { height: '100%', borderStyle: 'none' } },
                React.createElement(
                    Sidebar,
                    { style: styles.sidebar },
                    React.createElement(SimpleFileList, {
                        styles: { borderStyle: 'none' },
                        state: fileList,
                        updateState: updateFileListState
                    })
                ),
                React.createElement(
                    VLayout,
                    { style: styles.main },
                    React.createElement(Toolbar, { syncing: syncState.syncing,
                        fileid: fileid,
                        fileShare: fileShare,
                        fileShareIOCmd: FileShareIOCmd,
                        fileShareCmd: FileShareCmd,
                        showEditor: this.state.showEditor,
                        toggle: this.toggleShowEditor
                    }),
                    React.createElement(
                        HLayout,
                        { style: CommonmarkEditor.styles.content },
                        React.createElement(EditorController, {
                            fileid: fileid,
                            file: file,
                            fileList: fileList,
                            FileIOCmd: FileIOCmd,
                            updateEditor: updateEditor,
                            updateFileListState: updateFileListState,
                            createDefaultEditor: createDefaultEditor,
                            styles: m(styles.editor, editorDisplay)
                        }),
                        React.createElement(CommonmarkRenderer, {
                            markdown: markdown,
                            styles: styles.renderer
                        })
                    )
                )
            )
        );
    }
}

CommonmarkEditor.propTypes = {
    file: propTypes.object.isRequired,
    fileList: propTypes.object.isRequired,
    syncState: propTypes.object.isRequired,
    fileShare: propTypes.object.isRequired,
    updateFileListState: propTypes.func.isRequired,
    updateEditor: propTypes.func.isRequired,
    FileIOCmd: propTypes.object.isRequired,
    FileShareCmd: propTypes.object.isRequired,
    FileShareIOCmd: propTypes.object.isRequired
};

CommonmarkEditor.styles = {
    root: {
        position: 'absolute',
        display: 'flex',
        flexFlow: 'column',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
    },
    sidebar: {
        maxWidth: '30%'
    },
    main: {
        minWidth: '70%',
        maxWidth: '100%',
        borderStyle: 'none'
    },
    editor: {
        flex: 55
    },
    content: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        height: '100%',
        borderStyle: 'none'
    },
    renderer: {
        flex: 45
    }
};

/* eslint-disable no-unused-vars */
/* eslint-enable */

const mapStateToProps = state => {
    return {
        file: state.file,
        fileList: state.fileList,
        syncState: state.syncState,
        fileShare: state.fileShare.toJS()
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { externalCmd: { saveFile, saveFileList, loadFile, loadFileList, setShare, getShare } } = ownProps;
    const FileIOCmd = {
        pull: id => {
            dispatch(Action.file.cmd.pull(id, loadFile));
        },
        push: (id, remove) => {
            dispatch(Action.file.cmd.push(id, saveFile, remove));
        }
    };
    const FileListIOCmd = {
        pull: () => {
            dispatch(Action.fileList.cmd.pull(loadFileList));
        },
        push: () => {
            dispatch(Action.fileList.cmd.push(saveFileList));
        }
    };
    const FileShareIOCmd = {
        set: shareid => {
            dispatch(Action.fileShare.set(shareid, setShare));
        },
        get: fileid => {
            dispatch(Action.fileShare.get(fileid, getShare));
        }
    };
    const FileShareCmd = {
        enable: shareid => {
            dispatch(Action.fileShare.enable(shareid));
        },
        disable: shareid => {
            dispatch(Action.fileShare.disable(shareid));
        },
        create: fileid => {
            const shareid = Random.string(12);
            dispatch(Action.fileShare.create(fileid, shareid));
            return shareid;
        },
        remove: shareid => {
            dispatch(Action.fileShare.remove(shareid));
        }
    };
    return {
        createDefaultEditor: () => {
            dispatch(Action.file.createDefault());
        },
        updateEditor: editor => {
            dispatch(Action.file.updateEditor(editor));
        },
        updateFileListState: fileListState => {
            dispatch(Action.fileList.updateFileListState(fileListState));
        },
        FileIOCmd,
        FileListIOCmd,
        FileShareCmd,
        FileShareIOCmd
    };
};

var ConnectedCommonmarkEditor = connect(mapStateToProps, mapDispatchToProps)(CommonmarkEditor);

/* eslint-disable no-unused-vars */
/* eslint-enable */
// callbacks: {
//     saveFile: (id, json)=>Promise()
//     saveFileList: (json)=>Promise()
//     loadFile: (id)=>Promise(json)
//     loadFileList: ()=>Promise(json)

//      setShare: (shareid,fileid,options)=>Promise()
//      getShare: (fileid) =>Promise([{options}])
// }
function initCommonMark(element, callbacks, readonly = false) {
    const logger = createLogger({
        duration: true
    });
    const sagaMiddleware = createSagaMiddleware();

    let middlewares = applyMiddleware(sagaMiddleware, logger);
    /* globals process */
    {
        middlewares = applyMiddleware(sagaMiddleware);
    }
    const store = createStore(Reducer, middlewares);
    sagaMiddleware.run(Saga);

    console.assert(callbacks.saveFile, 'need saveFile');
    console.assert(callbacks.saveFileList, 'need saveFileList');
    console.assert(callbacks.loadFile, 'need loadFile');
    console.assert(callbacks.loadFileList, 'need loadFileList');
    console.assert(callbacks.setShare, 'need setShare');
    console.assert(callbacks.getShare, 'need getShare');

    const {
        saveFile,
        saveFileList,
        loadFile,
        loadFileList,
        setShare,
        getShare
    } = callbacks;
    const externalCmd = {
        saveFile,
        saveFileList,
        loadFile,
        loadFileList,
        setShare,
        getShare
    };

    render(React.createElement(
        Provider,
        { store: store },
        React.createElement(ConnectedCommonmarkEditor, { readonly: readonly, externalCmd: externalCmd })
    ), element);
}

function deinit(element) {
    unmountComponentAtNode(element);
}

export { deinit };
export default initCommonMark;
