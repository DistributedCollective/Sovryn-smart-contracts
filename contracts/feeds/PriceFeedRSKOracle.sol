pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IRSKOracle.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";

contract PriceFeedRSKOracle is IPriceFeedsExt, Ownable {
    address public rskOracleAddress;

    event SetRSKOracleAddress(
        address indexed rskOracleAddress,
        address changerAddress
    );

    /**
     * @dev initializes a new RSK Oracle
     *
     * @param _rskOracleAddress RSK Oracle address
     */
    constructor(address _rskOracleAddress) public {
        setRSKOracleAddress(_rskOracleAddress);
    }

    /**
     * @return price
     */
    function latestAnswer() external view returns (uint256 _price) {
        IRSKOracle _rskOracle = IRSKOracle(rskOracleAddress);
        (_price, ) = _rskOracle.getPricing();
    }

    /**
     * @return latest time
     */
    function latestTimestamp() external view returns (uint256 _timestamp) {
        IRSKOracle _rskOracle = IRSKOracle(rskOracleAddress);
        (, _timestamp) = _rskOracle.getPricing();
    }

    /**
     * @dev set RSK Oracle address
     *
     * @param _rskOracleAddress RSK Oracle address
     */
    function setRSKOracleAddress(address _rskOracleAddress) public onlyOwner {
        require(
            Address.isContract(_rskOracleAddress),
            "_rskOracleAddress not a contract"
        );
        rskOracleAddress = _rskOracleAddress;
        emit SetRSKOracleAddress(rskOracleAddress, msg.sender);
    }
}
