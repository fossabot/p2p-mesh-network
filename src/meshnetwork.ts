import { Message, MessageQueue, MessageType } from './interfaces';
import { Connection } from './connection';

import { ReactiveQueue } from './Reactive/ReactiveQueue';

import Peer, { DataConnection } from "peerjs";

export class Node {
    /* Max number of concurrent connections this node can have. */
    static readonly maxConnections: number = 10;
	/* Number of concurrent connections this node will try to maintain.
	 * Below this number, the node will initiate connections to other nodes.
	 * Above this number, the node may accept new connections until maxConnections is reached
	 * but the node will not initiate the connections.
	 */
    static readonly minConnections: number = 3;

    private localConnections: { [connection: string]: Connection } = {};

    private messageQueue: MessageQueue = {
        sendQueue: new ReactiveQueue<Message>(),
        receiveQueue: new ReactiveQueue<Message>()
    }
    
    // private graph = new ConnectionGraph();

    private peer: Peer | undefined = undefined;
    private readonly uuid: string;

    public onMessageReceived: ((source: string, msg: any) => void) = function (source: string, msg: any) { };
    public onConnectedToBroker: ((localId: string) => void) = function (localId: string) { };
    public onUserJoin: ((user: string) => void) = function (user: string) { };
    public onUserDisconnect: ((user: string) => void) = function (user: string) { };

    constructor() {
        this.uuid = this.generateUuidv4();

        // Subscribe to the queues.
        this.messageQueue.sendQueue.onAdd.subscribe((message: Message) => {
            let sent: boolean = this.broadcastMessage(message);
            if (sent) {
                this.messageQueue.sendQueue.pop();
            }
        })
        
        // this.graph.handleUserJoin = (user: string) => { this.onUserJoin(user); };
        // this.graph.handleUserDisconnect = (user: string) => { this.onUserDisconnect(user); };
    }

	/**
	 * Connects this node to the network and sets several callbacks.
     * 
     * When given a peerId this node is connected to the node associated with
     * that peerId.
     * 
	 * @param {string} remotePeerId The peerId of the node to which a connection will be made.
	 * @throws Error when a connection already exists.
	 */
    public connect(remotePeerId?: string): void {
        // Do not let the peer connect to a different network if it is
        // already connected to one.
        if (this.peer) {
            throw Error("This peer is already connected to a network!");
        }

        this.peer = new Peer(this.uuid, {
            // secure: true,
            host: 'localhost',
            key: 'peerjs',
            port: 9000,
            // debug: 3,
            // config: {
            //     'iceServers': [
            //         { urls: 'stun:stun1.l.google.com:19302' }
            //     ]
            // }
        });

        // Triggered when a connection to the PeerServer is established.
        this.peer.on('open', id => {
            if (this.peer) {
                console.log("The peerId is:", id)
            }
            console.log("The uuid is:", this.uuid);
            this.onConnectedToBroker(id);
        });

        // Triggered when an error occurred in the underlying socket or in PeerConnections
        this.peer.on('error', err => {
            throw Error(err);
        });

        // Triggered when a remote peer connects to local.
        this.peer.on('connection', connection => {
            this.handleNewLocalConnection(connection);
        });

        // Connect to initial remote peer.
        if (remotePeerId && remotePeerId != "") {
            this.createNewConnection(remotePeerId);
        }
    }

    // TODO: Write documentation.
    private createNewConnection(remotePeerId: string): void {
        if (!this.peer) {
            throw new Error("No connection has yet been made to the PeerServer.");
        }
        
        let connection: DataConnection = this.peer.connect(remotePeerId, {
            "reliable": true,
        });

        // Triggered when the connection is established.
        connection.on('open', () => {
            this.handleNewLocalConnection(connection);
        });
    }

    public sendData(data: any): void {
        let message: Message = {
            uid: {
                index: -1,
                sourceNodeUuid: ""
            },
            header: {
                type: MessageType.msg_broadcast,
            },
            body: data
        }

        this.messageQueue.sendQueue.push(message);
        console.log("Put message in queue", message);
    }

