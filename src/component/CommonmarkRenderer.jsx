/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import { m } from '../style.js'
import { Parser, HtmlRenderer } from 'commonmark'

export default class CommonmarkRenderer extends React.PureComponent {
    constructor(props) {
        super(props)
        this.reader = new Parser()
        this.writer = new HtmlRenderer({
            safe: true,
        })
    }

    render() {
        const {markdown, styles} = this.props
        const parsed = this.reader.parse(markdown)
        const html = this.writer.render(parsed)

        return <div
            style={m(CommonmarkRenderer.styles, styles)}
            dangerouslySetInnerHTML={{__html: html}}
        />
    }
}

CommonmarkRenderer.styles = {
    background: '#f0f0f0',
    padding: '1em',
}
