declare type Resolve<T> = (value: T | PromiseLike<T>) => void;
declare type Reject = (reason?: string) => void;
interface ResolveReject<T> {
    resolve: Resolve<T>;
    reject: Reject;
}
export declare class Queue<T> {
    queue: Map<number, ResolveReject<T>>;
    add(id: number, resolve: Resolve<T>, reject: Reject): void;
    has(id: number): boolean;
    resolve(id: number, value: T): void;
    reject(id: number, reason: string): void;
}
export {};
