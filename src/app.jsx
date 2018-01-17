import init from './main.jsx'
import { initShareCommonMark } from './main.jsx'

import { mock_saveFile, mock_saveFileList, mock_loadFile, mock_loadFileList, mock_setShare, mock_getShare, mock_loadShareFile, mock_getFileid } from './store.js'

const callbacks = {
    saveFile: mock_saveFile,
    saveFileList: mock_saveFileList,
    loadFile: mock_loadFile,
    loadFileList: mock_loadFileList,

    setShare: mock_setShare,
    getShare: mock_getShare,

    loadShareFile: mock_loadShareFile,
    getFileid: mock_getFileid,
}

init(document.getElementById('root'), callbacks)
