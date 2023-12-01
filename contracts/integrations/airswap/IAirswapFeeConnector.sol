pragma solidity 0.5.17;

/**
 *  @title A proxy to the AirSwap ERC20 contract that collects fees before and after the conversion.
 *  @author Derek Mattr dharkmattr@gmail.com
 */
interface IAirswapFeeConnector {
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
    /// @param _sender Address which is sending the tokens
    /// @param _recipient Address to send the resulting tokens after collecting the output fee
    /// @param _nonce A one time nonce
    /// @param _expiry Date at which the original proposal will expire
    /// @param _signerWallet Address of the market maker wallet
    /// @param _signerToken Address of the token to convert to
    /// @param _signerAmount Amount of resulting token from the conversion
    /// @param _totalSenderAmount The amount to be sent before the input fee is collected.
    /// @param _v v part of the ECDSA signature
    /// @param _r r part of the ECDSA signature
    /// @param _s s part of the ECDSA signature
    function swap(
        address _sender,
        address _recipient,
        uint256 _nonce,
        uint256 _expiry,
        address _signerWallet,
        address _signerToken,
        uint256 _signerAmount,
        address _senderToken,
        uint256 _totalSenderAmount,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external;
}
