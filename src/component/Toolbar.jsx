/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import { PureComponent } from 'react'

export default class Toolbar extends PureComponent {
    render() {
        //const {syncing} = this.this.props
        return (
            <div style={Toolbar.styles.bar}></div>
        )
    }
}

Toolbar.styles = {
    bar: {
        display: 'flex',
        flexFlow: 'row nowrap',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        height: 50,
        float: 'left',
        background: '#ffffff',
        borderBottom: '1px solid #ededed',
    },
}