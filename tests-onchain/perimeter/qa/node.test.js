/**
 * QA node — network identity check.
 *
 * Confirms the standalone QA fork reports RSK's real chain id (30), so
 * MetaMask and a dapp that gate on chain id accept it; that it carries the
 * "qa" tag, so it can be told apart from the throwaway rehearsal fork; and
 * that live deployment records resolve against it the same way they do on
 * rskForkedMainnet.
 *
 * Boot the node first (scripts/perimeter/qa-node.sh, or --detach), then run:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test \
 *       tests-onchain/perimeter/qa/node.test.js --network rskForkedMainnetQa
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QA node", () => {
    it("reports chain id 30, the qa tag, and resolves live deployment records", async () => {
        if (!hre.network.tags.qa) {
            throw new Error("run with --network rskForkedMainnetQa");
        }

        expect((await ethers.provider.getNetwork()).chainId).to.equal(30);
        expect(deployments.getNetworkName()).to.equal("rskForkedMainnetQa");

        const protocol = await deployments.get("SovrynProtocol");
        expect(await ethers.provider.getCode(protocol.address)).to.not.equal("0x");
    });
});
