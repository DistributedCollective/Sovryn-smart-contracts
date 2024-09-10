const testnetDeploymentConfigParams = {
    multisigOwners: [
        "0x13Be55487D37FE3C66EE7305e1e9C1ac85de75Ae",
        "0xCF311E7375083b9513566a47B9f3e93F1FcdCfBF",
        "0x8C9143221F2b72Fcef391893c3a02Cf0fE84f50b"
    ],
    required: 2,
};

const CONFIG_DEPLOYMENT_PARAMS = {
    bobTestnet: testnetDeploymentConfigParams,
    tenderlyVirtualNetwork: testnetDeploymentConfigParams,
    sepolia: testnetDeploymentConfigParams,
};

module.exports = {
    CONFIG_DEPLOYMENT_PARAMS,
};
