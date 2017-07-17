"use strict";

const net = require("net");
const fs = require("fs");
const uuidV4 = require("uuid").v4;

const TMP_PATH = "/tmp/IPC.io";

const DOMAIN_DEFAULT = "default";

const COMMAND_HANDSHAKE = "handshake";
const COMMAND_ERROR = "error";

const bcast_registry = {};

/**
 * @param {Buffer|string} message
 * @returns {object} parsed_message
 */
function parseMsg(message) {
    if (message instanceof Buffer) {
        message = message.toString("utf8");
    }

    if (typeof message !== "string") {
        throw new TypeError(`Argument passed must be a buffer or string.`);
    }

    // Wrap any message with square brackets.
    let parsed_message = `[${message.replace(/\r\n|\n|\r/gm, "").replace(/}{/gm, "},{")}]`;

    try {
        let parsed_json = JSON.parse(parsed_message);

        if (parsed_json.constructor === Array) {
            return parsed_json.map((entry) => {

                    // Rejects null and primitives.
                    if (entry && typeof entry === "object") {
                return {
                    id: entry.id || null,
                    command: entry.command || null,
                    data: entry.data || null,
                };
            }

            // Case of null and non-objects.
        else {
                return {
                    id: null,
                    command: null,
                    data: entry === null ? null : entry.toString(), // Let it be null or string, no other choice.
                };
            }
        })
        }
        else {
            return [{
                id: null,
                command: COMMAND_ERROR,
                data: "Message was not valid array.",
            }];
        }
    }
    catch (e) {
        return [{
            id: null,
            command: COMMAND_ERROR,
            data: "Message was not valid JSON.",
        }];
    }
}

function prepareMsg() {
    if (arguments.length === 0) {
        throw new Error(`No arguments passed.`);
    }

    if (arguments.length === 1) {
        return JSON.stringify({
            id: null,
            command: null,
            data: arguments[0].toString(),
        });
    }

    if (arguments.length === 2) {
        return JSON.stringify({
            id: null,
            command: arguments[0].toString(),
            data: arguments[1].toString(),
        });
    }

    if (arguments.length === 3) {
        return JSON.stringify({
            id: arguments[0].toString(),
            command: arguments[1].toString(),
            data: arguments[2].toString(),
        });
    }
}

function executeCommandHandlers(uuid, client_name, iface, message) {
    if (typeof message === "object" && message !== null && message.command !== null && message.command !== undefined) {
        if (this._command_handlers[message.command] !== undefined) {
            this._command_handlers[message.command].call(this, {
                data: message.data,
                uuid: uuid,
                name: client_name,
                socket: iface.socket || null,
                server: iface.server || null,
            });
        }
    }
}

function addCommandHandler(command, handler) {
    if (typeof command !== "string") {
        throw new Error(`Argument passed as "command" must be a string.`);
    }

    if (typeof handler !== "function") {
        throw new Error(`Argument passed as "handler" must be a function.`);
    }

    if (command in this._command_handlers) {
        throw new Error(`Handler for command "${command}" already registered.`);
    }

    this._command_handlers[command] = handler;
}

function addHandlers(handler_collection) {
    if (typeof handler_collection !== "object" || handler_collection === null) {
        throw new Error(`Argument passed as "handler_collection" must be an object.`);
    }

    for (let command in handler_collection) {
        if (handler_collection.hasOwnProperty(command)) {
            if (typeof command !== "string") {
                throw new Error(`"handler_collection" entries must be keyed by strings.`);
            }

            if (typeof handler_collection[command] !== "function") {
                throw new Error(`"handler_collection" entry values must be callable.`);
            }

            addCommandHandler.call(this, command, handler_collection[command]);
        }
    }
}

function $onUniqueData(uuid, client_name, entry, buffer) {

    console.log(`Unique received: ${buffer.toString()}`);

    let message_array = parseMsg(buffer);
    message_array.forEach((message) => {
        executeCommandHandlers.call(this, uuid, client_name, entry, message);
}, this);
}

function $onServerBcastCreation(bcastSocket) {

    // Give each client unique id. Id will also be used to establish private communication channel.
    let uuid = uuidV4().replace(/-/g, "");

    // Assign clientBcastSocket to broadcast sockets registry.
    if (bcast_registry[this._domain] === undefined) {
        bcast_registry[this._domain] = {};
    }
    bcast_registry[this._domain][uuid] = bcastSocket;

    bcastSocket
        .on("data", $onServerBcastData.bind(this, uuid, bcastSocket))
        .on("close", () => {
        if (bcast_registry[this._domain][uuid] !== undefined) {
        delete bcast_registry[this._domain][uuid];
    }
})
.on("error", (error) => {
        //TODO: Handle this.
        console.log(error);
})
    ;
}

