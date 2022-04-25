pragma solidity 0.5.17;

import "../feeds/testnet/PriceFeedsMoC.sol";

// This contract is only for test purposes
// https://github.com/money-on-chain/Amphiraos-Oracle/blob/master/contracts/medianizer/medianizer.sol
contract PriceFeedsMoCMockup is Medianizer {
    uint256 public value;
    bool public has;

    function peek() external view returns (bytes32, bool) {
        return (bytes32(value), has);
    }

    function setValue(uint256 _value) public {
        value = _value;
    }

    function setHas(bool _has) public {
        has = _has;
    }
}
