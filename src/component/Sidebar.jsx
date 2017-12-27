/* eslint-disable no-unused-vars */
import React from 'react'
/* eslint-enable */
import { PureComponent } from 'react'

export default class Sidebar extends PureComponent {
    constructor(props){
        super(props)
        this.state = {
            hide: false,
        }
    }

    hide() {
        this.setState({ hidden: true })
    }

    show() {
        this.setState({ hidden: false })
    }

    render() {
        const show_button = <div style={Sidebar.styles.button} onClick={() => this.show()}> 展开 </div>
        const hide_button = <div style={Sidebar.styles.button} onClick={() => this.hide()}> 收起 </div>
        const button = this.state.hidden ? show_button : hide_button
        return (<div>
            {button}
            <div style={this.state.hidden ? Sidebar.styles.hide : Sidebar.styles} >
                {this.props.children}
            </div>
        </div>)
    }
}

Sidebar.styles = {
    height: '100%',
    maxWidth: '30em',
    button: {
        cursor: 'pointer',
        position: 'absolute',
        height: '2em',
    },
    hide: {
        display: 'none',
    },
}
