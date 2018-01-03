/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import { m } from '../style.js'
import { Parser, HtmlRenderer } from 'commonmark'
import styled from 'styled-components'

/* eslint-disable no-unused-vars */
const ContentDiv = styled.div`
    max-width: 60em;
    margin: 0 auto;
    padding: 2.5em;
    word-wrap: break-word;
    font-size: 16px;
    line-height: 1.5;
    p, blockquote, ul, ol, dl, pre {
        margin-top: 0;
        margin-bottom: 16px
    }
    h1 {
        padding-bottom: 0.3em;
        font-size: 2em;
        border-bottom: 1px solid #eaecef
    }
    h2 {
        padding-bottom: 0.3em;
        font-size: 1.5em;
        border-bottom: 1px solid #eaecef
    }
    h3 {
        font-size: 1.25em
    }
    h4 {
        font-size: 1em
    }
    h5 {
        font-size: 0.875em
    }
    h6 {
        font-size: 0.85em;
        color: #6a737d
    }
    hr {
        height: 0.25em;
        padding: 0;
        margin: 24px 0;
        background-color: #e1e4e8;
        border: 0
    }
    blockquote {
        padding: 0 1em;
        color: #6a737d;
        border-left: 0.25em solid #dfe2e5
    }
    blockquote>:first-child {
        margin-top: 0
    }
    blockquote>:last-child {
        margin-bottom: 0
    }
    kbd {
        display: inline-block;
        padding: 3px 5px;
        font-size: 11px;
        line-height: 10px;
        color: #444d56;
        vertical-align: middle;
        background-color: #fafbfc;
        border: solid 1px #c6cbd1;
        border-bottom-color: #959da5;
        border-radius: 3px;
        box-shadow: inset 0 -1px 0 #959da5
    }
    ul, ol {
        padding-left: 2em
    }
    ul ul, ul ol, ol ol, ol ul {
        margin-top: 0;
        margin-bottom: 0
    }
    li {
        word-wrap: break-all
    }
    li>p {
        margin-top: 16px
    }
    li+li {
        margin-top: 0.25em
    }
    ol ol ul, ol ul ul, ul ol ul, ul ul ul {
        list-style-type: square
    }
    ol ul, ul ul {
        list-style-type: circle
    }
    ul {
        list-style-type: disc
    }
    ol {
        list-style: decimal
    }
    img {
        max-width: 100%
    }
    pre, xmp, plaintext, listing {
        padding: 1em;
        background-color: #dfebf5
    }
    tt, code, kbd, samp {
        background-color: #dfebf5
    }
    a {
        color: #0366d6;
        text-decoration: none
    }
    a:hover {
        color: #1a03d6
    }
    a:active {
        color: #ba23d6
    }
`
/* eslint-enable */

export default class CommonmarkRenderer extends React.PureComponent {
    constructor(props) {
        super(props)
        this.reader = new Parser()
        this.writer = new HtmlRenderer({
            safe: true,
        })
    }

    render() {
        const { markdown, styles } = this.props
        const parsed = this.reader.parse(markdown)
        const html = this.writer.render(parsed)

        return <div
            style={m(CommonmarkRenderer.styles, styles)}
        >
            <ContentDiv
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    }
}

CommonmarkRenderer.styles = {
    background: '#fcfdf5',
    overflowY: 'auto',
}
