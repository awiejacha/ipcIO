/**
 * @module ipcIO
 */

/**
 * Object being parsed representation of message.
 * @typedef {object} parsed_message
 * @property {string|null} id       Client id, that server is tagging handshake message with.
 * @property {string|null} command  Command description.
 * @property {string|null} data     Data carried by message.
 * @property {string|null} delivery Delivery id
 */

/**
 * Array of parsed messages
 * @typedef {parsed_message[]} parsed_message_array
 */

/**
 * Interface exposing connectivity to client/server handlers.
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
 * Object containing options that determine behavior of IpcIO.Server
 * @typedef {object} server_constructor_options
 * @property {boolean}  verbose   When true, will feed console with current operations feedback.
 * @property {string}   domain    Namespace used for connection with all clients handshaking with this server.
 * @property {string}   encoding  Message buffer encoding, defaults to "utf8".
 */

/**
 * Object containing options that determine behavior of IpcIO.Client
 * @typedef {object} client_constructor_options
 * @property {boolean}  verbose   When true, will feed console with current operations feedback.
 * @property {string}   name      Client friendly name, can be used to address client when emitting from server..
 * @property {string}   domain    Namespace used for connection with all clients handshaking with this server.
 * @property {string}   encoding  Message buffer encoding, defaults to "utf8".
 */

const net = require("net");
const fs = require("fs");
const uuidV4 = require("uuid").v4;

const TMP_PATH = "/tmp/IPC.io";

const DOMAIN_DEFAULT = "default";

const COMMAND_HANDSHAKE = "handshake";
const COMMAND_DISCOVER = "discover";
const COMMAND_BROADCAST = "broadcast";
const COMMAND_EMIT = "emit";
const COMMAND_DELIVER = "delivery";
const COMMAND_ERROR = "error";

const E_MESSAGE_NOT_JSON = 101;
const E_MESSAGE_NOT_ARRAY = 102;

const E_CLIENT_NAME_TAKEN = 201;

const bcast_registry = {};

/**
 * @param line
 * @returns {string|boolean|number}
 */
function formatConsoleOutput(line) {
  if (line instanceof Buffer) {
    line = line.toString();
  }

  return (
    typeof line !== "string" &&
    typeof line !== "boolean" &&
    typeof line !== "number" &&
    line !== null &&
    line !== undefined
  ) ? JSON.stringify(line, null, "  ") : line;
}

/**
 * @param args
 * @ignore
 */
function feedConsole(...args) {
  if (this.verbose) {
    args.forEach((line) => {
      console.log(`\x1b[36m${formatConsoleOutput(line)}\x1b[0m`); // Cyan
    });
  }
}

/**
 * @param args
 * @ignore
 */
function feedConsoleError(...args) {
  if (this.verbose) {
    args.forEach((line) => {
      console.log(`\x1b[1m\x1b[31m${formatConsoleOutput(line)}\x1b[0m`); // Bright red
    });
  }
}

/**
 * @param args
 * @ignore
 */
function feedConsoleLines(...args) {
  if (this.verbose) {
    args.forEach((line, idx) => {
      if (idx === 0) {
        console.log(`\x1b[1m${formatConsoleOutput(line)}\x1b[0m`); // 1st line is highlighted.
      }
      else if (idx === 1) {
        console.log(`\x1b[33m${formatConsoleOutput(line)}\x1b[0m`); // 2nd is regular yellow.
      }
      else {
        console.log(`\x1b[2m${formatConsoleOutput(line)}\x1b[0m`); // Rest is dimmed white.
      }
    });
  }
}

/**
 * Takes message from other party and returns as prepared message.
 * @param {Buffer|string} message   Raw message retrieved from socket.
 * @returns {parsed_message_array}  Array o messages, ready to be processed.
 * @ignore
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
            delivery: entry.delivery || null,
          };
        }

        // Case of null and non-objects.
        else {
          return {
            id: null,
            command: null,
            data: entry,
            delivery: null,
          };
        }
      });
    }
    else {
      return [{
        id: null,
        command: COMMAND_ERROR,
        data: E_MESSAGE_NOT_ARRAY,
        delivery: null,
      }];
    }
  }
  catch (e) {
    return [{
      id: null,
      command: COMMAND_ERROR,
      data: E_MESSAGE_NOT_JSON,
      delivery: null,
    }];
  }
}

/**
 * Returns parsed_message depending how many arguments are passed to it.
 * @returns {parsed_message} Message prepared to be sent.
 * @ignore
 */