function $onServerBcastData(uuid, bcastSocket, buffer) {
    let message_array = parseMsg(buffer);

    console.log(`${this._domain}: RECV ${JSON.stringify(message_array)}`);

    message_array.forEach((message) => {
        if (message.command === COMMAND_HANDSHAKE) {
        let client_name = message.data;
        this._name_registry[client_name] = uuid;
        this._uuid_registry[uuid] = {};
        this._uuid_registry[uuid].server = net.createServer($onServerUniqueCreation.bind(this, uuid, client_name));
        this._uuid_registry[uuid].server.listen(`${this._bcast_path}.${uuid}`);

        console.log(`Client uuid server listening on ${this._bcast_path}.${uuid}`);
        console.log(`Sending channel uuid ${uuid} to client ${client_name}.`);

        bcastSocket.write(prepareMsg(client_name, COMMAND_HANDSHAKE, uuid), this._encoding);
    }
}, this);
}

function $onServerUniqueCreation(uuid, client_name, serverUniqueSocket) {
    this._uuid_registry[uuid].socket = serverUniqueSocket;
    this._uuid_registry[uuid].socket._populated_handlers = {};

    // Do not accept new sockets.
    // clientUniqueSocket is to be really unique.
    this._uuid_registry[uuid].server.close();
    serverUniqueSocket
        .on("close", $onServerUniqueClose.bind(this, uuid, client_name))
        .on("data", $onUniqueData.bind(this, uuid, client_name, this._uuid_registry[uuid]))
    ;
}

function $onServerUniqueClose(uuid, client_name) {
    if (this._name_registry[client_name] !== undefined) {
        delete this._name_registry[client_name];
    }

    if (this._uuid_registry[uuid].server !== undefined) {
        delete this._uuid_registry[uuid].server;
    }

    if (this._uuid_registry[uuid].socket !== undefined) {
        delete this._uuid_registry[uuid].socket;
    }
}

class IpcServer {
    constructor(options = {}, handlers_collection = {}) {
        this._name_registry = {};
        this._uuid_registry = {};
        this._encoding = options.encoding || "utf8";
        this._domain = options.domain || DOMAIN_DEFAULT;
        this._bcast_path = `${TMP_PATH}.${this._domain}`;
        this._bcastServer = null;
        this._is_connected = false;
        this._command_handlers = {};

        if (handlers_collection) {
            this.addHandlers(handlers_collection);
        }
    }

    /**
     * @returns {IpcServer}
     */
    start() {
        if (this._is_connected) {
            throw new Error(`Tried to start IPC server for domain ${this._domain}, that has already started.`);
        }

        if (fs.existsSync(this._bcast_path)) {
            fs.unlinkSync(this._bcast_path);
        }

        this._bcastServer = net.createServer($onServerBcastCreation.bind(this));
        this._bcastServer.listen(this._bcast_path);

        console.log(`Broadcast server listening on ${this._bcast_path}`);

        return this;
    }

    addHandlers(handler_collection) {
        addHandlers.call(this, handler_collection);

        return this;
    }
}

/**
 * Spawns socket and returns it with already assigned offline behavior related handler.
 * @returns {Socket}
 */
function spawnClientSocket() {
    let socket = new net.Socket();
    socket
        .on("error", $onClientOffline.bind(this))
        .on("finish", $onClientOffline.bind(this))
        .on("close", $onClientOffline.bind(this))
    ;

    return socket;
}

function handleQueue() {
    if (this._is_connected && this._queue.length && !this._emptying_queue) {
        this._emptying_queue = true;
        sendQueueEntry.call(this)
    }
}

function sendQueueEntry() {
    if (this._is_connected && this._queue.length) {
        this._uniqueSocket.write(this._queue[0], this._encoding, () => {

            // Get rid of sent message only if write was successful.
            this._queue.shift();

        if (!this._queue.length) {
            this._emptying_queue = false;
        }
        else {
            sendQueueEntry.call(this);
        }
    });
    }
    else {
        this._emptying_queue = false;
    }
}

function $onClientBcastConnect() {
    console.log(`Connected to broadcast server ${this._bcast_path}`);

    // Server has connected us, so If any timeout with reconnect handler is still set, clear it.
    if (this._offlinePollingFn !== null) {
        clearTimeout(this._offlinePollingFn);
        this._offlinePollingFn = null;
    }

    this._bcastSocket
        .on("data", (buffer) => {
        let message_array = parseMsg(buffer);
    message_array.forEach((message) => {
        if (message.command === COMMAND_HANDSHAKE && message.id === this._client_name) {
        this._channel_id = message.data;
        this._uniqueSocket = spawnClientSocket.call(this);
        this._uniqueSocket
            .connect(`${this._bcast_path}.${this._channel_id}`, $onClientUniqueConnect.bind(this));
    }
}, this);
})
    ;

    this._bcastSocket.write(prepareMsg(COMMAND_HANDSHAKE, this._client_name), this._encoding);
}

