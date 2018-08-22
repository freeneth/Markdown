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

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

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
