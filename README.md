# ipcIO
Server and client for unix-domain-based inter-process-communication (IPC).

## Sounds scary. What does it do to my project?
Provides layer of connectivity, conducted in the same favor as unix processes use to communicate. This is called the __Inter Process Communication (IPC)__.
Basic nodejs *net* library, literally *net.Server* and *net.Socket*, can, aside "regular" TCP sockets, provide the same functionality. To be honest, *ipcIO* uses them underneath.
What makes this package worth attention, is the way of dealing with *handlers*, special functions passed to *net* classes and asynchronicity.
Using *ipcIO*, it becomes easy to add handler at any moment of *ipcIO* server or client lifetime.
It is possible to emit or broadcasts commands by just calling *ipcIO* `emit` or `broadcast` functionality from outside instance scope.
Servers create, within their __domain__ two levels of connectivity. First one is used to handshake and broadcast to all clients in domain, second is unique to each server-client pair.
Much influence for me gave me __SocketIO__ project. Hence the name?

## Jump-in tutorial

* Install package:

`$ npm install ipcio`

* Create server code, let's name it `test-server.js`:

```js
const ipcio = require("ipcio");
const exampleServer = new ipcio.Server({
    verbose: true,
    domain: "example_domain",
  },
  {
    example_request_command: (container) => {
      console.log("Example command handler triggered.");
      console.log(`Client name: ${container.name}`);
      console.log(`Receiving data: ${container.data}`);

      exampleServer.emit(container.name, "example_response_command", "example response data"); // Send command by calling ipcio server instance...
    },
    other_request_command: (container) => {
      console.log("Other command handler triggered.");
      console.log(`Client name: ${container.name}`);
      console.log(`Receiving data: ${container.data}`);

      let clientSocket = container.socket;
      clientSocket.writeCommand("other_response_command", "other response data"); // ...or by calling client socket instance. 
    },
  })
;

exampleServer.start(); // Synchronous, it is client responsibility to poll for connection.
```

* Create client code, name file something like `test-client.js`:

```js
const ipcio = require("ipcio");
const exampleClient = new ipcio.Client({
    verbose: true,
    name: "example_client",
    domain: "example_domain",
  },
  {
    example_response_command: (container) => {
      console.log(`Received example response command with data: ${container.data}`);
    },
    other_response_command: (container) => {
      console.log(`Received other response command with data: ${container.data}`);
    },
  }
);

exampleClient
  .connect()
  .then(() => {
    setInterval(() => {
      exampleClient
        .send("example_request_command", "example request data") // Returns promise.
        .then(() => {
          console.log("Example request command has just been sent.");
        })
      ;
    }, 7331);    
    setInterval(() => {
      exampleClient
        .send("other_request_command", "other request data") // Returns promise.

        // If no need to perform anything when message ACK is received, we can skip calling promise thenable.
        // .then(() => {
        //   console.log("Example request command has just been sent.");
        // })
      ;
    }, 1338);
  
  })
;
```


* Watch them run!

`$ node test-server`
`$ node test-client`

<a name="module_ipcIO"></a>

## API reference

