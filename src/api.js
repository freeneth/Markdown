import { initLAPI } from "@leither/l-api";
export const G = {api:null,ip:null};
G.api = initLAPI(location.origin+'/webapi/')//阿里云
window.G = G;