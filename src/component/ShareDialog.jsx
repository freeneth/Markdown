/* eslint-disable no-unused-vars */
import React from 'react'
import DocEventMask from './DocEventMask.jsx'
import ModalDialog from './ModalDialog.jsx'
/* eslint-enable */
import { m } from '../style.js'
import { PureComponent } from 'react'

export default class ShareDialog extends PureComponent {
    constructor() {
        super()
    }

    componentDidMount() {
        const { fileShareIOCmd, fileid } = this.props
        fileShareIOCmd.get(fileid)
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.fileid) {
            const list = nextProps.fileShare.shareidList
            if (list && list.length) {
                if (this.creating) {
                    this.props.fileShareIOCmd.set(this.creating)
                    this.creating = ''
                }
                return
            } else {
                if (!this.creating) {
                    if (!nextProps.fileShare.syncing) {
                        const shareid = this.props.fileShareCmd.create(nextProps.fileid)
                        this.creating = shareid
                    }
                }
            }
        }
    }

    switchShare(tag, shareid) {
        if (tag) {
            this.props.fileShareCmd.enable(shareid)
        } else {
            this.props.fileShareCmd.disable(shareid)
        }
        this.props.fileShareIOCmd.set(shareid)
    }

    copyInput() {
        this.input.select()
        document.execCommand('copy')
    }

    render() {
        const { display, title, onClose, fileShare } = this.props
        const url = window.location.host
        let enable = null
        let shareSwtch = null
        if (fileShare.shareidList[0]) {
            enable = fileShare.shareOptions[fileShare.shareidList[0]].enable
        }
        if (!fileShare.syncing) {
            if (enable) {
                shareSwtch = <div style={ShareDialog.styles.offButton} onClick={() => this.switchShare(false, fileShare.shareidList[0])}>关闭链接</div>
            } else {
                shareSwtch = <div style={ShareDialog.styles.onButton} onClick={() => this.switchShare(true, fileShare.shareidList[0])}>开启链接</div>
            }
        } else {
            shareSwtch = <div style={ShareDialog.styles.disableButton}>处理中...</div>
        }
        const shareUrl = fileShare.syncing ? '处理中...' : 'http://' + url + '/#!/share/editor/' + fileShare.shareidList[0]

        let inputdiv = (<div style={ShareDialog.styles.inputdiv} >
            <input type="text" style={m(ShareDialog.styles.input, ShareDialog.styles.disableStyle)} readOnly="readonly" autoComplete="off" value={shareUrl} />
            <div style={m(ShareDialog.styles.button, ShareDialog.styles.disableStyle)}>复制连接</div>
        </div >)

        if (enable) {
            inputdiv = (<div style={ShareDialog.styles.inputdiv} >
                <input ref={(input) => this.input = input} type="text" style={ShareDialog.styles.input} readOnly="readonly" autoComplete="off" value={shareUrl} />
                <div style={ShareDialog.styles.button} onClick={this.copyInput.bind(this)}>复制连接</div>
            </div >)
        }
        return (<DocEventMask
            events={{
                keydown: null,
                mousemove: null,
                mouseup: null,
                doubleclick: null,
                contextmenu: null,
            }}><ModalDialog
                display={display}
                title={title}
                onClose={onClose}
                modalStyles={{
                    backgroundColor: '#FFFFFF',
                    top: '36vh', bottom: '36vh',
                    left: '32vw', right: '32vw',
                }}
            >
                <div style={ShareDialog.styles.content}>
                    {inputdiv}
                    <div style={{ marginTop: '1em', alignSelf: 'flex-end' }}>
                        {shareSwtch}
                    </div>
                </div>
            </ModalDialog>
        </DocEventMask>)
    }

}
ShareDialog.styles = {
    content: {
        border: '1px solid #dddddd',
        borderRadius: 4,
        flexGrow: 1,
        boxShadow: '0 0 10px -2px #aeadad inset',
        display: 'flex',
        flexFlow: 'column nowrap',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 'auto 15px',
        padding: '0 3em',
    },
    inputdiv: {
        display: 'flex',
        flexFlow: 'row nowrap',
        alignItems: 'stretch',
        justifyContent: 'center',
        width: '100%',
        height: '2.5em',
        border: '1px solid #ddd',
        borderRadius: 4,
    },
    button: {
        padding: '0.5em',
        cursor: 'pointer',
        color: '#333',
    },
    offButton: {
        padding: '0.1em 0.9em',
        cursor: 'pointer',
        color: 'red',
        border: '1px solid #696969',
        borderRadius: 4,
        fontSize: 14,
    },
    onButton: {
        padding: '0.1em 0.9em',
        cursor: 'pointer',
        color: 'blue',
        border: '1px solid #696969',
        borderRadius: 4,
        fontSize: 14,
    },
    disableButton: {
        padding: '0.1em 0.9em',
        color: '#000',
        border: '1px solid #696969',
        borderRadius: 4,
        fontSize: 14,
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    disableStyle: {
        color: '#000',
        opacity: 0.5,
        cursor: 'not-allowed',
        userSelect: 'none',
    },
    input: {
        fontSize: 16,
        padding: '0 10px',
        width: 'calc(100% - 7em)',
        flexGrow: 1,
        borderRadius: 4,
        border: 0,
        backgroundColor: '#eee',
        borderRight: '1px solid #ddd',
        boxShadow: 'inset 0 1px 1px rgba(0,0,0,.075)',
        cursor: 'text',
    },
}

