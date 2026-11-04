const { ethers } = require("ethers");
const MANIFEST = require("./sip0097.manifest.json");
const AMM = require("./sip0097.amm.json");
function freeze(value) {
    Object.values(value)
        .filter((x) => x && typeof x === "object")
        .forEach(freeze);
    return Object.freeze(value);
}
freeze(MANIFEST);
freeze(AMM);
const HALT_RUNTIME_HASH = "0x824f7d71bf073c4c12d28ed3bac7a58e4bc1a27f3cb16bb5558ec99a5b3f85ae";
const DOCUMENT = Object.freeze({
    commit: "e6b41d1f1e79d0527bcd7b1f1622cbe7fc208721",
    sha256: "050339bbcd1895bfa4008b7000142ed38558964697b452943bf33973b32c52ac",
    finalized: true,
});
// The immutable public document and both verified deployed halt targets are bound.
const RELEASE_ADDRESS = "0xe0e757e8fcf336658036202834aee10ce03debda";
const PROXY_ABI = [
    "function getOwner() view returns(address)",
    "function getImplementation() view returns(address)",
];
const lower = (x) => x.toLowerCase();
function demand(ok, message) {
    if (!ok) throw new Error("SIP0097: " + message);
}
function assertManifest(targets) {
    demand(targets.length === 16, "manifest requires exactly 16 targets");
    const seen = new Set();
    targets.forEach((t, i) => {
        const expected = MANIFEST.targets[i];
        demand(
            t.name === expected.name &&
                t.part === (i < 10 ? 1 : 2) &&
                lower(t.address) === lower(expected.address) &&
                !seen.has(lower(t.address)),
            "manifest target/order/duplicate mismatch"
        );
        seen.add(lower(t.address));
    });
}
async function assertLocalFork(hre, pin) {
    const raw = hre.network.config.url;
    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        throw new Error("SIP0097: explicit loopback endpoint required");
    }
    demand(
        url.protocol === "http:" &&
            ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
            !url.username &&
            !url.password &&
            !!url.port,
        "explicit loopback endpoint required"
    );
    const p = hre.ethers.provider;
    demand((await p.getNetwork()).chainId === 31337, "local chain must be 31337");
    demand(
        /^(anvil|HardhatNetwork)/i.test(await p.send("web3_clientVersion", [])),
        "local client required"
    );
    demand(
        pin && pin.block === MANIFEST.block && pin.hash === MANIFEST.hash,
        "fork pin must match approved mainnet baseline"
    );
    demand(
        lower((await p.getBlock(pin.block)).hash) === lower(pin.hash),
        "fork block binding mismatch"
    );
}
// Manual fork campaigns must start at the same reviewed deployed-target baseline.
// Revalidate the loopback/client/chain/hash binding before checking fresh height.
async function assertFreshFork(hre, pin) {
    await assertLocalFork(hre, pin);
    demand(
        Number(await hre.ethers.provider.send("eth_blockNumber", [])) === pin.block,
        "fresh fork must start at the approved manifest block"
    );
}

