const FordwardingContract = artifacts.require("FordwardingContract");

module.exports = function (deployer) {
  deployer.deploy(FordwardingContract);
};
