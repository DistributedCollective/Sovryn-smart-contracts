/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../../openzeppelin/SignedSafeMath.sol";
import "../../openzeppelin/SafeMathSovryn.sol";
import "../../openzeppelin/ReentrancyGuard.sol";
import "../../openzeppelin/Ownable.sol";
import "../../openzeppelin/AddressSovryn.sol";
import "../../interfaces/IWrbtcERC20.sol";
import "./Pausable.sol";

contract LoanTokenBase is ReentrancyGuard, Ownable {

    uint256 internal constant WEI_PRECISION = 10**18;
    uint256 internal constant WEI_PERCENT_PRECISION = 10**20;

    int256 internal constant sWEI_PRECISION = 10**18;

    string public name;
    string public symbol;
    uint8 public decimals;

    address public loanTokenAddress;

    uint256 public baseRate;
    uint256 public rateMultiplier;
    uint256 public lowUtilBaseRate;
    uint256 public lowUtilRateMultiplier;

    uint256 public targetLevel;
    uint256 public kinkLevel;
    uint256 public maxScaleRate;

    uint256 internal _flTotalAssetSupply;
    uint256 public checkpointSupply;
    uint256 public initialPrice;

    // uint88 for tight packing -> 8 + 88 + 160 = 256
    uint88 internal lastSettleTime_;

    mapping (uint256 => bytes32) public loanParamsIds; // mapping of keccak256(collateralToken, isTorqueLoan) to loanParamsId
    mapping (address => uint256) internal checkpointPrices_; // price of token at last user checkpoint
    
    mapping(address => uint256) public transactionLimit;                                 // the maximum trading/borrowing/lending limit per token address
                                                                                         // 0 -> no limit
}