    private broadcastMessage(message: Message): boolean {
        if (this.peer) {
            for (let peerId in this.localConnections) {
                this.localConnections[peerId].sendMessage(message);
                console.log("message sent", message);
            }

            return true;
        }

        return false;
    }

//     public broadcastMessage(data: string): void {
//         this.broadcastMessageToLocalPeers({
//             uid: {
//                 src: this.peerId,
//                 i: this.messageCounter
//             },
//             header: {
//                 type: MessageType.msg_broadcast,
//             },
//             body: data
//         })
//     }

//     public mulitcastMessage(destinations: any, data: Message): void {
//         // TODO: multicast works like broadcast right now.
//         // This should be optimized by calculating a path towards the goal peer
//         // and sending the message through the optimal local peer only. This would
//         // reduce traffic significantly.
//         this.mulitcastMessageToLocalPeers(
//             Object.values(this.localConnections)
//         )
//     }

//     public unicastMessage(destination: string, data: string) {
//         this.mulitcastMessage([destination], data);
//     }

//     private multicastMessageToLocalPeers(destinations: DataConnection[], msg: Message) {
//         msg.uid = this.generateMessageUid();

//         for (var i = destinations.length - 1; i >= 0; i--) {
//             let connection = destinations[i];
//             connection.send(msg);
//         }
//     }

//     private broadcastMessageToLocalPeers(message: Message, blacklistedConnections: DataConnection[] = []): void {
//         message.uid = this.generateMessageUid();

//         let connections: DataConnection[] = Object.values(this.localConnections);
//         for (let i = connections.length - 1; i >= 0; i--) {
//             let connection = connections[i];
//             if (!blacklistedConnections.includes(connection)) {
//                 connection.send(message);
//             }
//         }
//     }

// 	/**
// 	 * Send a message to all local peers except the sourceConnection
// 	 * without setting the message id. This is used to forward broadcast
// 	 * messages.
// 	 * @param msg The message to forward.
// 	 * @param sourceConnection The connection where the original message came from.
// 	 */
//     private forwardMessageToLocalPeers(msg: Message, sourceConnection: DataConnection) {
//         for (let i = this.localConnections.length - 1; i >= 0; i--) {
//             let connection = this.localConnections[i];
//             if (sourceConnection != connection) {
//                 connection.send(msg);
//             }
//         }
//     }
/***/

    // TODO: Write documentation
    private handleMessage(message: Message): void {
        if (!message) {
            console.error("The message does not exist.");
            return;
        }

        switch (message.header.type) {
            case MessageType.ack:
                
                break;
            case MessageType.new_edge:
                if (message.header.targetPeer != undefined) {
                    // this.graph.addConnection(message.sourcePeer, message.targetPeer)
                    // this.forwardMessageToLocalPeers(message, srcNode);
                }
                break;
            // case MessageType.destroy_edge:
                // if (message.header.targetPeer != undefined) {
                    // this.graph.removeConnection(message.sourcePeer, message.targetPeer);
                    // this.forwardMessageToLocalPeers(message, srcNode);
                // }
                // break;
            // case MessageType.network_state_request:
                // let reply: Message = {
                //     uid: this.generateMessageUid(),
                //     header: {
                //         type: MessageType.network_state,
                //     },
                    // body: this.graph.serialize()
                // }
                // this.multicastMessageToLocalPeers([srcNode], reply);
            //     break;
            // case MessageType.network_state:
                // this.graph.mergeSerialized(message.network);
                // break;
            case MessageType.msg_broadcast:
                // this.forwardMessageToLocalPeers(message, srcNode);
                    this.onMessageReceived(message.uid.sourceNodeUuid, message.body);
                break;
            case MessageType.msg:
                // TODO: multicast works like broadcast right now.
                // this.forwardMessageToLocalPeers(message, srcNode);
                if (message.header.targetPeer == this.uuid) {
                    this.onMessageReceived(message.uid.sourceNodeUuid, message.body);
                }
                break;
        }
    }

	/**
     * Handles a new connection to this peer.
     * 
     * Adds the new connection to the list of local connections and adds the
     * right callbacks. Also lets the connection graph know a new connection
     * has been made.
	 * @param connection The new connection.
	 */
    private handleNewLocalConnection(dataConnection: DataConnection): void {
        // this.graph.addConnection(this.peerId, connection.peer);

        let connection: Connection = new Connection(this.uuid, dataConnection);
        this.localConnections[connection.peer] = connection;
        this.onUserJoin(connection.peer);
        console.log("Connection established between peers.");
        console.log("   this peer: ", this.uuid);
        console.log("   other peer: ", connection.peer);
        console.log("   connection: ", connection)
        
        // this.broadcastMessageToLocalPeers({
        //     type: MessageType.new_edge,
        //     sourcePeer: this
        // })

        connection.onMessageReceived.subscribe((message: Message) => this.handleMessage(message));
    }

//     private handleLocalConnectionClosed(connection: DataConnection): void {
//         this.graph.removeConnection(this.peerId, connection.peer);
//         delete this.localConnections[connection.peer];
//         this.broadcastMessageToLocalPeers({
//             type: MessageType.destroy_edge,
//             sourcePeer: this.peerId,
//             targetPeer: connection.peer
//         }, [connection]);
//     }

    /**
     * Generates a global unique identifier.
     * @returns A global unique identifier.
     */
    private generateUuidv4(): string {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c: string) {
            let d: number = (c as unknown) as number;
            return (d ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> d / 4).toString(16);
        })
    }
}