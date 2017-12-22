/* eslint-disable no-unused-vars */
import React from 'react'
import PlainTextEditor from './PlainTextEditor.jsx'
import CommonmarkRenderer from './CommonmarkRenderer.jsx'
import Toolbar from './Toolbar.jsx'
import Sidebar from './Sidebar.jsx'
import {SimpleFileList} from 'react-simple-file-list'
import VLayout from './VLayout.jsx'
import HLayout from './HLayout.jsx'
/* eslint-enable */
import { EditorState } from 'draft-js'
import {FileListState} from 'react-simple-file-list'

export default class CommonmarkEditor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            fileListState: FileListState.createEmpty()
        }
    }

    checkSave() {
        if (this.editorSyncingIdx < 0 ) {
            this.editorSyncingIdx = this.editorSyncQueue.length - 1
            // TODO: implement save
            this.props.externalCmds.save(this.editorSyncQueue[this.editorSyncingIdx]).then(() => {
                this.editorSyncQueue = this.editorSyncQueue.slice(this.editorSyncingIdx)
                this.editorSyncingError = false
                this.editorSyncingIdx = -1
            }).catch((e) => {
                console.error(e)
                this.editorSyncingError = true
                this.editorSyncingIdx = -1
            })
        }
    }

    onChange(editorState) {
        const { updateEditor} = this.props
        updateEditor(editorState)
    }

    componentDidMount() {
        //console.log('componentDidMount')
        /* const { FileIOCmd, FileCmd } = this.props
        FileCmd.createFile()
        FileIOCmd.push('fileid') */
    }

    componentWillReceiveProps(nextProps) {
        const { FileIOCmd } = this.props
        const fileid = 'testid'
        const oldText = this.props.file.editor.getCurrentContent().getPlainText()
        const newText = nextProps.file.editor.getCurrentContent().getPlainText()
        console.log(oldText, newText)
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
        const { file, file: { syncingIdx}} = this.props
        console.log('editorSyncingIdx', syncingIdx)
        const styles = CommonmarkEditor.styles
        const markdown = file.editor.getCurrentContent().getPlainText()

        return (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <VLayout styles={{ height: '100%' }}>
                <Sidebar>
                    <SimpleFileList
                        state={this.state.fileListState}
                        updateState={(fileListState) => this.setState({ fileListState })}
                    />
                </Sidebar>
                <HLayout styles={{flexGrow: 2}}>
                    <Toolbar syncing={syncingIdx >= 0}/>
                    <VLayout styles={CommonmarkEditor.styles.content}>
                        <PlainTextEditor
                            state={file.editor}
                            onChange={this.onChange.bind(this)}
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
