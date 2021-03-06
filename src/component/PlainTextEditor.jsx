/* eslint-disable no-unused-vars */
import React from 'react'
import { Editor} from 'slate-react'
/* eslint-enable */
import { m } from '../style.js'


export default class PlainTextEditor extends React.Component {
    constructor(props) {
        super(props)
    }

    setDomEditorRef(ref) {
        this.domEditor = ref
    }

    focus() {
        this.domEditor.focus()
    }

    componentDidMount() {
        this.domEditor.focus()
    }

    componentDidUpdate() {
    }

    render() {
        const { state, onChange, styles } = this.props
        return (
            <div
                style={m(PlainTextEditor.styles, styles)}
                onClick={this.focus.bind(this)}
            >
                <Editor
                    value={state}
                    placeholder='在这里输入内容...'
                    onChange={onChange}
                    ref={this.setDomEditorRef.bind(this)}
                />
            </div>
        )
    }
}

PlainTextEditor.styles = {
    display: 'block',
    cursor: 'text',
    padding: '1em',
    overflowY: 'auto',
    fontFamily: 'monospace',
}