function prepareMsg() {
  if (arguments.length === 0) {
    throw new Error("No arguments passed.");
  }
  else if (arguments.length === 1) {
    return JSON.stringify({
      id: null,
      command: null,
      data: arguments[0],
      delivery: null,
    });
  }
  else if (arguments.length === 2) {
    return JSON.stringify({
      id: null,
      command: (arguments[0] === null || arguments[0] === undefined) ? null : arguments[0].toString(),
      data: arguments[1],
      delivery: null,
    });
  }
  else if (arguments.length === 3) {
    return JSON.stringify({
      id: (arguments[0] === null || arguments[0] === undefined) ? null : arguments[0].toString(),
      command: (arguments[1] === null || arguments[1] === undefined) ? null : arguments[1].toString(),
      data: arguments[2],
      delivery: null,
    });
  }
  else {
    return JSON.stringify({
      id: (arguments[0] === null || arguments[0] === undefined) ? null : arguments[0].toString(),
      command: (arguments[1] === null || arguments[1] === undefined) ? null : arguments[1].toString(),
      data: arguments[2],
      delivery: arguments[3],
    });
  }
}

/**
 * Always called with "this" bound to either IpcServer or IpcClient instance.<br>
 * Checks if "this" has handler for command carried by passed message registered. If so, handler is called.
 * @param {string} uuid             Unique id of socket
 * @param {string} client_name      Friendly client name
 * @param {iface} iface             Communication interface exposed to handler.
 * @param {parsed_message} message  Message to be processed by handler
 * @returns {null|*}                When there is delivery id and return value is defined, value will be sent back.
 * @ignore
 */
function executeCommandHandlers(uuid, client_name, iface, message) {

  feedConsoleLines.call(this, "HANDLER EXEC", `socket: ${uuid}, client: ${client_name}`, message);

  let ret = null;

  if (typeof message === "object" && message !== null && message.command !== null && message.command !== undefined) {
    if (this._command_handlers[message.command] !== undefined) {
      ret = this._command_handlers[message.command].call(this, {
        data: message.data,
        uuid: uuid,
        name: client_name,
        socket: iface.socket || null,
        server: iface.server || null,
      });
    }
  }

  return ret === undefined ? null : ret;
}

/**
 * Always called with "this" bound to either IpcServer or IpcClient instance.<br>
 * Adds command handler to handler collection.
 * @param {string} command    Command name
 * @param {function} handler  Handler function
 * @ignore
 */
