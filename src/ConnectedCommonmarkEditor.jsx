import { connect } from 'react-redux'
import { Action } from './store.js'
import Random from './random.js'
/* eslint-disable no-unused-vars */
import React from 'react'
import CommonmarkEditor from './component/CommonmarkEditor.jsx'
/* eslint-enable */

const mapStateToProps= (state)=>{
    return {
        file: state.file,
        fileList: state.fileList,
        syncState: state.syncState,
        fileShare: state.fileShare.toJS(),
    }
}

const mapDispatchToProps = (dispatch, ownProps) =>{
    const { externalCmd: { saveFile, saveFileList, loadFile, loadFileList,setShare, getShare }} = ownProps
    const FileIOCmd = {
        pull: (id) => {
            dispatch(Action.file.cmd.pull(id, loadFile, saveFile))
        },
        push: (id, remove=false) => {
            dispatch(Action.file.cmd.push(id, saveFile, remove))
        },
    }
    const FileListIOCmd = {
        pull: () =>{
            dispatch(Action.fileList.cmd.pull(loadFileList))
        },
        push: () => {
            dispatch(Action.fileList.cmd.push(saveFileList))
        },
    }
    const FileShareIOCmd = {
        set: (shareid) => {
            dispatch(Action.fileShare.set(shareid, setShare))
        },
        get: (fileid) => {
            dispatch(Action.fileShare.get(fileid, getShare))
        },
    }
    const FileShareCmd = {
        enable: (shareid) => {
            dispatch(Action.fileShare.enable(shareid))
        },
        disable: (shareid) => {
            dispatch(Action.fileShare.disable(shareid))
        },
        create: (fileid) => {
            const shareid = Random.string(12)
            dispatch(Action.fileShare.create(fileid, shareid))
            return shareid
        },
        remove: (shareid) => {
            dispatch(Action.fileShare.remove(shareid))
        },
    }
    return {
        updateEditor: (editor)=>{
            dispatch(Action.file.updateEditor(editor))
        },
        updateFileListState: (fileListState)=>{
            dispatch(Action.fileList.updateFileListState(fileListState))
        },
        FileIOCmd,
        FileListIOCmd,
        FileShareCmd,
        FileShareIOCmd,
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CommonmarkEditor);
