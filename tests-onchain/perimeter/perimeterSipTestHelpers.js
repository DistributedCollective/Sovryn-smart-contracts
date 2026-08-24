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

const perimeterEventsInterface = new ethers.utils.Interface([
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
    const overrides = deployedAddressOverrides();
    if (overrides.ExitFeeController && overrides.ExitFeeVault) {
        // Already on chain and already bootstrapped by whoever deployed it. The
        // rehearsal attaches and leaves the policy alone -- rewriting it here
        // would test configuration this run invented rather than the
        // configuration the release actually carries.
        const controller = await attachDeployed(
            "ExitFeeController",
            overrides.ExitFeeController,
            controllerFixture.abi,
            deployerSigner
        );
        const vault = await attachDeployed(
            "ExitFeeVault",
            overrides.ExitFeeVault,
            vaultFixture.abi,
            deployerSigner
        );
        return {
            controller,
            vault,
            rateBps: await attachedRateBps(controller),
            operator: await attachedOperator(controller),
        };
    }
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

    return { controller, vault, rateBps, operator: deployerSigner };
};

/** The rate the ATTACHED controller actually carries.
 *
 *  A rehearsal that attaches must assert against the shipped policy, not a
 *  number this file chose: charging is what the drill exists to measure, and a
 *  test rate would make every fee assertion arithmetic about a configuration
 *  nobody deployed. The four surfaces are required to agree, because the
 *  assertions downstream apply one rate everywhere — a split policy has to fail
 *  loudly here rather than pass three surfaces and quietly mismeasure the fourth. */
const attachedRateBps = async (controller) => {
    const surfaces = {
        LENDING_LENDER_WITHDRAW: PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
        LENDING_BORROWER_WITHDRAW: PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
        ZERO_WITHDRAW_COLL: PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
        ZERO_CLAIM_SURPLUS: PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
    };
    const seen = {};
    for (const [label, surfaceId] of Object.entries(surfaces)) {
        const policy = await controller.surfacePolicy(surfaceId);
        if (!policy.active) {
            throw new Error(
                `attached controller has surface ${label} INACTIVE — the rehearsal ` +
                    `would measure a fee that the deployed policy never charges`
            );
        }
        seen[label] = policy.rateBps;
    }
    const rates = [...new Set(Object.values(seen))];
    if (rates.length !== 1) {
        throw new Error(
            `attached controller carries more than one rate (${JSON.stringify(seen)}); ` +
                `the rehearsal's fee arithmetic assumes a single rate on every surface`
        );
    }
    return rates[0];
};

/** Who can operate the ATTACHED controller.
 *
 *  `setExitFeeEnabled` is onlyAdminOrOwner, and on the real deployment neither
 *  is a signer this test holds: the deployer EOA owns it until the Exchequer
 *  accepts, and the Exchequer is the admin. Impersonating the admin is both the
 *  only way to flip the switch here and the path production takes, so the drill
 *  gets more faithful rather than less. */
const attachedOperator = async (controller) => {
    const admin = await controller.admin();
    const authority = admin === ethers.constants.AddressZero ? await controller.owner() : admin;
    const signer = await getImpersonatedSigner(authority);
    await setBalance(authority, ONE_RBTC);
    return signer;
};

/** Deploy the hooked Zero BorrowerOperations implementation (built from
 *  zero-contracts-perimeter @ private/perimeter) and save the
 *  "BorrowerOperationsPerimeter" record the sipArgs Part 1 entry resolves.
 *  The constructor's permit2 address is read from the live proxy so the new
 *  implementation is constructed exactly like the production one. */
const deployHookedBorrowerOperationsImpl = async (deployerSigner) => {
    const _ov = deployedAddressOverrides();
    if (_ov["BorrowerOperationsPerimeter"]) {
        return await attachDeployed(
            "BorrowerOperationsPerimeter",
            _ov["BorrowerOperationsPerimeter"],
            borrowerOperationsFixture.abi,
            deployerSigner
        );
    }
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
    const _ov = deployedAddressOverrides();
    if (_ov["CollSurplusPoolPerimeter"]) {
        return await attachDeployed(
            "CollSurplusPoolPerimeter",
            _ov["CollSurplusPoolPerimeter"],
            collSurplusPoolFixture.abi,
            deployerSigner
        );
    }
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
            const parsed = perimeterEventsInterface.parseLog(log);
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
            const parsed = perimeterEventsInterface.parseLog(log);
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

/**
 * Deploy the Phase-1 release contracts straight from local artifacts.
 *
 * `deployments.fixture()` cannot do this on a fork. hardhat-deploy's
 * `fetchIfDifferent` asks the node for the previous deployment's transaction to
 * decide whether the bytecode moved, and a forked node does not serve pre-fork
 * transactions by hash -- the upstream RPC has them, the fork simply will not
 * proxy that call. The fixture therefore throws "cannot get the transaction for
 * <X>'s previous deployment" on any contract with a recorded deploy tx, which
 * is all of them, and no choice of endpoint fixes it.
 *
 * The set below is exactly what SIP-0094 Part 1 registers, so the rehearsal
 * exercises the release rather than a superset of it: the two hooked beacon
 * modules, the three replaced protocol modules, the admin module, and the
 * borrower-exit charge hook, over a freshly deployed swaps library that the
 * linked ones bind to.
 */
/**
 * Addresses to attach to instead of deploying, for re-running the rehearsal
 * against contracts that are already on chain.
 *
 * Point PERIMETER_DEPLOYED_ADDRESSES at a JSON file of `{ "ContractName":
 * "0x..." }` and every helper below attaches rather than deploys. That is the
 * mode to use after the release is redeployed: the rehearsal then exercises the
 * bytecode that actually shipped, not a fresh local copy of it. Names not in the
 * file are still deployed, so a partial file works.
 *
 * Each attached address is checked for code on the fork first. Attaching to an
 * empty address would otherwise produce a rehearsal that passes by calling
 * nothing.
 */
let _overrides;
const deployedAddressOverrides = () => {
    if (_overrides !== undefined) return _overrides;
    const file = process.env.PERIMETER_DEPLOYED_ADDRESSES;
    if (!file) {
        _overrides = {};
        return _overrides;
    }
    const fs = require("fs");
    if (!fs.existsSync(file)) {
        throw new Error(`PERIMETER_DEPLOYED_ADDRESSES points at ${file}, which does not exist`);
    }
    _overrides = JSON.parse(fs.readFileSync(file, "utf8"));
    return _overrides;
};

/** Attach to an already-deployed contract, refusing an address with no code.
 *
 *  The address is checksummed first. It arrives as text from an operator-written
 *  file, and ethers leaves `contract.address` exactly as passed — so a lowercase
 *  address would flow into the identity comparisons downstream and fail them on
 *  case alone, against a contract that is in fact the right one. */
const attachDeployed = async (name, address, abi, signer) => {
    const checksummed = ethers.utils.getAddress(address);
    const code = await ethers.provider.getCode(checksummed);
    if (!code || code === "0x") {
        throw new Error(
            `PERIMETER_DEPLOYED_ADDRESSES gives ${name} = ${address}, which has no ` +
                `code on this fork. Wrong address, or a fork block older than the ` +
                `deployment.`
        );
    }
    await deployments.save(name, { address: checksummed, abi });
    return new ethers.Contract(checksummed, abi, signer);
};

const deployLendingReleaseContracts = async (deployerSigner) => {
    const swapsLib = await (
        await ethers.getContractFactory("SwapsImplSovrynSwapLib", deployerSigner)
    ).deploy();
    await swapsLib.deployed();

    const deployed = {};
    const names = [
        "LoanTokenLogicLM",
        "LoanTokenLogicWrbtcLM",
        "LoanClosingsRollover",
        "LoanClosingsWith",
        "LoanMaintenance",
        "ExitFeeModule",
        "BorrowerExitPerimeterOps",
    ];
    const overrides = deployedAddressOverrides();
    for (const name of names) {
        const artifact = await hre.artifacts.readArtifact(name);
        if (overrides[name]) {
            deployed[name] = await attachDeployed(
                name,
                overrides[name],
                artifact.abi,
                deployerSigner
            );
            continue;
        }
        const needsLib = Object.keys(artifact.linkReferences || {}).length > 0;
        const factory = needsLib
            ? await ethers.getContractFactory(name, {
                  libraries: { SwapsImplSovrynSwapLib: swapsLib.address },
                  signer: deployerSigner,
              })
            : await ethers.getContractFactory(name, deployerSigner);
        const contract = await factory.deploy();
        await contract.deployed();
        await deployments.save(name, { address: contract.address, abi: artifact.abi });
        deployed[name] = contract;
    }
    return { swapsLib, ...deployed };
};

module.exports = {
    deployLendingReleaseContracts,
    deployedAddressOverrides,
    attachDeployed,
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
    perimeterEventsInterface,
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
