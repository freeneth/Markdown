import { connect } from 'react-redux'
import { Action } from './store.js'
/* eslint-disable no-unused-vars */
import React from 'react'
import ShareCommonmark from './component/ShareCommonmark.jsx'
/* eslint-enable */

const mapStateToProps = (state) => {
    return {
        file: state.file,
    }
}

const mapDispatchToProps = (dispatch, ownProps) => {
    const { externalCmd: { loadShareFile, getFileid } } = ownProps

    return {
        loadShareFile,
        getFileid,
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ShareCommonmark);
