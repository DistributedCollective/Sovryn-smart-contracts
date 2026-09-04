/**
 * Phase 1 preflight — fork rehearsal precondition.
 *
 * Asserts that a fork can be brought to "Phase 1 executed" without knowing a
 * single proposal id: the three parts are found by the actions they carry,
 * finished through real governance whatever state they are in, and a second
 * run is a no-op that sends no transaction at all.
 *
 * first run a local forked mainnet node in a separate terminal window:
 *     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
 * now run the test:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test \
 *       tests-onchain/perimeter/phase1Preflight.test.js --network rskForkedMainnet
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupGovernanceContext } = require("./perimeterSipTestHelpers");
const { ensurePhase1Executed, findProposalByActions } = require("./phase1Preflight");

describe("Phase 1 preflight", () => {
    it("finds the live Phase 1 proposals by their actions and leaves them executed", async () => {
        if (!hre.network.tags["forked"]) throw new Error("run on rskForkedMainnet");
        const ctx = await setupGovernanceContext();
        const before = await findProposalByActions(ctx.governorOwner, [
            "setExitFeeController(address)",
        ]);
        expect(before, "Part 2 must be discoverable on a current fork").to.not.equal(null);

        const result = await ensurePhase1Executed(ctx);
        console.log(
            "        preflight:",
            ["part1", "part2", "part3"]
                .map((p) => `${p} #${result[p].proposalId} ${result[p].action}`)
                .join(", ")
        );
        for (const part of ["part1", "part2", "part3"]) {
            const gov = ctx[result[part].governor];
            expect(await gov.state(result[part].proposalId), `${part} executed`).to.equal(7);
        }
        // The activation pointer is the observable outcome of Parts 1+2.
        const protocol = await ethers.getContractAt(
            "ISovryn",
            (await deployments.get("SovrynProtocol")).address
        );
        expect(await protocol.getTarget("setExitFeeController(address)")).to.not.equal(
            ethers.constants.AddressZero
        );

        // Idempotent: a second run does nothing — and mines no block, which on
        // an auto-mining node is the same as sending no transaction.
        const blockBefore = await ethers.provider.getBlockNumber();
        const again = await ensurePhase1Executed(ctx);
        expect(again.part1.action).to.equal("skipped");
        expect(again.part2.action).to.equal("skipped");
        expect(again.part3.action).to.equal("skipped");
        expect(await ethers.provider.getBlockNumber(), "second run sent no transaction").to.equal(
            blockBefore
        );
    });
});
