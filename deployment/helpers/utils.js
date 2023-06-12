// extracts the contract name from the script file name:
// prefix_ContractName.ts -> returns ContractName
// e.g. 1-deploy-PerpetualDepositManager.ts -> PerpetualDepositManager
const getContractNameFromScriptFileName = (filename) => {
    return filename.substring(filename.lastIndexOf("-") + 1, filename.lastIndexOf("."));
};

const arrayToUnique = (value, index, self) => {
    return self.indexOf(value) === index;
};

const encodeParameters = (types, values) => {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
};

module.exports = {
    getContractNameFromScriptFileName,
    arrayToUnique,
    encodeParameters,
};
