// NOTE: We use isomorphic-ws so that the client compiles for browsers aswell
import * as webSocket from 'isomorphic-ws';
import { Queue } from './queue';
import * as protocol from './messages';
import { EventEmitter } from 'events';
import { isNode } from './utils';
import * as is from './utils';

enum RequestMethod {
    Initialize = 'initialize',
    GetCompletions = 'getCompletions',
    FindReferences = 'findReferences',
    GetQuickInfo = 'getQuickInfo',
    GetCompletionEntryDetails = 'getCompletionEntryDetails',
    GetSignatureHelp = 'getSignatureHelp',
    GetDefinition = 'getDefinition',
    GetFormattingEdits = 'getFormattingEdits',
}

enum NotificationMethod {
    TextDocumentChanged = 'textDocumentChanged',
    TextDocumentDeleted = 'textDocumentDeleted',
    TextDocumentCreated = 'textDocumentCreated',
    TextDocumentOpened = 'textDocumentOpened',
    Terminate = 'terminate',
}

export enum ClientEvent {
    Connected = 'connected',
    Disconnected = 'disconnected',
    Reconnected = 'reconnected',
    Errd = 'errd',
    PublishDiagnostics = 'publishDiagnostics',
}

export interface ConnectResult {
    success: boolean;
    error?: any;
}

/**
 * Operates on one project at a time.
 */
export class LanguageClient {

    private _msgCounter = 1;
    private _socket: webSocket;
    private _projectId: string;
    private _eventEmitter: EventEmitter;
    private _cookie: string;
    private _responseQueue = new Queue<protocol.ResponseMessage, protocol.ResponseError | string>();
    private _projectInitialized = false;

    constructor() {
        this._eventEmitter = new EventEmitter();
    }

