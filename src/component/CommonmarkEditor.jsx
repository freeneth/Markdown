/* eslint-disable no-unused-vars */
import React from 'react'
import PlainTextEditor from './PlainTextEditor.jsx'
import CommonmarkRenderer from './CommonmarkRenderer.jsx'
import Toolbar from './Toolbar.jsx'
import Sidebar from './Sidebar.jsx'
import {SimpleFileList} from 'react-simple-file-list'
import VLayout from './VLayout.jsx'
import HLayout from './HLayout.jsx'
import EditorController from './EditorController.jsx'
/* eslint-enable */

export default class CommonmarkEditor extends React.Component {
    constructor(props) {
        super(props)
    }

    componentDidMount() {
        //console.log('commonmarkEditor componentDidMount')
    }

    componentWillReceiveProps(nextProps) {
        const { FileIOCmd, fileList} = this.props
        const fileid = fileList.fileListState.selectedFile
        const oldText = this.props.file.editor.getCurrentContent().getPlainText()
        const newText = nextProps.file.editor.getCurrentContent().getPlainText()
        if (oldText != newText) {
            FileIOCmd.push(fileid)
        }
        //console.log('componentWillReceiveProps')
    }

    componentWillUpdate(nextProps, nextState){

        /* const selectedFile = this.state.fileListState.selectedFile
        const nextSelectedFile = nextState.fileListState.selectedFile
        if (selectedFile !== nextSelectedFile){
            console.log('componentWillUpdate not...')
            const { FileIOCmd, FileCmd } = this.props
            FileCmd.createFile()
            FileIOCmd.pull(nextSelectedFile)
        } */
    }

    componentDidUpdate(prevProps, prevState){
        //console.log('componentDidUpdate')
    }

    render() {
        const { file, file: { syncingIdx }, fileList, updateFileListState, updateEditor, FileIOCmd} = this.props
        const styles = CommonmarkEditor.styles
        const markdown = file.editor.getCurrentContent().getPlainText()
        const fileid = fileList.fileListState.selectedFile

        return (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <VLayout styles={{ height: '100%' }}>
                <Sidebar>
                    <SimpleFileList
                        state={fileList.fileListState}
                        updateState={(fileListState) => updateFileListState(fileListState)}
                    />
                </Sidebar>
                <HLayout styles={{flexGrow: 2}}>
                    <Toolbar syncing={syncingIdx >= 0}/>
                    <VLayout styles={CommonmarkEditor.styles.content}>
                        <EditorController
                            fileid={fileid}
                            file={file}
                            FileIOCmd={FileIOCmd}
                            updateEditor={updateEditor}
                            styles={styles.editor}
                        />
                        <CommonmarkRenderer
                            markdown={markdown}
                            styles={styles.renderer}
                        />
                    </VLayout>
                </HLayout>
            </VLayout>
        </div>)
    }
}

CommonmarkEditor.styles = {
    root: {
        position: 'absolute',
        display: 'flex',
        flexFlow: 'column',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    content: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        height: '100%',
    },
    editor: {
        flexGrow: 1,
        width: '55%',
    },
    renderer: {
        flexGrow: 1,
        width: '45%',
    },
}
