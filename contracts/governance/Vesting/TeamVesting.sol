pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Vesting.sol";
import "../../openzeppelin/Ownable.sol";

/**
 * A regular vesting contract, but the owner of the remaining locked tokens can be changed by the owner (governance)
 **/
contract TeamVesting is Vesting, Ownable{
    
    /**
     * withdraws the unlocked tokens to the current owner and transfers the ownership of the locked tokens to a new owner
     * @param newOwner the address of the new owner
     * */
    function transferTokenOwnership(address newOwner) public onlyOwner{
        require(newOwner != address(0), "owner needs to be a valid address");
        //todo withdraw the unlocked tokens for the old owner
        tokenOwner = newOwner;
    }
    
}