/**
 * The one rail everything in this directory sits behind: nothing is ever sent
 * anywhere but a QA fork running on this machine.
 *
 * Four independent things have to agree, because no one of them is sufficient:
 *
 *   1. the network url names a loopback host, so the node cannot be a shared
 *      or hosted one however the config was edited;
 *   2. the node itself answers `web3_clientVersion` as hardhat or anvil. That
 *      question is put to the provider directly rather than through a helper
 *      that consults the environment first, so no exported variable can answer
 *      on the node's behalf;
 *   3. chain id 30 — necessary, never sufficient, since real RSK reports 30 too;
 *   4. the network carries the "qa" tag, which only `rskForkedMainnetQa` does.
 *
 * The callers impersonate accounts and rewrite balances. Both belong on a
 * throwaway node and nowhere else.
 */
const CHAIN_ID = 30;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_CLIENTS = [/hardhat/i, /anvil/i];

/** The host a network url points at, or null when there is no url to read. An
 *  in-process network carries none, and that is not a QA fork either. */
const urlHost = (url) => {
    if (typeof url !== "string" || url === "") return null;
    try {
        // A bracketed IPv6 literal comes back bracketed; the set is spelled bare.
        return new URL(url).hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
    } catch (error) {
        return null;
    }
};

const assertLocalQaFork = async (hre) => {
    const url = (hre.network.config && hre.network.config.url) || null;
    const host = urlHost(url);
    if (host === null || !LOOPBACK_HOSTS.has(host)) {
        throw new Error(
            `perimeter QA: network "${hre.network.name}" points at ${url || "no url"}, whose ` +
                `host is not a loopback address. This impersonates accounts and rewrites ` +
                "balances, so it runs against a node on this machine only — boot " +
                "scripts/perimeter/qa-node.sh and export PERIMETER_QA_RPC to its port."
        );
    }

    const { chainId } = await hre.ethers.provider.getNetwork();
    if (chainId !== CHAIN_ID || !hre.network.tags.qa) {
        throw new Error(
            `perimeter QA: refusing to run against chain id ${chainId} on network ` +
                `"${hre.network.name}". This writes to a local fork only and expects chain id ` +
                `${CHAIN_ID} on a network tagged "qa" — boot scripts/perimeter/qa-node.sh and ` +
                "pass --network rskForkedMainnetQa."
        );
    }

    // The tag says what the config INTENDS; the node itself says what is really
    // answering. Only a local hardhat or anvil process accepts the impersonation
    // and balance writes, and a hosted fork would take them as a shared, durable
    // environment rather than a throwaway one.
    let clientVersion;
    try {
        clientVersion = String(await hre.ethers.provider.send("web3_clientVersion", []));
    } catch (error) {
        clientVersion = `unavailable (${error.message})`;
    }
    if (!LOCAL_CLIENTS.some((pattern) => pattern.test(clientVersion))) {
        throw new Error(
            `perimeter QA: the node at ${url} reports itself as "${clientVersion}", not a local ` +
                "hardhat or anvil fork. This impersonates accounts and rewrites balances, which " +
                "belongs on a throwaway node only."
        );
    }
};

module.exports = { assertLocalQaFork, CHAIN_ID, LOOPBACK_HOSTS };
