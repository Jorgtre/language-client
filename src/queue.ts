import { ResponseMessage } from "./messages";
import { resolve } from "path";

type Resolve<T> = (value: T | PromiseLike<T>) => void;
type Reject<E> = (reason?: E | string) => void;

interface ResolveReject<T, E> {
    resolve: Resolve<T>;
    reject: Reject<E>;
}

export class Queue<T, E> {

    public queue = new Map<number, ResolveReject<T, E>>();

    public add(id: number, resolve: Resolve<T>, reject: Reject<E>) {
        this.queue.set(id, { resolve, reject });
    }

    public has(id: number): boolean {
        return this.queue.has(id);
    }

    public resolve(id: number, value: T) {
        const rr = this.queue.get(id);
        if (!rr) {
            return;
        }
        rr.resolve(value);
        this.queue.delete(id);
    }

    public reject(id: number, reason: E) {
        const rr = this.queue.get(id);
        if (!rr) {
            return;
        }
        rr.reject(reason);
        this.queue.delete(id);
    }

}