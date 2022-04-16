export const never = (x: never): never => x
export const failwith = (message: string): never => { throw new Error(message) }
export const unreachable = (): never => { throw new Error() }
