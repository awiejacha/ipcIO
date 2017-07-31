<a name="start"></a>

# ipcIO

Server and client for unix-domain-based inter-process-communication (IPC).

<a name="scary"></a>

## Sounds scary. What does it do to my project?

Provides layer of connectivity, conducted in the same favor as unix processes use to communicate. This is called the __Inter Process Communication (IPC)__.

Basic nodejs *net* library, literally *net.Server* and *net.Socket*, can, aside "regular" TCP sockets, provide the same functionality. To be honest, *ipcIO* uses them underneath.

So...

> What makes this package worth attention, is the way of dealing with *handlers*, (special functions passed to *ipcIO* server or client classes) and asynchronicity, and message delivering.

<a name="can"></a>

## ipcIO can:

* Free You from declaring event handlers in callbacks at client or server instantiation,
* organize communication in tidy command messages,
* queue client messages when server is unavailable or is being restarted,
* send messages from client to server,
* emit messages from server to client or from client to other client,
* broadcast messages from server or client to all clients in server's domain,
* deliver messages (send with async receive confirmation and result feedback),
* show others that I'm valuable and creative programmer ;) .

<a name="can_not"></a>

## ipcIO can not:

* Be used with Windows domain sockets,
* in general, use socket communication other than Unix domain,
* so, no TCP, UDP, Web sockets,
* and it can not write whole app for you (shame on it!).

