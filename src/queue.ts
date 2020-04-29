import { ResponseMessage } from "./messages";
import { resolve } from "path";

type Resolve<T> = (value: T | PromiseLike<T>) => void;
type Reject = (reason?: string) => void;

interface ResolveReject<T> {
    resolve: Resolve<T>;
    reject: Reject;
}

export class Queue<T> {

    public queue = new Map<number, ResolveReject<T>>();

    public add(id: number, resolve: Resolve<T>, reject: Reject) {
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

    public reject(id: number, reason: string) {
        const rr = this.queue.get(id);
        if (!rr) {
            return;
        }
        rr.reject(reason);
        this.queue.delete(id);
    }

}