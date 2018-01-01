export default class Random {
    static string(length = 10) {
        let s = ''
        for (let i = 0; i < length; i++) {
            s += Number(Math.floor(Math.random() * 32)).toString(32)
        }
        return s
    }
}