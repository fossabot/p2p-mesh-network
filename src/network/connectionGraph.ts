export class ConnectionGraph {
    private address: string;
    
    private connections: Map<string, Set<string>> = new Map();

    constructor(address: string) {
        this.address = address;
        this.addNode(address);
    }

    public addNode(address: string) {
        if (!  this.connections.has(address)) {
            this.connections.set(address, new Set());
        }
    }

    public removeNode(address: string) {
        this.connections.delete(address);
    }
    
    public setNodeNeighbours(address: string, neighbours: string[]) {
        for (let neighbour of neighbours) {
            this.addNode(neighbour);
        }
        this.connections.set(address, new Set(neighbours));
    }
    
    public addConnection(source: string, destination: string): void {
        let sourceNeighbours: Set<string> = !this.connections.get(source) ? new Set() : this.connections.get(source)!;
        sourceNeighbours.add(destination);
        this.connections.set(source, sourceNeighbours);
        
        let destinationNeighbours: Set<string> = !this.connections.get(destination) ? new Set() : this.connections.get(destination)!;
        destinationNeighbours.add(source);
        this.connections.set(destination, destinationNeighbours);
    }

    public constructRoutingTree(): RoutingTreeNode {
        let root: RoutingTreeNode = {
            address: this.address,
            children: []
        };

        // Add the neighbours of this node to the candidates. 
        let visitedNodes: Set<string> = new Set(this.address);
        let candidates: [string, RoutingTreeNode][] = [];
        for (let neighbour of this.connections.get(this.address)!) {
            candidates.push([neighbour, root]);
        }

        // Keep looking at candidates for tree insertion untill none are over.
        while (candidates.length > 0) {
            let currentCandidate: [string, RoutingTreeNode] = candidates.shift()!;
            let currentNode: string = currentCandidate[0];
            let parentTreeNode: RoutingTreeNode = currentCandidate[1];

            // If node has not been handled before, add node to the tree.
            if (!visitedNodes.has(currentNode)) {
                visitedNodes.add(currentNode);

                // Add node to tree adding it to the referenced parent node.
                let currentTreeNode: RoutingTreeNode = {
                    address: currentNode,
                    children: []
                }
                parentTreeNode.children.push(currentTreeNode);

                // Add all neighbours of this node to the candidates.
                for (let neighbour of this.connections.get(currentNode)!) {
                    candidates.push([neighbour, currentTreeNode]);
                }
            }
        }

        return root;
    }
    
    private addToRoutingTable(nextHop: string, currentNode: RoutingTreeNode, routingTable: RoutingTable): void {
        routingTable[currentNode.address] = nextHop;

        for (let treeNode of currentNode.children) {
            this.addToRoutingTable(nextHop, treeNode, routingTable);
        }
    }
    
    public makeRoutingTable(): RoutingTable {
        let root: RoutingTreeNode = this.constructRoutingTree();

        let routingTable: RoutingTable = {};
        for (let treeNode of root.children) {
            this.addToRoutingTable(treeNode.address, treeNode, routingTable);
        }

        return routingTable;
    }

    // public test(): void {
    //     this.connections.set("a", new Set(["b", "c", "g"]));
    //     this.connections.set("b", new Set(["a", "c", "e"]));
    //     this.connections.set("c", new Set(["b", "a", "d"]));
    //     this.connections.set("d", new Set(["e", "c"]));
    //     this.connections.set("e", new Set(["b", "d", "f"]));
    //     this.connections.set("f", new Set(["e", "g"]));
    //     this.connections.set("g", new Set(["f", "a"]));

    //     console.log(this.constructRoutingTree());
    //     console.log(this.makeRoutingTable());
    // }
}

interface RoutingTreeNode {
    address: string,
    children: RoutingTreeNode[]
}

export interface RoutingTable {
    [address: string]: string
}