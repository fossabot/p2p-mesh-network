import { Message, MessageType, MessageUid } from './interfaces';
import { DataConnection } from "peerjs";
import { interval, Subscription, Subject } from 'rxjs';

class MessageBuffer {
    public expectedIndex: number = 0;
    private bufferPosition: number = 0;
    public buffer: Message[] = [];

    public upperBufferIndex(): number {
        return this.bufferPosition * Connection.bufferSize + Connection.bufferSize;
    }

    public reset(): void {
        this.expectedIndex = 0;
        this.bufferPosition++;
        this.buffer = [];
    }
}

class sendMessageBuffer extends MessageBuffer {
    public ackReceived: boolean[] = [];
    public timers: { [messageIndex: number]: Subscription } = {};

    public canReset(): boolean {
        if (this.ackReceived.length < Connection.bufferSize) {
            return false;
        } else {
            for (let ack of this.ackReceived) {
                if (!ack) {
                    return false;
                }
            }

            return true;
        }
    }

    public reset(): void {
        if (!this.canReset()) {
            throw "This buffer cannot reset because not every message was acked.";
        }

        super.reset();

        for (let i = 0; i < this.ackReceived.length; i++) {
            this.ackReceived[i] = false;
        }
    }
}

interface Channel extends DataConnection {
    send(data: Message): void;
}

export class Connection {
    static readonly bufferSize: number = 10;
    static readonly maxMessageIndex: number = 10000;

    private readonly fromPeer: string;
    private readonly toPeer: string;
    get peer() { return this.toPeer; }
    private channel: Channel;
    private readonly sendBuffer: sendMessageBuffer = new sendMessageBuffer();
    private readonly receiveBuffer: MessageBuffer = new MessageBuffer();
    private messageIndex: number = 0;

    public readonly onMessageReceived: Subject<Message> = new Subject<Message>();

    constructor(fromPeer: string, dataConnection: DataConnection) {
        this.fromPeer = fromPeer;
        this.toPeer = dataConnection.peer;
        this.channel = dataConnection;

        // Triggered when data was received.
        this.channel.on('data', (message: Message) => {
            this.receive(message);
        });

        // Triggers when the connection was closed.
        this.channel.on('close', () => {
            console.log("Connection closed", this.channel);
            // this.handleLocalConnectionClosed(connection);
        });

        this.channel.on('error', error => {
            console.log(error);
        });
    }

    public sendMessage(message: Message): boolean {
        message.uid = this.generateMessageUid();
        return this.send(message);
    }
    
    private send(message: Message): boolean {
        if (!message) {
            return false; // If the message is undefined or null.
        }
        else {
            // Clear buffer if acks are received for all messages
            if (this.sendBuffer.canReset()) {
                this.sendBuffer.reset();
                console.log("Sendbuffer reset");
            }

            let messageIndex: number = message.uid.index;
            let bufferIndex: number = messageIndex % Connection.bufferSize;

            console.log("BufferIndex", bufferIndex);
            console.log("ExpectedIndex + Node.bufferSize ", this.sendBuffer.expectedIndex + Connection.bufferSize)

            if (
                bufferIndex >= this.sendBuffer.expectedIndex &&
                messageIndex < this.sendBuffer.upperBufferIndex()
            ) {
                this.sendBuffer.buffer[bufferIndex] = message;

                this.channel.send(this.sendBuffer.buffer[bufferIndex]);
                // Set timer for resending message if ack was not received.
                this.sendBuffer.timers[messageIndex] = interval(10000).subscribe(_ => {
                    this.channel.send(this.sendBuffer.buffer[bufferIndex]);
                });

                return true;
            }
        }

        return false;
    }

    private receive(message: Message): void {
        if (!message) {
            return;
        }
        // The message is an acknowledgement.
        else if (message.header.type == MessageType.ack) {
            console.log("Ack received for message", message.body);
            let body: MessageUid = <MessageUid>message.body;
            this.sendBuffer.ackReceived[body.index % Connection.bufferSize] = true;

            // TODO: check if storage can be avoided so that auto deletion of subscriptions can be done.
            this.sendBuffer.timers[body.index].unsubscribe();
            delete this.sendBuffer.timers[body.index];

            return;
        }

        // Sending acknowledgement.
        let ack: Message = this.generateAck(message.uid);
        this.channel.send(ack);
        console.log("Ack sent.", ack);

        let messageIndex: number = message.uid.index;
        let bufferIndex: number = messageIndex % Connection.bufferSize;

        // If index fits in buffer
        if (bufferIndex >= this.receiveBuffer.expectedIndex && messageIndex < this.receiveBuffer.upperBufferIndex()) {
            // Put message in buffer
            this.receiveBuffer.buffer[bufferIndex] = message;

            // Handle all messages that have been received in order
            for (
                this.receiveBuffer.expectedIndex;
                this.receiveBuffer.expectedIndex < Connection.bufferSize;
                this.receiveBuffer.expectedIndex++
            ) {
                if (this.receiveBuffer.buffer[this.receiveBuffer.expectedIndex]) {
                    this.onMessageReceived.next(
                        this.receiveBuffer.buffer[this.receiveBuffer.expectedIndex]
                    );

                    // Reset buffer if buffer is full
                    if (this.receiveBuffer.expectedIndex == Connection.bufferSize - 1) {
                        this.receiveBuffer.reset();
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }

    /**
	 * Generates a new message uid.
	 * @returns The new message uid.
	 */
    private generateMessageUid(): MessageUid {
        if (this.messageIndex > Connection.maxMessageIndex) {
            this.messageIndex = 0;
        }

        return {
            sourceNodeUuid: this.fromPeer,
            index: this.messageIndex++
        };
    }

    private generateAck(uid: MessageUid): Message {
        return {
            uid: {
                sourceNodeUuid: this.fromPeer,
                index: -1
            },
            header: {
                type: MessageType.ack
            },
            body: uid
        }
    }
}