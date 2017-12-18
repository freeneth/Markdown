export function handleDefault(state) {
    return state
}

export function createReducers(handlerMap, initState, defaultHandler) {
    return (state=initState, action)=>{
        if (handlerMap.hasOwnProperty(action.type)) {
            return handlerMap[action.type](state, action)
        } else {
            if (defaultHandler){
                return defaultHandler(state, action)
            } else {
                return handleDefault(state, action)
            }
        }
    }
}