function addCommandHandler(command, handler) {

  feedConsoleLines.call(this, "HANDLER ADD", `command: ${command}`);

  if (typeof command !== "string") {
    throw new Error("Argument passed as \"command\" must be a string.");
  }

  if (
    [
      COMMAND_HANDSHAKE,
      COMMAND_DISCOVER,
      COMMAND_BROADCAST,
      COMMAND_EMIT,
      COMMAND_DELIVER,
      COMMAND_ERROR,
    ].indexOf(command) > -1
  ) {
    throw new Error("Argument passed as \"command\" is restricted command name.");
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
 * @param {handler_collection} handler_collection Handlers to be registered.
 * @ignore
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
 * On "connect" event handler for IpcServer broadcast socket creation callback.<br>
 * Always called with "this" bound to IpcServer instance.
 * @param {Socket} bcastSocket
 * @ignore
 */
function $onServerBcastCreation(bcastSocket) {

  // Give each client unique id. Id will also be used to establish private communication channel.
  let uuid = uuidV4().replace(/-/g, "");

  feedConsoleLines.call(this, "SRV BCAST CREATE", `uuid: ${uuid}`);

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
 * On "data" event handler for IpcServer handshake/broadcast socket.<br>
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {Socket} bcastSocket  Socket used by IpcServer as handshaking/broadcast channel.
 * @param {Buffer} buffer       Data buffer received from remote party with "data" event.
 * @ignore
 */
function $onServerBcastData(uuid, bcastSocket, buffer) {

  feedConsoleLines.call(this, "SRV BCAST DATA", `socket: ${uuid}`, buffer);

  let message_array = parseMsg(buffer); // TODO: Handle possible error message.

  message_array.forEach((message) => {
    let client_name = null;

    switch (message.command) {

      // Handshaking.
      case COMMAND_HANDSHAKE:
        client_name = message.data;

        if (this._name_registry[client_name]) {

          feedConsoleError.call(this, `Sending error response, client name ${client_name} is already taken.`);

          bcastSocket.write(prepareMsg(client_name, COMMAND_ERROR, E_CLIENT_NAME_TAKEN), this._encoding);

          break;
        }

        this._name_registry[client_name] = uuid;
        this._uuid_registry[uuid] = {};
        this._uuid_registry[uuid].name = client_name;
        this._uuid_registry[uuid].server = net.createServer($onServerUniqueCreation.bind(this, uuid, client_name));
        this._uuid_registry[uuid].server.listen(`${this._bcast_path}.${uuid}`);

        feedConsoleLines.call(this, "CLI UNIQUE LISTEN", `path: ${this._bcast_path}.${uuid}`);
        feedConsole.call(this, `Sending channel uuid ${uuid} to client ${client_name}.`);

        bcastSocket.write(prepareMsg(client_name, COMMAND_HANDSHAKE, uuid), this._encoding);

        break;

      case COMMAND_DISCOVER:
        client_name = message.id;

        let discover_data = {
          clients: Object.keys(this._name_registry),
          command_handlers: Object.keys(this._command_handlers),
        };

        feedConsole.call(this, `Sending discover response ${discover_data}, to client ${client_name}.`);

        bcastSocket.write(prepareMsg(client_name, COMMAND_DISCOVER, discover_data), this._encoding);

        break;

      case COMMAND_BROADCAST:
        let message_to_be_bcasted = parseMsg(message.data)[0]; // TODO: Handle possible error message.
        this.broadcast(message_to_be_bcasted.command, message_to_be_bcasted.data);

        break;

      case COMMAND_EMIT:
        client_name = message.id;

        if (message.delivery !== null) {
          this._delivery_registry[message.delivery] = client_name;
        }

        let message_to_be_emitted = parseMsg(message.data)[0]; // TODO: Handle possible error message.
        this.emit(
          message_to_be_emitted.id,
          message_to_be_emitted.command,
          message_to_be_emitted.data,
          message_to_be_emitted.delivery
        );
    }
  }, this);
}

/**
 * On "close" event handler for IpcServer handshake/broadcast socket.<br>
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @ignore
 */
function $onServerBcastClose(uuid) {

  feedConsoleLines.call(this, "SRV BCAST CLS", `socket: ${uuid}`);

  if (bcast_registry[this._domain][uuid] !== undefined) {
    delete bcast_registry[this._domain][uuid];
  }
}

/**
 * On "error" event handler for IpcServer handshake/broadcast socket.
 * @param error
 * @ignore
 */
function $onServerBcastError(error) {

  feedConsoleLines.call(this, "SRV BCAST ERR", error);

}

/**
 * On "connect" event handler for IpcServer unique socket creation callback.<br>
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid                 Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name          Friendly name of client, if passed into client constructor,
 *                                      otherwise UUDv4/wo dashes.
 * @param {Socket} serverUniqueSocket   Socket used for 1 to 1 communication with each client.
 * @ignore
 */
function $onServerUniqueCreation(uuid, client_name, serverUniqueSocket) {

  feedConsoleLines.call(this, "SRV UNIQUE CREATE", `socket: ${uuid}, client: ${client_name}`);

  this._uuid_registry[uuid].socket = serverUniqueSocket;
  this._uuid_registry[uuid].socket._populated_handlers = {};
  this._uuid_registry[uuid].socket.writeCommand = function (command, data, callback) {
    return this.write(prepareMsg(command, data), callback);
  }.bind(this._uuid_registry[uuid].socket);

  // Close means "do not accept new sockets".
  // clientUniqueSocket is to be really unique.
  this._uuid_registry[uuid].server.close();

  serverUniqueSocket
    .on("data", $onServerUniqueData.bind(this, uuid, client_name, this._uuid_registry[uuid]))
    .on("close", $onServerUniqueClose.bind(this, uuid, client_name))
    .on("error", $onServerUniqueError.bind(this))
  ;
}

/**
 * On "data" event handler for IpcServer unique socket.<br>
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name  Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes.
 * @param {iface} iface         Interface containing socket instance and server instance.
 * @param {Buffer} buffer       Data buffer received from remote party with "data" event.
 * @ignore
 */
function $onServerUniqueData(uuid, client_name, iface, buffer) {

  feedConsoleLines.call(this, "SRV UNIQUE DATA", `socket: ${uuid}, client: ${client_name}`, buffer);

  let message_array = parseMsg(buffer);
  message_array.forEach((message) => {

    // Handle deliver command from consumer client to producer client.
    if (message.command === COMMAND_DELIVER) {
      if (message.delivery !== null && this._delivery_registry[message.delivery] !== undefined) {
        let client_name = this._delivery_registry[message.delivery];
        this.emit(client_name, COMMAND_DELIVER, message.data, message.delivery);
        delete this._delivery_registry[message.delivery];

        return;
      }
    }

    // Handle custom client command when handler registered.
    let ret = executeCommandHandlers.call(this, uuid, client_name, iface, message);

    if (message.delivery !== null) {
      // There is delivery id attached, that means that sender wants to be notified with result that is returned.

      if (ret === undefined) {
        // It is possible, that command handler is not returning anything despite sender asks for delivery.
        // In such case, we are just to deliver null, but deliverance will be confirmed,
        // and promise for it will become fulfilled on sender side.
        ret = null;
      }

      this.emit(client_name, COMMAND_DELIVER, ret, message.delivery);
    }
  }, this);
}

/**
 * On "close" event handler for IpcServer client communication socket.<br>
 * Always called with "this" bound to IpcServer instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name  Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes.
 * @ignore
 */
function $onServerUniqueClose(uuid, client_name) {

  feedConsoleLines.call(this, "SRV UNIQUE CLS", `socket: ${uuid}, client: ${client_name}`);

  if (this._name_registry[client_name] !== undefined) {
    delete this._name_registry[client_name];
  }

  if (this._uuid_registry[uuid].name !== undefined) {
    delete this._uuid_registry[uuid].name;
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
 * @ignore
 */
function $onServerUniqueError(error) {

  feedConsoleLines.call(this, "SRV UNIQUE ERR", error);

}

/**
 * @classdesc Inter-Process-Communication Server
 * @alias module:ipcIO.Server
 */
class IpcServer {
  /**
   * Creates new instance of ipcIO Server.
   * @example
   * ```js
   * const exampleServer = new ipcio.Server({
   *     verbose: true,             // Determines if actions are reported to console,
   *     domain: "example_domain",  // domain name,
   *     encoding: "utf8",          // message encoding.
   *   },
   *   {
   *     example_request_command: (container) => { // {command: function(container)}
   *
   *       // @typedef {object} container
   *       // @property {string} data        Message data
   *       // @property {string} client_name Friendly name of client/uuid if name not set.
   *       // @property {Socket} socket      Instance of net.Socket
   *       // @property {Server} server      Instance of net.Server
   *
   *       // Do handler logic here.
   *     },
   *   })
   * ;
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
     * Registry of deliveries, keyed by client names.
     * @type {object}
     * @private
     */
    this._delivery_registry = {};

    /**
     * Message encoding
     * @type {string}
     * @private
     */
    this._encoding = options.encoding || "utf8";

    /**
     * Server broadcast domain
     * @type {string}
     * @private
     */
    this._domain = options.domain || DOMAIN_DEFAULT;

    /**
     * Path to unix socket file handler
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
     * Indicated if sever is already started.
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
   * Starts IpcServer instance.
   * @returns {module:ipcIO.IpcServer}
   * @throws Error If this method was called before and IpcServer instance is already started.
   */
  start() {

    feedConsole.call(this, "SRV CLASS.start()");

    if (this._is_started) {
      throw new Error(`Tried to start IPC server for domain ${this._domain}, that has already started.`);
    }

    if (fs.existsSync(this._bcast_path)) {
      fs.unlinkSync(this._bcast_path);
    }

    this._bcastServer = net.createServer($onServerBcastCreation.bind(this));
    this._bcastServer.listen(this._bcast_path);

    feedConsoleLines.call(this, "SRV BCAST LISTEN", `path: ${this._bcast_path}`);

    this._is_started = true;

    return this;
  }

  /**
   * Adds handlers at any time, regardless client state.
   * @example
   * ```js
   * const exampleServer = new ipcio.Server({
   *   // Server instantiation options
   * });
   *
   * // Some code...
   *
   * exampleServer.addHandlers({
   *   example_request_command: (container) => { // {command: function(container)}
   *
   *     // @typedef {object} container
   *     // @property {string} data        Message data
   *     // @property {string} client_name Friendly name of client/uuid if name not set.
   *     // @property {Socket} socket      Instance of net.Socket
   *
   *     // Do handler logic here.
   *   },
   * });
   * ```
   * @param {handler_collection} handler_collection Handlers to be registered.
   * @returns {module:ipcIO.IpcServer}
   */
  addHandlers(handler_collection) {
    addHandlers.call(this, handler_collection);

    return this;
  }

  /**
   * Writes to client socket of given friendly name.
   * @example
   * ```js
   * const exampleServer = new ipcio.Server({
   *   // Server instantiation options
   * });
   *
   * // Some code...
   *
   * exampleServer.emit("example_client", "example_command", {prop1: "prop1"});
   * ```
   * @param {string} client_name    Friendly name of client.
   * @param {string|null} command   Command description.
   * @param {string|null} data      Data carried by message.
   * @param {string|null} delivery  Id of delivery of message that needs to be confirmed with response data.
   *                                Practically used with COMMAND_DELIVER.
   * @returns {module:ipcIO.IpcServer}
   */
  emit(client_name, command, data, delivery = null) {

    feedConsole.call(this, `SRV CLASS.emit(${client_name}, ${command}, ${JSON.stringify(data)}, ${delivery})`);

    if (
      client_name in this._name_registry && // We have such friendly name,
      typeof this._name_registry[client_name] === "string" && // really a name,
      this._name_registry[client_name] in this._uuid_registry && // which uuid exists in registry,
      this._uuid_registry[this._name_registry[client_name]].socket instanceof net.Socket && // being socket,
      this._uuid_registry[this._name_registry[client_name]].socket.writable // that is writable.
    ) {
      this._uuid_registry[this._name_registry[client_name]].socket.write(
        prepareMsg(null, command, data, delivery), this._encoding
      );
    }

    return this;
  }

  /**
   * Writes to all client sockets within server domain, except initiator client, if provided.
   * @example
   * ```js
   * const exampleServer = new ipcio.Server({
   *   // Server instantiation options
   * });
   *
   * // Some code...
   *
   * exampleServer.broadcast("example_command", {prop1: "prop1"});
   * ```
   * @param {string|null} command           Command description
   * @param {string|null} data              Data carried by message.
   * @param {string|null} initiator_client  Friendly name of client which initiated broadcast (if client-initiated).
   * @returns {module:ipcIO.IpcServer}
   */
  broadcast(command, data, initiator_client = null) {

    feedConsole.call(this, `SRV CLASS.broadcast(${command}, ${JSON.stringify(data)}, ${initiator_client})`);

    for (let uuid in this._uuid_registry) {
      if (initiator_client && this._name_registry[initiator_client] === uuid) {
        continue;
      }

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
 * @ignore
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
 * Checks if there is possibility to successfully write queue entry to socket.<br>
 * If so, writes to socket and initialized writing next entry, when socket is able to respond with response.
 * @ignore
 */
function sendQueueEntry() {
  if (this._is_connected && this._queue.length) {
    this._uniqueSocket.write(this._queue[0][0], this._encoding, () => {

      // Get rid of sent message only if write was successful.
      let shifted_entry = this._queue.shift();

      // Second element of queue entry can be resolve function of promise,
      // if entry was pushed to queue as a result of IpcClient#whenEmitted call.
      if (shifted_entry[1] !== null && typeof shifted_entry[1] === "function") {
        shifted_entry[1](); // Resolve promise.
      }

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
 * @ignore
 */
function handleQueue() {
  if (this._is_connected && this._queue.length && !this._emptying_queue) {
    this._emptying_queue = true;
    sendQueueEntry.call(this);
  }
}

/**
 * Checks if there is possibility to successfully write queue entry to broadcast socket.<br>
 * If so, writes to socket and initialized writing next entry, when socket is able to respond with response.
 * @ignore
 */
function sendBcastQueueEntry() {
  if (this._is_connected && this._bcast_queue.length) {
    this._bcastSocket.write(this._bcast_queue[0][0], this._encoding, () => {

      // Get rid of sent message only if write was successful.
      let shifted_entry = this._bcast_queue.shift();

      // Second element of queue entry can be resolve function of promise,
      // if entry was pushed to queue as a result of IpcClient#whenEmitted call.
      if (shifted_entry[1] !== null && typeof shifted_entry[1] === "function") {
        shifted_entry[1](); // Resolve promise.
      }

      if (!this._bcast_queue.length) {
        this._emptying_bcast_queue = false;
      }
      else {
        sendBcastQueueEntry.call(this);
      }
    });
  }
  else {
    this._emptying_bcast_queue = false;
  }
}

/**
 * Checks if there is possibility to successfully emit messages to broadcast socket. If so, begins emitting process.
 * @ignore
 */
function handleBcastQueue() {
  if (this._is_connected && this._bcast_queue.length && !this._emptying_bcast_queue) {
    this._emptying_bcast_queue = true;
    sendBcastQueueEntry.call(this);
  }
}

/**
 * On "finish", "close", "error" events handler for IpcClient communication sockets.
 * Always called with "this" bound to IpcClient instance.
 * @ignore
 */
function $onClientOffline() {

  feedConsoleLines.call(this, "CLI OFFLINE");

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
 * @param {function} resolve Resolve function to be passed to client unique socket connection handler.
 * @ignore
 */
function $onClientBcastConnect(resolve) {

  feedConsoleLines.call(this, "CLI BCAST CONNECT", `path: ${this._bcast_path}`);

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
            .connect(`${this._bcast_path}.${this._channel_id}`, $onClientUniqueConnect.bind(this, resolve));
        }

        if (message.command === COMMAND_DISCOVER && message.id === this._client_name) {
          this._discoverPromiseResolve(message.data);
          this._is_discovering = false;
        }
      }, this);
    })
  ;

  this._bcastSocket.write(prepareMsg(COMMAND_HANDSHAKE, this._client_name), this._encoding);
}

/**
 * On "connect" event handler for IpcClient unique socket callback.<br>
 * Always called with "this" bound to IpcClient instance.
 * @param {function} resolve Resolve function that fulfills promise for client unique socket connection.
 * @ignore
 */
function $onClientUniqueConnect(resolve) {

  feedConsole.call(this, "CLI UNIQUE CONNECT", `socket: ${this._channel_id}`);

  // Client unique socket has just been hand-shaken therefore we have stopped connecting and are connected.
  this._is_connecting = false;
  this._is_connected = true;

  if (typeof resolve === "function") {
    resolve(); // Fulfills promise returned by IpcClient#connect.
  }

  handleQueue.call(this);

  this._uniqueSocket
    .on("data", $onClientUniqueData.bind(this, this._channel_id, this._client_name, {
      socket: this._uniqueSocket,
      server: this._uniqueSocket.server || null,
    }))
  ;
}

/**
 * On "data" event handler for IpcClient unique socket.<br>
 * Always called with "this" bound to either IpcClient instance.
 * @param {string} uuid         Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes.
 * @param {string} client_name  Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes.
 * @param {iface} iface         Interface containing socket instance and server instance.
 * @param {Buffer} buffer       Data buffer received from remote party with "data" event.
 * @ignore
 */
function $onClientUniqueData(uuid, client_name, iface, buffer) {

  feedConsoleLines.call(this, "CLI UNIQUE DATA", `socket: ${uuid}, client: ${client_name}`, buffer);

  let message_array = parseMsg(buffer);
  message_array.forEach((message) => {

    // Handle deliver command from consumer client to producer client.
    if (message.command === COMMAND_DELIVER) {
      if (message.delivery !== null && typeof this._deliveries[message.delivery] === "function") {
        this._deliveries[message.delivery](message.data); // Fulfills promise for delivery.
        this._deliveries[message.delivery] = undefined;

        return;
      }
    }

    // Handle custom client command when handler registered.
    let ret = executeCommandHandlers.call(this, uuid, client_name, iface, message);

    if (message.delivery !== null) {
      // There is delivery id attached, that means that sender wants to be notified with result that is returned.

      if (ret === undefined) {
        // It is possible, that command handler is not returning anything despite sender asks for delivery.
        // In such case, we are just to deliver null, but deliverance will be confirmed,
        // and promise for it will become fulfilled on sender side.
        ret = null;
      }

      this.send(COMMAND_DELIVER, ret, message.delivery);
    }
  }, this);
}

/**
 * @classdesc Inter-Process-Communication Client
 * @alias module:ipcIO.Client
 */
class IpcClient {
  /**
   * Creates new instance of ipcIO Client.
   * @example
   * ```js
   * const exampleClient = new ipcio.Client({
   *     verbose: true,             // Determines if actions are reported to console,
   *     name: "example_client",    // friendly client name,
   *     domain: "example_domain",  // domain name,
   *     encoding: "utf8",          // message encoding.
   *   },
   *   {
   *     example_request_command: (container) => { // {command: function(container)}
   *
   *       // @typedef {object} container
   *       // @property {string} data        Message data
   *       // @property {string} client_name Friendly name of client/uuid if name not set.
   *       // @property {Socket} socket      Instance of net.Socket
   *
   *       // Do handler logic here.
   *     },
   *   })
   * ;
   * ```
   * @constructor
   * @param {client_constructor_options} options    Determines operating properties and behavior.
   * @param {handler_collection} handler_collection Handlers to be registered at construction time.
   */
  constructor(options = {}, handler_collection = {}) {
    /**
     * When true, will feed the console.
     * @type {boolean}
     */
    this.verbose = options.verbose || false;

    /**
     * Broadcast domain
     * @type {string}
     * @private
     */
    this._domain = options.domain || DOMAIN_DEFAULT;

    /**
     * Broadcast unix socket file path
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
     * if willing to emit messages explicitly to this client from server.<br>
     * Name has to be unique for each client connected to single server.
     * @type {string}
     * @private
     */
    this._client_name = options.name || uuidV4().replace(/-/g, "");

    /**
     * Set to true every time connection process starts.<br>
     * Set to false every time connection is finished, broken or error.
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
     * Semaphore that is used to indicate that unique socket queue is being emptied.
     * @type {boolean}
     * @private
     */
    this._emptying_queue = false;

    /**
     * Queue of messages
     * @type {array}
     * @private
     */
    this._queue = [];

    /**
     * Semaphore that is used to indicate that broadcast socket queue is being emptied.
     * @type {boolean}
     * @private
     */
    this._emptying_bcast_queue = false;

    /**
     * Queue of broadcast socket messages
     * @type {array}
     * @private
     */
    this._bcast_queue = [];

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
     * Determines if client is in the middle of discovering action.<br>
     * Set to true on IpcClient#discover call, set to false when discovery response is received from server..
     * @type {boolean}
     * @private
     */
    this._is_discovering = false;

    /**
     * Promise for server discovery
     * @type {null|Promise}
     * @private
     */
    this._discoverPromise = null;

    /**
     * Promise for server discovery resolve() function. Called when discovery response is received from server.<br>
     * Calling this function fulfills promise for server discovery.
     * @type {null}
     * @private
     */
    this._discoverPromiseResolve = null;

    /**
     * Collection of delivery promise resolve functions, keyed by delivery id.
     * @type {object}
     * @private
     */
    this._deliveries = {};

    /**
     * Message encoding
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
   * Adds handlers at any time, regardless client state.
   * @example
   * ```js
   * const exampleClient = new ipcio.Client({
   *   // Client instantiation options
   * });
   *
   * // Some code...
   *
   * exampleClient.addHandlers({
   *   example_request_command: (container) => { // {command: function(container)}
   *
   *     // @typedef {object} container
   *     // @property {string} data        Message data
   *     // @property {string} client_name Friendly name of client/uuid if name not set.
   *     // @property {Socket} socket      Instance of net.Socket
   *
   *     // Do handler logic here.
   *   },
   * });
   * ```
   * @param {handler_collection} handler_collection Handlers to be registered at construction time.
   * @returns {module:ipcIO.IpcClient}
   */
  addHandlers(handler_collection) {
    addHandlers.call(this, handler_collection);

    return this;
  }

  /**
   * Connects client to the server.
   * @returns {Promise} Promise for client unique socket connection
   */
  connect() {

    feedConsole.call(this, "CLI CLASS.connect()");

    if (this._is_connecting || this._is_connected) {
      throw new Error(`Tried to connect to IPC server for domain ${this._domain}, when already connected/ing.`);
    }
    this._is_connecting = true;

    return new Promise((resolve) => {
      this._bcastSocket = spawnClientSocket.call(this);
      this._bcastSocket.connect(this._bcast_path, $onClientBcastConnect.bind(this, resolve));
    });
  }

  /**
   * Puts command with data queue, calls queue handler.<br>
   * Command is sent immediately to server when there is connection established and previous entries become sent.<br>
   * Returned promise is fulfilled when message was successfully received by server.
   * @example
   * ```js
   * const exampleClient = new ipcio.Client({
   *   // Client instantiation options
   * });
   *
   * // Some code...
   *
   * exampleClient
   *   .send("example_command", {prop1: "prop1"})
   *   .then(() => {
   *     // Do something when message is successfully sent to server.
   *   })
   * ;
   * ```
   * @param {string|null} command   Command description
   * @param {string|null} data      Data carried by message
   * @param {string|null} delivery  Id of delivery of message that needs to be confirmed with response data.
   *                                Practically used with COMMAND_DELIVER.
   * @returns {Promise}
   */
  send(command, data, delivery = null) {

    feedConsole.call(this, `CLI CLASS.send(${command}, ${JSON.stringify(data)}, ${delivery})`);

    return new Promise((resolve) => {
      this._queue.push([prepareMsg(null, command, data, delivery), resolve]);
      handleQueue.call(this);
    });
  }

  /**
   * Requests server to expose its command names and friendly names of clients connected to it.<br>
   * Puts command with data to broadcast socket queue, calls queue handler.<br>
   * Command is emitted immediately when there is connection established and previous entries become emitted.<br>
   * Returned promise for server discovery info is fulfilled on discover response from server.
   * @example
   * ```js
   * const exampleClient = new ipcio.Client({
   *   // Client instantiation options
   * });
   *
   * // Some code...
   *
   * exampleClient
   *   .discover()
   *   .then((result) => {
   *     console.log(result); // { clients: [ 'example_client' ],
   *                          // command_handlers: [ 'example_request_command', 'other_request_command' ] }
   *   })
   * ;
   * ```
   * @returns {Promise}
   */
  discover() {

    feedConsole.call(this, "CLI CLASS.discover()");

    if (!this._is_discovering) {
      this._discoverPromise = new Promise((resolve) => {
        this._is_discovering = true;
        this._discoverPromiseResolve = resolve;
        this._bcast_queue.push([prepareMsg(this._client_name, COMMAND_DISCOVER, null)]);
        handleBcastQueue.call(this);
      });
    }

    return this._discoverPromise;
  }

  /**
   * Requests server to write to all client sockets within server domain, except this client.<br>
   * Puts command with data to broadcast socket queue, calls queue handler.<br>
   * Command is emitted immediately when there is connection established and previous entries become emitted.<br>
   * Returned promise is fulfilled when message was successfully received by server.
   * @example
   * ```js
   * const exampleClient = new ipcio.Client({
   *   // Client instantiation options
   * });
   *
   * // Some code...
   *
   * exampleClient
   *   .broadcast("example_command", {prop1: "prop1"})
   *   .then(() => {
   *     // Do something when broadcast is successfully received by server.
   *   })
   * ;
   * ```
   * @param {string|null} command Command description
   * @param {string|null} data    Data carried by message.
   * @returns {Promise}
   */
  broadcast(command, data) {

    feedConsole.call(this, `CLI CLASS.broadcast(${command}, ${JSON.stringify(data)})`);

    return new Promise((resolve) => {
      this._bcast_queue.push([prepareMsg(
        this._client_name,
        COMMAND_BROADCAST,
        prepareMsg(command, data)
      ), resolve]);
      handleBcastQueue.call(this);
    });
  }

  /**
   * Requests server to write command, to client with name given as first argument.<br>
   * Puts command with data to broadcast socket queue, calls queue handler.<br>
   * Command is emitted immediately when there is connection established and previous entries become emitted.<br>
   * Returned promise is fulfilled when message was successfully received by server.
   * @example
   * ```js
   * const exampleClient = new ipcio.Client({
   *   // Client instantiation options
   * });
   *
   * // Some code...
   *
   * exampleClient
   *   .emit("example_client", "example_command", {prop1: "prop1"})
   *   .then(() => {
   *     // Do something when message is successfully emitted to server (NOT emitted further by server do destination).
   *   })
   * ;
   * ```
   * @param {string} client_name  Friendly name of client.
   * @param {string|null} command Command description
   * @param {string|null} data    Data carried by message
   * @returns {Promise}
   */
  emit(client_name, command, data) {

    feedConsole.call(this, `CLI CLASS.emit(${client_name}, ${command}, ${JSON.stringify(data)})`);

    return new Promise((resolve) => {
      this._bcast_queue.push([prepareMsg(
        this._client_name,
        COMMAND_EMIT,
        prepareMsg(client_name, command, data)
      ), resolve]);
      handleBcastQueue.call(this);
    });
  }

  deliver(client_name, command, data) {

    feedConsole.call(this, `CLI CLASS.deliver(${client_name}, ${command}, ${JSON.stringify(data)})`);

    if (data === undefined) {
      data = command;
      command = client_name;
      client_name = null;
    }
    let delivery = uuidV4().replace(/-/g, "");

    return new Promise((resolve) => {
      this._deliveries[delivery] = resolve;

      if (client_name !== null) { // Our client emits to client of given name, so we are emitting to bcast socket.
        this._bcast_queue.push([prepareMsg(
          this._client_name,
          COMMAND_EMIT,
          prepareMsg(client_name, command, data, delivery),
          delivery
        )]);
        handleBcastQueue.call(this);
      }
      else { // No client name specified, this is just a request to server.
        this._queue.push([prepareMsg(null, command, data, delivery)]);
        handleQueue.call(this);
      }
    });
  }
}

module.exports.Client = IpcClient;
