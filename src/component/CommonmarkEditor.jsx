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
        this.state = {
            editor: false,
        }

    }

    componentDidMount() {
        const ioCmd = this.props.FileListIOCmd
        ioCmd.pull()
        //console.log('commonmarkEditor componentDidMount')
    }

    componentWillReceiveProps(nextProps) {
        const { FileListIOCmd, fileList } = this.props
        if (!fileList.equals(nextProps.fileList)) {
            FileListIOCmd.push()
        }
        //console.log('componentWillReceiveProps')
    }

    onEditor(){
        const tag = this.state.editor ? false: true
        const display = this.state.editor ? 'none' : 'unset'
        CommonmarkEditor.styles.editor.display = display
        this.setState({ editor: tag })
    }

    render() {
        const { file, file: { syncingIdx }, fileList, updateFileListState, updateEditor, FileIOCmd, fileShare, FileShareIOCmd, FileShareCmd } = this.props
        const styles = CommonmarkEditor.styles
        const markdown = file.editor.getCurrentContent().getPlainText()
        const fileid = fileList.selectedFile

        return (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <VLayout styles={{ height: '100%', borderStyle: 'none' }}>
                <Sidebar>
                    <SimpleFileList
                        styles={{borderStyle: 'none'}}
                        state={fileList}
                        updateState={updateFileListState}
                    />
                </Sidebar>
                <HLayout styles={{flexGrow: 2}}>
                    <Toolbar syncing={syncingIdx >= 0}
                        fileid={fileid}
                        fileShare={fileShare}
                        fileShareIOCmd={FileShareIOCmd}
                        fileShareCmd={FileShareCmd}
                        editor={this.state.editor}
                        onEditor={this.onEditor.bind(this)}
                    />
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
        display: 'none',
    },
    renderer: {
        flexGrow: 1,
        width: '45%',
    },
}
