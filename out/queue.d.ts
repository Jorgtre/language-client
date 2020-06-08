declare type Resolve<T> = (value: T | PromiseLike<T>) => void;
declare type Reject<E> = (reason?: E | string) => void;
interface ResolveReject<T, E> {
    resolve: Resolve<T>;
    reject: Reject<E>;
}
export declare class Queue<T, E> {
    queue: Map<number, ResolveReject<T, E>>;
    add(id: number, resolve: Resolve<T>, reject: Reject<E>): void;
    has(id: number): boolean;
    resolve(id: number, value: T): void;
    reject(id: number, reason: E): void;
}
export {};
