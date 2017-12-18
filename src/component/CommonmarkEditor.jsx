/* eslint-disable no-unused-vars */
import React from 'react'
import PlainTextEditor from './PlainTextEditor.jsx'
import CommonmarkRenderer from './CommonmarkRenderer.jsx'
/* eslint-enable */
import { EditorState } from 'draft-js'

export default class CommonmarkEditor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            editorState: EditorState.createEmpty(),
        }
    }

    onChange(editorState) {
        this.setState({editorState})
    }

    render() {
        const styles = CommonmarkEditor.styles
        const markdown = this.state.editorState.getCurrentContent().getPlainText()
        return (<div style={styles.root}>
            <PlainTextEditor
                state={this.state.editorState} 
                onChange={this.onChange.bind(this)}
                styles={styles.editor}
            />
            <CommonmarkRenderer
                markdown={markdown}
                styles={styles.renderer}
            />
        </div>)
    }
}

CommonmarkEditor.styles = {
    root: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        position: 'absolute',
        display: 'flex',
        flexFlow: 'row nowarp',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
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
