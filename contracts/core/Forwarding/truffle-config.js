const HDWalletProvider = require("@truffle/hdwallet-provider");
const mnemonic = "Your mnemonic-seed phrase";
module.exports = {
  compilers: {
    solc: {
      version: "0.7.6",
    },
  },
  networks: {
    testnet: {
      provider: () =>
        new HDWalletProvider(
          mnemonic,
          "https://public-node.testnet.rsk.co",
          0,
          10,
          true,
          "m/44'/37310'/0'/0/"
        ),
      network_id: 31,
      gasPrice: 10000000000,
      networkCheckTimeout: 1e9,
      timeoutBlocks: 50000,
    },
  },
  //  development: {
  //    host: "127.0.0.1",
  //    port: 7545,
  //    network_id: "*"
  //  },
  //  test: {
  //    host: "127.0.0.1",
  //    port: 7545,
  //    network_id: "*"
  //  }
  //}
  //
};
