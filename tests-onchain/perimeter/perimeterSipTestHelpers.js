/**
 * Shared setup for the Perimeter Phase-1 activation SIP fork tests.
 *
 * The ExitFeeController/ExitFeeVault (perimeter repo, 0.8.20) and the hooked Zero
 * BorrowerOperations (zero-contracts-perimeter, 0.6.11) cannot be compiled by this
 * repo's multi-solc setup, so the tests deploy them from checked-in build
 * fixtures (./fixtures/*.json, each with a _provenance block naming the source
 * repo/branch/commit). The deployed addresses are saved as the deployment
 * records the sipArgs entries resolve ("ExitFeeController",
 * "BorrowerOperationsPerimeter") — which is exactly how the `<TBD>` production
 * inputs are wired at SIP-creation time.
 */
const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const { ethers, deployments } = hre;

const ONE_RBTC = ethers.utils.parseEther("1.0");
const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);

// Fork source for hardhat_reset. Override when mainnet-dev is unavailable,
// e.g. COLFEE_FORK_RPC=https://public-node.rsk.co COLFEE_FORK_BLOCK=<recent>.
const FORK_URL = process.env.COLFEE_FORK_RPC || "https://mainnet-dev.sovryn.app/rpc";
const forkBlock = (defaultBlock) =>
    process.env.COLFEE_FORK_BLOCK ? parseInt(process.env.COLFEE_FORK_BLOCK, 10) : defaultBlock;

const PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW")
);
const PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW")
);
const PERIMETER_SURFACE_ZERO_WITHDRAW_COLL = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PERIMETER_SURFACE_ZERO_WITHDRAW_COLL")
);
const PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS")
);

const controllerFixture = require("./fixtures/ExitFeeController.json");
const vaultFixture = require("./fixtures/ExitFeeVault.json");
const erc1967ProxyFixture = require("./fixtures/ERC1967Proxy.json");
const borrowerOperationsFixture = require("./fixtures/BorrowerOperationsPerimeter.json");
const collSurplusPoolFixture = require("./fixtures/CollSurplusPoolPerimeter.json");
const priceFeedTestnetFixture = require("./fixtures/PriceFeedTestnet.json");

const colFeeEventsInterface = new ethers.utils.Interface([
    "event ExitFeeApplied(bytes32 indexed surfaceId, address indexed actor, address indexed asset, address subProduct, address recipient, uint256 grossAmount, uint256 feeAmount, uint256 netAmount, address feeReceiver)",
    "event ExitFeeSkipped(bytes32 indexed surfaceId, address indexed actor, address indexed asset, uint256 grossAmount, uint16 rateBps, uint8 reason)",
    "event ExitFeeControllerSet(address indexed previous, address indexed current)",
    "event BorrowerExitPerimeterOpsSet(address indexed previous, address indexed current)",
]);

/** Impersonated signer bound to a raw JsonRpcProvider. The tests run against
 *  an external `hardhat node` process, whose in-process HD-wallet wrapper
 *  refuses eth_sendTransaction for accounts it does not manage (HH103) even
 *  after hardhat_impersonateAccount — so sends must bypass it. The address is
 *  attached as `.address` for parity with hre signers. */
const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    const signer = provider.getSigner(addressToImpersonate);
    signer.address = ethers.utils.getAddress(addressToImpersonate);
    return signer;
};

const getImpersonatedSignerFromJsonRpcProvider = getImpersonatedSigner;

/** Deploy the real (0.8.20) ExitFeeVault + ExitFeeController behind ERC1967
 *  proxies, owner = deployer, feeReceiver = vault, all three Phase-1 surface
 *  policies registered ACTIVE at `rateBps` — but exitFeeEnabled left FALSE
 *  (the ship-disabled model; tests flip it explicitly). Saves the
 *  "ExitFeeController" deployment record consumed by the sipArgs entries. */
