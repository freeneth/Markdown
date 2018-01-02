/* eslint-disable no-unused-vars */
import React from 'react'
import PlainTextEditor from './PlainTextEditor.jsx'
/* eslint-enable */


export default class EditorController extends React.Component {
    constructor(props) {
        super(props)
    }

    componentDidMount(){
        //console.log('EditorController componentDidMount')
    }

    componentWillReceiveProps(nextProps){
        const { fileid, FileIOCmd } = this.props
        const nextFileid = nextProps.fileid
        if (fileid !== nextFileid) {
            FileIOCmd.pull(nextFileid)
        }
    }

    onChange(editorState) {
        const { updateEditor, fileid, FileIOCmd } = this.props
        updateEditor(editorState)
        const text = this.props.file.editor.getCurrentContent().getPlainText()

        const newText = editorState.getCurrentContent().getPlainText()
        if (text !== newText) {
            FileIOCmd.push(fileid)
        }
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
