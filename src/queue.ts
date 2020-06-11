import { ResponseMessage } from "./messages";
import { resolve } from "path";

type Resolve<T> = (value: T | PromiseLike<T>) => void;
type Reject<E> = (reason?: E | string) => void;

interface ResolveReject<T, E> {
    resolve: Resolve<T>;
    reject: Reject<E>;
}

export class Queue<T, E> {

    public queue = new Map<number | string, ResolveReject<T, E>>();

    public add(id: number | string, resolve: Resolve<T>, reject: Reject<E>) {
        this.queue.set(id, { resolve, reject });
    }

    public has(id: number | string): boolean {
        return this.queue.has(id);
    }

    public resolve(id: number | string, value: T) {
        const rr = this.queue.get(id);
        if (!rr) {
            return;
        }
        rr.resolve(value);
        this.queue.delete(id);
    }

    public reject(id: number | string, reason: E) {
        const rr = this.queue.get(id);
        if (!rr) {
            return;
        }
        rr.reject(reason);
        this.queue.delete(id);
    }

}