const deployPerimeterStack = async (deployerSigner, rateBps) => {
    const proxyFactory = new ethers.ContractFactory(
        erc1967ProxyFixture.abi,
        erc1967ProxyFixture.bytecode,
        deployerSigner
    );

    const vaultImpl = await new ethers.ContractFactory(
        vaultFixture.abi,
        vaultFixture.bytecode,
        deployerSigner
    ).deploy();
    await vaultImpl.deployed();
    const vaultInitData = vaultImpl.interface.encodeFunctionData("initialize", [
        deployerSigner.address,
    ]);
    const vaultProxy = await proxyFactory.deploy(vaultImpl.address, vaultInitData);
    await vaultProxy.deployed();
    const vault = new ethers.Contract(vaultProxy.address, vaultFixture.abi, deployerSigner);

    const controllerImpl = await new ethers.ContractFactory(
        controllerFixture.abi,
        controllerFixture.bytecode,
        deployerSigner
    ).deploy();
    await controllerImpl.deployed();
    const controllerInitData = controllerImpl.interface.encodeFunctionData("initialize", [
        deployerSigner.address,
    ]);
    const controllerProxy = await proxyFactory.deploy(controllerImpl.address, controllerInitData);
    await controllerProxy.deployed();
    const controller = new ethers.Contract(
        controllerProxy.address,
        controllerFixture.abi,
        deployerSigner
    );

    await (await controller.setFeeReceiver(vault.address)).wait();
    for (const surfaceId of [
        PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
        PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
        PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
        PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
    ]) {
        await (await controller.setSurfacePolicy(surfaceId, { active: true, rateBps })).wait();
    }

    if (await controller.exitFeeEnabled()) {
        throw new Error("Perimeter stack must deploy disabled");
    }

    await deployments.save("ExitFeeController", {
        address: controller.address,
        abi: controllerFixture.abi,
    });

    return { controller, vault };
};

/** Deploy the hooked Zero BorrowerOperations implementation (built from
 *  zero-contracts-perimeter @ private/perimeter) and save the
 *  "BorrowerOperationsPerimeter" record the sipArgs Part 1 entry resolves.
 *  The constructor's permit2 address is read from the live proxy so the new
 *  implementation is constructed exactly like the production one. */
const deployHookedBorrowerOperationsImpl = async (deployerSigner) => {
    const boProxy = await deployments.get("BorrowerOperations_Proxy");
    const permit2 = await new ethers.Contract(
        boProxy.address,
        ["function permit2() view returns (address)"],
        deployerSigner
    ).permit2();
    const impl = await new ethers.ContractFactory(
        borrowerOperationsFixture.abi,
        borrowerOperationsFixture.bytecode,
        deployerSigner
    ).deploy(permit2);
    await impl.deployed();
    await deployments.save("BorrowerOperationsPerimeter", {
        address: impl.address,
        abi: borrowerOperationsFixture.abi,
    });
    return impl;
};

/** Deploy the surplus-claim CollSurplusPool implementation (built from
 *  zero-contracts-perimeter @ private/perimeter, claimCollWithFee two-leg split) and
 *  save the "CollSurplusPoolPerimeter" record the sipArgs Part 1 entry resolves —
 *  the FIRST-EVER implementation upgrade of that proxy (runbook §8). */
const deployCollSurplusPoolImpl = async (deployerSigner) => {
    const impl = await new ethers.ContractFactory(
        collSurplusPoolFixture.abi,
        collSurplusPoolFixture.bytecode,
        deployerSigner
    ).deploy();
    await impl.deployed();
    await deployments.save("CollSurplusPoolPerimeter", {
        address: impl.address,
        abi: collSurplusPoolFixture.abi,
    });
    return impl;
};

/** Swap Zero's price feed proxy to the settable PriceFeedTestnet stub, seeded
 *  with the production feed's lastGoodPrice. Needed on a fork because the
 *  real ZeroPriceFeed enforces oracle freshness and the governance voting/
 *  timelock jumps push block.timestamp far past any oracle update. The swap
 *  is done by the feed proxy's own owner (TimelockOwner, impersonated) — the
 *  same authority that would rotate the feed in production. */
