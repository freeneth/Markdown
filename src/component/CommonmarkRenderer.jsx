/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import { m } from '../style.js'
import { Parser, HtmlRenderer } from 'commonmark'
import styled from 'styled-components'

/* eslint-disable no-unused-vars */
const ContentDiv = styled.div`
    max-width: 60em;
    min-width: 30em;
    margin: 0 auto;
    padding: 2.5em;
    h1, h2, h3, h4, h5, h6 {
        line-height: 2em;
    }
    p, li {
        line-height: 1.5em;
    }
    img {
        max-width: 100%;
    }
    pre, xmp, plaintext, listing {
        padding: 1em;
        background-color: #dfebf5;
    }
    tt, code, kbd, samp {
        background-color: #dfebf5;
    }
    a {
        color: #0366d6;
        text-decoration: none;
    }
    a:hover {
        color: #1a03d6;
    }
    a:active {
        color: #ba23d6;
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