    /**
     * Send a notification to the server
     * @param method Takes a NotificationMethod
     * @param params The parameters to send
     */
    private async _notify(method: NotificationMethod, params: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const notification: protocol.NotificationMessage = {
                jsonrpc: "2.0",
                method,
                params,
            };
            const msg = JSON.stringify(notification);
            if (isNode) {
                this._socket.send(msg, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            } else {
                try {
                    (<unknown>this._socket as WebSocket).send(msg);
                    return resolve();
                } catch (error) {
                    return reject(error);
                }
            }
        });
    }

    /**
     * Send a request to the language-server
     * @param method What type of action the language-server should perform
     * @param params Associated parameters to the method
     * 
     */
    private async _execute<T>(method: RequestMethod, params: any): Promise<protocol.ResponseMessage<T>> {
        const promise = new Promise<protocol.ResponseMessage<T>>(async (resolve, reject) => {
            const id = this._msgCounter++;
            const request: protocol.RequestMessage = {
                jsonrpc: "2.0",
                id,
                method,
                params,
            };
            this._responseQueue.add(id, resolve, reject);
            const json = JSON.stringify(request);
            if (isNode) {
                this._socket.send(json, (err) => {
                    if (err) {
                        return this._responseQueue.reject(id, err.toString());
                    }
                });
            } else {
                try {
                    (<unknown>this._socket as WebSocket).send(json);
                } catch (error) {
                    return this._responseQueue.reject(id, error.toString());
                }
            }
        });

        return promise;
    }

    public on(event: ClientEvent.Connected, listener: () => void): void;
    public on(event: ClientEvent.Disconnected, listener: (event: { code: number, reason: string, wasClean: boolean }) => void): void;
    public on(event: ClientEvent.Reconnected, listener: () => void): void;
    public on(event: ClientEvent.Errd, listener: (error: protocol.ResponseError) => void): void;
    public on(event: ClientEvent.PublishDiagnostics, listener: (result: protocol.PublishDiagnosticsParams) => void): void;
    public on(event: string, listener: (...args) => void): void {
        this._eventEmitter.on(event, (...args) => listener(...args));
    }

    /**
     * @deprecated Used connect(projectId: string) instead
     * 
     */
    public setProjectId(projectId: string) {
        if (projectId.length < 1) {
            throw new Error("Invalid projectId");
        }
        this._projectId = projectId;
    }

    /**
     * Set the authorization cookie to be used to authenticate.
     * @param cookie The cookie to use
     */
    public setCookie(cookie: string) {
        this._cookie = cookie;
    }

    /**
     * Check if the client is connected to a server
     * 
     */
    public get isConnected(): boolean {
        //if (!this._socket) throw new Error('LanguageServerClient not initialized');
        return this._socket && this._socket.readyState === this._socket.OPEN;
    }


    /**
     * Return the id of the currently "loaded" project.
     * Undefined if no project has been loaded.
     */
    public get isProjectInitialized(): boolean {
        return this._projectId !== undefined;
    }

    /**
     * Check if the languageClient is connected and a project is initialized
     */
    public get isReady(): boolean {
        return this.isConnected && this.isProjectInitialized;
    }

    /**
     * Connect to a remote language-server
     * @param uri The websocket uri to connect to, eg 'wss://localhost:1339'
     */
    public async connect(uri: string, cookie?: string): Promise<ConnectResult> {
        const promise = new Promise<ConnectResult>((resolve, reject) => {
            // TODO: WebBrowsers do NOT support options
            const options: webSocket.ClientOptions = {
                headers: { 'Cookie': cookie || "" },
            };
            // Differentiate whether the client is running in node or the broweser.
            try {

                if (isNode) {
                    this._socket = new webSocket(uri, options);
                } else {
                    this._socket = new webSocket(uri);
                }
            } catch (error) {
                throw error;
            }

            this._socket.onmessage = (event: webSocket.MessageEvent) => {
                const message: protocol.ResponseMessage = JSON.parse(event.data.toString());
                const id = message.id as number;
                if (message.error) {
                    if (id && this._responseQueue.has(id)) {
                        return this._responseQueue.reject(id, message.error);
                    }
                }
                if (this._responseQueue.has(id)) {
                    return this._responseQueue.resolve(id, message);
                }

                // Handle notifications that we recieve from the server
                if (is.notification(message)) {
                    return this._eventEmitter.emit(message.method, message.params);
                }

                // TODO(Jorgen): Handle notifications and errors
                this._eventEmitter.emit(ClientEvent.Errd, message);
            };
            this._socket.onopen = (event: webSocket.OpenEvent) => {
                this._eventEmitter.emit(ClientEvent.Connected);
                resolve({ success: true });
            };
            this._socket.onclose = (event: webSocket.CloseEvent) => {
                this._eventEmitter.emit(ClientEvent.Disconnected, {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                });
                this._projectInitialized = false;
                // @ts-ignore
                this._projectId = undefined;
            };
            this._socket.onerror = (event: webSocket.ErrorEvent) => {
                resolve({ success: false, error: event });
            };
        });

        return promise;
    }

    /**
     * Close the underlying socket
     */
    public async close() {
        if (this.isConnected) {
            this._socket.close(1000, 'Purpose fulfilled');
        }
    }

    /**
     * Initialize the specificed project on the server.
     * @param projectId The projectId to initialize, automatically
     * uses this as the projectId for future calls
     */
    public async initialize(projectId?: string): Promise<protocol.ResponseMessage<protocol.InitializeResult>> {
        this._projectId = projectId || this._projectId;
        if (!this._projectId) {
            throw new Error(`Invalid ProjectId`);
        }
        if (!this.isConnected) {
            throw new Error('LanguageServerClient not connected');
        }
        const params: protocol.InitializeParams = { projectId: this._projectId };
        const result = await this._execute<protocol.InitializeResult>(RequestMethod.Initialize, params);
        this._projectInitialized = true;
        return result;
    }

    /**
     * Signal the server to un-initalize the project.
     * Any further calls to the project will result in a
     * Not-initialized-like response.
     * 
     * Also uninitializes the languageClient, requiering initialize to be run again.
     */
    public async terminate() {
        const params: protocol.TerminateParams = { projectId: this._projectId };
        // TODO: Find a better way then ts-ignore.....
        // @ts-ignore
        this._projectId = undefined;
        this._projectInitialized = false;
        return this._notify(NotificationMethod.Terminate, params);
    }

    /**
     * Notify the language-server about a file change
     * This will also update the file on the server
     * @param path Path to the file
     * @param content The file-content
     * 
     */
    public async textDocumentChanged(path: string, content: string): Promise<void> {
        const params: protocol.TextDocumentChangedParams = {
            projectId: this._projectId,
            content,
            path
        };
        return this._notify(NotificationMethod.TextDocumentChanged, params);
    }

    /**
     * Notify the server that a resource was deleted
     * @param path The path to the resouce that was deleted
     * 
     */
    public async textDocumentDeleted(path: string): Promise<void> {
        const params: protocol.TextDocumentDeletedParams = {
            projectId: this._projectId,
            path,
        };
        this._notify(NotificationMethod.TextDocumentDeleted, params);
    }

    /**
     * Notify the server that a file or directory has been created
     * @param path Path to the "File"
     * @param fileType Whether this is a file or directory
     * @param content The content if fileType is file
     * 
     */
    public async textDocumentCreated(path: string, fileType: protocol.FileType, content: string): Promise<void> {
        const params: protocol.TextDocumentCreatedParams = {
            projectId: this._projectId,
            content,
            path,
            fileType,
        };
        return this._notify(NotificationMethod.TextDocumentCreated, params);
    }

    /**
     * Notify the server about a file being opened, usually
     * resulting in the server sending a PublishDiagnostics notification
     * @param path Path
     */
    public async textDocumentOpened(path: string): Promise<void> {
        const params: protocol.TextDocumentOpenedParams = {
            projectId: this._projectId,
            path
        };
        return this._notify(NotificationMethod.TextDocumentOpened, params);
    }

    /**
     * Request a list of possible completions for
     * the specified line and character.
     * @param path Path to the file
     * @param line 0-based linenumber
     * @param character 0-based character index
     */
    public async getCompletions(
        path: string,
        line: number,
        character: number,
    ): Promise<protocol.ResponseMessage<protocol.GetCompletionsResult>> {
        const params: protocol.GetCompletionsParams = {
            projectId: this._projectId,
            path,
            line,
            character,
        };
        return this._execute<protocol.GetCompletionsResult>(RequestMethod.GetCompletions, params);
    }

    /**
     * Request a list of references for
     * the symbol specified at line and character.
     * @param path Path to the file
     * @param line 0-based linenumber
     * @param character 0-based character index
     */
    public async findReferences(
        path: string,
        line: number,
        character: number,
    ): Promise<protocol.ResponseMessage<protocol.FindReferencesResult>> {
        const params: protocol.GetCompletionsParams = {
            projectId: this._projectId,
            path,
            line,
            character,
        };
        return this._execute<protocol.FindReferencesResult>(RequestMethod.FindReferences, params);
    }

    /**
     * Request information at the specified
     * line and character.
     * @param path Path to the file
     * @param line 0-based linenumber
     * @param character 0-based character index
     */
    public async getQuickInfo(
        path: string,
        line: number,
        character: number,
    ): Promise<protocol.ResponseMessage<protocol.GetQuickInfoResult>> {
        const params: protocol.GetQuickInfoParams = {
            projectId: this._projectId,
            path,
            line,
            character,
        };
        return this._execute<protocol.GetQuickInfoResult>(RequestMethod.GetQuickInfo, params);
    }

    /**
     * Request signature information at the specified cursor location
     * @param path Path to the file
     * @param line 0-based line number
     * @param character 0-based character index
     */
    public async getSignatureHelp(
        path: string,
        line: number,
        character: number,
    ): Promise<protocol.ResponseMessage<protocol.GetSignatureHelpResult>> {
        const params: protocol.GetSignatureHelpParams = {
            projectId: this._projectId,
            line,
            character,
            path,
        };

        return this._execute<protocol.GetSignatureHelpResult>(
            RequestMethod.GetSignatureHelp,
            params
        );
    }

    public async getCompletionEntryDetails(
        path: string,
        line: number,
        symbol: string,
        character: number,
    ): Promise<protocol.ResponseMessage<protocol.GetCompletionEntryDetailsResult>> {
        const params: protocol.GetCompletionEntryDetailsParams = {
            projectId: this._projectId,
            path,
            line,
            symbol,
            character,
        };
        return this._execute<protocol.GetCompletionEntryDetailsResult>(
            RequestMethod.GetCompletionEntryDetails,
            params
        );
    }

    public async getDefinition(
        path: string,
        line: number,
        character: number,
    ): Promise<protocol.ResponseMessage<protocol.GetDefinitionResult>> {
        const params: protocol.GetDefinitionParams = {
            projectId: this._projectId,
            character,
            line,
            path,
        };

        return this._execute<protocol.GetDefinitionResult>(RequestMethod.GetDefinition, params);
    }

    public async getFormattingEdits(
        path: string,
        insertSpaces: boolean,
        tabSize: number,
    ): Promise<protocol.ResponseMessage<protocol.GetFormattingEditsResult>> {
        const params: protocol.GetFormattingEditsParams = {
            projectId: this._projectId,
            path,
            insertSpaces,
            tabSize
        };

        return this._execute<protocol.GetFormattingEditsResult>(RequestMethod.GetFormattingEdits, params);
    }

}