const stubOutZeroPriceFeed = async (deployerSigner) => {
    const feedProxy = await ethers.getContract("ZeroPriceFeed_Proxy", deployerSigner);
    const lastGoodPrice = await new ethers.Contract(
        feedProxy.address,
        ["function lastGoodPrice() view returns (uint256)"],
        deployerSigner
    ).lastGoodPrice();

    const stubImpl = await new ethers.ContractFactory(
        priceFeedTestnetFixture.abi,
        priceFeedTestnetFixture.bytecode,
        deployerSigner
    ).deploy();
    await stubImpl.deployed();

    const feedOwner = await getImpersonatedSigner(await feedProxy.getOwner());
    await setBalance(feedOwner.address, ONE_RBTC);
    await (await feedProxy.connect(feedOwner).setImplementation(stubImpl.address)).wait();

    const stubbedFeed = new ethers.Contract(
        feedProxy.address,
        priceFeedTestnetFixture.abi,
        deployerSigner
    );
    await (await stubbedFeed.setPrice(lastGoodPrice)).wait();
    return { stubbedFeed, lastGoodPrice };
};

/** Stake a fresh SOV whale (once per context — subsequent calls reuse it). */
const ensureWhaleStake = async (ctx) => {
    if (ctx.whaleStaked) return;
    const { deployer, deployerSigner, staking, multisigSigner, timelockOwnerSigner } = ctx;
    const sov = await ethers.getContract("SOV", timelockOwnerSigner);
    const whaleAmount = (await sov.totalSupply()).mul(ethers.BigNumber.from(5));
    await sov.mint(deployer, whaleAmount);
    await sov.connect(deployerSigner).approve(staking.address, whaleAmount);
    if (await staking.paused()) await staking.connect(multisigSigner).pauseUnpause(false);
    const currentTS = ethers.BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
    await staking.stake(whaleAmount, currentTS.add(MAX_DURATION), deployer, deployer);
    await mine();
    ctx.whaleStaked = true;
};

/** Create → vote → queue (but do NOT execute) the proposal produced by
 *  `argsFunc`. Split from execution so the tests can hold several proposals
 *  Queued at once and pick the execution order — GovernorAlpha allows the same
 *  proposer a new proposal as soon as the previous one is Queued (it blocks
 *  only Pending/Active). `governorKey` selects the context's governor
 *  ("governorOwner" or "governorAdmin"); it MUST match the governor the args
 *  builder returns, because `sips:create` routes on the builder's answer. */
const createAndQueueSip = async (ctx, argsFunc, governorKey = "governorOwner") => {
    const { deployer, deployerSigner } = ctx;
    const governor = ctx[governorKey];
    if (!governor) {
        throw new Error(`createAndQueueSip: no '${governorKey}' in the governance context`);
    }

    await ensureWhaleStake(ctx);

    const proposalIdBeforeSIP = await governor.latestProposalIds(deployer);
    await hre.run("sips:create", { argsFunc });
    const proposalId = await governor.latestProposalIds(deployer);
    if (!proposalId.gt(proposalIdBeforeSIP)) {
        throw new Error(
            `Proposal was not created on ${governorKey} — check that ${argsFunc} returns that ` +
                "governor and that the creation is not commented out"
        );
    }

    await mine();
    await governor.connect(deployerSigner).castVote(proposalId, true);

    const proposal = await governor.proposals(proposalId);
    const currentBlock = await ethers.provider.getBlockNumber();
    await mine(Number(proposal.endBlock) - currentBlock + 1);
    await governor.queue(proposalId);

    return { proposalId };
};

/** Execute an already-Queued proposal, advancing time to its eta only when it
 *  is still in the future (a sibling proposal queued later may already have
 *  pushed the clock past it). Returns the execution receipt (the proposal's
 *  actions all run inside this one transaction). */
const executeQueuedSip = async (ctx, proposalId, governorKey = "governorOwner") => {
    const governor = ctx[governorKey];
    if (!governor) {
        throw new Error(`executeQueuedSip: no '${governorKey}' in the governance context`);
    }

    const proposal = await governor.proposals(proposalId);
    const latestTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    if (ethers.BigNumber.from(latestTimestamp).lt(proposal.eta)) {
        await time.increaseTo(proposal.eta);
    }
    const executionReceipt = await (await governor.execute(proposalId)).wait();

    if (!(await governor.proposals(proposalId)).executed) {
        throw new Error("Proposal was not executed");
    }
    return { proposalId, executionReceipt };
};

const createAndQueueGovernorOwnerSip = (ctx, argsFunc) =>
    createAndQueueSip(ctx, argsFunc, "governorOwner");
