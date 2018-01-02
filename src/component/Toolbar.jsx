/* eslint-disable no-unused-vars */
import React from 'react'
import ShareDialog from './ShareDialog.jsx'
import {NonSelectDiv, ClickableDiv} from '../style.js'
/* eslint-enable */
import { PureComponent } from 'react'
import Immutable from 'immutable'

const defaultShareDialog = Immutable.fromJS({
    title: '分享文档',
    display: false,
    fileid: '',
})
export default class Toolbar extends PureComponent {
    constructor(props) {
        super(props)
        this.state = {
            shareDialog: defaultShareDialog,
        }
    }

    showShareDialog(id) {
        this.setState((state) => ({ ...state, shareDialog: state.shareDialog.set('display', true).set('fileid', id) }))
    }

    hideShareDialog() {
        this.setState((state) => ({ ...state, shareDialog: state.shareDialog.set('display', false).set('fileid', '') }))
    }

    render() {
        const { syncing, fileid, fileShare, fileShareCmd, fileShareIOCmd, showEditor, toggle } = this.props
        const syncingText = syncing ? '同步中...' : '准备就绪'
        const toggleText = showEditor ? '预览' : '编辑'
        let shareDialog = null
        if (this.state.shareDialog.get('display')) {
            shareDialog = <ShareDialog
                title={this.state.shareDialog.get('title')}
                display={true}
                onClose={this.hideShareDialog.bind(this)}
                fileid={this.state.shareDialog.get('fileid')}
                fileShare={fileShare}
                fileShareCmd={fileShareCmd}
                fileShareIOCmd={fileShareIOCmd}
            ></ShareDialog>
        }
        return (
            <div>
                <div style={Toolbar.styles.bar}>
                    <NonSelectDiv>{syncingText}</NonSelectDiv>
                    <ClickableDiv onClick={toggle}>{toggleText}</ClickableDiv>
                    <ClickableDiv onClick={() => this.showShareDialog(fileid)}>分享</ClickableDiv>
                </div>
                {shareDialog}
            </div>
        )
    }
}

Toolbar.styles = {
    bar: {
        display: 'flex',
        flexFlow: 'row nowrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: 50,
        float: 'left',
        background: '#ffffff',
        borderBottom: '1px solid #ededed',
    },
}
