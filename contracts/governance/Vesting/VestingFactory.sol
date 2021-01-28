pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../openzeppelin/ERC20.sol";

contract VestingFactory is Ownable {

    //TODO do we need to support N CSOV ?
    ERC20 public CSOV;

    //user => vesting type => vesting contract
    mapping(address => mapping(VestingType => address)) public vestingContracts;

    enum VestingType {
        MultisigVesting, //TeamVesting
        TokenHolderVesting, //Vesting
        DevelopmentVesting //Adoption fund, Development fund
    }

    function exchangeCSOV(uint96 _amount) public {
        require(_amount > 0, "VestingFactory:: exchangeCSOV: amount invalid");

        //holds CSOV tokens
        bool success = CSOV.transferFrom(_sender, address(this), _amount);
        require(success, "VestingFactory:: exchangeCSOV: transfer failed");

        //move SOV tokens from an appropriate fund

        //create vesting contract or load an existing one

        //stakeTokens

        //event
    }

}
