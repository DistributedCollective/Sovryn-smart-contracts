pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";

contract GovernorTokensHolder is Ownable {

    IERC20 token;

    constructor(address _token) public {
        token = token;
    }

    function transfer(address recipient, uint256 amount) public onlyOwner returns (bool) {
        return token.transfer(recipient, amount);
    }

}
