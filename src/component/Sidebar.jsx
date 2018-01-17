/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import PropTypes from 'prop-types'
import styled from 'styled-components'

/* eslint-disable no-unused-vars */
const DIV = styled.div`
    position: relative;
    height: 100%;
`

const BUTTON = styled.div`
    position: absolute;
    top: 0.65em;
    width: 1.1em;
    height: 2em;
    text-align: center;
    cursor: pointer;
    user-select: none;
    background-color: rgba(0, 160, 233, 0.7);
    color: #ffdcea;
    border-radius: 10px 0 0 10px;
`

const BUTTONO = styled(BUTTON)`
    border-radius: 0 10px 10px 0;
    left: 0;
`
const BUTTONC = styled(BUTTON)`
    border-radius: 10px 0 0 10px;
    right: 0;
`
/* eslint-enable */

export default class Sidebar extends React.PureComponent {
    constructor(props){
        super(props)
        this.state = {
            hide: false,
        }
        this.toggleHide = this.toggleHide.bind(this)
    }

    toggleHide() {
        this.setState((old)=>({hide: !old.hide}))
    }

    render() {
        const {children} = this.props
        const button = this.state.hide ? (
            <BUTTONO onClick={this.toggleHide}> {'»'} </BUTTONO>
        ) : (
            <BUTTONC onClick={this.toggleHide}> {'«'} </BUTTONC>
        )
        const content = this.state.hide ? null : (
            <div style={{
                minWidth: '30em',
                height: '100%',
            }}>
                {children}
            </div>
        )
        return <DIV {...this.props}
        >
            {button}
            {content}
        </DIV>
    }
}

Sidebar.propTypes = {
    children: PropTypes.object.isRequired,
}
