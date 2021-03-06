/* eslint-disable no-unused-vars */
import React from 'react'
import PlainTextEditor from './PlainTextEditor.jsx'
/* eslint-enable */
import Plain from 'slate-plain-serializer'
import Random from '../random.js'


export default class EditorController extends React.Component {
    constructor(props) {
        super(props)
    }

    componentDidMount(){
        //console.log('EditorController componentDidMount')
    }

    componentWillReceiveProps(nextProps){
        const { fileid, FileIOCmd, fileList, updateFileListState, createDefaultEditor } = this.props
        const nextFileid = nextProps.fileid
        console.log('hasFile',  nextProps.fileList.hasFile(fileid))
        if (fileid && !nextProps.fileList.hasFile(fileid)) {
            //remove
            FileIOCmd.push(fileid, true)
        }
        if (fileList.files.size > 0 && nextProps.fileList.files.size === 0) {
            // user deleting last file, so create new default
            const id = Random.string()
            let s = nextProps.fileList.createFile(id)
            s = s.setFile(id, {title: 'Markdown操作手册'})
            createDefaultEditor()
            FileIOCmd.push(id)
            updateFileListState(s)
            return
        }
        if (nextFileid && nextFileid !== fileid) {
            FileIOCmd.pull(nextFileid)
        }
    }

    componentDidUpdate(prevProps) {
        const {  fileid, FileIOCmd } = this.props
        const oldText = Plain.serialize(prevProps.file.editor)
        const newText = Plain.serialize(this.props.file.editor)
        if (oldText !== newText) {
            FileIOCmd.push(fileid)
        }
    }

    onChange({value}) {
        const { updateEditor } = this.props
        updateEditor(value)
    }

    render() {
        const {file,styles} = this.props
        return (
            <PlainTextEditor
                state={file.editor}
                onChange={this.onChange.bind(this)}
                styles={styles}
            />
        )
    }
}
