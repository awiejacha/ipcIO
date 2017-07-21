/**
 * @module ipcIO
 */

/**
 * @typedef {object} parsed_message
 * @property {string|null} id       Client id, that server is tagging handshake message with.
 * @property {string|null} command  Command description.
 * @property {string|null} data     Data carried by message.
 */

/**
 * @typedef {parsed_message[]} parsed_message_array
 */

/**
 * @typedef {object} iface
 * @property {Socket} socket  Instance of net.Socket
 * @property {Server} server  Instance of net.Server
 */

/**
 * @typedef {object} handler_container
 * @property {string} data        Message data
 * @property {string} client_name Friendly name of client/uuid if name not set.
 * @property {Socket} socket      Instance of net.Socket
 * @property {Server} server      Instance of net.Server
 */

/**
 * @typedef {object} handler_collection
 * @property {function} [command]
 */

/**
 * @typedef {object} server_constructor_options
 * @property {boolean}  verbose   When true, will feed console with current operations feedback.
 * @property {string}   domain    Namespace used for connection with all clients handshaking with this server.
 * @property {string}   encoding  Message buffer encoding, defaults to "utf8".
 */

const net = require("net");
const fs = require("fs");
const uuidV4 = require("uuid").v4;

const TMP_PATH = "/tmp/IPC.io";

const DOMAIN_DEFAULT = "default";

const COMMAND_HANDSHAKE = "handshake";
const COMMAND_ERROR = "error";

const bcast_registry = {};

function feedConsole(...args) {
  if (this.verbose) {
    console.log(...args);
  }
}

/**
 * Takes message from other party and returns as prepared message.
 * @param {Buffer|string} message
 * @returns {parsed_message_array}
 */