async function runtime(provider, address, hash, message, blockTag) {
    const code = await provider.getCode(address, blockTag);
    demand(code !== "0x" && ethers.utils.keccak256(code) === hash, message);
}
async function validateGovernance(provider, blockTag) {
    for (const b of Object.values(MANIFEST.bindings))
        await runtime(
            provider,
            b.address,
            b.codeHash,
            "governance runtime binding mismatch",
            blockTag
        );
    const governor = new ethers.Contract(
        MANIFEST.bindings.GovernorOwner.address,
        [
            "function timelock() view returns(address)",
            "function proposalMaxOperations() view returns(uint)",
        ],
        provider
    );
    const timelock = new ethers.Contract(
        MANIFEST.bindings.TimelockOwner.address,
        ["function admin() view returns(address)", "function delay() view returns(uint)"],
        provider
    );
    const at = { blockTag };
    demand(
        lower(await governor.timelock(at)) === lower(timelock.address),
        "governor timelock drift"
    );
    demand(lower(await timelock.admin(at)) === lower(governor.address), "timelock admin drift");
    demand((await governor.proposalMaxOperations(at)).eq(10), "governor action limit drift");
    demand((await timelock.delay(at)).eq(172800), "timelock delay drift");
}
async function validateAmm(provider, blockTag, part) {
    const at = { blockTag };
    await runtime(
        provider,
        AMM.registry.address,
        AMM.registry.codeHash,
        "registry runtime drift",
        blockTag
    );
    await runtime(
        provider,
        AMM.inert.address,
        AMM.inert.codeHash,
        "inert runtime drift",
        blockTag
    );
    const registry = new ethers.Contract(
        AMM.registry.address,
        [
            "function owner() view returns(address)",
            "function newOwner() view returns(address)",
            "function addressOf(bytes32) view returns(address)",
        ],
        provider
    );
    demand(lower(await registry.owner(at)) === lower(AMM.registry.owner), "registry owner drift");
    demand(
        lower(await registry.newOwner(at)) === lower(AMM.registry.newOwner),
        "registry pending owner drift"
    );
    demand(
        lower(
            await registry.addressOf(ethers.utils.formatBytes32String("ContractRegistry"), at)
        ) === lower(AMM.registry.address),
        "registry self binding drift"
    );
    let halted = 0;
    for (const k of AMM.keys) {
        const current = lower(await registry.addressOf(k.key, at));
        demand(
            current === lower(k.address) || current === lower(AMM.inert.address),
            k.name + " key binding drift"
        );
        if (current === lower(AMM.inert.address)) halted++;
        await runtime(
            provider,
            k.address,
            k.codeHash,
            k.name + " dependency runtime drift",
            blockTag
        );
    }
    demand(halted === 0 || halted === 3, "partial AMM state requires review");
    demand(part !== 1 || halted === 0, "selected AMM group already halted");
    demand(
        lower(await registry.addressOf(AMM.settings.key, at)) === lower(AMM.settings.address),
        "settings binding drift"
    );
    await runtime(
        provider,
        AMM.settings.address,
        AMM.settings.codeHash,
        "settings runtime drift",
        blockTag
    );
    const settings = new ethers.Contract(
        AMM.settings.address,
        ["function feesController() view returns(address)"],
        provider
    );
    demand(
        lower(await settings.feesController(at)) === lower(AMM.fsc.address),
        "fee controller drift"
    );
    await runtime(
        provider,
        AMM.fsc.address,
        AMM.fsc.codeHash,
        "collector runtime drift",
        blockTag
    );
    const collector = new ethers.Contract(
        AMM.fsc.address,
        [
            "function owner() view returns(address)",
            "function getProxyOwner() view returns(address)",
            "function getImplementation() view returns(address)",
            "function getWhitelistedConverterList() view returns(address[])",
        ],
        provider
    );
    demand(lower(await collector.owner(at)) === lower(AMM.fsc.owner), "collector owner drift");
    demand(
        lower(await collector.getProxyOwner(at)) === lower(AMM.fsc.owner),
        "collector proxy owner drift"
    );
    demand(
        lower(await collector.getImplementation(at)) === lower(AMM.fsc.implementation),
        "collector implementation drift"
    );
    await runtime(
        provider,
        AMM.fsc.implementation,
        AMM.fsc.implementationCodeHash,
        "collector implementation runtime drift",
        blockTag
    );
    demand(
        (await collector.getWhitelistedConverterList(at)).length === 0,
        "collector whitelist must remain empty; repeat independently immediately before execution"
    );
}
async function validateTargets(provider, blocker, part, blockTag) {
    demand(part === 1 || part === 2 || part === 3, "invalid part");
    assertManifest(MANIFEST.targets);
    demand(
        ethers.utils.isAddress(blocker) && blocker !== ethers.constants.AddressZero,
        "invalid blocker address"
    );
    demand(
        !MANIFEST.targets.some((t) => lower(t.address) === lower(blocker)),
        "self blocker forbidden"
    );
    await runtime(provider, blocker, HALT_RUNTIME_HASH, "blocker runtime mismatch", blockTag);
    const installed = [0, 0];
    for (const t of MANIFEST.targets) {
        await runtime(
            provider,
            t.address,
            t.proxyCodeHash,
            t.name + " proxy runtime drift",
            blockTag
        );
        const c = new ethers.Contract(t.address, PROXY_ABI, provider);
        demand(lower(await c.getOwner({ blockTag })) === lower(t.owner), t.name + " owner drift");
        const current = await c.getImplementation({ blockTag });
        const group = t.part;
        const alreadyInstalled = lower(current) === lower(blocker);
        if (alreadyInstalled) installed[group - 1]++;
        demand(
            alreadyInstalled || lower(current) === lower(t.implementation),
            t.name + " implementation drift"
        );
        await runtime(
            provider,
            t.implementation,
            t.implementationCodeHash,
            t.name + " implementation runtime drift",
            blockTag
        );
    }
    for (const [i, count] of installed.entries()) {
        demand(count === 0 || count === [10, 6][i], "partial Zero group state requires review");
        demand(part !== i + 2 || count === 0, "selected Zero group already halted");
    }
}
// Read-only preparation snapshot. This is not an execution-time on-chain invariant:
// an independent immediate precheck and post-execution readback remain required.
async function preflight(provider, blocker, part) {
    demand(part === 1 || part === 2 || part === 3, "invalid part");
    const snapshot = await provider.getBlock("latest");
    demand(
        snapshot && Number.isInteger(snapshot.number) && /^0x[0-9a-f]{64}$/i.test(snapshot.hash),
        "invalid snapshot"
    );
    await validateGovernance(provider, snapshot.number);
    await validateAmm(provider, snapshot.number, part);
    await validateTargets(provider, blocker, part, snapshot.number);
    demand(
        lower((await provider.getBlock(snapshot.number)).hash) === lower(snapshot.hash),
        "snapshot changed during preflight"
    );
    return { block: snapshot.number, hash: snapshot.hash };
}