* [ipcIO](#start)
    * [What it is](#scary)
    * [What it can do](#can)
    * [What it con not do](#can_not)
* [Jump-in tutorial](#jump_in_tutorial)
* [Overview](#overview)
    * [Callback-free setup](#callback_free_setup)
    * [Working with commands](#working_with_commands)
        * [Server methods](#server_methods)
        * [Client methods](#client_methods)
    * [Message queuing](#message_queue_demo)
    * __[Message delivery](#message_delivery)__
* [API reference](#api)

<a name="jump_in_tutorial"></a>

# Jump-in tutorial

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

      // Send command by calling ipcio server instance...
      exampleServer.emit(container.name, "example_response_command", "example response data");
    },
    other_request_command: (container) => {
      console.log("Other command handler triggered.");
      console.log(`Client name: ${container.name}`);
      console.log(`Receiving data: ${container.data}`);

      let clientSocket = container.socket;

      // ...or by calling client socket instance.
      clientSocket.writeCommand("other_response_command", "other response data");
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

<a name="overview"></a>

# Overview

Because jump-in tutorials show everything but explain nothing, here's the overview of features.

<a name="callback_free_setup"></a>

## Callback-free setup

When instantiating client or server, instead of being overruled by pattern typical to nodejs connectivity solutions), e.g....
```js
const server = net.createServer((socket) => {

  // On socket creation actions go here.
})
.on("data", (buffer) => {

  // Handle data buffer.
})
;

server.listen(() => {
  console.log("server listening on", server.address());
});
```
...you can use class-oriented pattern and benefit from its tidiness, like example below:

```js
const exampleServer = new ipcio.Server(

  // First argument is a set of options.
  {
    domain: "example_domain",
  },

  // Second argument to constructor is a handler collection
  // that we want to inject on instantiation.
  // If we need to do it here or not - that depends only on the needs and design.
  {
    example_request_command: (container) => {
      console.log(`Receiving data: ${container.data}`);
      exampleServer.emit(container.name, "example_response_command", "example response data");
    },
  }
);
```

During time our app does some actions. If there is still no need, server does not have to be started immediately after instantiation.
We start our server, when we decide that it is time. Pass server instance anywhere in your code, where you want to start it, and:

```js
if (!exampleServer.isStarted()) {
  exampleServer.start();
}
```

All handlers registered on instantiation will work from server start.
If at some point of time there will be need to add handler for other command, we simply do it.

```js
exampleServer.addHandlers(
  {
    latter_request_command: (container) => {
      console.log(`Receiving data: ${container.data}`);
      exampleServer.emit(container.name, "latter_response_command", "example response data");
    },

    // And others...
  }
);
```

<a name="working_with_commands"></a>

## Working with commands

*Command* is a message type that *ipcIO* is using. Commands are sent / emitted / delivered by parties along with data carried with it.

IpcIO message consists of:

* *command name*, that is of your invention. It is good when command names are not confusing and briefly describes what they are responsible for. There are some restricted command names however:
```js
[ "handshake", "discover", "broadcast", "emit", "deliver", "error" ]
```

* *data* which can be any JSON serializable data,

* *id* which is *client name* of party that message is addressed to.

Typical communication-responsible method of ipcIO client or server require passing command name and data to be carried arguments. It looks as follows (assuming that client and server are instantiated as *client* and *server*):

<a name="server_methods"></a>

### Server methods (return server instance):

```js
function someServerConnectivity() {
  server

    // Will emit command with carried data to client given "client1" name.
    // Args: client name, command name, data.
    .emit("client1", "commandName1", {
      data: "some_data",
    })

    // Will broadcast command to all clients in server's domain.
    // Args: command name, data.
    .broadcast("commandName1", {
      data: "some_data",
    })
  ;
}
```

<a name="client_methods"></a>

### Client methods (return promises):

```js
function someClientConnectivity() {

  // Will emit command with carried data to client given "client1" name.
  // Args: client name, command name, data.
  client.emit("client1", "commandName1", {
      data: "some_data",
    }).then(() => {

	  // "commandName1" is successfully received by server for emit to "client1".
	  // It does not mean that "client1" received and processed it yet.
	  // If there is need to confirm that request got processed by client, @see IpcIO.Client#deliver.
    })
  ;

  // Will broadcast command to all clients in server's domain
  // (except this client).
  // Args: command name, data.
  client.broadcast("commandName1", {
      data: "some_data",
    }).then(() => {

	  // "commandName1" is successfully received by server for broadcast.
	  // It does not mean that broadcast action is complete
	  // and client processed the message.
    })
  ;

  // Will get information about command handlers registered to server
  // and clients in server's domain.
  // Args: none.
  client.discover().then((feedback) => {
    console.log(feedback); // {handlers: ["command1"], clients: ["client1"]}
  });

  // Will deliver command with carried data to client given "client1" name
  // and will deliver back delivery confirmation along with request processing
  // feedback.
  // Note: calling without client name, will deliver to the server.
  // Args: client name, command name, data.
  client.deliver("client1", "commandName1", {
      data: "some_data",
    }).then((feedback) => {
      console.log(`We know that delivery is confirmed and we have a ${feedback}.`);
    })
  ;

}
```

Or, same as above, with async/await:

```js
async function someClientConnectivity() {
  await client.emit("client1", "commandName1", {
    data: "some_data",
  });

  await client.broadcast("commandName1", {
    data: "some_data",
  });

  let discoveryFeedback = await client.discover();
  console.log(discoveryFeedback);

  let deliveryFeedback = await client.deliver("client1", "commandName1", {
    data: "some_data",
  });
  console.log(`We know that delivery is confirmed and we have a ${deliveryFeedback}.`);
}
```

<a name="message_queue_demo"></a>

## Client message queue demo

It is possible to emit messages when there is no connection between server and client. Of course, emit will happen once connection is (re)established. By that time, messages are queued on client side.
To see how it works, let's follow this example:

* Instantiate "producer" client and request to connect it to server.

```js
const producerClient = new ipcio.Client({
  name: "producer",
  domain: "test",
});

producerClient.connect().then(() => {
  console.log("Producer client has just been connected.");
});
```

* Instantiate server.

```js
const server = new ipcio.Server({
    domain: "test",
});
```

* Add handler for "databaseRequest" command to server.

```js
server.addHandlers({
  databaseRequest: (container) => { // {command: function(container)}

    // @typedef {object} container
    // @property {string} data    Message data
    // @property {string} name    Friendly name of client/uuid if name not set.
    // @property {Socket} socket  Instance of net.Socket

    // Pseudo code
    validateRequest(container.data);
    database.query(container.data).then((result) => {

      // Args: client name, command name, data to be emitted
      server.emit(container.name, "databaseResponse", result);
    });
  },
});
```

As you might probably notice, "databaseRequest" handler calls server to emit "databaseResponse" command.

* Register handler for "databaseResponse" at "producer" client.

```js
producerClient.addHandlers({
  databaseResponse: (container) => {
    // Pseudo code
    validateResponse(container.data);
    doSomethingWithData();
  },
});
```

* Once we have everything set, we can just start sending messages to server.

```js
producerClient.send("databaseRequest", {
  what_kind: "query",
  for_what: "some data from db",
});
```

* Start server.
```js
server.start();
```

As server is started, you can see that all messages are being sent / emitted / delivered.

Well... intentional server start delay does not sound reasonable (except such demos like above, to explain how queueing works), but, queueing becomes handful when we have modules that want to send some information during server module restart. Or, when we have some module that wants to send or receive some data *before* connectivity is up, and it can wait for it.

<a name="message_delivery"></a>

## Message delivery

Ever wanted to asynchronously receive confirmation that your request has been delivered, most likely with response? Sounds like old commercial, but delivery is exactly what it promises.
In order to show delivery in action, let's incorporate working example from message queue demo.
All we need is to change, is code of server handler for "databaseRequest", from

```js
server.addHandlers({
  databaseRequest: (container) => {

    // Pseudo code
    validateRequest(container.data);
    database.query(container.data).then((result) => {
      server.emit(container.name, "databaseResponse", result);
    });
  },
});
```

to

```js
server.addHandlers({
  databaseRequest: (container) => {

    // Pseudo code
    validateRequest(container.data);

    return database.query(container.data);
  },
});

```

It is enough to *return* result instead of emitting it back (regardless if we return a promise or some synchronously obtained result). Result of promise will be delivered back, once promise is settled, synchronous result will be delivered back instantly (keeping in mind that connection is established).

In other words, now, when we execute client *deliver* method:

```js
client.deliver("client1", "databaseRequest", {
  what_kind: "query",
  for_what: "some data from db",
}).then((feedback) => {
  console.log(`We know that delivery is confirmed and we have a ${feedback}.`);
});
```

<a name="api"></a>

# API reference

<a name="module_ipcIO"></a>

* [ipcIO](#module_ipcIO)
    * _static_
        * [.Server](#module_ipcIO.Server)
            * [new IpcServer(options, handler_collection)](#new_module_ipcIO.Server_new)
            * [.verbose](#module_ipcIO.Server.IpcServer+verbose) : <code>boolean</code>
            * [.isStarted()](#module_ipcIO.Server+isStarted) ⇒ <code>boolean</code>
            * [.start()](#module_ipcIO.Server+start) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.addHandlers(handler_collection)](#module_ipcIO.Server+addHandlers) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.emit(client_name, command, data, delivery)](#module_ipcIO.Server+emit) ⇒ <code>module:ipcIO.IpcServer</code>
            * [.broadcast(command, data, initiator_client)](#module_ipcIO.Server+broadcast) ⇒ <code>module:ipcIO.IpcServer</code>
        * [.Client](#module_ipcIO.Client)
            * [new IpcClient(options, handler_collection)](#new_module_ipcIO.Client_new)
            * [.verbose](#module_ipcIO.Client.IpcClient+verbose) : <code>boolean</code>
            * [.isConnected()](#module_ipcIO.Client+isConnected) ⇒ <code>boolean</code>
            * [.isStarted()](#module_ipcIO.Client+isStarted) ⇒ <code>boolean</code>
            * [.addHandlers(handler_collection)](#module_ipcIO.Client+addHandlers) ⇒ <code>module:ipcIO.IpcClient</code>
            * [.connect()](#module_ipcIO.Client+connect) ⇒ <code>Promise</code>
            * [.send(command, data, delivery)](#module_ipcIO.Client+send) ⇒ <code>Promise</code>
            * [.discover()](#module_ipcIO.Client+discover) ⇒ <code>Promise</code>
            * [.broadcast(command, data)](#module_ipcIO.Client+broadcast) ⇒ <code>Promise</code>
            * [.emit(client_name, command, data)](#module_ipcIO.Client+emit) ⇒ <code>Promise</code>
            * [.deliver(client_name, command, data)](#module_ipcIO.Client+deliver) ⇒ <code>Promise</code>
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
    * [.isStarted()](#module_ipcIO.Server+isStarted) ⇒ <code>boolean</code>
    * [.start()](#module_ipcIO.Server+start) ⇒ <code>module:ipcIO.IpcServer</code>
    * [.addHandlers(handler_collection)](#module_ipcIO.Server+addHandlers) ⇒ <code>module:ipcIO.IpcServer</code>
    * [.emit(client_name, command, data, delivery)](#module_ipcIO.Server+emit) ⇒ <code>module:ipcIO.IpcServer</code>
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
<a name="module_ipcIO.Server+isStarted"></a>

#### server.isStarted() ⇒ <code>boolean</code>
Checks if server is started.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  
**Returns**: <code>boolean</code> - True when server is started via IpcIO.Server#start() call.  
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

#### server.emit(client_name, command, data, delivery) ⇒ <code>module:ipcIO.IpcServer</code>
Writes to client socket of given friendly name.

**Kind**: instance method of [<code>Server</code>](#module_ipcIO.Server)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| client_name | <code>string</code> |  | Friendly name of client. |
| command | <code>string</code> \| <code>null</code> |  | Command description. |
| data | <code>string</code> \| <code>null</code> |  | Data carried by message. |
| delivery | <code>string</code> \| <code>null</code> | <code>null</code> | Id of delivery of message that needs to be confirmed with response data.                                Practically used with COMMAND_DELIVER. |

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
    * [.isConnected()](#module_ipcIO.Client+isConnected) ⇒ <code>boolean</code>
    * [.isStarted()](#module_ipcIO.Client+isStarted) ⇒ <code>boolean</code>
    * [.addHandlers(handler_collection)](#module_ipcIO.Client+addHandlers) ⇒ <code>module:ipcIO.IpcClient</code>
    * [.connect()](#module_ipcIO.Client+connect) ⇒ <code>Promise</code>
    * [.send(command, data, delivery)](#module_ipcIO.Client+send) ⇒ <code>Promise</code>
    * [.discover()](#module_ipcIO.Client+discover) ⇒ <code>Promise</code>
    * [.broadcast(command, data)](#module_ipcIO.Client+broadcast) ⇒ <code>Promise</code>
    * [.emit(client_name, command, data)](#module_ipcIO.Client+emit) ⇒ <code>Promise</code>
    * [.deliver(client_name, command, data)](#module_ipcIO.Client+deliver) ⇒ <code>Promise</code>

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
      // @property {string} data   Message data
      // @property {string} name   Friendly name of client/uuid if name not set.
      // @property {Socket} socket Instance of net.Socket

      // Do handler logic here.
    },
  })
;
```
<a name="module_ipcIO.Client.IpcClient+verbose"></a>

#### client.verbose : <code>boolean</code>
When true, will feed the console.

**Kind**: instance property of [<code>Client</code>](#module_ipcIO.Client)  
<a name="module_ipcIO.Client+isConnected"></a>

#### client.isConnected() ⇒ <code>boolean</code>
Checks if client is connected.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  
**Returns**: <code>boolean</code> - True when connection is established.  
<a name="module_ipcIO.Client+isStarted"></a>

#### client.isStarted() ⇒ <code>boolean</code>
Checks if client is started by calling IpcIO.Client#connect().

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  
**Returns**: <code>boolean</code> - True when connected or attempting to (re)connect.  
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
    // @property {string} data   Message data
    // @property {string} name   Friendly name of client/uuid if name not set.
    // @property {Socket} socket Instance of net.Socket

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

#### client.send(command, data, delivery) ⇒ <code>Promise</code>
Puts command with data queue, calls queue handler.<br>
Command is sent immediately to server when there is connection established and previous entries become sent.<br>
Returned promise is fulfilled when message was successfully received by server.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| command | <code>string</code> \| <code>null</code> |  | Command description |
| data | <code>string</code> \| <code>null</code> |  | Data carried by message |
| delivery | <code>string</code> \| <code>null</code> | <code>null</code> | Id of delivery of message that needs to be confirmed with response data.                                Practically used with COMMAND_DELIVER. |

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
| client_name | <code>string</code> | Friendly name of client |
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
<a name="module_ipcIO.Client+deliver"></a>

#### client.deliver(client_name, command, data) ⇒ <code>Promise</code>
Requests server to write command, to client with name given as first argument.<br>
Command write is then confirmed, using reserved deliver command, when command processing is finished
on the remote side and delivered back to requester client.<br>
When client_name is omitted, deliver is performed to server.
Command is emitted immediately when there is connection established and previous entries become emitted.<br>
Returned promise is fulfilled when message was successfully received and processed by destination party.

**Kind**: instance method of [<code>Client</code>](#module_ipcIO.Client)  

| Param | Type | Description |
| --- | --- | --- |
| client_name | <code>string</code> | Friendly name of client |
| command | <code>string</code> \| <code>null</code> | Command description |
| data | <code>string</code> \| <code>null</code> | Data carried by message |

**Example**  
```js
const exampleClient = new ipcio.Client({
  // Client instantiation options
});

// Some code...

exampleClient
  .deliver("example_client", "example_command", {prop1: "prop1"})
  .then((feedback) => {
    console.log(`We know that delivery is confirmed and we have a ${feedback}.`);
  })
;
```

<a name="typedefs"></a>

## Typedefs

<a name="module_ipcIO..parsed_message"></a>

### ipcIO~parsed_message : <code>object</code>
Object being parsed representation of message.

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> \| <code>null</code> | Client id, that server is tagging handshake message with. |
| command | <code>string</code> \| <code>null</code> | Command description. |
| data | <code>string</code> \| <code>null</code> | Data carried by message. |
| delivery | <code>string</code> \| <code>null</code> | Delivery id |

<a name="module_ipcIO..parsed_message_array"></a>

### ipcIO~parsed_message_array : <code>Array.&lt;parsed_message&gt;</code>
Array of parsed messages

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
<a name="module_ipcIO..iface"></a>

### ipcIO~iface : <code>object</code>
Interface exposing connectivity to client/server handlers.

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
Object containing options that determine behavior of IpcIO.Server

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| verbose | <code>boolean</code> | When true, will feed console with current operations feedback. |
| domain | <code>string</code> | Namespace used for connection with all clients handshaking with this server. |
| encoding | <code>string</code> | Message buffer encoding, defaults to "utf8". |

<a name="module_ipcIO..client_constructor_options"></a>

### ipcIO~client_constructor_options : <code>object</code>
Object containing options that determine behavior of IpcIO.Client

**Kind**: inner typedef of [<code>ipcIO</code>](#module_ipcIO)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| verbose | <code>boolean</code> | When true, will feed console with current operations feedback. |
| name | <code>string</code> | Client friendly name, can be used to address client when emitting from server.. |
| domain | <code>string</code> | Namespace used for connection with all clients handshaking with this server. |
| encoding | <code>string</code> | Message buffer encoding, defaults to "utf8". |
