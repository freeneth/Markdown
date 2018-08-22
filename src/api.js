import { initLAPI } from "@leither/l-api";

const api = initLAPI('http://localhost' + '/webapi/')//本地测试
//const api = initLAPI('http://192.168.1.187' + '/webapi/')//异地测试阿里云
//const api = initLAPI(location.origin + '/webapi/')//正式

const loginP = api.login('admin', '123456', 'byname');

export const G = {
    api,
    sidP: loginP.then(({sid}) => sid),
    userIdP: loginP.then(({ user: { id }}) => id)
};

window.G = G;
