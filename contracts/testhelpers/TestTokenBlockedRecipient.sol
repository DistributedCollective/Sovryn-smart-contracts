pragma solidity 0.5.17;

import "./TestToken.sol";

/// @notice TestToken variant whose `transfer` RETURNS FALSE (does not revert)
///         for blocked recipients, so a single transfer leg can be failed
///         while every other transfer in the same flow succeeds.
///
///         Built for the ColFee VAULT_REVERT fee-leg tests: block the
///         feeReceiver and the fee-leg primitive's length-gated bool decode
///         (`LoanTokenLogicShared._transferUnderlyingToken(nonBlocking=true)`
///         on the iToken side, `ColFeeBorrowerExitOps._payExitFeeLeg` ERC20
///         branch on the protocol side) must report failure and fall back to a
///         full-gross user payout — without reverting the exit.
contract TestTokenBlockedRecipient is TestToken {
    mapping(address => bool) public blockedRecipient;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialAmount
    ) public TestToken(_name, _symbol, _decimals, _initialAmount) {}

    function setBlockedRecipient(address who, bool blocked) external {
        blockedRecipient[who] = blocked;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        if (blockedRecipient[_to]) return false;
        return super.transfer(_to, _value);
    }
}
