pragma solidity 0.5.17;

pragma experimental ABIEncoderV2;

/**
 *  @title A proxy to the AirSwap ERC20 contract that collects fees before and after the conversion.
 *  @author Derek Mattr dharkmattr@gmail.com
 */
interface IAirswapFeeConnector {

    /// Maker
    struct Maker {
        /// @dev name of the market maker
        string makerName;
        /// @dev address of the signer who signs the order
        address signer;
        /// @dev address of the maker to send the fees
        address feeReceiver;
    }

    /// @notice Return array of makers registered in the contract
    /// @return Array of Maker objects
    function getMakers() external view returns (Maker[] memory);

    /// @notice Returns the rfq amount after subtracting the fees
    /// @param amount Amount provided by the user for trade
    /// @param splitAmmFees This param indicates if the fee should be divided by half and sent to 2 pools
    /// @return Quote amount for trade after deducting the fees
    function getRfqAmount(uint256 amount, bool splitAmmFees) external view returns (uint256);

    /// @notice Checks if the token address taken from the RFQ order is valid
    /// @param converter Address of the converter used to validate token
    /// @param token Address of the token to validate
    /// @param isSourceToken To specify if the token is source or destination
    /// @return isTokenSupported Checks if the token is supported by Sovryn protocol
    /// @return isConverterValid Checks if the provided converter address is valid
    /// @return isTokenValid Checks if the token provided is valid
    function isValidConverterToken(address converter, address token, bool isSourceToken) 
        external 
        view
        returns (bool isTokenSupported, bool isConverterValid, bool isTokenValid);

    /// @notice Returns the total fee percentage in bps
    /// @return Sum of all fee percentages in bps
    function getTotalBps() external view returns(uint256);

    /// @notice This function can be used to add new maker details
    /// @param maker Maker struct providing the details of maker to add
    function addMaker(Maker calldata maker) external;

    /// @notice Removes the maker from the list
    /// @param signer Address of the signer used by maker
    function removeMaker(address signer) external;

    /// @notice Update the signer address of the maker
    /// @param fromAddress Current address of the maker
    /// @param toAddress New address of the maker
    function updateMakerAddress(address fromAddress, address toAddress) external;

    /// @notice Update the airswap fee percentage
    /// @param _airswapFeeBps Airswap fee percentage in basis points
    function setAirswapFeeBps(uint256 _airswapFeeBps) external;

    /// @notice Update the maker fee percentage
    /// @param _makerFeeBps Maker fee percentage in basis points
    function setMakerFeeBps(uint256 _makerFeeBps) external;

    /// @notice Update the amm lp fee percentage
    /// @param _ammFeeLpBps Amm Fee Lp in basis points
    function setAmmLpFeeBps(uint256 _ammFeeLpBps) external;

    /// @notice Update the bitocracy fee percentage
    /// @param _bitocracyFeeBps Bitocracy fee in basis points
    function setBitocracyFeeBps(uint256 _bitocracyFeeBps) external;

    
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
