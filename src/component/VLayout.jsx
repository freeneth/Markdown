/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */

import { PureComponent } from 'react'
import { m } from '../style.js'
import PropTypes from 'prop-types'

export default class VLayout extends PureComponent {
    constructor(props) {
        super(props)
    }
    render() {
        const { styles, children } = this.props
        return (<div style={m(VLayout.styles, styles)}>
            {children}
        </div>)
    }
}

VLayout.styles = {
    display: 'flex',
    flexFlow: 'row nowrap',
    justifyContent: 'flex-start',
}

VLayout.propTypes = {
    style: PropTypes.object,
}
