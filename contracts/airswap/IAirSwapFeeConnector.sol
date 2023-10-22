pragma solidity 0.5.17;

interface IAirSwapFeeConnector {

    function setFeeLogic(address feeLogicAddress) external;
    function setFeeVault(address feeVaultAddress) external;

    function swap(
        address senderToken,
        uint256 totalSenderAmount,
        address signerWallet,
        address signerToken,
        uint256 signerAmount,
        address recipient,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s) external;
}