function $onClientOffline() {

    // We are offline, so we are not connected.
    // We will attempt to connect after timeout, assigned few lines below, so not connecting yet.
    this._is_connected = false;
    this._is_connecting = true;

    // If any timeout with reconnect handler was already set, clear it.
    if (this._offlinePollingFn !== null) {
        clearTimeout(this._offlinePollingFn);
        this._offlinePollingFn = null;
    }

    // Destroy any remaining connectivity with server, we need to conduct new handshake.
    // Since we can not bet whether broadcast or unique server $onClientOffline we are called in,
    // there is no place to guess, which connection (broadcast or unique) is in what condition.
    // Burn it to the ground and set everything up from scratch.
    this._channel_id = null;

    if (this._uniqueSocket !== undefined && this._uniqueSocket !== null) {
        this._uniqueSocket.destroy();
        delete this._uniqueSocket;
        this._uniqueSocket = null;
    }

    if (this._bcastSocket !== undefined && this._bcastSocket !== null) {
        this._bcastSocket.destroy();
        delete this._uniqueSocket;
        this._bcastSocket = null;
    }

    // Assign reconnect handler with timeout.
    this._offlinePollingFn = setTimeout(() => {

            console.log(`Attempting to reconnect`);

    // Now we may claim that we are trying to connect.
    this._is_connecting = true;

    // spawnClientSocket produces socket already handling "finish", "close" and "error"
    // events using $onClientOffline handler.
    // That means that if socket will fail to connect or fail to operate,
    // we will return eventually here.
    this._bcastSocket = spawnClientSocket.call(this);
    this._bcastSocket.connect(this._bcast_path, $onClientBcastConnect.bind(this));
}, 2000);
}

function $onClientUniqueConnect() {

    // Client unique socket has just been hand-shaken therefore we have stopped connecting and are connected.
    this._is_connecting = false;
    this._is_connected = true;

    console.log(`Connected to unique server ${this._bcast_path}.${this._channel_id}`);

    handleQueue.call(this);

    this._uniqueSocket
        .on("data", $onUniqueData.bind(this, this._channel_id, this._client_name, this._uniqueSocket))
    ;
}

class IpcClient {
    constructor(options = {}, handlers_collection = {}) {
        /**
         * Broadcast domain.
         * @type {string}
         * @private
         */
        this._domain = options.domain || DOMAIN_DEFAULT;

        /**
         * Broadcast unix socket file path.
         * @type {string}
         * @private
         */
        this._bcast_path = `${TMP_PATH}.${this._domain}`;

        /**
         * UUID obtained from server after successful handshake.
         * @type {null|string}
         * @private
         */
        this._channel_id = null;

        /**
         * Pass human friendly name with constructor options.name
         * if willing to emit messages explicitly to this client from server.
         * Name has to be unique for each client connected to single server.
         * @type {string}
         * @private
         */
        this._client_name = options.name || uuidV4().replace(/-/g, "");

        /**
         * Set to true every time connection process starts.
         * Set to false every time connection is finished, broken or errored.
         * @type {boolean}
         * @private
         */
        this._is_connecting = false;

        /**
         * Set to true every time connection process ended resulting in establishing unique socket.
         * @type {boolean}
         * @private
         */
        this._is_connected = false;

        /**
         * Semaphore that is used to indicate that queue is being emptied.
         * @type {boolean}
         * @private
         */
        this._emptying_queue = false;

        /**
         * Queue of messages.
         * @type {Array}
         * @private
         */
        this._queue = [];

        /**
         * @type {Socket}
         * @private
         */
        this._bcastSocket = undefined;

        /**
         * @type {Socket}
         * @private
         s         */
        this._uniqueSocket = null;

        /**
         * @type {object}
         * @private
         */
        this._command_handlers = {};

        this._offlinePollingFn = null;

        this._encoding = options.encoding || "utf8";

        if (handlers_collection) {
            this.addHandlers(handlers_collection);
        }
    }

    /**
     * Connect client to the server.
     * @returns {IpcClient}
     */
    connect() {
        if (this._is_connecting || this._is_connected) {
            throw new Error(`Tried to connect to IPC server for domain ${this._domain}, when already connected/ing.`);
        }
        this._is_connecting = true;
        this._bcastSocket = spawnClientSocket.call(this);
        this._bcastSocket.connect(this._bcast_path, $onClientBcastConnect.bind(this));

        return this;
    }

    addHandlers(handler_collection) {
        addHandlers.call(this, handler_collection);

        return this;
    }

    emit(command, data) {
        this._queue.push(prepareMsg(command, data));
        handleQueue.call(this);
    }
}

module.exports = {
    Server: IpcServer,
    Client: IpcClient,
};
