// 仅存储程序员模拟器档案。旧版档案保留原样，不执行原版迁移。
export async function get(key: string) {
    return localStorage.getItem(key)
}
export async function set(key: string, value: string) {
    localStorage.setItem(key, value)
    return true
}
