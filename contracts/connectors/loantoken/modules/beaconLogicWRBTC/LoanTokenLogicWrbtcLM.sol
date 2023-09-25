// SPDX-License-Identifier: MIT

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../LoanTokenLogicSplit.sol";

contract LoanTokenLogicWrbtcLM is LoanTokenLogicSplit {
    /**
     * @notice This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
     * Every new public function, the signature needs to be included in this function.
     *
     * @dev This function will return the list of function signature in this contract that are available for public call
     * Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.
     * @dev To save the gas we can just directly return the list of function signature from this pure function.
     * The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
     * Then, in this function we just need to return that storage variable.
     *
     * @return The list of function signatures (bytes4[])
     */
    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](4);

        // Loan Token Mint and Burn.
        res[0] = this.mint.selector;
        res[1] = this.burn.selector;

        // Loan Token WRBTC
        res[2] = this.mintWithBTC.selector;
        res[3] = this.burnToBTC.selector;

        return (res, stringToBytes32("LoanTokenLogicWrbtcLM"));
    }

    function mintWithBTC(address receiver, bool useLM)
        external
        payable
        nonReentrant
        globallyNonReentrant
        returns (uint256 mintAmount)
    {
        if (useLM) return _mintWithLM(receiver, msg.value);
        else return _mintToken(receiver, msg.value);
    }

    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 loanAmountPaid) {
        loanAmountPaid = useLM ? _burnFromLM(burnAmount) : _burnToken(burnAmount);

        if (loanAmountPaid != 0) {
            IWrbtcERC20(wrbtcTokenAddress).withdraw(loanAmountPaid);
            Address.sendValue(receiver, loanAmountPaid);
        }
    }
}
