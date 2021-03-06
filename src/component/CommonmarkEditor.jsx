/* eslint-disable no-unused-vars */
import React from 'react'
import Plain from 'slate-plain-serializer'
import CommonmarkRenderer from './CommonmarkRenderer.jsx'
import Toolbar from './Toolbar.jsx'
import Sidebar from './Sidebar.jsx'
import {SimpleFileList} from 'react-simple-file-list'
import {VLayout, HLayout} from './Layout.jsx'
import EditorController from './EditorController.jsx'
/* eslint-enable */
import {m} from '../style.js'
import PropTypes from 'prop-types'

export default class CommonmarkEditor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            showEditor: true,
        }
        this.toggleShowEditor = this.toggleShowEditor.bind(this)

    }

    componentDidMount() {
        const ioCmd = this.props.FileListIOCmd
        ioCmd.pull()
    }

    componentWillReceiveProps(nextProps) {
        const { FileListIOCmd, fileList} = this.props
        if (!fileList.equals(nextProps.fileList)) {
            FileListIOCmd.push()
        }
    }

    toggleShowEditor(){
        this.setState({ showEditor: !this.state.showEditor })
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
            FileShareCmd,
        } = this.props
        const styles = CommonmarkEditor.styles
        const markdown = Plain.serialize(file.editor)
        const fileid = fileList.selectedFile

        const editorDisplay = {display: this.state.showEditor ? 'block' :'none' }
        return (<div style={styles.root}>
            <HLayout style={{ height: '100%', borderStyle: 'none'}}>
                <Sidebar style={styles.sidebar}>
                    <SimpleFileList
                        styles={{borderStyle: 'none'}}
                        state={fileList}
                        updateState={updateFileListState}
                    />
                </Sidebar>
                <VLayout style={styles.main}>
                    <Toolbar syncing={syncState.syncing}
                        fileid={fileid}
                        fileShare={fileShare}
                        fileShareIOCmd={FileShareIOCmd}
                        fileShareCmd={FileShareCmd}
                        showEditor={this.state.showEditor}
                        toggle={this.toggleShowEditor}
                    />
                    <HLayout style={CommonmarkEditor.styles.content}>
                        <EditorController
                            fileid={fileid}
                            file={file}
                            fileList={fileList}
                            FileIOCmd={FileIOCmd}
                            updateEditor={updateEditor}
                            updateFileListState={updateFileListState}
                            createDefaultEditor={createDefaultEditor}
                            styles={m(styles.editor, editorDisplay)}
                        />
                        <CommonmarkRenderer
                            markdown={markdown}
                            styles={styles.renderer}
                        />
                    </HLayout>
                </VLayout>
            </HLayout>
        </div>)
    }
}

CommonmarkEditor.propTypes = {
    file: PropTypes.object.isRequired,
    fileList: PropTypes.object.isRequired,
    syncState: PropTypes.object.isRequired,
    fileShare: PropTypes.object.isRequired,
    updateFileListState: PropTypes.func.isRequired,
    updateEditor: PropTypes.func.isRequired,
    FileIOCmd: PropTypes.object.isRequired,
    FileShareCmd: PropTypes.object.isRequired,
    FileShareIOCmd: PropTypes.object.isRequired,
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
    sidebar: {
        maxWidth: '30%',
    },
    main: {
        minWidth: '70%',
        maxWidth: '100%',
        borderStyle: 'none',
    },
    editor: {
        flex: 55,
    },
    content: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        height: '100%',
        borderStyle: 'none',
    },
    renderer: {
        flex: 45,
    },
}