function parseMsg(message) {
  if (message instanceof Buffer) {
    message = message.toString("utf8");
  }

  if (typeof message !== "string") {
    throw new TypeError("Argument passed must be a buffer or string.");
  }

  // Wrap any message with square brackets.
  let parsed_message = `[${message.replace(/\r\n|\n|\r/gm, "").replace(/}{/gm, "},{")}]`;

  try {
    let parsed_json = JSON.parse(parsed_message);

    if (parsed_json.constructor === Array) {
      return parsed_json.map((entry) => {

        // Case of object. Null is falsey, so will be rejected if does not fulfill first part of condition.
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
      });
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

/**
 * Returns parsed_message depending how many arguments are passed to it.
 * @returns {parsed_message}
 */
function prepareMsg() {
  if (arguments.length === 0) {
    throw new Error("No arguments passed.");
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

  if (arguments.length >= 3) {
    return JSON.stringify({
      id: arguments[0].toString(),
      command: arguments[1].toString(),
      data: arguments[2].toString(),
    });
  }
}

/**
 * Always called with "this" bound to either IpcServer or IpcClient instance.
 * Checks if "this" has handler for command carried by passed message registered. If so, handler is called.
 * @param {string} uuid
 * @param {string} client_name
 * @param {iface} iface
 * @param {parsed_message} message
 */
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

/**
 * Always called with "this" bound to either IpcServer or IpcClient instance.
 * Adds command handler to handler collection.
 * @param {string} command    Command name.
 * @param {function} handler  Handler function.
 */
function addCommandHandler(command, handler) {
  if (typeof command !== "string") {
    throw new Error("Argument passed as \"command\" must be a string.");
  }

  if (typeof handler !== "function") {
    throw new Error("Argument passed as \"handler\" must be a function.");
  }

  if (command in this._command_handlers) {
    throw new Error(`Handler for command "${command}" already registered.`);
  }

  this._command_handlers[command] = handler;
}

/**
 * Adds handlers grouped in collection.
 * @param handler_collection
 */
function addHandlers(handler_collection) {
  if (typeof handler_collection !== "object" || handler_collection === null) {
    throw new Error("Argument passed as \"handler_collection\" must be an object.");
  }

  for (let command in handler_collection) {
    if (handler_collection.hasOwnProperty(command)) {
      if (typeof handler_collection[command] !== "function") {
        throw new Error("\"handler_collection\" entry values must be callable.");
      }

      addCommandHandler.call(this, command, handler_collection[command]);
    }
  }
}

/**
 * On "data" event handler for IpcServer and IpcClient unique socket.
 * Always called with "this" bound to either IpcServer or IpcClient instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name  Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes.
 * @param {iface} iface         Interface containing socket instance and server instance.
 * @param {Buffer} buffer       Data buffer received from remote party with "data" event.
 */
function $onUniqueData(uuid, client_name, iface, buffer) {

  feedConsole.call(this, `Unique received: ${buffer.toString()}`);

  let message_array = parseMsg(buffer);
  message_array.forEach((message) => {
    executeCommandHandlers.call(this, uuid, client_name, iface, message);
  }, this);
}

/**
 * On "connect" event handler for IpcServer broadcast socket creation callback.
 * Always called with "this" bound to IpcServer instance.
 * @param {Socket} bcastSocket
 */
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
    .on("close", $onServerBcastClose.bind(this, uuid))
    .on("error", $onServerBcastError.bind(this))
  ;
}

/**
 * On "data" event handler for IpcServer handshake/broadcast socket.
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {Socket} bcastSocket  Socket used by IpcServer as handshaking/broadcast channel.
 * @param {Buffer} buffer       Data buffer received from remote party with "data" event.
 */
function $onServerBcastData(uuid, bcastSocket, buffer) {
  let message_array = parseMsg(buffer);

  feedConsole.call(this, `${this._domain}: RECV ${JSON.stringify(message_array)}`);

  message_array.forEach((message) => {

    // Handshaking.
    if (message.command === COMMAND_HANDSHAKE) {
      let client_name = message.data;
      this._name_registry[client_name] = uuid;
      this._uuid_registry[uuid] = {};
      this._uuid_registry[uuid].server = net.createServer($onServerUniqueCreation.bind(this, uuid, client_name));
      this._uuid_registry[uuid].server.listen(`${this._bcast_path}.${uuid}`);

      feedConsole.call(this, `Client uuid server listening on ${this._bcast_path}.${uuid}`);
      feedConsole.call(this, `Sending channel uuid ${uuid} to client ${client_name}.`);

      bcastSocket.write(prepareMsg(client_name, COMMAND_HANDSHAKE, uuid), this._encoding);
    }
  }, this);
}

/**
 * On "close" event handler for IpcServer handshake/broadcast socket.
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 */
function $onServerBcastClose(uuid) {
  if (bcast_registry[this._domain][uuid] !== undefined) {
    delete bcast_registry[this._domain][uuid];
  }
}

/**
 * On "error" event handler for IpcServer handshake/broadcast socket.
 * @param error
 */
function $onServerBcastError(error) {
  // TODO: Handle this.
  feedConsole.call(this, error);
}

/**
 * On "connect" event handler for IpcServer unique socket creation callback.
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid                 Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name          Friendly name of client, if passed into client constructor,
 *                                      otherwise UUDv4/wo dashes.
 * @param {Socket} serverUniqueSocket   Socket used for 1 to 1 communication with each client.
 */
function $onServerUniqueCreation(uuid, client_name, serverUniqueSocket) {
  this._uuid_registry[uuid].socket = serverUniqueSocket;
  this._uuid_registry[uuid].socket._populated_handlers = {};
  this._uuid_registry[uuid].socket.writeCommand = function (command, data, callback) {
    return this.write(prepareMsg(command, data), callback);
  }.bind(this._uuid_registry[uuid].socket);

  // Close means "do not accept new sockets".
  // clientUniqueSocket is to be really unique.
  this._uuid_registry[uuid].server.close();

  serverUniqueSocket
    .on("data", $onUniqueData.bind(this, uuid, client_name, this._uuid_registry[uuid]))
    .on("close", $onServerUniqueClose.bind(this, uuid, client_name))
    .on("error", $onServerUniqueError.bind(this))
  ;
}

/**
 * On "close" event handler for IpcServer client communication socket.
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name  Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes.
 */
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

/**
 * On "error" event handler for IpcServer client communication socket.
 * @param error
 */
function $onServerUniqueError(error) {
  // TODO: Handle this.
  feedConsole.call(this, error);
}

/**
 * @classdesc Inter-Process-Communication Server
 * @alias module:ipcIO.Server
 */
class IpcServer {
  /**
   * Creates new instance of ipcIO Server.<br>
   * Each handler passed to handler_collection receives `handler_collection` as an argument.<br>
   * If no domain passed to options, domain named "default" is used.
   * @example
   * ```js
   * const exampleServer = new ipcio.Server({
   *     verbose: true,             // Determines if actions are reported to console,
   *     domain: "example_domain",  // domain name,
   *     encoding: "utf8",          // message encoding.
   *   },
   *    {
   *      example_request_command: (container) => { // {command: function(container)}
   *
   *        // @typedef {object} container
   *        // @property {string} data        Message data
   *        // @property {string} client_name Friendly name of client/uuid if name not set.
   *        // @property {Socket} socket      Instance of net.Socket
   *        // @property {Server} server      Instance of net.Server
   *
   *        // Do handler logic here.
   *      },
   *    })
   *    ;
   * ```
   * @constructor
   * @param {server_constructor_options} options    Determines operating properties and behavior.
   * @param {handler_collection} handler_collection Handlers to be registered at construction time.
   */
  constructor(options = {}, handler_collection = {}) {
    /**
     * When true, will feed the console.
     * @type {boolean}
     */
    this.verbose = options.verbose || false;

    /**
     * Registry of client friendly name <=> uuid pairs.
     * @type {object}
     * @private
     */
    this._name_registry = {};

    /**
     * Registry of interfaces (server and its sockets), keyed by client uuids.
     * @type {object}
     * @private
     */
    this._uuid_registry = {};

    /**
     * Message encoding.
     * @type {string}
     * @private
     */
    this._encoding = options.encoding || "utf8";

    /**
     * Server broadcast domain.
     * @type {string}
     * @private
     */
    this._domain = options.domain || DOMAIN_DEFAULT;

    /**
     * Path to unix socket file handler.
     * @type {string}
     * @private
     */
    this._bcast_path = `${TMP_PATH}.${this._domain}`;

    /**
     * Broadcast domain server, used for handshaking and message broadcasting.
     * @type {null|Server}
     * @private
     */
    this._bcastServer = null;

    /**
     * @type {boolean}
     * @private
     */
    this._is_started = false;

    /**
     * Collection of command handlers, passed to constructor or addHandler method.
     * @type {object}
     * @private
     */
    this._command_handlers = {};

    // If collection of handlers is passed as second argument, add it immediately.
    if (handler_collection) {
      this.addHandlers(handler_collection);
    }
  }

  /**
   * @returns {module:ipcIO.IpcServer}
   */
  start() {
    if (this._is_started) {
      throw new Error(`Tried to start IPC server for domain ${this._domain}, that has already started.`);
    }

    if (fs.existsSync(this._bcast_path)) {
      fs.unlinkSync(this._bcast_path);
    }

    this._bcastServer = net.createServer($onServerBcastCreation.bind(this));
    this._bcastServer.listen(this._bcast_path);

    feedConsole.call(this, `Broadcast server listening on ${this._bcast_path}`);

    this._is_started = true;

    return this;
  }

  /**
   * Adds handlers at any time, regardless client state.s
   * @param handler_collection
   * @returns {module:ipcIO.IpcServer}
   */
  addHandlers(handler_collection) {
    addHandlers.call(this, handler_collection);

    return this;
  }

  /**
   * Writes to client socket of given friendly name.
   * @param {string} client_name  Friendly name of client.
   * @param {string|null} command Command description.
   * @param {string|null} data    Data carried by message.
   * @returns {module:ipcIO.IpcServer}
   */
  emit(client_name, command, data) {
    if (
      client_name in this._name_registry && // We have such friendly name,
      typeof this._name_registry[client_name] === "string" && // really a name,
      this._name_registry[client_name] in this._uuid_registry && // which uuid exists in registry,
      this._uuid_registry[this._name_registry[client_name]].socket instanceof net.Socket && // being socket,
      this._uuid_registry[this._name_registry[client_name]].socket.writable // that is writable.
    ) {
      this._uuid_registry[this._name_registry[client_name]].socket.write(
        prepareMsg(command, data), this._encoding
      );
    }

    return this;
  }

  /**
   * Writes to all client sockets within server domain.
   * @param {string|null} command Command description.
   * @param {string|null} data    Data carried by message.
   * @returns {module:ipcIO.IpcServer}
   */
  broadcast(command, data) {
    for (let uuid in this._uuid_registry) {
      if (
        this._uuid_registry[uuid].socket instanceof net.Socket && // Every uuid having socket,
        this._uuid_registry[uuid].socket.writable // that is writable.
      ) {
        this._uuid_registry[uuid].socket.write(prepareMsg(command, data), this._encoding);
      }
    }

    return this;
  }
}

module.exports.Server = IpcServer;

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

/**
 * Checks if there is possibility to successfully write queue entry to socket.
 * If so, writes to socket and initialized writing next entry, when socket is able to respond with response.
 */
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

/**
 * Checks if there is possibility to successfully emit messages. If so, begins emitting process.
 */
function handleQueue() {
  if (this._is_connected && this._queue.length && !this._emptying_queue) {
    this._emptying_queue = true;
    sendQueueEntry.call(this);
  }
}

/**
 * On "finish", "close", "error" events handler for IpcClient communication sockets.
 * Always called with "this" bound to IpcClient instance.
 */
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

    feedConsole.call(this, "Attempting to reconnect");

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

/**
 * On "connect" event handler for IpcClient handshake/broadcast socket callback.
 * Always called with "this" bound to IpcClient instance.
 */
function $onClientBcastConnect() {

  feedConsole.call(this, `Connected to broadcast server ${this._bcast_path}`);

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

/**
 * On "connect" event handler for IpcClient unique socket callback.
 * Always called with "this" bound to IpcClient instance.
 */
function $onClientUniqueConnect() {

  // Client unique socket has just been hand-shaken therefore we have stopped connecting and are connected.
  this._is_connecting = false;
  this._is_connected = true;

  feedConsole.call(this, `Connected to unique server ${this._bcast_path}.${this._channel_id}`);

  handleQueue.call(this);

  this._uniqueSocket
    .on("data", $onUniqueData.bind(this, this._channel_id, this._client_name, {
      socket: this._uniqueSocket,
      server: this._uniqueSocket.server || null,
    }))
  ;
}

/**
 * @classdesc Inter-Process-Communication Client
 * @alias module:ipcIO.Client
 */
class IpcClient {
  /**
   * IpcClient constructor
   * @constructor
   * @param {object} options
   * @param {handler_collection} handler_collection
   */
  constructor(options = {}, handler_collection = {}) {
    /**
     * When true, will feed the console.
     * @type {boolean}
     */
    this.verbose = options.verbose || false;

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
     * @type {array}
     * @private
     */
    this._queue = [];

    /**
     * Socket used as basic communication layer between server and client, used for handshaking/broadcasting.
     * @type {Socket}
     * @private
     */
    this._bcastSocket = null;

    /**
     * Socket used for exclusive, 1 to 1 communication with server.
     * @type {Socket}
     * @private
     */
    this._uniqueSocket = null;

    /**
     * Collection of command handlers, passed to constructor or addHandler method.
     * @type {object}
     * @private
     */
    this._command_handlers = {};

    /**
     * Handler assigned each time client looses connection and tries to reconnect. Is nullified when connection is back.
     * @type {null|function}
     * @private
     */
    this._offlinePollingFn = null;

    /**
     * Message encoding.
     * @type {string}
     * @private
     */
    this._encoding = options.encoding || "utf8";

    // If collection of handlers is passed as second argument, add it immediately.
    if (handler_collection) {
      this.addHandlers(handler_collection);
    }
  }

  /**
   * Adds handlers at any time, regardless client state.s
   * @param handler_collection
   * @returns {module:ipcIO.IpcClient}
   */
  addHandlers(handler_collection) {
    addHandlers.call(this, handler_collection);

    return this;
  }

  /**
   * Connect client to the server.
   * @returns {module:ipcIO.IpcClient}
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

  /**
   * Puts command with data queue, calls queue handler.
   * Command is emitted immediately when there is connection established and previous entries become emitted.
   * @param {string|null} command Command description.
   * @param {string|null} data    Data carried by message.
   * @returns {module:ipcIO.IpcClient}
   */
  emit(command, data) {
    this._queue.push(prepareMsg(command, data));
    handleQueue.call(this);

    return this;
  }
}

module.exports.Client = IpcClient;
