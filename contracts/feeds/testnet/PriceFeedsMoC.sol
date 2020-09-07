pragma solidity 0.5.17;

import "../PriceFeeds.sol";
import "../../openzeppelin/Address.sol";

interface Medianizer {
    function peek() external view returns (bytes32, bool);
}

contract PriceFeedsMoC is IPriceFeedsExt, Ownable {

    address public mocOracleAddress;

    event SetMoCOracleAddress(address indexed mocOracleAddress, address changerAddress);

    constructor(
        address _mocOracleAddress)
        public
    {
        setMoCOracleAddress(_mocOracleAddress);
    }

    function latestAnswer()
        external
        view
        returns (uint256)
    {
        (bytes32 value, bool hasValue) = Medianizer(mocOracleAddress).peek();
        require(hasValue, "Doesn't has value");
        return uint256(value);
    }

    function setMoCOracleAddress(
        address _mocOracleAddress)
        public
        onlyOwner
    {
        require(Address.isContract(_mocOracleAddress), "_mocOracleAddress not a contract");
        mocOracleAddress = _mocOracleAddress;
        emit SetMoCOracleAddress(mocOracleAddress, msg.sender);
    }
}
