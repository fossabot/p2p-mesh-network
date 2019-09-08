import { Node } from "../../node";

describe('Node', () => {
    it('should be true', () => {
        expect(true).toBe(true);
    });
    
    it('should have the same address as received from the server', () => {
        const obj = new Node();
        obj.onConnectedToNetwork = function(address: string) {
            expect(address).toBe(obj.address);
        };
    });
});