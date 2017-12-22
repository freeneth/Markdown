/* eslint-disable no-unused-vars */
import React from 'react'
import CommonmarkRenderer from './CommonmarkRenderer.jsx'
/* eslint-enable */

export default class ShareCommonmark extends React.Component {
    constructor(props) {
        super(props)
    }

    render(){
        return (
            <div>
                <CommonmarkRenderer markdown=''></CommonmarkRenderer>
            </div>
        )
    }
}