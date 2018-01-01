import { PureComponent } from 'react'
import PropTypes from 'prop-types'

/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */

export default class DocEventMask extends PureComponent {
    constructor() {
        super()
        this.saved = {}
    }

    componentDidMount() {
        const { events } = this.props
        if (events) {
            Object.keys(events).forEach((key) => {
                this.saved[key] = document['on' + key]
                document['on' + key] = events[key]
            })
        }
    }

    componentWillUnmount() {
        Object.keys(this.saved).forEach((key) => {
            const handler = this.saved[key]
            if (handler) {
                document['on' + key] = handler
            }
        })
    }

    render() {
        return (this.props.children)
    }
}

DocEventMask.propTypes = {
    events: PropTypes.objectOf(PropTypes.func).isRequired,
}
