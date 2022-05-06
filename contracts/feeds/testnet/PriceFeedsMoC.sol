pragma solidity 0.5.17;

import "../PriceFeeds.sol";
import "../IRSKOracle.sol";
import "../../openzeppelin/Address.sol";

interface Medianizer {
    function peek() external view returns (bytes32, bool);
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
    address public rskOracleAddress;

    /* Events */

    event SetMoCOracleAddress(address indexed mocOracleAddress, address changerAddress);
    event SetRSKOracleAddress(address indexed rskOracleAddress, address changerAddress);

    /* Functions */

    /**
     * @notice Initialize a new MoC Oracle.
     *
     * @param _mocOracleAddress The MoC Oracle address.
     * @param _rskOracleAddress The RSK Oracle address.
     * */
    constructor(address _mocOracleAddress, address _rskOracleAddress) public {
        setMoCOracleAddress(_mocOracleAddress);
        setRSKOracleAddress(_rskOracleAddress);
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
            (uint256 price, ) = IRSKOracle(rskOracleAddress).getPricing();
            return price;
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
