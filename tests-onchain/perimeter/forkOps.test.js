const { expect } = require("chai");
const { ethers } = require("hardhat");
const forkOps = require("./forkOps");

describe("forkOps adapter", () => {
    it("detects the node kind and can impersonate, fund, warp and mine", async () => {
        if (!hre.network.tags["forked"]) throw new Error("run on rskForkedMainnet");
        const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
        const kind = await forkOps.detectForkKind(provider);
        expect(["hardhat", "anvil", "tenderly"]).to.include(kind);
        const who = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
        const signer = await forkOps.impersonate(provider, who);
        expect((await signer.getBalance()).gte(ethers.utils.parseEther("10"))).to.be.true;
        const t0 = (await provider.getBlock("latest")).timestamp;
        await forkOps.increaseTime(provider, 3600);
        expect((await provider.getBlock("latest")).timestamp).to.be.gte(t0 + 3600);
        const b0 = await provider.getBlockNumber();
        await forkOps.mine(provider, 3);
        expect(await provider.getBlockNumber()).to.equal(b0 + 3);
    });
});
