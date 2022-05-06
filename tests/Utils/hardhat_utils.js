const hh = require("hardhat");
const {
    normalizeHardhatNetworkAccountsConfig,
    derivePrivateKeys,
} = require("hardhat/internal/core/providers/util");

function getAccountsPrivateKeys() {
    const netConfig = hh.network.config;
    return normalizeHardhatNetworkAccountsConfig(netConfig.accounts);
}

function getAccountsPrivateKeysBuffer() {
    const accountsConfig = hh.network.config.accounts;
    return derivePrivateKeys(
        accountsConfig.mnemonic,
        accountsConfig.path,
        accountsConfig.initialIndex,
        accountsConfig.count
    );
}

module.exports = {
    getAccountsPrivateKeys,
    getAccountsPrivateKeysBuffer,
};
