/**
 * The shared delay fixture builds the activated perimeter, and this is the test
 * that says what "activated" has to mean before any scenario leans on it.
 *
 * Run a forked mainnet node in another terminal first:
 *     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
 * then:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test \
 *       tests-onchain/perimeter/phase2Stack.test.js --network rskForkedMainnet
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { setupPhase2Stack } = require("./phase2Stack");
const {
    ERC1967_IMPL_SLOT,
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
} = require("./perimeterSipTestHelpers");

describe("Phase 2 stack fixture", () => {
    let s;

    before(async function () {
        if (!hre.network.tags["forked"]) {
            // Throw, never return: a bare return marks a security rehearsal
            // PASSED with zero assertions.
            throw new Error(
                "run on a forked mainnet (rskForkedMainnet); no fork tag on this network"
            );
        }
        s = await setupPhase2Stack();
        console.log(
            "        phase2 proposals: part1 #" +
                s.proposals.part1.toString() +
                ", part2 #" +
                s.proposals.part2.toString()
        );
    });

    it("refuses both delay proposals until the controller carries the delay", async () => {
        // The proposals install modules that quote a hold on every hooked exit
        // and fail closed when the controller cannot answer. Ordering them
        // after the controller upgrade is therefore not a matter of care taken
        // on the day: the builders read the controller and refuse.
        expect(
            s.controllerPrecondition.beforeUpgrade.refused,
            "the proposals would have been built against the controller as it was found"
        ).to.be.true;
        expect(s.controllerPrecondition.beforeUpgrade.message).to.contain("upgradeTo");
        expect(s.controllerPrecondition.beforeUpgrade.message).to.contain(
            s.stack.controller.address
        );
        expect(
            s.controllerPrecondition.afterUpgrade.refused,
            "the upgrade did not lift the refusal: " +
                String(s.controllerPrecondition.afterUpgrade.message)
        ).to.be.false;
    });

    it("arms a delay perimeter owned and administered by the multisig, holds a real withdrawal, and takes operator actions at threshold", async () => {
        // ── The queue is in the operator's hands ───────────────────────────
        expect((await s.queue.owner()).toLowerCase()).to.equal(s.exchequer.address.toLowerCase());
        expect((await s.queue.admin()).toLowerCase()).to.equal(s.exchequer.address.toLowerCase());

        // ── The live controller now serves the delay build, unharmed ───────
        const active = ethers.utils.getAddress(
            "0x" +
                (
                    await ethers.provider.getStorageAt(
                        s.stack.controller.address,
                        ERC1967_IMPL_SLOT
                    )
                ).slice(26)
        );
        expect(active).to.equal(s.upgrade.implementation);
        expect(active).to.not.equal(s.upgrade.previousImplementation);
        expect((await s.stack.controller.owner()).toLowerCase()).to.equal(
            s.exchequer.address.toLowerCase()
        );
        expect((await s.stack.controller.admin()).toLowerCase()).to.equal(
            s.exchequer.address.toLowerCase()
        );
        expect(await s.stack.controller.feeReceiver()).to.equal(s.upgrade.preserved.feeReceiver);

        // ── Armed ──────────────────────────────────────────────────────────
        expect(await s.stack.controller.securityPerimeterEnabled()).to.be.true;
        expect(await s.stack.controller.globalDelaySeconds()).to.equal(s.DELAY_SECONDS);

        // ── Wired, on both products ────────────────────────────────────────
        expect(await s.protocol.exitDelayQueue()).to.equal(s.queue.address);
        expect(await s.borrowerOperations.exitDelayQueue()).to.equal(s.queue.address);
        expect((await s.borrowerOperations.exitFeeController()).toLowerCase()).to.equal(
            s.stack.controller.address.toLowerCase()
        );

        // ── A real withdrawal is HELD ──────────────────────────────────────
        // Everything above is wiring. Wiring that quotes no delay would pass
        // it, so the fixture only means something once a live exit is held.
        const wrbtcAddress = s.wrbtc.address;
        const deployer = s.ctx.deployerSigner;
        const lendAmount = ethers.utils.parseEther("1");
        await (await s.iRBTC.mintWithBTC(deployer.address, false, { value: lendAmount })).wait();
        const iBalance = await s.iRBTC.balanceOf(deployer.address);
        expect(iBalance.gt(0), "iRBTC position minted").to.be.true;

        const queuedBefore = await s.queue.lastRequestId();
        const userBefore = await ethers.provider.getBalance(deployer.address);
        await (await s.iRBTC.burnToBTC(deployer.address, iBalance, false)).wait();

        const queuedAfter = await s.queue.lastRequestId();
        expect(queuedAfter.gt(queuedBefore), "the withdrawal was not held").to.be.true;
        // Gas makes an exact equality wrong here; what matters is that the
        // payout did NOT arrive, so the balance cannot have gone UP.
        expect(
            (await ethers.provider.getBalance(deployer.address)).lte(userBefore),
            "the lender was paid despite an active hold"
        ).to.be.true;

        const request = await s.queue.getRequest(queuedAfter);
        expect(request.receiver).to.equal(deployer.address);
        expect(request.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);
        expect(request.token.toLowerCase()).to.equal(wrbtcAddress.toLowerCase());
        expect(request.unwrapOnDelivery, "native exits unwrap at delivery").to.be.true;
        expect((await s.queue.totalEscrowed(wrbtcAddress)).gt(0)).to.be.true;

        // ── The operator lever runs through the real multisig ──────────────
        const pause = s.queue.interface.encodeFunctionData("setSecurityPerimeterPaused", [true]);
        const r = await s.viaMultisig(s.queue.address, pause);
        expect(r.executed).to.be.true;
        expect(await s.queue.securityPerimeterPaused()).to.be.true;

        await s.viaMultisig(
            s.queue.address,
            s.queue.interface.encodeFunctionData("setSecurityPerimeterPaused", [false])
        );
        expect(await s.queue.securityPerimeterPaused()).to.be.false;

        // ── And the hold ends ──────────────────────────────────────────────
        await time.increase(s.DELAY_SECONDS + 1);
        await mine();
        const beforeRelease = await ethers.provider.getBalance(deployer.address);
        await (await s.queue.executeExit(queuedAfter)).wait();
        expect(
            (await ethers.provider.getBalance(deployer.address)).gt(beforeRelease),
            "the lender was not paid after the hold ended"
        ).to.be.true;
        expect((await s.queue.totalEscrowed(wrbtcAddress)).toString()).to.equal("0");
    });
});
