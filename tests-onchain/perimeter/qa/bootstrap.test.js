/**
 * What `perimeter:qa up` has to leave behind before anyone opens a dapp
 * against the fork.
 *
 * Boot the node first, then run against it:
 *     PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --detach
 *     PERIMETER_QA_RPC=http://127.0.0.1:8547 __decryptionAlreadyDone__=TRUE \
 *       npx hardhat test tests-onchain/perimeter/qa/bootstrap.test.js \
 *       --network rskForkedMainnetQa
 *
 * The bootstrap is idempotent, so this runs equally against a fresh node (it
 * installs) and one that `up` has already been run on (it attaches).
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const { bootstrapQa, attachQa, STATE_FILE, TEST_KEY, RBTC_PER_ACCOUNT } = require("./bootstrap");
const { servesDelayBuild } = require("../perimeterSipTestHelpers");

describe("QA bootstrap", () => {
    let state;
    let qa;

    before(async function () {
        this.timeout(30 * 60 * 1000);
        if (!hre.network.tags.qa) {
            // Throw, never return: a bare return marks a security rehearsal
            // PASSED with zero assertions.
            throw new Error("run with --network rskForkedMainnetQa");
        }
        state = await bootstrapQa(hre, { log: () => {} });
        qa = await attachQa(hre);
    });

    it("leaves the delay installed, armed and in the operator's hands", async () => {
        // ── The release is installed on both products ──────────────────────
        expect(await qa.protocol.exitDelayQueue()).to.equal(state.queue);
        expect(await servesDelayBuild(state.controller)).to.be.true;

        // ── Armed, at the delay the state file claims ──────────────────────
        expect(await qa.controller.securityPerimeterEnabled()).to.be.true;
        expect(await qa.controller.globalDelaySeconds()).to.equal(state.delaySeconds);

        // ── The queue is the multisig's, both roles ────────────────────────
        expect((await qa.queue.owner()).toLowerCase()).to.equal(state.multisig.toLowerCase());
        expect((await qa.queue.admin()).toLowerCase()).to.equal(state.multisig.toLowerCase());

        // ── One imported key can pull the operator levers ──────────────────
        expect(await qa.multisig.isOwner(TEST_KEY.address)).to.be.true;
        expect(Number(await qa.multisig.required())).to.equal(1);

        // ── Zero serves the delay-hooked implementation this run deployed ──
        // The record is the independent witness: reading the proxy and then
        // comparing it to a value read off the same proxy would pass against
        // any implementation at all.
        const deployedImpl = ethers.utils.getAddress(
            (await hre.deployments.get("BorrowerOperationsPerimeter")).address
        );
        const zeroProxy = new ethers.Contract(
            state.borrowerOperations,
            ["function getImplementation() view returns (address)"],
            ethers.provider
        );
        expect(await zeroProxy.getImplementation()).to.equal(deployedImpl);
        expect(state.borrowerOperationsImpl).to.equal(deployedImpl);
        expect(await qa.borrowerOperations.exitDelayQueue()).to.equal(state.queue);

        // ── The preceding release is finished ──────────────────────────────
        const communityIssuance = new ethers.Contract(
            (await hre.deployments.get("ZeroCommunityIssuance")).address,
            ["function APR() view returns (uint256)"],
            ethers.provider
        );
        expect((await communityIssuance.APR()).toString()).to.equal("0");

        // ── The protocol's own fee stream is where it always was ───────────
        // Nothing in this release redirects it, so a moved pointer means the
        // fork carries something else as well. The perimeter's own charge lands
        // somewhere different, and that separation is the point.
        const feesPointer = new ethers.Contract(
            state.protocol,
            ["function feesController() view returns (address)"],
            ethers.provider
        );
        expect((await feesPointer.feesController()).toLowerCase()).to.equal(
            (await hre.deployments.get("FeeSharingCollector_Proxy")).address.toLowerCase()
        );
        expect(state.feesController.toLowerCase()).to.equal(
            (await feesPointer.feesController()).toLowerCase()
        );
        expect(state.feeReceiver.toLowerCase()).to.equal(
            (await qa.controller.feeReceiver()).toLowerCase()
        );
        expect(state.feeReceiver.toLowerCase()).to.not.equal(state.feesController.toLowerCase());

        // ── The charge is armed alongside the hold ─────────────────────────
        expect(await qa.controller.exitFeeEnabled()).to.equal(state.feeEnabled);
        expect(state.feeEnabled).to.be.true;

        // ── The imported key can pay for what it does ──────────────────────
        expect(
            (await ethers.provider.getBalance(TEST_KEY.address)).gte(
                ethers.utils.parseEther(RBTC_PER_ACCOUNT)
            )
        ).to.be.true;
    });

    it("writes a state file that matches the chain", async () => {
        const onDisk = JSON.parse(require("fs").readFileSync(STATE_FILE, "utf8"));
        expect(onDisk).to.deep.equal(state);

        expect(onDisk.chainId).to.equal((await ethers.provider.getNetwork()).chainId);
        expect(onDisk.rpc).to.equal(hre.network.config.url);
        expect(new ethers.Wallet(onDisk.testKey.privateKey).address).to.equal(
            onDisk.testKey.address
        );

        for (const address of [
            onDisk.queue,
            onDisk.controller,
            onDisk.feesController,
            onDisk.feeReceiver,
            onDisk.multisig,
            onDisk.protocol,
            onDisk.borrowerOperations,
            onDisk.borrowerOperationsImpl,
            onDisk.wrbtc,
            onDisk.loanTokens.iRBTC,
            onDisk.loanTokens.iXUSD,
        ]) {
            expect(await ethers.provider.getCode(address)).to.not.equal("0x");
        }

        expect(onDisk.loanTokens.iRBTC).to.equal(
            ethers.utils.getAddress((await hre.deployments.get("LoanToken_iRBTC")).address)
        );
        expect(onDisk.loanTokens.iXUSD).to.equal(
            ethers.utils.getAddress((await hre.deployments.get("LoanToken_iXUSD")).address)
        );
        expect(onDisk.delaySeconds).to.equal(Number(await qa.controller.globalDelaySeconds()));
        expect(onDisk.feeEnabled).to.equal(await qa.controller.exitFeeEnabled());
        expect(onDisk.queue).to.equal(ethers.utils.getAddress(await qa.protocol.exitDelayQueue()));
        expect(onDisk.governance).to.be.oneOf(["impersonate", "real"]);
        expect(onDisk.suspects.length).to.equal(3);
        const settled = [
            "executed-on-chain",
            "impersonated",
            "skipped",
            "executed",
            "voted-queued-executed",
            "created-and-executed",
            "pre-existing",
        ];
        for (const part of ["part1", "part2", "part3"]) {
            expect(onDisk.phase1[part].how).to.be.oneOf(settled);
        }
        for (const part of ["part1", "part2"]) {
            expect(onDisk.phase2[part].how).to.be.oneOf(settled.concat("governance"));
            if (onDisk.phase2[part].actions !== undefined) {
                expect(onDisk.phase2[part].actions).to.be.greaterThan(0);
            }
        }
    });
});
