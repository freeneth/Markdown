import { connect } from 'react-redux'
import { Action } from './store.js';
/* eslint-disable no-unused-vars */
import React from 'react'
import CommonmarkEditor from './component/CommonmarkEditor.jsx'
/* eslint-enable */

const mapStateToProps= (state)=>{
    return {
        file: state.file,
        fileList: state.fileList,
        syncState: state.syncState,
    }
}

const mapDispatchToProps = (dispatch, ownProps) =>{
    const { externalCmd: { saveFile, saveFileList, loadFile, loadFileList }} = ownProps
    const FileIOCmd = {
        pull: (id) => {
            dispatch(Action.file.cmd.pull(id, loadFile, saveFile))
        },
        push: (id) => {
            dispatch(Action.file.cmd.push(id, saveFile))
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
    return {
        updateEditor: (editor)=>{
            dispatch(Action.file.updateEditor(editor))
        },
        updateFileListState: (fileListState)=>{
            dispatch(Action.fileList.updateFileListState(fileListState))
        },
        FileIOCmd,
        FileListIOCmd,
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CommonmarkEditor);
