import { initLAPI } from "@leither/l-api";

//const api = initLAPI('http://localhost' + '/webapi/')//本地测试
//const api = initLAPI('http://192.168.1.187' + '/webapi/')//异地测试阿里云
const api = initLAPI(location.origin + '/webapi/')//正式

export const G = {
    api,
    sid:localStorage.getItem('APP_SID'),
    userId:localStorage.getItem('APP_UID')
};

window.G = G;
