/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./objects/LoanStruct.sol";
import "./objects/LoanParamsStruct.sol";
import "./objects/OrderStruct.sol";
import "./objects/LenderInterestStruct.sol";
import "./objects/LoanInterestStruct.sol";

/**
 * @title Objects contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract inherints and aggregates several structures needed to handle
 * loans on the protocol.
 * */
contract Objects is
    LoanStruct,
    LoanParamsStruct,
    OrderStruct,
    LenderInterestStruct,
    LoanInterestStruct
{

}