const executeQueuedGovernorOwnerSip = (ctx, proposalId) =>
    executeQueuedSip(ctx, proposalId, "governorOwner");

/** Governance/actor context shared by both SIP tests (mirrors the setup of
 *  tests-onchain/sip0087.test.js). */
const setupGovernanceContext = async () => {
    const deployer = (await ethers.getSigners())[0].address;
    const deployerSigner = await ethers.getSigner(deployer);
    await setBalance(deployer, ONE_RBTC.mul(100));

    const multisigAddress = (await deployments.get("MultiSigWallet")).address;
    const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(multisigAddress);

    const staking = await ethers.getContract("Staking", deployerSigner);

    const governorOwnerDeployment = await deployments.get("GovernorOwner");
    const governorOwner = await ethers.getContractAt(
        "GovernorAlpha",
        governorOwnerDeployment.address,
        deployerSigner
    );
    const governorOwnerSigner = await getImpersonatedSigner(governorOwnerDeployment.address);
    await setBalance(governorOwnerSigner.address, ONE_RBTC);

    const timelockOwner = await ethers.getContract("TimelockOwner", governorOwnerSigner);
    const timelockOwnerSigner = await getImpersonatedSignerFromJsonRpcProvider(
        timelockOwner.address
    );
    await setBalance(timelockOwner.address, ONE_RBTC);

    // The ADMIN governor/timelock pair. SIP-0094 Part 3 runs here rather than on the
    // owner pair: ZeroCommunityIssuance.setAPR is gated by `rewardManager`,
    // which is TimelockAdmin on mainnet.
    const governorAdminDeployment = await deployments.get("GovernorAdmin");
    const governorAdmin = await ethers.getContractAt(
        "GovernorAlpha",
        governorAdminDeployment.address,
        deployerSigner
    );
    const governorAdminSigner = await getImpersonatedSigner(governorAdminDeployment.address);
    await setBalance(governorAdminSigner.address, ONE_RBTC);

    const timelockAdmin = await ethers.getContract("TimelockAdmin", governorAdminSigner);
    const timelockAdminSigner = await getImpersonatedSignerFromJsonRpcProvider(
        timelockAdmin.address
    );
    await setBalance(timelockAdmin.address, ONE_RBTC);

    return {
        deployer,
        deployerSigner,
        multisigAddress,
        multisigSigner,
        staking,
        governorOwner,
        timelockOwner,
        timelockOwnerSigner,
        governorAdmin,
        timelockAdmin,
        timelockAdminSigner,
    };
};

/** Count occurrences of a Perimeter event in a receipt (any emitting contract). */
const countPerimeterEvents = (receipt, eventName) => {
    let count = 0;
    for (const log of receipt.logs) {
        try {
            const parsed = colFeeEventsInterface.parseLog(log);
            if (parsed.name === eventName) count += 1;
        } catch (e) {
            // not a Perimeter event — ignore
        }
    }
    return count;
};

/** The single ExitFeeApplied event of a receipt (asserts exactly one). */
const getSingleExitFeeApplied = (receipt) => {
    const events = [];
    for (const log of receipt.logs) {
        try {
            const parsed = colFeeEventsInterface.parseLog(log);
            if (parsed.name === "ExitFeeApplied") events.push(parsed.args);
        } catch (e) {
            // not a Perimeter event — ignore
        }
    }
    if (events.length !== 1) {
        throw new Error(`expected exactly 1 ExitFeeApplied, got ${events.length}`);
    }
    return events[0];
};

module.exports = {
    ONE_RBTC,
    MAX_DURATION,
    FORK_URL,
    forkBlock,
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
    borrowerOperationsFixture,
    collSurplusPoolFixture,
    colFeeEventsInterface,
    getImpersonatedSigner,
    getImpersonatedSignerFromJsonRpcProvider,
    deployPerimeterStack,
    deployHookedBorrowerOperationsImpl,
    deployCollSurplusPoolImpl,
    stubOutZeroPriceFeed,
    createAndQueueSip,
    executeQueuedSip,
    createAndQueueGovernorOwnerSip,
    executeQueuedGovernorOwnerSip,
    setupGovernanceContext,
    countPerimeterEvents,
    getSingleExitFeeApplied,
};
