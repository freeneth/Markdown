/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import { PureComponent } from 'react'

export default class Toolbar extends PureComponent {
    constructor(props){
        super(props)
    }
    render() {
        const {syncing} = this.props
        const syncingText = syncing ? '同步中...': '准备就绪'
        return (
            <div style={Toolbar.styles.bar}>
                {syncingText}
            </div>
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