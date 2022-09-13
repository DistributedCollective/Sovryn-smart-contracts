// extracts the contract name from the script file name:
// prefix_ContractName.ts -> returns ContractName
// e.g. 1-deploy-PerpetualDepositManager.ts -> PerpetualDepositManager
const getContractNameFromScriptFileName = (filename) => {
    return filename.substring(filename.lastIndexOf("-") + 1, filename.lastIndexOf("."));
};

module.exports = {
    getContractNameFromScriptFileName,
};
