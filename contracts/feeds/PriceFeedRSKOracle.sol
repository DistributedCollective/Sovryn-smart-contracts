pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IRSKOracle.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";

/**
 * @notice The Price Feed RSK Oracle contract.
 *
 * This contract implements RSK Oracle query functionality,
 * getting the price and the last timestamp from an external oracle contract.
 * */
contract PriceFeedRSKOracle is IPriceFeedsExt, Ownable {
    /* Storage */

    address public rskOracleAddress;

    /* Events */

    event SetRSKOracleAddress(address indexed rskOracleAddress, address changerAddress);

    /* Functions */

    /**
     * @notice Initialize a new RSK Oracle.
     *
     * @param _rskOracleAddress The RSK Oracle address.
     * */
    constructor(address _rskOracleAddress) public {
        setRSKOracleAddress(_rskOracleAddress);
    }

    /**
     * @notice Get the oracle price.
     * @return The price from Oracle.
     * */
    function latestAnswer() external view returns (uint256 _price) {
        IRSKOracle _rskOracle = IRSKOracle(rskOracleAddress);
        (_price, ) = _rskOracle.getPricing();
    }

    /**
     * @notice Get the las time oracle updated the price.
     * @return The latest time.
     */
    function latestTimestamp() external view returns (uint256 _timestamp) {
        IRSKOracle _rskOracle = IRSKOracle(rskOracleAddress);
        (, _timestamp) = _rskOracle.getPricing();
    }

    /**
     * @notice Set the RSK Oracle address.
     *
     * @param _rskOracleAddress The RSK Oracle address.
     */
    function setRSKOracleAddress(address _rskOracleAddress) public onlyOwner {
        require(Address.isContract(_rskOracleAddress), "_rskOracleAddress not a contract");
        rskOracleAddress = _rskOracleAddress;
        emit SetRSKOracleAddress(rskOracleAddress, msg.sender);
    }
}
