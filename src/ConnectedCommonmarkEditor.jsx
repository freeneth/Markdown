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
    }
}

const mapDispatchToProps = (dispatch, ownProps) =>{
    const { externalCmd: { saveFile, saveFileList, loadFile, loadFileList }} = ownProps
    const FileIOCmd = {
        pull: (id) => {
            dispatch(Action.file.cmd.pull(id, loadFile))
        },
        push: (id) => {
            dispatch(Action.file.cmd.push(id, saveFile))
        },
    }
    const FileCmd = {
        createFile: () => {
            const id = 'fileid'
            dispatch(Action.file.create(id))
        },
        removeFile: (id) => {
            dispatch(Action.file.remove(id))
        },
        setContent: (id, content) => {
            dispatch(Action.file.setContent(id, content))
        },
    }
    return {
        FileIOCmd, 
        FileCmd,
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CommonmarkEditor);
