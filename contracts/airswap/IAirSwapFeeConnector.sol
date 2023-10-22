pragma solidity 0.5.17;

/**
 *  @title A proxy to the AirSwap ERC20 contract that collects fees before and after the conversion.
 *  @author Derek Mattr dharkmattr@gmail.com
 */
interface IAirSwapFeeConnector {

    /// @notice Set the input fee in points, ie 25 means 2.5 percent.
    ///         The input fee is collected on the sent tokens before 
    ///         the actual conversion.
    /// @param inputFeeInPoints The new fee in points
    function setInputFee(uint256 inputFeeInPoints) external;

    /// @notice Set the out fee in points, ie 25 means 2.5 percent.
    ///         The output fee is collecte after the conversion.
    /// @param outputFeeInPoints The new fee in points
    function setOutputFee(uint256 outputFeeInPoints) external;

    /// @notice Set the address to which fees are sent
    /// @param newAddress The new address
    function setFeeVaultAddress(address newAddress) external;

    /// @notice Set the address of the AirSwap contract
    /// @param newAddress The new address
    function setSwapERC20Address(address newAddress) external;

    /// @notice Swap one token for another.
    /// @param senderToken The token which is to be sent
    /// @param totalSenderAmount The amount to be sent before the input fee is collected. 
    /// @param signerWallet Address of the market maker wallet
    /// @param signerAmount Amount of resulting token from the conversion
    /// @param recipient Address to send the resulting tokens after collecting the output fee
    /// @param recipient Address to send the resulting tokens after collecting the output fee
    /// @param nonce A one time nonce
    /// @param expiry Date at which the original proposal will expire
    /// @param v v part of the ECDSA signature
    /// @param r r part of the ECDSA signature
    /// @param s s part of the ECDSA signature
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
        bytes32 s
    ) external;
}
