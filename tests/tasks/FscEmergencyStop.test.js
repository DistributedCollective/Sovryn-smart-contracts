const assert = require("assert");
const { ethers } = require("hardhat");
const { stopOperation } = require("../../hardhat/tasks/fsc-emergency-stop");
describe("collector emergency stop", function () {
    it("targets only the proxy itself with zero value", function () {
        const p = "0x" + "11".repeat(20);
        const op = stopOperation(ethers, p);
        assert.equal(op.to, p);
        assert.equal(op.value, 0);
        assert.equal(op.data, "0xd784d426" + "0".repeat(24) + p.slice(2));
    });
});
