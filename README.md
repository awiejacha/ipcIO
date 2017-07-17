# ipcIO
Server and client for unix-domain-based inter-process-communication (IPC).

In this version served rather as a proof of handful concept, that allows to separate two nodejs (but not necessarily) processes without employing web servers or even TCP-based connectivity.
Provides some basic queueing, assuming that processes running on the same machine/environment do not require advanced (and resource consuming) message broker.

Early version, at this stage use just for fun/inspiration.
