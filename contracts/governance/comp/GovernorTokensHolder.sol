pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";

//we don't need it for Genesis Sale
contract GovernorTokensHolder is Ownable {

    IERC20 public token;

    constructor(address _token) public {
        token = IERC20(_token);
    }

    function transfer(address recipient, uint256 amount) public onlyOwner returns (bool) {
        return token.transfer(recipient, amount);
    }

}
