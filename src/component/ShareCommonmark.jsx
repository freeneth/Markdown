/* eslint-disable no-unused-vars */
import React from 'react'
import CommonmarkRenderer from './CommonmarkRenderer.jsx'
/* eslint-enable */

export default class ShareCommonmark extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            markdown: '',
        }
    }

    componentDidMount() {
        this.props.loadShareFile().then(file=>{
            console.log(file)
            this.setState({markdown: file})
        })
    }

    render(){
        return (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <CommonmarkRenderer styles={{ height: '100%'}}
                    markdown={this.state.markdown}
                ></CommonmarkRenderer>
            </div>
        )
    }
}
