/* eslint-disable no-unused-vars */
import React from 'react'
import PlainTextEditor from './PlainTextEditor.jsx'
/* eslint-enable */

export default class CommonmarkEditor extends React.Component {
    constructor(props) {
        super(props)
    }

    render() {
        const styles = CommonmarkEditor.styles
        return (<div style={styles.root}>
            <PlainTextEditor/>
        </div>)
    }
}

CommonmarkEditor.styles = {
    root: {
        position: 'absolute',
        display: 'flex',
        flexFlow: 'row nowarp',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
}
