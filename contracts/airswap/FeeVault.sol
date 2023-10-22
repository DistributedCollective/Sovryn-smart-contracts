pragma solidity 0.5.17;

import "../openzeppelin/Ownable.sol";
import "../openzeppelin/IERC20_.sol";

import "./IFeeVault.sol";

contract FeeVault is Ownable, IFeeVault {
    function sendFunds(
        address _token,
        address _recipient,
        uint256 _amount
    ) public onlyOwner returns (bool) {
        return IERC20_(_token).transfer(_recipient, _amount);
    }
}
