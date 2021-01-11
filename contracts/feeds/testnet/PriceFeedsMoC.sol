pragma solidity 0.5.17;

import "../PriceFeeds.sol";
import "../IRSKOracle.sol";
import "../../openzeppelin/Address.sol";

interface Medianizer {
    function peek() external view returns (bytes32, bool);
}

contract PriceFeedsMoC is IPriceFeedsExt, Ownable {
    address public mocOracleAddress;
    address public rskOracleAddress;

    event SetMoCOracleAddress(
        address indexed mocOracleAddress,
        address changerAddress
    );
    event SetRSKOracleAddress(
        address indexed rskOracleAddress,
        address changerAddress
    );

    constructor(address _mocOracleAddress, address _rskOracleAddress) public {
        setMoCOracleAddress(_mocOracleAddress);
        setRSKOracleAddress(_rskOracleAddress);
    }

    function latestAnswer() external view returns (uint256) {
        (bytes32 value, bool hasValue) = Medianizer(mocOracleAddress).peek();
        if (hasValue) {
            return uint256(value);
        } else {
            (uint256 price, ) = IRSKOracle(rskOracleAddress).getPricing();
            return price;
        }
    }

    function setMoCOracleAddress(address _mocOracleAddress) public onlyOwner {
        require(
            Address.isContract(_mocOracleAddress),
            "_mocOracleAddress not a contract"
        );
        mocOracleAddress = _mocOracleAddress;
        emit SetMoCOracleAddress(mocOracleAddress, msg.sender);
    }

    function setRSKOracleAddress(address _rskOracleAddress) public onlyOwner {
        require(
            Address.isContract(_rskOracleAddress),
            "_rskOracleAddress not a contract"
        );
        rskOracleAddress = _rskOracleAddress;
        emit SetRSKOracleAddress(rskOracleAddress, msg.sender);
    }
}
