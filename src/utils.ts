import * as protocol from './messages';

//@ts-ignore
export const isBrowser = typeof window !== 'undefined' && window.document !== 'undefined';
export const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

export function boolean(value: any): value is boolean {
    return value === true || value === false;
}

export function string(value: any): value is string {
    return typeof value === 'string' || value instanceof String;
}

export function number(value: any): value is number {
    return typeof value === 'number' || value instanceof Number;
}

export function ndefined(value: any): value is undefined {
    return value === undefined;
}

export function notification(message: protocol.Message | undefined | any): message is protocol.NotificationMessage<any> {
    const candidate = <protocol.NotificationMessage & { id?: number }>message;
    return !!(candidate && candidate.method && ndefined(candidate.id));
}
