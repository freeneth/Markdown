/* eslint-disable no-unused-vars */
import React from 'react'
import { Editor} from 'draft-js'
/* eslint-enable */
import { EditorState } from 'draft-js'

export default class PlainTextEditor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            editorState: EditorState.createEmpty(),
        }
    }

    onChange(editorState) {
        console.log(editorState.toJS())
        this.setState({editorState})
    }

    setDomEditorRef(ref) {
        this.domEditor = ref
    }

    componentDidMount() {
        this.domEditor.focus()
    }

    render() {
        const styles = PlainTextEditor.styles
        return (
            <div style={styles.editor} onClick={this.focus}>
                <Editor
                    editorState={this.state.editorState}
                    onChange={this.onChange.bind(this)}
                    placeholder="Enter some text..."
                    ref={this.setDomEditorRef.bind(this)}
                />
            </div>
        )

    }
}

PlainTextEditor.styles = {
    editor: {
        flexGrow: 1,
        border: '1px solid #ccc',
        cursor: 'text',
        minHeight: 80,
        padding: 10,
    },
}
