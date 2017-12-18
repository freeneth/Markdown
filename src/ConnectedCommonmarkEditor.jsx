import { connect } from 'react-redux'
/* eslint-disable no-unused-vars */
import React from 'react'
import CommonmarkEditor from './component/CommonmarkEditor.jsx'
/* eslint-enable */

const mapStateToProps= (state)=>{
    return {
        file: state.file,
        fileList: state.fileList,
    }
}

export default connect(mapStateToProps)(CommonmarkEditor);