* [ipcIO](#module_ipcIO)
    * _static_
        * [.Server](#module_ipcIO.Server)
            * [new IpcServer(options, handler_collection)](#new_module_ipcIO.Server_new)
            * [.verbose](#module_ipcIO.Server.IpcServer+verbose) : <code>boolean</code>
            * [.start()](#module_ipcIO.Server+start) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.addHandlers(handler_collection)](#module_ipcIO.Server+addHandlers) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.emit(client_name, command, data)](#module_ipcIO.Server+emit) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.broadcast(command, data, initiator_client)](#module_ipcIO.Server+broadcast) ⇒ <code>module:ipcIO.IpcServer</code>
        * [.Client](#module_ipcIO.Client)
            * [new IpcClient(options, handler_collection)](#new_module_ipcIO.Client_new)
            * [.verbose](#module_ipcIO.Client.IpcClient+verbose) : <code>boolean</code>
            * [.addHandlers(handler_collection)](#module_ipcIO.Client+addHandlers) ⇒ <code>module:ipcIO.IpcClient</code>
            * [.connect()](#module_ipcIO.Client+connect) ⇒ <code>Promise</code>
            * [.send(command, data)](#module_ipcIO.Client+send) ⇒ <code>Promise</code>
            * [.discover()](#module_ipcIO.Client+discover) ⇒ <code>Promise</code>
            * [.broadcast(command, data)](#module_ipcIO.Client+broadcast) ⇒ <code>Promise</code>
            * [.emit(client_name, command, data)](#module_ipcIO.Client+emit) ⇒ <code>Promise</code>
* [Typedefs](#typedefs)
    * [parsed_message](#module_ipcIO..parsed_message) : <code>object</code>
    * [parsed_message_array](#module_ipcIO..parsed_message_array) : <code>Array.&lt;parsed_message&gt;</code>
    * [iface](#module_ipcIO..iface) : <code>object</code>
    * [handler_container](#module_ipcIO..handler_container) : <code>object</code>
    * [handler_collection](#module_ipcIO..handler_collection) : <code>object</code>
    * [server_constructor_options](#module_ipcIO..server_constructor_options) : <code>object</code>
    * [client_constructor_options](#module_ipcIO..client_constructor_options) : <code>object</code>

<a name="module_ipcIO.Server"></a>

### ipcIO.Server
Inter-Process-Communication Server

**Kind**: static class of [<code>ipcIO</code>](#module_ipcIO)  

* [.Server](#module_ipcIO.Server)
    * [new IpcServer(options, handler_collection)](#new_module_ipcIO.Server_new)
    * [.verbose](#module_ipcIO.Server.IpcServer+verbose) : <code>boolean</code>
    * [.start()](#module_ipcIO.Server+start) ⇒ <code>module:ipcIO.IpcServer</code>
    * [.addHandlers(handler_collection)](#module_ipcIO.Server+addHandlers) ⇒ <code>module:ipcIO.IpcServer</code>
    * [.emit(client_name, command, data)](#module_ipcIO.Server+emit) ⇒ <code>module:ipcIO.IpcServer</code>
    * [.broadcast(command, data, initiator_client)](#module_ipcIO.Server+broadcast) ⇒ <code>module:ipcIO.IpcServer</code>

<a name="new_module_ipcIO.Server_new"></a>

#### new IpcServer(options, handler_collection)
Creates new instance of ipcIO Server.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>server_constructor_options</code> | Determines operating properties and behavior. |
| handler_collection | <code>handler_collection</code> | Handlers to be registered at construction time. |

**Example**  
```js
const exampleServer = new ipcio.Server({
    verbose: true,             // Determines if actions are reported to console,
    domain: "example_domain",  // domain name,
    encoding: "utf8",          // message encoding.
  },
  {
    example_request_command: (container) => { // {command: function(container)}

      // @typedef {object} container
      // @property {string} data        Message data
      // @property {string} client_name Friendly name of client/uuid if name not set.
      // @property {Socket} socket      Instance of net.Socket
      // @property {Server} server      Instance of net.Server

      // Do handler logic here.
    },
  })
;
```
<a name="module_ipcIO.Server.IpcServer+verbose"></a>

#### server.verbose : <code>boolean</code>
When true, will feed the console.

**Kind**: instance property of [<code>Server</code>](#module_ipcIO.Server)  
<a name="module_ipcIO.Server+start"></a>

#### server.start() ⇒ <code>module:ipcIO.IpcServer</code>
Starts IpcServer instance.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  
**Throws**:

- Error If this method was called before and IpcServer instance is already started.

<a name="module_ipcIO.Server+addHandlers"></a>

#### server.addHandlers(handler_collection) ⇒ <code>module:ipcIO.IpcServer</code>
Adds handlers at any time, regardless client state.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param | Type | Description |
| --- | --- | --- |
| handler_collection | <code>handler_collection</code> | Handlers to be registered. |

**Example**  
```js
const exampleServer = new ipcio.Server({
  // Server instantiation options
});

// Some code...

exampleServer.addHandlers({
  example_request_command: (container) => { // {command: function(container)}

    // @typedef {object} container
    // @property {string} data        Message data
    // @property {string} client_name Friendly name of client/uuid if name not set.
    // @property {Socket} socket      Instance of net.Socket

    // Do handler logic here.
  },
});
```
<a name="module_ipcIO.Server+emit"></a>

#### server.emit(client_name, command, data) ⇒ <code>module:ipcIO.IpcServer</code>
Writes to client socket of given friendly name.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param | Type | Description |
| --- | --- | --- |
| client_name | <code>string</code> | Friendly name of client. |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

**Example**  
```js
const exampleServer = new ipcio.Server({
  // Server instantiation options
});

// Some code...

exampleServer.emit("example_client", "example_command", {prop1: "prop1"});
```
<a name="module_ipcIO.Server+broadcast"></a>

#### server.broadcast(command, data, initiator_client) ⇒ <code>module:ipcIO.IpcServer</code>
Writes to all client sockets within server domain, except initiator client, if provided.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> \| <code>null</code> |  | Command description |
| data | <code>string</code> \| <code>null</code> |  | Data carried by message. |
| initiator_client | <code>string</code> \| <code>null</code> | <code>null</code> | Friendly name of client which initiated broadcast (if client-initiated). |

**Example**  
```js
const exampleServer = new ipcio.Server({
  // Server instantiation options
});

// Some code...

exampleServer.broadcast("example_command", {prop1: "prop1"});
```
<a name="module_ipcIO.Client"></a>

### ipcIO.Client
Inter-Process-Communication Client

**Kind**: static class of [<code>ipcIO</code>](#module_ipcIO)  

* [.Client](#module_ipcIO.Client)
    * [new IpcClient(options, handler_collection)](#new_module_ipcIO.Client_new)
    * [.verbose](#module_ipcIO.Client.IpcClient+verbose) : <code>boolean</code>
    * [.addHandlers(handler_collection)](#module_ipcIO.Client+addHandlers) ⇒ <code>module:ipcIO.IpcClient</code>
    * [.connect()](#module_ipcIO.Client+connect) ⇒ <code>Promise</code>
    * [.send(command, data)](#module_ipcIO.Client+send) ⇒ <code>Promise</code>
    * [.discover()](#module_ipcIO.Client+discover) ⇒ <code>Promise</code>
    * [.broadcast(command, data)](#module_ipcIO.Client+broadcast) ⇒ <code>Promise</code>
    * [.emit(client_name, command, data)](#module_ipcIO.Client+emit) ⇒ <code>Promise</code>

<a name="new_module_ipcIO.Client_new"></a>

#### new IpcClient(options, handler_collection)
Creates new instance of ipcIO Client.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>client_constructor_options</code> | Determines operating properties and behavior. |
| handler_collection | <code>handler_collection</code> | Handlers to be registered at construction time. |

**Example**  
```js
const exampleClient = new ipcio.Client({
    verbose: true,             // Determines if actions are reported to console,
    name: "example_client",    // friendly client name,
    domain: "example_domain",  // domain name,
    encoding: "utf8",          // message encoding.
  },
  {
    example_request_command: (container) => { // {command: function(container)}

      // @typedef {object} container
      // @property {string} data        Message data
      // @property {string} client_name Friendly name of client/uuid if name not set.
      // @property {Socket} socket      Instance of net.Socket

      // Do handler logic here.
    },
  })
;
```
<a name="module_ipcIO.Client.IpcClient+verbose"></a>

#### client.verbose : <code>boolean</code>
When true, will feed the console.

**Kind**: instance property of [<code>Client</code>](#module_ipcIO.Client)  
<a name="module_ipcIO.Client+addHandlers"></a>

#### client.addHandlers(handler_collection) ⇒ <code>module:ipcIO.IpcClient</code>
Adds handlers at any time, regardless client state.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Description |
| --- | --- | --- |
| handler_collection | <code>handler_collection</code> | Handlers to be registered at construction time. |

**Example**  
```js
const exampleClient = new ipcio.Client({
  // Client instantiation options
});

// Some code...

exampleClient.addHandlers({
  example_request_command: (container) => { // {command: function(container)}

    // @typedef {object} container
    // @property {string} data        Message data
    // @property {string} client_name Friendly name of client/uuid if name not set.
    // @property {Socket} socket      Instance of net.Socket

    // Do handler logic here.
  },
});
```
<a name="module_ipcIO.Client+connect"></a>

#### client.connect() ⇒ <code>Promise</code>
Connects client to the server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  
**Returns**: <code>Promise</code> - Promise for client unique socket connection  
<a name="module_ipcIO.Client+send"></a>

#### client.send(command, data) ⇒ <code>Promise</code>
Puts command with data queue, calls queue handler.<br>
Command is sent immediately to server when there is connection established and previous entries become sent.<br>
Returned promise is fulfilled when message was successfully received by server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>string</code> \| <code>null</code> | Command description |
| data | <code>string</code> \| <code>null</code> | Data carried by message |

**Example**  
```js
const exampleClient = new ipcio.Client({
  // Client instantiation options
});

// Some code...

exampleClient
  .send("example_command", {prop1: "prop1"})
  .then(() => {
    // Do something when message is successfully sent to server.
  })
;
```
<a name="module_ipcIO.Client+discover"></a>

#### client.discover() ⇒ <code>Promise</code>
Requests server to expose its command names and friendly names of clients connected to it.<br>
Puts command with data to broadcast socket queue, calls queue handler.<br>
Command is emitted immediately when there is connection established and previous entries become emitted.<br>
Returned promise for server discovery info is fulfilled on discover response from server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  
**Example**  
```js
const exampleClient = new ipcio.Client({
  // Client instantiation options
});

// Some code...

exampleClient
  .discover()
  .then((result) => {
    console.log(result); // { clients: [ 'example_client' ],
                         // command_handlers: [ 'example_request_command', 'other_request_command' ] }
  })
;
```
<a name="module_ipcIO.Client+broadcast"></a>

#### client.broadcast(command, data) ⇒ <code>Promise</code>
Requests server to write to all client sockets within server domain, except this client.<br>
Puts command with data to broadcast socket queue, calls queue handler.<br>
Command is emitted immediately when there is connection established and previous entries become emitted.<br>
Returned promise is fulfilled when message was successfully received by server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>string</code> \| <code>null</code> | Command description |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

**Example**  
```js
const exampleClient = new ipcio.Client({
  // Client instantiation options
});

// Some code...

exampleClient
  .broadcast("example_command", {prop1: "prop1"})
  .then(() => {
    // Do something when broadcast is successfully received by server.
  })
;
```
<a name="module_ipcIO.Client+emit"></a>

#### client.emit(client_name, command, data) ⇒ <code>Promise</code>
Requests server to write command, to client with name given as first argument.<br>
Puts command with data to broadcast socket queue, calls queue handler.<br>
Command is emitted immediately when there is connection established and previous entries become emitted.<br>
Returned promise is fulfilled when message was successfully received by server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Description |
| --- | --- | --- |
| client_name | <code>string</code> | Friendly name of client. |
| command | <code>string</code> \| <code>null</code> | Command description |
| data | <code>string</code> \| <code>null</code> | Data carried by message |

**Example**  
```js
const exampleClient = new ipcio.Client({
  // Client instantiation options
});

// Some code...

exampleClient
  .emit("example_client", "example_command", {prop1: "prop1"})
  .then(() => {
    // Do something when message is successfully emitted to server (NOT emitted further by server do destination).
  })
;
```

<a name="typedefs"></a>

## Typedefs

<a name="module_ipcIO..parsed_message"></a>

### parsed_message : <code>object</code>
Object being parsed representation of message.

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> \| <code>null</code> | Client id, that server is tagging handshake message with. |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

<a name="module_ipcIO..parsed_message_array"></a>

### parsed_message_array : <code>Array.&lt;parsed_message&gt;</code>
Array of parsed messages

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..iface"></a>

### iface : <code>object</code>
Interface exposing connectivity to client/server handlers.

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| socket | <code>Socket</code> | Instance of net.Socket |
| server | <code>Server</code> | Instance of net.Server |

<a name="module_ipcIO..handler_container"></a>

### handler_container : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>string</code> | Message data |
| client_name | <code>string</code> | Friendly name of client/uuid if name not set. |
| socket | <code>Socket</code> | Instance of net.Socket |
| server | <code>Server</code> | Instance of net.Server |

<a name="module_ipcIO..handler_collection"></a>

### handler_collection : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type |
| --- | --- |
| command | <code>function</code> | 

<a name="module_ipcIO..server_constructor_options"></a>

### server_constructor_options : <code>object</code>
Object containing options that determine behavior of IpcIO.Server

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| verbose | <code>boolean</code> | When true, will feed console with current operations feedback. |
| domain | <code>string</code> | Namespace used for connection with all clients handshaking with this server. |
| encoding | <code>string</code> | Message buffer encoding, defaults to "utf8". |

<a name="module_ipcIO..client_constructor_options"></a>

### client_constructor_options : <code>object</code>
Object containing options that determine behavior of IpcIO.Client

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| verbose | <code>boolean</code> | When true, will feed console with current operations feedback. |
| name | <code>string</code> | Client friendly name, can be used to address client when emitting from server.. |
| domain | <code>string</code> | Namespace used for connection with all clients handshaking with this server. |
| encoding | <code>string</code> | Message buffer encoding, defaults to "utf8". |

