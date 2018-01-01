import { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { m } from '../style.js'
/* eslint-disable no-unused-vars */
import React from 'react'
import ReactModal2 from 'react-modal2'
/* eslint-enable */

export default class ModalDialog extends PureComponent {
    constructor() {
        super()
        this.saved = {}
    }

    render() {
        const {
            children,
            display,
            title,
            onOk,
            onClose,
            modalClassName,
            backdropClassName,
            modalStyles,
            backdropStyles,
        } = this.props
        if (display) {
            let footer
            if (onOk) {
                footer = (<div style={ModalDialog.styles.footer} >
                    <button style={ModalDialog.styles.footer.button} onClick={onOk}>确定</button>
                    <button style={ModalDialog.styles.footer.button} onClick={onClose}>关闭</button>
                </div>)
            } else {
                footer = (<div style={ModalDialog.styles.footer} >
                    <button style={ModalDialog.styles.footer.button} onClick={onClose}>关闭</button>
                </div>)
            }
            return (<ReactModal2
                onClose={onClose}
                style={ModalDialog.styles.modal}
                modalClassName={modalClassName}
                backdropClassName={backdropClassName}
                modalStyles={m(ModalDialog.styles.modal, modalStyles)}
                backdropStyles={m(ModalDialog.styles.backdrop, backdropStyles)}
            >
                <div style={ModalDialog.styles.header}>
                    <h2 style={ModalDialog.styles.header.h2}>{title}</h2>
                </div>
                <div style={ModalDialog.styles.body}>
                    {children}
                </div>
                {footer}
            </ReactModal2>)
        } else {
            return null
        }
    }
}

ModalDialog.styles = {
    modal: {
        position: 'fixed',
        display: 'flex',
        flexFlow: 'column nowrap',
        justifyContent: 'center',
        top: '25vh',
        bottom: '25vh',
        left: '30vw',
        right: '30vw',
        border: 1,
        boxShadow: '1px 1px 7px 2px rgba(0, 0, 0, 0.2)',
        borderRadius: 8,
        outline: 'none',
        zIndex: 10000,
    },
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 9999,
    },
    header: {
        position: 'static',
        margin: 5,
        height: '3.5em',
        h2: {
            fontSize: 26,
            padding: '5px 1em',
            margin: 5,
        },
    },
    body: {
        flexGrow: 8,
        display: 'flex',
        flexFlow: 'column nowrap',
        justifyContent: 'center',
        position: 'static',
        margin: 5,
    },
    footer: {
        display: 'flex',
        flexFlow: 'row nowrap',
        justifyContent: 'flex-end',
        position: 'static',
        margin: 5,
        button: {
            fontSize: 16,
            margin: '5px 10px',
            padding: '0.5em 1em',
            borderRadius: 5,
        },
    },
}

ModalDialog.propTypes = {
    display: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onOk: PropTypes.func,
    modalClassName: PropTypes.string,
    backdropClassName: PropTypes.string,
    modalStyles: PropTypes.object,
    backdropStyles: PropTypes.object,
}
