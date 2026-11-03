// Test entry points must never consume inherited signing material.
function assertNoSigningInputs(environment = process.env) {
    const forbidden =
        /PRIVATE_?KEY|MNEMONIC|PASSWORD|PASSPHRASE|(^|_)SEED(_|$)|(^|_)DEPLOYER(_|$)|(^|_)SIGNER(_|$)|RPC_AUTH/i;
    for (const name of Object.keys(environment)) {
        if (forbidden.test(name)) throw new Error(`SIP0097: signing input forbidden: ${name}`);
    }
}

function assertIsolatedHardhat(environment = process.env, argv = process.argv) {
    const selected = [];
    if (environment.HARDHAT_NETWORK !== undefined) selected.push(environment.HARDHAT_NETWORK);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--network") selected.push(argv[i + 1]);
        else if (argv[i].startsWith("--network=")) selected.push(argv[i].slice(10));
    }
    if (selected.some((name) => name !== "hardhat")) {
        throw new Error("SIP0097: isolated config requires hardhat network");
    }
}
async function assertIsolatedUnitContext(hre) {
    assertNoSigningInputs();
    if (hre.network.name !== "hardhat" || hre.network.config.url || hre.network.config.forking) {
        throw new Error("SIP0097: isolated unit requires in-process hardhat network");
    }
    if ((await hre.ethers.provider.getNetwork()).chainId !== 31337) {
        throw new Error("SIP0097: isolated unit requires chain31337");
    }
    if (!/^HardhatNetwork\//i.test(await hre.ethers.provider.send("web3_clientVersion", []))) {
        throw new Error("SIP0097: isolated unit requires HardhatNetwork client");
    }
}
module.exports = { assertNoSigningInputs, assertIsolatedHardhat, assertIsolatedUnitContext };