function actionsForPart(part, blocker) {
    demand(part === 1 || part === 2 || part === 3, "invalid part");
    const targets = MANIFEST.targets.filter((t) => t.part === part - 1);
    const amm = part === 1 ? AMM.keys : [];
    return {
        targets: [...amm.map(() => AMM.registry.address), ...targets.map((t) => t.address)],
        targetOwnerValidationAddresses: [
            ...amm.map(() => AMM.registry.owner),
            ...targets.map((t) => t.owner),
        ],
        values: [...amm, ...targets].map(() => 0),
        signatures: [
            ...amm.map(() => "registerAddress(bytes32,address)"),
            ...targets.map(() => "setImplementation(address)"),
        ],
        data: [
            ...amm.map((k) =>
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "address"],
                    [k.key, AMM.inert.address]
                )
            ),
            ...targets.map(() => ethers.utils.defaultAbiCoder.encode(["address"], [blocker])),
        ],
    };
}
async function build(hre, part) {
    demand(part === 1 || part === 2 || part === 3, "invalid part");
    const chain = (await hre.ethers.provider.getNetwork()).chainId;
    let blocker = RELEASE_ADDRESS;
    const local = hre.sip0097Local;
    if (local) {
        await assertLocalFork(hre, local.pin);
        blocker = local.address;
    } else {
        demand(chain === 30 && hre.network.name === "rskSovrynMainnet", "unsupported network");
        demand(
            RELEASE_ADDRESS && DOCUMENT.finalized,
            "missing mainnet deployment/finalized document release inputs"
        );
    }
    const deployment = await hre.deployments.get("GovernorOwner");
    demand(
        lower(deployment.address) === lower(MANIFEST.bindings.GovernorOwner.address),
        "GovernorOwner deployment binding mismatch"
    );
    await preflight(hre.ethers.provider, blocker, part);
    return {
        args: {
            ...actionsForPart(part, blocker),
            description: `${local ? "LOCAL FORK DRAFT ONLY — " : ""}SIP-0097 (Part ${part} of 3): Proposed Temporary Pause of the AMM and Zero\nPart 1 proposes three AMM registry changes using the deployed, fully verified AMMEmergencyHalt at 0x8c293ed020f4d7321b6b16c71584fddb560e0ebd. Parts 2 and 3 halt ten financial and six auxiliary Zero proxies respectively. Each part executes atomically and independently; combined execution requires all three. LP-token transfers remain enabled. SwapSettings and the fee controller remain unchanged. The FeeSharingCollector converter whitelist must remain empty throughout the pause, with an independent immediate precheck and readback at execution. Existing Perimeter escrow claims remain outside these actions.\nhttps://github.com/DistributedCollective/SIPS/blob/${DOCUMENT.commit}/SIP-0097.md\nsha256: ${DOCUMENT.sha256}`,
        },
        governor: "GovernorOwner",
    };
}
module.exports = {
    MANIFEST,
    AMM,
    HALT_RUNTIME_HASH,
    RELEASE_ADDRESS,
    DOCUMENT,
    PROXY_ABI,
    assertManifest,
    assertLocalFork,
    assertFreshFork,
    validateTargets,
    validateGovernance,
    validateAmm,
    preflight,
    actionsForPart,
    build,
    getArgsSip0097Part1: (hre) => build(hre, 1),
    getArgsSip0097Part2: (hre) => build(hre, 2),
    getArgsSip0097Part3: (hre) => build(hre, 3),
};
