/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */

import { PureComponent } from 'react'
import { m } from '../style.js'
import PropTypes from 'prop-types'

/* 侧边面板，可收缩展开 */
export default class HLayout extends PureComponent {
    constructor(props) {
        super(props)
    }
    render() {
        const { styles, children } = this.props
        return (<div style={m(HLayout.styles, styles)}>
            {children}
        </div>)
    }
}

HLayout.styles = {
    display: 'flex',
    flexFlow: 'column nowrap',
    justifyContent: 'flex-start',
}

HLayout.propTypes = {
    style: PropTypes.object,
}
