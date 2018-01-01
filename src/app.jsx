import init from './main.jsx'
import 'draft-js/dist/Draft.css'

import { mock_saveFile, mock_saveFileList, mock_loadFile, mock_loadFileList, mock_setShare, mock_getShare } from './store.js'

const callbacks = {
    saveFile: mock_saveFile,
    saveFileList: mock_saveFileList,
    loadFile: mock_loadFile,
    loadFileList: mock_loadFileList,

    setShare: mock_setShare,
    getShare: mock_getShare,
}

init(document.getElementById('root'), callbacks)
