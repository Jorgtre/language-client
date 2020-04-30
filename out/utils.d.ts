import * as protocol from './messages';
export declare const isBrowser: boolean;
export declare const isNode: boolean;
export declare function boolean(value: any): value is boolean;
export declare function string(value: any): value is string;
export declare function number(value: any): value is number;
export declare function ndefined(value: any): value is undefined;
export declare function notification(message: protocol.Message | undefined | any): message is protocol.NotificationMessage<any>;
