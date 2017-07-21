<a name="module_ipcIO"></a>

## ipcIO

* [ipcIO](#module_ipcIO)
    * _static_
        * [.Server](#module_ipcIO.Server)
            * [new IpcServer(options, handler_collection)](#new_module_ipcIO.Server_new)
            * [.verbose](#module_ipcIO.Server.IpcServer+verbose) : <code>boolean</code>
            * [.start()](#module_ipcIO.Server+start) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.addHandlers(handler_collection)](#module_ipcIO.Server+addHandlers) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.emit(client_name, command, data)](#module_ipcIO.Server+emit) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.broadcast(command, data)](#module_ipcIO.Server+broadcast) ⇒ <code>module:ipcIO.IpcServer</code>
        * [.Client](#module_ipcIO.Client)
            * [new IpcClient(options, handler_collection)](#new_module_ipcIO.Client_new)
            * [.verbose](#module_ipcIO.Client.IpcClient+verbose) : <code>boolean</code>
            * [.addHandlers(handler_collection)](#module_ipcIO.Client+addHandlers) ⇒ <code>module:ipcIO.IpcClient</code>
            * [.connect()](#module_ipcIO.Client+connect) ⇒ <code>module:ipcIO.IpcClient</code>
            * [.emit(command, data)](#module_ipcIO.Client+emit) ⇒ <code>module:ipcIO.IpcClient</code>
    * _inner_
        * [~parseMsg(message)](#module_ipcIO..parseMsg) ⇒ <code>parsed_message_array</code>
        * [~prepareMsg()](#module_ipcIO..prepareMsg) ⇒ <code>parsed_message</code>
        * [~executeCommandHandlers(uuid, client_name, iface, message)](#module_ipcIO..executeCommandHandlers)
        * [~addCommandHandler(command, handler)](#module_ipcIO..addCommandHandler)
        * [~addHandlers(handler_collection)](#module_ipcIO..addHandlers)
        * [~$onUniqueData(uuid, client_name, iface, buffer)](#module_ipcIO..$onUniqueData)
        * [~$onServerBcastCreation(bcastSocket)](#module_ipcIO..$onServerBcastCreation)
        * [~$onServerBcastData(uuid, bcastSocket, buffer)](#module_ipcIO..$onServerBcastData)
        * [~$onServerBcastClose(uuid)](#module_ipcIO..$onServerBcastClose)
        * [~$onServerBcastError(error)](#module_ipcIO..$onServerBcastError)
        * [~$onServerUniqueCreation(uuid, client_name, serverUniqueSocket)](#module_ipcIO..$onServerUniqueCreation)
        * [~$onServerUniqueClose(uuid, client_name)](#module_ipcIO..$onServerUniqueClose)
        * [~$onServerUniqueError(error)](#module_ipcIO..$onServerUniqueError)
        * [~spawnClientSocket()](#module_ipcIO..spawnClientSocket) ⇒ <code>Socket</code>
        * [~sendQueueEntry()](#module_ipcIO..sendQueueEntry)
        * [~handleQueue()](#module_ipcIO..handleQueue)
        * [~$onClientOffline()](#module_ipcIO..$onClientOffline)
        * [~$onClientBcastConnect()](#module_ipcIO..$onClientBcastConnect)
        * [~$onClientUniqueConnect()](#module_ipcIO..$onClientUniqueConnect)
        * [~parsed_message](#module_ipcIO..parsed_message) : <code>object</code>
        * [~parsed_message_array](#module_ipcIO..parsed_message_array) : <code>Array.&lt;parsed_message&gt;</code>
        * [~iface](#module_ipcIO..iface) : <code>object</code>
        * [~handler_container](#module_ipcIO..handler_container) : <code>object</code>
        * [~handler_collection](#module_ipcIO..handler_collection) : <code>object</code>
        * [~server_constructor_options](#module_ipcIO..server_constructor_options) : <code>object</code>

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
    * [.broadcast(command, data)](#module_ipcIO.Server+broadcast) ⇒ <code>module:ipcIO.IpcServer</code>

<a name="new_module_ipcIO.Server_new"></a>

#### new IpcServer(options, handler_collection)
Creates new instance of ipcIO Server.<br>
Each handler passed to handler_collection receives `handler_collection` as an argument.<br>
If no domain passed to options, domain named "default" is used.


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
**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  
<a name="module_ipcIO.Server+addHandlers"></a>

#### server.addHandlers(handler_collection) ⇒ <code>module:ipcIO.IpcServer</code>
Adds handlers at any time, regardless client state.s

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param |
| --- |
| handler_collection | 

<a name="module_ipcIO.Server+emit"></a>

#### server.emit(client_name, command, data) ⇒ <code>module:ipcIO.IpcServer</code>
Writes to client socket of given friendly name.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param | Type | Description |
| --- | --- | --- |
| client_name | <code>string</code> | Friendly name of client. |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

<a name="module_ipcIO.Server+broadcast"></a>

#### server.broadcast(command, data) ⇒ <code>module:ipcIO.IpcServer</code>
Writes to all client sockets within server domain.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

<a name="module_ipcIO.Client"></a>

### ipcIO.Client
Inter-Process-Communication Client

**Kind**: static class of [<code>ipcIO</code>](#module_ipcIO)  

* [.Client](#module_ipcIO.Client)
    * [new IpcClient(options, handler_collection)](#new_module_ipcIO.Client_new)
    * [.verbose](#module_ipcIO.Client.IpcClient+verbose) : <code>boolean</code>
    * [.addHandlers(handler_collection)](#module_ipcIO.Client+addHandlers) ⇒ <code>module:ipcIO.IpcClient</code>
    * [.connect()](#module_ipcIO.Client+connect) ⇒ <code>module:ipcIO.IpcClient</code>
    * [.emit(command, data)](#module_ipcIO.Client+emit) ⇒ <code>module:ipcIO.IpcClient</code>

<a name="new_module_ipcIO.Client_new"></a>

#### new IpcClient(options, handler_collection)
IpcClient constructor


| Param | Type |
| --- | --- |
| options | <code>object</code> | 
| handler_collection | <code>handler_collection</code> | 

<a name="module_ipcIO.Client.IpcClient+verbose"></a>

#### client.verbose : <code>boolean</code>
When true, will feed the console.

**Kind**: instance property of [<code>Client</code>](#module_ipcIO.Client)  
<a name="module_ipcIO.Client+addHandlers"></a>

#### client.addHandlers(handler_collection) ⇒ <code>module:ipcIO.IpcClient</code>
Adds handlers at any time, regardless client state.s

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param |
| --- |
| handler_collection | 

<a name="module_ipcIO.Client+connect"></a>

#### client.connect() ⇒ <code>module:ipcIO.IpcClient</code>
Connect client to the server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  
<a name="module_ipcIO.Client+emit"></a>

#### client.emit(command, data) ⇒ <code>module:ipcIO.IpcClient</code>
Puts command with data queue, calls queue handler.
Command is emitted immediately when there is connection established and previous entries become emitted.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

<a name="module_ipcIO..parseMsg"></a>

### ipcIO~parseMsg(message) ⇒ <code>parsed_message_array</code>
Takes message from other party and returns as prepared message.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type |
| --- | --- |
| message | <code>Buffer</code> \| <code>string</code> | 

<a name="module_ipcIO..prepareMsg"></a>

### ipcIO~prepareMsg() ⇒ <code>parsed_message</code>
Returns parsed_message depending how many arguments are passed to it.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..executeCommandHandlers"></a>

### ipcIO~executeCommandHandlers(uuid, client_name, iface, message)
Always called with "this" bound to either IpcServer or IpcClient instance.
Checks if "this" has handler for command carried by passed message registered. If so, handler is called.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type |
| --- | --- |
| uuid | <code>string</code> | 
| client_name | <code>string</code> | 
| iface | <code>iface</code> | 
| message | <code>parsed_message</code> | 

<a name="module_ipcIO..addCommandHandler"></a>

### ipcIO~addCommandHandler(command, handler)
Always called with "this" bound to either IpcServer or IpcClient instance.
Adds command handler to handler collection.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>string</code> | Command name. |
| handler | <code>function</code> | Handler function. |

<a name="module_ipcIO..addHandlers"></a>

### ipcIO~addHandlers(handler_collection)
Adds handlers grouped in collection.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param |
| --- |
| handler_collection | 

<a name="module_ipcIO..$onUniqueData"></a>

### ipcIO~$onUniqueData(uuid, client_name, iface, buffer)
On "data" event handler for IpcServer and IpcClient unique socket.
Always called with "this" bound to either IpcServer or IpcClient instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes. |
| client_name | <code>string</code> | Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes. |
| iface | <code>iface</code> | Interface containing socket instance and server instance. |
| buffer | <code>Buffer</code> | Data buffer received from remote party with "data" event. |

<a name="module_ipcIO..$onServerBcastCreation"></a>

### ipcIO~$onServerBcastCreation(bcastSocket)
On "connect" event handler for IpcServer broadcast socket creation callback.
Always called with "this" bound to IpcServer instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type |
| --- | --- |
| bcastSocket | <code>Socket</code> | 

<a name="module_ipcIO..$onServerBcastData"></a>

### ipcIO~$onServerBcastData(uuid, bcastSocket, buffer)
On "data" event handler for IpcServer handshake/broadcast socket.
Always called with "this" bound to IpcServer instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes. |
| bcastSocket | <code>Socket</code> | Socket used by IpcServer as handshaking/broadcast channel. |
| buffer | <code>Buffer</code> | Data buffer received from remote party with "data" event. |

<a name="module_ipcIO..$onServerBcastClose"></a>

### ipcIO~$onServerBcastClose(uuid)
On "close" event handler for IpcServer handshake/broadcast socket.
Always called with "this" bound to IpcServer instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes. |

<a name="module_ipcIO..$onServerBcastError"></a>

### ipcIO~$onServerBcastError(error)
On "error" event handler for IpcServer handshake/broadcast socket.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param |
| --- |
| error | 

<a name="module_ipcIO..$onServerUniqueCreation"></a>

### ipcIO~$onServerUniqueCreation(uuid, client_name, serverUniqueSocket)
On "connect" event handler for IpcServer unique socket creation callback.
Always called with "this" bound to IpcServer instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes. |
| client_name | <code>string</code> | Friendly name of client, if passed into client constructor,                                      otherwise UUDv4/wo dashes. |
| serverUniqueSocket | <code>Socket</code> | Socket used for 1 to 1 communication with each client. |

<a name="module_ipcIO..$onServerUniqueClose"></a>

### ipcIO~$onServerUniqueClose(uuid, client_name)
On "close" event handler for IpcServer client communication socket.
Always called with "this" bound to IpcServer instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param | Type | Description |
| --- | --- | --- |
| uuid | <code>string</code> | Unique id of socket used for 1 to 1 communication with server, UUDv4/wo dashes. |
| client_name | <code>string</code> | Friendly name of client, if passed into client constructor, otherwise UUDv4/wo dashes. |

<a name="module_ipcIO..$onServerUniqueError"></a>

### ipcIO~$onServerUniqueError(error)
On "error" event handler for IpcServer client communication socket.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  

| Param |
| --- |
| error | 

<a name="module_ipcIO..spawnClientSocket"></a>

### ipcIO~spawnClientSocket() ⇒ <code>Socket</code>
Spawns socket and returns it with already assigned offline behavior related handler.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..sendQueueEntry"></a>

### ipcIO~sendQueueEntry()
Checks if there is possibility to successfully write queue entry to socket.
If so, writes to socket and initialized writing next entry, when socket is able to respond with response.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..handleQueue"></a>

### ipcIO~handleQueue()
Checks if there is possibility to successfully emit messages. If so, begins emitting process.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..$onClientOffline"></a>

### ipcIO~$onClientOffline()
On "finish", "close", "error" events handler for IpcClient communication sockets.
Always called with "this" bound to IpcClient instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..$onClientBcastConnect"></a>

### ipcIO~$onClientBcastConnect()
On "connect" event handler for IpcClient handshake/broadcast socket callback.
Always called with "this" bound to IpcClient instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..$onClientUniqueConnect"></a>

### ipcIO~$onClientUniqueConnect()
On "connect" event handler for IpcClient unique socket callback.
Always called with "this" bound to IpcClient instance.

**Kind**: inner method of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..parsed_message"></a>

### ipcIO~parsed_message : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> \| <code>null</code> | Client id, that server is tagging handshake message with. |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |

<a name="module_ipcIO..parsed_message_array"></a>

### ipcIO~parsed_message_array : <code>Array.&lt;parsed_message&gt;</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..iface"></a>

### ipcIO~iface : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| socket | <code>Socket</code> | Instance of net.Socket |
| server | <code>Server</code> | Instance of net.Server |

<a name="module_ipcIO..handler_container"></a>

### ipcIO~handler_container : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>string</code> | Message data |
| client_name | <code>string</code> | Friendly name of client/uuid if name not set. |
| socket | <code>Socket</code> | Instance of net.Socket |
| server | <code>Server</code> | Instance of net.Server |

<a name="module_ipcIO..handler_collection"></a>

### ipcIO~handler_collection : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type |
| --- | --- |
| command | <code>function</code> | 

<a name="module_ipcIO..server_constructor_options"></a>

### ipcIO~server_constructor_options : <code>object</code>
**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| verbose | <code>boolean</code> | When true, will feed console with current operations feedback. |
| domain | <code>string</code> | Namespace used for connection with all clients handshaking with this server. |
| encoding | <code>string</code> | Message buffer encoding, defaults to "utf8". |

