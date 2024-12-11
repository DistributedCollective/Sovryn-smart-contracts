pragma solidity 0.5.17;

import "./PriceFeeds.sol";
import "../openzeppelin/Address.sol";

interface Medianizer {
    function peek() external view returns (bytes32, bool);
}

interface IPriceFeedLatestAnswer {
    function latestAnswer() external view returns (uint256 price, bool success);
}

/**
 * @title Price Feed of MoC (Money on Chain) contract.
 *
 * This contract contains the logic to set MoC oracles
 * and query last price update.
 * */
contract PriceFeedsMoC is IPriceFeedsExt, Ownable {
    /* Storage */

    address public mocOracleAddress;
    address public fallbackOracleAddress;

    /* Events */

    event SetMoCOracleAddress(address indexed mocOracleAddress, address changerAddress);
    event SetFallbackOracleAddress(address indexed fallbackOracleAddress, address changerAddress);

    /* Functions */

    /**
     * @notice Initialize a new MoC Oracle.
     *
     * @param _mocOracleAddress The MoC Oracle address.
     * @param _fallbackOracleAddress The fallback Oracle address.
     * */
    constructor(address _mocOracleAddress, address _fallbackOracleAddress) public {
        setMoCOracleAddress(_mocOracleAddress);
        setFallbackOracleAddress(_fallbackOracleAddress);
    }

    /**
     * @notice Get the las time oracle updated the price.
     * @return The latest time.
     */
    function latestAnswer() external view returns (uint256) {
        (bytes32 value, bool hasValue) = Medianizer(mocOracleAddress).peek();
        if (hasValue) {
            return uint256(value);
        } else {
            (uint256 price, bool success) = IPriceFeedLatestAnswer(fallbackOracleAddress)
                .latestAnswer();
            return success ? price : 0;
        }
    }

    /**
     * @notice Set the MoC Oracle address.
     *
     * @param _mocOracleAddress The MoC Oracle address.
     */
    function setMoCOracleAddress(address _mocOracleAddress) public onlyOwner {
        require(Address.isContract(_mocOracleAddress), "_mocOracleAddress not a contract");
        mocOracleAddress = _mocOracleAddress;
        emit SetMoCOracleAddress(mocOracleAddress, msg.sender);
    }

    /**
     * @notice Set the fallback Oracle address.
     *
     * @param _fallbackOracleAddress The fallback Oracle address.
     */
    function setFallbackOracleAddress(address _fallbackOracleAddress) public onlyOwner {
        require(
            Address.isContract(_fallbackOracleAddress),
            "_fallbackOracleAddress not a contract"
        );
        fallbackOracleAddress = _fallbackOracleAddress;
        emit SetFallbackOracleAddress(fallbackOracleAddress, msg.sender);
    }
}
