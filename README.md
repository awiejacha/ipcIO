# ipcIO
Server and client for unix-domain-based inter-process-communication (IPC).

# Sounds scary. What does it do to my project?
Provides layer of connectivity, conducted in the same favor as unix processes use to communicate. This is called the __Inter Process Communication (IPC)__.
Basic nodejs *net* library, literally *net.Server* and *net.Socket*, can, aside "regular" TCP sockets, provide the same functionality. To be honest, *ipcIO* uses them underneath.
What makes this package worth attention, is the way of dealing with *handlers*, special functions passed to *net* classes and asynchronicity.
Using *ipcIO*, it becomes easy to add handler at any moment of *ipcIO* server or client lifetime.
It is possible to emit or broadcasts commands by just calling *ipcIO* `emit` or `broadcast` functionality from outside instance scope.
Servers create, within their __domain__ two levels of connectivity. First one is used to handshake and broadcast to all clients in domain, second is unique to each server-client pair.
Much influence for me gave me __SocketIO__ project. Hence the name?

# Jump-in tutorial

* Install package:

`$ npm install ipcio`

* Create server code, let's name it `test-server.js`:

```javascript
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

exampleServer.start();
```

* Create client code, name file something like `test-client.js`:

```javascript
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

exampleClient.connect();

setInterval(() => {
  exampleClient.emit("example_request_command", "example request data");
}, 7331);

setInterval(() => {
  exampleClient.emit("other_request_command", "other request data");
}, 1338);
```

* Run and watch them run!

`$ node test-server`
`$ node test-client`
