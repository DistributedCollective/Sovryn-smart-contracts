pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";
import "../governance/IFeeSharingCollectorMultiToken.sol";

contract MockSovrynLBFactory {
    address feeRecipient;
    uint256 totalPairs;
    address[] lbPairs;

    constructor() public {}

    function getFeeRecipient() public returns (address) {
        return feeRecipient;
    }

    function setFeeRecipient(address _feeRecipient) public {
        feeRecipient = _feeRecipient;
    }

    function addLbPairs(uint256 _totalPairs, address[] memory _lbPairs) public {
        require(_totalPairs == _lbPairs.length, "mismatch lbPairs length");
        totalPairs = _totalPairs;
        lbPairs = _lbPairs;
    }

    function getNumberOfLBPairs() public view returns (uint256) {
        return totalPairs;
    }

    function getLBPairAtIndex(uint256 _id) public view returns (address) {
        return lbPairs[_id];
    }
}
