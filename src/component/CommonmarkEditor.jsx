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
            editorState: EditorState.createEmpty(),
            fileListState: FileListState.createEmpty(),
        }
    }

    onChange(editorState) {
        const text = editorState.getCurrentContent().getPlainText()
        console.log(text)
        this.setState({ editorState })
        const { FileIOCmd, FileCmd } = this.props
        if(text && text !=''){

            FileCmd.setContent('fileid', text)
            FileIOCmd.push('fileid') 
        }
        /* const FileCmd = this.props.FileCmd
        
        */
    }

    componentDidMount() {
        const { FileIOCmd, FileCmd } = this.props
        FileCmd.createFile()
        FileIOCmd.push('fileid')
    }

    render() {
        const { FileIOCmd, FileCmd } = this.props
        const styles = CommonmarkEditor.styles
        const markdown = this.state.editorState.getCurrentContent().getPlainText()
        const fileid = this.state.fileListState.selectedFile
        if (fileid) {
            const file = this.state.fileListState.files.find((f) => f.id === fileid)
            console.log(file.title)
        }
    
        return (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <VLayout styles={{ height: '100%' }}>
                <Sidebar>
                    <SimpleFileList
                        state={this.state.fileListState}
                        updateState={(fileListState) => this.setState({ fileListState })}
                    />
                </Sidebar>
                <HLayout styles={{flexGrow: 2}}>
                    <Toolbar />
                    <VLayout styles={CommonmarkEditor.styles.content}>
                        <PlainTextEditor
                            state={this.state.editorState}
                            onChange={this.onChange.bind(this)}
                            styles={styles.editor}
                            FileIOCmd={FileIOCmd}
                        />
                        <CommonmarkRenderer
                            markdown={markdown}
                            styles={styles.renderer}
                        />
                    </VLayout>
                </HLayout>
            </VLayout>
            
        </div>)
        /*  return (
            <div style={{position: 'absolute',top: 0, left: 0, right: 0, bottom: 0, borderStyle: 'solid'}}>
                <VLayout styles={{height: '100%'}}>
                    <div style={{flexGrow: 1, borderStyle: 'solid'}}> 1 </div>
                    <HLayout styles={{ flexGrow: 2 }}>
                        <div style={{ flexGrow: 1, borderStyle: 'solid' }}> 2 </div>
                        <div style={{ flexGrow: 1, borderStyle: 'solid' }}> 3 </div>
                    </HLayout>
                </VLayout>
            </div>
        ) */
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
